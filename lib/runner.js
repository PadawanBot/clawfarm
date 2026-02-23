/**
 * ClawFarm v1.5 - Step Runner
 * Runs each workflow step as a local openclaw agent turn.
 * Clears agent session before each run to prevent history contamination.
 */

import { spawn } from "child_process";
import { rmSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { buildPrompt, saveStepOutput } from "./context.js";
import { log } from "./report.js";

/**
 * Clear the agent's session history so each step starts fresh.
 */
function clearAgentSession(agentId) {
  const sessionsDir = join(homedir(), ".openclaw", "agents", agentId, "sessions");
  if (existsSync(sessionsDir)) {
    rmSync(sessionsDir, { recursive: true, force: true });
    log(`  Cleared session history for ${agentId}`);
  }
}

/**
 * Run a single workflow step.
 * Model is determined by agent registration (clawfarm setup-agents).
 */
export async function runStep(step, context, runId) {
  const prompt = buildPrompt(step.input, context);
  const agentId = `clawfarm-${step.agent}`;
  const timeoutMs = (step.timeout || 300) * 1000;

  // Always start fresh — no history contamination between runs
  clearAgentSession(agentId);

  log(`  Agent: ${agentId} | Timeout: ${step.timeout || 300}s`);

  return new Promise((resolve, reject) => {
    let output = "";
    let timedOut = false;
    const startMs = Date.now();

    const args = [
      "agent",
      "--agent",
      agentId,
      "--local",
      "--message",
      prompt,
    ];

    const proc = spawn("openclaw", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error(`Step "${step.id}" timed out after ${step.timeout || 300}s`));
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write(chunk);
    });

    proc.stderr.on("data", (data) => {
      const chunk = data.toString();
      if (!chunk.includes("[plugins]") && !chunk.includes("[diagnostic]") && !chunk.includes("BlockRun provider")) {
        process.stderr.write(chunk);
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      const durationSec = Math.round((Date.now() - startMs) / 1000);
      log(`  Completed in ${durationSec}s`);

      if (code !== 0 && code !== null) {
        reject(new Error(`Step "${step.id}" exited with code ${code}\nOutput: ${output.slice(-500)}`));
        return;
      }

      const expectsPattern = step.expects || "STATUS: done";
      const expectsRegex = new RegExp(expectsPattern, "i");

      if (!expectsRegex.test(output)) {
        reject(new Error(`Step "${step.id}" did not produce expected pattern: "${expectsPattern}"\nLast 500 chars: ${output.slice(-500)}`));
        return;
      }

      saveStepOutput(runId, step.id, output);
      resolve(output);
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn openclaw: ${err.message}. Is openclaw in PATH?`));
    });
  });
}

/**
 * ClawFarm v1.5 - Step Runner
 * Runs each workflow step as a local openclaw agent turn.
 * Uses --local mode (no gateway required), streams output, checks expects pattern.
 */

import { spawn } from "child_process";
import { buildPrompt, saveStepOutput } from "./context.js";
import { log } from "./report.js";

/**
 * Run a single workflow step.
 * NOTE: openclaw agent does not accept a per-call --model flag.
 * Therefore the effective model is determined by agent registration (setup-agents).
 */
export async function runStep(step, context, runId) {
  const prompt = buildPrompt(step.input, context);
  const agentId = `clawfarm-${step.agent}`;
  const timeoutMs = (step.timeout || 300) * 1000;

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

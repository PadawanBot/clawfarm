/**
 * ClawFarm v2 — Step Runner
 * Executes each workflow step as a proper OpenClaw sub-agent session.
 * Replaces the v1 headless shell pipe approach.
 */

import { buildPrompt, saveStepOutput } from './context.js';
import { spawnAgentSession } from './spawn.js';
import { pollSession } from './poller.js';
import { log } from './report.js';
import chalk from 'chalk';

/**
 * Run a single workflow step as a real agent session.
 * @param {Object} step - Workflow step definition
 * @param {Object} context - Run context (task, repo, previous outputs)
 * @param {string} runId - Current run ID
 * @returns {Promise<string>} - Step output
 */
export async function runStep(step, context, runId) {
  const prompt = buildPrompt(step.input, context);
  const agentId = `clawfarm-${step.agent}`;
  const model = step.model;
  const timeoutMs = (step.timeout || 300) * 1000;

  log(`  Model: ${model} | Agent: ${agentId} | Timeout: ${step.timeout || 300}s`);

  // Spawn a real agent session
  let sessionKey, spawnRunId;
  try {
    const spawned = await spawnAgentSession({
      agentId,
      model,
      prompt,
      label: `clawfarm-${runId}-${step.id}`,
      timeoutSeconds: step.timeout || 300,
    });
    sessionKey = spawned.sessionKey;
    spawnRunId = spawned.runId;
  } catch (err) {
    throw new Error(`Failed to spawn session for step "${step.id}": ${err.message}`);
  }

  log(chalk.dim(`  Session: ${sessionKey}`));

  // Poll until completion
  const result = await pollSession({
    sessionKey,
    expects: step.expects || 'STATUS: done',
    timeoutMs,
    onChunk: (chunk) => process.stdout.write(chunk),
  });

  // Validate expects pattern
  const expectsRegex = new RegExp(step.expects || 'STATUS: done', 'i');
  if (!expectsRegex.test(result.output)) {
    throw new Error(
      `Step "${step.id}" completed but did not match expected pattern: "${step.expects}"\n` +
      `Last 300 chars: ${result.output.slice(-300)}`
    );
  }

  // Save output
  saveStepOutput(runId, step.id, result.output);

  const durationSec = Math.round(result.duration / 1000);
  log(chalk.dim(`  Completed in ${durationSec}s`));

  return result.output;
}

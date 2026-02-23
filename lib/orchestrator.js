/**
 * ClawFarm v2 — Orchestrator
 * Runs workflow steps sequentially via proper sub-agent sessions.
 * On failure: interactive prompt (retry/edit/skip/abort/manual).
 */

import { loadWorkflow } from './workflow.js';
import { runStep } from './runner.js';
import { createRun, loadState, saveState } from './state.js';
import { loadStepOutput, saveStepOutput } from './context.js';
import { log, header, stepStart, stepDone, stepFail, summary } from './report.js';
import { handleFailure } from './interactive.js';

const MAX_ATTEMPTS = 3;

export async function run(workflowName, task, repoPath) {
  const workflow = await loadWorkflow(workflowName);
  const runId = createRun(workflowName, task, repoPath);

  header(`ClawFarm — ${workflow.name}`);
  log(`Run ID: ${runId}`);
  log(`Task: ${task}`);
  log(`Repo: ${repoPath}`);
  log(`Steps: ${workflow.steps.map(s => s.id).join(' → ')}\n`);

  const state = loadState(runId);
  const context = { task, repo: repoPath, runId, task_short: task.slice(0, 50) };

  for (const step of workflow.steps) {
    await executeStep({ step, context, state, runId });
  }

  state.status = 'done';
  state.completedAt = new Date().toISOString();
  saveState(runId, state);
  summary(runId, workflow.steps.length);
}

export async function runFrom(runId, fromStep) {
  const state = loadState(runId);
  const workflow = await loadWorkflow(state.workflow);
  const context = {
    task: state.task,
    repo: state.repoPath,
    runId,
    task_short: state.task?.slice(0, 50),
  };

  // Reload completed step outputs into context
  for (const step of workflow.steps) {
    if (state.steps[step.id]?.status === 'done') {
      const out = loadStepOutput(runId, step.id);
      if (out) context[step.id] = out;
    }
  }

  header(`ClawFarm — resuming ${workflow.name}`);
  log(`Run ID: ${runId}`);
  log(`Resuming from: ${fromStep}\n`);

  let resuming = false;
  for (const step of workflow.steps) {
    if (step.id === fromStep) resuming = true;
    if (!resuming) continue;
    await executeStep({ step, context, state, runId });
  }

  state.status = 'done';
  saveState(runId, state);
  summary(runId, workflow.steps.length);
}

/**
 * Execute a single step with retry + interactive failure handling.
 */
async function executeStep({ step, context, state, runId }) {
  stepStart(step.id, step.agent, step.model);

  let currentPrompt = step.input;
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    try {
      // Inject current prompt into step for this attempt
      const stepWithPrompt = { ...step, input: currentPrompt };
      const output = await runStep(stepWithPrompt, context, runId);

      // Success
      context[step.id] = output;
      state.steps[step.id] = { status: 'done', completedAt: new Date().toISOString() };
      state.currentStep = step.id;
      saveState(runId, state);
      stepDone(step.id);
      return;

    } catch (err) {
      stepFail(step.id, err.message);
      state.steps[step.id] = { status: 'failed', error: err.message, attempt };
      saveState(runId, state);

      // Ask user what to do
      const decision = await handleFailure({
        stepId: step.id,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        error: err.message,
        prompt: currentPrompt,
      });

      if (decision.action === 'abort') {
        log(`\nRun aborted at step: ${step.id}`);
        log(`Resume with: clawfarm resume ${runId}`);
        process.exit(1);
      }

      if (decision.action === 'skip') {
        state.steps[step.id] = { status: 'skipped' };
        saveState(runId, state);
        return;
      }

      if (decision.action === 'manual') {
        // User ran the step manually — load their output
        const manualOutput = loadStepOutput(runId, step.id) || `[manual: ${step.id}]`;
        context[step.id] = manualOutput;
        state.steps[step.id] = { status: 'done', completedAt: new Date().toISOString() };
        saveState(runId, state);
        stepDone(step.id);
        return;
      }

      if (decision.action === 'retry') {
        if (decision.prompt) currentPrompt = decision.prompt;
        // loop continues
      }
    }
  }

  // Exhausted all attempts
  log(`\nStep "${step.id}" failed after ${MAX_ATTEMPTS} attempts.`);
  log(`Resume with: clawfarm resume ${runId} --from ${step.id}`);
  process.exit(1);
}

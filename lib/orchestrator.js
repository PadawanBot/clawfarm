import { loadWorkflow } from './workflow.js';
import { runStep } from './runner.js';
import { createRun, loadState, saveState } from './state.js';
import { log, header, stepStart, stepDone, stepFail, summary } from './report.js';

export async function run(workflowName, task, repoPath) {
  const workflow = await loadWorkflow(workflowName);
  const runId = createRun(workflowName, task, repoPath);
  
  header(`ClawFarm — ${workflow.name}`);
  log(`Run ID: ${runId}`);
  log(`Task: ${task}`);
  log(`Repo: ${repoPath}`);
  log(`Steps: ${workflow.steps.map(s => s.id).join(' → ')}\n`);

  const state = loadState(runId);
  const context = { task, repoPath, runId };

  for (const step of workflow.steps) {
    stepStart(step.id, step.agent, step.model);

    try {
      const output = await runStep(step, context, runId);
      context[step.id] = output;
      state.steps[step.id] = { status: 'done', completedAt: new Date().toISOString() };
      state.currentStep = step.id;
      saveState(runId, state);
      stepDone(step.id);
    } catch (err) {
      state.steps[step.id] = { status: 'failed', error: err.message, failedAt: new Date().toISOString() };
      state.status = 'failed';
      saveState(runId, state);
      stepFail(step.id, err.message);
      log(`\nRun stopped at step: ${step.id}`);
      log(`Resume with: clawfarm resume ${runId}`);
      process.exit(1);
    }
  }

  state.status = 'done';
  state.completedAt = new Date().toISOString();
  saveState(runId, state);
  summary(runId, workflow.steps.length);
}

export async function runFrom(runId, fromStep) {
  const state = loadState(runId);
  const workflow = await loadWorkflow(state.workflow);
  const context = { task: state.task, repoPath: state.repoPath, runId };

  // Reload completed step outputs into context
  for (const step of workflow.steps) {
    if (state.steps[step.id]?.status === 'done') {
      const { loadStepOutput } = await import('./context.js');
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

    stepStart(step.id, step.agent, step.model);

    try {
      const output = await runStep(step, context, runId);
      context[step.id] = output;
      state.steps[step.id] = { status: 'done', completedAt: new Date().toISOString() };
      state.currentStep = step.id;
      saveState(runId, state);
      stepDone(step.id);
    } catch (err) {
      state.steps[step.id] = { status: 'failed', error: err.message };
      state.status = 'failed';
      saveState(runId, state);
      stepFail(step.id, err.message);
      process.exit(1);
    }
  }

  state.status = 'done';
  saveState(runId, state);
  summary(runId, workflow.steps.length);
}

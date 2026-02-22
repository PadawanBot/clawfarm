import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const RUNS_DIR = join(__dirname, '..', 'runs');

mkdirSync(RUNS_DIR, { recursive: true });

function statePath(runId) {
  return join(RUNS_DIR, runId, 'state.json');
}

export function createRun(workflow, task, repoPath) {
  const runId = randomBytes(4).toString('hex');
  const dir = join(RUNS_DIR, runId);
  mkdirSync(dir, { recursive: true });

  const state = {
    id: runId,
    workflow,
    task,
    repoPath,
    status: 'running',
    currentStep: null,
    steps: {},
    startedAt: new Date().toISOString()
  };

  writeFileSync(statePath(runId), JSON.stringify(state, null, 2), 'utf8');
  return runId;
}

export function loadState(runId) {
  const path = statePath(runId);
  if (!existsSync(path)) throw new Error(`Run not found: ${runId}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveState(runId, state) {
  writeFileSync(statePath(runId), JSON.stringify(state, null, 2), 'utf8');
}

export async function status(runId) {
  try {
    const state = loadState(runId);
    console.log(`\nRun: ${state.id}`);
    console.log(`Workflow: ${state.workflow}`);
    console.log(`Task: ${state.task}`);
    console.log(`Status: ${state.status}`);
    console.log(`Started: ${state.startedAt}`);
    if (state.completedAt) console.log(`Completed: ${state.completedAt}`);
    console.log('\nSteps:');
    for (const [stepId, stepState] of Object.entries(state.steps)) {
      const icon = stepState.status === 'done' ? '✓' : stepState.status === 'failed' ? '✗' : '…';
      console.log(`  ${icon} ${stepId}: ${stepState.status}`);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

export async function listRuns() {
  if (!existsSync(RUNS_DIR)) {
    console.log('No runs yet.');
    return;
  }

  const dirs = readdirSync(RUNS_DIR);
  if (dirs.length === 0) {
    console.log('No runs yet.');
    return;
  }

  console.log('\nClawFarm Runs:\n');
  for (const dir of dirs.reverse()) {
    try {
      const state = loadState(dir);
      const icon = state.status === 'done' ? '✓' : state.status === 'failed' ? '✗' : '▶';
      const steps = Object.values(state.steps);
      const done = steps.filter(s => s.status === 'done').length;
      console.log(`${icon} ${state.id}  [${state.workflow}]  ${state.task.slice(0, 50)}  (${done}/${Object.keys(state.steps).length} steps)`);
    } catch {}
  }
}

export async function stopRun(runId) {
  const state = loadState(runId);
  state.status = 'cancelled';
  state.cancelledAt = new Date().toISOString();
  saveState(runId, state);
  console.log(`Run ${runId} cancelled.`);
}

export async function resumeRun(runId) {
  const state = loadState(runId);
  if (state.status === 'done') {
    console.log('Run is already complete.');
    return;
  }

  // Find first non-done step
  const { loadWorkflow } = await import('./workflow.js');
  const workflow = await loadWorkflow(state.workflow);
  
  let resumeFrom = workflow.steps[0].id;
  for (const step of workflow.steps) {
    if (state.steps[step.id]?.status !== 'done') {
      resumeFrom = step.id;
      break;
    }
  }

  const { runFrom } = await import('./orchestrator.js');
  await runFrom(runId, resumeFrom);
}

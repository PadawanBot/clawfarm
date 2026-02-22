import { loadState } from './state.js';
import { loadStepOutput } from './context.js';

export function log(msg) {
  console.log(msg);
}

export function header(title) {
  console.log('\n' + '─'.repeat(60));
  console.log(`  🐜 ${title}`);
  console.log('─'.repeat(60) + '\n');
}

export function stepStart(stepId, agent, model) {
  console.log(`\n▶ Step: ${stepId.toUpperCase()}`);
  console.log(`  Agent: clawfarm-${agent} | Model: ${model}`);
  console.log('  ' + '─'.repeat(40));
}

export function stepDone(stepId) {
  console.log(`  ✓ ${stepId} complete`);
}

export function stepFail(stepId, error) {
  console.log(`  ✗ ${stepId} FAILED`);
  console.log(`  Error: ${error}`);
}

export function summary(runId, totalSteps) {
  console.log('\n' + '─'.repeat(60));
  console.log(`  ✓ All ${totalSteps} steps complete!`);
  console.log(`  Run ID: ${runId}`);
  console.log(`  Logs: clawfarm logs ${runId}`);
  console.log('─'.repeat(60) + '\n');
}

export async function showLogs(runId, stepFilter) {
  try {
    const state = loadState(runId);
    console.log(`\nRun: ${runId} [${state.workflow}]`);
    console.log(`Task: ${state.task}\n`);

    const steps = stepFilter ? [stepFilter] : Object.keys(state.steps);

    for (const stepId of steps) {
      const stepState = state.steps[stepId];
      if (!stepState) continue;

      console.log(`\n${'─'.repeat(40)}`);
      console.log(`Step: ${stepId} (${stepState.status})`);
      console.log('─'.repeat(40));

      const output = loadStepOutput(runId, stepId);
      if (output) {
        console.log(output);
      } else {
        console.log('(no output saved)');
      }
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

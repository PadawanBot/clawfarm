import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { RUNS_DIR } from './state.js';

/**
 * Replace {{variable}} placeholders in a template string
 */
export function buildPrompt(template, context) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === 'task') return context.task || '';
    if (key === 'task_short') return (context.task || '').slice(0, 50);
    if (key === 'run_id') return context.runId || '';
    if (key === 'repo') return context.repoPath || process.cwd();
    // Previous step outputs
    return context[key] || `[${key} not available]`;
  });
}

/**
 * Save step output to runs/<runId>/<step>.md
 */
export function saveStepOutput(runId, stepId, output) {
  const dir = join(RUNS_DIR, runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${stepId}.md`), output, 'utf8');
}

/**
 * Load step output from runs/<runId>/<step>.md
 */
export function loadStepOutput(runId, stepId) {
  const file = join(RUNS_DIR, runId, `${stepId}.md`);
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8');
}

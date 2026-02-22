#!/usr/bin/env node
import { program } from 'commander';
import { run } from './lib/orchestrator.js';
import { status, listRuns, stopRun, resumeRun } from './lib/state.js';
import { showLogs } from './lib/report.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

program
  .name('clawfarm')
  .description('Sequential multi-agent workflow orchestrator for OpenClaw')
  .version(pkg.version);

program
  .command('run <workflow> <task>')
  .description('Start a workflow run')
  .option('-r, --repo <path>', 'Git repo path (default: current directory)', process.cwd())
  .action(async (workflow, task, opts) => {
    await run(workflow, task, opts.repo);
  });

program
  .command('status <runId>')
  .description('Check run status')
  .action(async (runId) => {
    await status(runId);
  });

program
  .command('list')
  .description('List all runs')
  .action(async () => {
    await listRuns();
  });

program
  .command('logs <runId>')
  .description('Show step outputs for a run')
  .option('-s, --step <step>', 'Show specific step only')
  .action(async (runId, opts) => {
    await showLogs(runId, opts.step);
  });

program
  .command('resume <runId>')
  .description('Resume a run from last completed step')
  .action(async (runId) => {
    await resumeRun(runId);
  });

program
  .command('stop <runId>')
  .description('Cancel a running workflow')
  .action(async (runId) => {
    await stopRun(runId);
  });

program.parse();

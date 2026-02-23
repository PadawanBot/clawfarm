import { execSync } from 'child_process';
import { join } from 'path';
import { log, header } from './report.js';

const AGENTS = [
  { id: 'clawfarm-planner',   role: 'planner',   model: 'openrouter/meta-llama/llama-3.3-70b-instruct:free' },
  { id: 'clawfarm-setup',     role: 'setup',     model: 'openrouter/meta-llama/llama-3.3-70b-instruct:free' },
  { id: 'clawfarm-developer', role: 'developer', model: 'openai-codex/gpt-5.2' },
  { id: 'clawfarm-verifier',  role: 'verifier',  model: 'openrouter/meta-llama/llama-3.3-70b-instruct:free' },
  { id: 'clawfarm-tester',    role: 'tester',    model: 'openrouter/meta-llama/llama-3.3-70b-instruct:free' },
  { id: 'clawfarm-pr',        role: 'pr',        model: 'openrouter/meta-llama/llama-3.3-70b-instruct:free' },
  { id: 'clawfarm-reviewer',  role: 'reviewer',  model: 'openrouter/anthropic/claude-3-haiku-20240307' },
];

export async function setupAgents(clawfarmDir) {
  header('ClawFarm — Setting up agents');

  for (const agent of AGENTS) {
    const workspace = join(clawfarmDir, 'agents', agent.role);
    const cmd = `openclaw agents add ${agent.id} --model ${agent.model} --workspace ${workspace} --non-interactive`;

    log(`\nRegistering ${agent.id} (${agent.model})...`);
    try {
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      log(`  ✓ ${agent.id}`);
    } catch (err) {
      const msg = err.stderr || err.message || '';
      if (msg.includes('already exists') || msg.includes('already configured')) {
        log(`  ✓ ${agent.id} (already exists)`);
      } else {
        log(`  ✗ ${agent.id} failed: ${msg.slice(0, 100)}`);
      }
    }
  }

  log('\n✓ All agents registered. Run: clawfarm run feature-dev "your task"');
}

import { spawn } from 'child_process';
import { writeFileSync, createReadStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildPrompt, saveStepOutput } from './context.js';
import { log } from './report.js';

export async function runStep(step, context, runId) {
  const prompt = buildPrompt(step.input, context);
  const promptFile = join(tmpdir(), `clawfarm-${step.id}-${Date.now()}.txt`);
  writeFileSync(promptFile, prompt, 'utf8');

  const agentId = `clawfarm-${step.agent}`;
  const model = step.model || 'blockrun/eco';
  const timeoutMs = (step.timeout || 300) * 1000;

  log(`  Model: ${model} | Agent: ${agentId} | Timeout: ${step.timeout || 300}s`);

  return new Promise((resolve, reject) => {
    let output = '';
    let timedOut = false;

    const args = ['--agent', agentId, '--model', model, 'chat', '--no-history'];

    const proc = spawn('openclaw', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    // Feed prompt via stdin
    createReadStream(promptFile).pipe(proc.stdin);

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      reject(new Error(`Step "${step.id}" timed out after ${step.timeout || 300}s`));
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write(chunk); // real-time streaming
    });

    proc.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0 && code !== null) {
        reject(new Error(`Step "${step.id}" exited with code ${code}`));
        return;
      }

      // Check for expected completion signal
      const expectsPattern = step.expects || 'STATUS: done';
      const expectsRegex = new RegExp(expectsPattern, 'i');

      if (!expectsRegex.test(output)) {
        reject(new Error(
          `Step "${step.id}" did not produce expected pattern: "${expectsPattern}"\n` +
          `Last 500 chars: ${output.slice(-500)}`
        ));
        return;
      }

      saveStepOutput(runId, step.id, output);
      resolve(output);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn openclaw: ${err.message}. Is openclaw installed and in PATH?`));
    });
  });
}

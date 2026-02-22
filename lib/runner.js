import { spawn } from 'child_process';
import { buildPrompt, saveStepOutput } from './context.js';
import { log } from './report.js';

export async function runStep(step, context, runId) {
  const prompt = buildPrompt(step.input, context);
  const agentId = `clawfarm-${step.agent}`;
  const model = step.model || 'blockrun/eco';
  const timeoutMs = (step.timeout || 300) * 1000;

  log(`  Model: ${model} | Agent: ${agentId} | Timeout: ${step.timeout || 300}s`);

  return new Promise((resolve, reject) => {
    let output = '';
    let timedOut = false;

    // Correct OpenClaw CLI syntax: openclaw agent --agent <id> --message "<prompt>"
    const args = [
      'agent',
      '--agent', agentId,
      '--message', prompt,
    ];

    const proc = spawn('openclaw', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

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
      const chunk = data.toString();
      // Filter out [plugins] noise
      if (!chunk.includes('[plugins]') && !chunk.includes('BlockRun provider')) {
        process.stderr.write(chunk);
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0 && code !== null) {
        reject(new Error(`Step "${step.id}" exited with code ${code}\nOutput: ${output.slice(-300)}`));
        return;
      }

      // Check for expected completion signal
      const expectsPattern = step.expects || 'STATUS: done';
      const expectsRegex = new RegExp(expectsPattern, 'i');

      if (!expectsRegex.test(output)) {
        reject(new Error(
          `Step "${step.id}" did not produce expected pattern: "${expectsPattern}"\n` +
          `Last 300 chars: ${output.slice(-300)}`
        ));
        return;
      }

      saveStepOutput(runId, step.id, output);
      resolve(output);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn openclaw: ${err.message}. Is openclaw in PATH?`));
    });
  });
}

/**
 * ClawFarm v2 — Interactive Failure Handler
 * Prompts user when a step fails, returns their choice.
 */

import readline from 'readline';
import chalk from 'chalk';

/**
 * Handle a step failure interactively.
 * @param {Object} opts
 * @param {string} opts.stepId
 * @param {number} opts.attempt
 * @param {number} opts.maxAttempts
 * @param {string} opts.error
 * @param {string} opts.prompt - Current step prompt
 * @returns {Promise<{action: 'retry'|'edit'|'skip'|'abort'|'manual', prompt?: string}>}
 */
export async function handleFailure({ stepId, attempt, maxAttempts, error, prompt }) {
  console.log();
  console.log(chalk.yellow('━'.repeat(60)));
  console.log(chalk.yellow(`⚠️  Step '${stepId}' failed (attempt ${attempt}/${maxAttempts})`));
  console.log(chalk.red(`   Error: ${error}`));
  console.log(chalk.yellow('━'.repeat(60)));
  console.log();
  console.log(chalk.white('Options:'));
  console.log(chalk.cyan('  [r]') + ' Retry with same prompt');
  console.log(chalk.cyan('  [e]') + ' Edit prompt before retrying');
  console.log(chalk.cyan('  [s]') + ' Skip this step and continue');
  console.log(chalk.cyan('  [a]') + ' Abort run');
  console.log(chalk.cyan('  [m]') + ' Manual mode (run step yourself, then press enter to continue)');
  console.log();

  const choice = await askQuestion(chalk.cyan('Choice: '));

  switch (choice.trim().toLowerCase()) {
    case 'r':
      return { action: 'retry', prompt };

    case 'e': {
      console.log(chalk.dim('\nCurrent prompt (edit below, blank line + Enter when done):'));
      console.log(chalk.dim('─'.repeat(40)));
      console.log(prompt);
      console.log(chalk.dim('─'.repeat(40)));
      const newPrompt = await askMultiline(chalk.cyan('New prompt (enter blank line to finish): '));
      return { action: 'retry', prompt: newPrompt || prompt };
    }

    case 's':
      console.log(chalk.yellow(`Skipping step '${stepId}'...`));
      return { action: 'skip' };

    case 'a':
      console.log(chalk.red('Aborting run.'));
      return { action: 'abort' };

    case 'm':
      console.log(chalk.yellow('\nManual mode. Complete the step yourself, then press Enter to continue.'));
      console.log(chalk.dim(`Step: ${stepId}`));
      console.log(chalk.dim(`Output should be saved to: runs/<id>/${stepId}.md`));
      await askQuestion('Press Enter when done...');
      return { action: 'manual' };

    default:
      console.log(chalk.dim('Invalid choice, defaulting to retry.'));
      return { action: 'retry', prompt };
  }
}

function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function askMultiline(prompt) {
  const lines = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(prompt);
  return new Promise(resolve => {
    rl.on('line', line => {
      if (line === '') {
        rl.close();
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
      }
    });
  });
}

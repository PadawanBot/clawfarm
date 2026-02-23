/**
 * ClawFarm v2 — Session Polling
 * Polls a spawned session until the expects pattern is found or timeout.
 */

import { resolveGatewayConfig } from './gateway.js';

const POLL_INTERVAL_MS = 2000;

/**
 * Poll a session until completion.
 * @param {Object} opts
 * @param {string} opts.sessionKey
 * @param {string} opts.expects - Regex pattern string to match in output
 * @param {number} opts.timeoutMs
 * @param {Function} opts.onChunk - Called with each new output chunk
 * @returns {Promise<{output: string, status: string, duration: number}>}
 */
export async function pollSession({ sessionKey, expects, timeoutMs = 600000, onChunk }) {
  const { url, token } = resolveGatewayConfig();
  const httpUrl = url.replace('ws://', 'http://').replace('wss://', 'https://');
  const expectsRegex = new RegExp(expects);
  const startMs = Date.now();
  let lastOutput = '';
  let lastMessageCount = 0;

  while (true) {
    const elapsed = Date.now() - startMs;
    if (elapsed > timeoutMs) {
      throw new Error(`Session timed out after ${Math.round(elapsed / 1000)}s`);
    }

    await sleep(POLL_INTERVAL_MS);

    let session;
    try {
      const res = await fetch(`${httpUrl}/api/sessions/${encodeURIComponent(sessionKey)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) continue; // transient error, keep polling
      session = await res.json();
    } catch {
      continue; // network hiccup, keep polling
    }

    // Check for terminal session states
    if (session.status === 'error') {
      throw new Error(`Session error: ${session.error || 'unknown'}`);
    }

    // Stream new output chunks
    const currentOutput = session.lastAssistantMessage || '';
    if (currentOutput.length > lastOutput.length) {
      const chunk = currentOutput.slice(lastOutput.length);
      if (onChunk) onChunk(chunk);
      lastOutput = currentOutput;
    }

    // Check if expects pattern is satisfied
    if (lastOutput && expectsRegex.test(lastOutput)) {
      return {
        output: lastOutput,
        status: 'done',
        duration: Date.now() - startMs,
      };
    }

    // Session completed but no expects match
    if (session.status === 'completed' || session.status === 'idle') {
      if (lastOutput) {
        // Return what we have — orchestrator will evaluate
        return {
          output: lastOutput,
          status: 'completed_no_match',
          duration: Date.now() - startMs,
        };
      }
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

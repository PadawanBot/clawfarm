/**
 * ClawFarm v2 — Session Spawning
 * Spawns a real OpenClaw agent session via Gateway API.
 */

import { resolveGatewayConfig } from './gateway.js';

/**
 * Spawn an OpenClaw agent session for a ClawFarm step.
 * @param {Object} opts
 * @param {string} opts.agentId - e.g. "clawfarm-developer"
 * @param {string} opts.model - e.g. "openrouter/openai/gpt-4o-mini"
 * @param {string} opts.prompt - Full prompt text
 * @param {string} opts.label - Human-readable label for the session
 * @param {number} opts.timeoutSeconds - Max session duration
 * @returns {Promise<{sessionKey: string, runId: string}>}
 */
export async function spawnAgentSession({ agentId, model, prompt, label, timeoutSeconds = 600 }) {
  const { url, token } = resolveGatewayConfig();
  const httpUrl = url.replace('ws://', 'http://').replace('wss://', 'https://');

  const body = {
    agentId,
    model,
    label,
    timeoutSeconds,
    message: prompt,
    sessionTarget: 'isolated',
  };

  const res = await fetch(`${httpUrl}/api/sessions/spawn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Session spawn failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    sessionKey: data.sessionKey,
    runId: data.runId,
  };
}

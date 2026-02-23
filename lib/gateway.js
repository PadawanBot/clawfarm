/**
 * ClawFarm v2 — Gateway Configuration
 * Resolves OpenClaw gateway URL and auth token.
 * Priority: env vars > ~/.openclaw/openclaw.json > defaults
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export function resolveGatewayConfig() {
  const url = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
  const token = process.env.OPENCLAW_GATEWAY_TOKEN || readLocalToken();
  if (!token) throw new Error('No OpenClaw gateway token found. Set OPENCLAW_GATEWAY_TOKEN or ensure ~/.openclaw/openclaw.json exists.');
  return { url, token };
}

function readLocalToken() {
  try {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    return config?.gateway?.auth?.token || null;
  } catch {
    return null;
  }
}

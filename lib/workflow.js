import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = join(__dirname, '..', 'workflows');

export async function loadWorkflow(name) {
  const path = join(WORKFLOWS_DIR, `${name}.yaml`);
  if (!existsSync(path)) {
    throw new Error(`Workflow not found: ${name}\nLooked in: ${path}`);
  }
  const raw = readFileSync(path, 'utf8');
  return yaml.load(raw);
}

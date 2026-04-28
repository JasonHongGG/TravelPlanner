import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const confirmed = process.argv.includes('--yes');

const groups = {
  artifacts: [
    '.artifacts',
    'test-results',
    'frontend/test-results',
    'frontend/playwright-report'
  ],
  build: [
    'backend/dist',
    'frontend/dist'
  ],
  runtime: [
    '.runtime'
  ]
};

function removeRelative(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return;
  fs.rmSync(absolutePath, { recursive: true, force: true });
  console.log(`removed ${relativePath}`);
}

if (!target || !Object.hasOwn(groups, target)) {
  console.error(`Usage: node scripts/clean.mjs <${Object.keys(groups).join('|')}> [--yes]`);
  process.exit(1);
}

if (target === 'runtime' && !confirmed) {
  console.error('Refusing to remove .runtime without --yes because it may contain local users and trips.');
  process.exit(1);
}

for (const relativePath of groups[target]) {
  removeRelative(relativePath);
}
import { spawn } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// Resolve the CLI from npm ci, never download a different Playwright via npx.
export const playwrightCLI = join(dirname(require.resolve('playwright/package.json')), 'cli.js');

export async function runNode(label, args) {
  const start = performance.now();
  console.log(`CI début — ${label}`);
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    child.once('error', () => resolve(1));
    child.once('close', code => resolve(code ?? 1));
  });
  const seconds = ((performance.now() - start) / 1000).toFixed(2);
  console.log(`CI mesure — ${label} : ${seconds} s ; code ${code}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `- ${label} : ${seconds} s ; code ${code}\n`);
  }
  if (code !== 0) throw new Error(`${label} : code ${code}`);
}

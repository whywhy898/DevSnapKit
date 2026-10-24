import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.TEMPLATE_CHECK_OUTPUT || path.join(root, '../../output/devsnapkit/mockup-templates-m15-m2-2026-10-24/checks.json'));
const checks = [
  ['template units', process.execPath, ['--test', 'tests/mockup-template-catalog.test.mjs', 'tests/mockup-template-tasks.test.mjs', 'tests/mockup-templates-m1.test.mjs', 'tests/canvas-text-history-hook.test.mjs', 'tests/mockup-artwork.test.mjs', 'tests/mockup-export-baseline.test.mjs', 'tests/mockup-pixel-diff.test.mjs']],
  ['canvas text', 'npm.cmd', ['run', 'test:text:v1']],
  ['SEO', 'npm.cmd', ['run', 'test:seo']],
  ['security', 'npm.cmd', ['run', 'test:security']],
  ['payment', 'npm.cmd', ['run', 'test:paypal']],
  ['legacy Poster', 'npm.cmd', ['run', 'test:poster:v1']],
  ['build', 'npm.cmd', ['run', 'build']],
  ...(process.env.TEMPLATE_CHECK_BROWSER ? [['canvas text browser', process.execPath, ['tests/run-canvas-text-browser.mjs']]] : []),
];
const results = [];
for (const [name, command, args] of checks) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: command.endsWith('.cmd'), windowsHide: true, timeout: name === 'canvas text browser' ? 900000 : 120000 });
  const text = result.stdout + result.stderr;
  const summary = text.split(/\r?\n/).filter(line => /ℹ (tests|pass|fail|skipped)|built in|error TS|^✖|^not ok/.test(line)).slice(0, 15);
  results.push({ name, exit: result.status, summary });
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(path.join(path.dirname(output), `${name.replaceAll(' ', '-')}.log`), text);
  await fs.writeFile(output, JSON.stringify({ results }, null, 2));
  console.log(name, result.status, summary.join('; '));
}
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({ results }, null, 2));
if (results.some(result => result.exit !== 0)) process.exitCode = 1;

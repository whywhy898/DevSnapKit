import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.TEST_UI_PORT || 5197);
const origin = `http://127.0.0.1:${port}`;
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, '--config', 'tests/vite-poster.config.mjs', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let serverErrors = '';
server.stderr.on('data', chunk => { serverErrors = (serverErrors + chunk).slice(-4000); });
server.stdout.on('data', () => {});
const stop = () => { if (!server.killed) server.kill(); };
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite exited ${server.exitCode}: ${serverErrors}`);
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Test Vite server did not start.');
  const suites = ['poster-entry.test.mjs', 'mockup-export-baseline.test.mjs', 'poster-m1-export.test.mjs', 'poster-v1-ui.test.mjs', 'poster-v1-export.test.mjs', 'security-ui.test.mjs'];
  const fs = await import('node:fs/promises');
  for (const suite of suites) await fs.access(path.join(root, 'tests', suite));
  const runner = spawn(process.execPath, ['--test', '--test-concurrency=1', ...suites.map(suite => `tests/${suite}`)], { cwd: root, env: { ...process.env, TEST_UI_URL: origin + '/?editor=1' }, stdio: 'inherit' });
  process.exitCode = await new Promise(resolve => runner.on('exit', code => resolve(code ?? 1)));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { stop(); }

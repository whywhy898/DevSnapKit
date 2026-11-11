import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const origin = 'http://127.0.0.1:5193';
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, '--config', 'tests/vite-mockup-baseline.config.mjs', '--host', '127.0.0.1', '--port', '5193', '--strictPort'], { cwd: root, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let error = ''; server.stderr.on('data', chunk => { error = (error + chunk).slice(-2000); });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(error || 'Vite exited');
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Vite did not become ready');
  const pattern = process.env.EDITOR_ONBOARDING_TEST_PATTERN ? [`--test-name-pattern=${process.env.EDITOR_ONBOARDING_TEST_PATTERN}`] : [];
  const files = process.argv.slice(2);
  const runner = spawn(process.execPath, ['--test', '--test-concurrency=1', ...pattern, ...(files.length ? files : ['tests/editor-onboarding-ui.test.mjs'])], { cwd: root, env: { ...process.env, TEST_UI_URL: origin }, windowsHide: true, stdio: 'inherit' });
  process.exitCode = await new Promise(resolve => runner.on('exit', code => resolve(code ?? 1)));
} finally { server.kill(); }

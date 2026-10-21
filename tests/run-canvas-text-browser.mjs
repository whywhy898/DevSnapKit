import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:5189';
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, '--config', 'tests/vite-mockup-baseline.config.mjs', '--host', '127.0.0.1', '--port', '5189', '--strictPort'], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
let error = ''; server.stderr.on('data', x => { error = (error + x).slice(-2000); });
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(error || 'Vite exited');
    try { if ((await fetch(origin)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const pattern = process.env.CANVAS_TEXT_TEST_PATTERN ? [`--test-name-pattern=${process.env.CANVAS_TEXT_TEST_PATTERN}`] : [];
  const runner = spawn(process.execPath, ['--test', '--test-concurrency=1', ...pattern, 'tests/canvas-text-v1-ui.test.mjs', 'tests/canvas-text-v1-export.test.mjs'], { cwd: root, env: { ...process.env, TEST_UI_URL: origin + '/?editor=1' }, stdio: 'inherit', windowsHide: true });
  process.exitCode = await new Promise(resolve => runner.on('exit', code => resolve(code ?? 1)));
} finally { server.kill(); }

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const product = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.resolve(product, '../../output/devsnapkit/poster-v1/verification');
await fs.mkdir(evidence, { recursive: true });
const results = [];
const npmCLI = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
await fs.access(npmCLI);
for (const script of ['build', 'test:security', 'test:poster:v1', 'test:poster:v1:browser']) {
  const started = Date.now();
  let stdout = '', stderr = '';
  const child = spawn(process.execPath, [npmCLI, 'run', script], { cwd: product, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  const log = script.replaceAll(':', '-') + '.log';
  await fs.writeFile(path.join(evidence, log), stdout + '\nSTDERR\n' + stderr);
  const result = { command: `npm run ${script}`, exitCode: code, milliseconds: Date.now() - started, log, finishedAt: new Date().toISOString() };
  results.push(result);
  await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`${result.command}: exit ${code}, ${result.milliseconds} ms`);
  if (code !== 0) { console.error((stdout + stderr).slice(-5000)); process.exitCode = code; break; }
}

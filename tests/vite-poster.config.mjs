import fs from 'node:fs';
import { mergeConfig } from 'vite';
import base from '../vite.config.ts';

const headers = fs.readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const policy = headers.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1].trim();
if (!policy) throw new Error('Production Content-Security-Policy is required for poster browser tests.');

// Keep browser tests under the actual deployment policy, including its blob fetch restriction.
export default mergeConfig(base, {
  server: { headers: { 'Content-Security-Policy': policy } },
});

import fs from 'node:fs';
import path from 'node:path';

export function injectBeacon(html, token) {
  if (!/^[a-f0-9]{32}$/i.test(token || '') || html.includes('data-cf-beacon=')) return html;
  return html.replace('</head>', `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token })}'></script>\n</head>`);
}
export function beaconPlugin(token) {
  return {
    name: 'optional-cloudflare-beacon',
    apply: 'build',
    closeBundle() {
      if (!token) return;
      const walk = directory => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) walk(file);
          else if (file.endsWith('.html')) {
            const before = fs.readFileSync(file, 'utf8'), after = injectBeacon(before, token);
            if (before !== after) fs.writeFileSync(file, after);
          }
        }
      };
      walk(path.resolve('dist'));
    },
  };
}

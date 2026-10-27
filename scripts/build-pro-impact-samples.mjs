import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Original vector UI derived from the approved, self-authored HTML concepts.
// These assets contain application content only; framing belongs to the template.
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'public/designed/examples/collection');
const references = path.resolve(root, '../../output/devsnapkit/template-collection-2026-10-27/pro-impact');
const hash = value => createHash('sha256').update(value).digest('hex');
const manrope = { family: 'Manrope', file: 'public/poster/fonts/manrope-latin.woff2', license: 'public/poster/fonts/Manrope-OFL.txt', format: 'woff2' };
const gelasio = { family: 'Gelasio', file: 'public/poster/fonts/Gelasio.ttf', license: 'public/poster/fonts/Gelasio-OFL.txt', format: 'ttf' };
const italic = { family: 'Gelasio', file: 'public/poster/fonts/Gelasio-Italic.ttf', license: 'public/poster/fonts/Gelasio-OFL.txt', format: 'ttf', italic: true };
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, copy, size = 16, fill = '#16130F', weight = 500, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ${extra}>${esc(copy)}</text>`;
const rect = (x, y, width, height, fill, radius = 0, extra = '') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, color, width = 1) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
const circle = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
function svg(width, height, title, fonts, content) {
  const faces = fonts.map(font => `@font-face{font-family:'${font.family}';font-style:${font.italic ? 'italic' : 'normal'};font-weight:${font.family === 'Manrope' ? '200 800' : '400 700'};src:url(data:font/${font.format};base64,${fs.readFileSync(path.join(root, font.file)).toString('base64')}) format('${font.format === 'ttf' ? 'truetype' : 'woff2'}')}`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title><defs><style>${faces}text{font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums}.serif{font-family:Gelasio,serif}</style></defs>${content}</svg>\n`;
}

function overview() {
  const ink = '#16130F', muted = '#9B938A', cream = '#F4EEE2', orange = '#FF5B1F';
  const parts = [rect(0, 0, 1000, 620, ink), line(194, 0, 194, 620, '#302A25'), rect(24, 29, 20, 20, orange, 4), text(53, 47, 'kiln', 26, cream, 800)];
  ['Deployments', 'Projects', 'Previews', 'Databases', 'Logs', 'Settings'].forEach((label, i) => {
    const y = 111 + i * 45;
    if (!i) parts.push(rect(16, y - 25, 161, 37, '#2A2521', 7));
    parts.push(rect(29, y - 13, 11, 11, !i ? orange : '#5E5750', 2), text(51, y - 1, label, 13.5, !i ? cream : muted, !i ? 700 : 500));
  });
  parts.push(line(22, 532, 172, 532, '#302A25'), circle(35, 562, 13, '#342D27'), text(29, 567, 'A', 13, cream, 700), text(58, 559, 'Atlas workspace', 12, cream, 600), text(58, 578, 'Pro plan', 11, muted));
  parts.push(text(228, 38, 'atlas-web / production', 13, muted), text(228, 79, 'Deployments', 30, cream, 800), rect(834, 49, 132, 34, '#28221E', 7), circle(849, 66, 3, orange), text(860, 71, 'Production', 12, cream, 600));
  const metrics = [['Median build', '41', 's'], ['Deploys this week', '128', ''], ['Rollbacks', '2', '']];
  metrics.forEach(([label, value, unit], i) => { const x = 228 + i * 250; parts.push(rect(x, 105, 238, 113, '#201B17', 10, 'stroke="#332C26"'), text(x + 17, 133, label, 12, muted), text(x + 17, 188, value, 42, cream, 700)); if (unit) parts.push(text(x + 70, 186, unit, 22, muted)); });
  parts.push(rect(228, 237, 738, 165, '#1C1713', 10, 'stroke="#332C26"'), text(246, 264, 'Build time · last 24 deploys', 12, muted), text(944, 264, '41s median', 11, muted, 500, 'text-anchor="end"'));
  const heights = [58, 75, 66, 52, 69, 43, 62, 84, 57, 60, 49, 73, 67, 45, 62, 51, 70, 56, 66, 49, 59, 46, 51, 42];
  heights.forEach((h, i) => parts.push(rect(246 + i * 29, 377 - h, 21, h, i > 19 ? orange : '#3A332D', 3)));
  const xs = [232, 559, 735, 907];
  ['COMMIT', 'BRANCH', 'STATUS', 'TIME'].forEach((label, i) => parts.push(text(xs[i], 437, label, 10, muted, 600, 'letter-spacing="1.3"')));
  const rows = [['Faster image pipeline', 'main', 'Live', '41s'], ['Pricing page copy', 'copy/pricing', 'Preview', '38s'], ['Search index warmup', 'perf/search', 'Preview', '44s']];
  rows.forEach((row, i) => { const y = 478 + i * 51; parts.push(line(228, y + 18, 966, y + 18, '#302923')); row.forEach((label, j) => { if (j === 2) parts.push(rect(xs[j] - 9, y - 17, label === 'Live' ? 49 : 76, 26, label === 'Live' ? cream : '#2E2621', 13)); parts.push(text(xs[j], y, label, j === 2 ? 11 : 12, j === 2 && label === 'Live' ? ink : j === 1 ? muted : cream, j === 2 ? 700 : 500)); }); });
  return svg(1000, 620, 'Kiln deployment overview', [manrope], parts.join(''));
}

function deploy() {
  const cream = '#F4EEE2', ink = '#16130F', orange = '#FF5B1F', muted = '#8A5A43';
  const parts = [rect(0, 0, 396, 760, cream), text(30, 47, 'kiln', 24, ink, 800), rect(281, 25, 85, 27, '#E8E0D2', 14), circle(296, 39, 3, orange), text(307, 43, 'Live', 12, ink, 700), line(30, 69, 366, 69, '#D9D0C1'), text(30, 112, 'ATLAS-WEB', 12, muted, 800, 'letter-spacing="1.8"'), text(30, 138, 'production', 15, ink, 600), text(23, 274, '41', 130, ink, 800, 'letter-spacing="-9"'), text(178, 273, 's', 45, ink, 700), text(30, 319, 'From push to live.', 23, ink, 700), text(30, 350, 'Nothing left to babysit.', 21, ink, 600), line(30, 389, 366, 389, '#D9D0C1')];
  [['Build', '22s', 22], ['Tests', '14s', 14], ['Promote', '5s', 5]].forEach(([label, time, duration], i) => {
    const y = 433 + i * 65;
    parts.push(circle(39, y - 6, 9, ink), `<path d="M35 ${y - 6}l3 3 5-6" fill="none" stroke="${cream}" stroke-width="1.6"/>`, text(61, y, label, 17, ink, 600), text(365, y, time, 17, ink, 700, 'text-anchor="end"'), rect(61, y + 12, 304, 4, '#DED5C7', 2), rect(61, y + 12, Math.round(304 * duration / 22), 4, orange, 2));
  });
  parts.push(rect(30, 634, 336, 57, orange, 14), text(198, 670, 'Open live site', 17, ink, 800, 'text-anchor="middle"'), text(198, 727, 'Faster image pipeline · main', 11, muted, 500, 'text-anchor="middle"'));
  return svg(396, 760, 'Kiln deployment summary', [manrope], parts.join(''));
}

function journal() {
  const ink = '#1C1A17', ox = '#6F1D1B', muted = '#8C8478';
  const parts = [rect(0, 0, 420, 840, '#FBF8F2'), text(30, 47, 'Tuesday, 14 October', 14, muted, 600), text(390, 47, 'Done', 14, ox, 700, 'text-anchor="end"'), line(30, 71, 390, 71, '#E5DED2'), text(30, 126, 'On starting', 37, ink, 400, 'class="serif"'), text(30, 171, 'small', 37, ink, 400, 'class="serif"'), text(30, 207, '412 words · 6 min read', 12, muted)];
  const body = (y, lines) => lines.forEach((copy, i) => parts.push(text(30, y + i * 31, copy, 18.5, '#2A2622', 400, 'class="serif"')));
  body(259, ['Most mornings I wait for a big idea', 'before I let myself write. It rarely', 'comes.']);
  body(371, ['So today I wrote one sentence, and', 'then another, and the page filled']);
  parts.push(rect(28, 417, 335, 27, '#EBD3CC', 1));
  body(433, ['itself the way a room fills with light.']);
  parts.push(line(31, 476, 31, 553, ox, 3), text(49, 501, 'The work was never the idea.', 22, ink, 400, 'class="serif" font-style="italic"'), text(49, 532, 'It was showing up.', 22, ink, 400, 'class="serif" font-style="italic"'));
  body(605, ['Tomorrow: the same chair, the same', 'cup, one more line.']);
  parts.push(line(30, 751, 390, 751, '#E5DED2'), text(39, 790, 'Aa', 18, ink, 500, 'class="serif"'), text(113, 790, 'B', 18, ink, 800), text(180, 790, 'I', 18, ink, 400, 'class="serif" font-style="italic"'), text(249, 793, '“ ”', 24, ox, 400, 'class="serif"'), text(332, 790, '• —', 18, ink));
  return svg(420, 840, 'Halden private journal entry', [manrope, gelasio, italic], parts.join(''));
}

function week() {
  const ink = '#1C1A17', muted = '#8C8478', ox = '#6F1D1B', parts = [rect(0, 0, 350, 404, '#FFFDF9'), text(28, 43, 'THIS WEEK', 12, muted, 700, 'letter-spacing="1.7"'), text(26, 116, '3,214', 65, ink, 400, 'class="serif" letter-spacing="-2"'), text(208, 113, 'words', 15, muted, 600)];
  [36, 61, 46, 74, 54, 90, 43].forEach((h, i) => {
    const x = 29 + i * 43;
    parts.push(rect(x, 227 - h, 29, h, i === 5 ? ox : '#DDD2C2', 3, `data-day="${i + 1}"`), text(x + 14, 247, ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], 10, muted, 600, 'text-anchor="middle"'));
  });
  [['On starting small', 'Tue'], ['A walk without a podcast', 'Thu'], ['Notes from the long table', 'Sat']].forEach(([label, day], i) => {
    const y = 292 + i * 41;
    parts.push(line(28, y - 25, 322, y - 25, '#E5DED2'), `<g data-entry="${i + 1}">${text(28, y, label, 12, ink, 600)}${text(322, y, day, 10, muted, 500, 'text-anchor="end"')}</g>`);
  });
  return svg(350, 404, 'Halden weekly writing summary', [manrope, gelasio], parts.join(''));
}

fs.mkdirSync(output, { recursive: true });
const definitions = [
  ['kiln-overview', 1000, 620, overview, 'concept-1-big-type.html', [manrope]],
  ['kiln-deploy', 396, 760, deploy, 'concept-1-big-type.html', [manrope]],
  ['halden-journal', 420, 840, journal, 'concept-2-cover-story.html', [manrope, gelasio, italic]],
  ['halden-week', 350, 404, week, 'concept-2-cover-story.html', [manrope, gelasio]],
];
const samples = definitions.map(([id, width, height, generate, reference, fonts]) => {
  const content = generate();
  const file = `${id}.svg`;
  fs.writeFileSync(path.join(output, file), content);
  const referencePath = path.join(references, reference);
  return { id, file, width, height, sourceKind: 'original vector app UI', sha256: hash(content), reference: { path: path.relative(root, referencePath).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(referencePath)) }, fonts: fonts.map(({ family, file, license }) => ({ family, file, license, licenseType: 'SIL OFL 1.1', sha256: hash(fs.readFileSync(path.join(root, file))) })), description: id.startsWith('kiln') ? 'Fictional deploy application UI based on the approved Kiln concept.' : 'Fictional private writing application UI based on the approved Halden concept.' };
});
fs.writeFileSync(path.join(output, 'pro-impact-samples.json'), JSON.stringify({ version: 1, generator: 'scripts/build-pro-impact-samples.mjs', authorship: 'Original native SVG UI; charts and typography authored in this repository. No third-party screenshot assets.', samples }, null, 2) + '\n');
console.log(`Generated ${samples.length} independent Pro Impact SVG samples.`);

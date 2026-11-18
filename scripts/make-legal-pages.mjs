// Writes the privacy and help pages as plain web pages, for hosting somewhere
// public: the app stores ask for a privacy link and a support link that open in
// a browser. The words come from the same files the app shows (src/legal).
//
//   npm run legal            -> site/privacy.html, site/support.html
//
// The support address is read from EXPO_PUBLIC_SUPPORT_EMAIL in .env.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

let email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '';
if (!email && existsSync(join(root, '.env'))) {
  const line = readFileSync(join(root, '.env'), 'utf8').split('\n').find((l) => l.startsWith('EXPO_PUBLIC_SUPPORT_EMAIL='));
  email = line ? line.slice('EXPO_PUBLIC_SUPPORT_EMAIL='.length).trim() : '';
}
if (!email) console.warn('No EXPO_PUBLIC_SUPPORT_EMAIL set: the pages will say so where the address belongs.');

const MIN_AGE = 18; // keep in step with MIN_AGE in src/legal/config.ts
const esc = (s) => s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
const fill = (s) => esc(s).split('{age}').join(String(MIN_AGE)).split('{email}').join(email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : 'the support address (not set up yet)');

function page(doc, other) {
  const sections = doc.sections
    .map((s) => `<h2>${esc(s.heading)}</h2>\n${s.points.map((p) => `<p>${fill(p)}</p>`).join('\n')}`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>earshot: ${esc(doc.title)}</title>
<style>
  body { margin: 0; background: #EFE6D2; color: #1F2A6B; font: 17px/1.55 Georgia, 'Times New Roman', serif; }
  main { max-width: 620px; margin: 0 auto; padding: 32px 20px 64px; }
  .mark { font: 900 15px/1 'Courier New', monospace; letter-spacing: 0.08em; text-transform: uppercase; }
  h1 { font-size: 44px; line-height: 1.05; margin: 14px 0 4px; }
  h2 { font-size: 22px; margin: 36px 0 8px; display: inline-block; background: linear-gradient(transparent 55%, #FFD23F 55%); }
  p { margin: 10px 0; }
  .meta { font: 13px/1.4 'Courier New', monospace; opacity: 0.7; }
  a { color: #1F2A6B; text-decoration-color: #F0502F; text-decoration-thickness: 2px; }
</style>
</head>
<body>
<main>
<div class="mark">earshot</div>
<h1>${esc(doc.title)}</h1>
${doc.updated ? `<p class="meta">Last updated ${esc(doc.updated)}</p>` : ''}
<p>${fill(doc.intro)}</p>
${sections}
<p class="meta" style="margin-top:40px"><a href="${other.href}">${esc(other.label)}</a></p>
</main>
</body>
</html>
`;
}

mkdirSync(join(root, 'site'), { recursive: true });
writeFileSync(join(root, 'site', 'privacy.html'), page(read('src/legal/privacy.json'), { href: 'terms.html', label: 'Terms' }));
writeFileSync(join(root, 'site', 'terms.html'), page(read('src/legal/terms.json'), { href: 'privacy.html', label: 'Privacy' }));
writeFileSync(join(root, 'site', 'delete-account.html'), page(read('src/legal/deletion.json'), { href: 'privacy.html', label: 'Privacy' }));
writeFileSync(join(root, 'site', 'support.html'), page(read('src/legal/support.json'), { href: 'privacy.html', label: 'Privacy' }));
console.log('Wrote site/privacy.html, support.html, terms.html and delete-account.html');

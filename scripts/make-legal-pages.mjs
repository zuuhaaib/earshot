// Writes the privacy and help pages as plain web pages, for hosting somewhere
// public: the app stores ask for a privacy link and a support link that open in
// a browser. The words come from the same files the app shows (src/legal).
//
//   npm run legal            -> docs/ (GitHub Pages serves that folder at earshot.lol)
//
// The support address is read from EXPO_PUBLIC_SUPPORT_EMAIL in .env.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

const dotenv = existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8').split('\n') : [];
const env = (name) => {
  if (process.env[name]) return process.env[name];
  const line = dotenv.find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : '';
};
const email = env('EXPO_PUBLIC_SUPPORT_EMAIL');
if (!email) console.warn('No EXPO_PUBLIC_SUPPORT_EMAIL set: the pages will say so where the address belongs.');
// The waitlist form talks to the same Supabase project as the app, with the publishable key the app already ships.
const supabaseUrl = env('EXPO_PUBLIC_SUPABASE_URL').replace(/\/+$/, ''), supabaseKey = env('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const waitlistOn = supabaseUrl.startsWith('https://') && supabaseKey.length > 0;
if (!waitlistOn) console.warn('No Supabase URL and publishable key in .env: the home page goes out without the waitlist.');

const MIN_AGE = 18; // keep in step with MIN_AGE in src/legal/config.ts
const esc = (s) => s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
const fill = (s) => esc(s).split('{age}').join(String(MIN_AGE)).split('{email}').join(email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : 'the support address (not set up yet)');

function page(doc, links, extra = '') {
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
${extra ? `${extra}\n` : ''}${sections}
<p class="meta" style="margin-top:40px">${links.map((l) => `<a href="${l.href}">${esc(l.label)}</a>`).join(' · ')}</p>
</main>
</body>
</html>
`;
}

/** The "first pressing" signup: a taped index card that calls join_waitlist (supabase/schema.sql). */
function waitlist() {
  return `<style>
  .card { position: relative; background: #F9F3E5; border: 2px solid #1F2A6B; box-shadow: 6px 6px 0 #1F2A6B; padding: 26px 22px 20px; margin: 34px 4px 10px; transform: rotate(-0.6deg); }
  .tape { position: absolute; top: -13px; left: 38px; width: 110px; height: 26px; background: rgba(255, 210, 63, 0.75); transform: rotate(-4deg); }
  .card h2 { margin-top: 0; }
  .card label, .card legend { display: block; font: 700 13px/1.3 'Courier New', monospace; letter-spacing: 0.06em; text-transform: uppercase; margin: 16px 0 6px; }
  .card fieldset { border: 0; padding: 0; margin: 0; }
  .card fieldset label { display: inline-flex; align-items: center; gap: 8px; margin: 4px 22px 0 0; font: 17px Georgia, serif; text-transform: none; letter-spacing: 0; }
  .card input[type=email], .card input[type=text] { box-sizing: border-box; width: 100%; font: 17px Georgia, serif; color: #1F2A6B; background: #FFFDF7; border: 2px solid #1F2A6B; padding: 10px 12px; }
  .card input[type=radio] { accent-color: #F0502F; width: 18px; height: 18px; margin: 0; }
  .card button { margin-top: 20px; font: 700 17px/1 'Courier New', monospace; letter-spacing: 0.04em; color: #FFFDF7; background: #F0502F; border: 2px solid #1F2A6B; box-shadow: 4px 4px 0 #1F2A6B; padding: 14px 20px; cursor: pointer; }
  .card button:disabled { opacity: 0.6; cursor: wait; }
  .card :focus-visible { outline: 3px solid #FFD23F; outline-offset: 2px; }
  .hp { position: absolute; left: -9999px; }
</style>
<section class="card" aria-labelledby="wl-title">
<span class="tape" aria-hidden="true"></span>
<h2 id="wl-title">Join the first pressing</h2>
<p>earshot is being tested now. Leave your email and you’ll get in before everyone else, as one of the first people on it.</p>
<form id="wl" novalidate>
<label for="wl-email">Email</label>
<input id="wl-email" type="email" name="email" required maxlength="254" autocomplete="email" inputmode="email">
<fieldset><legend>Your phone</legend>
<label><input type="radio" name="phone" value="iphone" required> iPhone</label>
<label><input type="radio" name="phone" value="android"> Android</label>
</fieldset>
<label for="wl-area">Your neighbourhood (optional)</label>
<input id="wl-area" type="text" name="area" maxlength="60" placeholder="Little Portugal, say">
<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button type="submit">Join the list</button>
<p id="wl-msg" class="meta" role="status" aria-live="polite"></p>
</form>
</section>
<script>
(() => {
  const URL = ${JSON.stringify(supabaseUrl)}, KEY = ${JSON.stringify(supabaseKey)};
  const SAY = {
    'bad-email': 'That email doesn’t look right. Check it and try again.',
    'bad-phone': 'Pick iPhone or Android.',
    'bad-area': 'Keep the neighbourhood short.',
    'busy': 'Lots of people at once. Try again in a minute.',
    'waitlist-full': 'The list is full for now. Check back soon.',
  };
  const form = document.getElementById('wl'), msg = document.getElementById('wl-msg'), button = form.querySelector('button');
  const done = () => { form.innerHTML = '<p><strong>You’re on the list.</strong> We’ll email you when it’s your turn.</p>'; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim(), phone = form.phone.value;
    if (form.website.value) return done(); // only a bot fills the hidden field
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) { msg.textContent = SAY['bad-email']; form.email.focus(); return; }
    if (!phone) { msg.textContent = SAY['bad-phone']; return; }
    button.disabled = true; msg.textContent = 'Adding you…';
    try {
      const res = await fetch(URL + '/rest/v1/rpc/join_waitlist', {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_email: email, p_phone: phone, p_area: form.area.value.trim() || null }),
      });
      if (res.ok) return done();
      const why = (await res.json().catch(() => ({}))).message;
      msg.textContent = SAY[why] || 'Something went wrong. Try again in a minute.';
    } catch {
      msg.textContent = 'Couldn’t reach earshot. Check your connection and try again.';
    }
    button.disabled = false;
  });
})();
</script>`;
}

const out = join(root, 'docs');
const home = { href: '/', label: 'earshot' };
const PAGES = [
  ['privacy', 'src/legal/privacy.json', 'Privacy'],
  ['terms', 'src/legal/terms.json', 'Terms'],
  ['support', 'src/legal/support.json', 'Help and contact'],
  ['delete-account', 'src/legal/deletion.json', 'Delete your account'],
];
const all = PAGES.map(([slug, , label]) => ({ href: `/${slug}`, label }));

mkdirSync(out, { recursive: true });
for (const [slug, file] of PAGES) writeFileSync(join(out, `${slug}.html`), page(read(file), [home, ...all.filter((l) => l.href !== `/${slug}`)]));
writeFileSync(
  join(out, 'index.html'),
  page(
    {
      title: 'Find out what everyone around you has on.',
      intro: 'earshot is a social music app. Open it anywhere and see what the people nearby are playing, then say hello by sending them a song. It shows that someone is nearby, never where they are.',
      sections: [{ heading: 'Coming soon', points: ['To iPhone and Android. Questions in the meantime go to {email}.'] }],
    },
    all,
    waitlistOn ? waitlist() : '',
  ),
);
writeFileSync(join(out, 'CNAME'), 'earshot.lol'); // tells GitHub Pages which domain these pages belong to
console.log('Wrote docs/: index, privacy, terms, support, delete-account, CNAME');

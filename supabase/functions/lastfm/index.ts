// earshot: the Last.fm go-between.
//
// The app asks this function what a Last.fm user is playing, and this function
// asks Last.fm. That way the Last.fm API key lives here, as a secret on the
// server, and is never inside the app where someone could dig it out.
//
// Setting it up (Supabase dashboard):
//   1. Edge Functions → Secrets → add LASTFM_API_KEY with your Last.fm API key.
//   2. Edge Functions → Deploy a new function → Via Editor → name it exactly
//      "lastfm" → paste this whole file → Deploy. Leave "Verify JWT" on.
// Or with the CLI:
//   npx supabase secrets set LASTFM_API_KEY=... --project-ref <your project ref>
//   npx supabase functions deploy lastfm --project-ref <your project ref>
//
// What it allows: only signed-in earshot users, only the two read-only
// questions the app needs, only for a well-formed username, and only so many
// times a minute each.

const METHODS = new Set(['user.getinfo', 'user.getrecenttracks']);
const USERNAME = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;
const PER_MINUTE = 12;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Recent calls per person. Kept in memory, so it resets when the function restarts: a brake, not a ledger.
const calls = new Map<string, number[]>();
function tooMany(userId: string): boolean {
  const now = Date.now();
  const recent = (calls.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) {
    calls.set(userId, recent);
    return true;
  }
  recent.push(now);
  calls.set(userId, recent);
  if (calls.size > 5000) calls.clear();
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ earshot: 'post-only' }, 405);

  const key = Deno.env.get('LASTFM_API_KEY');
  if (!key) return json({ earshot: 'no-key' }, 503);

  // Who is asking? Supabase Auth is the judge of that, not this function.
  const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: req.headers.get('Authorization') ?? '', apikey: req.headers.get('apikey') ?? '' },
  }).catch(() => null);
  if (!who || !who.ok) return json({ earshot: 'not-signed-in' }, 401);
  const userId = ((await who.json().catch(() => null)) as { id?: string } | null)?.id;
  if (!userId) return json({ earshot: 'not-signed-in' }, 401);
  if (tooMany(userId)) return json({ earshot: 'slow-down' }, 429);

  const body = (await req.json().catch(() => null)) as { method?: unknown; user?: unknown } | null;
  const method = typeof body?.method === 'string' ? body.method.toLowerCase() : '';
  const user = typeof body?.user === 'string' ? body.user : '';
  if (!METHODS.has(method) || !USERNAME.test(user)) return json({ earshot: 'bad-request' }, 400);

  const query = new URLSearchParams({ method, user, api_key: key, format: 'json' });
  if (method === 'user.getrecenttracks') query.set('limit', '1');
  try {
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${query.toString()}`);
    // Last.fm explains its refusals in the body; pass that on and let the app read it.
    return json(await res.json());
  } catch {
    return json({ earshot: 'lastfm-unreachable' }, 502);
  }
});

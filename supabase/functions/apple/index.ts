// earshot: tells Apple when someone deletes an account they made with Sign in with Apple.
//
// Apple's rule (App Store Review Guideline 5.1.1(v)): deleting such an account has to
// revoke earshot's access with Apple too. Just before deleting, the app asks Apple for a
// fresh one-time code and sends it here. This function trades the code for a token and
// revokes it straight away, so nothing needs storing.
//
// Setting it up:
//   1. developer.apple.com → Certificates, Identifiers & Profiles → Keys → "+" →
//      tick Sign in with Apple, configure it with the app's ID (lol.earshot.app) → download
//      the .p8 file. Note the Key ID, and your Team ID (top right of the page).
//   2. Supabase → Edge Functions → Secrets: add APPLE_TEAM_ID, APPLE_KEY_ID, and
//      APPLE_PRIVATE_KEY (the whole .p8 file, BEGIN and END lines included).
//   3. Deploy this file as a function named exactly "apple", with "Verify JWT" on.
// Or with the CLI:
//   npx supabase secrets set APPLE_TEAM_ID=... APPLE_KEY_ID=... APPLE_PRIVATE_KEY="$(cat AuthKey_XXXX.p8)" --project-ref <ref>
//   npx supabase functions deploy apple --project-ref <ref>

const CLIENT_ID = 'lol.earshot.app'; // the iOS bundle ID: native Sign in with Apple tokens are issued to it
const APPLE = 'https://appleid.apple.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text64 = (s: string) => b64url(new TextEncoder().encode(s));

/** The short-lived signed note Apple wants in place of a password: an ES256 JWT made with the .p8 key. */
export async function clientSecret(teamId: string, keyId: string, pem: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = text64(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const body = text64(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: APPLE, sub: CLIENT_ID }));
  // WebCrypto gives the raw r||s signature, which is exactly what a JWT carries.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

const post = (path: string, form: Record<string, string>) =>
  fetch(`${APPLE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ earshot: 'post-only' }, 405);

  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const pem = Deno.env.get('APPLE_PRIVATE_KEY');
  if (!teamId || !keyId || !pem) return json({ earshot: 'no-key' }, 503);

  // Only a signed-in earshot user, the one about to delete their account.
  const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: req.headers.get('Authorization') ?? '', apikey: req.headers.get('apikey') ?? '' },
  }).catch(() => null);
  if (!who || !who.ok) return json({ earshot: 'not-signed-in' }, 401);

  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === 'string' ? body.code : '';
  if (!code || code.length > 512) return json({ earshot: 'bad-request' }, 400);

  try {
    const secret = await clientSecret(teamId, keyId, pem);
    const got = await post('/auth/token', { client_id: CLIENT_ID, client_secret: secret, code, grant_type: 'authorization_code' });
    const tokens = (await got.json().catch(() => null)) as { refresh_token?: string; access_token?: string; error?: string } | null;
    const token = tokens?.refresh_token ?? tokens?.access_token;
    if (!got.ok || !token) return json({ earshot: 'apple-refused', apple: tokens?.error ?? got.status }, 502);
    const gone = await post('/auth/revoke', {
      client_id: CLIENT_ID,
      client_secret: secret,
      token,
      token_type_hint: tokens?.refresh_token ? 'refresh_token' : 'access_token',
    });
    if (!gone.ok) return json({ earshot: 'apple-refused', apple: gone.status }, 502);
    return json({ earshot: 'revoked' });
  } catch {
    return json({ earshot: 'apple-unreachable' }, 502);
  }
}

// Guarded so the tests can import clientSecret under Node.
if (typeof Deno !== 'undefined') Deno.serve(handle);

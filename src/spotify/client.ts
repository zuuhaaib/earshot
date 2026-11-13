/**
 * Talking to Spotify: signing in (authorization code with PKCE, no secret),
 * keeping the tokens on this phone, and asking what's playing.
 *
 * Tokens are stored per earshot account, in the phone's secure storage. They
 * never go anywhere except back to Spotify.
 */
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { SPOTIFY, SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES } from './config';
import { readPlaying, type SpotifyPlaying } from './match';

// Lets the sign-in window close itself on web when Spotify sends you back.
WebBrowser.maybeCompleteAuthSession();

type Tokens = { access: string; refresh: string; expiresAt: number; name: string };

export class SpotifyError extends Error {
  constructor(
    public code:
      | 'not-configured'
      | 'cancelled'
      | 'denied'
      | 'not-allowed' // signed in, but not on the app's user list (development mode)
      | 'expired' // the link was revoked or went stale; connect again
      | 'network',
    detail?: string,
  ) {
    super(detail ?? code);
  }
}

/** The address Spotify sends you back to. It must be listed, exactly, in the Spotify dashboard. */
export const redirectUri = () => AuthSession.makeRedirectUri({ scheme: 'earshot', path: 'spotify' });

// ---- token storage ----------------------------------------------------------

const keyFor = (userId: string) => `earshot.spotify.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

async function load(userId: string): Promise<Tokens | null> {
  try {
    const raw =
      Platform.OS === 'web' ? globalThis.localStorage?.getItem(keyFor(userId)) : await SecureStore.getItemAsync(keyFor(userId));
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

async function save(userId: string, tokens: Tokens | null) {
  const key = keyFor(userId);
  if (Platform.OS === 'web') {
    if (tokens) globalThis.localStorage?.setItem(key, JSON.stringify(tokens));
    else globalThis.localStorage?.removeItem(key);
    return;
  }
  if (tokens) await SecureStore.setItemAsync(key, JSON.stringify(tokens));
  else await SecureStore.deleteItemAsync(key);
}

// ---- token requests ---------------------------------------------------------

async function tokenRequest(params: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(SPOTIFY.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...params }).toString(),
    });
  } catch {
    throw new SpotifyError('network');
  }
  if (!res.ok) throw new SpotifyError(res.status === 400 || res.status === 401 ? 'expired' : 'network', `token ${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

/** A working access token for this account, refreshed if it's about to run out. Null if not connected. */
async function accessToken(userId: string): Promise<string | null> {
  const tokens = await load(userId);
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() > 60_000) return tokens.access;
  try {
    const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh });
    await save(userId, {
      ...tokens,
      access: fresh.access_token,
      refresh: fresh.refresh_token ?? tokens.refresh, // Spotify may rotate it
      expiresAt: Date.now() + fresh.expires_in * 1000,
    });
    return fresh.access_token;
  } catch (e) {
    if (e instanceof SpotifyError && e.code === 'expired') await save(userId, null); // the link is dead; forget it
    throw e;
  }
}

async function get(url: string, token: string) {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new SpotifyError('network');
  }
  if (res.status === 401) throw new SpotifyError('expired');
  if (res.status === 403) throw new SpotifyError('not-allowed');
  if (res.status === 204) return null; // nothing playing
  if (!res.ok) throw new SpotifyError('network', `spotify ${res.status}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as unknown) : null;
}

// ---- the public bits --------------------------------------------------------

/** The Spotify display name this account is linked to, or null. */
export async function connectedAs(userId: string): Promise<string | null> {
  return (await load(userId))?.name ?? null;
}

/** Open Spotify's sign-in and link the result to this earshot account. Resolves to their Spotify name. */
export async function connect(userId: string): Promise<string> {
  if (!SPOTIFY_CLIENT_ID.trim()) throw new SpotifyError('not-configured');
  const uri = redirectUri();
  const discovery = { authorizationEndpoint: SPOTIFY.authorize, tokenEndpoint: SPOTIFY.token };
  const request = await AuthSession.loadAsync(
    { clientId: SPOTIFY_CLIENT_ID, scopes: SPOTIFY_SCOPES, redirectUri: uri, responseType: AuthSession.ResponseType.Code, usePKCE: true },
    discovery,
  );
  const result = await request.promptAsync(discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') throw new SpotifyError('cancelled');
  if (result.type !== 'success' || !result.params.code) throw new SpotifyError('denied', result.type === 'error' ? result.error?.message : undefined);

  const granted = await tokenRequest({
    grant_type: 'authorization_code',
    code: result.params.code,
    redirect_uri: uri,
    code_verifier: request.codeVerifier ?? '',
  });
  if (!granted.refresh_token) throw new SpotifyError('denied', 'no refresh token');

  // Their name, so the app can say who it's linked to. If this is refused, they aren't on the app's user list.
  const me = (await get(SPOTIFY.me, granted.access_token)) as { display_name?: string; id?: string } | null;
  const name = me?.display_name || me?.id || 'Spotify';
  await save(userId, { access: granted.access_token, refresh: granted.refresh_token, expiresAt: Date.now() + granted.expires_in * 1000, name });
  return name;
}

/** Forget this account's Spotify link. Nothing is kept. */
export async function disconnect(userId: string): Promise<void> {
  await save(userId, null);
}

/**
 * What this account has on in Spotify right now. Null if nothing's playing
 * (or it's paused, an ad, or a podcast). Throws `SpotifyError` if the link
 * needs attention.
 */
export async function nowPlaying(userId: string): Promise<SpotifyPlaying | null> {
  const token = await accessToken(userId);
  if (!token) throw new SpotifyError('expired');
  try {
    return readPlaying(await get(`${SPOTIFY.nowPlaying}?additional_types=track`, token));
  } catch (e) {
    if (e instanceof SpotifyError && e.code === 'expired') await save(userId, null);
    throw e;
  }
}

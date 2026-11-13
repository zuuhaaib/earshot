/**
 * Talking to Last.fm. There is no sign-in: the app is told a username and
 * reads that user's public "now playing", the same thing their profile page
 * shows. The username is kept per earshot account on this phone.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { backendClient } from '@/backend/accounts';
import { cloudConfigured } from '@/backend/config';
import { LASTFM_API, LASTFM_API_KEY, LASTFM_FUNCTION } from './config';
import { cleanUsername, looksLikeUsername, readProblem, readRecent, readUser, type LastfmPlaying, type LastfmProblem } from './match';

export class LastfmError extends Error {
  constructor(public code: LastfmProblem | 'not-configured' | 'not-deployed' | 'bad-username') {
    super(code);
  }
}

const keyFor = (userId: string) => `earshot.lastfm.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

async function load(userId: string): Promise<string | null> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(keyFor(userId)) : await SecureStore.getItemAsync(keyFor(userId));
    return raw || null;
  } catch {
    return null;
  }
}

async function save(userId: string, username: string | null) {
  const key = keyFor(userId);
  if (Platform.OS === 'web') {
    if (username) globalThis.localStorage?.setItem(key, username);
    else globalThis.localStorage?.removeItem(key);
    return;
  }
  if (username) await SecureStore.setItemAsync(key, username);
  else await SecureStore.deleteItemAsync(key);
}

/** Ask through earshot's server, which holds the key. Throws 'not-deployed' if the function isn't there yet. */
async function askServer(method: string, username: string): Promise<unknown> {
  const { data, error } = await backendClient().functions.invoke(LASTFM_FUNCTION, { body: { method, user: username } });
  if (!error) return data;
  if (error instanceof FunctionsHttpError) {
    const status = (error.context as { status?: number } | undefined)?.status;
    if (status === 404 || status === 503) throw new LastfmError('not-deployed'); // no function, or it has no key yet
    if (status === 429) throw new LastfmError('busy');
  }
  throw new LastfmError('network');
}

/** Ask Last.fm directly with a key held in the app. Only for running without the backend. */
async function askDirect(method: string, username: string, extra: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams({ method, user: username, api_key: LASTFM_API_KEY, format: 'json', ...extra });
  try {
    const res = await fetch(`${LASTFM_API}?${query.toString()}`);
    return await res.json(); // Last.fm puts its reasons in the body, even on an error status
  } catch {
    throw new LastfmError('network');
  }
}

async function ask(method: string, username: string, extra: Record<string, string> = {}): Promise<unknown> {
  const hasKey = LASTFM_API_KEY.trim().length > 0;
  let json: unknown;
  if (cloudConfigured()) {
    try {
      json = await askServer(method, username);
    } catch (e) {
      // Until the server function is deployed, a key in the app (if there is one) keeps things working.
      if (!(e instanceof LastfmError && e.code === 'not-deployed' && hasKey)) throw e;
      json = await askDirect(method, username, extra);
    }
  } else {
    if (!hasKey) throw new LastfmError('not-configured');
    json = await askDirect(method, username, extra);
  }
  const problem = readProblem(json);
  if (problem) throw new LastfmError(problem);
  return json;
}

/** The Last.fm username this account is linked to, or null. */
export const connectedAs = (userId: string) => load(userId);

/** Link a Last.fm username, after checking it exists and its listening can be read. Resolves to the name as Last.fm spells it. */
export async function connect(userId: string, raw: string): Promise<string> {
  const wanted = cleanUsername(raw);
  if (!looksLikeUsername(wanted)) throw new LastfmError('bad-username');
  const name = readUser(await ask('user.getinfo', wanted)) ?? wanted;
  await ask('user.getrecenttracks', name, { limit: '1' }); // fails here if they keep their listening private
  await save(userId, name);
  return name;
}

/** Forget this account's Last.fm username. Nothing else was ever kept. */
export async function disconnect(userId: string): Promise<void> {
  await save(userId, null);
}

/** What that Last.fm user has on right now, or null. Throws `LastfmError` if it can't be read. */
export async function nowPlaying(username: string): Promise<LastfmPlaying | null> {
  return readRecent(await ask('user.getrecenttracks', username, { limit: '1' }));
}

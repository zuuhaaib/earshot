/**
 * Accounts on the backend (Supabase Auth): sign-up with an emailed code,
 * log-in, password reset, and the public profile that goes with an account.
 *
 * Supabase does the security-critical work on its servers: it hashes
 * passwords, sends and checks the email codes, and rate-limits sign-ups,
 * log-ins and code checks per IP address. This file is the app's side of it.
 */
import 'expo-sqlite/localStorage/install'; // gives Supabase somewhere on the phone to keep the session
import { AppState, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cloudConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

export type CloudProfile = {
  id: string;
  email: string;
  name: string;
  handle: string;
  badge: string;
  badgeColor: string;
  tagline: string;
  bio: string;
  homeCity: string;
};

export type NewCloudAccount = Pick<CloudProfile, 'name' | 'handle' | 'badge' | 'badgeColor' | 'homeCity'> & {
  email: string;
  password: string;
};

export class CloudError extends Error {
  constructor(
    public code:
      | 'not-configured'
      | 'bad-email'
      | 'weak-password'
      | 'bad-handle'
      | 'handle-taken'
      | 'email-taken'
      | 'unconfirmed' // right password, but the email hasn't been verified yet
      | 'wrong' // wrong email or password (Supabase doesn't say which, on purpose)
      | 'bad-code'
      | 'too-many' // the server's rate limit
      | 'cancelled' // closed the Google window before finishing
      | 'google-off' // Google sign-in isn't switched on in the backend
      | 'apple-off' // Sign in with Apple isn't switched on in the backend, or doesn't know this app
      | 'no-setup' // the database script hasn't been run
      | 'network',
    detail?: string,
  ) {
    super(detail ?? code);
  }
}

const WORDS: Record<CloudError['code'], string> = {
  'not-configured': 'The backend isn’t set up in this build yet.',
  'bad-email': 'That doesn’t look like an email address.',
  'weak-password': 'Passwords need at least 8 characters.',
  'bad-handle': 'A handle needs 2 to 28 letters, numbers, dots or underscores.',
  'handle-taken': 'Someone already has that handle. Pick another.',
  'email-taken': 'There’s already an account with that email. Log in instead, or reset its password.',
  unconfirmed: 'That account’s email hasn’t been verified yet. Enter the code we sent you.',
  wrong: 'That email and password don’t match an account.',
  'bad-code': 'That code isn’t right, or it’s expired. Check the newest email, or send another.',
  'too-many': 'Too many attempts. The server’s asked everyone to slow down; wait a minute and try again.',
  cancelled: 'You closed the Google window before finishing. Nothing happened.',
  'apple-off': 'Apple signed you in, but the backend didn’t accept it. In Supabase, under Authentication → Sign In / Providers → Apple, switch it on and add this app’s ID under Client IDs (host.exp.Exponent while testing in Expo Go).',
  'google-off': 'Google sign-in isn’t switched on for this backend yet. It needs enabling in the Supabase dashboard (Authentication → Sign In / Providers → Google).',
  'no-setup': 'The backend is reachable but its database hasn’t been set up. Run supabase/schema.sql in the Supabase SQL editor.',
  network: 'Couldn’t reach the server. Check your connection and try again.',
};
export const cloudWords = (e: unknown, fallback = 'Something went wrong on the way to the server. Try again.') =>
  e instanceof CloudError ? WORDS[e.code] : fallback;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const looksLikeEmail = (email: string) => EMAIL.test(email.trim());

// ---- the client -------------------------------------------------------------

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!cloudConfigured()) throw new CloudError('not-configured');
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  // Keep the session fresh while the app is in front, and stop when it isn't.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client?.auth.startAutoRefresh();
    else client?.auth.stopAutoRefresh();
  });
  return client;
}

/** The one connection to the backend, for the few things outside this file that need it (live updates). */
export const backendClient = (): SupabaseClient => supabase();

/** Turn whatever Supabase said into one of our plain reasons. */
function reason(error: { message?: string; code?: string; status?: number } | null | undefined): CloudError {
  const code = error?.code ?? '';
  const message = (error?.message ?? '').toLowerCase();
  if (error?.status === 429 || code.includes('rate_limit')) return new CloudError('too-many', error?.message);
  if (code === 'email_not_confirmed' || message.includes('not confirmed')) return new CloudError('unconfirmed');
  if (code === 'invalid_credentials' || message.includes('invalid login')) return new CloudError('wrong');
  if (code === 'otp_expired' || message.includes('token has expired') || message.includes('invalid token')) return new CloudError('bad-code');
  if (code === 'weak_password') return new CloudError('weak-password');
  if (code === 'user_already_exists' || code === 'email_exists') return new CloudError('email-taken');
  if (code === 'email_address_invalid' || code === 'validation_failed') return new CloudError('bad-email');
  if (message.includes('profiles_handle_unique') || message.includes('database error saving new user')) return new CloudError('handle-taken', error?.message);
  if (message.includes('handle_available') || code === 'PGRST202' || code === '42P01') return new CloudError('no-setup', error?.message);
  if (message.includes('provider is not enabled') || message.includes('unsupported provider')) return new CloudError('google-off', error?.message);
  if (message.includes('network') || message.includes('fetch')) return new CloudError('network', error?.message);
  return new CloudError('network', error?.message);
}

async function attempt<T extends { error: { message?: string; code?: string; status?: number } | null }>(call: () => Promise<T>): Promise<T> {
  let result: T;
  try {
    result = await call();
  } catch (e) {
    if (e instanceof CloudError) throw e;
    throw new CloudError('network', String(e));
  }
  if (result.error) throw reason(result.error);
  return result;
}

const cleanHandle = (handle: string) =>
  handle
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

// ---- profile ----------------------------------------------------------------

type ProfileRow = {
  id: string;
  handle: string;
  name: string;
  badge: string;
  badge_color: string;
  tagline: string;
  bio: string;
  home_city: string;
};

/** Call one of the backend's functions. Rejects with an Error whose message is the server's reason code. */
export async function callServer(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (!cloudConfigured()) throw new CloudError('not-configured');
  let result: { data: unknown; error: { message?: string; code?: string } | null };
  try {
    result = await supabase().rpc(fn, args);
  } catch (e) {
    throw new CloudError('network', String(e));
  }
  if (result.error) {
    if (result.error.code === 'PGRST202') throw new CloudError('no-setup', result.error.message);
    throw new Error(result.error.message ?? 'server error');
  }
  return result.data;
}

/** Whether anyone is logged in to the backend on this phone. Reads the stored session; no network. */
export async function isLoggedIn(): Promise<boolean> {
  if (!cloudConfigured()) return false;
  const { data } = await supabase().auth.getSession();
  return !!data.session;
}

let setUp: boolean | null = null;

/**
 * Whether the backend has earshot's full database (supabase/schema.sql), as
 * opposed to nothing, or only the first accounts-only script. Asked once.
 */
export async function serverIsSetUp(): Promise<boolean> {
  if (setUp !== null) return setUp;
  try {
    await callServer('get_session');
    setUp = true;
  } catch (e) {
    // "no such function" is a definite no. Anything else (offline, say) is a maybe; assume yes so
    // the app doesn't quietly switch to phone-only data because the wifi blinked.
    setUp = !(e instanceof CloudError && e.code === 'no-setup');
  }
  return setUp;
}

async function profileFor(userId: string, email: string): Promise<CloudProfile> {
  if (await serverIsSetUp()) {
    const session = (await callServer('get_session')) as { me: (Omit<CloudProfile, 'email' | 'badgeColor' | 'homeCity'> & { badgeColor: string; homeCity: string }) | null };
    if (!session.me) throw new CloudError('no-setup', 'no profile for this account');
    const me = session.me;
    return { id: me.id, email, name: me.name, handle: me.handle, badge: me.badge, badgeColor: me.badgeColor, tagline: me.tagline, bio: me.bio, homeCity: me.homeCity };
  }
  // Only the first, accounts-only script has been run: profiles are a plain table.
  const { data } = await attempt(async () => await supabase().from('profiles').select('*').eq('id', userId).maybeSingle<ProfileRow>());
  if (!data) throw new CloudError('no-setup', 'no profile row for this account');
  return {
    id: data.id,
    email,
    name: data.name,
    handle: data.handle,
    badge: data.badge,
    badgeColor: data.badge_color,
    tagline: data.tagline,
    bio: data.bio,
    homeCity: data.home_city,
  };
}

/** Whoever is logged in to the backend on this phone, or null. Doesn't need the network if nobody is. */
export async function currentAccount(): Promise<CloudProfile | null> {
  if (!cloudConfigured()) return null;
  const { data } = await supabase().auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return profileFor(user.id, user.email ?? '');
}

/** Be told when the backend session ends (logged out elsewhere, revoked, expired). */
export function onLoggedOut(listener: () => void): () => void {
  if (!cloudConfigured()) return () => {};
  const { data } = supabase().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') listener();
  });
  return () => data.subscription.unsubscribe();
}

/** Save profile changes to the backend. Only your own row can be changed; the database enforces that. */
export async function saveProfile(profile: Pick<CloudProfile, 'id' | 'name' | 'badge' | 'badgeColor' | 'tagline' | 'bio' | 'homeCity'>): Promise<void> {
  if (await serverIsSetUp()) return; // the server-backed data layer already saved it through its own function
  await attempt(
    async () =>
      await supabase()
        .from('profiles')
        .update({
          name: profile.name,
          badge: profile.badge,
          badge_color: profile.badgeColor,
          tagline: profile.tagline,
          bio: profile.bio,
          home_city: profile.homeCity,
        })
        .eq('id', profile.id),
  );
}

// ---- sign-up ----------------------------------------------------------------

/**
 * Start a sign-up. Supabase emails a six-digit code; the account can't be
 * used until `confirmEmail` is called with it.
 */
export async function signUp(input: NewCloudAccount): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const handle = cleanHandle(input.handle);
  if (!looksLikeEmail(email)) throw new CloudError('bad-email');
  if (input.password.length < 8) throw new CloudError('weak-password');
  if (!/^[a-z0-9._]{2,28}$/.test(handle)) throw new CloudError('bad-handle');

  const free = await attempt(async () => await supabase().rpc('handle_available', { wanted: handle }));
  if (free.data === false) throw new CloudError('handle-taken');

  const { data } = await attempt(
    async () =>
      await supabase().auth.signUp({
        email,
        password: input.password,
        options: { data: { handle, name: input.name.trim(), badge: input.badge, badge_color: input.badgeColor, home_city: input.homeCity } },
      }),
  );
  // Supabase answers a sign-up for an existing, verified email with a decoy user that has no identities.
  if (data.user && data.user.identities && data.user.identities.length === 0) throw new CloudError('email-taken');
}

/** Finish a sign-up (or a first log-in) with the emailed code. Resolves to the new account. */
export async function confirmEmail(email: string, code: string): Promise<CloudProfile> {
  const { data } = await attempt(
    async () => await supabase().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\D/g, ''), type: 'email' }),
  );
  if (!data.user) throw new CloudError('bad-code');
  return profileFor(data.user.id, data.user.email ?? email);
}

/** Send the sign-up code again. The server allows one a minute. */
export async function resendCode(email: string): Promise<void> {
  await attempt(async () => await supabase().auth.resend({ type: 'signup', email: email.trim().toLowerCase() }));
}

// ---- log-in, log-out, passwords --------------------------------------------

export async function logIn(email: string, password: string): Promise<CloudProfile> {
  if (!looksLikeEmail(email)) throw new CloudError('bad-email');
  const { data } = await attempt(async () => await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password }));
  if (!data.user) throw new CloudError('wrong');
  return profileFor(data.user.id, data.user.email ?? email);
}

// The push token this phone registered for whoever is logged in, so logging out can stop it.
let pushToken: string | null = null;
export const setPushToken = (token: string | null) => {
  pushToken = token;
};

export async function logOut(): Promise<void> {
  if (!cloudConfigured()) return;
  if (pushToken) {
    await callServer('forget_push_token', { p_token: pushToken }).catch(() => {});
    pushToken = null;
  }
  // "local" ends the session on this phone only; your other devices stay logged in.
  await supabase().auth.signOut({ scope: 'local' }).catch(() => {});
}

/** Email a code for choosing a new password. Says nothing about whether the address has an account. */
export async function sendReset(email: string): Promise<void> {
  if (!looksLikeEmail(email)) throw new CloudError('bad-email');
  await attempt(async () => await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase()));
}

/** Use the emailed reset code to set a new password. Logs you in. */
export async function finishReset(email: string, code: string, password: string): Promise<CloudProfile> {
  if (password.length < 8) throw new CloudError('weak-password');
  const { data } = await attempt(
    async () => await supabase().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\D/g, ''), type: 'recovery' }),
  );
  if (!data.user) throw new CloudError('bad-code');
  await attempt(async () => await supabase().auth.updateUser({ password }));
  return profileFor(data.user.id, data.user.email ?? email);
}

/** Change the password of whoever is logged in. */
export async function changePassword(password: string): Promise<void> {
  if (password.length < 8) throw new CloudError('weak-password');
  await attempt(async () => await supabase().auth.updateUser({ password }));
}

// ---- Google -------------------------------------------------------------------

// Lets the sign-in window close itself on web when Google sends you back.
WebBrowser.maybeCompleteAuthSession();

/** Everything after the ? and the # of a URL, as one set of name/value pairs. */
function urlParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '';
  for (const part of [query, hash]) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      out[decodeURIComponent(k)] = decodeURIComponent(v.split('+').join(' '));
    }
  }
  return out;
}

/** Where Google (via the backend) sends you back to. It must be listed under Redirect URLs in the Supabase dashboard. */
export const googleRedirect = () => {
  // On iPhone the sign-in window hands any address starting earshot:// straight back to us, in
  // Expo Go as well as in a built app, so use that. It matters because the backend refuses return
  // addresses made of a numeric network address, which is what Expo Go's own exp://192.168… one is.
  if (Platform.OS === 'ios') return 'earshot://auth';
  // Android in Expo Go has to use Expo's own address; that only works when Expo is started with
  // --tunnel (which gives a named address). A built Android app gets earshot://auth from this too.
  return makeRedirectUri({ scheme: 'earshot', path: 'auth' });
};

/** True when the return address is one the backend will refuse (a numeric network address). */
export const googleRedirectIsNumeric = () => {
  const host = (googleRedirect().split('://')[1] ?? '').split('/')[0].split(':')[0];
  return host.split('.').length === 4 && host.split('.').every((part) => part !== '' && !Number.isNaN(Number(part)));
};

/**
 * Sign in, or sign up, with a Google account. Google proves the email, so
 * there is no code to type. New people come back with `needsProfile` set and
 * are asked to pick a handle and badge.
 */
export async function signInWithGoogle(): Promise<CloudProfile> {
  const redirectTo = googleRedirect();
  const { data } = await attempt(
    async () => await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } }),
  );
  if (!data.url) throw new CloudError('google-off');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new CloudError('cancelled');

  const params = urlParams(result.url);
  if (params.error || params.error_code) {
    const detail = `${params.error_code ?? params.error} ${params.error_description ?? ''}`;
    throw new CloudError(/provider is not enabled|unsupported provider/i.test(detail) ? 'google-off' : 'network', detail);
  }
  if (!params.access_token || !params.refresh_token) throw new CloudError('cancelled');
  const session = await attempt(async () => await supabase().auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token }));
  const user = session.data.user;
  if (!user) throw new CloudError('network', 'no user after Google sign-in');
  return profileFor(user.id, user.email ?? '');
}

// ---- Sign in with Apple ---------------------------------------------------------

/** Whether to offer Sign in with Apple: iPhones and iPads only, where Apple's own sheet does the work. */
export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !cloudConfigured()) return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * Sign in, or sign up, with an Apple ID. Apple proves who you are and hands
 * the backend a signed token; earshot never sees your Apple password. People
 * who choose "Hide My Email" get a relay address, which works the same. New
 * people come back with `needsProfile` set and pick a handle and badge.
 */
export async function signInWithApple(): Promise<CloudProfile> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new CloudError('cancelled');
    throw new CloudError('apple-off', String(e));
  }
  const token = credential.identityToken;
  if (!token) throw new CloudError('apple-off', 'no identity token');

  let user;
  try {
    const { data, error } = await supabase().auth.signInWithIdToken({ provider: 'apple', token });
    if (error) {
      if (error.status === 429) throw new CloudError('too-many', error.message);
      throw new CloudError('apple-off', error.message);
    }
    user = data.user;
  } catch (e) {
    if (e instanceof CloudError) throw e;
    throw new CloudError('network', String(e));
  }
  if (!user) throw new CloudError('network', 'no user after Apple sign-in');

  // Apple only gives the name the very first time, so keep it with the login.
  const parts = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean);
  if (parts.length) await supabase().auth.updateUser({ data: { full_name: parts.join(' ') } }).catch(() => {});

  return profileFor(user.id, user.email ?? credential.email ?? '');
}

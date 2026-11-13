/**
 * Keeps "what you've got on" in step with Spotify while earshot is open.
 *
 * There is no server, so this only runs while the app is in front: it asks
 * Spotify every so often, and passes any change to the same `setNowPlaying`
 * the manual picker uses. Whether anyone nearby sees it is still decided by
 * the ON AIR switch, not by this.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { EarshotApi } from '@/data';
import { music } from '@/music';
import { connect, connectedAs, disconnect, nowPlaying, SpotifyError } from './client';
import { decide, toTrack } from './match';

const EVERY_MS = 20_000;

export type SpotifyState = {
  /** unknown: still checking. off: not linked. on: linked and syncing. */
  status: 'unknown' | 'off' | 'on';
  /** The Spotify name this account is linked to. */
  name: string | null;
  /** What went wrong last, in plain words, if anything. */
  problem: string | null;
  /** The last thing Spotify said was playing, for the status line. */
  heard: string | null;
  checkedAt: number | null;
};

let state: SpotifyState = { status: 'unknown', name: null, problem: null, heard: null, checkedAt: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<SpotifyState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useSpotify = () => useSyncExternalStore(subscribe, () => state, () => state);

const WORDS: Record<SpotifyError['code'], string> = {
  'not-configured': 'Spotify isn’t set up in this build yet: the Client ID is missing.',
  cancelled: 'You closed Spotify’s sign-in before finishing. Nothing was linked.',
  denied: 'Spotify didn’t complete the sign-in. If it complained about a redirect address, add the one shown here to your Spotify app’s settings.',
  'not-allowed': 'Spotify signed you in but won’t share anything: this Spotify account isn’t on the app’s user list yet. Add it under User Management in the Spotify dashboard.',
  expired: 'The link to Spotify lapsed or was removed. Connect again to carry on.',
  network: 'Couldn’t reach Spotify just now. It’ll try again shortly.',
};
export const spotifyWords = (e: unknown) => (e instanceof SpotifyError ? WORDS[e.code] : 'Something went wrong talking to Spotify.');

// What this link last did, so it doesn't fight with songs you pick by hand.
let lastActedOn: string | null = null;
let ourTrackId: string | null = null;
let busy = false;

/** Ask Spotify once and act on the answer. Safe to call as often as you like. */
export async function checkSpotify(api: EarshotApi, userId: string): Promise<void> {
  if (busy || state.status !== 'on') return;
  busy = true;
  try {
    const playing = await nowPlaying(userId);
    const session = await api.getSession();
    if (session.me?.id !== userId) return; // the account changed while we were asking
    const oursIsOn = !!ourTrackId && session.nowPlaying?.track.id === ourTrackId;
    const action = decide({ playing, lastActedOn, oursIsOn });

    if (action.do === 'set' && playing) {
      // Look the song up in earshot's own music source so it has a preview and matches everyone else's copy.
      const found = await music.search(`${playing.artist} ${playing.title}`, { limit: 8 }).catch(() => []);
      const track = toTrack(playing, found);
      await api.setNowPlaying(track);
      lastActedOn = playing.spotifyId;
      ourTrackId = track.id;
    } else if (action.do === 'clear') {
      await api.setNowPlaying(null);
      ourTrackId = null;
    }
    if (!playing) lastActedOn = null; // so the same song counts as new if you start it again later
    set({ problem: null, heard: playing ? `${playing.title} · ${playing.artist}` : null, checkedAt: Date.now() });
  } catch (e) {
    if (e instanceof SpotifyError && e.code === 'expired') set({ status: 'off', name: null, problem: WORDS.expired, heard: null });
    else set({ problem: spotifyWords(e), checkedAt: Date.now() });
  } finally {
    busy = false;
  }
}

export async function connectSpotify(api: EarshotApi, userId: string): Promise<void> {
  const name = await connect(userId); // throws SpotifyError with the reason
  lastActedOn = null;
  ourTrackId = null;
  set({ status: 'on', name, problem: null, heard: null, checkedAt: null });
  await checkSpotify(api, userId);
}

export async function disconnectSpotify(userId: string): Promise<void> {
  await disconnect(userId);
  lastActedOn = null;
  ourTrackId = null;
  set({ status: 'off', name: null, problem: null, heard: null, checkedAt: null });
}

/** Mount once, near the top of the signed-in app. Syncs while the app is open and in front. */
export function useSpotifySync(api: EarshotApi, userId: string | null) {
  useEffect(() => {
    if (!userId) {
      set({ status: 'off', name: null, problem: null, heard: null, checkedAt: null });
      return;
    }
    let alive = true;
    lastActedOn = null;
    ourTrackId = null;
    set({ status: 'unknown', name: null, problem: null, heard: null, checkedAt: null });
    connectedAs(userId).then((name) => {
      if (!alive) return;
      set({ status: name ? 'on' : 'off', name });
      if (name) checkSpotify(api, userId);
    });

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') checkSpotify(api, userId);
    }, EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && checkSpotify(api, userId));
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [api, userId]);
}

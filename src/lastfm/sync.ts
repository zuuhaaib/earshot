/**
 * Keeps "what you've got on" in step with Last.fm while earshot is open.
 *
 * This is the stand-in for the Spotify link, for anyone Spotify won't let the
 * app talk to directly. Last.fm can be told to follow a Spotify account (and
 * most other players), and shows what's playing publicly; earshot reads that.
 * If Spotify is linked and working, it wins and this stays quiet.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { EarshotApi } from '@/data';
import { music } from '@/music';
import { decide } from '@/spotify/match';
import { spotifyNow } from '@/spotify/sync';
import { connect, connectedAs, disconnect, LastfmError, nowPlaying } from './client';
import { toLastfmTrack } from './match';

/** Last.fm asks apps to be gentle, and its "now playing" only moves about this often anyway. */
const EVERY_MS = 30_000;

export type LastfmState = {
  status: 'unknown' | 'off' | 'on';
  /** The Last.fm username this account is linked to. */
  name: string | null;
  problem: string | null;
  heard: string | null;
  checkedAt: number | null;
  /** Spotify is linked and working, so this is standing by. */
  standingBy: boolean;
};

const OFF: LastfmState = { status: 'off', name: null, problem: null, heard: null, checkedAt: null, standingBy: false };
let state: LastfmState = { ...OFF, status: 'unknown' };
const listeners = new Set<() => void>();
const set = (patch: Partial<LastfmState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useLastfm = () => useSyncExternalStore(subscribe, () => state, () => state);

const WORDS: Record<LastfmError['code'], string> = {
  'not-configured': 'Last.fm isn’t set up in this build yet: the API key is missing.',
  'not-deployed': 'Last.fm isn’t switched on for this backend yet. Its server function (supabase/functions/lastfm) needs deploying, with the Last.fm API key saved as its secret.',
  'bad-username': 'That doesn’t look like a Last.fm username. It’s the name in your profile’s address: last.fm/user/yourname.',
  'no-such-user': 'Last.fm doesn’t know anyone by that name. Check the spelling.',
  private: 'That Last.fm account keeps its recent listening hidden, so there’s nothing to read. Turn off “Hide recent listening information” in Last.fm’s privacy settings, then try again.',
  'bad-key': 'Last.fm turned down this app’s API key. That’s a setup problem, not something you did.',
  busy: 'Last.fm says we’re asking too often. It’ll try again shortly.',
  network: 'Couldn’t reach Last.fm just now. It’ll try again shortly.',
};
export const lastfmWords = (e: unknown) => (e instanceof LastfmError ? WORDS[e.code] : 'Something went wrong talking to Last.fm.');

// What this link last did, so it doesn't fight with songs you pick by hand.
let lastActedOn: string | null = null;
let ourTrackId: string | null = null;
let busy = false;

/** Ask Last.fm once and act on the answer. Safe to call as often as you like. */
export async function checkLastfm(api: EarshotApi, userId: string): Promise<void> {
  if (busy || state.status !== 'on' || !state.name) return;
  const spotify = spotifyNow();
  if (spotify.status === 'on' && !spotify.problem) {
    if (!state.standingBy) set({ standingBy: true, problem: null });
    return;
  }
  busy = true;
  try {
    const playing = await nowPlaying(state.name);
    const session = await api.getSession();
    if (session.me?.id !== userId) return; // the account changed while we were asking
    const oursIsOn = !!ourTrackId && session.nowPlaying?.track.id === ourTrackId;
    const action = decide({ playing: playing ? { spotifyId: playing.key, title: playing.title, artist: playing.artist, album: playing.album, year: null, artworkUrl: playing.artworkUrl } : null, lastActedOn, oursIsOn });

    let heard = playing ? `${playing.title} · ${playing.artist}` : null;
    if (action.do === 'set' && playing) {
      const found = await music.search(`${playing.artist} ${playing.title}`, { limit: 8 }).catch(() => []);
      const track = toLastfmTrack(playing, found);
      if (track) {
        await api.setNowPlaying(track);
        ourTrackId = track.id;
      } else {
        heard = `${heard} (couldn’t find a sleeve for it, so it wasn’t put up)`;
      }
      lastActedOn = playing.key; // either way, don't ask the music source again until the song changes
    } else if (action.do === 'clear') {
      await api.setNowPlaying(null);
      ourTrackId = null;
    }
    if (!playing) lastActedOn = null;
    set({ problem: null, heard, checkedAt: Date.now(), standingBy: false });
  } catch (e) {
    set({ problem: lastfmWords(e), checkedAt: Date.now(), standingBy: false });
  } finally {
    busy = false;
  }
}

export async function connectLastfm(api: EarshotApi, userId: string, username: string): Promise<string> {
  const name = await connect(userId, username); // throws LastfmError with the reason
  lastActedOn = null;
  ourTrackId = null;
  set({ ...OFF, status: 'on', name });
  await checkLastfm(api, userId);
  return name;
}

export async function disconnectLastfm(userId: string): Promise<void> {
  await disconnect(userId);
  lastActedOn = null;
  ourTrackId = null;
  set(OFF);
}

/** Mount once, near the top of the signed-in app, after the Spotify sync. */
export function useLastfmSync(api: EarshotApi, userId: string | null) {
  useEffect(() => {
    if (!userId) {
      set(OFF);
      return;
    }
    let alive = true;
    lastActedOn = null;
    ourTrackId = null;
    set({ ...OFF, status: 'unknown' });
    connectedAs(userId).then((name) => {
      if (!alive) return;
      set({ status: name ? 'on' : 'off', name });
      // give the Spotify link a moment to say whether it's working before stepping in
      if (name) setTimeout(() => alive && checkLastfm(api, userId), 4000);
    });

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') checkLastfm(api, userId);
    }, EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && checkLastfm(api, userId));
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [api, userId]);
}

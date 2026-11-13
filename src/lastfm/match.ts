/**
 * The thinking parts of the Last.fm link, kept free of network and phone APIs
 * so they can be tested: reading Last.fm's answer and turning it into a track.
 */
import type { Track } from '@/music/types';
import { toTrack } from '@/spotify/match';

/** What Last.fm says is on, boiled down. */
export type LastfmPlaying = {
  /** Last.fm has no track id worth trusting, so the artist and title stand in for one. */
  key: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
};

export type LastfmProblem = 'no-such-user' | 'private' | 'bad-key' | 'busy' | 'network';

type Text = { '#text'?: string } | string | undefined;
const text = (v: Text) => (typeof v === 'string' ? v : (v?.['#text'] ?? '')).trim();

/** The grey star Last.fm sends when it has no cover. Not worth showing. */
const PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

/** Why Last.fm refused, if the answer is an error. Null if it's a real answer. */
export function readProblem(json: unknown): LastfmProblem | null {
  if (!json || typeof json !== 'object') return 'network';
  const code = (json as { error?: number }).error;
  if (code === undefined) return null;
  if (code === 6 || code === 7) return 'no-such-user';
  if (code === 17) return 'private'; // they've hidden their recent listening
  if (code === 4 || code === 10 || code === 26) return 'bad-key';
  if (code === 29) return 'busy';
  return 'network';
}

/**
 * Read a user.getRecentTracks answer. Null unless the newest entry is marked
 * as playing right now: something that finished ten minutes ago doesn't count.
 */
export function readRecent(json: unknown): LastfmPlaying | null {
  const list = (json as { recenttracks?: { track?: unknown } } | null)?.recenttracks?.track;
  const first = (Array.isArray(list) ? list[0] : list) as
    | { name?: string; artist?: Text | { name?: string }; album?: Text; image?: { '#text'?: string }[]; '@attr'?: { nowplaying?: string } }
    | undefined;
  if (!first || first['@attr']?.nowplaying !== 'true') return null;
  const title = (first.name ?? '').trim();
  const artist = text(first.artist as Text) || ((first.artist as { name?: string } | undefined)?.name ?? '').trim();
  if (!title || !artist) return null;
  const covers = (first.image ?? []).map((i) => (i['#text'] ?? '').trim()).filter((u) => u && !u.includes(PLACEHOLDER));
  return {
    key: `${artist.toLowerCase()}|${title.toLowerCase()}`,
    title,
    artist,
    album: text(first.album),
    artworkUrl: covers[covers.length - 1] ?? '', // the list runs small to large
  };
}

/** The display name on a user.getInfo answer, as Last.fm spells it. */
export function readUser(json: unknown): string | null {
  const name = (json as { user?: { name?: string } } | null)?.user?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

/**
 * The same song from earshot's own music source if there's a confident match
 * (so it has a preview and lines up with everyone else's copy). Otherwise
 * Last.fm's own details, or null if Last.fm has no cover for it either: a
 * card with no sleeve isn't worth putting up.
 */
export function toLastfmTrack(playing: LastfmPlaying, candidates: Track[]): Track | null {
  const id = `lastfm:${playing.key.replace(/[^a-z0-9|]+/g, '-')}`;
  const track = toTrack({ spotifyId: id, title: playing.title, artist: playing.artist, album: playing.album, year: null, artworkUrl: playing.artworkUrl }, candidates);
  if (!track.id.startsWith('spotify:')) return track; // found in the music source
  if (!playing.artworkUrl) return null;
  return { ...track, id, sourceId: id };
}

/** What a Last.fm username may look like: 2 to 15 letters, numbers, dashes or underscores. */
export const cleanUsername = (raw: string) => raw.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?last\.fm\/user\//i, '').replace(/\/.*$/, '');
export const looksLikeUsername = (name: string) => /^[A-Za-z][A-Za-z0-9_-]{1,14}$/.test(name);

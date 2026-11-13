/**
 * The thinking parts of the Spotify link, kept free of network and phone APIs
 * so they can be tested: reading Spotify's answer, finding the same song in
 * earshot's own music source, and deciding what to do about it.
 */
import type { Track } from '@/music/types';

/** What Spotify says is on, boiled down. */
export type SpotifyPlaying = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  year: number | null;
  artworkUrl: string;
};

/** Read the currently-playing response. Null unless a music track is actually playing. */
export function readPlaying(json: unknown): SpotifyPlaying | null {
  if (!json || typeof json !== 'object') return null;
  const body = json as {
    is_playing?: boolean;
    currently_playing_type?: string;
    item?: {
      id?: string;
      name?: string;
      artists?: { name?: string }[];
      album?: { name?: string; release_date?: string; images?: { url?: string }[] };
    } | null;
  };
  const item = body.item;
  // paused, an ad, a podcast episode, or nothing at all
  if (!body.is_playing || !item || (body.currently_playing_type && body.currently_playing_type !== 'track')) return null;
  const artist = item.artists?.[0]?.name;
  if (!item.id || !item.name || !artist) return null;
  const year = Number(item.album?.release_date?.slice(0, 4));
  return {
    spotifyId: item.id,
    title: item.name,
    artist,
    album: item.album?.name ?? '',
    year: Number.isFinite(year) && year > 0 ? year : null,
    artworkUrl: item.album?.images?.[0]?.url ?? '',
  };
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ') // "(Remastered 2011)", "[Live]"
    .replace(/\s-\s.*$/, ' ') // " - 2011 Remaster"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Find the same song among results from earshot's own music source, so it has
 * a preview clip and lines up with everyone else's copy of that song. Falls
 * back to Spotify's own details (no preview) when there's no confident match.
 */
export function toTrack(playing: SpotifyPlaying, candidates: Track[]): Track {
  const title = norm(playing.title);
  const artist = norm(playing.artist);
  const sameArtist = (t: Track) => norm(t.artist).includes(artist) || artist.includes(norm(t.artist));
  const match =
    candidates.find((t) => sameArtist(t) && norm(t.title) === title) ??
    candidates.find((t) => sameArtist(t) && (norm(t.title).startsWith(title) || title.startsWith(norm(t.title))));
  if (match) return match;
  return {
    id: `spotify:${playing.spotifyId}`,
    sourceId: playing.spotifyId,
    title: playing.title,
    artist: playing.artist,
    album: playing.album,
    year: playing.year,
    genre: '',
    artworkUrl: playing.artworkUrl,
    previewUrl: null,
  };
}

export type SyncAction = { do: 'nothing' } | { do: 'set'; spotifyId: string } | { do: 'clear' };

/**
 * What to do with one answer from Spotify.
 *
 * - Something new is playing: put it on.
 * - Nothing is playing: take the song off, but only if Spotify was the one
 *   who put it on. A song you set by hand is left alone.
 */
export function decide(input: {
  /** What Spotify says is on now. */
  playing: SpotifyPlaying | null;
  /**
   * The Spotify id this link last acted on. While Spotify stays on that song
   * nothing is done, so if you pick something else by hand it isn't
   * overwritten until Spotify moves to a different song.
   */
  lastActedOn: string | null;
  /** Whether the song currently on in earshot is one this link put there. */
  oursIsOn: boolean;
}): SyncAction {
  const { playing, lastActedOn, oursIsOn } = input;
  if (playing) return playing.spotifyId === lastActedOn ? { do: 'nothing' } : { do: 'set', spotifyId: playing.spotifyId };
  return oursIsOn ? { do: 'clear' } : { do: 'nothing' };
}

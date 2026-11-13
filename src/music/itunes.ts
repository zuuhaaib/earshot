import type { MusicSource, Track } from './types';

type ItunesSong = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  artworkUrl100: string;
  previewUrl?: string;
};

const toTrack = (r: ItunesSong): Track => ({
  id: `itunes:${r.trackId}`,
  sourceId: String(r.trackId),
  title: r.trackName,
  artist: r.artistName,
  album: r.collectionName ?? '',
  year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null,
  genre: r.primaryGenreName ?? '',
  artworkUrl: r.artworkUrl100.replace('100x100bb', '600x600bb'),
  previewUrl: r.previewUrl ?? null,
});

/** iTunes Search API: no key, no account. Search, artwork and 30-second previews. */
export const itunes: MusicSource = {
  name: 'iTunes',
  async search(query, opts) {
    const q = query.trim();
    if (!q) return [];
    const url =
      'https://itunes.apple.com/search?media=music&entity=song&country=CA' +
      `&limit=${opts?.limit ?? 20}&term=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal: opts?.signal });
    if (!res.ok) throw new Error(`music search failed (${res.status})`);
    const json = (await res.json()) as { results: ItunesSong[] };
    return json.results.filter((r) => r.trackId && r.trackName).map(toTrack);
  },
  async lookup(sourceId) {
    const res = await fetch(`https://itunes.apple.com/lookup?country=CA&id=${encodeURIComponent(sourceId)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { results: ItunesSong[] };
    return json.results[0]?.trackName ? toTrack(json.results[0]) : null;
  },
};

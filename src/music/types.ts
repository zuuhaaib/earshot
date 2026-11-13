/**
 * The one small door all music data comes through. Screens only know about
 * `Track` and `MusicSource`; swap the implementation in src/music/index.ts to
 * plug in a real streaming service later.
 */
export type Track = {
  /** Stable id inside earshot. Seeded tracks use a slug, searched ones `itunes:<id>`. */
  id: string;
  /** Id in whatever service the track came from. */
  sourceId: string;
  title: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string;
  artworkUrl: string;
  /** A short clip that can be played without an account. May be missing. */
  previewUrl: string | null;
};

export interface MusicSource {
  readonly name: string;
  search(query: string, opts?: { limit?: number; signal?: AbortSignal }): Promise<Track[]>;
  lookup(sourceId: string): Promise<Track | null>;
}

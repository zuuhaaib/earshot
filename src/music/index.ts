import { itunes } from './itunes';
import type { MusicSource, Track } from './types';
import seeded from '@/seed/tracks.json';

export type { MusicSource, Track } from './types';
export { togglePreview, stopPreview, useIsPlaying } from './player';

/** The music service in use. Replace this one line to plug in another. */
export const music: MusicSource = itunes;

const seedTracks = seeded as Record<string, Track>;

/** A track from the seeded world, by slug. Throws on a typo so seeds fail loudly. */
export function seedTrack(id: string): Track {
  const t = seedTracks[id];
  if (!t) throw new Error(`seed track "${id}" is not in src/seed/tracks.json`);
  return t;
}
export const hasSeedTrack = (id: string) => id in seedTracks;

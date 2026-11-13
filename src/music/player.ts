/**
 * One preview player for the whole app. Only one clip plays at a time; tapping
 * another sleeve swaps the record.
 */
import { useSyncExternalStore } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { Track } from './types';

type State = { trackId: string | null; playing: boolean; failed: string | null };

let state: State = { trackId: null, playing: false, failed: null };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

let player: AudioPlayer | null = null;

function getPlayer(): AudioPlayer {
  if (player) return player;
  player = createAudioPlayer(null);
  // Play previews even when the phone's silent switch is on: you tapped play.
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) set({ trackId: null, playing: false });
    else if (state.trackId && status.isLoaded && status.playing !== state.playing) set({ playing: status.playing });
  });
  return player;
}

export function togglePreview(track: Pick<Track, 'id' | 'previewUrl'>) {
  if (!track.previewUrl) {
    set({ failed: track.id });
    return;
  }
  try {
    const p = getPlayer();
    if (state.trackId === track.id) {
      if (state.playing) {
        p.pause();
        set({ playing: false });
      } else {
        p.play();
        set({ playing: true });
      }
      return;
    }
    p.replace({ uri: track.previewUrl });
    p.play();
    set({ trackId: track.id, playing: true, failed: null });
  } catch {
    set({ trackId: null, playing: false, failed: track.id });
  }
}

export function stopPreview() {
  if (!player || !state.trackId) return;
  try {
    player.pause();
  } catch {}
  set({ trackId: null, playing: false });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True while this track's preview is the one spinning. */
export function useIsPlaying(trackId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.trackId === trackId && state.playing,
    () => false,
  );
}

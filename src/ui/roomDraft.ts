/**
 * The room you're in the middle of decorating. The editor screens all work on
 * this one draft; nothing is saved until you press save.
 *
 * Also home to `chooseSong()`, which opens the song picker and hands back
 * whatever was picked, so any editor screen can ask for a song in one line.
 */
import { useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import type { Person, Room, RoomSection, RoomView } from '@/data/types';
import type { Track } from '@/music';

export type Draft = {
  room: Room;
  /** Every track the draft mentions, including ones picked since opening. */
  tracks: Record<string, Track>;
  people: Record<string, Person>;
  /** Tracks picked in this session, which need saving alongside the room. */
  added: Track[];
  dirty: boolean;
};

let draft: Draft | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());

export const roomDraft = {
  get: () => draft,
  begin(view: RoomView) {
    draft = { room: view.room, tracks: { ...view.tracks }, people: view.people, added: [], dirty: false };
    tell();
  },
  /** Change the room. `change` gets the current room and returns the next one. */
  update(change: (room: Room) => Room) {
    if (!draft) return;
    draft = { ...draft, room: change(draft.room), dirty: true };
    tell();
  },
  /** Change one section, by position. */
  updateSection(index: number, change: (section: RoomSection) => RoomSection) {
    roomDraft.update((room) => ({ ...room, sections: room.sections.map((s, i) => (i === index ? change(s) : s)) }));
  },
  addTrack(track: Track) {
    if (!draft) return;
    draft = { ...draft, tracks: { ...draft.tracks, [track.id]: track }, added: [...draft.added, track] };
    tell();
  },
  clear() {
    draft = null;
    tell();
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useRoomDraft = () => useSyncExternalStore(subscribe, roomDraft.get, roomDraft.get);

// ---- asking for a song -------------------------------------------------------

let waiting: ((track: Track | null) => void) | null = null;

/** Open the song picker. Resolves with the chosen track, or null if they backed out. */
export function chooseSong(prompt: string): Promise<Track | null> {
  waiting?.(null);
  return new Promise((resolve) => {
    waiting = resolve;
    router.push({ pathname: '/pick-song', params: { prompt } });
  });
}

/** Called by the picker screen when a song is chosen or the screen is closed. */
export function answerSong(track: Track | null) {
  waiting?.(track);
  waiting = null;
}

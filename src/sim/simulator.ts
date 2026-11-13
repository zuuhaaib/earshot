/**
 * The neighbourhood, faked.
 *
 * There is no server and nobody else has the app, so the seeded residents
 * wander in and out of whatever area this phone is in, putting songs on,
 * finishing them, and occasionally pressing one on strangers. It drives them
 * through `SimHost`, which writes the same rows a real person's listening
 * would. Delete this file the day there are real people.
 */
import type { Opener, Taste } from '@/seed/listeners';

export interface SimHost {
  /** Seeded residents the simulation may move around (never whoever is signed in). */
  simPeople(): Promise<string[]>;
  presences(): Promise<{ userId: string; areaId: string; until: number }[]>;
  setPresence(userId: string, areaId: string, until: number): Promise<void>;
  clearPresence(userId: string): Promise<void>;
  openPlay(userId: string): Promise<{ trackId: string; startedAt: number } | null>;
  lastTrack(userId: string): Promise<string | null>;
  recordPlay(play: {
    userId: string;
    trackId: string;
    kind: 'play' | 'share';
    note: string | null;
    areaId: string;
    startedAt: number;
    endedAt: number | null;
  }): Promise<void>;
  endOpenPlays(userId: string, at: number): Promise<void>;

  /** Whoever's signed in, if it's an account made on this phone, and what they're sharing. */
  viewer(): Promise<{ id: string; onAir: { since: number; title: string; artist: string } | null } | null>;
  socialState(viewerId: string): Promise<{
    knows: string[];
    received: number;
    lastReceivedAt: number | null;
    unanswered: number;
    awaitingReply: { chatId: string; fromId: string; acceptedAt: number }[];
  }>;
  sendSongAs(fromId: string, toId: string, trackId: string, note: string): Promise<void>;
  sayAs(chatId: string, fromId: string, body: string): Promise<void>;
}

const MIN = 60_000;

/** Small, fast, seedable random numbers (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How long a track "lasts" in the simulation: 2.5 to 4.5 minutes, fixed per track. */
export function trackLength(trackId: string) {
  let h = 0;
  for (let i = 0; i < trackId.length; i++) h = (h * 31 + trackId.charCodeAt(i)) | 0;
  return 150_000 + ((h >>> 0) % 120_000);
}

export class Simulator {
  private shared = new Set<string>();

  constructor(
    private host: SimHost,
    private tastes: Record<string, Taste>,
    private rand: () => number = Math.random,
    private openers: Record<string, Opener> = {},
  ) {}

  private pick<T>(list: T[]): T {
    return list[Math.floor(this.rand() * list.length)];
  }

  private nextTrack(userId: string, not: string | null): string | null {
    const options = (this.tastes[userId]?.plays ?? []).filter((t) => t !== not);
    return options.length ? this.pick(options) : null;
  }

  private nextShare(userId: string) {
    const options = (this.tastes[userId]?.shares ?? []).filter((s) => !this.shared.has(`${userId}:${s.trackId}`));
    return options.length ? this.pick(options) : null;
  }

  private async play(userId: string, areaId: string, startedAt: number, endedAt: number | null, not: string | null) {
    const trackId = this.nextTrack(userId, not);
    if (!trackId) return;
    await this.host.recordPlay({ userId, trackId, kind: 'play', note: null, areaId, startedAt, endedAt });
  }

  private async share(userId: string, areaId: string, at: number): Promise<boolean> {
    const s = this.nextShare(userId);
    if (!s) return false;
    this.shared.add(`${userId}:${s.trackId}`);
    await this.host.recordPlay({ userId, trackId: s.trackId, kind: 'share', note: s.note, areaId, startedAt: at, endedAt: at });
    return true;
  }

  /** Move the neighbourhood on to `now`, as seen from `areaId`. Safe to call as often as you like. */
  async tick(areaId: string, now: number): Promise<void> {
    const movable = new Set(await this.host.simPeople());
    const all = await this.host.presences();

    // People whose time is up (anywhere) pack up and go.
    for (const p of all) {
      if (p.until <= now || !movable.has(p.userId)) {
        if (movable.has(p.userId)) await this.host.endOpenPlays(p.userId, Math.min(p.until, now));
        await this.host.clearPresence(p.userId);
      }
    }
    const still = all.filter((p) => p.until > now && movable.has(p.userId));
    const here = still.filter((p) => p.areaId === areaId);
    const elsewhere = new Set(still.filter((p) => p.areaId !== areaId).map((p) => p.userId));

    // Those already here get on with their listening.
    for (const p of here) {
      const open = await this.host.openPlay(p.userId);
      if (open) {
        const length = trackLength(open.trackId);
        if (now - open.startedAt < length) continue; // still mid-song
        await this.host.endOpenPlays(p.userId, Math.min(now, open.startedAt + length));
        const roll = this.rand();
        if (roll < 0.5) await this.play(p.userId, areaId, now - Math.floor(this.rand() * 20_000), null, open.trackId);
        else if (roll < 0.6) await this.share(p.userId, areaId, now);
        // otherwise: headphones off for a bit
      } else {
        const roll = this.rand();
        // a quiet spell lasts a few minutes on average, so the street is about half mid-song
        if (roll < 0.04) await this.play(p.userId, areaId, now, null, await this.host.lastTrack(p.userId));
        else if (roll < 0.05) await this.share(p.userId, areaId, now);
      }
    }

    // New arrivals. An empty street fills up at once; after that people drift in.
    const fresh = here.length === 0;
    const target = fresh ? 9 + Math.floor(this.rand() * 4) : 8 + (Math.floor(now / (10 * MIN)) % 5);
    const want = fresh ? target : Math.min(Math.max(0, target - here.length), 2);
    const hereIds = new Set(here.map((p) => p.userId));
    const absent = [...movable].filter((id) => !hereIds.has(id) && !elsewhere.has(id));

    for (let i = 0; i < want && absent.length; i++) {
      const userId = absent.splice(Math.floor(this.rand() * absent.length), 1)[0];
      await this.host.setPresence(userId, areaId, now + Math.floor((10 + this.rand() * 35) * MIN));
      await this.host.endOpenPlays(userId, now);

      if (!fresh) {
        // walks in mid-song
        await this.play(userId, areaId, now - Math.floor(this.rand() * 60_000), null, null);
        continue;
      }
      // First look at a street: some mid-song, some just finished, some who left a note.
      const roll = this.rand();
      if (roll < 0.4) {
        await this.play(userId, areaId, now - Math.floor(this.rand() * 140_000), null, null);
      } else if (roll < 0.8 || !(await this.share(userId, areaId, now - Math.floor((3 + this.rand() * 55) * MIN)))) {
        const ended = now - Math.floor((2 + this.rand() * 48) * MIN);
        await this.play(userId, areaId, ended - 200_000, ended, null);
      }
    }

    await this.social(areaId, now);
  }

  /**
   * Residents noticing you. If you're on air with a song, someone nearby will
   * eventually send you one; if you accept, they say one thing back. That's
   * the extent of their conversation: there's nobody actually there.
   */
  private async social(areaId: string, now: number): Promise<void> {
    const viewer = await this.host.viewer();
    if (!viewer) return;
    const state = await this.host.socialState(viewer.id);

    for (const chat of state.awaitingReply) {
      const line = this.openers[chat.fromId]?.afterAccept;
      if (line && now - chat.acceptedAt >= 6_000) await this.host.sayAs(chat.chatId, chat.fromId, line);
    }

    const onAir = viewer.onAir;
    if (!onAir || now - onAir.since < 40_000) return; // give them a moment to notice
    if (state.unanswered > 0 || state.received >= 4) return; // never a pile-up
    if (state.lastReceivedAt !== null && now - state.lastReceivedAt < 25 * MIN) return;

    const here = (await this.host.presences()).filter((p) => p.areaId === areaId && p.until > now).map((p) => p.userId);
    const keen = here.filter((id) => this.openers[id] && !state.knows.includes(id));
    if (!keen.length) return;
    const from = this.pick(keen);
    const opener = this.openers[from];
    const note = opener.note.replace('{title}', onAir.title).replace('{artist}', onAir.artist);
    await this.host.sendSongAs(from, viewer.id, opener.trackId, note);
  }
}

/**
 * earshot with no server: everything lives in SQLite on this phone.
 *
 * Implements the same `EarshotApi` a real backend will, plus `SimHost`, the
 * side door the neighbourhood simulation uses to act as the seeded residents.
 */
import type { Track } from '@/music/types';
import { borrowable, openers, residents, tastes } from '@/seed/listeners';
import { seedPosts } from '@/seed/posts';
import { seedRooms, starterRoom } from '@/seed/rooms';
import { seedThreads } from '@/seed/threads';
import seedTracks from '@/seed/tracks.json';
import { Simulator, type SimHost } from '@/sim/simulator';
import { AuthError, SendError, type EarshotApi, type Topic } from '../api';
import { areaById, cities, REGION } from '../areas';
import type {
  AdoptedAccount,
  ArtistHeat,
  ArtistSpace,
  Chat,
  ChatMessage,
  ChatSummary,
  CityFeed,
  CityPost,
  GuestbookEntry,
  Inbox,
  Link,
  NewAccount,
  Person,
  ProfileEdit,
  ReportContext,
  ReportReason,
  Room,
  RoomView,
  SendOutcome,
  Session,
  Sighting,
  SongRequest,
  Thread,
  ThreadReply,
  ThreadSummary,
} from '../types';
import type { SqlDriver, SqlValue } from './driver';
import { ALL_TABLES, migrations } from './schema';
import { noSecurity, type Security } from './security';

const SEED_VERSION = '8';
/** Marks seeded listening history: counts as listening, but isn't anywhere, so it's never Nearby. */
const HISTORY = 'history';
/** How far back Nearby looks. Older than this and you've left earshot. */
const NEARBY_WINDOW = 2 * 60 * 60 * 1000;
const MIN_PASSWORD = 8;
/** How many times a password is re-hashed. Slows down guessing without making log-in drag. */
const HASH_ROUNDS = 40;
/** Wrong guesses allowed before a handle is locked for a short while. */
const MAX_TRIES = 5;
const LOCKOUT_MS = 30_000;
/** How far back a city's "getting attention" list looks. */
const TRENDING_WINDOW = 7 * 24 * 60 * 60 * 1000;

type UserRow = {
  id: string;
  name: string;
  handle: string;
  badge: string;
  badge_color: string;
  tagline: string;
  bio: string;
  home_city: string;
  seeded: number;
  sharing: number;
};
type TrackRow = {
  track_id: string;
  source_id: string;
  title: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string;
  artwork_url: string;
  preview_url: string | null;
};

type RequestRow = {
  id: number;
  from_id: string;
  to_id: string;
  track_id: string;
  note: string | null;
  about_track_id: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: number;
  answered_at: number | null;
};

type ThreadRow = {
  id: number;
  artist_key: string;
  artist: string;
  city: string;
  user_id: string;
  title: string;
  body: string;
  created_at: number;
};

const TRACK_COLS =
  't.id AS track_id, t.source_id, t.title, t.artist, t.album, t.year, t.genre, t.artwork_url, t.preview_url';

const toPerson = (r: UserRow): Person => ({
  id: r.id,
  name: r.name,
  handle: r.handle,
  badge: r.badge,
  badgeColor: r.badge_color,
  tagline: r.tagline,
  bio: r.bio,
  homeCity: r.home_city,
  seeded: !!r.seeded,
});
const toTrack = (r: TrackRow): Track => ({
  id: r.track_id,
  sourceId: r.source_id,
  title: r.title,
  artist: r.artist,
  album: r.album,
  year: r.year,
  genre: r.genre,
  artworkUrl: r.artwork_url,
  previewUrl: r.preview_url,
});

export class LocalApi implements EarshotApi, SimHost {
  readonly kind = 'phone' as const;
  private listeners = new Map<Topic, Set<() => void>>();
  private queue: Promise<unknown> = Promise.resolve();
  private sim: Simulator;
  private lockouts = new Map<string, { fails: number; until: number }>();

  constructor(
    private db: SqlDriver,
    private now: () => number = Date.now,
    rand: () => number = Math.random,
    private security: Security = noSecurity,
  ) {
    this.sim = new Simulator(this, tastes, rand, openers);
  }

  // ---- plumbing -----------------------------------------------------------

  /** Writes run one at a time, each in a transaction, so nothing interleaves. */
  private write<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      let result!: T;
      await this.db.transaction(async () => {
        result = await task();
      });
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }

  private emit(...topics: Topic[]) {
    for (const t of topics) this.listeners.get(t)?.forEach((l) => l());
  }

  subscribe(topic: Topic, listener: () => void) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic)!.add(listener);
    return () => {
      this.listeners.get(topic)?.delete(listener);
    };
  }

  private async meta(key: string): Promise<string | null> {
    const rows = await this.db.all<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
    return rows[0]?.value ?? null;
  }
  private async setMeta(key: string, value: string | null) {
    if (value === null) await this.db.run('DELETE FROM meta WHERE key = ?', [key]);
    else await this.db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
  }

  private async putTrack(t: Track) {
    await this.db.run(
      `INSERT OR REPLACE INTO tracks (id, source_id, title, artist, album, year, genre, artwork_url, preview_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.sourceId, t.title, t.artist, t.album, t.year, t.genre, t.artworkUrl, t.previewUrl],
    );
  }

  private async meId(): Promise<string> {
    const id = await this.meta('current_user');
    if (!id) throw new Error('Nobody is signed in.');
    return id;
  }

  // ---- setup --------------------------------------------------------------

  /** Create or upgrade the database and move the residents in. Call once at launch. */
  async init(): Promise<void> {
    await this.db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await this.write(async () => {
      const done = Number((await this.meta('schema_version')) ?? 0);
      for (let v = done; v < migrations.length; v++) await this.db.exec(migrations[v]);
      await this.setMeta('schema_version', String(migrations.length));

      if ((await this.meta('seed_version')) !== SEED_VERSION) {
        for (const t of Object.values(seedTracks as Record<string, Track>)) await this.putTrack(t);
        const at = this.now();
        for (const p of residents) {
          await this.db.run(
            `INSERT OR REPLACE INTO users
               (id, name, handle, badge, badge_color, tagline, bio, home_city, seeded, sharing, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
            [p.id, p.name, p.handle, p.badge, p.badgeColor, p.tagline, p.bio, p.homeCity, at],
          );
        }
        // Residents' rooms are (re)hung on every reseed; rooms made on this phone are left alone.
        for (const room of seedRooms) await this.storeRoom(room);
        // A week of listening history, so rooms have a "recently played" and cities have a chart
        // from the first launch. It carries a marker instead of a real area, so it never shows in Nearby.
        await this.db.run('DELETE FROM plays WHERE area_id = ?', [HISTORY]);
        for (const p of residents) {
          const plays = tastes[p.id]?.plays ?? [];
          for (let i = 0; i < plays.length * 2; i++) {
            const trackId = plays[i % plays.length]; // everything in their rotation, twice
            const ago = (3 + ((p.id.charCodeAt(0) * 7 + i * 19) % 150)) * 60 * 60_000 + i * 240_000;
            await this.db.run(
              "INSERT INTO plays (user_id, track_id, kind, note, area_id, started_at, ended_at) VALUES (?, ?, 'play', NULL, ?, ?, ?)",
              [p.id, trackId, HISTORY, at - ago, at - ago + 200_000],
            );
          }
        }
        // The city feeds: residents' posts, dated back from now (and a few dated forward, to arrive later).
        await this.db.run('DELETE FROM posts WHERE seeded = 1');
        const homes = new Map(residents.map((r) => [r.id, r.homeCity]));
        for (const p of seedPosts) {
          await this.db.run('INSERT INTO posts (user_id, track_id, note, city, created_at, seeded) VALUES (?, ?, ?, ?, ?, 1)', [
            p.by,
            p.trackId,
            p.note,
            homes.get(p.by) ?? 'Toronto',
            at - p.minutesAgo * 60_000,
          ]);
        }
        // Artists' rooms: the residents' threads. Replies written on this phone to a seeded thread are
        // dropped with it on a reseed, which only happens when the app's seed content changes.
        await this.db.run('DELETE FROM replies WHERE thread_id IN (SELECT id FROM threads WHERE seeded = 1)');
        await this.db.run('DELETE FROM threads WHERE seeded = 1');
        const catalogue = seedTracks as Record<string, Track>;
        const HOUR = 60 * 60_000;
        for (const th of seedThreads) {
          const artist = catalogue[th.artistOf]?.artist;
          if (!artist) continue;
          const started = at - th.daysAgo * 24 * HOUR;
          await this.db.run(
            'INSERT INTO threads (artist_key, artist, city, user_id, title, body, created_at, seeded) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
            [artist.toLowerCase(), artist, homes.get(th.by) ?? 'Toronto', th.by, th.title, th.body, started],
          );
          const threadId = (await this.db.all<{ id: number }>('SELECT last_insert_rowid() AS id'))[0].id;
          for (const r of th.replies) {
            const when = r.inMinutes !== undefined ? at + r.inMinutes * 60_000 : Math.min(at - 60_000, started + (r.after ?? 1) * HOUR);
            await this.db.run('INSERT INTO replies (thread_id, user_id, body, track_id, created_at, seeded) VALUES (?, ?, ?, ?, ?, 1)', [
              threadId,
              r.by,
              r.body,
              r.trackId ?? null,
              when,
            ]);
          }
        }
        await this.setMeta('seed_version', SEED_VERSION);
      }
    });
  }

  async resetEverything(): Promise<void> {
    await this.write(async () => {
      for (const t of ALL_TABLES) await this.db.exec(`DROP TABLE IF EXISTS ${t}`);
    });
    await this.init();
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
  }

  // ---- who's holding the phone -------------------------------------------

  async getPerson(id: string): Promise<Person | null> {
    const rows = await this.db.all<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] ? toPerson(rows[0]) : null;
  }

  async getSession(): Promise<Session> {
    const meId = await this.meta('current_user');
    const areaId = await this.meta('area_id');
    const source = (await this.meta('area_source')) as Session['areaSource'];
    const area = areaId ? areaById(areaId) : null;
    if (!meId) return { me: null, sharing: false, area, areaSource: source, nowPlaying: null, needsPassword: false, needsProfile: false };

    const rows = await this.db.all<UserRow & { pass_hash: string | null }>('SELECT * FROM users WHERE id = ?', [meId]);
    if (!rows[0]) return { me: null, sharing: false, area, areaSource: source, nowPlaying: null, needsPassword: false, needsProfile: false };

    const open = await this.db.all<TrackRow & { note: string | null; started_at: number }>(
      `SELECT ${TRACK_COLS}, p.note, p.started_at FROM plays p JOIN tracks t ON t.id = p.track_id
       WHERE p.user_id = ? AND p.ended_at IS NULL ORDER BY p.started_at DESC, p.id DESC LIMIT 1`,
      [meId],
    );
    return {
      me: toPerson(rows[0]),
      sharing: !!rows[0].sharing,
      area,
      areaSource: source,
      nowPlaying: open[0] ? { track: toTrack(open[0]), note: open[0].note, since: open[0].started_at } : null,
      needsPassword: !rows[0].seeded && !rows[0].pass_hash,
      needsProfile: false,
    };
  }

  async listAccounts(): Promise<Person[]> {
    const marks = borrowable.map(() => '?').join(', ');
    const rows = await this.db.all<UserRow>(
      // Your accounts, the residents on loan, and any resident you have exchanged a song with.
      `SELECT * FROM users WHERE seeded = 0 OR id IN (${marks})
         OR id IN (SELECT r.from_id FROM requests r JOIN users o ON o.id = r.to_id WHERE o.seeded = 0)
         OR id IN (SELECT r.to_id FROM requests r JOIN users o ON o.id = r.from_id WHERE o.seeded = 0)
       ORDER BY seeded ASC, created_at ASC, name ASC`,
      borrowable,
    );
    return rows.map(toPerson);
  }

  /** Salted, stretched hash. The password itself is never stored anywhere. */
  private async hashPassword(password: string, salt: string): Promise<string> {
    let h = '';
    for (let i = 0; i < HASH_ROUNDS; i++) h = await this.security.digest(`${salt}:${password}:${h}`);
    return h;
  }

  private async storePassword(userId: string, password: string) {
    const salt = this.security.salt();
    const hash = await this.hashPassword(password, salt);
    await this.db.run('UPDATE users SET pass_salt = ?, pass_hash = ? WHERE id = ?', [salt, hash, userId]);
  }

  private static cleanHandle(handle: string) {
    return handle
      .trim()
      .toLowerCase()
      .replace(/^@+/, '')
      .replace(/[^a-z0-9._]+/g, '.')
      .replace(/^\.+|\.+$/g, '');
  }

  async createAccount(input: NewAccount): Promise<Person> {
    const name = input.name.trim();
    if (!name) throw new Error('A name is needed.');
    const handle = LocalApi.cleanHandle(input.handle);
    if (handle.length < 2) throw new AuthError('bad-handle');
    if (input.password.length < MIN_PASSWORD) throw new AuthError('weak-password');
    const id = `u_${this.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const salt = this.security.salt();
    const hash = await this.hashPassword(input.password, salt);

    await this.write(async () => {
      // The handle is what you log in with, so it has to be yours alone.
      const clash = await this.db.all('SELECT 1 FROM users WHERE handle = ?', [handle]);
      if (clash.length) throw new AuthError('handle-taken');
      await this.db.run(
        `INSERT INTO users (id, name, handle, badge, badge_color, tagline, bio, home_city, seeded, sharing, created_at, pass_salt, pass_hash)
         VALUES (?, ?, ?, ?, ?, '', '', ?, 0, 0, ?, ?, ?)`,
        [id, name, handle, input.badge.trim().slice(0, 2).toUpperCase() || '?', input.badgeColor, input.homeCity, this.now(), salt, hash],
      );
      await this.setMeta('current_user', id);
    });
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
    return (await this.getPerson(id))!;
  }

  async logIn(handle: string, password: string): Promise<Person> {
    const key = LocalApi.cleanHandle(handle);
    const lock = this.lockouts.get(key);
    if (lock && lock.until > this.now()) throw new AuthError('locked');

    const rows = await this.db.all<UserRow & { pass_salt: string | null; pass_hash: string | null }>(
      'SELECT * FROM users WHERE handle = ?',
      [key],
    );
    const user = rows[0];
    if (!user) throw new AuthError('no-such-account');
    // Residents are test accounts with no password; they're borrowed from the switcher instead.
    if (user.seeded) throw new AuthError('resident');

    if (!user.pass_hash || !user.pass_salt) {
      // An account made before passwords existed: the first log-in sets its password.
      if (password.length < MIN_PASSWORD) throw new AuthError('weak-password');
      await this.write(() => this.storePassword(user.id, password));
    } else if ((await this.hashPassword(password, user.pass_salt)) !== user.pass_hash) {
      const fails = (lock?.fails ?? 0) + 1;
      this.lockouts.set(key, { fails, until: fails >= MAX_TRIES ? this.now() + LOCKOUT_MS : 0 });
      throw new AuthError(fails >= MAX_TRIES ? 'locked' : 'wrong-password');
    }
    this.lockouts.delete(key);
    await this.write(() => this.setMeta('current_user', user.id));
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
    return toPerson(user);
  }

  async signIn(userId: string): Promise<void> {
    const person = await this.getPerson(userId);
    if (!person) throw new AuthError('no-such-account');
    // Only the seeded residents can be borrowed. Real accounts need their password.
    if (!person.seeded) throw new AuthError('password-needed');
    await this.write(() => this.setMeta('current_user', userId));
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
  }

  async changePassword(current: string | null, next: string): Promise<void> {
    const me = await this.meId();
    if (next.length < MIN_PASSWORD) throw new AuthError('weak-password');
    const row = (await this.db.all<{ pass_salt: string | null; pass_hash: string | null; seeded: number }>(
      'SELECT pass_salt, pass_hash, seeded FROM users WHERE id = ?',
      [me],
    ))[0];
    if (row.seeded) throw new AuthError('resident');
    if (row.pass_hash && row.pass_salt) {
      if (current === null || (await this.hashPassword(current, row.pass_salt)) !== row.pass_hash) throw new AuthError('wrong-password');
    }
    await this.write(() => this.storePassword(me, next));
    this.emit('session');
  }

  async adoptAccount(a: AdoptedAccount): Promise<void> {
    await this.write(async () => {
      const mine = await this.db.all<{ seeded: number }>('SELECT seeded FROM users WHERE id = ?', [a.id]);
      if (mine[0]?.seeded) throw new AuthError('resident');
      // Another row may be squatting on the handle (an old phone-only account, say). The backend's word wins.
      await this.db.run("UPDATE users SET handle = handle || '.old' WHERE handle = ? AND id != ?", [a.handle, a.id]);
      if (mine.length) {
        await this.db.run(
          'UPDATE users SET name = ?, handle = ?, badge = ?, badge_color = ?, tagline = ?, bio = ?, home_city = ? WHERE id = ?',
          [a.name, a.handle, a.badge, a.badgeColor, a.tagline, a.bio, a.homeCity, a.id],
        );
      } else {
        await this.db.run(
          `INSERT INTO users (id, name, handle, badge, badge_color, tagline, bio, home_city, seeded, sharing, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
          [a.id, a.name, a.handle, a.badge, a.badgeColor, a.tagline, a.bio, a.homeCity, this.now()],
        );
      }
      await this.setMeta('current_user', a.id);
    });
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
  }

  async moveAccountData(fromId: string, toId: string): Promise<void> {
    if (fromId === toId) return;
    await this.write(async () => {
      const from = (await this.db.all<UserRow>('SELECT * FROM users WHERE id = ?', [fromId]))[0];
      const to = (await this.db.all<UserRow>('SELECT * FROM users WHERE id = ?', [toId]))[0];
      if (!from || !to) throw new AuthError('no-such-account');
      if (from.seeded || to.seeded) throw new AuthError('resident');

      // Everything that points at the old account now points at the new one.
      for (const [table, column] of [
        ['plays', 'user_id'],
        ['requests', 'from_id'],
        ['requests', 'to_id'],
        ['messages', 'from_id'],
        ['posts', 'user_id'],
        ['threads', 'user_id'],
        ['replies', 'user_id'],
      ] as const) {
        await this.db.run(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [toId, fromId]);
      }
      // Tables keyed by person: the new account's own rows (there shouldn't be any yet) give way.
      await this.db.run('DELETE FROM saves WHERE user_id = ? AND track_id IN (SELECT track_id FROM saves WHERE user_id = ?)', [toId, fromId]);
      await this.db.run('UPDATE saves SET user_id = ? WHERE user_id = ?', [toId, fromId]);
      await this.db.run('DELETE FROM chat_reads WHERE user_id = ? AND request_id IN (SELECT request_id FROM chat_reads WHERE user_id = ?)', [toId, fromId]);
      await this.db.run('UPDATE chat_reads SET user_id = ? WHERE user_id = ?', [toId, fromId]);

      // The room moves in whole, and guestbooks they signed elsewhere get the new name on them.
      const old = await this.loadRoom(fromId);
      if (old) {
        await this.db.run('DELETE FROM rooms WHERE user_id IN (?, ?)', [fromId, toId]);
        await this.storeRoom({ ...old, personId: toId });
      }
      const others = await this.db.all<{ user_id: string; doc: string }>('SELECT user_id, doc FROM rooms WHERE doc LIKE ?', [`%${fromId}%`]);
      for (const row of others) {
        if (row.user_id === toId) continue;
        const room = await this.loadRoom(row.user_id);
        if (!room) continue;
        for (const section of room.sections) {
          if (section.kind === 'guestbook') section.entries = section.entries.map((e) => (e.fromId === fromId ? { ...e, fromId: toId } : e));
        }
        await this.storeRoom(room);
      }

      // What they were sharing carries over; then the old account goes.
      await this.db.run('UPDATE users SET sharing = ?, tagline = CASE WHEN tagline = \'\' THEN ? ELSE tagline END, bio = CASE WHEN bio = \'\' THEN ? ELSE bio END WHERE id = ?', [
        from.sharing,
        from.tagline,
        from.bio,
        toId,
      ]);
      await this.db.run('DELETE FROM users WHERE id = ?', [fromId]);
      if ((await this.meta('current_user')) === fromId) await this.setMeta('current_user', toId);
    });
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
  }

  /**
   * What an account made on this phone has that's worth carrying to the backend:
   * its room, the tracks that room mentions, its crate and its profile lines.
   * Null if there's no such account or it never changed anything.
   */
  async exportPhoneAccount(): Promise<{ person: Person; room: Room; tracks: Track[]; crate: Track[] } | null> {
    // accounts made on this phone have ids starting "u_"; ones adopted from the backend have UUIDs
    const rows = await this.db.all<UserRow>('SELECT * FROM users WHERE seeded = 0 ORDER BY created_at DESC');
    const row = rows.find((r) => r.id.startsWith('u_'));
    if (!row) return null;
    const room = await this.loadRoom(row.id);
    const crateRows = await this.db.all<TrackRow>(
      `SELECT ${TRACK_COLS} FROM saves s JOIN tracks t ON t.id = s.track_id WHERE s.user_id = ? ORDER BY s.saved_at ASC`,
      [row.id],
    );
    if (!room && !crateRows.length) return null;
    const view = room ? await this.getRoom(row.id) : null;
    return {
      person: toPerson(row),
      room: room ?? starterRoom(row.id),
      tracks: view ? Object.values(view.tracks) : [],
      crate: crateRows.map(toTrack),
    };
  }

  async signOut(): Promise<void> {
    await this.write(() => this.setMeta('current_user', null));
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
  }

  // ---- sharing and place --------------------------------------------------

  async setSharing(on: boolean): Promise<void> {
    const me = await this.meId();
    const area = await this.meta('area_id');
    await this.write(async () => {
      await this.db.run('UPDATE users SET sharing = ? WHERE id = ?', [on ? 1 : 0, me]);
      if (!on) {
        // Off air means gone: pull every recent trace of you out of Nearby.
        await this.db.run('UPDATE plays SET area_id = NULL WHERE user_id = ? AND area_id IS NOT NULL', [me]);
      } else if (area) {
        await this.db.run('UPDATE plays SET area_id = ? WHERE user_id = ? AND ended_at IS NULL', [area, me]);
      }
    });
    this.emit('session', 'nearby');
  }

  async setArea(areaId: string, source: 'gps' | 'picked'): Promise<void> {
    const meId = await this.meta('current_user');
    await this.write(async () => {
      await this.setMeta('area_id', areaId);
      await this.setMeta('area_source', source);
      if (meId) {
        // What you've got on moves with you, if you're sharing.
        await this.db.run(
          `UPDATE plays SET area_id = ? WHERE user_id = ? AND ended_at IS NULL
             AND (SELECT sharing FROM users WHERE id = ?) = 1`,
          [areaId, meId, meId],
        );
      }
    });
    this.emit('session', 'nearby');
  }

  // ---- listening ----------------------------------------------------------

  async setNowPlaying(track: Track | null, note?: string | null): Promise<void> {
    const me = await this.meId();
    const at = this.now();
    const text = note?.trim() || null;
    await this.write(async () => {
      await this.db.run('UPDATE plays SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL', [at, me]);
      if (!track) return;
      await this.putTrack(track);
      const sharing = (await this.db.all<{ sharing: number }>('SELECT sharing FROM users WHERE id = ?', [me]))[0]?.sharing;
      const area = sharing ? await this.meta('area_id') : null;
      await this.db.run(
        'INSERT INTO plays (user_id, track_id, kind, note, area_id, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
        [me, track.id, text ? 'share' : 'play', text, area, at],
      );
    });
    this.emit('session', 'nearby');
  }

  // ---- nearby -------------------------------------------------------------

  async getNearby(): Promise<Sighting[]> {
    const area = await this.meta('area_id');
    if (!area) return [];
    const me = (await this.meta('current_user')) ?? '';
    const now = this.now();
    const since = now - NEARBY_WINDOW;

    type Row = UserRow &
      TrackRow & { kind: 'play' | 'share'; note: string | null; started_at: number; ended_at: number | null; saved: number };
    const rows = await this.db.all<Row>(
      `SELECT u.*, ${TRACK_COLS}, p.kind, p.note, p.started_at, p.ended_at,
              EXISTS (SELECT 1 FROM saves s WHERE s.user_id = ? AND s.track_id = t.id) AS saved
       FROM plays p
       JOIN users u ON u.id = p.user_id
       JOIN tracks t ON t.id = p.track_id
       WHERE p.area_id = ? AND p.user_id != ? AND p.started_at > ? AND u.sharing = 1
         AND p.id = (
           SELECT p2.id FROM plays p2
           WHERE p2.user_id = p.user_id AND p2.area_id = ? AND p2.started_at > ?
           ORDER BY p2.started_at DESC, p2.id DESC LIMIT 1
         )`,
      [me, area, me, since, area, since],
    );

    const links = await this.links(me);
    const hidden = await this.blockedIds(me);
    const minutes = (t: number) => Math.max(0, Math.round((now - t) / 60_000));
    const sightings = rows.filter((r) => !hidden.has(r.id)).map((r): Sighting & { at: number } => {
      const status = r.kind === 'share' ? 'shared' : r.ended_at === null ? 'playing' : 'played';
      const at = status === 'played' ? r.ended_at! : r.started_at;
      return {
        id: r.id,
        person: toPerson(r),
        track: toTrack(r),
        status,
        minutesAgo: status === 'playing' ? 0 : minutes(at),
        note: r.kind === 'share' ? r.note : null,
        saved: !!r.saved,
        link: links.get(r.id) ?? { kind: 'none' },
        at,
      };
    });
    // Whoever's mid-song comes first, then most recent.
    sightings.sort((a, b) => Number(b.status === 'playing') - Number(a.status === 'playing') || b.at - a.at);
    return sightings.map(({ at: _at, ...s }) => s);
  }

  private ticking: Promise<void> | null = null;

  refreshNearby(): Promise<void> {
    // Two screens asking at once share one tick; overlapping ticks would both
    // think the street was empty and fill it twice.
    this.ticking ??= (async () => {
      try {
        const area = await this.meta('area_id');
        if (!area) return;
        await this.sim.tick(area, this.now());
        this.emit('nearby');
      } finally {
        this.ticking = null;
      }
    })();
    return this.ticking;
  }

  // ---- sending songs and the chats that follow ----------------------------

  /** Where things stand between `me` and everyone they've exchanged a song with. */
  private async links(me: string): Promise<Map<string, Link>> {
    const rows = await this.db.all<{ id: number; from_id: string; to_id: string; status: string }>(
      'SELECT id, from_id, to_id, status FROM requests WHERE from_id = ? OR to_id = ? ORDER BY id ASC',
      [me, me],
    );
    const rank = { none: 0, sent: 1, incoming: 2, chat: 3 } as const;
    const out = new Map<string, Link>();
    for (const r of rows) {
      const other = r.from_id === me ? r.to_id : r.from_id;
      let link: Link;
      if (r.status === 'accepted') link = { kind: 'chat', id: String(r.id) };
      // Pending and declined look identical to the sender. That's the point.
      else if (r.from_id === me) link = { kind: 'sent', id: String(r.id) };
      else if (r.status === 'pending') link = { kind: 'incoming', id: String(r.id) };
      else continue; // one you declined: as far as you're concerned, nothing
      const had = out.get(other);
      if (!had || rank[link.kind] >= rank[had.kind]) out.set(other, link);
    }
    return out;
  }

  private async trackById(id: string | null): Promise<Track | null> {
    if (!id) return null;
    const rows = await this.db.all<TrackRow>(`SELECT ${TRACK_COLS} FROM tracks t WHERE t.id = ?`, [id]);
    return rows[0] ? toTrack(rows[0]) : null;
  }

  private async requests(where: string, params: SqlValue[]): Promise<SongRequest[]> {
    const rows = await this.db.all<RequestRow>(`SELECT * FROM requests WHERE ${where}`, params);
    const out: SongRequest[] = [];
    for (const r of rows) {
      const from = await this.getPerson(r.from_id);
      const to = await this.getPerson(r.to_id);
      const track = await this.trackById(r.track_id);
      const about = await this.trackById(r.about_track_id);
      if (from && to && track) out.push({ id: String(r.id), from, to, track, note: r.note, about, sentAt: r.created_at });
    }
    return out;
  }

  /** Inside a write: add a request, noting what the recipient had on at the time. */
  private async insertRequest(fromId: string, toId: string, trackId: string, note: string | null, at: number) {
    const on = await this.db.all<{ track_id: string }>(
      `SELECT track_id FROM plays WHERE user_id = ? AND area_id IS NOT NULL AND started_at > ?
       ORDER BY started_at DESC, id DESC LIMIT 1`,
      [toId, at - NEARBY_WINDOW],
    );
    await this.db.run(
      'INSERT INTO requests (from_id, to_id, track_id, note, about_track_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [fromId, toId, trackId, note, on[0]?.track_id ?? null, at],
    );
    const row = await this.db.all<{ id: number }>('SELECT last_insert_rowid() AS id');
    return String(row[0].id);
  }

  private async markRead(chatId: string, userId: string, at: number) {
    await this.db.run('INSERT OR REPLACE INTO chat_reads (request_id, user_id, read_at) VALUES (?, ?, ?)', [
      Number(chatId),
      userId,
      at,
    ]);
  }

  async sendSong(toId: string, track: Track, note?: string | null): Promise<SendOutcome> {
    const me = await this.meId();
    if (toId === me) throw new SendError('self');
    if (!(await this.getPerson(toId))) throw new SendError('unknown-person');
    if ((await this.blockedIds(me)).has(toId)) throw new SendError('unknown-person');
    const link = (await this.links(me)).get(toId) ?? { kind: 'none' };
    if (link.kind === 'sent') throw new SendError('already-sent');
    if (link.kind === 'incoming') throw new SendError('they-sent-first');

    const text = note?.trim() || null;
    const at = this.now();
    if (link.kind === 'chat') {
      // Already talking: the song goes into the conversation.
      await this.write(async () => {
        await this.putTrack(track);
        await this.db.run('INSERT INTO messages (request_id, from_id, body, track_id, created_at) VALUES (?, ?, ?, ?, ?)', [
          Number(link.id),
          me,
          text,
          track.id,
          at,
        ]);
        await this.markRead(link.id, me, at);
      });
      this.emit('inbox');
      return { kind: 'chat', id: link.id };
    }

    let id = '';
    await this.write(async () => {
      await this.putTrack(track);
      id = await this.insertRequest(me, toId, track.id, text, at);
    });
    this.emit('inbox', 'nearby');
    return { kind: 'request', id };
  }

  async answerSong(requestId: string, accept: boolean): Promise<void> {
    const me = await this.meId();
    const at = this.now();
    await this.write(async () => {
      const rows = await this.db.all<RequestRow>("SELECT * FROM requests WHERE id = ? AND to_id = ? AND status = 'pending'", [
        Number(requestId),
        me,
      ]);
      if (!rows[0]) throw new Error('That song is not waiting for an answer.');
      await this.db.run('UPDATE requests SET status = ?, answered_at = ? WHERE id = ?', [
        accept ? 'accepted' : 'declined',
        at,
        Number(requestId),
      ]);
      if (accept) await this.markRead(requestId, me, at);
    });
    this.emit('inbox', 'nearby');
  }

  private async chatSummaries(me: string): Promise<ChatSummary[]> {
    const rows = await this.db.all<RequestRow>(
      "SELECT * FROM requests WHERE status = 'accepted' AND (from_id = ? OR to_id = ?)",
      [me, me],
    );
    const out: (ChatSummary & { at: number })[] = [];
    for (const r of rows) {
      const other = await this.getPerson(r.from_id === me ? r.to_id : r.from_id);
      const opener = await this.trackById(r.track_id);
      if (!other || !opener) continue;
      const last = (
        await this.db.all<{ from_id: string; body: string | null; title: string | null; created_at: number }>(
          `SELECT m.from_id, m.body, t.title, m.created_at FROM messages m LEFT JOIN tracks t ON t.id = m.track_id
           WHERE m.request_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 1`,
          [r.id],
        )
      )[0];
      const read = (
        await this.db.all<{ read_at: number }>('SELECT read_at FROM chat_reads WHERE request_id = ? AND user_id = ?', [r.id, me])
      )[0];
      const hiddenAt = await this.hiddenAt(r.id, me);
      // a chat you deleted stays gone until something new is said in it
      if (hiddenAt && (last?.created_at ?? 0) <= hiddenAt) continue;
      const fresh = (
        await this.db.all<{ n: number }>(
          'SELECT COUNT(*) AS n FROM messages WHERE request_id = ? AND from_id != ? AND created_at > ?',
          [r.id, me, Math.max(read?.read_at ?? 0, hiddenAt)],
        )
      )[0].n;
      out.push({
        id: String(r.id),
        other,
        opener,
        last: last
          ? { text: last.body ?? `Sent a song: ${last.title ?? 'untitled'}`, mine: last.from_id === me, at: last.created_at }
          : null,
        // A chat you've never opened is news in itself: they said yes.
        unread: read ? fresh : Math.max(1, fresh),
        at: last?.created_at ?? r.answered_at ?? r.created_at,
      });
    }
    out.sort((a, b) => b.at - a.at);
    return out.map(({ at: _at, ...c }) => c);
  }

  async getInbox(): Promise<Inbox> {
    const me = await this.meta('current_user');
    if (!me) return { waiting: [], chats: [], sent: [] };
    const hidden = await this.blockedIds(me);
    return {
      waiting: (await this.requests("to_id = ? AND status = 'pending' ORDER BY created_at DESC", [me])).filter((r) => !hidden.has(r.from.id)),
      chats: (await this.chatSummaries(me)).filter((c) => !hidden.has(c.other.id)),
      sent: (await this.requests("from_id = ? AND status != 'accepted' ORDER BY created_at DESC", [me])).filter((r) => !hidden.has(r.to.id)),
    };
  }

  async getInboxCount(): Promise<number> {
    const me = await this.meta('current_user');
    if (!me) return 0;
    const inbox = await this.getInbox();
    return inbox.waiting.length + inbox.chats.filter((c) => c.unread > 0).length;
  }

  async getLink(personId: string): Promise<Link> {
    const me = await this.meta('current_user');
    if (!me) return { kind: 'none' };
    return (await this.links(me)).get(personId) ?? { kind: 'none' };
  }

  async getChat(chatId: string): Promise<Chat | null> {
    const me = await this.meta('current_user');
    if (!me || !/^\d+$/.test(chatId)) return null;
    const opener = (
      await this.requests("id = ? AND status = 'accepted' AND (from_id = ? OR to_id = ?)", [Number(chatId), me, me])
    )[0];
    if (!opener) return null;
    if ((await this.blockedIds(me)).has(opener.from.id === me ? opener.to.id : opener.from.id)) return null;
    const rows = await this.db.all<{ id: number; from_id: string; body: string | null; track_id: string | null; created_at: number }>(
      'SELECT * FROM messages WHERE request_id = ? AND created_at > ? ORDER BY created_at ASC, id ASC',
      [Number(chatId), await this.hiddenAt(Number(chatId), me)],
    );
    const messages: ChatMessage[] = [];
    for (const m of rows) {
      messages.push({ id: String(m.id), fromId: m.from_id, body: m.body, track: await this.trackById(m.track_id), sentAt: m.created_at });
    }
    return { id: chatId, other: opener.from.id === me ? opener.to : opener.from, opener, messages };
  }

  private async say(chatId: string, fromId: string, body: string) {
    const at = this.now();
    await this.write(async () => {
      const ok = await this.db.all(
        "SELECT 1 FROM requests WHERE id = ? AND status = 'accepted' AND (from_id = ? OR to_id = ?)",
        [Number(chatId), fromId, fromId],
      );
      if (!ok.length) throw new Error('That chat is not open.');
      await this.db.run('INSERT INTO messages (request_id, from_id, body, created_at) VALUES (?, ?, ?, ?)', [
        Number(chatId),
        fromId,
        body,
        at,
      ]);
      await this.markRead(chatId, fromId, at);
    });
    this.emit('inbox');
  }

  async sendMessage(chatId: string, body: string): Promise<void> {
    const text = body.trim();
    if (!text) return;
    await this.say(chatId, await this.meId(), text);
  }

  /** When this person deleted this chat, or 0 if they haven't. */
  private async hiddenAt(requestId: number, userId: string): Promise<number> {
    const rows = await this.db.all<{ hidden_at: number }>('SELECT hidden_at FROM chat_hides WHERE request_id = ? AND user_id = ?', [requestId, userId]);
    return rows[0]?.hidden_at ?? 0;
  }

  async deleteChat(chatId: string): Promise<void> {
    const me = await this.meId();
    const mine = /^\d+$/.test(chatId)
      ? (await this.db.all<{ id: number }>("SELECT id FROM requests WHERE id = ? AND status = 'accepted' AND (from_id = ? OR to_id = ?)", [Number(chatId), me, me]))[0]
      : undefined;
    if (!mine) throw new Error('not-your-chat');
    const at = this.now();
    await this.write(async () => {
      await this.db.run('INSERT OR REPLACE INTO chat_hides (request_id, user_id, hidden_at) VALUES (?, ?, ?)', [mine.id, me, at]);
      await this.markRead(chatId, me, at);
      // once both sides have deleted it, the old messages go for good
      const hides = await this.db.all<{ hidden_at: number }>('SELECT hidden_at FROM chat_hides WHERE request_id = ?', [mine.id]);
      if (hides.length === 2) await this.db.run('DELETE FROM messages WHERE request_id = ? AND created_at <= ?', [mine.id, Math.min(...hides.map((h) => h.hidden_at))]);
    });
    this.emit('inbox');
  }

  async markChatRead(chatId: string): Promise<void> {
    const me = await this.meId();
    await this.write(() => this.markRead(chatId, me, this.now()));
    this.emit('inbox');
  }

  // ---- SimHost: residents sending you songs -------------------------------

  async viewer() {
    const me = await this.meta('current_user');
    if (!me) return null;
    const rows = await this.db.all<{ seeded: number; started_at: number | null; title: string | null; artist: string | null }>(
      `SELECT u.seeded, p.started_at, t.title, t.artist FROM users u
       LEFT JOIN plays p ON p.user_id = u.id AND p.ended_at IS NULL AND p.area_id IS NOT NULL
       LEFT JOIN tracks t ON t.id = p.track_id
       WHERE u.id = ? ORDER BY p.started_at DESC LIMIT 1`,
      [me],
    );
    const r = rows[0];
    // Residents you've borrowed don't get fan mail; only accounts made on this phone do.
    if (!r || r.seeded) return null;
    return {
      id: me,
      onAir:
        r.started_at !== null && r.title !== null && r.artist !== null
          ? { since: r.started_at, title: r.title, artist: r.artist }
          : null,
    };
  }

  async socialState(viewerId: string) {
    const rows = await this.db.all<RequestRow & { seeded: number; spoken: number }>(
      `SELECT r.*, u.seeded,
              EXISTS (SELECT 1 FROM messages m WHERE m.request_id = r.id AND m.from_id = r.from_id) AS spoken
       FROM requests r JOIN users u ON u.id = r.from_id
       WHERE r.from_id = ? OR r.to_id = ?`,
      [viewerId, viewerId],
    );
    const fromResidents = rows.filter((r) => r.to_id === viewerId && r.seeded);
    return {
      knows: rows.map((r) => (r.from_id === viewerId ? r.to_id : r.from_id)),
      received: fromResidents.length,
      lastReceivedAt: fromResidents.reduce<number | null>((m, r) => (m === null || r.created_at > m ? r.created_at : m), null),
      unanswered: fromResidents.filter((r) => r.status === 'pending').length,
      awaitingReply: fromResidents
        .filter((r) => r.status === 'accepted' && !r.spoken)
        .map((r) => ({ chatId: String(r.id), fromId: r.from_id, acceptedAt: r.answered_at ?? r.created_at })),
    };
  }

  async sendSongAs(fromId: string, toId: string, trackId: string, note: string) {
    await this.write(async () => {
      await this.insertRequest(fromId, toId, trackId, note, this.now());
    });
    this.emit('inbox', 'nearby');
  }

  sayAs(chatId: string, fromId: string, body: string) {
    return this.say(chatId, fromId, body);
  }

  // ---- city ---------------------------------------------------------------

  async getCityFeed(scope: string): Promise<CityFeed> {
    const me = (await this.meta('current_user')) ?? '';
    const now = this.now();
    const inScope = scope === REGION ? [...cities] : [scope];
    const marks = inScope.map(() => '?').join(', ');

    type Row = UserRow & TrackRow & { post_id: number; note: string; city: string; posted_at: number; saved: number };
    const rows = await this.db.all<Row>(
      `SELECT u.*, ${TRACK_COLS}, p.id AS post_id, p.note, p.city, p.created_at AS posted_at,
              EXISTS (SELECT 1 FROM saves s WHERE s.user_id = ? AND s.track_id = t.id) AS saved
       FROM posts p
       JOIN users u ON u.id = p.user_id
       JOIN tracks t ON t.id = p.track_id
       WHERE p.city IN (${marks}) AND p.created_at <= ?
       ORDER BY p.created_at DESC, p.id DESC LIMIT 80`,
      [me, ...inScope, now],
    );
    const links = me ? await this.links(me) : new Map<string, Link>();
    const hidden = await this.blockedIds(me);
    const posts: CityPost[] = rows.filter((r) => !hidden.has(r.id)).map((r) => ({
      id: String(r.post_id),
      person: toPerson(r),
      track: toTrack(r),
      note: r.note,
      city: r.city,
      postedAt: r.posted_at,
      saved: !!r.saved,
      link: links.get(r.id) ?? { kind: 'none' },
      mine: r.id === me,
    }));

    // Who's getting attention: a post counts for three plays. Last seven days, this scope only.
    const since = now - TRENDING_WINDOW;
    const heat = new Map<string, ArtistHeat & { score: number }>();
    const bump = (artist: string, artworkUrl: string, kind: 'posts' | 'plays', n: number) => {
      const h = heat.get(artist) ?? { artist, posts: 0, plays: 0, artworkUrl, score: 0 };
      h[kind] += n;
      h.score += kind === 'posts' ? n * 3 : n;
      heat.set(artist, h);
    };
    for (const r of rows) if (r.posted_at > since) bump(r.artist, r.artwork_url, 'posts', 1);
    const played = await this.db.all<{ artist: string; artwork_url: string; n: number }>(
      `SELECT t.artist, MIN(t.artwork_url) AS artwork_url, COUNT(*) AS n
       FROM plays p JOIN users u ON u.id = p.user_id JOIN tracks t ON t.id = p.track_id
       WHERE u.home_city IN (${marks}) AND p.started_at > ? AND p.started_at <= ? AND p.area_id IS NOT NULL
       GROUP BY t.artist`,
      [...inScope, since, now],
    );
    for (const r of played) bump(r.artist, r.artwork_url, 'plays', r.n);
    const trending = [...heat.values()]
      .sort((a, b) => b.score - a.score || a.artist.localeCompare(b.artist))
      .slice(0, 6)
      .map(({ score: _score, ...h }) => h);

    return { scope, posts, trending };
  }

  async postToCity(track: Track, note: string): Promise<string> {
    const me = await this.meId();
    const text = note.trim();
    if (!text) throw new Error('Say why. That’s what makes it a post and not a link.');
    const person = await this.getPerson(me);
    let id = '';
    await this.write(async () => {
      await this.putTrack(track);
      await this.db.run('INSERT INTO posts (user_id, track_id, note, city, created_at, seeded) VALUES (?, ?, ?, ?, ?, 0)', [
        me,
        track.id,
        text,
        person!.homeCity,
        this.now(),
      ]);
      id = String((await this.db.all<{ id: number }>('SELECT last_insert_rowid() AS id'))[0].id);
    });
    this.emit('city');
    return id;
  }

  async removePost(postId: string): Promise<void> {
    const me = await this.meId();
    await this.write(() => this.db.run('DELETE FROM posts WHERE id = ? AND user_id = ?', [Number(postId), me]));
    this.emit('city');
  }

  async setHomeCity(city: string): Promise<void> {
    const me = await this.meId();
    if (!(cities as readonly string[]).includes(city)) throw new Error('We don’t cover that city yet.');
    await this.write(() => this.db.run('UPDATE users SET home_city = ? WHERE id = ?', [city, me]));
    this.emit('session', 'room', 'city');
  }

  // ---- artists' local rooms ------------------------------------------------

  async getArtistSpace(artist: string, scope: string): Promise<ArtistSpace> {
    const now = this.now();
    const key = artist.trim().toLowerCase();
    const inScope = scope === REGION ? [...cities] : [scope];
    const marks = inScope.map(() => '?').join(', ');

    const trackRows = await this.db.all<TrackRow>(
      `SELECT ${TRACK_COLS} FROM tracks t WHERE LOWER(t.artist) = ? ORDER BY t.title LIMIT 12`,
      [key],
    );
    // Use the spelling the music source uses, if we have one of their tracks.
    const name = trackRows[0]?.artist ?? artist.trim();

    const threadRows = await this.db.all<ThreadRow & { replies: number; last_at: number | null }>(
      `SELECT th.*,
              (SELECT COUNT(*) FROM replies r WHERE r.thread_id = th.id AND r.created_at <= ?) AS replies,
              (SELECT MAX(r.created_at) FROM replies r WHERE r.thread_id = th.id AND r.created_at <= ?) AS last_at
       FROM threads th
       WHERE th.artist_key = ? AND th.city IN (${marks}) AND th.created_at <= ?`,
      [now, now, key, ...inScope, now],
    );
    const threads: ThreadSummary[] = [];
    for (const t of threadRows) {
      const starter = await this.getPerson(t.user_id);
      if (!starter) continue;
      const last = (
        await this.db.all<{ user_id: string; body: string }>(
          'SELECT user_id, body FROM replies WHERE thread_id = ? AND created_at <= ? ORDER BY created_at DESC, id DESC LIMIT 1',
          [t.id, now],
        )
      )[0];
      const lastPerson = last ? await this.getPerson(last.user_id) : null;
      threads.push({
        id: String(t.id),
        artist: name,
        city: t.city,
        title: t.title,
        starter,
        startedAt: t.created_at,
        replies: t.replies,
        lastAt: t.last_at ?? t.created_at,
        last: last && lastPerson ? { person: lastPerson, text: last.body } : null,
      });
    }
    threads.sort((a, b) => b.lastAt - a.lastAt);

    // Who around here has had them on lately (shared listening only), or posted them.
    const fans = await this.db.all<UserRow>(
      `SELECT DISTINCT u.* FROM users u
       WHERE u.home_city IN (${marks}) AND (
         EXISTS (SELECT 1 FROM plays p JOIN tracks t ON t.id = p.track_id
                 WHERE p.user_id = u.id AND LOWER(t.artist) = ? AND p.area_id IS NOT NULL AND p.started_at > ?)
         OR EXISTS (SELECT 1 FROM posts p JOIN tracks t ON t.id = p.track_id
                    WHERE p.user_id = u.id AND LOWER(t.artist) = ? AND p.created_at > ? AND p.created_at <= ?)
       ) ORDER BY u.name LIMIT 12`,
      [...inScope, key, now - 30 * 24 * 60 * 60 * 1000, key, now - 30 * 24 * 60 * 60 * 1000, now],
    );

    const elsewhere =
      scope === REGION
        ? 0
        : (
            await this.db.all<{ n: number }>(
              'SELECT COUNT(*) AS n FROM threads WHERE artist_key = ? AND city != ? AND created_at <= ?',
              [key, scope, now],
            )
          )[0].n;

    const hidden = await this.blockedIds(await this.meta('current_user'));
    return {
      artist: name,
      scope,
      tracks: trackRows.map(toTrack),
      listeners: fans.map(toPerson).filter((p) => !hidden.has(p.id)),
      threads: threads.filter((t) => !hidden.has(t.starter.id)),
      elsewhere,
    };
  }

  async getThread(threadId: string): Promise<Thread | null> {
    if (!/^\d+$/.test(threadId)) return null;
    const now = this.now();
    const t = (await this.db.all<ThreadRow>('SELECT * FROM threads WHERE id = ? AND created_at <= ?', [Number(threadId), now]))[0];
    if (!t) return null;
    const starter = await this.getPerson(t.user_id);
    if (!starter) return null;
    const hidden = await this.blockedIds(await this.meta('current_user'));
    if (hidden.has(starter.id)) return null;
    const rows = await this.db.all<{ id: number; user_id: string; body: string; track_id: string | null; created_at: number }>(
      'SELECT * FROM replies WHERE thread_id = ? AND created_at <= ? ORDER BY created_at ASC, id ASC',
      [t.id, now],
    );
    const replies: ThreadReply[] = [];
    for (const r of rows) {
      const person = await this.getPerson(r.user_id);
      if (person && !hidden.has(person.id)) replies.push({ id: String(r.id), person, body: r.body, track: await this.trackById(r.track_id), at: r.created_at });
    }
    return { id: threadId, artist: t.artist, city: t.city, title: t.title, body: t.body, starter, startedAt: t.created_at, replies };
  }

  async startThread(artist: string, title: string, body: string): Promise<string> {
    const me = await this.meId();
    const heading = title.trim();
    if (!heading) throw new Error('A thread needs a title.');
    const person = await this.getPerson(me);
    const name = artist.trim();
    let id = '';
    await this.write(async () => {
      await this.db.run(
        'INSERT INTO threads (artist_key, artist, city, user_id, title, body, created_at, seeded) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        [name.toLowerCase(), name, person!.homeCity, me, heading, body.trim(), this.now()],
      );
      id = String((await this.db.all<{ id: number }>('SELECT last_insert_rowid() AS id'))[0].id);
    });
    this.emit('artist');
    return id;
  }

  async replyToThread(threadId: string, body: string, track?: Track | null): Promise<void> {
    const me = await this.meId();
    const text = body.trim();
    if (!text && !track) return;
    await this.write(async () => {
      const exists = await this.db.all('SELECT 1 FROM threads WHERE id = ?', [Number(threadId)]);
      if (!exists.length) throw new Error('That thread has gone.');
      if (track) await this.putTrack(track);
      await this.db.run('INSERT INTO replies (thread_id, user_id, body, track_id, created_at, seeded) VALUES (?, ?, ?, ?, ?, 0)', [
        Number(threadId),
        me,
        text,
        track?.id ?? null,
        this.now(),
      ]);
    });
    this.emit('artist');
  }

  // ---- crate --------------------------------------------------------------

  async toggleSave(track: Track): Promise<boolean> {
    const me = await this.meId();
    let saved = false;
    await this.write(async () => {
      const has = await this.db.all('SELECT 1 FROM saves WHERE user_id = ? AND track_id = ?', [me, track.id]);
      if (has.length) {
        await this.db.run('DELETE FROM saves WHERE user_id = ? AND track_id = ?', [me, track.id]);
      } else {
        await this.putTrack(track);
        await this.db.run('INSERT INTO saves (user_id, track_id, saved_at) VALUES (?, ?, ?)', [me, track.id, this.now()]);
        saved = true;
      }
    });
    this.emit('crate', 'nearby', 'city');
    return saved;
  }

  async getCrate(): Promise<Track[]> {
    const me = await this.meta('current_user');
    if (!me) return [];
    const rows = await this.db.all<TrackRow>(
      `SELECT ${TRACK_COLS} FROM saves s JOIN tracks t ON t.id = s.track_id WHERE s.user_id = ? ORDER BY s.saved_at DESC`,
      [me],
    );
    return rows.map(toTrack);
  }

  // ---- rooms --------------------------------------------------------------

  private async loadRoom(personId: string): Promise<Room | null> {
    const rows = await this.db.all<{ doc: string }>('SELECT doc FROM rooms WHERE user_id = ?', [personId]);
    if (!rows[0]) return null;
    try {
      const room = JSON.parse(rows[0].doc) as Room;
      return room && Array.isArray(room.sections) && room.theme ? room : null;
    } catch {
      return null;
    }
  }

  private async storeRoom(room: Room) {
    await this.db.run('INSERT OR REPLACE INTO rooms (user_id, doc, updated_at) VALUES (?, ?, ?)', [
      room.personId,
      JSON.stringify(room),
      this.now(),
    ]);
  }

  async getRoom(personId: string): Promise<RoomView | null> {
    const person = await this.getPerson(personId);
    if (!person) return null;
    const me = await this.meta('current_user');
    if ((await this.blockedIds(me)).has(personId)) return null;
    let room = await this.loadRoom(personId);
    if (!room) {
      // Everyone gets a room. New accounts start with the house look and empty furniture.
      room = starterRoom(personId);
      const fresh = room;
      await this.write(() => this.storeRoom(fresh));
    }

    // "Recently played" is whatever they've really had on, unless they keep it hidden.
    const played = await this.db.all<{ track_id: string }>(
      `SELECT track_id, MAX(started_at) AS latest FROM plays WHERE user_id = ?
       GROUP BY track_id ORDER BY latest DESC LIMIT 6`,
      [personId],
    );
    const sections = room.sections.map((s) => {
      if (s.kind !== 'recent') return s;
      if (s.visibility === 'hidden') return { ...s, trackIds: [] };
      return played.length ? { ...s, trackIds: played.map((p) => p.track_id) } : s;
    });
    room = { ...room, personId, sections };

    const trackIds = new Set<string>();
    const personIds = new Set<string>();
    for (const s of room.sections) {
      if (s.kind === 'intro') s.songs.forEach((x) => trackIds.add(x.trackId));
      if (s.kind === 'pinned' && s.trackId) trackIds.add(s.trackId);
      if (s.kind === 'wall' || s.kind === 'shelf' || s.kind === 'recent') s.trackIds.forEach((t) => trackIds.add(t));
      if (s.kind === 'liner') s.notes.forEach((n) => n.trackId && trackIds.add(n.trackId));
      if (s.kind === 'guestbook') {
        s.entries.forEach((e) => {
          trackIds.add(e.trackId);
          personIds.add(e.fromId);
        });
      }
    }
    const tracks: Record<string, Track> = {};
    for (const id of trackIds) {
      const t = await this.trackById(id);
      if (t) tracks[id] = t;
    }
    const people: Record<string, Person> = {};
    for (const id of personIds) {
      const p = await this.getPerson(id);
      if (p) people[id] = p;
    }
    return { person, room, tracks, people, mine: me === personId };
  }

  async saveRoom(room: Room, tracks: Track[] = []): Promise<void> {
    const me = await this.meId();
    if (room.personId !== me) throw new Error('You can only decorate your own room.');
    // The guestbook belongs to its signers: keep what's stored unless the owner removed an entry.
    const stored = await this.loadRoom(me);
    const signed = new Map<string, GuestbookEntry>();
    stored?.sections.forEach((s) => s.kind === 'guestbook' && s.entries.forEach((e) => signed.set(e.fromId, e)));
    const clean: Room = {
      personId: me,
      theme: room.theme,
      sections: room.sections.map((s) => {
        if (s.kind === 'recent') return { ...s, trackIds: [] }; // derived from listening, never stored
        if (s.kind === 'guestbook') return { ...s, entries: s.entries.filter((e) => signed.has(e.fromId)).map((e) => signed.get(e.fromId)!) };
        return s;
      }),
    };
    await this.write(async () => {
      for (const t of tracks) await this.putTrack(t);
      await this.storeRoom(clean);
    });
    this.emit('room');
  }

  async signGuestbook(personId: string, track: Track, why: string): Promise<void> {
    const me = await this.meId();
    if (personId === me) throw new Error('You can’t sign your own guestbook. People will know.');
    const text = why.trim();
    if (!text) throw new Error('Say why you picked it.');
    if (!(await this.getRoom(personId))) throw new Error('No such room.');
    await this.write(async () => {
      const room = await this.loadRoom(personId);
      const book = room?.sections.find((s) => s.kind === 'guestbook');
      if (!room || !book || book.kind !== 'guestbook') throw new Error('They don’t keep a guestbook.');
      await this.putTrack(track);
      // one entry per visitor: signing again replaces the last one
      book.entries = [{ fromId: me, trackId: track.id, why: text, at: this.now() }, ...book.entries.filter((e) => e.fromId !== me)];
      await this.storeRoom(room);
    });
    this.emit('room');
  }

  // ---- safety -------------------------------------------------------------

  private async blockedIds(me: string | null): Promise<Set<string>> {
    if (!me) return new Set();
    const rows = await this.db.all<{ blocked_id: string }>('SELECT blocked_id FROM blocks WHERE user_id = ?', [me]);
    return new Set(rows.map((r) => r.blocked_id));
  }

  /** Take one person's signature out of guestbooks: one owner's, or (owner null) everyone's. */
  private async unsign(ownerId: string | null, signerId: string) {
    const rows = await this.db.all<{ user_id: string }>('SELECT user_id FROM rooms WHERE doc LIKE ?', [`%${signerId}%`]);
    for (const row of rows) {
      if (row.user_id === signerId || (ownerId && row.user_id !== ownerId)) continue;
      const room = await this.loadRoom(row.user_id);
      if (!room) continue;
      for (const section of room.sections) {
        if (section.kind === 'guestbook') section.entries = section.entries.filter((e) => e.fromId !== signerId);
      }
      await this.storeRoom(room);
    }
  }

  async blockPerson(personId: string): Promise<void> {
    const me = await this.meId();
    if (personId === me) throw new Error('self');
    if (!(await this.getPerson(personId))) throw new Error('unknown-person');
    await this.write(async () => {
      await this.db.run('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)', [me, personId, this.now()]);
      await this.unsign(me, personId);
      await this.unsign(personId, me);
    });
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
  }

  async unblockPerson(personId: string): Promise<void> {
    const me = await this.meId();
    await this.write(() => this.db.run('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?', [me, personId]));
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
  }

  async getBlocked(): Promise<Person[]> {
    const me = await this.meta('current_user');
    if (!me) return [];
    const rows = await this.db.all<UserRow>(
      'SELECT u.* FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ? ORDER BY b.created_at DESC',
      [me],
    );
    return rows.map(toPerson);
  }

  /** With no server there is nobody to send a report to. It is kept on this phone and goes nowhere. */
  async reportPerson(personId: string, reason: ReportReason, note: string, context: ReportContext): Promise<void> {
    const me = await this.meId();
    if (!(await this.getPerson(personId))) throw new Error('unknown-person');
    await this.write(() =>
      this.db.run('INSERT INTO reports (reporter_id, about_id, reason, note, context, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        me,
        personId,
        reason,
        note.trim().slice(0, 1000),
        context ? JSON.stringify(context) : null,
        this.now(),
      ]),
    );
  }

  async deleteAccount(): Promise<void> {
    const me = await this.meId();
    await this.write(async () => {
      const row = (await this.db.all<UserRow>('SELECT * FROM users WHERE id = ?', [me]))[0];
      if (!row || row.seeded) throw new AuthError('resident');
      const mine = 'SELECT id FROM requests WHERE from_id = ? OR to_id = ?';
      await this.db.run('DELETE FROM replies WHERE user_id = ? OR thread_id IN (SELECT id FROM threads WHERE user_id = ?)', [me, me]);
      await this.db.run('DELETE FROM threads WHERE user_id = ?', [me]);
      await this.db.run('DELETE FROM posts WHERE user_id = ?', [me]);
      await this.db.run(`DELETE FROM messages WHERE from_id = ? OR request_id IN (${mine})`, [me, me, me]);
      await this.db.run(`DELETE FROM chat_reads WHERE user_id = ? OR request_id IN (${mine})`, [me, me, me]);
      await this.db.run('DELETE FROM requests WHERE from_id = ? OR to_id = ?', [me, me]);
      for (const table of ['saves', 'plays', 'rooms']) await this.db.run(`DELETE FROM ${table} WHERE user_id = ?`, [me]);
      await this.db.run('DELETE FROM blocks WHERE user_id = ? OR blocked_id = ?', [me, me]);
      await this.db.run('DELETE FROM chat_hides WHERE user_id = ?', [me]);
      await this.db.run('DELETE FROM reports WHERE reporter_id = ?', [me]);
      await this.unsign(null, me);
      await this.db.run('DELETE FROM users WHERE id = ?', [me]);
      await this.setMeta('current_user', null);
    });
    this.emit('session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist');
  }

  async updateProfile(edit: ProfileEdit): Promise<void> {
    const me = await this.meId();
    const name = edit.name.trim();
    if (!name) throw new Error('A name is needed.');
    await this.write(() =>
      this.db.run('UPDATE users SET name = ?, tagline = ?, bio = ?, badge = ?, badge_color = ? WHERE id = ?', [
        name,
        edit.tagline.trim(),
        edit.bio.trim(),
        edit.badge.trim().slice(0, 2).toUpperCase() || '?',
        edit.badgeColor,
        me,
      ]),
    );
    this.emit('session', 'room', 'nearby', 'inbox');
  }

  // ---- SimHost: the simulation acting as seeded residents -----------------

  async simPeople(): Promise<string[]> {
    const me = (await this.meta('current_user')) ?? '';
    const rows = await this.db.all<{ id: string }>('SELECT id FROM users WHERE seeded = 1 AND id != ?', [me]);
    return rows.map((r) => r.id);
  }

  async presences() {
    const rows = await this.db.all<{ user_id: string; area_id: string; until: number }>('SELECT * FROM presence');
    return rows.map((r) => ({ userId: r.user_id, areaId: r.area_id, until: r.until }));
  }

  setPresence(userId: string, areaId: string, until: number) {
    return this.write(() =>
      this.db.run('INSERT OR REPLACE INTO presence (user_id, area_id, until) VALUES (?, ?, ?)', [userId, areaId, until]),
    );
  }

  clearPresence(userId: string) {
    return this.write(() => this.db.run('DELETE FROM presence WHERE user_id = ?', [userId]));
  }

  async openPlay(userId: string) {
    const rows = await this.db.all<{ track_id: string; started_at: number }>(
      'SELECT track_id, started_at FROM plays WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
      [userId],
    );
    return rows[0] ? { trackId: rows[0].track_id, startedAt: rows[0].started_at } : null;
  }

  async lastTrack(userId: string) {
    const rows = await this.db.all<{ track_id: string }>(
      'SELECT track_id FROM plays WHERE user_id = ? ORDER BY started_at DESC, id DESC LIMIT 1',
      [userId],
    );
    return rows[0]?.track_id ?? null;
  }

  recordPlay(p: Parameters<SimHost['recordPlay']>[0]) {
    const params: SqlValue[] = [p.userId, p.trackId, p.kind, p.note, p.areaId, p.startedAt, p.endedAt];
    return this.write(() =>
      this.db.run(
        'INSERT INTO plays (user_id, track_id, kind, note, area_id, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params,
      ),
    );
  }

  endOpenPlays(userId: string, at: number) {
    return this.write(() =>
      this.db.run('UPDATE plays SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL', [at, userId]),
    );
  }
}

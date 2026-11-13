/**
 * earshot on the backend: the same `EarshotApi` the screens already use, with
 * every call answered by a function on the server (see supabase/schema.sql).
 *
 * The server decides who is asking from their login and enforces every rule,
 * so this file is deliberately thin: call the function, hand back the answer,
 * and tell the screens what changed.
 */
import type { Track } from '@/music/types';
import { AuthError, SendError, type EarshotApi, type Topic } from '../api';
import { areaById } from '../areas';
import type {
  AdoptedAccount,
  ArtistSpace,
  Chat,
  CityFeed,
  Inbox,
  Link,
  NewAccount,
  NowPlaying,
  Person,
  ProfileEdit,
  Room,
  RoomView,
  SendOutcome,
  Session,
  Sighting,
  Thread,
} from '../types';

/** Call one server function by name. Rejects with an Error whose message is the server's reason code. */
export type ServerCall = (fn: string, args?: Record<string, unknown>) => Promise<unknown>;

/**
 * Listen for the server's change notices on some channels. `onNotice` gets the
 * kind of change ("all" after a reconnect, since anything might have been
 * missed). `onState` says whether every channel is connected. Returns a
 * function that stops listening.
 */
export type Listen = (topics: string[], onNotice: (what: string) => void, onState: (live: boolean) => void) => () => void;

const SEND_CODES = ['self', 'already-sent', 'they-sent-first', 'unknown-person'] as const;
const ALL: Topic[] = ['session', 'nearby', 'crate', 'inbox', 'room', 'city', 'artist'];
/** How long an answer may be reused when several screens ask the same thing at once. */
const REUSE_MS = 800;
/** Notices that land together (a busy street) become one reload. */
const SETTLE_MS = 120;
/** While notices are arriving live, asking the server "anything new?" drops back to this often. */
const LIVE_PULSE_MS = 15_000;

/** Which screens a notice of each kind makes stale. */
const STALE: Record<string, Topic[]> = {
  inbox: ['inbox', 'nearby', 'city'],
  nearby: ['nearby'],
  city: ['city'],
  artist: ['artist'],
  room: ['room'],
  all: ['nearby', 'inbox', 'city', 'artist', 'room'],
};

/** Must match app.slug in supabase/schema.sql. */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** The notice channels one person should be on. Must match public.may_listen in supabase/schema.sql. */
export const channelsFor = (me: Pick<Person, 'id' | 'homeCity'> | null, areaId: string | null): string[] =>
  me ? [`person:${me.id}`, `city:${slug(me.homeCity)}`, ...(areaId ? [`area:${areaId}`] : [])] : [];

type ServerSession = {
  me: Person | null;
  sharing: boolean;
  areaId: string | null;
  areaSource: 'gps' | 'picked' | null;
  nowPlaying: NowPlaying | null;
  needsProfile: boolean;
};

export class CloudApi implements EarshotApi {
  readonly kind = 'server' as const;
  private listeners = new Map<Topic, Set<() => void>>();
  private recent = new Map<string, { at: number; answer: Promise<unknown> }>();
  private pulsing: Promise<void> | null = null;
  private pulsedAt = 0;
  private tuned = '';
  private stopListening: (() => void) | null = null;
  private live = false;
  private heard = new Set<Topic>();
  private settle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private call: ServerCall,
    private logOutOfBackend: () => Promise<void>,
    /** Whether anyone is logged in to the backend on this phone. Saves a trip when nobody is. */
    private loggedIn: () => Promise<boolean> = async () => true,
    /** How to hear the server's change notices. Without it, the app only polls. */
    private listen: Listen | null = null,
  ) {}

  // ---- live updates -------------------------------------------------------

  /** Be on the right notice channels for whoever is logged in and wherever they are. */
  private tune(me: Pick<Person, 'id' | 'homeCity'> | null, areaId: string | null) {
    if (!this.listen) return;
    const topics = channelsFor(me, areaId);
    const key = topics.join(' ');
    if (key === this.tuned) return;
    this.tuned = key;
    this.stopListening?.();
    this.stopListening = null;
    this.live = false;
    if (topics.length === 0) return;
    this.stopListening = this.listen(
      topics,
      (what) => this.hear(what),
      (live) => {
        if (key === this.tuned) this.live = live;
      },
    );
  }

  /** The server says something changed. Reload the screens that show it, once things settle. */
  private hear(what: string) {
    for (const t of STALE[what] ?? STALE.all) this.heard.add(t);
    this.settle ??= setTimeout(() => {
      this.settle = null;
      const topics = [...this.heard];
      this.heard.clear();
      this.recent.clear();
      this.emit(...topics);
    }, SETTLE_MS);
  }

  // ---- plumbing -----------------------------------------------------------

  /** A read. Screens that ask the same question within a moment share one trip to the server. */
  private read<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const key = fn + JSON.stringify(args);
    const hit = this.recent.get(key);
    if (hit && Date.now() - hit.at < REUSE_MS) return hit.answer as Promise<T>;
    const answer = this.call(fn, args);
    this.recent.set(key, { at: Date.now(), answer });
    answer.catch(() => this.recent.delete(key));
    return answer as Promise<T>;
  }

  /** A change. Whatever was remembered is forgotten, and the screens showing those topics reload. */
  private async write<T>(fn: string, args: Record<string, unknown>, ...topics: Topic[]): Promise<T> {
    try {
      return (await this.call(fn, args)) as T;
    } finally {
      this.recent.clear();
      this.emit(...topics);
    }
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

  // ---- who's holding the phone -------------------------------------------

  async getSession(): Promise<Session> {
    if (!(await this.loggedIn())) {
      this.tune(null, null);
      return { me: null, sharing: false, area: null, areaSource: null, nowPlaying: null, needsPassword: false, needsProfile: false };
    }
    const s = await this.read<ServerSession>('get_session');
    this.tune(s.me, s.areaId);
    return {
      me: s.me,
      sharing: s.sharing,
      area: s.areaId ? areaById(s.areaId) : null,
      areaSource: s.areaSource,
      nowPlaying: s.nowPlaying,
      needsPassword: false,
      needsProfile: s.needsProfile,
    };
  }

  /** Finish a profile that a Google sign-in started. Throws AuthError for a taken or malformed handle. */
  async completeProfile(p: Pick<Person, 'name' | 'handle' | 'badge' | 'badgeColor' | 'homeCity'>): Promise<void> {
    try {
      await this.write(
        'complete_profile',
        { p_name: p.name, p_handle: p.handle, p_badge: p.badge, p_badge_color: p.badgeColor, p_home_city: p.homeCity },
        ...ALL,
      );
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'handle-taken' || code === 'bad-handle') throw new AuthError(code);
      throw e;
    }
  }

  async listAccounts(): Promise<Person[]> {
    const { me } = await this.getSession();
    return me ? [me] : [];
  }

  // Accounts are made and checked by the backend's own sign-in (src/backend/accounts.ts), not here.
  createAccount(_input: NewAccount): Promise<Person> {
    return Promise.reject(new Error('Accounts are created through the backend sign-up.'));
  }
  logIn(): Promise<Person> {
    return Promise.reject(new Error('Log in through the backend sign-in.'));
  }
  changePassword(): Promise<void> {
    return Promise.reject(new Error('Passwords are changed through the backend.'));
  }
  /** Residents can't be borrowed once accounts are real: nobody may act as someone else. */
  signIn(): Promise<void> {
    return Promise.reject(new AuthError('password-needed'));
  }

  async signOut(): Promise<void> {
    this.tune(null, null);
    await this.logOutOfBackend();
    this.recent.clear();
    this.emit(...ALL);
  }

  /** The backend has just logged someone in; everything on screen belongs to them now. */
  async adoptAccount(_account: AdoptedAccount): Promise<void> {
    this.recent.clear();
    this.emit(...ALL);
  }

  async moveAccountData(): Promise<void> {}

  async resetEverything(): Promise<void> {
    await this.signOut();
  }

  // ---- sharing, place, listening -----------------------------------------

  setSharing(on: boolean) {
    return this.write<void>('set_sharing', { p_on: on }, 'session', 'nearby');
  }
  setArea(areaId: string, source: 'gps' | 'picked') {
    return this.write<void>('set_area', { p_area: areaId, p_source: source }, 'session', 'nearby');
  }
  setNowPlaying(track: Track | null, note?: string | null) {
    return this.write<void>('set_now_playing', { p_track: track, p_note: note ?? null }, 'session', 'nearby', 'room');
  }

  // ---- nearby -------------------------------------------------------------

  getNearby() {
    return this.read<Sighting[]>('get_nearby');
  }

  refreshNearby(): Promise<void> {
    // While notices are arriving live there is rarely anything to ask for, so most beats are
    // skipped. The slow beat that remains keeps the residents moving and covers a missed notice.
    if (this.live && !this.pulsing && Date.now() - this.pulsedAt < LIVE_PULSE_MS) return Promise.resolve();
    // Several screens may ask at once; they share one trip.
    this.pulsing ??= (async () => {
      try {
        this.pulsedAt = Date.now();
        await this.call('pulse');
        this.recent.clear();
        this.emit('nearby', 'inbox', 'city', 'artist');
      } finally {
        this.pulsing = null;
      }
    })();
    return this.pulsing;
  }

  // ---- songs and chats ----------------------------------------------------

  async sendSong(toId: string, track: Track, note?: string | null): Promise<SendOutcome> {
    try {
      return await this.write<SendOutcome>('send_song', { p_to: toId, p_track: track, p_note: note ?? null }, 'inbox', 'nearby', 'city');
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      const known = SEND_CODES.find((c) => c === code);
      if (known) throw new SendError(known);
      throw e;
    }
  }
  answerSong(requestId: string, accept: boolean) {
    return this.write<void>('answer_song', { p_request: requestId, p_accept: accept }, 'inbox', 'nearby', 'city');
  }
  getInbox() {
    return this.read<Inbox>('get_inbox');
  }
  getInboxCount() {
    return this.read<number>('get_inbox_count');
  }
  getLink(personId: string) {
    return this.read<Link>('get_link', { p_person: personId });
  }
  getChat(chatId: string) {
    return this.read<Chat | null>('get_chat', { p_chat: chatId });
  }
  async sendMessage(chatId: string, body: string) {
    if (!body.trim()) return;
    await this.write<void>('send_message', { p_chat: chatId, p_body: body }, 'inbox');
  }
  markChatRead(chatId: string) {
    return this.write<void>('mark_chat_read', { p_chat: chatId }, 'inbox');
  }

  // ---- city ---------------------------------------------------------------

  getCityFeed(scope: string) {
    return this.read<CityFeed>('get_city_feed', { p_scope: scope });
  }
  postToCity(track: Track, note: string) {
    return this.write<string>('post_to_city', { p_track: track, p_note: note }, 'city');
  }
  removePost(postId: string) {
    return this.write<void>('remove_post', { p_post: postId }, 'city');
  }
  setHomeCity(city: string) {
    return this.write<void>('set_home_city', { p_city: city }, 'session', 'room', 'city');
  }

  // ---- artists ------------------------------------------------------------

  getArtistSpace(artist: string, scope: string) {
    return this.read<ArtistSpace>('get_artist_space', { p_artist: artist, p_scope: scope });
  }
  getThread(threadId: string) {
    return this.read<Thread | null>('get_thread', { p_thread: threadId });
  }
  startThread(artist: string, title: string, body: string) {
    return this.write<string>('start_thread', { p_artist: artist, p_title: title, p_body: body }, 'artist');
  }
  async replyToThread(threadId: string, body: string, track?: Track | null) {
    if (!body.trim() && !track) return;
    await this.write<void>('reply_to_thread', { p_thread: threadId, p_body: body, p_track: track ?? null }, 'artist');
  }

  // ---- crate, people, rooms -----------------------------------------------

  toggleSave(track: Track) {
    return this.write<boolean>('toggle_save', { p_track: track }, 'crate', 'nearby', 'city');
  }
  getCrate() {
    return this.read<Track[]>('get_crate');
  }
  getPerson(id: string) {
    return this.read<Person | null>('get_person', { p_id: id });
  }
  updateProfile(edit: ProfileEdit) {
    return this.write<void>(
      'update_profile',
      { p_name: edit.name, p_tagline: edit.tagline, p_bio: edit.bio, p_badge: edit.badge, p_badge_color: edit.badgeColor },
      'session',
      'room',
      'nearby',
      'inbox',
    );
  }
  getRoom(personId: string) {
    return this.read<RoomView | null>('get_room', { p_person: personId });
  }
  saveRoom(room: Room, tracks: Track[] = []) {
    return this.write<void>('save_room', { p_room: room, p_tracks: tracks }, 'room');
  }
  signGuestbook(personId: string, track: Track, why: string) {
    return this.write<void>('sign_guestbook', { p_person: personId, p_track: track, p_why: why }, 'room');
  }
}

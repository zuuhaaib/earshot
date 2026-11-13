/**
 * The contract between the screens and wherever the data lives.
 *
 * Today the only implementation is `LocalApi` (SQLite on the phone, with a
 * simulated neighbourhood). A real backend implements this same interface and
 * the screens don't change: they only ever import from '@/data'.
 */
import type { Track } from '@/music/types';
import type {
  AdoptedAccount,
  ArtistSpace,
  Chat,
  CityFeed,
  Inbox,
  Link,
  NewAccount,
  Person,
  ProfileEdit,
  Room,
  RoomView,
  SendOutcome,
  Session,
  Sighting,
  Thread,
} from './types';

/** What changed, so screens showing it can reload. */
export type Topic = 'session' | 'nearby' | 'crate' | 'inbox' | 'room' | 'city' | 'artist';

/** Thrown by sign-up, log-in and password changes. `code` says what went wrong. */
export class AuthError extends Error {
  constructor(
    public code:
      | 'no-such-account'
      | 'wrong-password'
      | 'locked'
      | 'handle-taken'
      | 'bad-handle'
      | 'weak-password'
      | 'resident'
      | 'password-needed',
  ) {
    super(code);
  }
}

/** Thrown by `sendSong` when there's a reason not to. `code` says which. */
export class SendError extends Error {
  constructor(public code: 'self' | 'already-sent' | 'they-sent-first' | 'unknown-person') {
    super(code);
  }
}

export interface EarshotApi {
  /** Where this data lives: on this phone only, or on the backend. A few screens word things differently. */
  readonly kind: 'phone' | 'server';

  // ---- who's holding the phone ------------------------------------------
  getSession(): Promise<Session>;
  /** Accounts that can be signed into on this device. */
  listAccounts(): Promise<Person[]>;
  /** Sign up. The handle is what you log in with, so it must be free. Throws `AuthError`. */
  createAccount(input: NewAccount): Promise<Person>;
  /** Log in with a handle and password. Throws `AuthError`. */
  logIn(handle: string, password: string): Promise<Person>;
  /** Borrow one of the seeded residents (test accounts with no password). Real accounts must use `logIn`. */
  signIn(userId: string): Promise<void>;
  /** Change your password. `current` may be null only if the account has never had one. */
  changePassword(current: string | null, next: string): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Sign this phone in as an account that was verified by the backend. The
   * backend has already checked the password and the email; this records the
   * account here so everything else can hang off it.
   */
  adoptAccount(account: AdoptedAccount): Promise<void>;
  /**
   * Move everything belonging to an account made on this phone (room, crate,
   * chats, posts, threads) over to another account, then remove the old one.
   * Used when a phone-only account gets a real email account.
   */
  moveAccountData(fromId: string, toId: string): Promise<void>;

  // ---- sharing and place ------------------------------------------------
  /** Go on or off air. Going off removes you from Nearby immediately. */
  setSharing(on: boolean): Promise<void>;
  /** Place this phone in a coarse area. The id is all that's kept. */
  setArea(areaId: string, source: 'gps' | 'picked'): Promise<void>;

  // ---- listening --------------------------------------------------------
  /** Set, change or (with null) clear what you're playing. A note makes it a share. */
  setNowPlaying(track: Track | null, note?: string | null): Promise<void>;

  // ---- nearby -----------------------------------------------------------
  /** People sharing in your current area, most present first. */
  getNearby(): Promise<Sighting[]>;
  /**
   * Ask for anything new: nearby listeners, and songs or messages sent to you.
   * Locally, this is what moves the simulation on.
   */
  refreshNearby(): Promise<void>;

  // ---- sending songs and the chats that follow --------------------------
  /**
   * Send someone a song as a hello. If you already have a chat with them it
   * lands in the chat instead. One unanswered song per person: throws
   * `SendError` if you've already sent one or they've sent you one.
   */
  sendSong(toId: string, track: Track, note?: string | null): Promise<SendOutcome>;
  /** Accept (a chat opens) or decline (nothing happens, nobody is told). */
  answerSong(requestId: string, accept: boolean): Promise<void>;
  getInbox(): Promise<Inbox>;
  /** How many things in the inbox want your attention. */
  getInboxCount(): Promise<number>;
  getLink(personId: string): Promise<Link>;
  getChat(chatId: string): Promise<Chat | null>;
  sendMessage(chatId: string, body: string): Promise<void>;
  markChatRead(chatId: string): Promise<void>;

  // ---- city -------------------------------------------------------------
  /**
   * A home area's feed: what people who live there have posted, newest first,
   * and which artists it's paying attention to. `scope` is a city name, or
   * 'GTA' for every city in the region rolled together. Browsable from anywhere.
   */
  getCityFeed(scope: string): Promise<CityFeed>;
  /** Post a song to your home city, with why. Separate from sharing nearby. Resolves to the post's id. */
  postToCity(track: Track, note: string): Promise<string>;
  /** Take down one of your own posts. */
  removePost(postId: string): Promise<void>;
  /** Move home. Your city feed changes; where your phone is does not come into it. */
  setHomeCity(city: string): Promise<void>;

  // ---- artists' local rooms -------------------------------------------
  /**
   * An artist's discussion room for one place. `scope` is a city, or 'GTA' to
   * roll every city's threads into one list.
   */
  getArtistSpace(artist: string, scope: string): Promise<ArtistSpace>;
  getThread(threadId: string): Promise<Thread | null>;
  /** Start a thread in the artist's room for your home city. Resolves to its id. */
  startThread(artist: string, title: string, body: string): Promise<string>;
  /** Reply to a thread, optionally with a song attached. Threads don't close. */
  replyToThread(threadId: string, body: string, track?: Track | null): Promise<void>;

  // ---- your crate (saved tracks) ---------------------------------------
  /** Save or unsave. Resolves to whether it's saved now. */
  toggleSave(track: Track): Promise<boolean>;
  getCrate(): Promise<Track[]>;

  // ---- people -----------------------------------------------------------
  getPerson(id: string): Promise<Person | null>;
  /** Change your name, tagline, bio or badge. */
  updateProfile(edit: ProfileEdit): Promise<void>;

  // ---- rooms (profiles) -------------------------------------------------
  /** Someone's room and everything needed to draw it. New accounts get a starter room. */
  getRoom(personId: string): Promise<RoomView | null>;
  /** Save your own room. `tracks` are any newly chosen songs it refers to. */
  saveRoom(room: Room, tracks?: Track[]): Promise<void>;
  /** Leave a track in someone's guestbook, with why. Signing again replaces your entry. */
  signGuestbook(personId: string, track: Track, why: string): Promise<void>;

  // ---- housekeeping -----------------------------------------------------
  /** Wipe this device back to a fresh install. */
  resetEverything(): Promise<void>;
  /** Be told when a topic changes. Returns an unsubscribe function. */
  subscribe(topic: Topic, listener: () => void): () => void;
}

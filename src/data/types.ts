/**
 * The shapes the screens are built on. Nothing here knows where data lives;
 * the local database and, later, a real backend both hand these back.
 */
import type { TextureName } from '@/ui/print';

import type { Track } from '@/music/types';

export type Person = {
  id: string;
  name: string;
  handle: string;
  /** Two letters on their pin badge, and the badge colour. */
  badge: string;
  badgeColor: string;
  /** One handwritten line shown on their song cards. */
  tagline: string;
  bio: string;
  /** Where their city feed lives. Chosen, not detected, and it never moves. */
  homeCity: string;
  /** True for the residents that ship with the app. */
  seeded: boolean;
};

export type NewAccount = Pick<Person, 'name' | 'handle' | 'badge' | 'badgeColor' | 'homeCity'> & {
  /** At least 8 characters. Stored only as a salted hash. */
  password: string;
};

/**
 * A neighbourhood-sized patch of the map. This is the finest location earshot
 * ever keeps: a name, never coordinates.
 */
export type Area = { id: string; name: string; city: string | null };

export type NearbyStatus = 'playing' | 'played' | 'shared';

/** One person in the Nearby feed. Deliberately has no place or distance on it. */
export type Sighting = {
  /** Stable per person, so a card stays put when their song changes. */
  id: string;
  person: Person;
  track: Track;
  status: NearbyStatus;
  /** Minutes since they played or shared it. 0 while playing. */
  minutesAgo: number;
  /** Only on 'shared': why they put it out there. */
  note: string | null;
  /** Whether you've saved this track. */
  saved: boolean;
  /** Where things stand between you and this person. */
  link: Link;
};

/**
 * Where things stand between you and someone else. A song you sent that was
 * quietly declined still reads as 'sent': nobody is ever told about a no.
 */
export type Link =
  | { kind: 'none' }
  | { kind: 'sent'; id: string }
  | { kind: 'incoming'; id: string }
  | { kind: 'chat'; id: string };

/** A song sent to someone as a hello. */
export type SongRequest = {
  id: string;
  from: Person;
  to: Person;
  track: Track;
  note: string | null;
  /** What the recipient had on when it was sent, if anything. */
  about: Track | null;
  sentAt: number;
};

export type ChatMessage = {
  id: string;
  fromId: string;
  body: string | null;
  /** A song dropped into the conversation. */
  track: Track | null;
  sentAt: number;
};

/** A conversation. It only exists because someone accepted a song, and that song stays on top. */
export type Chat = {
  id: string;
  other: Person;
  opener: SongRequest;
  messages: ChatMessage[];
};

export type ChatSummary = {
  id: string;
  other: Person;
  opener: Track;
  last: { text: string; mine: boolean; at: number } | null;
  unread: number;
};

export type Inbox = {
  /** Songs people sent you that you haven't answered. */
  waiting: SongRequest[];
  chats: ChatSummary[];
  /** Songs you sent that haven't been accepted (or were declined; you can't tell which). */
  sent: SongRequest[];
};

/** What happened when you sent a song. */
export type SendOutcome = { kind: 'request'; id: string } | { kind: 'chat'; id: string };

export type NowPlaying = { track: Track; note: string | null; since: number };

/** Everything about "you, on this phone, right now". */
export type Session = {
  me: Person | null;
  /** On air: people nearby can see what you're playing. */
  sharing: boolean;
  /** The coarse area this phone was last placed in, if any. */
  area: Area | null;
  areaSource: 'gps' | 'picked' | null;
  nowPlaying: NowPlaying | null;
  /** True for an account made before passwords existed, until it sets one. */
  needsPassword: boolean;
  /** True for someone who signed in with Google and hasn't picked a handle and badge yet. */
  needsProfile: boolean;
};

// ---- rooms ----------------------------------------------------------------

export type DisplayFont = 'poster' | 'serifBlack' | 'typeBold' | 'hand';

export type RoomTheme = {
  paper: string;
  card: string;
  ink: string;
  accent: string;
  highlight: string;
  texture: TextureName;
  displayFont: DisplayFont;
  /** How the album wall hangs: a tidy grid, or pinned up any old way. */
  wall: 'grid' | 'scatter';
  /**
   * How the room is laid out. loose: sections sit straight on the paper.
   * pages: each section is its own taped-down page. poster: a big centred
   * name up top and centred headings, like a gig poster.
   */
  layout: 'loose' | 'pages' | 'poster';
};

export type StickerKind = 'star' | 'burst' | 'heart' | 'eye' | 'smile' | 'bolt' | 'flower';

/** A sticker stuck on a section. x and y are fractions of the section's box. */
export type Sticker = { kind: StickerKind; color: string; x: number; y: number; size: number; rotate: number; label?: string };

export type RoomSection =
  | { kind: 'intro'; title: string; songs: { trackId: string; why: string }[]; stickers?: Sticker[] }
  | { kind: 'pinned'; title: string; trackId: string | null; note: string; stickers?: Sticker[] }
  | { kind: 'wall'; title: string; trackIds: string[]; stickers?: Sticker[] }
  | { kind: 'shelf'; title: string; trackIds: string[]; stickers?: Sticker[] }
  | { kind: 'liner'; title: string; notes: { trackId?: string; text: string }[]; stickers?: Sticker[] }
  | { kind: 'guestbook'; title: string; entries: GuestbookEntry[]; stickers?: Sticker[] }
  | {
      kind: 'recent';
      title: string;
      /** shown: listed. hidden: the section stays but says it's private. (Off entirely = no section.) */
      visibility: 'shown' | 'hidden';
      trackIds: string[];
      stickers?: Sticker[];
    };

export type GuestbookEntry = { fromId: string; trackId: string; why: string; at?: number };

export type SectionKind = RoomSection['kind'];

export type Room = {
  personId: string;
  theme: RoomTheme;
  sections: RoomSection[];
};

/** A room plus everything needed to draw it: the tracks and people it mentions. */
export type RoomView = {
  person: Person;
  room: Room;
  tracks: Record<string, Track>;
  people: Record<string, Person>;
  /** True when it's your own room (you can decorate it). */
  mine: boolean;
};

/** The parts of your profile you can change after signing up. */
export type ProfileEdit = Pick<Person, 'name' | 'tagline' | 'bio' | 'badge' | 'badgeColor'>;

/** A song someone posted to their home city, with why. */
export type CityPost = {
  id: string;
  person: Person;
  track: Track;
  note: string;
  /** The city it was posted to (the author's home at the time). */
  city: string;
  postedAt: number;
  saved: boolean;
  link: Link;
  /** True when you posted it (you can take it down). */
  mine: boolean;
};

/** An artist a city has been posting and playing lately. */
export type ArtistHeat = { artist: string; posts: number; plays: number; artworkUrl: string };

/** A city's feed, or the whole region's when the scope is 'GTA'. */
export type CityFeed = { scope: string; posts: CityPost[]; trending: ArtistHeat[] };

/** One conversation in an artist's local room, as it appears in the list. */
export type ThreadSummary = {
  id: string;
  artist: string;
  /** The city it was started in (its starter's home). */
  city: string;
  title: string;
  starter: Person;
  startedAt: number;
  replies: number;
  /** When anything last happened in it. */
  lastAt: number;
  last: { person: Person; text: string } | null;
};

/**
 * An artist's room for one place: "Big Thief · Toronto", or "Big Thief · GTA",
 * which rolls up every city in the region so small artists still have company.
 */
export type ArtistSpace = {
  artist: string;
  scope: string;
  /** Their songs we know about, for previews. */
  tracks: Track[];
  /** People in this place who've had them on or posted them lately. */
  listeners: Person[];
  threads: ThreadSummary[];
  /** For a single city: how many more threads the rest of the region has. */
  elsewhere: number;
};

export type ThreadReply = { id: string; person: Person; body: string; track: Track | null; at: number };

export type Thread = {
  id: string;
  artist: string;
  city: string;
  title: string;
  body: string;
  starter: Person;
  startedAt: number;
  replies: ThreadReply[];
};

/** An account that lives on the backend, as the phone needs to know it. */
export type AdoptedAccount = Pick<Person, 'id' | 'name' | 'handle' | 'badge' | 'badgeColor' | 'tagline' | 'bio' | 'homeCity'>;

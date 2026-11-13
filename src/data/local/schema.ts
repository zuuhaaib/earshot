/**
 * Database migrations, oldest first. Never edit one that has shipped; add a
 * new one to the end. `meta.schema_version` records how many have run.
 */
export const migrations: string[] = [
  // 1: accounts, tracks, listening, saves, and the simulation's bookkeeping
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    handle TEXT NOT NULL UNIQUE,
    badge TEXT NOT NULL,
    badge_color TEXT NOT NULL,
    tagline TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    home_city TEXT NOT NULL,
    seeded INTEGER NOT NULL DEFAULT 0,
    sharing INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE tracks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT NOT NULL DEFAULT '',
    year INTEGER,
    genre TEXT NOT NULL DEFAULT '',
    artwork_url TEXT NOT NULL,
    preview_url TEXT
  );

  -- Everything anyone has played or shared. area_id is a coarse area id and is
  -- NULL for private listening: only rows with an area can show up in Nearby.
  CREATE TABLE plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    track_id TEXT NOT NULL REFERENCES tracks(id),
    kind TEXT NOT NULL CHECK (kind IN ('play', 'share')),
    note TEXT,
    area_id TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER
  );
  CREATE INDEX plays_by_area ON plays (area_id, started_at);
  CREATE INDEX plays_by_user ON plays (user_id, started_at);

  CREATE TABLE saves (
    user_id TEXT NOT NULL REFERENCES users(id),
    track_id TEXT NOT NULL REFERENCES tracks(id),
    saved_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, track_id)
  );

  -- Simulation only: which seeded residents are "around" which area, and until when.
  CREATE TABLE presence (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    area_id TEXT NOT NULL,
    until INTEGER NOT NULL
  );
  `,

  // 2: songs sent as a hello, and the chats that open when one is accepted
  `
  CREATE TABLE requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id TEXT NOT NULL REFERENCES users(id),
    to_id TEXT NOT NULL REFERENCES users(id),
    track_id TEXT NOT NULL REFERENCES tracks(id),
    note TEXT,
    about_track_id TEXT REFERENCES tracks(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at INTEGER NOT NULL,
    answered_at INTEGER
  );
  CREATE INDEX requests_to ON requests (to_id, status);
  CREATE INDEX requests_from ON requests (from_id, status);

  -- A chat is an accepted request; messages hang off its id.
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    from_id TEXT NOT NULL REFERENCES users(id),
    body TEXT,
    track_id TEXT REFERENCES tracks(id),
    created_at INTEGER NOT NULL
  );
  CREATE INDEX messages_by_chat ON messages (request_id, created_at);

  CREATE TABLE chat_reads (
    request_id INTEGER NOT NULL REFERENCES requests(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    read_at INTEGER NOT NULL,
    PRIMARY KEY (request_id, user_id)
  );
  `,

  // 3: rooms (profiles). One JSON document per person: their look and their furniture.
  `
  CREATE TABLE rooms (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    doc TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `,

  // 4: city posts. A song, why, and the home city it was posted to.
  `
  CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    track_id TEXT NOT NULL REFERENCES tracks(id),
    note TEXT NOT NULL,
    city TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    seeded INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX posts_by_city ON posts (city, created_at);
  `,

  // 5: artists' local rooms. A thread belongs to an artist and a city; replies hang off it.
  `
  CREATE TABLE threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_key TEXT NOT NULL,
    artist TEXT NOT NULL,
    city TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    seeded INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX threads_by_artist ON threads (artist_key, city);

  CREATE TABLE replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES threads(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL DEFAULT '',
    track_id TEXT REFERENCES tracks(id),
    created_at INTEGER NOT NULL,
    seeded INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX replies_by_thread ON replies (thread_id, created_at);
  `,

  // 6: passwords. A random salt and a stretched hash; never the password itself.
  `
  ALTER TABLE users ADD COLUMN pass_salt TEXT;
  ALTER TABLE users ADD COLUMN pass_hash TEXT;
  `,

  // 7: safety. Who you've blocked, and reports (which, with no server, stay on this phone).
  `
  CREATE TABLE blocks (
    user_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, blocked_id)
  );
  CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id TEXT NOT NULL,
    about_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    context TEXT,
    created_at INTEGER NOT NULL
  );
  `,

  // 8: deleting a chat, for one side only. Messages after hidden_at show again.
  `
  CREATE TABLE chat_hides (
    request_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    hidden_at INTEGER NOT NULL,
    PRIMARY KEY (request_id, user_id)
  );
  `,
];

export const ALL_TABLES = ['chat_hides', 'reports', 'blocks', 'replies', 'threads', 'posts', 'rooms', 'chat_reads', 'messages', 'requests', 'presence', 'saves', 'plays', 'tracks', 'users', 'meta'];

// earshot: keeps people's song in step with Last.fm while their app is closed.
//
// A phone can only follow Last.fm while earshot is open. This function runs every
// minute on a schedule: it asks the database who is sharing with Last.fm linked,
// asks Last.fm what each of them has on, and puts the song on (or takes it off)
// in the database, the same way the phone would.
//
// Setting it up (Supabase dashboard):
//   1. Run supabase/schema.sql again (it adds what this needs).
//   2. Edge Functions → Secrets: add CRON_SECRET, any long random string. LASTFM_API_KEY is already there.
//   3. Deploy this file as a function named exactly "lastfm-sync", with "Verify JWT" OFF
//      (the schedule calls it with CRON_SECRET instead of a login).
//   4. Integrations → Cron → Create job: every minute (* * * * *), type "Supabase Edge Function",
//      POST to lastfm-sync, with a header  x-earshot-cron: <the same CRON_SECRET>.
//
// The matching below mirrors src/lastfm/match.ts and src/spotify/match.ts in the app;
// change both together. (A single file, so it can be pasted into the dashboard.)

const LASTFM = 'https://ws.audioscrobbler.com/2.0/';
// shortcut: 200 people a run, 4 Last.fm calls a second (Last.fm asks for about 5). Past ~200 people sharing
// with Last.fm, each is checked less often than every minute; split into more runs or a queue when that matters.
const PER_RUN = 200;
const AT_ONCE = 4;
const PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f'; // Last.fm's grey star when it has no cover

export type Playing = { key: string; title: string; artist: string; album: string; artworkUrl: string };
export type Track = {
  id: string;
  sourceId: string;
  title: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string;
  artworkUrl: string;
  previewUrl: string | null;
};
type Text = { '#text'?: string } | string | undefined;
const text = (v: Text) => (typeof v === 'string' ? v : (v?.['#text'] ?? '')).trim();

/** What a user.getRecentTracks answer says is on right now, or null. */
export function readNowPlaying(json: unknown): Playing | null {
  const list = (json as { recenttracks?: { track?: unknown } } | null)?.recenttracks?.track;
  const first = (Array.isArray(list) ? list[0] : list) as
    | { name?: string; artist?: Text | { name?: string }; album?: Text; image?: { '#text'?: string }[]; '@attr'?: { nowplaying?: string } }
    | undefined;
  if (!first || first['@attr']?.nowplaying !== 'true') return null;
  const title = (first.name ?? '').trim();
  const artist = text(first.artist as Text) || ((first.artist as { name?: string } | undefined)?.name ?? '').trim();
  if (!title || !artist) return null;
  const covers = (first.image ?? []).map((i) => (i['#text'] ?? '').trim()).filter((u) => u && !u.includes(PLACEHOLDER));
  return { key: `${artist.toLowerCase()}|${title.toLowerCase()}`, title, artist, album: text(first.album), artworkUrl: covers[covers.length - 1] ?? '' };
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\s-\s.*$/, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The same song from iTunes if it's a confident match, else Last.fm's own details, else null (no cover anywhere). */
export function pickTrack(playing: Playing, candidates: Track[]): Track | null {
  const title = norm(playing.title);
  const artist = norm(playing.artist);
  const sameArtist = (t: Track) => norm(t.artist).includes(artist) || artist.includes(norm(t.artist));
  const match =
    candidates.find((t) => sameArtist(t) && norm(t.title) === title) ??
    candidates.find((t) => sameArtist(t) && (norm(t.title).startsWith(title) || title.startsWith(norm(t.title))));
  if (match) return match;
  if (!playing.artworkUrl) return null;
  const id = `lastfm:${playing.key.replace(/[^a-z0-9|]+/g, '-')}`;
  return { id, sourceId: id, title: playing.title, artist: playing.artist, album: playing.album, year: null, genre: '', artworkUrl: playing.artworkUrl, previewUrl: null };
}

type ItunesSong = { trackId: number; trackName: string; artistName: string; collectionName?: string; releaseDate?: string; primaryGenreName?: string; artworkUrl100: string; previewUrl?: string };

async function itunes(term: string): Promise<Track[]> {
  try {
    const res = await fetch(`https://itunes.apple.com/search?media=music&entity=song&country=CA&limit=8&term=${encodeURIComponent(term)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { results: ItunesSong[] };
    return json.results
      .filter((r) => r.trackId && r.trackName && r.artworkUrl100)
      .map((r) => ({
        id: `itunes:${r.trackId}`,
        sourceId: String(r.trackId),
        title: r.trackName,
        artist: r.artistName,
        album: r.collectionName ?? '',
        year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null,
        genre: r.primaryGenreName ?? '',
        artworkUrl: r.artworkUrl100.replace('100x100bb', '600x600bb'),
        previewUrl: r.previewUrl ?? null,
      }));
  } catch {
    return [];
  }
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // a legacy service key is a JWT and goes in Authorization too; a new sb_secret_ key goes in apikey only
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

type Due = { id: string; user: string; key: string | null };

async function checkOne(person: Due, apiKey: string): Promise<void> {
  const q = new URLSearchParams({ method: 'user.getrecenttracks', user: person.user, api_key: apiKey, format: 'json', limit: '1' });
  const res = await fetch(`${LASTFM}?${q}`).catch(() => null);
  const json = res ? await res.json().catch(() => null) : null;
  if (!json || (json as { error?: number }).error !== undefined) return; // private, renamed or Last.fm is busy: try next time
  const playing = readNowPlaying(json);
  if (!playing) {
    if (person.key) await rpc('lastfm_set', { p_id: person.id, p_key: null, p_track: null });
    return;
  }
  if (playing.key === person.key) return; // same song as last time
  const track = pickTrack(playing, await itunes(`${playing.artist} ${playing.title}`));
  await rpc('lastfm_set', { p_id: person.id, p_key: playing.key, p_track: track });
}

async function handle(req: Request): Promise<Response> {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-earshot-cron') !== secret) return new Response('no', { status: 401 });
  const apiKey = Deno.env.get('LASTFM_API_KEY');
  if (!apiKey) return new Response('no LASTFM_API_KEY', { status: 503 });

  const due = (await rpc('lastfm_due', { p_limit: PER_RUN })) as Due[];
  let failed = 0;
  for (let i = 0; i < due.length; i += AT_ONCE) {
    const started = Date.now();
    const results = await Promise.allSettled(due.slice(i, i + AT_ONCE).map((p) => checkOne(p, apiKey)));
    failed += results.filter((r) => r.status === 'rejected').length;
    const wait = 1000 - (Date.now() - started); // keep to AT_ONCE Last.fm calls a second
    if (wait > 0 && i + AT_ONCE < due.length) await new Promise((r) => setTimeout(r, wait));
  }
  return new Response(JSON.stringify({ checked: due.length, failed }), { headers: { 'Content-Type': 'application/json' } });
}

// Guarded so the tests can import the matching under Node.
if (typeof Deno !== 'undefined') Deno.serve(handle);

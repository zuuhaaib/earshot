import type { Track } from '@/music/types';
import { cleanUsername, looksLikeUsername, readProblem, readRecent, readUser, toLastfmTrack } from '../match';

const entry = (over: Record<string, unknown> = {}) => ({
  name: 'Not',
  artist: { '#text': 'Big Thief', mbid: '' },
  album: { '#text': 'Two Hands' },
  image: [
    { size: 'small', '#text': 'https://img/34.jpg' },
    { size: 'extralarge', '#text': 'https://img/300.jpg' },
  ],
  '@attr': { nowplaying: 'true' },
  ...over,
});
const answer = (...tracks: unknown[]) => ({ recenttracks: { track: tracks, '@attr': { user: 'someone' } } });

const itunes = (artist: string, title: string): Track => ({
  id: 'itunes:1',
  sourceId: '1',
  title,
  artist,
  album: 'An Album',
  year: 2019,
  genre: 'Alternative',
  artworkUrl: 'https://art/600x600bb.jpg',
  previewUrl: 'https://preview.m4a',
});

describe('reading what Last.fm says is playing', () => {
  it('takes the song marked as playing now, with the biggest cover', () => {
    expect(readRecent(answer(entry(), entry({ name: 'Older', '@attr': undefined })))).toEqual({
      key: 'big thief|not',
      title: 'Not',
      artist: 'Big Thief',
      album: 'Two Hands',
      artworkUrl: 'https://img/300.jpg',
    });
  });

  it('ignores a song that has finished, however recent', () => {
    expect(readRecent(answer(entry({ '@attr': undefined, date: { uts: '1794540000' } })))).toBeNull();
    expect(readRecent(answer())).toBeNull();
    expect(readRecent({})).toBeNull();
    expect(readRecent(null)).toBeNull();
  });

  it('copes with a single entry that isn’t wrapped in a list, and the other artist shape', () => {
    expect(readRecent({ recenttracks: { track: entry({ artist: { name: 'Big Thief' } }) } })?.artist).toBe('Big Thief');
  });

  it('treats Last.fm’s grey placeholder star as no cover', () => {
    const star = [{ '#text': 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png' }];
    expect(readRecent(answer(entry({ image: star })))?.artworkUrl).toBe('');
  });

  it('says why when Last.fm refuses', () => {
    expect(readProblem({ error: 6, message: 'User not found' })).toBe('no-such-user');
    expect(readProblem({ error: 17, message: 'Login: User required to be logged in' })).toBe('private');
    expect(readProblem({ error: 10, message: 'Invalid API key' })).toBe('bad-key');
    expect(readProblem({ error: 29 })).toBe('busy');
    expect(readProblem({ error: 8 })).toBe('network');
    expect(readProblem(answer(entry()))).toBeNull();
    expect(readProblem(null)).toBe('network');
  });

  it('reads the username as Last.fm spells it', () => {
    expect(readUser({ user: { name: 'SomeOne' } })).toBe('SomeOne');
    expect(readUser({})).toBeNull();
  });
});

describe('turning it into a track', () => {
  const playing = readRecent(answer(entry()))!;

  it('prefers the same song from the music source, so it has a preview', () => {
    expect(toLastfmTrack(playing, [itunes('Big Thief', 'Not')])?.id).toBe('itunes:1');
  });

  it('falls back to Last.fm’s own details when there is no match', () => {
    expect(toLastfmTrack(playing, [itunes('Someone Else', 'Not')])).toMatchObject({
      id: 'lastfm:big-thief|not',
      title: 'Not',
      artist: 'Big Thief',
      artworkUrl: 'https://img/300.jpg',
      previewUrl: null,
    });
  });

  it('gives up when there is no match and no cover', () => {
    expect(toLastfmTrack({ ...playing, artworkUrl: '' }, [])).toBeNull();
  });
});

describe('usernames', () => {
  it('accepts a name, an @name or a profile address', () => {
    expect(cleanUsername('  @some_one ')).toBe('some_one');
    expect(cleanUsername('https://www.last.fm/user/some-one/library')).toBe('some-one');
    expect(looksLikeUsername('some_one')).toBe(true);
    expect(looksLikeUsername('a')).toBe(false);
    expect(looksLikeUsername('has spaces')).toBe(false);
    expect(looksLikeUsername('way-too-long-a-name')).toBe(false);
  });
});

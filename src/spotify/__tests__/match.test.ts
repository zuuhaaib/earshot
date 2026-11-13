import type { Track } from '@/music/types';
import { decide, readPlaying, toTrack, type SpotifyPlaying } from '../match';

const response = (over: Record<string, unknown> = {}) => ({
  is_playing: true,
  currently_playing_type: 'track',
  item: {
    id: 'sp1',
    name: 'Not - 2019 Remaster',
    artists: [{ name: 'Big Thief' }, { name: 'Someone Else' }],
    album: { name: 'Two Hands', release_date: '2019-10-11', images: [{ url: 'https://img/large' }, { url: 'https://img/small' }] },
  },
  ...over,
});

const itunes = (id: string, artist: string, title: string): Track => ({
  id: `itunes:${id}`,
  sourceId: id,
  title,
  artist,
  album: 'An Album',
  year: 2019,
  genre: 'Alternative',
  artworkUrl: 'https://art/600x600bb.jpg',
  previewUrl: 'https://preview.m4a',
});

describe('reading what Spotify says is playing', () => {
  it('takes the track, the first artist and the biggest cover', () => {
    expect(readPlaying(response())).toEqual({
      spotifyId: 'sp1',
      title: 'Not - 2019 Remaster',
      artist: 'Big Thief',
      album: 'Two Hands',
      year: 2019,
      artworkUrl: 'https://img/large',
    });
  });

  it('treats paused, ads, podcasts and silence as nothing playing', () => {
    expect(readPlaying(response({ is_playing: false }))).toBeNull();
    expect(readPlaying(response({ currently_playing_type: 'ad' }))).toBeNull();
    expect(readPlaying(response({ currently_playing_type: 'episode' }))).toBeNull();
    expect(readPlaying(response({ item: null }))).toBeNull();
    expect(readPlaying(null)).toBeNull();
    expect(readPlaying('')).toBeNull();
    expect(readPlaying({})).toBeNull();
  });
});

describe('finding the same song in earshot’s own catalogue', () => {
  const playing = readPlaying(response()) as SpotifyPlaying;

  it('matches past remaster and live suffixes, and ignores other artists’ songs of the same name', () => {
    const found = toTrack(playing, [itunes('1', 'Some Covers Band', 'Not'), itunes('2', 'Big Thief', 'Not'), itunes('3', 'Big Thief', 'Shark Smile')]);
    expect(found.id).toBe('itunes:2');
    expect(found.previewUrl).not.toBeNull();
    expect(toTrack({ ...playing, title: 'Sinnerman', artist: 'Nina Simone' }, [itunes('9', 'Nina Simone', 'Sinnerman (Live In New York/1965)')]).id).toBe('itunes:9');
  });

  it('falls back to Spotify’s own details, without a preview, when nothing matches', () => {
    const lone = toTrack(playing, [itunes('1', 'Some Covers Band', 'Not')]);
    expect(lone).toMatchObject({ id: 'spotify:sp1', title: 'Not - 2019 Remaster', artist: 'Big Thief', previewUrl: null, artworkUrl: 'https://img/large' });
    expect(toTrack(playing, []).id).toBe('spotify:sp1');
  });
});

describe('deciding what to do with Spotify’s answer', () => {
  const song = (id: string) => ({ ...(readPlaying(response()) as SpotifyPlaying), spotifyId: id });

  it('puts a new song on, once', () => {
    expect(decide({ playing: song('a'), lastActedOn: null, oursIsOn: false })).toEqual({ do: 'set', spotifyId: 'a' });
    expect(decide({ playing: song('a'), lastActedOn: 'a', oursIsOn: true })).toEqual({ do: 'nothing' });
    expect(decide({ playing: song('b'), lastActedOn: 'a', oursIsOn: true })).toEqual({ do: 'set', spotifyId: 'b' });
  });

  it('leaves a song you picked by hand alone until Spotify changes song', () => {
    // Spotify is still on 'a', but you chose something else in earshot
    expect(decide({ playing: song('a'), lastActedOn: 'a', oursIsOn: false })).toEqual({ do: 'nothing' });
    expect(decide({ playing: song('b'), lastActedOn: 'a', oursIsOn: false })).toEqual({ do: 'set', spotifyId: 'b' });
  });

  it('takes the song off when Spotify stops, but only if Spotify put it on', () => {
    expect(decide({ playing: null, lastActedOn: 'a', oursIsOn: true })).toEqual({ do: 'clear' });
    expect(decide({ playing: null, lastActedOn: 'a', oursIsOn: false })).toEqual({ do: 'nothing' });
    expect(decide({ playing: null, lastActedOn: null, oursIsOn: false })).toEqual({ do: 'nothing' });
  });
});

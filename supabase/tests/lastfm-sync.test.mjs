// The lastfm-sync function's reading of Last.fm and its matching against iTunes.
//
//   npm run test:server
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTrack, readNowPlaying } from '../functions/lastfm-sync/index.ts';

const answer = (attr, image = 'https://lastfm-img.freetls.fastly.net/i/u/300x300/abc.jpg') => ({
  recenttracks: { track: [{ name: 'Regulate', artist: { '#text': 'Racing Mount Pleasant' }, album: { '#text': 'Grip' }, image: [{ '#text': image }], '@attr': attr }] },
});
const itunesCopy = { id: 'itunes:9', sourceId: '9', title: 'Regulate (Live)', artist: 'Racing Mount Pleasant', album: 'Grip', year: 2025, genre: 'Rock', artworkUrl: 'https://is1-ssl.mzstatic.com/a.jpg', previewUrl: null };

test('only a song marked as playing right now counts', () => {
  assert.equal(readNowPlaying(answer(undefined)), null, 'finished earlier');
  assert.equal(readNowPlaying({ recenttracks: { track: [] } }), null);
  assert.equal(readNowPlaying(answer({ nowplaying: 'true' })).key, 'racing mount pleasant|regulate');
});

test('an iTunes copy wins; otherwise Last.fm’s cover; with no cover, nothing', () => {
  const playing = readNowPlaying(answer({ nowplaying: 'true' }));
  assert.equal(pickTrack(playing, [itunesCopy]).id, 'itunes:9');
  const own = pickTrack(playing, []);
  assert.equal(own.id, 'lastfm:racing-mount-pleasant|regulate');
  assert.equal(own.artworkUrl, 'https://lastfm-img.freetls.fastly.net/i/u/300x300/abc.jpg');
  const star = readNowPlaying(answer({ nowplaying: 'true' }, 'https://lastfm.freetls.fastly.net/i/u/2a96cbd8b46e442fc41c2b86b821562f.png'));
  assert.equal(pickTrack(star, []), null);
});

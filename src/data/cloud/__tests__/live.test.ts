import { channelsFor, CloudApi, slug, type Listen } from '../CloudApi';

const ME = { id: 'u1', name: 'Me', handle: 'me', badge: 'ME', badgeColor: '#fff', tagline: '', bio: '', homeCity: 'Richmond Hill' };

function setUp(areaId: string | null = 'to-queen-west') {
  const session = { me: ME as typeof ME | null, sharing: true, areaId, areaSource: 'picked', nowPlaying: null, needsProfile: false };
  const calls: string[] = [];
  const listening: { topics: string[]; notice: (what: string) => void; state: (live: boolean) => void; stopped: boolean }[] = [];
  const listen: Listen = (topics, notice, state) => {
    const entry = { topics, notice, state, stopped: false };
    listening.push(entry);
    return () => {
      entry.stopped = true;
    };
  };
  const api = new CloudApi(
    async (fn) => {
      calls.push(fn);
      return fn === 'get_session' ? { ...session } : null;
    },
    async () => {},
    async () => session.me !== null,
    listen,
  );
  return { api, session, calls, listening };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('channel names match what the server allows', () => {
  expect(slug('Richmond Hill')).toBe('richmond-hill');
  expect(slug('  St. Catharines!')).toBe('st-catharines');
  expect(channelsFor(ME, 'to-annex')).toEqual(['person:u1', 'city:richmond-hill', 'area:to-annex']);
  expect(channelsFor(ME, null)).toEqual(['person:u1', 'city:richmond-hill']);
  expect(channelsFor(null, 'to-annex')).toEqual([]);
});

test('listens for whoever is logged in, follows them to a new area, and stops at log-out', async () => {
  const { api, session, listening } = setUp();
  await api.getSession();
  await api.getSession();
  expect(listening).toHaveLength(1);
  expect(listening[0].topics).toEqual(['person:u1', 'city:richmond-hill', 'area:to-queen-west']);

  session.areaId = 'to-annex';
  await api.setArea('to-annex', 'picked');
  await api.getSession();
  expect(listening[0].stopped).toBe(true);
  expect(listening[1].topics).toContain('area:to-annex');

  session.me = null;
  await api.signOut();
  expect(listening[1].stopped).toBe(true);
  expect(listening).toHaveLength(2);
});

test('a burst of notices reloads the right screens once', async () => {
  const { api, listening } = setUp();
  await api.getSession();
  const reloads: string[] = [];
  for (const topic of ['inbox', 'nearby', 'city', 'artist', 'room', 'crate', 'session'] as const) api.subscribe(topic, () => reloads.push(topic));

  listening[0].notice('nearby');
  listening[0].notice('nearby');
  listening[0].notice('nearby');
  expect(reloads).toEqual([]);
  jest.advanceTimersByTime(200);
  expect(reloads).toEqual(['nearby']);

  reloads.length = 0;
  listening[0].notice('inbox');
  jest.advanceTimersByTime(200);
  expect(reloads.sort()).toEqual(['city', 'inbox', 'nearby']);

  reloads.length = 0;
  listening[0].notice('something-new');
  jest.advanceTimersByTime(200);
  expect(reloads.sort()).toEqual(['artist', 'city', 'inbox', 'nearby', 'room']);
});

test('asks the server "anything new?" far less often while notices are live', async () => {
  const { api, calls, listening } = setUp();
  await api.getSession();
  const pulses = () => calls.filter((c) => c === 'pulse').length;

  await api.refreshNearby();
  await api.refreshNearby();
  expect(pulses()).toBe(2); // not connected yet: every beat goes

  listening[0].state(true);
  await api.refreshNearby();
  await api.refreshNearby();
  expect(pulses()).toBe(2);
  jest.advanceTimersByTime(16_000);
  await api.refreshNearby();
  expect(pulses()).toBe(3);

  listening[0].state(false); // connection lost: back to every beat
  await api.refreshNearby();
  expect(pulses()).toBe(4);
});

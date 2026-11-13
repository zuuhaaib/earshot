import { LocalApi } from '../local/LocalApi';
import { rng } from '@/sim/simulator';
import seedTracks from '@/seed/tracks.json';
import type { Track } from '@/music/types';
import { memoryDriver } from './helpers/nodeDriver';
import { nodeSecurity } from './helpers/nodeSecurity';

const tracks = Object.values(seedTracks as Record<string, Track>);
const START = Date.UTC(2026, 10, 12, 17, 0, 0);
const newbie = { name: 'Test Person', handle: 'test.person', badge: 'TP', badgeColor: '#fff', homeCity: 'Toronto', password: 'correct horse 9' };

/** A new account, placed on a busy street. */
async function onTheStreet() {
  const clock = { now: START };
  const api = new LocalApi(memoryDriver(), () => clock.now, rng(7), nodeSecurity);
  await api.init();
  const me = await api.createAccount(newbie);
  await api.setArea('to-queen-west', 'picked');
  await api.refreshNearby();
  return { api, me, clock };
}

describe('blocking (phone-only data)', () => {
  it('hides someone nearby, in the city feed and by room, and can be undone', async () => {
    const { api } = await onTheStreet();
    const before = await api.getNearby();
    const them = before[0].person;
    await api.signGuestbook(them.id, tracks[0], 'nice room');

    await api.blockPerson(them.id);
    expect((await api.getNearby()).some((s) => s.person.id === them.id)).toBe(false);
    expect((await api.getNearby()).length).toBe(before.length - 1);
    expect(await api.getRoom(them.id)).toBeNull();
    expect((await api.getCityFeed('GTA')).posts.some((p) => p.person.id === them.id)).toBe(false);
    await expect(api.sendSong(them.id, tracks[0])).rejects.toMatchObject({ code: 'unknown-person' });
    expect((await api.getBlocked()).map((p) => p.id)).toEqual([them.id]);

    await api.unblockPerson(them.id);
    expect(await api.getBlocked()).toEqual([]);
    expect((await api.getNearby()).some((s) => s.person.id === them.id)).toBe(true);
    // the signature left before the block was torn out with it
    const book = (await api.getRoom(them.id))!.room.sections.find((s) => s.kind === 'guestbook');
    expect(book && book.kind === 'guestbook' ? book.entries.some((e) => e.fromId !== them.id && e.why === 'nice room') : false).toBe(false);
  });

  it('refuses to block yourself or nobody', async () => {
    const { api, me } = await onTheStreet();
    await expect(api.blockPerson(me.id)).rejects.toThrow('self');
    await expect(api.blockPerson('nobody-at-all')).rejects.toThrow('unknown-person');
  });
});

describe('deleting your account (phone-only data)', () => {
  it('removes the account and what it made, signs out, and leaves the residents alone', async () => {
    const { api, me } = await onTheStreet();
    const them = (await api.getNearby())[0].person;
    await api.toggleSave(tracks[1]);
    await api.postToCity(tracks[2], 'listen to this');
    await api.signGuestbook(them.id, tracks[3], 'hello from a ghost');
    await api.sendSong(them.id, tracks[4], 'hi');
    await api.reportPerson(them.id, 'spam', 'testing', null);

    await api.deleteAccount();

    expect((await api.getSession()).me).toBeNull();
    expect(await api.getPerson(me.id)).toBeNull();
    expect((await api.listAccounts()).some((p) => p.id === me.id)).toBe(false);
    expect((await api.getCityFeed('GTA')).posts.some((p) => p.person.id === me.id)).toBe(false);
    const book = (await api.getRoom(them.id))!.room.sections.find((s) => s.kind === 'guestbook');
    expect(book && book.kind === 'guestbook' ? book.entries.some((e) => e.fromId === me.id) : true).toBe(false);
    expect(await api.getPerson(them.id)).not.toBeNull();

    // the handle is free again
    expect((await api.createAccount(newbie)).handle).toBe('test.person');
  });

  it('will not delete a resident', async () => {
    const { api } = await onTheStreet();
    const them = (await api.getNearby())[0].person;
    await api.signOut();
    await api.signIn(them.id);
    await expect(api.deleteAccount()).rejects.toMatchObject({ code: 'resident' });
  });
});

describe('deleting a chat (phone-only data)', () => {
  it('clears it from your side, keeps you connected, and comes back with only what is new', async () => {
    const { api, me, clock } = await onTheStreet();
    const them = (await api.getNearby())[0].person;
    await api.sendSongAs(them.id, me.id, tracks[0].id, 'for you');
    const waiting = (await api.getInbox()).waiting[0];
    await api.answerSong(waiting.id, true);
    await api.sendMessage(waiting.id, 'thanks');
    clock.now += 1000;

    await api.deleteChat(waiting.id);
    expect((await api.getInbox()).chats).toEqual([]);
    expect((await api.getChat(waiting.id))?.messages).toEqual([]);
    expect((await api.getLink(them.id)).kind).toBe('chat');
    expect(await api.getBlocked()).toEqual([]);

    clock.now += 1000;
    await api.sayAs(waiting.id, them.id, 'still there?');
    const chats = (await api.getInbox()).chats;
    expect(chats.map((c) => [c.last?.text, c.unread])).toEqual([['still there?', 1]]);
    expect((await api.getChat(waiting.id))?.messages.map((m) => m.body)).toEqual(['still there?']);
  });

  it('refuses a chat that is not yours', async () => {
    const { api } = await onTheStreet();
    await expect(api.deleteChat('999')).rejects.toThrow('not-your-chat');
  });
});

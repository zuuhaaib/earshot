/**
 * Shown once earshot's data lives on the backend, if this phone still holds
 * an account from before: offers to bring its room and crate across.
 */
import React, { useEffect, useState } from 'react';
import { useApi, openPhone, type Room } from '@/data';
import type { Track } from '@/music';
import { colors } from '@/theme';
import { Card, InkLink, PosterButton, Txt } from './print';
import { useSlip } from './Slip';

const DONE_KEY = 'earshot.phone-import';

type Found = { handle: string; room: Room; tracks: Track[]; crate: Track[]; tagline: string; bio: string };

// localStorage is provided on phones by expo-sqlite (installed by the backend account code) and natively on web.
const remembered = () => {
  try {
    return globalThis.localStorage?.getItem(DONE_KEY) === 'yes';
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    globalThis.localStorage?.setItem(DONE_KEY, 'yes');
  } catch {}
};

export function PhoneImportCard() {
  const api = useApi();
  const slip = useSlip();
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (remembered()) return;
    let alive = true;
    openPhone()
      .then((phone) => phone.exportPhoneAccount())
      .then((x) => {
        if (alive && x) setFound({ handle: x.person.handle, room: x.room, tracks: x.tracks, crate: x.crate, tagline: x.person.tagline, bio: x.person.bio });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!found) return null;

  const bring = async () => {
    setBusy(true);
    try {
      const { me } = await api.getSession();
      if (!me) return;
      // The room, minus the guestbook (those entries were signed by this phone's test residents) and with your id on it.
      const sections = found.room.sections.map((s) => (s.kind === 'guestbook' ? { ...s, entries: [] } : s));
      await api.saveRoom({ personId: me.id, theme: found.room.theme, sections }, found.tracks);
      const have = new Set((await api.getCrate()).map((t) => t.id));
      for (const t of found.crate) if (!have.has(t.id)) await api.toggleSave(t);
      if ((found.tagline || found.bio) && !me.tagline && !me.bio) {
        await api.updateProfile({ name: me.name, badge: me.badge, badgeColor: me.badgeColor, tagline: found.tagline, bio: found.bio });
      }
      remember();
      setFound(null);
      slip('Moved in. Your room and crate are on the server now.');
    } catch {
      slip('That didn’t carry over. Nothing was lost; try again.');
      setBusy(false);
    }
  };

  return (
    <Card rotate={-0.6} style={{ marginTop: 26 }} fill={colors.highlighter} innerStyle={{ padding: 14 }}>
      <Txt variant="titleSm">There’s an older account on this phone.</Txt>
      <Txt variant="small" style={{ marginTop: 4 }}>
        @{found.handle} was made before earshot had a server. You can bring its room
        {found.crate.length ? ` and the ${found.crate.length} ${found.crate.length === 1 ? 'song' : 'songs'} in its crate` : ''} over to this
        account. It replaces the room you have now. Chats and posts from before stay behind: they were with the phone’s
        practice residents.
      </Txt>
      <PosterButton label={busy ? 'carrying boxes…' : 'bring it over'} small disabled={busy} onPress={bring} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
      <InkLink
        label="no thanks, start fresh"
        onPress={() => {
          remember();
          setFound(null);
        }}
        style={{ alignSelf: 'flex-start', marginTop: 12 }}
      />
    </Card>
  );
}

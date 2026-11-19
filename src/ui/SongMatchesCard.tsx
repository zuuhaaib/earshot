/** The switch for "songs that found each other", on the You tab. Off until you turn it on. */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { pushState, pushSupported, turnOnPush } from '@/backend/push';
import { useApi, useSession } from '@/data';
import { colors } from '@/theme';
import { Card, PosterButton, Stamp, Txt } from './print';
import { useSlip } from './Slip';

export function SongMatchesCard() {
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [canNotify, setCanNotify] = useState(true);

  useEffect(() => {
    pushState().then((s) => setCanNotify(s !== 'off'), () => {});
  }, []);

  if (api.kind !== 'server' || !pushSupported() || !session?.me) return null;
  const on = session.songMatches;

  const flip = async () => {
    setBusy(true);
    try {
      if (!on && (await pushState()) !== 'on' && !(await turnOnPush())) {
        setCanNotify(false);
        slip('That needs notifications, and they’re off for earshot. You can turn them on in your phone’s settings.');
        return;
      }
      await api.setSongMatches(!on);
      Haptics.selectionAsync().catch(() => {});
      slip(on ? 'Off. The songs will have to find each other without you.' : 'On. You’ll hear when a song finds its twin nearby.');
    } catch {
      slip('That didn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card rotate={-0.4} style={{ marginTop: 18 }} innerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Txt variant="title" style={{ fontSize: 19, lineHeight: 24, flexShrink: 1 }}>
          Songs that found each other
        </Txt>
        <Stamp rotate={2} color={on ? colors.teal : colors.inkSoft} filled={on}>
          {on ? 'On' : 'Off'}
        </Stamp>
      </View>
      <Txt variant="hand" style={{ marginTop: 10 }}>
        “maren near the annex played pink moon this afternoon. so did you.”
      </Txt>
      <Txt variant="body" style={{ marginTop: 8 }}>
        When you and someone in your area play the same song within half a day, you both get a quiet note naming the other,
        with a link to their room.
      </Txt>
      <Txt variant="small" tone="soft" style={{ marginTop: 8 }}>
        It takes two: you’re only matched with people who’ve switched this on too, and only for songs you both played on air.
        The only place it names is the neighbourhood you share. Once per song a day, and three a day at most.
      </Txt>
      {!on && !canNotify ? (
        <Txt variant="small" tone="accent" style={{ marginTop: 8 }}>
          Notifications are off for earshot in your phone’s settings, so this can’t reach you until they’re back on.
        </Txt>
      ) : null}
      <PosterButton
        label={busy ? 'one moment…' : on ? 'turn it off' : 'turn it on'}
        kind={on ? 'plain' : 'primary'}
        small
        disabled={busy}
        onPress={flip}
        style={{ marginTop: 14, alignSelf: 'flex-start' }}
      />
    </Card>
  );
}

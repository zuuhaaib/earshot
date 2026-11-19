/** The one place earshot asks to send notifications: the inbox, where they'd point. */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { pushState, turnOnPush, type PushState } from '@/backend/push';
import { Card, PosterButton, Txt } from './print';
import { useSlip } from './Slip';

export function PushCard() {
  const slip = useSlip();
  const [state, setState] = useState<PushState | null>(null);
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  if (later || state !== 'ask') return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      const on = await turnOnPush();
      setState(on ? 'on' : 'off');
      slip(on ? 'Notifications on. Songs will find you.' : 'No notifications. You can change that in your phone’s settings.');
    } catch {
      slip('Couldn’t set up notifications just now. Try again later.');
      setBusy(false);
    }
  };

  return (
    <Card rotate={0.8} style={{ marginTop: 24 }} innerStyle={{ padding: 18 }}>
      <Txt variant="title">Want a tap on the shoulder?</Txt>
      <Txt variant="body" style={{ marginTop: 8 }}>
        earshot can tell you when someone sends you a song, says yes to yours, or writes to you. Never who’s nearby, and never
        a no. (One more, only if you switch it on in You: when a song finds its twin nearby.)
      </Txt>
      <Txt variant="small" tone="soft" style={{ marginTop: 8 }}>
        Messages aren’t quoted in notifications, so nothing private shows on your lock screen.
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        <PosterButton label={busy ? 'asking…' : 'turn on notifications'} small disabled={busy} onPress={turnOn} />
        <PosterButton label="not now" kind="plain" small onPress={() => setLater(true)} />
      </View>
    </Card>
  );
}

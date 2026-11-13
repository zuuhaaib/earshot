/** Delete your account for good. Plain words, one deliberate step, no way back. */
import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useSession } from '@/data';
import { BackLink, Field } from '@/ui/Field';
import { Card, Heading, Paper, PosterButton, Txt } from '@/ui/print';
import { useSlip } from '@/ui/Slip';
import { disconnect as disconnectLastfm } from '@/lastfm/client';
import { disconnect as disconnectSpotify } from '@/spotify/client';

const GONE = [
  'Your profile, handle and room',
  'Your crate of saved songs and your listening history',
  'Every song you’ve sent or been sent, and every chat. They disappear for the other person too',
  'Your city posts, the threads you started (with everyone’s replies to them) and your replies elsewhere',
  'Your guestbook signatures and your list of blocked people',
];

export default function DeleteAccount() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const me = session?.me ?? null;
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const onServer = api.kind === 'server';
  const matches = !!me && typed.trim().replace(/^@/, '').toLowerCase() === me.handle.toLowerCase();

  const destroy = async () => {
    if (!me || !matches) return;
    setBusy(true);
    try {
      await disconnectSpotify(me.id).catch(() => {});
      await disconnectLastfm(me.id).catch(() => {});
      await api.deleteAccount();
      slip('Your account is deleted. Thanks for listening.');
      if (router.canDismiss()) router.dismissAll();
      router.replace('/welcome');
    } catch {
      slip('The delete didn’t go through, so nothing was removed. Try again.');
      setBusy(false);
    }
  };

  return (
    <Paper>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 36,
          }}
        >
          <BackLink label="keep my account" />
          <Heading style={{ marginTop: 18 }}>delete your account</Heading>
          <Txt variant="body">
            This removes your account and everything attached to it{onServer ? ' from earshot’s server' : ' from this phone'}, straight
            away. It can’t be undone, and nobody can restore it afterwards, including us.
          </Txt>

          <Card rotate={0.5} style={{ marginTop: 18 }} innerStyle={{ padding: 16 }}>
            <Txt variant="label" tone="soft" style={{ marginBottom: 8 }}>
              What goes
            </Txt>
            {GONE.map((line) => (
              <Txt key={line} variant="body" style={{ marginBottom: 6 }}>
                – {line}.
              </Txt>
            ))}
            {onServer ? (
              <Txt variant="body" style={{ marginBottom: 6 }}>
                – Your login. The email address is freed, so you could sign up again later, from scratch.
              </Txt>
            ) : null}
            <Txt variant="label" tone="soft" style={{ marginTop: 10, marginBottom: 8 }}>
              What stays
            </Txt>
            <Txt variant="body">
              {onServer
                ? '– Reports you made about other people are kept, without your name on them, so they can still be acted on. Reports made about you are kept too.'
                : '– Nothing of yours.'}
            </Txt>
          </Card>

          <Field
            label={me ? `Type your handle (${me.handle}) to confirm` : 'Type your handle to confirm'}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={me?.handle}
            containerStyle={{ marginTop: 22 }}
          />
          <PosterButton
            label={busy ? 'deleting…' : 'delete my account for good'}
            disabled={busy || !matches}
            onPress={destroy}
            style={{ marginTop: 16 }}
          />
          <Txt variant="small" tone="soft" style={{ marginTop: 12 }}>
            If you only want a break, logging out or going off air keeps everything where it is.
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </Paper>
  );
}

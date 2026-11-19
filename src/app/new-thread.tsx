/** Start a thread in an artist's room for your home city. */
import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useSession } from '@/data';
import { hitLimit } from '@/data/api';
import { BackLink, Field } from '@/ui/Field';
import { Heading, Paper, PosterButton, Txt } from '@/ui/print';
import { useSlip } from '@/ui/Slip';

export default function NewThread() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { artist, title: suggested } = useLocalSearchParams<{ artist: string; title?: string }>();
  const { data: session } = useSession();
  const home = session?.me?.homeCity ?? 'your city';

  const [title, setTitle] = useState(suggested ?? '');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!title.trim()) {
      setError('It needs a title, so people know what they’re walking into.');
      return;
    }
    setBusy(true);
    try {
      const id = await api.startThread(artist, title, body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // swap this form for the thread, so "back" returns to the room
      router.replace({ pathname: '/thread/[id]', params: { id } });
    } catch (e) {
      slip(hitLimit(e) ? 'That’s five new threads today, which is the most a day. Reply to one in the meantime.' : 'That didn’t post. Nothing’s lost; try again.');
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
            paddingBottom: insets.bottom + 28,
          }}
        >
          <BackLink label="close" />
          <Heading style={{ marginTop: 18 }}>start a thread</Heading>
          <Txt variant="body" tone="soft">
            It goes in the {artist} room for {home}, and shows in the GTA room too. Threads stay open, so ask something people can
            still answer next month.
          </Txt>

          <Field
            label="Title"
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              setError(null);
            }}
            placeholder="Best live recording? Anyone going to the show?"
            maxLength={90}
            error={error}
            containerStyle={{ marginTop: 22 }}
          />
          <Field
            label="Say a bit more (optional)"
            value={body}
            onChangeText={setBody}
            placeholder="What you’re after, what you already know, where you stand."
            multiline
            maxLength={500}
            containerStyle={{ marginTop: 16 }}
          />

          <Txt variant="small" tone="soft" style={{ marginTop: 14 }}>
            Your name goes on it and anyone can read it. It doesn’t show where you are.
          </Txt>
          <PosterButton label={busy ? 'pinning it up…' : 'start the thread'} disabled={busy} onPress={start} style={{ marginTop: 18 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Paper>
  );
}

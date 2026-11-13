/** Sign someone's guestbook: leave a track, and say why you picked it. */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive } from '@/data';
import { seedTrack, stopPreview, type Track } from '@/music';
import { BackLink, Field, goBack } from '@/ui/Field';
import { Card, Heading, Paper, PosterButton, Txt } from '@/ui/print';
import { Sleeve } from '@/ui/Sleeve';
import { useSlip } from '@/ui/Slip';
import { COUNTER, SongPicker, useSongSearch } from '@/ui/SongPicker';

const WHY_MAX = 160;

export default function SignGuestbook() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: who } = useLive((a) => a.getPerson(id), [], [id]);
  const { data: crate } = useLive((a) => a.getCrate(), ['crate']);
  const picker = useSongSearch();

  const [chosen, setChosen] = useState<Track | null>(null);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => stopPreview(), []);

  const first = who?.name.split(' ')[0] ?? 'them';

  const sign = async () => {
    if (!chosen) return;
    if (!why.trim()) {
      setError('Say why you picked it. That’s the whole point of a guestbook.');
      return;
    }
    setBusy(true);
    try {
      await api.signGuestbook(id, chosen, why);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      slip(`Signed. ${first} will find it next time they’re home.`);
      goBack();
    } catch {
      slip('The pen ran out. Try again.');
      setBusy(false);
    }
  };

  if (chosen) {
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
            <BackLink label="pick something else" onPress={() => setChosen(null)} />
            <Heading style={{ marginTop: 18 }}>{`for ${first.toLowerCase()}’s guestbook`}</Heading>
            <Card rotate={-1} innerStyle={{ padding: 14, flexDirection: 'row', gap: 6 }}>
              <Sleeve track={chosen} size={90} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Txt variant="title" numberOfLines={3}>
                  {chosen.title}
                </Txt>
                <Txt variant="bodyItalic" numberOfLines={1}>
                  {chosen.artist}
                </Txt>
              </View>
            </Card>
            <Field
              label={`Why this one? (${WHY_MAX - why.length} left)`}
              value={why}
              onChangeText={(v) => {
                setWhy(v);
                setError(null);
              }}
              placeholder={`What made you think of ${first}?`}
              multiline
              maxLength={WHY_MAX}
              error={error}
              containerStyle={{ marginTop: 22 }}
            />
            <Txt variant="small" tone="soft" style={{ marginTop: 14 }}>
              It goes on {first}’s room with your name on it, where anyone visiting can read it. You get one entry; signing again
              replaces it. {first} can tear it out.
            </Txt>
            <PosterButton label={busy ? 'signing…' : 'sign the guestbook'} disabled={busy} onPress={sign} style={{ marginTop: 18 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Paper>
    );
  }

  return (
    <SongPicker
      picker={picker}
      onPick={setChosen}
      idleTracks={crate?.length ? crate.slice(0, 8) : COUNTER.map(seedTrack)}
      idleLabel={crate?.length ? 'From your crate' : 'Or grab one off the counter'}
      header={
        <>
          <BackLink label="close" />
          <Heading style={{ marginTop: 18 }}>{`leave ${first.toLowerCase()} a track`}</Heading>
          <Txt variant="body" tone="soft" style={{ marginBottom: 14 }}>
            A guestbook entry is a song and a reason. Pick the song first.
          </Txt>
        </>
      }
    />
  );
}

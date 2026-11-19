/**
 * Post a song to your home city, with why. This is a separate choice from
 * sharing nearby: it goes on your city's board and stays there, wherever you
 * are when you post it.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, useSession } from '@/data';
import { hitLimit } from '@/data/api';
import { seedTrack, stopPreview, type Track } from '@/music';
import { BackLink, Field, goBack } from '@/ui/Field';
import { Card, Heading, Paper, PosterButton, Txt } from '@/ui/print';
import { Sleeve } from '@/ui/Sleeve';
import { useSlip } from '@/ui/Slip';
import { COUNTER, SongPicker, useSongSearch } from '@/ui/SongPicker';

const NOTE_MAX = 220;

export default function PostToCity() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const { data: crate } = useLive((a) => a.getCrate(), ['crate']);
  const picker = useSongSearch();

  const [chosen, setChosen] = useState<Track | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => stopPreview(), []);

  const home = session?.me?.homeCity ?? 'your city';
  const mine = session?.nowPlaying?.track ?? null;

  const post = async () => {
    if (!chosen) return;
    if (!note.trim()) {
      setError('It needs a reason. One line will do. “Because it’s raining” counts.');
      return;
    }
    setBusy(true);
    try {
      await api.postToCity(chosen, note);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      slip(`Pinned to ${home}’s board.`);
      goBack();
    } catch (e) {
      slip(hitLimit(e) ? 'That’s ten posts today, which is the most a day. The board will still be here tomorrow.' : 'That didn’t post. Nothing’s lost; try again.');
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
            <Heading style={{ marginTop: 18 }}>{`for ${home.toLowerCase()}`}</Heading>

            <Card rotate={-1} innerStyle={{ padding: 14, flexDirection: 'row', gap: 6 }}>
              <Sleeve track={chosen} size={96} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Txt variant="title" numberOfLines={3}>
                  {chosen.title}
                </Txt>
                <Txt variant="bodyItalic" numberOfLines={1}>
                  {chosen.artist}
                </Txt>
                <Txt variant="meta" tone="soft" numberOfLines={1} style={{ marginTop: 4 }}>
                  {chosen.album}
                </Txt>
              </View>
            </Card>

            <Field
              label={`Why this one, why here? (${NOTE_MAX - note.length} left)`}
              value={note}
              onChangeText={(v) => {
                setNote(v);
                setError(null);
              }}
              placeholder="Where you heard it, who it’s for, what the weather’s doing."
              multiline
              maxLength={NOTE_MAX}
              error={error}
              containerStyle={{ marginTop: 22 }}
            />

            <Txt variant="small" tone="soft" style={{ marginTop: 14 }}>
              This goes on {home}’s board with your name on it, where anyone can read it, including people browsing from other
              cities. It doesn’t say where you are and it doesn’t turn on sharing nearby. You can take it down whenever.
            </Txt>

            <PosterButton label={busy ? 'finding a free pin…' : `post to ${home.toLowerCase()}`} disabled={busy} onPress={post} style={{ marginTop: 18 }} />
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
          <Heading style={{ marginTop: 18 }}>{`post a song to ${home.toLowerCase()}`}</Heading>
          <Txt variant="body" tone="soft" style={{ marginBottom: 14 }}>
            A post is a song and a reason. Pick the song first.
          </Txt>
          {mine ? (
            <PosterButton small kind="plain" label="what I’ve got on" onPress={() => setChosen(mine)} style={{ alignSelf: 'flex-start', marginBottom: 16 }} />
          ) : null}
        </>
      }
    />
  );
}

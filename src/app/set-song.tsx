/**
 * "What have you got on?" Search for a song and set it as what you're playing,
 * optionally with a note (which sends it out as a shared track).
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, useSession } from '@/data';
import { seedTrack, stopPreview, type Track } from '@/music';
import { BackLink, Field, goBack, TrackRow } from '@/ui/Field';
import { Card, Heading, InkLink, Paper, PosterButton, Txt } from '@/ui/print';
import { Sleeve } from '@/ui/Sleeve';
import { useSlip } from '@/ui/Slip';
import { COUNTER, SongPicker, useSongSearch } from '@/ui/SongPicker';

const NOTE_MAX = 140;

export default function SetSong() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const { data: crate } = useLive((a) => a.getCrate(), ['crate']);
  const picker = useSongSearch();

  const [chosen, setChosen] = useState<Track | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => stopPreview(), []);

  const done = (message: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    slip(message);
    goBack();
  };

  const putOn = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await api.setNowPlaying(chosen, note);
      done(note.trim() ? (session?.sharing ? 'Shared. Be cool about it.' : 'Noted. Only you can see it while you’re off air.') : 'It’s on.');
    } catch {
      slip('That didn’t take. Try again.');
      setBusy(false);
    }
  };

  const takeOff = async () => {
    setBusy(true);
    await api.setNowPlaying(null).catch(() => {});
    done('Silence. Bold choice.');
  };

  // ---- step two: the song's picked, add a note or don't -------------------
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
            <Heading style={{ marginTop: 18 }}>good choice. probably.</Heading>

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
              label={`Add a note (optional, ${NOTE_MAX - note.length} left)`}
              value={note}
              onChangeText={setNote}
              placeholder="Why this one? Say it like you’d say it to a friend."
              multiline
              maxLength={NOTE_MAX}
              containerStyle={{ marginTop: 22 }}
              hint="With a note it shows as “Shared a track”. Without one it’s just what you’ve got on."
            />

            <Txt variant="small" tone="soft" style={{ marginTop: 14 }}>
              {session?.sharing
                ? 'You’re on air, so people nearby will see this.'
                : 'You’re off air, so only you will see this until you turn sharing on.'}
            </Txt>

            <PosterButton
              label={busy ? 'cueing it up…' : note.trim() ? 'share it' : 'put it on'}
              disabled={busy}
              onPress={putOn}
              style={{ marginTop: 18 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Paper>
    );
  }

  // ---- step one: find a song ----------------------------------------------
  return (
    <SongPicker
      picker={picker}
      idleTracks={crate?.length ? crate.slice(0, 8) : COUNTER.map(seedTrack)}
      idleLabel={crate?.length ? 'Or something from your crate' : 'Or grab one off the counter'}
      onPick={setChosen}
      header={
        <>
          <BackLink label="close" />
          <Heading style={{ marginTop: 18 }}>what have you got on?</Heading>
          <Txt variant="body" tone="soft" style={{ marginBottom: 14 }}>
            earshot can’t see your music app yet, so tell it yourself. Tap a cover to hear a preview; tap the title to choose
            it.
          </Txt>
          {session?.nowPlaying ? (
            <Card rotate={0.6} shadow={4} style={{ marginBottom: 16 }} innerStyle={{ paddingHorizontal: 12, paddingVertical: 4 }}>
              <TrackRow
                track={session.nowPlaying.track}
                size={44}
                right={<InkLink label="take it off" onPress={busy ? undefined : takeOff} />}
              />
            </Card>
          ) : null}
        </>
      }
    />
  );
}

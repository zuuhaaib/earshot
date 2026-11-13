/**
 * Send someone a song. This is the only way to start a conversation: there is
 * no message box until they've accepted one.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, useSession } from '@/data';
import { SendError } from '@/data/api';
import { seedTrack, stopPreview, type Track } from '@/music';
import { BackLink, Field, goBack } from '@/ui/Field';
import { Card, Heading, Paper, PinBadge, PosterButton, Stamp, Txt } from '@/ui/print';
import { Sleeve } from '@/ui/Sleeve';
import { useSlip } from '@/ui/Slip';
import { COUNTER, SongPicker, useSongSearch } from '@/ui/SongPicker';

const NOTE_MAX = 200;

/** Songs with strong opinions attached. For sending to someone you suspect will hate them. */
const DIVISIVE = [
  'nickelback-how-you-remind-me',
  'abba-dancing-queen',
  'shania-man-i-feel',
  'celine-all-coming-back',
  'avril-complicated',
  'death-grips-get-got',
];

const WHY_NOT: Record<SendError['code'], string> = {
  self: 'You can’t send yourself a song. Well, you can. It’s called a playlist.',
  'already-sent': 'You’ve already sent them one. Let it breathe.',
  'they-sent-first': 'They sent you a song first. It’s waiting in your inbox.',
  'unknown-person': 'We can’t find that person any more.',
};

export default function SendSong() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { id, artist } = useLocalSearchParams<{ id: string; artist?: string }>();
  const { data: session } = useSession();
  const { data } = useLive(async (a) => ({ who: await a.getPerson(id), link: await a.getLink(id) }), ['inbox'], [id]);
  const { data: crate } = useLive((a) => a.getCrate(), ['crate']);
  const picker = useSongSearch();

  const [chosen, setChosen] = useState<Track | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [divisive, setDivisive] = useState(false);

  useEffect(() => () => stopPreview(), []);

  const who = data?.who;
  const link = data?.link;
  const first = who?.name.split(' ')[0] ?? 'them';
  const pad = {
    paddingHorizontal: 20,
    width: '100%' as const,
    maxWidth: 560,
    alignSelf: 'center' as const,
    paddingTop: insets.top + 14,
    paddingBottom: insets.bottom + 28,
  };

  if (!data) return <Paper />;

  // ---- reasons there's nothing to send -----------------------------------
  if (!who || (link && (link.kind === 'sent' || link.kind === 'incoming') && !busy)) {
    const sent = link?.kind === 'sent';
    return (
      <Paper>
        <View style={pad}>
          <BackLink label="close" />
          <Card rotate={-1} style={{ marginTop: 24 }} innerStyle={{ padding: 18 }}>
            <Stamp rotate={-3}>{!who ? 'Gone' : sent ? 'Already sent' : 'They got there first'}</Stamp>
            <Txt variant="title" style={{ marginTop: 12 }}>
              {!who
                ? 'Nobody by that name.'
                : sent
                  ? `You’ve sent ${first} a song.`
                  : `${first} already sent you one.`}
            </Txt>
            <Txt variant="body" tone="soft" style={{ marginTop: 6 }}>
              {!who
                ? 'They may have left. It happens.'
                : sent
                  ? 'One at a time. If they accept, a chat opens and you can send as many as you like. If they don’t, you won’t hear about it, and neither of you has to make it weird.'
                  : 'It’s in your inbox. Accept it and you can send one straight back.'}
            </Txt>
            {who && !sent ? (
              <PosterButton label="go to my inbox" onPress={() => router.replace('/inbox')} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
            ) : null}
          </Card>
        </View>
      </Paper>
    );
  }

  const send = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const outcome = await api.sendSong(who.id, chosen, note);
      // the small tap you feel when a song leaves your hands
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (outcome.kind === 'chat') {
        router.replace({ pathname: '/chat/[id]', params: { id: outcome.id } });
      } else {
        slip('Sent. Now put the phone down.');
        goBack();
      }
    } catch (e) {
      slip(e instanceof SendError ? WHY_NOT[e.code] : 'That didn’t send. Nothing’s lost; try again.');
      setBusy(false);
    }
  };

  // ---- step two: say why (or don't) ---------------------------------------
  if (chosen) {
    const talking = link?.kind === 'chat';
    return (
      <Paper>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={pad}>
            <BackLink label="pick something else" onPress={() => setChosen(null)} />
            <Heading style={{ marginTop: 18 }}>{`for ${first.toLowerCase()}`}</Heading>

            <Card rotate={1} innerStyle={{ padding: 14, flexDirection: 'row', gap: 6 }}>
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
              label={`Say why (optional, ${NOTE_MAX - note.length} left)`}
              value={note}
              onChangeText={setNote}
              placeholder={`What should ${first} know before pressing play?`}
              multiline
              maxLength={NOTE_MAX}
              containerStyle={{ marginTop: 22 }}
            />

            <Txt variant="small" tone="soft" style={{ marginTop: 14 }}>
              {talking
                ? `You and ${first} are already talking, so this goes straight into your chat.`
                : `${first} gets the song and your note. If they accept, a chat opens with this song pinned to the top for good. If they don’t, nothing happens and nobody is told.`}
            </Txt>

            <PosterButton label={busy ? 'sliding it under the door…' : 'send it'} disabled={busy} onPress={send} style={{ marginTop: 18 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Paper>
    );
  }

  // ---- step one: choose the song ------------------------------------------
  const mine = session?.nowPlaying?.track ?? null;
  return (
    <SongPicker
      picker={picker}
      onPick={setChosen}
      idleTracks={divisive ? DIVISIVE.map(seedTrack) : crate?.length ? crate.slice(0, 8) : COUNTER.map(seedTrack)}
      idleLabel={divisive ? 'Sent with affection. Mostly.' : crate?.length ? 'From your crate' : 'Or grab one off the counter'}
      header={
        <>
          <BackLink label="close" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <PinBadge label={who.badge} color={who.badgeColor} size={48} rotate={-6} />
            <View style={{ flex: 1 }}>
              <Heading style={{ marginBottom: 0 }}>{`send ${first.toLowerCase()} a song`}</Heading>
            </View>
          </View>
          <Txt variant="body" tone="soft" style={{ marginTop: 10 }}>
            There’s no “hey” here. Pick a song and let it do the talking. Not sure what? Three ways in:
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 18 }}>
            {mine ? <PosterButton small kind="plain" label="what I’ve got on" onPress={() => setChosen(mine)} /> : null}
            {artist ? (
              <PosterButton
                small
                kind="plain"
                label={`more ${artist}`.slice(0, 28)}
                onPress={() => {
                  setDivisive(false);
                  picker.setQuery(artist);
                }}
              />
            ) : null}
            <PosterButton
              small
              kind={divisive ? 'primary' : 'plain'}
              label="something they’d hate"
              onPress={() => {
                picker.setQuery('');
                setDivisive((d) => !d);
              }}
            />
          </View>
        </>
      }
    />
  );
}

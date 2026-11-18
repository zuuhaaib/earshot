/** The Last.fm link, on the "you" tab: the other way to have your songs set themselves. */
import React, { useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useApi } from '@/data';
import { lastfmConfigured } from '@/lastfm/config';
import { SPOTIFY_ENABLED } from '@/spotify/config';
import { checkLastfm, connectLastfm, disconnectLastfm, lastfmWords, useLastfm } from '@/lastfm/sync';
import { colors } from '@/theme';
import { Field } from './Field';
import { Card, PosterButton, Stamp, Txt } from './print';
import { useSlip } from './Slip';
import { ago } from './SongPicker';

const PROMISES = [
  'You give earshot your Last.fm username, not a password. It reads the “now playing” line that your Last.fm profile already shows to anyone.',
  'For that to follow Spotify, Last.fm has to be connected to it: in Last.fm, open Settings, then Applications, and connect Spotify. That part happens between you and Last.fm.',
  'It only asks while earshot is open on your screen, and the username is kept on this phone and nowhere else.',
  'Linking doesn’t turn sharing on. People nearby only see your song when you’re ON AIR, same as before.',
];

export function LastfmCard({ userId }: { userId: string }) {
  const api = useApi();
  const slip = useSlip();
  const lastfm = useLastfm();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      const name = await connectLastfm(api, userId, username);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      slip(`Linked to ${name} on Last.fm.`);
      setUsername('');
    } catch (e) {
      setError(lastfmWords(e));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!sure) {
      setSure(true);
      setTimeout(() => setSure(false), 4000);
      return;
    }
    setSure(false);
    await disconnectLastfm(userId);
    slip('Last.fm unlinked.');
  };

  const on = lastfm.status === 'on';
  const problem = error ?? lastfm.problem;

  return (
    <Card rotate={0.5} style={{ marginTop: SPOTIFY_ENABLED ? 18 : 0 }} innerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Txt variant="title" style={{ fontSize: 19, lineHeight: 24 }}>
          Last.fm
        </Txt>
        <Stamp rotate={-3} color={on ? colors.teal : colors.inkSoft} filled={on}>
          {on ? (lastfm.standingBy ? 'Standing by' : 'Linked') : 'Not linked'}
        </Stamp>
      </View>

      {on ? (
        <>
          <Txt variant="body" style={{ marginTop: 8 }}>
            Linked to {lastfm.name}. Whatever Last.fm says you’re playing becomes what you’ve got on here.
          </Txt>
          <Txt variant="meta" tone="soft" style={{ marginTop: 8 }}>
            {lastfm.standingBy
              ? 'Spotify is linked and working, so Last.fm is standing by. It steps in if Spotify stops answering.'
              : lastfm.checkedAt
                ? `Last.fm says: ${lastfm.heard ?? 'nothing playing'} · checked ${ago(lastfm.checkedAt)}`
                : 'Asking Last.fm…'}
          </Txt>
          <Txt variant="small" tone="soft" style={{ marginTop: 8 }}>
            It checks every 30 seconds while earshot is open, and Last.fm itself can run up to a minute behind. Pick a song by
            hand and yours stays until Last.fm moves to a different one.
          </Txt>
        </>
      ) : (
        <>
          <Txt variant="body" style={{ marginTop: 8 }}>
            {SPOTIFY_ENABLED
              ? 'The other way to have your songs set themselves, if the Spotify link above isn’t open to you.'
              : 'Have your songs set themselves, so you can stop telling earshot what you’re playing.'}{' '}
            It works with most players, Spotify and Apple Music included, by way of a free Last.fm account.
          </Txt>
          <View style={{ gap: 10, marginTop: 12 }}>
            {PROMISES.map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                <Txt variant="titleSm" tone="accent">
                  {i + 1}.
                </Txt>
                <Txt variant="small" style={{ flex: 1 }}>
                  {p}
                </Txt>
              </View>
            ))}
          </View>
        </>
      )}

      {problem ? (
        <View style={{ backgroundColor: colors.highlighter, padding: 10, marginTop: 12, transform: [{ rotate: '0.5deg' }] }}>
          <Txt variant="small">{problem}</Txt>
        </View>
      ) : null}

      {!lastfmConfigured() ? (
        <View style={{ marginTop: 14 }}>
          <Txt variant="titleSm">One thing to fill in first</Txt>
          <Txt variant="small" tone="soft" style={{ marginTop: 4 }}>
            With no backend, this build needs a Last.fm API key of its own. Make a free one at last.fm/api/account/create, put it
            in the .env file as EXPO_PUBLIC_LASTFM_API_KEY, and restart Expo.
          </Txt>
        </View>
      ) : on ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          <PosterButton label="check now" kind="plain" small onPress={() => checkLastfm(api, userId)} />
          <PosterButton label={sure ? 'tap again to unlink' : 'unlink'} kind="plain" small onPress={unlink} />
        </View>
      ) : (
        <>
          <Field
            label="Your Last.fm username"
            value={username}
            onChangeText={(v) => {
              setUsername(v);
              setError(null);
            }}
            placeholder="yourname"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ marginTop: 14 }}
          />
          <PosterButton
            label={busy ? 'asking Last.fm…' : 'link Last.fm'}
            disabled={busy || lastfm.status === 'unknown' || !username.trim()}
            onPress={link}
            style={{ marginTop: 12, alignSelf: 'flex-start' }}
          />
        </>
      )}
    </Card>
  );
}

/** The Spotify link, on the "you" tab: what it does, what it can see, and the switch. */
import React, { useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useApi } from '@/data';
import { redirectUri } from '@/spotify/client';
import { spotifyConfigured } from '@/spotify/config';
import { checkSpotify, connectSpotify, disconnectSpotify, spotifyWords, useSpotify } from '@/spotify/sync';
import { colors, fonts } from '@/theme';
import { Card, PosterButton, Stamp, Txt } from './print';
import { useSlip } from './Slip';
import { ago } from './SongPicker';

const PROMISES = [
  'earshot asks Spotify one question: what’s playing right now. It can’t see your playlists, library or history, and it can’t control playback.',
  'It only asks while earshot is open on your screen. Close the app and it stops.',
  'The link is kept on this phone and nowhere else. Disconnecting deletes it.',
  'Linking doesn’t turn sharing on. People nearby only see your song when you’re ON AIR, same as before.',
];

export function SpotifyCard({ userId }: { userId: string }) {
  const api = useApi();
  const slip = useSlip();
  const spotify = useSpotify();
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectSpotify(api, userId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      slip('Spotify’s linked. Your songs now set themselves.');
    } catch (e) {
      setError(spotifyWords(e));
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
    await disconnectSpotify(userId);
    slip('Spotify unlinked. Back to telling us yourself.');
  };

  const on = spotify.status === 'on';
  const problem = error ?? spotify.problem;

  return (
    <Card rotate={-0.5} innerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Txt variant="title" style={{ fontSize: 19, lineHeight: 24 }}>
          Spotify
        </Txt>
        <Stamp rotate={3} color={on ? colors.teal : colors.inkSoft} filled={on}>
          {on ? 'Linked' : 'Not linked'}
        </Stamp>
      </View>

      {on ? (
        <>
          <Txt variant="body" style={{ marginTop: 8 }}>
            Linked to {spotify.name}. Whatever you play there becomes what you’ve got on here, by itself.
          </Txt>
          <Txt variant="meta" tone="soft" style={{ marginTop: 8 }}>
            {spotify.checkedAt
              ? `Spotify says: ${spotify.heard ?? 'nothing playing'} · checked ${ago(spotify.checkedAt)}`
              : 'Asking Spotify…'}
          </Txt>
          <Txt variant="small" tone="soft" style={{ marginTop: 8 }}>
            It checks every 20 seconds while earshot is open. Pick a song by hand and yours stays until Spotify moves to a
            different one.
          </Txt>
        </>
      ) : (
        <>
          <Txt variant="body" style={{ marginTop: 8 }}>
            Link Spotify and earshot fills in what you’re playing on its own, so you can stop telling it.
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
        <View style={{ backgroundColor: colors.highlighter, padding: 10, marginTop: 12, transform: [{ rotate: '-0.5deg' }] }}>
          <Txt variant="small">{problem}</Txt>
        </View>
      ) : null}

      {!spotifyConfigured() ? (
        <View style={{ marginTop: 14 }}>
          <Txt variant="titleSm">One thing to fill in first</Txt>
          <Txt variant="small" tone="soft" style={{ marginTop: 4 }}>
            This build doesn’t have a Spotify Client ID yet. Put yours in the .env file as EXPO_PUBLIC_SPOTIFY_CLIENT_ID, restart
            Expo, and this button wakes up.
          </Txt>
        </View>
      ) : on ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          <PosterButton label="check now" kind="plain" small onPress={() => checkSpotify(api, userId)} />
          <PosterButton label={sure ? 'tap again to unlink' : 'unlink'} kind="plain" small onPress={unlink} />
        </View>
      ) : (
        <PosterButton
          label={busy ? 'waiting for Spotify…' : 'link Spotify'}
          disabled={busy || spotify.status === 'unknown'}
          onPress={link}
          style={{ marginTop: 14, alignSelf: 'flex-start' }}
        />
      )}

      {!on ? (
        <View style={{ marginTop: 14 }}>
          <Txt variant="label" tone="soft">
            Spotify must know this address
          </Txt>
          <Txt selectable style={{ fontFamily: fonts.typeBold, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
            {redirectUri()}
          </Txt>
          <Txt variant="small" tone="soft" style={{ marginTop: 4 }}>
            Add it, exactly as written, under Redirect URIs in your app at developer.spotify.com. It changes if your computer’s
            network address changes.
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}

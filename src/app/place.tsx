/**
 * Where is "nearby"? Opened the first time you turn sharing on (with the plain
 * explanation that has to come before the system prompt) and whenever you want
 * to move. Location is optional: picking a spot by hand works identically.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useSession, type Area } from '@/data';
import { areas, cities } from '@/data/areas';
import { locateArea } from '@/data/locate';
import { colors } from '@/theme';
import { BackLink, goBack } from '@/ui/Field';
import { Card, Heading, Paper, PosterButton, Stamp, Txt } from '@/ui/print';
import { useSlip } from '@/ui/Slip';

const PROMISES = [
  'earshot checks your location only while the app is open: when you turn sharing on, and when you pull down to refresh Nearby. Never in the background.',
  'It turns that into a neighbourhood-sized area, like “Queen West”, and discards the exact coordinates straight away. They are never saved, never sent anywhere, and never shown to anyone, including you.',
  'People nearby see that you’re around and what you’re playing. They never see where you are or how far away.',
  'Turn sharing off and you disappear from Nearby immediately.',
];

export default function PlaceScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { share } = useLocalSearchParams<{ share?: string }>();
  const goingOnAir = share === '1';
  const { data: session } = useSession();

  const [mode, setMode] = useState<'explain' | 'pick'>('explain');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const settle = async (area: Area, source: 'gps' | 'picked') => {
    try {
      await api.setArea(area.id, source);
      if (goingOnAir) await api.setSharing(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      slip(goingOnAir ? 'You’re on air. Act natural.' : `Nearby is now around ${area.name}.`);
      goBack();
    } catch {
      setNotice('That didn’t save. Try once more.');
      setBusy(false);
    }
  };

  const findMe = async () => {
    setBusy(true);
    setNotice(null);
    const result = await locateArea();
    if (result.ok) return settle(result.area, 'gps');
    setBusy(false);
    setMode('pick');
    setNotice(
      result.reason === 'denied'
        ? 'No location, no problem. Pick a spot below and everything works exactly the same.'
        : result.reason === 'off'
          ? 'Location is switched off in your phone’s settings. Turn it on and try again, or pick a spot below.'
          : 'Your phone couldn’t work out where it is just now. Pick a spot below instead.',
    );
  };

  return (
    <Paper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
        }}
      >
        <BackLink label="close" />

        {mode === 'explain' ? (
          <>
            <Heading style={{ marginTop: 18 }}>{goingOnAir ? 'before your phone asks' : 'where’s nearby?'}</Heading>
            <Txt variant="body">
              {goingOnAir
                ? 'Sharing needs a rough idea of where you are. Here is exactly what that means.'
                : 'Nearby shows people sharing around one area. Here is exactly how location is used if you choose it.'}
            </Txt>

            <Card rotate={-0.5} style={{ marginTop: 18 }} innerStyle={{ padding: 16, gap: 14 }}>
              {PROMISES.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <Txt variant="titleSm" tone="accent">
                    {i + 1}.
                  </Txt>
                  <Txt variant="body" style={{ flex: 1 }}>
                    {p}
                  </Txt>
                </View>
              ))}
            </Card>

            <Txt variant="hand" tone="soft" style={{ marginTop: 16 }}>
              that’s the whole policy. we wanted it to fit on a card.
            </Txt>

            {session?.area ? (
              <Txt variant="meta" tone="soft" style={{ marginTop: 14 }}>
                Currently: roughly {session.area.name}
                {session.areaSource === 'picked' ? ' (you picked it)' : ' (from your location)'}.
              </Txt>
            ) : null}

            <View style={{ gap: 12, marginTop: 22 }}>
              <PosterButton label={busy ? 'finding your neighbourhood…' : 'use my location'} disabled={busy} onPress={findMe} />
              <PosterButton label="I’ll pick a spot myself" kind="plain" disabled={busy} onPress={() => setMode('pick')} />
            </View>
            <Txt variant="small" tone="soft" style={{ marginTop: 12 }}>
              “Use my location” is when your phone will ask for permission. Say no and you can still pick a spot.
            </Txt>
          </>
        ) : (
          <>
            <Heading style={{ marginTop: 18 }}>pick a spot</Heading>
            <Txt variant="body" tone="soft">
              Roughly where you are is plenty. You can move it whenever you like.
            </Txt>
            {notice ? (
              <View style={{ backgroundColor: colors.highlighter, padding: 12, marginTop: 14, transform: [{ rotate: '-0.6deg' }] }}>
                <Txt variant="body">{notice}</Txt>
              </View>
            ) : null}

            {cities.map((city) => {
              const list = areas.filter((a) => a.city === city);
              return (
                <View key={city} style={{ marginTop: 22 }}>
                  <Txt variant="label" tone="soft" style={{ marginBottom: 8 }}>
                    {city}
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {list.map((a) => {
                      const current = session?.area?.id === a.id;
                      return (
                        <Pressable
                          key={a.id}
                          disabled={busy}
                          onPress={() => {
                            setBusy(true);
                            settle(a, 'picked');
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${a.name}, ${city}`}
                          style={{
                            borderWidth: 2,
                            borderColor: colors.ink,
                            backgroundColor: current ? colors.highlighter : colors.card,
                            borderRadius: 3,
                            paddingHorizontal: 12,
                            minHeight: 44,
                            justifyContent: 'center',
                          }}
                        >
                          <Txt variant="titleSm">{a.name}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <View style={{ marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Stamp rotate={-2}>Or</Stamp>
              <PosterButton label="use my location instead" kind="plain" small disabled={busy} onPress={findMe} />
            </View>
          </>
        )}
      </ScrollView>
    </Paper>
  );
}

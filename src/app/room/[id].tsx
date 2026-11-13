import React, { useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLive, type Link } from '@/data';
import { tilt } from '@/theme';
import { BackLink } from '@/ui/Field';
import { Card, houseInks, InkProvider, Paper, PinBadge, PosterButton, Stamp, Txt } from '@/ui/print';
import { inksFor, isDark } from '@/ui/roomInks';
import { RoomLookupProvider, RoomSectionView } from '@/ui/RoomSections';

const sendLabel = (link: Link, first: string) =>
  link.kind === 'chat'
    ? 'open chat'
    : link.kind === 'sent'
      ? 'song sent'
      : link.kind === 'incoming'
        ? `${first} sent you a song`
        : `send ${first} a song`;

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();

  const { data, loading } = useLive(
    async (api) => ({ view: await api.getRoom(id), link: await api.getLink(id) }),
    ['room', 'session', 'inbox'],
    [id],
  );
  const view = data?.view ?? null;
  const link: Link = data?.link ?? { kind: 'none' };
  const inks = useMemo(() => (view ? inksFor(view.room.theme) : houseInks), [view]);
  const lookup = useMemo(
    () => ({ tracks: view?.tracks ?? {}, people: view?.people ?? {}, mine: view?.mine ?? false }),
    [view],
  );

  const width = Math.min(screen, 560) - 32;

  if (loading) return <Paper />;

  if (!view) {
    return (
      <Paper>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <BackLink />
          <Card style={{ marginTop: 20 }} innerStyle={{ padding: 20 }}>
            <Txt variant="title">Nobody lives here.</Txt>
            <Txt variant="body" tone="soft" style={{ marginTop: 6 }}>
              Wrong door, or they moved out. It happens.
            </Txt>
          </Card>
        </View>
      </Paper>
    );
  }

  const { person: who, room, mine } = view;
  const first = who.name.split(' ')[0].toLowerCase();
  const poster = room.theme.layout === 'poster';

  return (
    <InkProvider value={inks}>
      <StatusBar style={isDark(inks.paper) ? 'light' : 'dark'} />
      <RoomLookupProvider value={lookup}>
        <Paper texture={room.theme.texture}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 40,
              paddingHorizontal: 16,
              width: '100%',
              maxWidth: 560,
              alignSelf: 'center',
            }}
          >
            <View style={{ marginBottom: 14 }}>
              <BackLink />
            </View>

            {poster ? (
              // gig-poster header: badge on top, name as big as it'll go
              <View style={{ alignItems: 'center' }}>
                <PinBadge label={who.badge} color={who.badgeColor} size={88} rotate={tilt(who.id, 9)} />
                <Txt variant="wordmark" center accessibilityRole="header" style={{ marginTop: 10, fontSize: 40, lineHeight: 44 }}>
                  {who.name}
                </Txt>
                <Txt variant="meta" tone="soft" center>
                  @{who.handle}
                </Txt>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <PinBadge label={who.badge} color={who.badgeColor} size={76} rotate={tilt(who.id, 9)} />
                <View style={{ flex: 1 }}>
                  <Txt variant="poster" accessibilityRole="header">
                    {who.name}
                  </Txt>
                  <Txt variant="meta" tone="soft">
                    @{who.handle}
                  </Txt>
                </View>
              </View>
            )}

            {who.tagline ? (
              <Txt variant="hand" center={poster} style={{ marginTop: 12 }}>
                {who.tagline}
              </Txt>
            ) : null}
            {who.bio ? (
              <Txt variant="body" center={poster} style={{ marginTop: 8 }}>
                {who.bio}
              </Txt>
            ) : mine ? (
              <Txt variant="bodyItalic" tone="soft" center={poster} style={{ marginTop: 8 }}>
                No bio yet. Two lines about you would go nicely here.
              </Txt>
            ) : null}
            <View style={{ alignItems: poster ? 'center' : 'flex-start', marginTop: 12 }}>
              <Stamp rotate={-2}>{`Home: ${who.homeCity}`}</Stamp>
            </View>

            <View style={{ marginTop: 18, marginBottom: 36 }}>
              {mine ? (
                <>
                  <PosterButton label="decorate" onPress={() => router.push('/room/edit')} />
                  <Txt variant="hand" tone="soft" center style={{ marginTop: 10 }}>
                    this is what everyone else sees.
                  </Txt>
                </>
              ) : (
                <PosterButton
                  label={sendLabel(link, first)}
                  kind={link.kind === 'sent' ? 'plain' : 'primary'}
                  onPress={() => {
                    if (link.kind === 'chat') router.push({ pathname: '/chat/[id]', params: { id: link.id } });
                    else if (link.kind === 'none') router.push({ pathname: '/send/[id]', params: { id: who.id } });
                    else router.navigate('/inbox');
                  }}
                />
              )}
            </View>

            {room.sections.map((s, i) => (
              <RoomSectionView
                key={s.kind + i}
                section={s}
                room={room}
                width={width}
                onSign={mine ? undefined : () => router.push({ pathname: '/sign/[id]', params: { id: who.id } })}
              />
            ))}
          </ScrollView>
        </Paper>
      </RoomLookupProvider>
    </InkProvider>
  );
}

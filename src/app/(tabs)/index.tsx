import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, useSession, type Session, type Sighting } from '@/data';
import { relocateQuietly } from '@/data/locate';
import { colors, fonts, type } from '@/theme';
import { Card, InkLink, Paper, PosterButton, Stamp, Txt } from '@/ui/print';
import { Sleeve } from '@/ui/Sleeve';
import { useSpotify } from '@/spotify/sync';
import { useSlip } from '@/ui/Slip';
import { SongCard } from '@/ui/SongCard';

/** How often the feed asks for fresh data while you're looking at it. */
const PULSE_MS = 15_000;

/** The wordmark, printed twice, slightly out of register. */
function Wordmark() {
  return (
    <View>
      <Txt variant="wordmark" color={colors.tomato} style={{ position: 'absolute', left: 3, top: 3 }} accessible={false}>
        earshot
      </Txt>
      <Txt variant="wordmark" accessibilityRole="header">
        earshot
      </Txt>
    </View>
  );
}

/** The sharing switch, as a studio ON AIR sign you can flick. */
function OnAir({ on, onFlick }: { on: boolean; onFlick: () => void }) {
  const x = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    x.value = withSpring(on ? 1 : 0, { damping: 13, stiffness: 260 });
  }, [on, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 26 }] }));
  return (
    <Card rotate={-0.6} fill={on ? colors.card : colors.paper} innerStyle={{ padding: 12 }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onFlick();
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel="Share what I'm playing with people nearby"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <View
          style={{
            borderWidth: 2,
            borderColor: colors.ink,
            backgroundColor: on ? colors.tomato : 'transparent',
            paddingHorizontal: 8,
            paddingVertical: 6,
            transform: [{ rotate: '-3deg' }],
          }}
        >
          <Txt style={{ fontFamily: fonts.poster, fontSize: 13, lineHeight: 16 }} color={on ? colors.white : colors.inkSoft}>
            {on ? 'ON AIR' : 'OFF AIR'}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="titleSm">{on ? 'You’re sharing.' : 'You’re listening in private.'}</Txt>
          <Txt variant="small" tone="soft">
            {on
              ? 'People nearby can see what you’re playing. Never where you are.'
              : 'Nobody nearby can see a thing. Very enigmatic. Suits you.'}
          </Txt>
        </View>
        <View
          style={{
            width: 58,
            height: 32,
            borderWidth: 2,
            borderColor: colors.ink,
            borderRadius: 4,
            backgroundColor: on ? colors.highlighter : colors.inkFaint,
            padding: 2,
          }}
        >
          <Animated.View style={[{ width: 24, height: 24, borderRadius: 2, backgroundColor: colors.ink }, knob]} />
        </View>
      </Pressable>
    </Card>
  );
}

/** What you've got on. Set by hand for now; a streaming service fills this in later. */
function NowPlayingStrip({ session }: { session: Session }) {
  const now = session.nowPlaying;
  const linked = useSpotify().status === 'on';
  const pick = () => router.push('/set-song');
  if (!now) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <View style={{ width: 46, height: 46, borderWidth: 2, borderColor: colors.ink, borderStyle: 'dashed', borderRadius: 2 }} />
        <View style={{ flex: 1 }}>
          <Txt variant="label" tone="soft">
            You’ve got on
          </Txt>
          <Txt variant="titleSm">{linked ? 'Nothing. Spotify’s quiet.' : 'Nothing. Suspicious.'}</Txt>
        </View>
        <InkLink label="put something on" onPress={pick} />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingLeft: 6 }}>
      <Sleeve track={now.track} size={46} record={false} />
      <View style={{ flex: 1 }}>
        <Txt variant="label" tone="soft">
          {now.note ? 'You shared' : linked ? 'You’ve got on, via Spotify' : 'You’ve got on'}
          {session.sharing ? '' : ' (only you can see this)'}
        </Txt>
        <Txt variant="titleSm" numberOfLines={1}>
          {now.track.title}
        </Txt>
        <Txt variant="meta" tone="soft" numberOfLines={1}>
          {now.track.artist}
        </Txt>
      </View>
      <InkLink label="change" onPress={pick} />
    </View>
  );
}

/** Shown until the phone has been placed somewhere. */
function NoPlaceYet() {
  return (
    <Card rotate={0.8} innerStyle={{ padding: 18 }}>
      <Stamp rotate={-3}>First things first</Stamp>
      <Txt variant="title" style={{ marginTop: 12 }}>
        Where’s “nearby”?
      </Txt>
      <Txt variant="body" tone="soft" style={{ marginTop: 6 }}>
        To show you who’s listening around you, earshot needs a rough idea of where you are. A neighbourhood, not an
        address. You can use your location or just pick a spot.
      </Txt>
      <View style={{ gap: 10, marginTop: 16 }}>
        <PosterButton label="turn on sharing" onPress={() => router.push({ pathname: '/place', params: { share: '1' } })} />
        <PosterButton label="just look around for now" kind="plain" onPress={() => router.push('/place')} />
      </View>
    </Card>
  );
}

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const feed = useLive((a) => a.getNearby(), ['nearby', 'session']);

  const areaId = session?.area?.id ?? null;
  const areaSource = session?.areaSource ?? null;
  const homeCity = session?.me?.homeCity ?? 'Toronto';
  const [pulsed, setPulsed] = useState<string | null>(null); // the area we've had a first answer for
  const [pulling, setPulling] = useState(false);
  const busy = useRef(false);

  const pulse = useCallback(async () => {
    if (!areaId || busy.current) return;
    busy.current = true;
    try {
      await api.refreshNearby();
      setPulsed(areaId);
    } catch {
      // A missed beat is fine; the next one will catch up.
    } finally {
      busy.current = false;
    }
  }, [api, areaId]);

  // Keep the feed moving while this tab is on screen and the app is open.
  useFocusEffect(
    useCallback(() => {
      pulse();
      const timer = setInterval(pulse, PULSE_MS);
      const sub = AppState.addEventListener('change', (s) => s === 'active' && pulse());
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [pulse]),
  );

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      // If you gave location permission, pulling also checks whether you've moved.
      if (areaSource === 'gps') {
        const area = await relocateQuietly();
        if (area && area.id !== areaId) {
          // too many moves just now: stay where you were rather than fail the refresh
          if (await api.setArea(area.id, 'gps').then(() => true, () => false)) slip(`You’ve moved. Now around ${area.name}.`);
        }
      }
      await api.refreshNearby();
    } catch {
      slip('Couldn’t refresh just then. Give it another pull.');
    } finally {
      setPulling(false);
    }
  }, [api, areaId, areaSource, slip]);

  const flick = useCallback(async () => {
    if (!session) return;
    if (!session.sharing && !session.area) {
      router.push({ pathname: '/place', params: { share: '1' } });
      return;
    }
    await api.setSharing(!session.sharing).catch(() => slip('That switch stuck. Try it again.'));
  }, [api, session, slip]);

  const renderItem = useCallback(
    ({ item, index }: { item: Sighting; index: number }) => (
      <SongCard
        sighting={item}
        index={index}
        cityLabel={homeCity}
        onOpenPerson={() => router.push({ pathname: '/room/[id]', params: { id: item.person.id } })}
        onSend={() => {
          const { link } = item;
          if (link.kind === 'chat') router.push({ pathname: '/chat/[id]', params: { id: link.id } });
          else if (link.kind === 'none') router.push({ pathname: '/send/[id]', params: { id: item.person.id, artist: item.track.artist } });
          else router.navigate('/inbox');
        }}
        onToggleSave={() =>
          api.toggleSave(item.track).then(
            (saved) => slip(saved ? 'In your crate.' : 'Back on the shelf.'),
            () => slip('Couldn’t save that. Try again.'),
          )
        }
        onOpenArtist={() => router.push({ pathname: '/artist/[name]', params: { name: item.track.artist, scope: homeCity } })}
      />
    ),
    [api, homeCity, slip],
  );

  if (!session?.me) return <Paper />;

  const items = areaId ? (feed.data ?? []) : [];
  const waiting = !!areaId && pulsed !== areaId && items.length === 0;
  const listening = items.filter((i) => i.status === 'playing').length;

  return (
    <Paper>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        windowSize={7}
        refreshControl={
          areaId ? <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.ink} colors={[colors.ink]} /> : undefined
        }
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          paddingBottom: 28,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 24 }}>
            <Wordmark />
            {session.area ? (
              <View style={{ marginTop: 2, marginBottom: 16 }}>
                <Txt variant="meta" tone="soft">
                  {items.length === 1 ? '1 person' : `${items.length} people`} within earshot. {listening} mid-song.
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <Txt variant="meta" tone="soft" style={{ flexShrink: 1 }} numberOfLines={1}>
                    Roughly: {session.area.name}
                  </Txt>
                  <InkLink label="move" onPress={() => router.push('/place')} />
                </View>
              </View>
            ) : (
              <View style={{ height: 14 }} />
            )}
            <OnAir on={session.sharing} onFlick={flick} />
            <NowPlayingStrip session={session} />
          </View>
        }
        ListEmptyComponent={
          !areaId ? (
            <NoPlaceYet />
          ) : waiting ? (
            <Txt style={[type.hand, { fontSize: 26, lineHeight: 28, marginTop: 20 }]} tone="soft" center>
              holding a glass to the wall…
            </Txt>
          ) : (
            <Card rotate={-0.8} innerStyle={{ padding: 18 }}>
              <Txt variant="title">Nobody’s sharing around here.</Txt>
              <Txt variant="body" tone="soft" style={{ marginTop: 6 }}>
                Either it’s just you, or everyone within earshot has something to hide. Pull down to check again, or go and
                stand somewhere with more people in it.
              </Txt>
            </Card>
          )
        }
        ListFooterComponent={
          items.length ? (
            <View style={{ alignItems: 'center', paddingTop: 6, paddingHorizontal: 20 }}>
              <Txt style={[type.hand, { fontSize: 24, lineHeight: 26 }]} tone="soft" center>
                that’s everyone for now. it changes as people come and go.
              </Txt>
            </View>
          ) : undefined
        }
      />
    </Paper>
  );
}

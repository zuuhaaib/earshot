/**
 * The song card: earshot's staff-pick card. A record in its sleeve, who had it
 * on, and the three things you can do about it.
 */
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import type { Sighting } from '@/data/types';
import { colors, tilt } from '@/theme';
import { Card, InkLink, PinBadge, PosterButton, Stamp, Tape, Txt, useInks, wash } from './print';
import { Sleeve } from './Sleeve';

/** What the main button says, depending on where things stand with this person. */
export const SEND_LABEL = {
  none: 'send a song back',
  sent: 'song sent',
  incoming: 'they sent you one',
  chat: 'open chat',
} as const;

export function statusText(item: Pick<Sighting, 'status' | 'minutesAgo'>) {
  if (item.status === 'playing') return 'Playing now';
  if (item.status === 'shared') return 'Shared a track';
  const m = item.minutesAgo;
  if (m < 1) return 'Played just now';
  if (m < 60) return `Played ${m} min ago`;
  const h = Math.round(m / 60);
  return `Played ${h} hr ago`;
}

/** The little light that blinks while someone's actually listening. */
function LiveDot() {
  const on = useSharedValue(1);
  useEffect(() => {
    on.value = withRepeat(
      withSequence(withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 700 })),
      -1,
    );
  }, [on]);
  const style = useAnimatedStyle(() => ({ opacity: on.value }));
  return (
    <Animated.View
      style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.tomato, borderWidth: 1.5, borderColor: colors.ink }, style]}
    />
  );
}

export function DashedRule({ color }: { color?: string }) {
  const inks = useInks();
  return (
    <Svg width="100%" height={2}>
      <Line x1="0" y1="1" x2="100%" y2="1" stroke={color ?? wash(inks.ink, 0.45)} strokeWidth={1.5} strokeDasharray="5 5" />
    </Svg>
  );
}

type Props = {
  sighting: Sighting;
  /** Position in the feed; staggers the drop. */
  index: number;
  onOpenPerson: () => void;
  onSend: () => void;
  onToggleSave: () => void;
  onOpenArtist: () => void;
  /** Where the artist link points, e.g. "Toronto". */
  cityLabel: string;
};

export const SongCard = React.memo(function SongCard({
  sighting: item,
  index,
  onOpenPerson,
  onSend,
  onToggleSave,
  onOpenArtist,
  cityLabel,
}: Props) {
  const { person, track, saved } = item;
  const rest = tilt(item.id, 1.3);

  // The card drops onto the pile like a sleeve flicked onto a counter.
  const landed = useSharedValue(0);
  useEffect(() => {
    landed.value = withDelay(Math.min(index, 5) * 90, withSpring(1, { damping: 13, stiffness: 150, mass: 0.9 }));
  }, [index, landed]);
  const drop = useAnimatedStyle(() => ({
    opacity: Math.min(1, landed.value * 1.6),
    transform: [{ translateY: (1 - landed.value) * -46 }, { rotate: `${(1 - landed.value) * -7}deg` }],
  }));

  return (
    <Animated.View style={[{ marginBottom: 22 }, drop]}>
      <Card rotate={rest} innerStyle={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {item.status === 'playing' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.highlighter,
                borderWidth: 1.5,
                borderColor: colors.ink,
                paddingHorizontal: 7,
                paddingVertical: 3,
                transform: [{ rotate: '-1.5deg' }],
              }}
            >
              <LiveDot />
              <Txt variant="label">Playing now</Txt>
            </View>
          ) : (
            <Stamp color={item.status === 'shared' ? colors.teal : colors.inkSoft} filled={item.status === 'shared'} rotate={-1.5}>
              {statusText(item)}
            </Stamp>
          )}
          <Txt variant="meta" tone="soft">
            within earshot
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Sleeve track={track} size={104} />
          <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 4 }}>
            <Txt variant="title" numberOfLines={3}>
              {track.title}
            </Txt>
            <Txt variant="bodyItalic" numberOfLines={1} style={{ marginTop: 2 }}>
              {track.artist}
            </Txt>
            <Txt variant="meta" tone="soft" numberOfLines={1} style={{ marginTop: 4 }}>
              {track.album}
              {track.year ? ` · ${track.year}` : ''}
            </Txt>
          </View>
        </View>

        {item.note ? (
          <View style={{ marginTop: 16, marginHorizontal: 4 }}>
            <View
              style={{
                backgroundColor: colors.highlighter,
                paddingHorizontal: 12,
                paddingTop: 12,
                paddingBottom: 8,
                transform: [{ rotate: `${-rest * 1.4}deg` }],
              }}
            >
              <Txt variant="hand">{item.note}</Txt>
            </View>
            <Tape rotate={-5} width={58} style={{ top: -9, left: '40%' }} />
          </View>
        ) : null}

        <View style={{ marginVertical: 14 }}>
          <DashedRule />
        </View>

        <Pressable
          onPress={onOpenPerson}
          accessibilityRole="button"
          accessibilityLabel={`Open ${person.name}'s room`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <PinBadge label={person.badge} color={person.badgeColor} rotate={tilt(person.id, 9)} />
          <View style={{ flex: 1 }}>
            <Txt variant="titleSm" numberOfLines={1}>
              {person.name}
            </Txt>
            <Txt variant="hand" tone="soft" numberOfLines={2} style={{ fontSize: 20, lineHeight: 21 }}>
              {person.tagline}
            </Txt>
          </View>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <PosterButton
            label={SEND_LABEL[item.link.kind]}
            kind={item.link.kind === 'sent' ? 'plain' : 'primary'}
            small
            onPress={onSend}
            style={{ flex: 1 }}
          />
          <PosterButton
            label={saved ? 'saved' : 'save'}
            kind="plain"
            small
            accessibilityState={{ selected: saved }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onToggleSave();
            }}
            style={{ minWidth: 84 }}
          />
        </View>

        <InkLink label={`${track.artist} · ${cityLabel}`} onPress={onOpenArtist} style={{ alignSelf: 'flex-start', marginTop: 14 }} />
      </Card>
    </Animated.View>
  );
});

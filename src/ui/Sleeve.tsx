/**
 * A record in its sleeve. The artwork is the sleeve; a record peeks out of the
 * right-hand side. Tap it and the record slides further out and starts to
 * spin while the preview plays.
 */
import React, { useEffect } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { togglePreview, useIsPlaying, type Track } from '@/music';
import { colors } from '@/theme';
import { useInks, wash } from './print';

/** iTunes artwork comes in any size you ask for; don't pull 600px for a thumbnail. */
function artworkAt(url: string, px: number) {
  const want = px <= 70 ? 200 : px <= 130 ? 300 : 600;
  return url.replace(/\/\d+x\d+bb\./, `/${want}x${want}bb.`);
}

export function Sleeve({
  track,
  size = 104,
  playable = true,
  record = true,
  badge = 'always',
  style,
}: {
  track: Track;
  size?: number;
  playable?: boolean;
  /** Draw the record peeking out. Turn off for dense grids. */
  record?: boolean;
  /** When to show the play button. 'playing' keeps walls of sleeves uncluttered. */
  badge?: 'always' | 'playing';
  style?: StyleProp<ViewStyle>;
}) {
  const inks = useInks();
  const playing = useIsPlaying(track.id);
  const out = useSharedValue(0); // 0 resting, 1 pulled out
  const spin = useSharedValue(0);

  useEffect(() => {
    out.value = withSpring(playing ? 1 : 0, { damping: 14, stiffness: 160 });
    if (playing) {
      spin.value = withRepeat(withTiming(spin.value + 360, { duration: 1800, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(spin);
    }
  }, [playing, out, spin]);

  const rest = size * 0.22;
  const pulled = size * 0.38;
  const disc = size * 0.92;
  const recordStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rest + out.value * (pulled - rest) }, { rotate: `${spin.value}deg` }],
  }));

  const canPlay = playable && !!track.previewUrl;
  const badgeSize = Math.max(26, size * 0.28);
  const showBadge = canPlay && (badge === 'always' || playing);
  // Only a button when there's something to play, so it can sit inside other tappable rows.
  const Frame: React.ElementType = canPlay ? Pressable : View;

  return (
    <Frame
      {...(canPlay
        ? {
            onPress: () => {
              Haptics.selectionAsync().catch(() => {});
              togglePreview(track);
            },
            accessibilityRole: 'button' as const,
            accessibilityLabel: `${playing ? 'Pause' : 'Play'} preview of ${track.title} by ${track.artist}`,
          }
        : {})}
      style={[{ width: size + (record ? pulled : 0), height: size }, style]}
    >
      {record && (
        <Animated.View
          style={[{ position: 'absolute', left: size - disc, top: (size - disc) / 2, width: disc, height: disc }, recordStyle]}
        >
          <Svg width={disc} height={disc} viewBox="0 0 100 100">
            <Circle cx={50} cy={50} r={49} fill={inks.ink} />
            <Circle cx={50} cy={50} r={41} stroke={wash(inks.paper, 0.3)} strokeWidth={1} fill="none" />
            <Circle cx={50} cy={50} r={33} stroke={wash(inks.paper, 0.3)} strokeWidth={1} fill="none" />
            <Circle cx={50} cy={50} r={25} stroke={wash(inks.paper, 0.3)} strokeWidth={1} fill="none" />
            <Circle cx={50} cy={50} r={17} fill={inks.highlight} />
            {/* an off-centre mark so you can see it turning */}
            <Rect x={48} y={36} width={4} height={7} fill={inks.ink} />
            <Circle cx={50} cy={50} r={3} fill={inks.paper} />
          </Svg>
        </Animated.View>
      )}
      <View style={{ width: size, height: size, borderWidth: 2, borderColor: inks.ink, backgroundColor: colors.kraft }}>
        <Image
          source={artworkAt(track.artworkUrl, size)}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={200}
          recyclingKey={track.id}
          accessibilityLabel={`Cover of ${track.album}`}
        />
      </View>
      {showBadge && (
        <View
          style={{
            position: 'absolute',
            left: -7,
            bottom: -7,
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: playing ? inks.highlight : inks.accent,
            borderWidth: 2,
            borderColor: inks.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={badgeSize * 0.42} height={badgeSize * 0.42} viewBox="0 0 10 10">
            {playing ? (
              <>
                <Rect x={1.5} y={1} width={2.6} height={8} fill={colors.ink} />
                <Rect x={5.9} y={1} width={2.6} height={8} fill={colors.ink} />
              </>
            ) : (
              <Path d="M2.2 0.8 L9.2 5 L2.2 9.2 Z" fill={colors.white} />
            )}
          </Svg>
        </View>
      )}
    </Frame>
  );
}

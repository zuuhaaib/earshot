/**
 * Stickers. Die-cut shapes with a fat outline. Poke one and its corner lifts
 * as if you were about to peel it, then it thinks better of it.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import type { Sticker as StickerData, StickerKind } from '@/data/types';
import { fonts } from '@/theme';
import { useInks } from './print';

function burstPath(points: number, outer: number, inner: number) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)} `;
  }
  return d + 'Z';
}

const STAR = burstPath(5, 46, 20);
const BURST = burstPath(14, 47, 37);

function Shape({ kind, color, ink }: { kind: StickerKind; color: string; ink: string }) {
  const line = { stroke: ink, strokeWidth: 4.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (kind) {
    case 'star':
      return <Path d={STAR} fill={color} {...line} />;
    case 'burst':
      return <Path d={BURST} fill={color} {...line} />;
    case 'heart':
      return <Path d="M50 88 C 8 58, 6 26, 28 16 C 40 11, 48 18, 50 28 C 52 18, 60 11, 72 16 C 94 26, 92 58, 50 88 Z" fill={color} {...line} />;
    case 'bolt':
      return <Path d="M58 4 L18 56 L44 56 L36 96 L82 40 L54 40 Z" fill={color} {...line} />;
    case 'eye':
      return (
        <>
          <Path d="M4 50 C 22 20, 78 20, 96 50 C 78 80, 22 80, 4 50 Z" fill={color} {...line} />
          <Circle cx={50} cy={50} r={15} fill={ink} />
          <Circle cx={55} cy={45} r={4} fill={color} />
        </>
      );
    case 'smile':
      return (
        <>
          <Circle cx={50} cy={50} r={45} fill={color} {...line} />
          <Ellipse cx={36} cy={40} rx={4} ry={8} fill={ink} />
          <Ellipse cx={64} cy={40} rx={4} ry={8} fill={ink} />
          <Path d="M27 58 C 36 78, 64 78, 73 58" fill="none" {...line} />
        </>
      );
    case 'flower':
      return (
        <>
          {[0, 72, 144, 216, 288].map((a) => (
            <Ellipse key={a} cx={50} cy={24} rx={16} ry={22} fill={color} {...line} transform={`rotate(${a} 50 50)`} />
          ))}
          <Circle cx={50} cy={50} r={13} fill={ink} />
        </>
      );
  }
}

export const STICKER_KINDS: StickerKind[] = ['star', 'burst', 'heart', 'eye', 'smile', 'bolt', 'flower'];

/** Just the drawing: the shape and its label, filling whatever box it's given. */
export function StickerArt({ sticker }: { sticker: Pick<StickerData, 'kind' | 'color' | 'size' | 'label'> }) {
  const inks = useInks();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Shape kind={sticker.kind} color={sticker.color} ink={inks.ink} />
      </Svg>
      {sticker.label ? (
        <Text
          style={{
            fontFamily: fonts.poster,
            fontSize: sticker.size * 0.17,
            lineHeight: sticker.size * 0.2,
            color: '#1F2A6B',
            textAlign: 'center',
          }}
        >
          {sticker.label}
        </Text>
      ) : null}
    </View>
  );
}

export function Sticker({ sticker }: { sticker: StickerData }) {
  const peel = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${sticker.rotate + peel.value * 16}deg` },
      { scale: 1 + peel.value * 0.14 },
      { translateY: -peel.value * 6 },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${sticker.x * 100}%`,
          top: `${sticker.y * 100}%`,
          width: sticker.size,
          height: sticker.size,
          zIndex: 5,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityLabel={`${sticker.kind} sticker`}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          peel.value = withSequence(withTiming(1, { duration: 140 }), withSpring(0, { damping: 6, stiffness: 180 }));
        }}
        style={{ flex: 1 }}
      >
        <StickerArt sticker={sticker} />
      </Pressable>
    </Animated.View>
  );
}

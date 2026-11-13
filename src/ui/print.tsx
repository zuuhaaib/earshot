/**
 * The building blocks every screen is printed with: ink context, text, paper,
 * cards with a hard offset shadow, tape, rubber stamps, pin badges, buttons.
 */
import React, { createContext, useContext, useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, textures, tilt, type, type TypeVariant } from '@/theme';

// ---- ink ------------------------------------------------------------------

export type Inks = {
  paper: string;
  card: string;
  ink: string;
  accent: string; // things you can do
  highlight: string; // things happening now
  /** Font used for poster-size headings. Rooms can swap it. */
  display: string;
};

export const houseInks: Inks = {
  paper: colors.paper,
  card: colors.card,
  ink: colors.ink,
  accent: colors.tomato,
  highlight: colors.highlighter,
  display: fonts.poster,
};

const InkContext = createContext<Inks>(houseInks);
export const InkProvider = InkContext.Provider;
export const useInks = () => useContext(InkContext);

/** The same ink, watered down. alpha 0..1. Expects #RRGGBB. */
export function wash(hex: string, alpha: number) {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.length === 7 ? hex + a : hex;
}

// ---- text -----------------------------------------------------------------

type TxtProps = TextProps & {
  variant?: TypeVariant;
  color?: string;
  /** 'soft' is the ink watered down, for secondary text. */
  tone?: 'ink' | 'soft' | 'faint' | 'accent';
  center?: boolean;
};

export function Txt({ variant = 'body', color, tone = 'ink', center, style, ...rest }: TxtProps) {
  const inks = useInks();
  const base = type[variant] as TextStyle;
  const isDisplay = variant === 'poster' || variant === 'posterSm' || variant === 'wordmark';
  const c =
    color ??
    (tone === 'soft' ? wash(inks.ink, 0.68) : tone === 'faint' ? wash(inks.ink, 0.4) : tone === 'accent' ? inks.accent : inks.ink);
  return (
    <Text
      {...rest}
      style={[base, isDisplay && { fontFamily: inks.display }, { color: c }, center && { textAlign: 'center' }, style]}
    />
  );
}

// ---- paper ----------------------------------------------------------------

export type TextureName = keyof typeof textures | 'none';

/** A full-bleed sheet of paper with photocopier grain (and an optional pattern). */
export function Paper({
  children,
  texture = 'none',
  style,
}: {
  children?: React.ReactNode;
  texture?: TextureName;
  style?: StyleProp<ViewStyle>;
}) {
  const inks = useInks();
  return (
    <View style={[{ flex: 1, backgroundColor: inks.paper }, style]}>
      {texture !== 'none' && texture !== 'grain' && (
        <Image source={textures[texture]} resizeMode="repeat" style={[StyleSheet.absoluteFill, styles.tex]} />
      )}
      <Image source={textures.grain} resizeMode="repeat" style={[StyleSheet.absoluteFill, styles.tex, { opacity: 0.5 }]} />
      {children}
    </View>
  );
}

// ---- card -----------------------------------------------------------------

/**
 * An index card with a hard, unblurred shadow, like a second colour printed
 * slightly out of register. `rotate` in degrees.
 */
export function Card({
  children,
  rotate = 0,
  fill,
  shadow = 5,
  style,
  innerStyle,
}: {
  children?: React.ReactNode;
  rotate?: number;
  fill?: string;
  shadow?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}) {
  const inks = useInks();
  return (
    <View style={[{ transform: [{ rotate: `${rotate}deg` }], paddingRight: shadow, paddingBottom: shadow }, style]}>
      <View
        style={{
          position: 'absolute',
          left: shadow,
          top: shadow,
          right: 0,
          bottom: 0,
          backgroundColor: inks.ink,
          borderRadius: 3,
        }}
      />
      <View
        style={[
          { backgroundColor: fill ?? inks.card, borderWidth: 2, borderColor: inks.ink, borderRadius: 3 },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// ---- tape -----------------------------------------------------------------

/** A torn strip of masking tape. Position it absolutely over a corner. */
export function Tape({ rotate = -4, width = 64, style }: { rotate?: number; width?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', width, height: 20, backgroundColor: colors.tape, transform: [{ rotate: `${rotate}deg` }] }, style]}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(255,255,255,0.35)' }} />
    </View>
  );
}

// ---- stamp ----------------------------------------------------------------

/** A rubber stamp: typewriter caps in a slightly crooked box. */
export function Stamp({
  children,
  color,
  filled,
  rotate = -2,
  style,
}: {
  children: string;
  color?: string;
  filled?: boolean;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const inks = useInks();
  const c = color ?? inks.ink;
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          borderWidth: 1.5,
          borderColor: c,
          backgroundColor: filled ? c : 'transparent',
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: 2,
          transform: [{ rotate: `${rotate}deg` }],
        },
        style,
      ]}
    >
      <Text style={[type.label, { color: filled ? inks.card : c }]}>{children}</Text>
    </View>
  );
}

// ---- pin badge ------------------------------------------------------------

/**
 * People are button badges, not profile photos: a colour and a couple of
 * letters, the kind of pin you'd have on a jacket or a tote bag.
 */
export function PinBadge({
  label,
  color,
  size = 44,
  rotate = 0,
}: {
  label: string;
  color: string;
  size?: number;
  rotate?: number;
}) {
  const inks = useInks();
  return (
    <View style={{ width: size + 3, height: size + 3, transform: [{ rotate: `${rotate}deg` }] }}>
      <View style={{ position: 'absolute', left: 3, top: 3, width: size, height: size, borderRadius: size / 2, backgroundColor: inks.ink }} />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: inks.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{ fontFamily: fonts.poster, fontSize: size * 0.36, lineHeight: size * 0.5, color: colors.ink }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {/* the little glint every badge has */}
        <View
          style={{
            position: 'absolute',
            top: size * 0.14,
            left: size * 0.2,
            width: size * 0.2,
            height: size * 0.09,
            borderRadius: size,
            backgroundColor: 'rgba(255,255,255,0.6)',
            transform: [{ rotate: '-30deg' }],
          }}
        />
      </View>
    </View>
  );
}

// ---- buttons --------------------------------------------------------------

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  kind?: 'primary' | 'plain';
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A chunky printed button. Pressing it pushes the face down onto its shadow,
 * which is the whole animation and all it needs.
 */
export function PosterButton({ label, kind = 'primary', small, style, onPressIn, onPressOut, ...rest }: ButtonProps) {
  const inks = useInks();
  const depth = 4;
  const down = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateX: down.value * depth }, { translateY: down.value * depth }] }));
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPressIn={(e) => {
        down.value = withTiming(1, { duration: 60 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        down.value = withSpring(0, { damping: 12, stiffness: 320 });
        onPressOut?.(e);
      }}
      style={[{ paddingRight: depth, paddingBottom: depth }, rest.disabled && { opacity: 0.45 }, style]}
      {...rest}
    >
      <View style={{ position: 'absolute', left: depth, top: depth, right: 0, bottom: 0, backgroundColor: inks.ink, borderRadius: 4 }} />
      <Animated.View
        style={[
          {
            backgroundColor: primary ? inks.accent : inks.card,
            borderWidth: 2,
            borderColor: inks.ink,
            borderRadius: 4,
            paddingHorizontal: small ? 12 : 16,
            paddingVertical: small ? 7 : 10,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: small ? 38 : 46,
          },
          face,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[type.button, small && { fontSize: 13 }, { fontFamily: fonts.poster, color: primary ? colors.white : inks.ink }]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** A typewritten link with a biro underline. For going somewhere, not doing something. */
export function InkLink({ label, onPress, style }: { label: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const inks = useInks();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="link" style={style}>
      <Text style={[type.meta, { fontFamily: fonts.typeBold, color: inks.ink }]}>{label} →</Text>
      <Scribble color={inks.accent} height={5} />
    </Pressable>
  );
}

// ---- pen marks ------------------------------------------------------------

/** A wobbly biro underline that stretches to its parent's width. */
export function Scribble({ color, height = 7 }: { color: string; height?: number }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 100 8" preserveAspectRatio="none">
      <Path d="M1 5 C 12 1, 22 7, 34 4 S 58 1, 70 5 S 90 6, 99 2" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** A loop drawn round something in marker, slightly failing to close. */
export function MarkerLoop({ color, style }: { color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
        <Path
          d="M14 8 C 40 -1, 78 1, 93 12 C 103 22, 84 37, 50 37 C 20 38, 1 30, 5 18 C 8 9, 24 4, 44 4"
          stroke={color}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </View>
  );
}

/** Section heading: poster type sitting on a highlighter swipe. */
export function Heading({ children, kicker, style }: { children: string; kicker?: string; style?: StyleProp<ViewStyle> }) {
  const inks = useInks();
  const rot = useMemo(() => tilt(children, 1.2), [children]);
  return (
    <View style={[{ alignSelf: 'flex-start', marginBottom: 12 }, style]}>
      {kicker ? (
        <Txt variant="label" tone="soft" style={{ marginBottom: 2 }}>
          {kicker}
        </Txt>
      ) : null}
      <View>
        <View
          style={{
            position: 'absolute',
            left: -4,
            right: -6,
            bottom: 2,
            height: 13,
            backgroundColor: inks.highlight,
            transform: [{ rotate: `${rot * 0.5}deg` }],
          }}
        />
        <Txt variant="posterSm">{children}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tex: { width: '100%', height: '100%' },
});

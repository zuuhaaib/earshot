/** Form bits and small screen furniture, printed in the house style. */
import React from 'react';
import { Pressable, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import type { Track } from '@/music';
import { fonts } from '@/theme';
import { Txt, useInks, wash } from './print';
import { Sleeve } from './Sleeve';

export function Field({
  label,
  hint,
  error,
  style,
  containerStyle,
  ...input
}: TextInputProps & { label?: string; hint?: string; error?: string | null; containerStyle?: StyleProp<ViewStyle> }) {
  const inks = useInks();
  return (
    <View style={containerStyle}>
      {label ? (
        <Txt variant="label" tone="soft" style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={wash(inks.ink, 0.38)}
        selectionColor={inks.accent}
        {...input}
        style={[
          {
            backgroundColor: inks.card,
            borderWidth: 2,
            borderColor: error ? inks.accent : inks.ink,
            borderRadius: 3,
            paddingHorizontal: 12,
            paddingVertical: 11,
            fontFamily: fonts.serif,
            fontSize: 16,
            color: inks.ink,
          },
          input.multiline && { minHeight: 84, textAlignVertical: 'top' },
          style,
        ]}
      />
      {error ? (
        <Txt variant="small" tone="accent" style={{ marginTop: 6 }}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small" tone="soft" style={{ marginTop: 6 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/** Go back, or home if this screen was the first one opened. */
export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function BackLink({ label = 'back', onPress }: { label?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress ?? goBack}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
    >
      <Txt variant="meta" style={{ fontFamily: fonts.typeBold }}>
        ← {label}
      </Txt>
    </Pressable>
  );
}

/** A track as a row: small sleeve you can tap to preview, title, artist, and something on the right. */
export function TrackRow({
  track,
  onPress,
  right,
  size = 50,
}: {
  track: Track;
  onPress?: () => void;
  right?: React.ReactNode;
  size?: number;
}) {
  const body = (
    <View style={{ flex: 1 }}>
      <Txt variant="titleSm" numberOfLines={1}>
        {track.title}
      </Txt>
      <Txt variant="meta" tone="soft" numberOfLines={1}>
        {track.artist}
        {track.album ? ` · ${track.album}` : ''}
      </Txt>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingLeft: 6 }}>
      <Sleeve track={track} size={size} record={false} />
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Choose ${track.title} by ${track.artist}`}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: size }}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {right}
    </View>
  );
}

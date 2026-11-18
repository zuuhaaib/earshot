/**
 * While a 30-second preview is loaded, a small tag at the top of the screen
 * offers the whole song on Apple Music. The previews come from Apple's
 * catalogue, and the catalogue's terms ask for a link back beside them.
 */
import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stopPreview, usePreviewLink } from '@/music';
import { colors } from '@/theme';
import { Txt } from './print';

export function PreviewLink() {
  const insets = useSafeAreaInsets();
  const link = usePreviewLink();
  if (!link) return null;

  const open = () => {
    stopPreview();
    Linking.openURL(`https://music.apple.com/song/${link.sourceId}`).catch(() => {});
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 6, alignItems: 'center' }}>
      <Animated.View entering={FadeInUp.duration(200)} exiting={FadeOutUp.duration(160)} style={{ maxWidth: '88%' }}>
        <Pressable
          onPress={open}
          accessibilityRole="link"
          accessibilityLabel={`Hear all of ${link.title} on Apple Music`}
          hitSlop={8}
          style={{ backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 12, paddingVertical: 6, transform: [{ rotate: '0.6deg' }] }}
        >
          <Txt variant="meta" numberOfLines={1}>
            30-second preview · hear it all on Apple Music ↗
          </Txt>
        </Pressable>
      </Animated.View>
    </View>
  );
}

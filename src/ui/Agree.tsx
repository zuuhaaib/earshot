/** The tick every new account needs: old enough, and agrees to the terms. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { MIN_AGE } from '@/legal/config';
import { colors } from '@/theme';
import { InkLink, Txt } from './print';

export function Agree({ value, onChange }: { value: boolean; onChange: (agreed: boolean) => void }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Pressable
        onPress={() => onChange(!value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            marginTop: 2,
            borderWidth: 2,
            borderColor: colors.ink,
            backgroundColor: value ? colors.ink : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value ? (
            <Txt variant="small" color={colors.paper}>
              ✓
            </Txt>
          ) : null}
        </View>
        <Txt variant="body" style={{ flex: 1 }}>
          I’m {MIN_AGE} or older, and I agree to earshot’s terms, including no abusive or objectionable content.
        </Txt>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 22, marginTop: 10, marginLeft: 32 }}>
        <InkLink label="read the terms" onPress={() => router.push('/terms')} />
        <InkLink label="privacy" onPress={() => router.push('/privacy')} />
      </View>
    </View>
  );
}

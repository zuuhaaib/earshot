/**
 * earshot's toast: a slip of paper that slides up from behind the tab bar,
 * says one thing, and leaves.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { Txt } from './print';

const SlipContext = createContext<(message: string) => void>(() => {});
export const useSlip = () => useContext(SlipContext);

export function SlipProvider({ children }: { children: React.ReactNode }) {
  const [slip, setSlip] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setSlip({ id: Date.now(), message });
    timer.current = setTimeout(() => setSlip(null), 2600);
  }, []);

  return (
    <SlipContext.Provider value={show}>
      {children}
      {slip && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 84, alignItems: 'center' }}>
          <Animated.View
            key={slip.id}
            // eases up a short way and stops; no spring, so it doesn't wobble
            entering={FadeInDown.duration(220).easing(Easing.out(Easing.cubic))}
            exiting={FadeOutDown.duration(180)}
            accessibilityLiveRegion="polite"
            style={{
              maxWidth: '86%',
              backgroundColor: colors.highlighter,
              borderWidth: 2,
              borderColor: colors.ink,
              paddingHorizontal: 16,
              paddingVertical: 10,
              transform: [{ rotate: '-1.5deg' }],
            }}
          >
            <Txt variant="titleSm" color={colors.ink} center>
              {slip.message}
            </Txt>
          </Animated.View>
        </View>
      )}
    </SlipContext.Provider>
  );
}

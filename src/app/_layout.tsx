import React, { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BowlbyOne_400Regular } from '@expo-google-fonts/bowlby-one';
import {
  Besley_500Medium,
  Besley_500Medium_Italic,
  Besley_800ExtraBold,
  Besley_900Black,
} from '@expo-google-fonts/besley';
import { CourierPrime_400Regular, CourierPrime_700Bold } from '@expo-google-fonts/courier-prime';
import { NanumPenScript_400Regular } from '@expo-google-fonts/nanum-pen-script';
import { useCloudSessionSync } from '@/backend/sync';
import { DataProvider, useApi } from '@/data';
import { stopPreview } from '@/music';
import { colors } from '@/theme';
import { PreviewLink } from '@/ui/PreviewLink';
import { SlipProvider } from '@/ui/Slip';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Sits inside the data provider and keeps the phone's idea of who's logged in matching the backend's. */
function CloudSession() {
  useCloudSessionSync(useApi());
  return null;
}

export default function RootLayout() {
  // A preview belongs to the screen it was started on. Tabs stay alive in the background, so stop on any move.
  const pathname = usePathname();
  useEffect(() => stopPreview(), [pathname]);

  const [loaded, error] = useFonts({
    BowlbyOne_400Regular,
    Besley_500Medium,
    Besley_500Medium_Italic,
    Besley_800ExtraBold,
    Besley_900Black,
    CourierPrime_400Regular,
    CourierPrime_700Bold,
    NanumPenScript_400Regular,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SafeAreaProvider>
        <DataProvider>
          <SlipProvider>
            <CloudSession />
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
              <Stack.Screen name="room/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="place" options={{ presentation: 'modal' }} />
              <Stack.Screen name="set-song" options={{ presentation: 'modal' }} />
              <Stack.Screen name="send/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="room/edit" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="room/section/[index]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="pick-song" options={{ presentation: 'modal' }} />
              <Stack.Screen name="sign/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="post" options={{ presentation: 'modal' }} />
              <Stack.Screen name="artist/[name]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="thread/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="new-thread" options={{ presentation: 'modal' }} />
              <Stack.Screen name="login" options={{ presentation: 'modal' }} />
              <Stack.Screen name="password" options={{ presentation: 'modal' }} />
              <Stack.Screen name="upgrade" options={{ presentation: 'modal' }} />
              <Stack.Screen name="finish-profile" options={{ animation: 'fade' }} />
              <Stack.Screen name="safety/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="blocked" options={{ presentation: 'modal' }} />
              <Stack.Screen name="delete-account" options={{ presentation: 'modal' }} />
              <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
              <Stack.Screen name="support" options={{ presentation: 'modal' }} />
              <Stack.Screen name="terms" options={{ presentation: 'modal' }} />
            </Stack>
            <PreviewLink />
          </SlipProvider>
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

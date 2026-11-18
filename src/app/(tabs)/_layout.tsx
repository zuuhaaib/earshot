import React from 'react';
import { Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, useSession } from '@/data';
import { useLastfmSync } from '@/lastfm/sync';
import { SPOTIFY_ENABLED } from '@/spotify/config';
import { useSpotifySync } from '@/spotify/sync';
import { colors, fonts } from '@/theme';
import { MarkerLoop, Txt } from '@/ui/print';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const LABELS: Record<string, string> = { index: 'nearby', city: 'city', inbox: 'inbox', you: 'you' };

/**
 * The tab bar is four words on the bottom edge of the page. Wherever you are
 * has been circled in marker.
 */
function TabBar({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { data: waiting } = useLive((a) => a.getInboxCount(), ['inbox', 'session']);
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderTopWidth: 2,
        borderTopColor: colors.ink,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
        paddingHorizontal: 8,
      }}
    >
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const label = LABELS[route.name] ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={route.name === 'inbox' && waiting ? `inbox, ${waiting} new` : label}
            onPress={() => {
              if (!focused) Haptics.selectionAsync().catch(() => {});
              navigateToTab(route.key);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 }}
          >
            <View style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              {focused && <MarkerLoop color={colors.tomato} />}
              <Txt
                style={{ fontFamily: fonts.poster, fontSize: 15, lineHeight: 20 }}
                color={focused ? colors.ink : colors.inkSoft}
              >
                {label}
              </Txt>
              {route.name === 'inbox' && waiting ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    paddingHorizontal: 4,
                    backgroundColor: colors.tomato,
                    borderWidth: 2,
                    borderColor: colors.ink,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt style={{ fontFamily: fonts.typeBold, fontSize: 11, lineHeight: 13 }} color={colors.white}>
                    {waiting > 9 ? '9+' : String(waiting)}
                  </Txt>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const api = useApi();
  const { data: session } = useSession();
  // Keeps "what you've got on" in step with Spotify while the signed-in app is open.
  useSpotifySync(api, SPOTIFY_ENABLED ? (session?.me?.id ?? null) : null);
  useLastfmSync(api, session?.me?.id ?? null);
  if (!session) return null;
  // Nobody signed in yet: go and make a badge first.
  if (!session.me) return <Redirect href="/welcome" />;
  // Signed in with Google but no handle or badge yet.
  if (session.needsProfile) return <Redirect href="/finish-profile" />;
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="city" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}

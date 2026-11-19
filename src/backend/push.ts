/**
 * Push notifications on this phone: asking permission, telling the server where
 * to reach this phone, and opening the right screen when one is tapped. What
 * gets sent, and when, is decided by the server (supabase/schema.sql).
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { callServer, setPushToken } from './accounts';
import { cloudConfigured } from './config';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Android in Expo Go can't receive pushes; a real build can. Phone-only mode has no server to send them. */
export const pushSupported = () =>
  cloudConfigured() && Platform.OS !== 'web' && !(Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient');

export type PushState = 'unsupported' | 'ask' | 'on' | 'off';

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'on';
  return p.canAskAgain ? 'ask' : 'off';
}

// Android 13 won't show the permission prompt, or hand out a token, until a channel exists.
const channel = () =>
  Platform.OS === 'android'
    ? Notifications.setNotificationChannelAsync('default', { name: 'Songs and messages', importance: AndroidImportance.HIGH })
    : Promise.resolve(null);

/** Tell the server how to reach this phone, for whoever is logged in. */
async function register() {
  await channel();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await callServer('register_push_token', { p_token: data });
  setPushToken(data);
}

/** Show the system prompt, and register if the answer is yes. Resolves to whether notifications are now on. */
export async function turnOnPush(): Promise<boolean> {
  await channel();
  const { granted } = await Notifications.requestPermissionsAsync();
  if (granted) await register();
  return granted;
}

/** Mount once in the signed-in app: keeps this phone registered, and opens what a tapped notification points at. */
export function usePush(userId: string | null) {
  useEffect(() => {
    if (!userId || !pushSupported()) return;
    Notifications.getPermissionsAsync()
      .then((p) => (p.granted ? register() : undefined))
      .catch(() => {}); // offline, say; it registers again next launch
  }, [userId]);

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
    };
    // the app was opened by tapping one
    Notifications.getLastNotificationResponseAsync()
      .then((last) => {
        if (!last) return;
        open(last);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [userId]);
}

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPush, unregisterPush } from './api';
import { useSession } from './session';

/**
 * Notifications, for a reader who is signed in.
 *
 * Asks the phone once, registers the token with the House, and forgets
 * it again on sign-out so a phone that changes hands stays quiet. A
 * tapped notification opens the path the House sent, a story usually.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registered: string | null = null;

export function usePushRegistration() {
  const { session } = useSession();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Device.isDevice) return;
      if (!session) {
        if (registered) {
          unregisterPush(registered).catch(() => {});
          registered = null;
        }
        return;
      }
      const { status } = await Notifications.getPermissionsAsync();
      const granted = status === 'granted' || (await Notifications.requestPermissionsAsync()).status === 'granted';
      if (!granted || cancelled) return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', { name: 'Soulfables', importance: Notifications.AndroidImportance.DEFAULT });
      }
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      if (cancelled || token === registered) return;
      await registerPush(token, Platform.OS === 'ios' ? 'ios' : 'android').catch(() => {});
      registered = token;
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const path = (response.notification.request.content.data as { path?: string } | undefined)?.path;
      if (typeof path === 'string' && path.startsWith('/story/')) {
        router.push({ pathname: '/story/[slug]', params: { slug: path.slice('/story/'.length) } });
      }
    });
    return () => sub.remove();
  }, []);
}

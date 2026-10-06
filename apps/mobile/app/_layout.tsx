import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { colors } from '@/constants/theme';
import { SessionProvider, useSession } from '@/lib/session';
import { usePushRegistration } from '@/lib/push';

SplashScreen.preventAutoHideAsync();

function Root() {
  const { ready } = useSession();
  usePushRegistration();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  // The router in this SDK no longer takes a navigation theme; every
  // colour is set on the navigators themselves, and each screen paints
  // its own background.
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.ink },
          headerTintColor: colors.ivory,
          headerTitleStyle: { fontFamily: 'Georgia' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="signin" options={{ title: 'Come in', presentation: 'modal' }} />
        <Stack.Screen name="story/[slug]" options={{ title: '' }} />
        <Stack.Screen name="community/[id]" options={{ title: '' }} />
        <Stack.Screen name="questions" options={{ title: 'The Reflection Deck' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </ErrorBoundary>
  );
}

import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { colors } from '@/constants/theme';
import { SessionProvider, useSession } from '@/lib/session';
import { usePushRegistration } from '@/lib/push';

SplashScreen.preventAutoHideAsync();

const HouseTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.ink,
    card: colors.inkRaised,
    text: colors.ivory,
    border: colors.rule,
    notification: colors.gold,
  },
};

function Root() {
  const { ready } = useSession();
  usePushRegistration();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  return (
    <ThemeProvider value={HouseTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.ink }, headerTintColor: colors.ivory, headerTitleStyle: { fontFamily: 'Georgia' }, contentStyle: { backgroundColor: colors.ink } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="signin" options={{ title: 'Come in', presentation: 'modal' }} />
        <Stack.Screen name="story/[slug]" options={{ title: '' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <Root />
    </SessionProvider>
  );
}

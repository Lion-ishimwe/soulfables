import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorBoundary } from '@/components/error-boundary';
import { colors, space } from '@/constants/theme';
import { hasOnboarded } from '@/lib/prefs';
import { SessionProvider, useSession } from '@/lib/session';
import { usePushRegistration } from '@/lib/push';

SplashScreen.preventAutoHideAsync();

/** The arrival: the wordmark and the promise, held for a breath while the session is read. */
function Arrival() {
  return (
    <View style={styles.arrival}>
      <Text style={styles.wordmark}>SOLFAE</Text>
      <Text style={styles.promise}>The place where{'\n'}the soul meets itself.</Text>
      <View style={styles.bar}>
        <View style={styles.barFill} />
      </View>
    </View>
  );
}

function Root() {
  const { ready } = useSession();
  const [held, setHeld] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  usePushRegistration();

  useEffect(() => {
    SplashScreen.hideAsync();
    const t = setTimeout(() => setHeld(false), 1400);
    hasOnboarded().then(setOnboarded);
    return () => clearTimeout(t);
  }, []);

  const showing = ready && !held && onboarded !== null;

  useEffect(() => {
    if (showing && onboarded === false) router.replace('/onboarding');
  }, [showing, onboarded]);

  return (
    <>
      <StatusBar style="light" />
      {!showing && <Arrival />}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.ink },
          headerTintColor: colors.ivory,
          headerTitleStyle: { fontFamily: 'Georgia', fontWeight: '400' },
          headerShadowVisible: false,
          headerBackTitle: '',
          contentStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="signin" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="mood" options={{ title: '' }} />
        <Stack.Screen name="shop" options={{ title: 'The Bookshop' }} />
        <Stack.Screen name="story/[slug]" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="read/[slug]" options={{ title: '' }} />
        <Stack.Screen name="community/[id]" options={{ title: '' }} />
        <Stack.Screen name="questions" options={{ title: 'Quiet Questions' }} />
        <Stack.Screen name="librarian" options={{ title: 'The Librarian' }} />
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

const styles = StyleSheet.create({
  arrival: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  wordmark: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 36, letterSpacing: 10 },
  promise: { color: colors.grey, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 17, lineHeight: 24, textAlign: 'center' },
  bar: { width: 120, height: 2, backgroundColor: colors.rule, marginTop: space.xl },
  barFill: { width: 72, height: 2, backgroundColor: colors.gold },
});

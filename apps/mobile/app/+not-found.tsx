import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';
import { Centre, Muted, ui } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Wandered off' }} />
      <Centre>
        <Text style={ui.star}>✦</Text>
        <Muted centre>This page has wandered off the shelves.</Muted>
        <Link href="/">
          <Text style={ui.link}>Back to the Library</Text>
        </Link>
      </Centre>
    </>
  );
}

import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors } from '@/constants/theme';

function Glyph({ symbol, color }: { symbol: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 19 }}>{symbol}</Text>;
}

/**
 * The five rooms: Home, Library, Journal, Residents, Account. Everything
 * else (a story, the reading view, a post, the deck, the Librarian, the
 * door) opens on top.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.ink, borderTopColor: colors.rule, height: 62, paddingTop: 6 },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.greyMuted,
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 0.5, paddingBottom: 4 },
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Glyph symbol="⌂" color={color} /> }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: ({ color }) => <Glyph symbol="▤" color={color} /> }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: ({ color }) => <Glyph symbol="✎" color={color} /> }} />
      <Tabs.Screen name="residents" options={{ title: 'Residents', tabBarIcon: ({ color }) => <Glyph symbol="❋" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <Glyph symbol="◌" color={color} /> }} />
    </Tabs>
  );
}

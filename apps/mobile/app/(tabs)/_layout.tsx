import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors } from '@/constants/theme';

function Glyph({ symbol, color }: { symbol: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{symbol}</Text>;
}

/**
 * The five rooms a reader moves between: the Library, the Journal, the
 * Community wall, the Librarian, and their own Account. Everything else
 * (a story, a post, the deck, the door) opens on top.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.ivory,
        headerTitleStyle: { fontFamily: 'Georgia', fontSize: 22, fontWeight: '400' },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.ink, borderTopColor: colors.rule },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.greyMuted,
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 1 },
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Library', tabBarIcon: ({ color }) => <Glyph symbol="✦" color={color} /> }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: ({ color }) => <Glyph symbol="✎" color={color} /> }} />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: ({ color }) => <Glyph symbol="❋" color={color} /> }} />
      <Tabs.Screen name="librarian" options={{ title: 'Librarian', tabBarIcon: ({ color }) => <Glyph symbol="☾" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <Glyph symbol="◌" color={color} /> }} />
    </Tabs>
  );
}

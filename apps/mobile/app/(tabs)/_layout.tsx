import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors } from '@/constants/theme';

function Glyph({ symbol, color }: { symbol: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{symbol}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.ivory,
        headerTitleStyle: { fontFamily: 'Georgia', fontSize: 22, fontWeight: '400' },
        tabBarStyle: { backgroundColor: colors.ink, borderTopColor: colors.rule },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.greyMuted,
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Library', tabBarIcon: ({ color }) => <Glyph symbol="✦" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <Glyph symbol="◌" color={color} /> }} />
    </Tabs>
  );
}

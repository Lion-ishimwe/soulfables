import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/constants/theme';
import type { Entry } from '@/lib/journal';

/**
 * The mood tracker the website keeps: thirty days, one cell each, drawn
 * from the feeling attached to each entry. A day with several entries
 * shows the last one written. It is a calendar of what was named, not a
 * chart of wellbeing.
 */
export function MoodStrip({ entries }: { entries: Entry[] }) {
  const byDay = new Map<string, string>();
  for (const e of entries) {
    if (!e.mood?.emoji) continue;
    const key = new Date(e.createdAt).toDateString();
    if (!byDay.has(key)) byDay.set(key, e.mood.emoji);
  }
  const cells: { key: string; day: number; emoji: string | null }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    cells.push({ key: d.toDateString(), day: d.getDate(), emoji: byDay.get(d.toDateString()) ?? null });
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>THE LAST THIRTY DAYS</Text>
      <View style={styles.grid}>
        {cells.map((c) => (
          <View key={c.key} style={[styles.cell, c.emoji && styles.cellOn]}>
            <Text style={styles.cellText}>{c.emoji ?? c.day}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginVertical: space.sm },
  label: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 30, height: 30, borderRadius: 6, borderColor: colors.rule, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cellOn: { backgroundColor: colors.inkRaised, borderColor: colors.gold },
  cellText: { color: colors.greyMuted, fontSize: 11 },
});

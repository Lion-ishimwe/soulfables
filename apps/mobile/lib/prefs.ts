import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Small things the phone remembers for itself: whether the reader has
 * seen the welcome, the reading size they chose, the mood they picked
 * today. None of it is an account setting; it stays on the device.
 */
const KEY = {
  onboarded: 'sf:onboarded',
  fontSize: 'sf:font-size',
  mood: 'sf:mood-today',
};

export async function hasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY.onboarded)) === '1';
  } catch {
    return true;
  }
}

export async function setOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY.onboarded, '1');
  } catch {
    /* the welcome will show again; no harm */
  }
}

export async function getFontSize(): Promise<number> {
  try {
    const v = Number(await AsyncStorage.getItem(KEY.fontSize));
    return v >= 14 && v <= 26 ? v : 18;
  } catch {
    return 18;
  }
}

export async function setFontSize(size: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY.fontSize, String(size));
  } catch {
    /* ignore */
  }
}

/** The mood chosen today, if it was chosen today. */
export async function getMoodToday(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY.mood);
    if (!raw) return null;
    const { slug, day } = JSON.parse(raw) as { slug: string; day: string };
    return day === new Date().toDateString() ? slug : null;
  } catch {
    return null;
  }
}

export async function setMoodToday(slug: string | null): Promise<void> {
  try {
    if (!slug) await AsyncStorage.removeItem(KEY.mood);
    else await AsyncStorage.setItem(KEY.mood, JSON.stringify({ slug, day: new Date().toDateString() }));
  } catch {
    /* ignore */
  }
}

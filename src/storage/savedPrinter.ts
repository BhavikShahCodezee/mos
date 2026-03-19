import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedPrinter = {
  /** Stable identifier when available (often MAC on Android). */
  id: string;
  /** BLE advertised name (e.g. GT01/GB02). */
  name?: string | null;
  savedAt: number;
};

const KEY = 'mos.savedPrinter.v1';

export async function loadSavedPrinter(): Promise<SavedPrinter | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedPrinter;
    if (!parsed || typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function savePrinter(printer: { id: string; name?: string | null }): Promise<void> {
  const payload: SavedPrinter = { id: printer.id, name: printer.name ?? null, savedAt: Date.now() };
  await AsyncStorage.setItem(KEY, JSON.stringify(payload));
}

export async function clearSavedPrinter(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}


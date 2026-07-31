import { Storage } from 'expo-sqlite/kv-store';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-preference';
const DEFAULT_PREFERENCE: ThemePreference = 'light';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = Storage.getItemSync(STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

let preference: ThemePreference = readStoredPreference();
const listeners = new Set<() => void>();

/**
 * Simple external store (subscribe/getSnapshot, for useSyncExternalStore) that
 * persists the user's theme preference via expo-sqlite/kv-store so it survives
 * app restarts. Defaults to 'light' regardless of the OS color scheme.
 */
export const themePreferenceStore = {
  getSnapshot(): ThemePreference {
    return preference;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setPreference(next: ThemePreference): void {
    preference = next;
    listeners.forEach((listener) => listener());
    try {
      Storage.setItemSync(STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; the in-memory preference still applies for this session.
    }
  },
};

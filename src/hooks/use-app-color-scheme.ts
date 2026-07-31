import { useSyncExternalStore } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { themePreferenceStore, type ThemePreference } from '@/lib/theme-preference';

/**
 * Resolves the color scheme actually used to render the app: the user's saved
 * preference (light/dark), or the OS scheme when the preference is 'system'.
 * Unlike the raw useColorScheme() hook, this never follows the OS by default.
 */
export function useAppColorScheme(): 'light' | 'dark' {
  const preference = useSyncExternalStore(
    themePreferenceStore.subscribe,
    themePreferenceStore.getSnapshot,
  );
  const systemScheme = useColorScheme();

  if (preference === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }

  return preference;
}

export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const preference = useSyncExternalStore(
    themePreferenceStore.subscribe,
    themePreferenceStore.getSnapshot,
  );

  return [preference, themePreferenceStore.setPreference];
}

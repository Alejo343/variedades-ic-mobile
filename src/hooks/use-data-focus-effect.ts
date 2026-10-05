import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore, type EffectCallback } from 'react';

import { dataVersionStore } from '@/lib/sync/data-version';

// Drop-in replacement for useFocusEffect on screens that SHOW data (lists,
// details, reports): runs the loader on focus, like before, and ALSO re-runs
// it while the screen is focused whenever a background sync changes local
// data (lib/sync/data-version.ts). An unfocused screen doesn't reload on a
// sync — it just reloads on its next focus, as it always did.
//
// Not for edit forms that prefill inputs from the database: re-running their
// loader mid-edit would overwrite what the user is typing. Those keep plain
// useFocusEffect.
//
// `effect` must be memoized with useCallback by the caller, exactly as
// useFocusEffect already requires.
export function useDataFocusEffect(effect: EffectCallback): void {
  const version = useSyncExternalStore(dataVersionStore.subscribe, dataVersionStore.getSnapshot, dataVersionStore.getSnapshot);
  useFocusEffect(
    useCallback(() => {
      // `version` is read only so the callback's identity changes with it —
      // useFocusEffect re-runs a focused effect when its callback changes.
      void version;
      return effect();
    }, [effect, version]),
  );
}

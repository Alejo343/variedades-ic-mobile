import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { LoginScreen } from '@/components/login-screen';
import { SaleSuccessOverlay } from '@/components/sale-success-overlay';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useSyncSession } from '@/hooks/use-sync-session';
import { dbStore } from '@/lib/data/local/db';
import { useDatabaseMigrations } from '@/lib/data/local/use-migrations';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  // dbStore's generation bumps whenever lib/data/local/db.ts swaps in a new
  // SQLite connection (sync login's first-time wipe, backup import).
  // useMigrations() only ever migrates once per component mount (empty
  // effect deps in drizzle-orm's hook), so AppContent is remounted via `key`
  // to re-run migrations against the fresh connection — this is what lets
  // those flows finish in the same session instead of asking the user to
  // close and reopen the app.
  const dbGeneration = useSyncExternalStore(dbStore.subscribe, dbStore.getSnapshot, dbStore.getSnapshot);
  return <AppContent key={dbGeneration} />;
}

function AppContent() {
  const colorScheme = useAppColorScheme();
  const { success, error } = useDatabaseMigrations();
  const session = useSyncSession();
  useAutoSync();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text>Error al iniciar la base de datos local: {error.message}</Text>
      </View>
    );
  }

  // Font load failure falls through to the system font rather than blocking forever.
  if (!success || !(fontsLoaded || fontError)) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {session.status === 'authenticated' ? <AppTabs /> : <LoginScreen />}
      <SaleSuccessOverlay />
    </ThemeProvider>
  );
}

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Text, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useDatabaseMigrations } from '@/lib/data/local/use-migrations';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useAppColorScheme();
  const { success, error } = useDatabaseMigrations();
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
      <AppTabs />
    </ThemeProvider>
  );
}

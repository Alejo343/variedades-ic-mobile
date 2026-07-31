import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';

export default function AppTabs() {
  const scheme = useAppColorScheme();
  const colors = Colors[scheme];

  return (
    <NativeTabs
      backgroundColor={colors.backgroundElement}
      tintColor={colors.primary}
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.primary } }}
      disableIndicator>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>Buscar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="sell">
        <NativeTabs.Trigger.Label>Vender</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="point_of_sale" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>Más</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

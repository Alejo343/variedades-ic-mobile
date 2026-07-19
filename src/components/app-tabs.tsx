import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="products">
        <NativeTabs.Trigger.Label>Productos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inventory">
        <NativeTabs.Trigger.Label>Inventario</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="cash">
        <NativeTabs.Trigger.Label>Caja</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="payments" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="direct-sales">
        <NativeTabs.Trigger.Label>Ventas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="point_of_sale" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

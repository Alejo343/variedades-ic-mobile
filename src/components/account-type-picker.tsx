import { Banknote, Landmark } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AccountType = 'efectivo' | 'banco';

const OPTIONS: { value: AccountType; label: string; hint: string; icon: typeof Banknote }[] = [
  { value: 'efectivo', label: 'Efectivo', hint: 'Caja, cajón', icon: Banknote },
  { value: 'banco', label: 'Banco', hint: 'Cuenta, Nequi…', icon: Landmark },
];

// Efectivo / Banco choice shared by the new and edit cash-account screens.
export function AccountTypePicker({ value, onChange }: { value: AccountType; onChange: (v: AccountType) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {OPTIONS.map(({ value: option, label, hint, icon: Icon }) => {
        const selected = value === option;
        return (
          <Pressable key={option} style={styles.flex} onPress={() => onChange(option)}>
            <View
              style={[
                styles.button,
                selected
                  ? { backgroundColor: theme.primaryLight, borderColor: theme.primary }
                  : { backgroundColor: theme.background, borderColor: theme.border },
              ]}>
              <Icon color={selected ? theme.primary : theme.textSecondary} size={22} />
              <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: selected ? theme.primary : theme.text }}>
                {label}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {hint}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  button: { alignItems: 'center', gap: Spacing.half, borderWidth: 1.5, borderRadius: Radii.button, paddingVertical: Spacing.three },
});

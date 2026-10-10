import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormChip, FormInput } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { shiftLocalDate, todayLocalDateString } from '@/lib/format';

// A local 'YYYY-MM-DD' date picked with Hoy / Ayer chips, or typed for any
// other day. Used where a flow cuts "everything pending up to a date"
// (settlements, commission payments).
export function DateChoice({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = todayLocalDateString();
  const yesterday = shiftLocalDate(today, -1);
  const [custom, setCustom] = useState(value !== today && value !== yesterday);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        <FormChip
          label="Hoy"
          selected={!custom && value === today}
          onPress={() => {
            setCustom(false);
            onChange(today);
          }}
        />
        <FormChip
          label="Ayer"
          selected={!custom && value === yesterday}
          onPress={() => {
            setCustom(false);
            onChange(yesterday);
          }}
        />
        <FormChip label="Otra fecha" selected={custom} onPress={() => setCustom(true)} />
      </View>
      {custom ? (
        <>
          <FormInput value={value} onChangeText={onChange} placeholder="AAAA-MM-DD" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          {!valid ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Escribe la fecha como año-mes-día, por ejemplo {today}.
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  chips: { flexDirection: 'row', gap: Spacing.two },
});

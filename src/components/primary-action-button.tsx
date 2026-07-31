import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PrimaryActionButtonProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  caption: string;
};

// A single, subtle "look here" pulse right after the screen mounts — not a
// looping animation, that would be distracting on a screen people open dozens
// of times a day.
export function PrimaryActionButton({ href, icon, label, caption }: PrimaryActionButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(200, withSequence(withTiming(1.03, { duration: 180 }), withTiming(1, { duration: 180 })));
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Link href={href as never} asChild>
      <Pressable>
        {({ pressed }) => (
          <Animated.View
            style={[
              styles.button,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
              animatedStyle,
            ]}>
            <View style={styles.iconCircle}>{icon}</View>
            <View style={styles.textColumn}>
              <ThemedText type="cardTitle" style={styles.label}>
                {label}
              </ThemedText>
              <ThemedText type="secondary" style={styles.caption}>
                {caption}
              </ThemedText>
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 90,
    borderRadius: Radii.buttonPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  pressed: { opacity: 0.9 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: { gap: Spacing.half },
  label: { color: '#FFFFFF' },
  caption: { color: 'rgba(255, 255, 255, 0.85)' },
});

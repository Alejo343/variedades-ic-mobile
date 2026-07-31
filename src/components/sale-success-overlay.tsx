import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { subscribeSaleSuccessOverlay } from '@/lib/success-overlay';

// Mercado Libre-style success transition: a circle expands from the button
// that triggered it until it fully covers the screen, then the checkmark
// fades in. The redirect to Home fires the instant the circle finishes
// expanding (screen fully covered), so the screen swap underneath is
// invisible — the user only ever sees solid color, never a jump cut.
const CIRCLE_DURATION = 750;
const MESSAGE_DELAY = 600;
const MESSAGE_DURATION = 260;
const HOLD_AFTER_MESSAGE = 1000;
const FADE_OUT_DURATION = 380;

export function SaleSuccessOverlay() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const overlayOpacity = useSharedValue(0);
  const circleScale = useSharedValue(0);
  const messageOpacity = useSharedValue(0);
  const diameter = useMemo(() => Math.hypot(width, height) * 2.2, [width, height]);

  useEffect(() => {
    function goHome() {
      router.replace('/home');
    }

    return subscribeSaleSuccessOverlay((rawOrigin) => {
      const rootNode = rootRef.current;
      if (!rootNode) return;
      rootNode.measureInWindow((rx, ry) => {
        setOrigin({ x: rawOrigin.x - rx, y: rawOrigin.y - ry });
        setVisible(true);
        overlayOpacity.value = 1;
        circleScale.value = 0;
        messageOpacity.value = 0;
        circleScale.value = withTiming(1, { duration: CIRCLE_DURATION }, (finished) => {
          if (finished) runOnJS(goHome)();
        });
        messageOpacity.value = withDelay(MESSAGE_DELAY, withTiming(1, { duration: MESSAGE_DURATION }));

        if (dismissTimer.current) clearTimeout(dismissTimer.current);
        dismissTimer.current = setTimeout(
          () => {
            overlayOpacity.value = withTiming(0, { duration: FADE_OUT_DURATION }, (finished) => {
              if (finished) runOnJS(setVisible)(false);
            });
          },
          CIRCLE_DURATION + MESSAGE_DELAY + MESSAGE_DURATION + HOLD_AFTER_MESSAGE,
        );
      });
    });
  }, [overlayOpacity, circleScale, messageOpacity]);

  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    [],
  );

  const overlayAnimatedStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const circleAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: circleScale.value }] }));
  const messageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
    transform: [{ scale: interpolate(messageOpacity.value, [0, 1], [0.85, 1]) }],
  }));

  return (
    <View ref={rootRef} collapsable={false} pointerEvents="none" style={styles.root}>
      {visible ? (
        <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
          <Animated.View
            style={[
              styles.circle,
              {
                left: origin.x - diameter / 2,
                top: origin.y - diameter / 2,
                width: diameter,
                height: diameter,
                borderRadius: diameter / 2,
                backgroundColor: theme.primary,
              },
              circleAnimatedStyle,
            ]}
          />
          <Animated.View style={[styles.messageWrap, messageAnimatedStyle]}>
            <View style={styles.iconCircle}>
              <Check color={theme.primary} size={40} strokeWidth={3} />
            </View>
            <ThemedText type="sectionTitle" style={styles.messageText}>
              ¡Venta registrada!
            </ThemedText>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 900 },
  overlay: { ...StyleSheet.absoluteFill },
  circle: { position: 'absolute' },
  messageWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: { color: '#FFFFFF' },
});

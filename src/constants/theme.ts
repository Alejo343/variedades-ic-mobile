/**
 * Design tokens for the "Tablero del negocio" visual identity: brand palette,
 * an 8px spacing grid, radii, soft shadows, and the Inter type scale.
 * See CLAUDE.md "Identidad visual" for the full spec this was built from.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Turns a '#rrggbb' hex color into an 'rgba(r, g, b, alpha)' string. */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Brand accents: same hex in both themes (used as icon/badge tints, mostly
// over a soft withAlpha() background rather than as large solid fills).
const Brand = {
  error: '#DC2626',
  warning: '#F59E0B',
  info: '#3B82F6',
  success: '#22C55E',
  purple: '#8B5CF6',
} as const;

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#DCFCE7',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    primary: '#16A34A',
    primaryHover: '#15803D',
    primaryLight: '#DCFCE7',
    ...Brand,
  },
  dark: {
    text: '#F1F5F9',
    background: '#0F172A',
    backgroundElement: '#1E293B',
    // A solid light-green tile (like light mode's #DCFCE7) would clash with a
    // dark surface, so "selected" reads as a translucent green tint instead.
    backgroundSelected: withAlpha('#22C55E', 0.18),
    textSecondary: '#94A3B8',
    border: '#334155',
    // Slightly brighter than light mode's #16A34A for legibility on dark backgrounds.
    primary: '#22C55E',
    primaryHover: '#16A34A',
    primaryLight: withAlpha('#22C55E', 0.16),
    ...Brand,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

const PlatformFonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Fonts = {
  ...PlatformFonts,
  // Registered via useFonts() in app/_layout.tsx (@expo-google-fonts/inter)
  // before the splash screen hides, so these names are always ready by the
  // time any screen renders.
  inter: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// Values the 8px grid doesn't hit exactly, called out as their own tokens
// per the visual identity spec (screen margins, gaps between cards).
export const Layout = {
  screenPadding: 20,
  cardGap: 16,
} as const;

export const Radii = {
  card: 16,
  button: 18,
  buttonPrimary: 24,
  chip: 999,
} as const;

export const Shadow = {
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

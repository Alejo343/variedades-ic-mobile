import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'greeting'
    | 'sectionTitle'
    | 'bigNumber'
    | 'cardTitle'
    | 'secondary'
    | 'caption';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.primary }],
        type === 'code' && styles.code,
        type === 'greeting' && styles.greeting,
        type === 'sectionTitle' && styles.sectionTitle,
        type === 'bigNumber' && styles.bigNumber,
        type === 'cardTitle' && styles.cardTitle,
        type === 'secondary' && styles.secondary,
        type === 'caption' && styles.caption,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.inter.medium,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.inter.bold,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Fonts.inter.regular,
  },
  title: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: Fonts.inter.semiBold,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontFamily: Fonts.inter.semiBold,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: Fonts.inter.medium,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: Fonts.inter.semiBold,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  // Type scale from the visual identity spec (CLAUDE.md "Identidad visual").
  greeting: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: Fonts.inter.semiBold,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Fonts.inter.bold,
  },
  bigNumber: {
    fontSize: 42,
    lineHeight: 48,
    fontFamily: Fonts.inter.bold,
    fontVariant: ['tabular-nums'],
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: Fonts.inter.semiBold,
  },
  secondary: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.inter.regular,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.inter.medium,
  },
});

/**
 * Palette compatible avec l'ancien COLORS (config/theme) pour StyleSheet dynamiques au changement de thème.
 */
import { useMemo } from 'react';
import { useTheme } from './useTheme';

export type LegacyPalette = {
  bg: string;
  card: string;
  text: string;
  textSoft: string;
  textMuted: string;
  textBright: string;
  textInverse: string;
  border: string;
  accent: string;
  accentDark: string;
  accent2: string;
  accentGlow: string;
  primary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  dangerGradient: readonly [string, string];
  successGradient: readonly [string, string];
  white: string;
  black: string;
  categoryColors: string[];
};

export function useLegacyPalette(): LegacyPalette {
  const { getColor, colors, themeName } = useTheme();

  return useMemo(() => {
    const c = colors;
    const danger = getColor.danger;
    return {
      bg: getColor.bg,
      card: getColor.card,
      text: getColor.text,
      textSoft: getColor.textSoft,
      textMuted: getColor.textMuted,
      textBright: c.text.inverse,
      textInverse: c.text.inverse,
      border: getColor.border,
      accent: getColor.accent,
      accentDark: getColor.primaryDark,
      accent2: c.primary[500],
      accentGlow: 'rgba(139, 92, 246, 0.15)',
      primary: getColor.primary,
      success: getColor.success,
      warning: getColor.warning,
      danger,
      info: getColor.info,
      dangerGradient: [danger, '#ef4444'] as const,
      successGradient: [getColor.success, '#22c55e'] as const,
      white: '#ffffff',
      black: '#000000',
      categoryColors: [
        '#3b82f6',
        '#8b5cf6',
        '#10b981',
        '#f59e0b',
        '#ef4444',
        '#ec4899',
        '#6366f1',
        '#06b6d4',
        '#84cc16',
        '#f97316',
      ],
    };
  }, [colors, getColor, themeName]);
}

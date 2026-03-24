/**
 * Configuration principale du thème LibreShop
 * Version améliorée avec responsive et accessibilité
 */

import { Platform } from 'react-native';
import { lightColors, darkColors, amoledTheme, ColorPalette } from './colors';
import { getResponsiveSpacing } from './breakpoints';

// Espacements responsives
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Rayons
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// Typographie
export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  title: 28,
  display: 36,
};

export const FONT_WEIGHT = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

// Interface du thème améliorée
export interface Theme {
  name: 'light' | 'dark' | 'amoled';
  colors: ColorPalette;
  spacing: typeof SPACING;
  radius: typeof RADIUS;
  fontSize: typeof FONT_SIZE;
  fontWeight: typeof FONT_WEIGHT;
  platform: 'ios' | 'android' | 'web';
  responsive: {
    spacing: (width: number) => typeof SPACING;
    fontSize: (width: number) => typeof FONT_SIZE;
  };
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    colorBlindMode: 'none' | 'protanopia' | 'deuteranopia';
  };
}

// Thèmes complets
export const themes: Record<'light' | 'dark' | 'amoled', Theme> = {
  light: {
    name: 'light',
    colors: lightColors,
    spacing: SPACING,
    radius: RADIUS,
    fontSize: FONT_SIZE,
    fontWeight: FONT_WEIGHT,
    platform: Platform.OS as 'ios' | 'android' | 'web',
    responsive: {
      spacing: getResponsiveSpacing,
      fontSize: (width: number) => getResponsiveSpacing(width), // Sera remplacé par la vraie fonction
    },
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      colorBlindMode: 'none',
    },
  },
  dark: {
    name: 'dark',
    colors: darkColors,
    spacing: SPACING,
    radius: RADIUS,
    fontSize: FONT_SIZE,
    fontWeight: FONT_WEIGHT,
    platform: Platform.OS as 'ios' | 'android' | 'web',
    responsive: {
      spacing: getResponsiveSpacing,
      fontSize: (width: number) => getResponsiveSpacing(width), // Sera remplacé par la vraie fonction
    },
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      colorBlindMode: 'none',
    },
  },
  amoled: {
    name: 'amoled',
    colors: amoledTheme,
    spacing: SPACING,
    radius: RADIUS,
    fontSize: FONT_SIZE,
    fontWeight: FONT_WEIGHT,
    platform: Platform.OS as 'ios' | 'android' | 'web',
    responsive: {
      spacing: getResponsiveSpacing,
      fontSize: (width: number) => getResponsiveSpacing(width), // Sera remplacé par la vraie fonction
    },
    accessibility: {
      highContrast: true,
      reducedMotion: false,
      colorBlindMode: 'none',
    },
  },
};

// Type du nom du thème
export type ThemeName = keyof typeof themes;

export default themes;

/**
 * Utilitaires d'accessibilité pour les thèmes
 * Support haute visibilité, daltonisme, lecteurs d'écran
 */

import { ColorPalette, Theme } from '../config/theme';

export interface AccessibleColors {
  highContrast: {
    text: string;
    background: string;
    border: string;
    link: string;
  };
  colorBlind: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  largeText: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
}

export const getAccessibleColors = (theme: Theme): AccessibleColors => {
  const isDark = theme.name === 'dark';
  
  return {
    // Mode haute visibilité
    highContrast: {
      text: isDark ? '#ffffff' : '#000000',
      background: isDark ? '#000000' : '#ffffff',
      border: isDark ? '#ffffff' : '#000000',
      link: isDark ? '#66b3ff' : '#0066cc',
    },
    
    // Mode daltonisme (protanopie/deutéranopie)
    colorBlind: {
      success: '#1e7e34', // Vert accessible
      warning: '#b45f06', // Jaune-orangé accessible
      error: '#b71c1c',   // Rouge vif accessible
      info: '#0c5460',    // Bleu accessible
    },
    
    // Mode texte large
    largeText: {
      primary: theme.colors.text.primary,
      secondary: theme.colors.text.secondary,
      tertiary: theme.colors.text.tertiary,
    },
  };
};

export const validateWCAGCompliance = (colors: ColorPalette): {
  aa: { valid: number; total: number; issues: string[] };
  aaa: { valid: number; total: number; issues: string[] };
} => {
  const issues: { aa: string[]; aaa: string[] } = { aa: [], aaa: [] };
  let aaValid = 0;
  let aaaValid = 0;
  let totalTests = 0;

  // Tests de contraste texte/fond
  const textTests = [
    { name: 'text-primary', fg: colors.text.primary, bg: colors.background.primary },
    { name: 'text-secondary', fg: colors.text.secondary, bg: colors.background.primary },
    { name: 'text-tertiary', fg: colors.text.tertiary, bg: colors.background.primary },
    { name: 'text-on-card', fg: colors.text.primary, bg: colors.background.secondary },
  ];

  textTests.forEach(test => {
    totalTests++;
    const ratio = getContrastRatio(test.fg, test.bg);
    
    if (ratio >= 4.5) {
      aaValid++;
    } else {
      issues.aa.push(`${test.name}: ratio ${ratio.toFixed(2)}:1 (minimum 4.5:1)`);
    }
    
    if (ratio >= 7.0) {
      aaaValid++;
    } else {
      issues.aaa.push(`${test.name}: ratio ${ratio.toFixed(2)}:1 (minimum 7:1)`);
    }
  });

  // Tests de contraste pour les boutons
  const buttonTests = [
    { name: 'primary-button', fg: '#ffffff', bg: colors.primary[500] },
    { name: 'success-button', fg: '#ffffff', bg: colors.status.success },
    { name: 'error-button', fg: '#ffffff', bg: colors.status.error },
  ];

  buttonTests.forEach(test => {
    totalTests++;
    const ratio = getContrastRatio(test.fg, test.bg);
    
    if (ratio >= 4.5) {
      aaValid++;
    } else {
      issues.aa.push(`${test.name}: ratio ${ratio.toFixed(2)}:1 (minimum 4.5:1)`);
    }
    
    // Les boutons n'ont pas besoin d'être AAA
  });

  return {
    aa: { valid: aaValid, total: totalTests, issues: issues.aa },
    aaa: { valid: aaaValid, total: totalTests, issues: issues.aaa },
  };
};

export const getScreenReaderProps = (theme: Theme) => ({
  // Props pour les lecteurs d'écran
  accessibilityLabel: `Thème ${theme.name === 'dark' ? 'sombre' : 'clair'}`,
  accessibilityHint: 'Change le thème de l\'application entre clair et sombre',
  accessibilityRole: 'button',
  
  // États accessibles
  accessibilityState: {
    selected: theme.name === 'dark',
  },
  
  // Annonces pour les changements
  announceThemeChange: (newTheme: 'light' | 'dark') => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        `Thème changé pour ${newTheme === 'dark' ? 'sombre' : 'clair'}`
      );
      speechSynthesis.speak(utterance);
    }
  },
});

export const getFocusStyles = (theme: Theme) => ({
  // Styles pour le focus clavier
  focusVisible: {
    borderWidth: 2,
    borderColor: theme.colors.border.focus,
    borderRadius: theme.radius.sm,
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineColor: theme.colors.border.focus,
    outlineOffset: 2,
  },
  
  // Styles pour le focus visible uniquement
  focusVisibleOnly: {
    ':focus-visible': {
      borderWidth: 2,
      borderColor: theme.colors.border.focus,
      borderRadius: theme.radius.sm,
    },
  },
});

// Ratio de contraste WCAG
const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    const gammaCorrect = (c: number): number => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    
    const R = gammaCorrect(r);
    const G = gammaCorrect(g);
    const B = gammaCorrect(b);
    
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };
  
  const luminance1 = getLuminance(color1);
  const luminance2 = getLuminance(color2);
  
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

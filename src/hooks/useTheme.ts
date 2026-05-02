/**
 * Hook principal pour utiliser le thème dans les composants
 * Fournit un accès facile aux couleurs et fonctionnalités du thème
 */

import { useMemo } from 'react';
import { useColorScheme } from './useColorScheme';
import { themes, type ThemeName } from '../config/theme_new';

export const useTheme = () => {
  const { theme, toggleTheme, setThemeMode, isDark, isLight, isLoading, mode, isSystemDefault } = useColorScheme();

  // Thème actuel avec mémoisation
  const currentTheme = useMemo(() => themes[theme], [theme]);

  // Accès rapide aux couleurs
  const colors = useMemo(() => currentTheme.colors, [currentTheme.colors]);

  // Accès rapide aux autres propriétés
  const spacing = useMemo(() => currentTheme.spacing, [currentTheme.spacing]);
  const radius = useMemo(() => currentTheme.radius, [currentTheme.radius]);
  const fontSize = useMemo(() => currentTheme.fontSize, [currentTheme.fontSize]);
  const fontWeight = useMemo(() => currentTheme.fontWeight, [currentTheme.fontWeight]);

  // Utilitaires de couleur
  const getColor = useMemo(() => ({
    // Couleurs de fond
    background: colors.background.primary,
    bg: colors.background.primary, // Alias for background
    card: colors.background.secondary,
    surface: colors.background.tertiary,
    
    // Couleurs de texte
    text: colors.text.primary,
    textSecondary: colors.text.secondary,
    textSoft: colors.text.secondary, // Alias for textSecondary
    textTertiary: colors.text.tertiary,
    textMuted: colors.text.tertiary, // Alias for textTertiary
    textInverse: colors.text.inverse,
    textDisabled: colors.text.disabled,
    
    // Couleurs de bordure
    border: colors.border.medium,
    borderLight: colors.border.light,
    borderDark: colors.border.dark,
    borderFocus: colors.border.focus,
    
    // Couleurs de statut
    success: colors.status.success,
    warning: colors.status.warning,
    error: colors.status.error,
    danger: colors.status.error, // Alias for error
    info: colors.status.info,
    neutral: colors.status.neutral,
    
    // Couleurs fonctionnelles
    accent: colors.functional.accent,
    accent2: colors.primary[100], // Alias for primaryLight
    shadow: colors.functional.shadow,
    overlay: colors.functional.overlay,
    highlight: colors.functional.highlight,
    // Alias utilisé par l'UI historique
    star: colors.functional.accent,
    
    // Couleurs primaires
    primary: colors.primary[500],
    primaryLight: colors.primary[100],
    primaryDark: colors.primary[700],
  }), [colors]);

  // Fournir un objet `theme` enrichi pour compatibilité ascendante
  const themeWithHelpers = useMemo(() => ({
    ...currentTheme,
    getColor,
    spacing,
    radius,
    fontSize,
    fontWeight,
    isDark,
    isLight,
    toggleTheme,
    setThemeMode,
  }), [currentTheme, getColor, spacing, radius, fontSize, fontWeight, isDark, isLight, toggleTheme, setThemeMode]);

  return {
    // Thème (compatibilité: inclut getColor et helpers)
    theme: themeWithHelpers,
    themeName: theme,
    colors,
    
    // Accès rapides
    getColor,
    spacing,
    radius,
    fontSize,
    fontWeight,
    
    // État
    isDark,
    isLight,
    isLoading,
    // Mode utilisateur (light | dark | system)
    mode,
    isSystemDefault,
    
    // Actions
    toggleTheme,
    setThemeMode,
  };
};

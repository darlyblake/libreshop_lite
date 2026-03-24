/**
 * Hook responsive pour les thèmes adaptatifs
 * Gère les breakpoints et les ajustements multi-écrans
 */

import { useState, useEffect, useMemo } from 'react';
import { Dimensions, Platform } from 'react-native';
import { getBreakpoint, getResponsiveSpacing, getResponsiveFontSize } from '../config/breakpoints';
import { useThemeContext } from '../context/ThemeContext';

export const useResponsiveTheme = () => {
  const { theme } = useThemeContext();
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  
  // Breakpoint actuel
  const breakpoint = getBreakpoint(dimensions.width);
  
  // Espacements et typographie responsive
  const spacing = getResponsiveSpacing(dimensions.width);
  const fontSize = getResponsiveFontSize(dimensions.width);
  
  // Écouter les changements de dimensions
  useEffect(() => {
    const onChange = ({ window }: { window: any }) => {
      setDimensions(window);
    };

    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  // Styles responsives
  const getResponsiveStyles = useMemo(() => ({
    container: {
      flex: 1,
      backgroundColor: theme.getColor.background,
      padding: spacing.md,
      // Ajustements spécifiques par breakpoint
      ...(breakpoint === 'phone' && { paddingHorizontal: spacing.sm }),
      ...(breakpoint === 'tablet' && { paddingHorizontal: spacing.lg }),
      ...(breakpoint === 'desktop' && { maxWidth: 1200, alignSelf: 'center' as const }),
    },
    
    card: {
      backgroundColor: theme.getColor.card,
      borderRadius: theme.radius.md,
      padding: spacing.md,
      margin: spacing.sm,
      // Ombres adaptatives
      ...(breakpoint === 'phone' && { elevation: 2 }),
      ...(breakpoint === 'tablet' && { elevation: 4 }),
      ...(breakpoint === 'desktop' && { elevation: 6 }),
    },
    
    text: {
      color: theme.getColor.text,
      fontSize: fontSize.md,
      lineHeight: fontSize.md * 1.5,
      // Ajustements de lecture
      ...(breakpoint === 'desktop' && { maxWidth: 800 }),
    },
    
    button: {
      backgroundColor: theme.getColor.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: theme.radius.sm,
      // Tailles adaptatives
      ...(breakpoint === 'phone' && { minHeight: 44 }), // Touch target minimum
      ...(breakpoint === 'tablet' && { minHeight: 48 }),
      ...(breakpoint === 'desktop' && { minHeight: 52 }),
    },
  }), [theme, spacing, fontSize, breakpoint]);

  // Utilitaires responsive
  const utils = useMemo(() => ({
    isPhone: breakpoint === 'phone',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isLarge: breakpoint === 'large' || breakpoint === 'xlarge',
    
    // Colonnes pour les grilles
    getColumns: (minWidth: number) => {
      const containerWidth = dimensions.width - (spacing.md * 2);
      return Math.floor(containerWidth / minWidth);
    },
    
    // Espacement proportionnel
    getProportionalSpacing: (multiplier: number) => spacing.md * multiplier,
    
    // Taille de police proportionnelle
    getProportionalFontSize: (baseSize: number, multiplier: number = 1) => {
      return baseSize * multiplier;
    },
  }), [breakpoint, dimensions, spacing]);

  return {
    ...theme,
    // État responsive
    breakpoint,
    dimensions,
    spacing,
    fontSize,
    
    // Styles responsives
    getResponsiveStyles,
    
    // Utilitaires
    ...utils,
  };
};

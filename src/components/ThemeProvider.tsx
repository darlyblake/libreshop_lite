/**
 * Composant Provider principal pour envelopper l'application
 * Gère les animations de transition et les états de chargement
 */

import React, { useState, useEffect } from 'react';
import { View, Animated, Platform } from 'react-native';
import { ThemeProvider as BaseThemeProvider } from '../context/ThemeContext';
import { useTheme } from '../hooks/useTheme';
import { COLORS as CONFIG_COLORS } from '../config/theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, themeName, getColor, isLoading } = useTheme();
  const [fadeAnim] = useState(new Animated.Value(1));

  // Animation de transition quand le thème change
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 0.7,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });

    // Apply resolved colors to global CONFIG_COLORS so modules importing it update
    try {
      // Map a subset of getColor to the global COLORS used across the codebase
      CONFIG_COLORS.bg = getColor.background || CONFIG_COLORS.bg;
      CONFIG_COLORS.card = getColor.card || CONFIG_COLORS.card;
      CONFIG_COLORS.bgGradient = CONFIG_COLORS.bgGradient; // keep existing gradient
      CONFIG_COLORS.text = getColor.text || CONFIG_COLORS.text;
      CONFIG_COLORS.textMuted = getColor.textMuted || CONFIG_COLORS.textMuted;
      CONFIG_COLORS.textSoft = getColor.textSecondary || CONFIG_COLORS.textSoft;
      CONFIG_COLORS.border = getColor.border || CONFIG_COLORS.border;
      CONFIG_COLORS.primary = getColor.primary || CONFIG_COLORS.primary;
      CONFIG_COLORS.accent = getColor.accent || CONFIG_COLORS.accent;
      CONFIG_COLORS.card = getColor.card || CONFIG_COLORS.card;
    } catch (e) {
      // non-fatal - fail silently if config object is frozen in some environments
      // eslint-disable-next-line no-console
      console.warn('Unable to sync CONFIG_COLORS with theme:', e);
    }
  }, [themeName]);

  // État de chargement
  if (isLoading) {
    return (
      <View 
        style={{ 
          flex: 1, 
          backgroundColor: getColor.background 
        }} 
      />
    );
  }

  return (
    <Animated.View 
      style={{ 
        flex: 1, 
        opacity: fadeAnim, 
        backgroundColor: getColor.background 
      }}
    >
      <BaseThemeProvider>
        {children}
      </BaseThemeProvider>
    </Animated.View>
  );
};

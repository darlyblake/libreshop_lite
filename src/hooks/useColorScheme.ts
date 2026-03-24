/**
 * Hook pour détecter le schéma de couleurs du système
 * Et gérer la persistance du choix utilisateur
 */

import { useState, useEffect } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeName } from '../config/theme_new';

const THEME_STORAGE_KEY = '@libreshop_theme_mode';

export type ThemeMode = 'light' | 'dark' | 'system';

export const useColorScheme = () => {
  const deviceScheme = useRNColorScheme();

  // mode: user-selected mode (light | dark | system)
  const [mode, setMode] = useState<ThemeMode>('light');
  const [theme, setTheme] = useState<ThemeName>('light');
  const [isLoading, setIsLoading] = useState(true);

  const resolveTheme = (m: ThemeMode): ThemeName => {
    if (m === 'system') return (deviceScheme as ThemeName) || 'light';
    return m as ThemeName;
  };

  // Charger la préférence de thème (mode) au démarrage
  useEffect(() => {
    const loadMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setMode(savedMode as ThemeMode);
          setTheme(resolveTheme(savedMode as ThemeMode));
        } else {
          // Default to light when no preference exists
          setMode('light');
          setTheme('light');
        }
      } catch (error) {
        console.error('Erreur chargement thème:', error);
        setMode('light');
        setTheme('light');
      } finally {
        setIsLoading(false);
      }
    };

    loadMode();
    // we intentionally do not re-run on deviceScheme changes unless mode === 'system'
  }, []);

  // Sauvegarder le mode
  const saveMode = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.error('Erreur sauvegarde thème:', error);
    }
  };

  // Changer de mode (light | dark | system)
  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    const resolved = resolveTheme(newMode);
    setTheme(resolved);
    saveMode(newMode);
  };

  // basculer entre clair et sombre (ne passe pas en system)
  const toggleTheme = () => {
    if (mode === 'dark') setThemeMode('light');
    else setThemeMode('dark');
  };

  const resetToSystemTheme = () => {
    setThemeMode('system');
  };

  // If mode is 'system', we should react to device changes
  useEffect(() => {
    if (mode === 'system') {
      setTheme(resolveTheme('system'));
    }
  }, [deviceScheme, mode]);

  return {
    theme,
    colorScheme: deviceScheme,
    isLoading,
    toggleTheme,
    setThemeMode,
    resetToSystemTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    isSystemDefault: mode === 'system',
    mode,
  };
};

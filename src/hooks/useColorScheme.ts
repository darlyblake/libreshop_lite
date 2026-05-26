/**
 * Hook pour détecter le schéma de couleurs du système
 * Et gérer la persistance du choix utilisateur
 * Synchronise la préférence de thème avec la base de données quand l'utilisateur est connecté
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeName } from '../config/theme_new';
import { supabase } from '../lib/supabase';

const THEME_STORAGE_KEY = '@libreshop_theme_mode';

// Écouteurs globaux pour les changements de thème
let themeChangeListeners: (() => void)[] = [];

export const addThemeChangeListener = (listener: () => void) => {
  themeChangeListeners.push(listener);
  return () => {
    themeChangeListeners = themeChangeListeners.filter(l => l !== listener);
  };
};

const notifyThemeChange = () => {
  themeChangeListeners.forEach(listener => listener());
};

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Sauvegarde la préférence de thème dans la base de données (en arrière-plan, sans bloquer l'UI)
 */
const saveThemeToDb = async (userId: string, themeMode: ThemeMode) => {
  // Désactivé pour éviter les erreurs 400 (Bad Request) si la colonne n'existe pas
  return;
};

/**
 * Charge la préférence de thème depuis la base de données
 */
const loadThemeFromDb = async (userId: string): Promise<ThemeMode | null> => {
  // Désactivé pour éviter les erreurs 400 (Bad Request)
  return null;
};

export const useColorScheme = () => {
  const deviceScheme = useRNColorScheme();

  // mode: user-selected mode (light | dark | system)
  const [mode, setMode] = useState<ThemeMode>('light');
  const [theme, setTheme] = useState<ThemeName>('light');
  const [isLoading, setIsLoading] = useState(true);
  const hasSyncedFromDb = useRef(false);

  const resolveTheme = (m: ThemeMode): ThemeName => {
    if (m === 'system') return (deviceScheme as ThemeName) || 'light';
    return m as ThemeName;
  };

  // Récupère l'ID de l'utilisateur connecté (s'il y en a un)
  const getCurrentUserId = async (): Promise<string | null> => {
    try {
      if (!supabase) return null;
      const { data } = await supabase.auth.getUser();
      return data?.user?.id || null;
    } catch {
      return null;
    }
  };

  // Charger la préférence de thème au démarrage (local d'abord, puis DB)
  useEffect(() => {
    const loadMode = async () => {
      try {
        // 1. Charger d'abord depuis le cache local (réponse instantanée)
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setMode(savedMode as ThemeMode);
          setTheme(resolveTheme(savedMode as ThemeMode));
        } else {
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

      // 2. Puis synchroniser avec la DB si l'utilisateur est connecté (en arrière-plan)
      try {
        const userId = await getCurrentUserId();
        if (userId && !hasSyncedFromDb.current) {
          hasSyncedFromDb.current = true;
          const dbMode = await loadThemeFromDb(userId);
          if (dbMode) {
            // La DB fait autorité : appliquer la préférence du compte
            setMode(dbMode);
            setTheme(resolveTheme(dbMode));
            await AsyncStorage.setItem(THEME_STORAGE_KEY, dbMode);
            notifyThemeChange();
          } else {
            // Pas de préférence en DB : sauvegarder la préférence locale vers la DB
            const localMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (localMode === 'light' || localMode === 'dark' || localMode === 'system') {
              saveThemeToDb(userId, localMode as ThemeMode);
            }
          }
        }
      } catch {
        // Silencieux
      }
    };

    loadMode();
    // we intentionally do not re-run on deviceScheme changes unless mode === 'system'
  }, []);

  // Sauvegarder le mode (local + DB)
  const saveMode = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
      // Sauvegarder aussi en DB si l'utilisateur est connecté
      const userId = await getCurrentUserId();
      if (userId) {
        saveThemeToDb(userId, newMode);
      }
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
    notifyThemeChange(); // Notifie tous les composants du changement
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
  }, [deviceScheme]);

  // Synchroniser l'état entre toutes les instances du hook via les écouteurs globaux
  useEffect(() => {
    const handleGlobalThemeChange = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setMode(savedMode as ThemeMode);
          setTheme(resolveTheme(savedMode as ThemeMode));
        }
      } catch (error) {
        // ignore
      }
    };

    const unsubscribe = addThemeChangeListener(handleGlobalThemeChange);
    return () => {
      unsubscribe();
    };
  }, [deviceScheme]);

  // Écouter les changements d'authentification pour re-synchroniser le thème
  useEffect(() => {
    if (!supabase) return;
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        const userId = session.user.id;
        const dbMode = await loadThemeFromDb(userId);
        if (dbMode) {
          setMode(dbMode);
          setTheme(resolveTheme(dbMode));
          await AsyncStorage.setItem(THEME_STORAGE_KEY, dbMode);
          notifyThemeChange();
        } else {
          // Nouvel utilisateur : sauvegarder sa préférence locale actuelle vers la DB
          const localMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
          if (localMode === 'light' || localMode === 'dark' || localMode === 'system') {
            saveThemeToDb(userId, localMode as ThemeMode);
          }
        }
        hasSyncedFromDb.current = true;
      }
      if (event === 'SIGNED_OUT') {
        hasSyncedFromDb.current = false;
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

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

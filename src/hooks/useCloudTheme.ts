/**
 * Hook pour la synchronisation cloud des préférences de thème
 * Support multi-appareils et backup des préférences
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeContext } from '../context/ThemeContext';
import { useNetInfo } from '@react-native-community/netinfo';

interface CloudThemePreferences {
  userId: string;
  theme: 'light' | 'dark';
  autoSwitch: boolean;
  scheduleEnabled: boolean;
  customSchedule?: { start: number; end: number };
  reducedMotion: boolean;
  lastUpdated: string;
  deviceId: string;
}

interface CloudSyncStatus {
  isSyncing: boolean;
  lastSync: string | null;
  syncError: string | null;
  isOnline: boolean;
}

export const useCloudTheme = (userId: string) => {
  const { theme, toggleTheme } = useThemeContext();
  const netInfo = useNetInfo();
  
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>({
    isSyncing: false,
    lastSync: null,
    syncError: null,
    isOnline: netInfo.isConnected === true,
  });

  const [preferences, setPreferences] = useState<CloudThemePreferences | null>(null);
  
  // Générer un ID de device unique
  const getDeviceId = useCallback(() => {
    // Implémenter la génération d'ID unique
    return 'device_' + Math.random().toString(36).substr(2, 9);
  }, []);

  // Charger les préférences depuis le cloud
  const loadFromCloud = useCallback(async () => {
    if (!netInfo.isConnected || !userId) return false;
    
    try {
      setSyncStatus(prev => ({ ...prev, isSyncing: true, syncError: null }));
      
      // Simulation d'appel API (à remplacer par vraie API)
      // const response = await fetch(`/api/users/${userId}/theme-preferences`);
      // if (!response.ok) throw new Error('Failed to load preferences');
      // const cloudPrefs = await response.json();
      
      // Simulation de données pour le moment
      const cloudPrefs = {
        userId,
        theme: theme.themeName as 'light' | 'dark',
        autoSwitch: false,
        scheduleEnabled: false,
        reducedMotion: false,
        lastUpdated: new Date().toISOString(),
        deviceId: getDeviceId(),
      };
      
      // Appliquer les préférences si plus récentes
      if (cloudPrefs.lastUpdated > (preferences?.lastUpdated || '')) {
        setPreferences(cloudPrefs);
        
        // Appliquer le thème
        if (cloudPrefs.theme !== theme.themeName) {
          // Appliquer le thème du cloud
          if (cloudPrefs.theme === 'light' && theme.isDark) {
            toggleTheme();
          } else if (cloudPrefs.theme === 'dark' && theme.isLight) {
            toggleTheme();
          }
        }
      }
      
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSync: new Date().toISOString(),
      }));
      
      return true;
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncError: error instanceof Error ? error.message : 'Sync failed',
      }));
      return false;
    }
  }, [netInfo.isConnected, userId, preferences, theme.themeName, theme.isDark, theme.isLight, toggleTheme, getDeviceId]);

  // Sauvegarder les préférences dans le cloud
  const saveToCloud = useCallback(async (prefs: Partial<CloudThemePreferences>) => {
    if (!netInfo.isConnected || !userId) return false;
    
    try {
      setSyncStatus(prev => ({ ...prev, isSyncing: true, syncError: null }));
      
      const updatedPrefs: CloudThemePreferences = {
        ...preferences,
        ...prefs,
        userId,
        deviceId: getDeviceId(),
        lastUpdated: new Date().toISOString(),
      } as CloudThemePreferences;
      
      // Simulation d'appel API (à remplacer par vraie API)
      // const response = await fetch(`/api/users/${userId}/theme-preferences`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(updatedPrefs),
      // });
      // if (!response.ok) throw new Error('Failed to save preferences');
      
      setPreferences(updatedPrefs);
      
      // Sauvegarder localement aussi
      await AsyncStorage.setItem('@libreshop_cloud_theme_prefs', JSON.stringify(updatedPrefs));
      
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSync: new Date().toISOString(),
      }));
      
      return true;
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncError: error instanceof Error ? error.message : 'Sync failed',
      }));
      return false;
    }
  }, [netInfo.isConnected, userId, preferences, getDeviceId]);

  // Synchronisation automatique
  useEffect(() => {
    if (netInfo.isConnected && userId) {
      loadFromCloud();
    }
  }, [netInfo.isConnected, userId]);

  // Sauvegarder automatiquement les changements
  useEffect(() => {
    if (preferences && netInfo.isConnected) {
      saveToCloud({
        theme: theme.themeName as 'light' | 'dark',
        lastUpdated: new Date().toISOString(),
      });
    }
  }, [theme.themeName]);

  return {
    ...theme,
    // État de synchronisation
    syncStatus,
    preferences,
    
    // Actions cloud
    loadFromCloud,
    saveToCloud,
    
    // Utilitaires
    isOnline: syncStatus.isOnline,
    isSyncing: syncStatus.isSyncing,
    hasSyncError: !!syncStatus.syncError,
    
    // Actions rapides
    syncNow: loadFromCloud,
    clearSyncError: () => setSyncStatus(prev => ({ ...prev, syncError: null })),
  };
};

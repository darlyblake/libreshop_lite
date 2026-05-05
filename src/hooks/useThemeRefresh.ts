/**
 * Hook pour forcer le rafraîchissement des composants au changement de thème
 * Utile pour les composants qui utilisent StyleSheet.create() avec des couleurs dynamiques
 */
import { useEffect, useState, useCallback } from 'react';
import { useTheme } from './useTheme';
import { addThemeChangeListener } from './useColorScheme';

export const useThemeRefresh = () => {
  const { isDark, themeName } = useTheme();
  const [, forceUpdate] = useState({});

  const handleThemeChange = useCallback(() => {
    // Force un re-rendu quand le thème change
    forceUpdate({});
  }, []);

  useEffect(() => {
    // S'abonner aux changements de thème globaux
    const unsubscribe = addThemeChangeListener(handleThemeChange);
    return unsubscribe;
  }, [handleThemeChange]);

  useEffect(() => {
    // Force un re-rendu quand les props de thème changent
    forceUpdate({});
  }, [isDark, themeName]);

  return { isDark, themeName };
};

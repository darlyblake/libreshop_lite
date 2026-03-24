/**
 * Contexte React pour partager le thème dans toute l'application
 * Permet d'accéder au thème sans passer par les props
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';

interface ThemeContextType {
  theme: ReturnType<typeof useTheme>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const theme = useTheme();

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook pour utiliser le contexte du thème
 * @throws {Error} Si utilisé hors du ThemeProvider
 */
export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext doit être utilisé dans un ThemeProvider');
  }
  return context.theme;
};

/**
 * Hook alternatif qui retourne undefined si le contexte n'est pas disponible
 * Utile pour les composants qui peuvent être utilisés hors du ThemeProvider
 */
export const useThemeContextSafe = () => {
  const context = useContext(ThemeContext);
  return context?.theme;
};

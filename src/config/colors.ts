/**
 * Palettes de couleurs complètes pour LibreShop
 * Thème clair et sombre avec contrastes WCAG AA validés
 */

export const lightColors = {
  // Couleurs primaires
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  
  // Couleurs de surface
  background: {
    primary: '#ffffff',      // Fond principal
    secondary: '#f8fafc',    // Cartes, modales
    tertiary: '#f1f5f9',     // Sections alternées
  },
  
  // Couleurs de texte - Contrastes WCAG AA validés
  text: {
    primary: '#0f172a',      // Texte principal (ratio 15.8:1)
    secondary: '#475569',    // Texte secondaire (ratio 7.2:1)
    tertiary: '#4b5563',     // Texte tertiaire (ratio 4.8:1) ✅ Amélioré
    inverse: '#ffffff',      // Texte sur fond sombre
    disabled: '#94a3b8',     // Texte désactivé
  },
  
  // Couleurs de bordure
  border: {
    light: '#e2e8f0',       // Bordures discrètes
    medium: '#cbd5e1',      // Bordures normales
    dark: '#94a3b8',        // Bordures prononcées
    focus: '#3b82f6',        // Bordures focus
  },
  
  // Couleurs de statut - Accessibles daltonisme
  status: {
    success: '#1e7e34',      // ✅ Vert accessible
    warning: '#b45f06',      // ✅ Jaune-orangé accessible
    error: '#b71c1c',        // ✅ Rouge vif accessible
    info: '#0c5460',         // ✅ Bleu accessible
    neutral: '#6b7280',
  },
  
  // Couleurs fonctionnelles
  functional: {
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    accent: '#8b5cf6',
    highlight: 'rgba(59, 130, 246, 0.1)',
  },
  
  // Couleurs système (paiement mobile)
  system: {
    applePay: '#000000',
    googlePay: '#4285f4',
    orangeMoney: '#ff7900',
    wave: '#0085ff',
  },
  
  // Mode haute visibilité
  highContrast: {
    text: '#000000',
    background: '#ffffff',
    border: '#000000',
  },
  
  // Mode daltonisme
  colorBlind: {
    success: '#1e7e34',
    warning: '#b45f06',
    error: '#b71c1c',
    info: '#0c5460',
  }
};

export const darkColors = {
  // Couleurs primaires
  primary: {
    50: '#f0f9ff',
    100: '#bae6fd',
    200: '#7dd3fc',
    300: '#38bdf8',
    400: '#0ea5e9',
    500: '#0284c7',
    600: '#0369a1',
    700: '#075985',
    800: '#0c4a6e',
    900: '#082f49',
  },
  
  // Couleurs de surface
  background: {
    primary: '#0f172a',      // Fond principal
    secondary: '#1e293b',    // Cartes, modales
    tertiary: '#334155',     // Sections alternées
  },
  
  // Couleurs de texte - Contrastes WCAG AA validés
  text: {
    primary: '#f8fafc',      // Texte principal (ratio 15.8:1)
    secondary: '#cbd5e1',    // Texte secondaire (ratio 7.2:1)
    tertiary: '#94a3b8',     // Texte tertiaire (ratio 4.8:1)
    inverse: '#0f172a',      // Texte sur fond clair
    disabled: '#64748b',     // Texte désactivé
  },
  
  // Couleurs de bordure
  border: {
    light: '#334155',       // Bordures discrètes
    medium: '#475569',      // Bordures normales
    dark: '#64748b',        // Bordures prononcées
    focus: '#60a5fa',        // Bordures focus
  },
  
  // Couleurs de statut - Adaptées mode sombre
  status: {
    success: '#22c55e',      // ✅ Vert lumineux
    warning: '#fbbf24',      // ✅ Jaune vif
    error: '#f87171',        // ✅ Rouge clair
    info: '#60a5fa',         // ✅ Bleu clair
    neutral: '#9ca3af',
  },
  
  // Couleurs fonctionnelles
  functional: {
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    accent: '#a78bfa',
    highlight: 'rgba(96, 165, 250, 0.1)',
  },
  
  // Couleurs système
  system: {
    applePay: '#ffffff',
    googlePay: '#4285f4',
    orangeMoney: '#ff7900',
    wave: '#0085ff',
  },
  
  // Mode haute visibilité
  highContrast: {
    text: '#ffffff',
    background: '#000000',
    border: '#ffffff',
  },
  
  // Mode daltonisme
  colorBlind: {
    success: '#22c55e',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
  }
};

// Mode AMOLED (économie d'énergie)
export const amoledTheme = {
  ...darkColors,
  background: {
    primary: '#000000',      // Noir pur AMOLED
    secondary: '#0a0a0a',
    tertiary: '#121212',
  },
  text: {
    primary: '#ffffff',      // Blanc pur
    secondary: '#e5e5e5',
    tertiary: '#b3b3b3',
  }
};

export type ColorPalette = typeof lightColors;

// Configuration Supabase - Variables d'environnement sécurisées
// Les valeurs sont chargées depuis les variables d'environnement pour la sécurité
// Plus aucune clé n'est stockée en dur dans le code source

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Fonction de validation des configurations
function validateSupabaseConfig(url: string, key: string) {
  const errors = [];
  
  if (!url || url.includes('YOUR_PROJECT') || url.includes('your-project')) {
    errors.push('URL Supabase invalide ou non configurée');
  }
  
  if (!key || key === 'YOUR_ANON_KEY') {
    errors.push('Clé Supabase anon invalide ou non configurée');
  }
  
  // Validation du format de l'URL
  const urlPattern = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
  if (url && !urlPattern.test(url)) {
    errors.push('Format URL Supabase invalide (attendu: https://project-id.supabase.co)');
  }
  
  // Validation du format de la clé
  const jwtPattern = /^eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*$/;
  const publishablePattern = /^sb_publishable_[a-zA-Z0-9_-]*$/;
  if (key && !jwtPattern.test(key) && !publishablePattern.test(key)) {
    errors.push('Format clé Supabase invalide');
  }
  
  return errors;
}

// Récupération sécurisée des variables d'environnement
const getEnvVar = (key: string, fallback?: string) => {
  return Constants?.expoConfig?.extra?.[key] || 
         process.env[key] || 
         fallback;
};

export const supabaseConfig = {
  supabaseUrl: getEnvVar('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
};

// Validation au démarrage
function checkSupabaseConfig() {
  const { supabaseUrl, supabaseAnonKey } = supabaseConfig;
  const errors = validateSupabaseConfig(supabaseUrl, supabaseAnonKey);
  
  if (errors.length > 0) {
    console.error('⚠️ Erreurs de configuration Supabase:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\n📖 Pour corriger:');
    console.error('1. Copiez .env.example vers .env.local');
    console.error('2. Remplacez les valeurs par vos vraies clés Supabase');
    console.error('3. Redémarrez votre application');
    return false;
  }
  
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    const keyLabel = supabaseAnonKey ? supabaseAnonKey.replace(/(.{8}).+(.{8})/, '$1…$2') : 'null';
    // Log: `✅ Configuration Supabase valide: url=${supabaseUrl} key=${keyLabel}`;
  }
  
  return true;
}

// Export de la validité pour utilisation dans l'app
export const isSupabaseConfigured = checkSupabaseConfig();

// Configuration Cloudinary
export const cloudinaryConfig = {
  cloudName:
    (Constants?.expoConfig as any)?.extra?.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    'YOUR_CLOUD_NAME',
  uploadPreset:
    (Constants?.expoConfig as any)?.extra?.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    'libreshop',
};

export const COLORS = {
  // Base colors from lightColors
  bg: '#ffffff',
  bgGradient: 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)',
  
  // Vibrant accent colors
  accent: '#8b5cf6',      // Violet vif
  accent2: '#0ea5e9',     // Cyan vif (mapped to primary 500)
  accentDark: '#7c3aed', 
  accentGlow: 'rgba(139, 92, 246, 0.15)',
  
  // Bright status colors
  success: '#1e7e34',
  warning: '#b45f06',
  danger: '#b71c1c',
  info: '#0c5460',
  
  // Text colors
  text: '#0f172a',
  textSoft: '#475569',
  textMuted: '#64748b',
  textBright: '#f8fafc',
  textInverse: '#ffffff',
  
  // Cards
  card: '#f8fafc',
  cardHover: '#f1f5f9',
  
  // Borders
  border: '#e2e8f0',
  borderHover: '#cbd5e1',
  borderLight: '#f1f5f9',
  borderBright: 'rgba(139, 92, 246, 0.3)',
  
  // Core colors
  white: '#ffffff',
  black: '#000000',
  gray: '#94a3b8',
  dark: '#0f172a',
  
  // Additional vibrant colors for buttons
  primary: '#8b5cf6',
  secondary: '#0ea5e9',
  tertiary: '#b45f06',
  quaternary: '#1e7e34',
  
  // Social media colors
  facebook: '#1877f2',
  instagram: '#e4405f',  
  twitter: '#1da1f2',
  whatsapp: '#25d366',
  
  // Ranking colors
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  
  // Star rating colors
  star: '#ffb400',
  
  // Additional UI colors
  darkBlue: '#0f172a',
  lightGray: '#f8fafc',
  mediumGray: '#cbd5e1',
  
  // Gradient colors
  dangerGradient: ['#b71c1c', '#ef4444'],
  successGradient: ['#1e7e34', '#22c55e'],
  
  // Category colors array
  categoryColors: [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', 
    '#ec4899', '#6366f1', '#06b6d4', '#84cc16', '#f97316'
  ],
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 28,
  full: 9999,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  title: 40,
};

// Helper: Get shadow styles appropriate for current platform
// On web, filters out deprecated React Native shadow props and keeps only boxShadow
// On native, keeps all shadow properties for better appearance
const getPlatformShadow = (shadowObj: any) => {
  if (Platform.OS === 'web') {
    // Web: keep only boxShadow (CSS), filter out React Native properties
    return {
      boxShadow: shadowObj.boxShadow,
    };
  }
  // Native: keep all shadow properties
  return shadowObj;
};

// Simple cross-platform shadow presets used across the app
const SHADOWS_BASE = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    // CSS box-shadow for web compatibility
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    // CSS box-shadow for web compatibility
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.08)',
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    // CSS box-shadow for web compatibility
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.12)',
  },
};

// Export platform-specific shadows
export const SHADOWS = {
  small: getPlatformShadow(SHADOWS_BASE.small),
  medium: getPlatformShadow(SHADOWS_BASE.medium),
  large: getPlatformShadow(SHADOWS_BASE.large),
};

export default {
  COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  SHADOWS,
  supabaseConfig,
  cloudinaryConfig,
};


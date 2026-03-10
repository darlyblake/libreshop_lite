// Configuration Supabase - à personnaliser avec vos propres credentials
// The values below are usually provided via environment variables when running
// with Expo (`.env` file or `app.json`), but we keep default placeholders so
// the app still compiles. **You must replace them with your project URL and
// anon key or the client will attempt to reach an invalid host and requests will
// fail with network errors (see console `Failed to fetch`).**
//
// Example `.env` file (see README.md):
// EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

import Constants from 'expo-constants';

// WARN: Replace these with your real Supabase project credentials!
// The current project appears to be unavailable (404 error).
export const supabaseConfig = {
  supabaseUrl:
    (Constants?.expoConfig as any)?.extra?.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    'https://zivymbnalmxkargmfljm.supabase.co', // replace with your real project URL
  supabaseAnonKey:
    (Constants?.expoConfig as any)?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_sGJYXmYlGm_tFlDjNbtMkg_97uPkhDw', // replace with your anon key
};

// Check and warn at startup if placeholders were not replaced
function checkSupabaseConfig() {
  const { supabaseUrl, supabaseAnonKey } = supabaseConfig;
  const isPlaceholderUrl = supabaseUrl.includes('YOUR_PROJECT');
  // real anon keys currently start with "eyJ" or "sb_publishable_"; the
  // latter used to be mis-detected as a placeholder.  Only warn when the key
  // literally equals the placeholder string.
  const isPlaceholderKey = supabaseAnonKey === 'YOUR_ANON_KEY';
  const isLikelyPublishableKey = supabaseAnonKey.startsWith('sb_publishable_');
  const isLikelyJwtAnonKey = supabaseAnonKey.startsWith('eyJ');
  
  if (isPlaceholderUrl || isPlaceholderKey) {
    console.warn(
      '⚠️ Using placeholder Supabase credentials. Replace with your real project credentials in theme.ts or .env file.'
    );
  } else if (isLikelyPublishableKey && !isLikelyJwtAnonKey) {
    console.warn(
      '⚠️ Supabase key looks like a publishable key (sb_publishable_*). For Auth to work, use the Project API "anon/public" key (JWT, usually starts with eyJ...) in EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  } else {
    console.log(`✅ Supabase config loaded url=${supabaseUrl} key=${supabaseAnonKey.substring(0, 8)}…`);
  }
}

checkSupabaseConfig();

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
  // Dark theme colors with better contrast
  bg: '#0a0c12',
  bgGradient: 'linear-gradient(145deg, #0a0c12 0%, #0e1018 100%)',
  card: 'rgba(22, 25, 34, 0.8)',
  cardHover: 'rgba(28, 32, 42, 0.95)',
  
  // Vibrant accent colors
  accent: '#8b5cf6',      // Violet vif
  accent2: '#06b6d4',     // Cyan vif
  accentDark: '#7c3aed',   // Violet foncé
  accentGlow: 'rgba(139, 92, 246, 0.4)',
  
  // Bright status colors
  success: '#10b981',      // Vert vif
  warning: '#f59e0b',      // Orange vif
  danger: '#ef4444',       // Rouge vif
  info: '#3b82f6',         // Bleu vif
  
  // High contrast text colors
  text: '#ffffff',         // Blanc pur
  textSoft: 'rgba(255, 255, 255, 0.8)',  // Plus visible
  textMuted: 'rgba(255, 255, 255, 0.6)', // Plus visible
  textBright: '#f8fafc',   // Blanc cassé très clair
  
  // Enhanced borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  borderBright: 'rgba(139, 92, 246, 0.3)',
  
  // Core colors
  white: '#ffffff',
  black: '#000000',
  gray: '#6b7280',
  dark: '#1a1a1a',
  
  // Additional vibrant colors for buttons
  primary: '#8b5cf6',     // Violet
  secondary: '#06b6d4',   // Cyan
  tertiary: '#f59e0b',    // Orange
  quaternary: '#10b981',   // Vert
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

// Simple cross-platform shadow presets used across the app
export const SHADOWS = {
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

export default {
  COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  SHADOWS,
  supabaseConfig,
  cloudinaryConfig,
};


import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase, UserRole } from '../lib/supabase';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import type { SignInWithOAuthCredentials, VerifyOtpParams } from '@supabase/supabase-js';

// Helper pour vérifier l'initialisation de Supabase
const useSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase not initialized. Please configure your credentials in src/config/theme.ts');
  }
  return supabase;
};

// Helper pour générer des URL de redirection fiables (PWA et Mobile)
const getRedirectUrl = (path: string = '') => {
  if (Platform.OS === 'web') {
    // Utilise l'URL configurée en environnement, ou fallback sur l'URL actuelle du navigateur
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || origin).replace(/\/+$/, '');
    return `${webBaseUrl}${path}`;
  }
  // Sur mobile, utilise le système de deep linking natif d'Expo
  return Linking.createURL(path);
};

// Auth functions
export const authService = {
  async signUp(email: string, password: string, fullName: string, role: UserRole = 'client') {
    const client = useSupabase();
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
          emailRedirectTo: getRedirectUrl('/auth/confirm'),
        },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Inscription (signUp)');
      throw error;
    }
  },

  async signIn(email: string, password: string) {
    const client = useSupabase();
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Connexion (signIn)');
      throw error;
    }
  },

  async signInWithGoogle(redirectPath: string = '') {
    const client = useSupabase();
    try {
      // Sur mobile natif, il est recommandé d'utiliser expo-auth-session.
      // Ici, nous gardons la compatibilité Web/PWA native de Supabase.
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectUrl(redirectPath),
          skipBrowserRedirect: Platform.OS !== 'web', // Évite d'ouvrir le navigateur web interne sur iOS/Android si non supporté
        },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Connexion Google (OAuth)');
      throw error;
    }
  },

  async signOut() {
    const client = useSupabase();
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Déconnexion (signOut)');
      throw error;
    }
  },

  async getCurrentUser() {
    const client = useSupabase();
    try {
      const { data: { user }, error } = await client.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      // Une erreur silencieuse est préférable ici car elle est déclenchée 
      // automatiquement si la session expire, pas besoin de faire crasher l'app.
      console.warn('[AuthService] Problème récupération utilisateur:', error);
      return null;
    }
  },

  async resetPassword(email: string) {
    const client = useSupabase();
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl('/auth/reset'),
      });
      if (error) throw error;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Réinitialisation mot de passe');
      throw error;
    }
  },

  async resendSignupConfirmation(email: string) {
    const client = useSupabase();
    try {
      const { data, error } = await client.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: getRedirectUrl('/auth/confirm'),
        },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Renvoi e-mail de confirmation');
      throw error;
    }
  },

  async updateProfile(userId: string, data: { full_name?: string; phone?: string; whatsapp_number?: string; address?: string; avatar_url?: string }) {
    const client = useSupabase();
    try {
      const { error } = await client.from('users').update(data).eq('id', userId);
      if (error) throw error;
    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'Mise à jour du profil');
      throw error;
    }
  },

  async updatePassword(currentPassword: string, newPassword: string) {
    const client = useSupabase();
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user?.email) {
        throw new Error('Impossible de récupérer la session actuelle pour la vérification.');
      }

      // Vérification sécurisée du mot de passe actuel en simulant un signIn
      const { error: signInError } = await client.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });
      
      if (signInError) {
        throw new Error('Mot de passe actuel incorrect');
      }
      
      // Mise à jour finale du mot de passe
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Mise à jour du mot de passe');
      throw error;
    }
  },

  async updateEmail(newEmail: string) {
    const client = useSupabase();
    try {
      const { error } = await client.auth.updateUser({ email: newEmail });
      if (error) throw error;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Mise à jour de l\'e-mail');
      throw error;
    }
  },

  async getSession() {
    const client = useSupabase();
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('[AuthService] Problème récupération session:', error);
      return { session: null };
    }
  },

  async signInWithOAuth(options: SignInWithOAuthCredentials) {
    const client = useSupabase();
    try {
      const { data, error } = await client.auth.signInWithOAuth(options);
      if (error) throw error;
      return data;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Authentification OAuth générique');
      throw error;
    }
  },

  async verifyOtp(params: VerifyOtpParams) {
    const client = useSupabase();
    try {
      const { data, error } = await client.auth.verifyOtp(params);
      if (error) throw error;
      return data;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Vérification du code OTP');
      throw error;
    }
  },

  async signInWithOtp(params: { email?: string; phone?: string; options?: any }) {
    const client = useSupabase();
    try {
      const { data, error } = await client.auth.signInWithOtp(params as any);
      if (error) throw error;
      return data;
    } catch (error) {
      errorHandler.handleAuthError(error as Error, 'Connexion par OTP');
      throw error;
    }
  },
};

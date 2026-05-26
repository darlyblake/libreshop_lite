import { supabase } from '../lib/supabase';
import { UserRole } from '../lib/supabase';

// Helper function to safely use supabase
const useSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase not initialized. Please configure your credentials in src/config/theme.ts');
  }
  return supabase;
};

// Auth functions
export const authService = {
  async signUp(email: string, password: string, fullName: string, role: UserRole = 'client') {
    const client = useSupabase();
    
    // Determine redirect URL for email confirmation
    // Use web base URL if available (production), otherwise fallback
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    const emailRedirectTo = webBaseUrl 
      ? `${webBaseUrl}/auth/confirm`
      : 'http://localhost:3000';  // Fallback for development
    
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo,  // Tell Supabase where to redirect after confirmation
      },
    });
    if (error) throw error;
    return data;
  },



  async signIn(email: string, password: string) {
    const client = useSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signInWithGoogle(redirectUrl: string) {
    const client = useSupabase();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
      },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const client = useSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const client = useSupabase();
    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    return user;
  },

  async resetPassword(email: string) {
    const client = useSupabase();
    // Determine redirect URL for password reset emails
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    const emailRedirectTo = webBaseUrl ? `${webBaseUrl}/auth/reset` : 'http://localhost:19006/auth/reset';

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: emailRedirectTo,
    } as any);
    if (error) throw error;
  },

  async resendSignupConfirmation(email: string) {
    const client = useSupabase();
    
    // Determine redirect URL for email confirmation
    // Use web base URL if available (production), otherwise fallback
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    const emailRedirectTo = webBaseUrl 
      ? `${webBaseUrl}/auth/confirm`
      : 'http://localhost:3000';  // Fallback for development
    
    const { data, error } = await client.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo,  // Tell Supabase where to redirect after confirmation
      },
    });
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, data: { full_name?: string; phone?: string; whatsapp_number?: string; address?: string; avatar_url?: string }) {
    const client = useSupabase();
    const { error } = await client.from('users').update(data).eq('id', userId);
    if (error) throw error;
  },

  async updatePassword(currentPassword: string, newPassword: string) {
    const client = useSupabase();
    
    // First verify current password by attempting to sign in
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: (await client.auth.getUser()).data.user?.email || '',
      password: currentPassword,
    });
    
    if (signInError) {
      throw new Error('Mot de passe actuel incorrect');
    }
    
    // Update password
    const { error } = await client.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  },

  async updateEmail(newEmail: string) {
    const client = useSupabase();
    const { error } = await client.auth.updateUser({
      email: newEmail
    });
    if (error) throw error;
  },
  async getSession() {
    const client = useSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data;
  },

  async signInWithOAuth(options: { provider: any, options?: any }) {
    const client = useSupabase();
    const { data, error } = await client.auth.signInWithOAuth(options);
    if (error) throw error;
    return data;
  },
  async verifyOtp(params: { token_hash?: string; token?: string; type: 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' | 'sms'; email?: string; phone?: string }) {
    const client = useSupabase();
    const { data, error } = await client.auth.verifyOtp(params as any);
    if (error) throw error;
    return data;
  },
  async signInWithOtp(params: { email?: string; phone?: string; options?: any }) {
    const client = useSupabase();
    const { data, error } = await client.auth.signInWithOtp(params as any);
    if (error) throw error;
    return data;
  },
};

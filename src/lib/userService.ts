import { supabase } from './supabase';
import { User } from './supabase';

export const userService = {
  async getProfile(userId: string): Promise<User> {
    const { data, error } = await supabase!
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async getOrCreateProfile(userId: string): Promise<User> {
    // Use maybeSingle to avoid crash if user doesn't exist yet
    const { data, error } = await supabase!
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    // If user doesn't exist, create it
    if (!data) {
      return await this.upsertProfile(userId, {});
    }

    return data;
  },

  async upsertProfile(userId: string, updates: Partial<User>): Promise<User> {
    const authRes = await supabase!.auth.getUser();
    const email = authRes.data.user?.email;
    // Anonymous users do not have an email. Our `public.users.email` column is NOT NULL,
    // and `orders.user_id` has a FK to `public.users(id)`, so we must create a profile row
    // with a deterministic placeholder email.
    const resolvedEmail = email || `guest-${userId}@anon.local`;

    const payload: any = {
      id: userId,
      email: resolvedEmail,
      ...updates,
    };

    const { data, error } = await supabase!
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase!
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async uploadAvatar(userId: string, avatarUrl: string): Promise<User> {
    const { data, error } = await supabase!
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updatePhone(userId: string, phone: string): Promise<User> {
    const { data, error } = await supabase!
      .from('users')
      .update({ phone })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateFullName(userId: string, fullName: string): Promise<User> {
    const { data, error } = await supabase!
      .from('users')
      .update({ full_name: fullName })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateWhatsappNumber(userId: string, whatsappNumber: string): Promise<User> {
    const { data, error } = await supabase!
      .from('users')
      .update({ whatsapp_number: whatsappNumber })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
};


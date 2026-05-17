import { supabase } from '../lib/supabase';
import { User } from '../lib/supabase';

// Helper function to check if user can modify target profile
async function canModifyProfile(targetUserId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase!.auth.getUser();
    if (!user) return false;

    const currentUserRole = user.user_metadata?.role || user.app_metadata?.role;
    
    // Admins can modify any profile
    if (currentUserRole === 'admin') return true;
    
    // Users can only modify their own profile
    return user.id === targetUserId;
  } catch (error) {
    console.error('Error checking profile modification permission:', error);
    return false;
  }
}

// Helper function to check if user can view target profile
async function canViewProfile(targetUserId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase!.auth.getUser();
    if (!user) return false;

    const currentUserRole = user.user_metadata?.role || user.app_metadata?.role;
    
    // Admins can view any profile
    if (currentUserRole === 'admin') return true;
    
    // Users can view their own profile
    return user.id === targetUserId;
  } catch (error) {
    console.error('Error checking profile view permission:', error);
    return false;
  }
}

export const userService = {
  async getProfile(userId: string): Promise<User> {
    // Check permission
    const canView = await canViewProfile(userId);
    if (!canView) {
      throw new Error('Accès non autorisé');
    }

    const { data, error } = await supabase!
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async getOrCreateProfile(userId: string): Promise<User> {
    // Check permission - only for own profile or admin
    const canView = await canViewProfile(userId);
    if (!canView) {
      throw new Error('Accès non autorisé');
    }

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
    // Check permission
    const canModify = await canModifyProfile(userId);
    if (!canModify) {
      throw new Error('Accès non autorisé');
    }

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
    // Check permission
    const canModify = await canModifyProfile(userId);
    if (!canModify) {
      throw new Error('Accès non autorisé');
    }

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
    // Check permission
    const canModify = await canModifyProfile(userId);
    if (!canModify) {
      throw new Error('Accès non autorisé');
    }

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
    // Check permission
    const canModify = await canModifyProfile(userId);
    if (!canModify) {
      throw new Error('Accès non autorisé');
    }

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
    // Check permission
    const canModify = await canModifyProfile(userId);
    if (!canModify) {
      throw new Error('Accès non autorisé');
    }

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
    // Check permission
    const canModify = await canModifyProfile(userId);
    if (!canModify) {
      throw new Error('Accès non autorisé');
    }

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


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

  /**
   * Récupère le profil de l'utilisateur actuellement connecté directement depuis Supabase.
   * Ne fait PAS de vérification de permission JS supplémentaire — la politique RLS Supabase
   * garantit déjà que chaque utilisateur ne peut voir que son propre profil.
   * 
   * Utiliser cette méthode quand la session OAuth vient d'être établie et que
   * getProfile() pourrait échouer à cause d'une condition de course sur auth.getUser().
   */
  async getSelfProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.warn('[userService.getSelfProfile] DB error:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.warn('[userService.getSelfProfile] Unexpected error:', e);
      return null;
    }
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

    // Check if full_name is missing or just the email prefix, and if we have better in OAuth metadata
    const authRes = await supabase!.auth.getUser();
    const user = authRes.data.user;
    const metadataFullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    
    if (metadataFullName && (!data.full_name || data.full_name === data.email?.split('@')[0] || data.full_name === 'Acheteur' || data.full_name === 'Vendeur')) {
      // Background update to not block login
      this.updateProfile(userId, { full_name: metadataFullName }).catch(console.error);
      return { ...data, full_name: metadataFullName };
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
    const user = authRes.data.user;
    const email = user?.email;
    // Anonymous users do not have an email. Our `public.users.email` column is NOT NULL,
    // and `orders.user_id` has a FK to `public.users(id)`, so we must create a profile row
    // with a deterministic placeholder email.
    const resolvedEmail = email || `guest-${userId}@anon.local`;

    const metadataFullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    let fallbackFullName = '';
    if (email) {
      fallbackFullName = email.split('@')[0];
    }
    
    const resolvedFullName = updates.full_name || metadataFullName || fallbackFullName;

    const payload: any = {
      id: userId,
      email: resolvedEmail,
      full_name: resolvedFullName,
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


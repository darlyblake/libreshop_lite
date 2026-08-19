import { supabase } from '../lib/supabase';

export interface BarEvent {
  id: string;
  store_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  cover_image?: string;
  status: 'draft' | 'published' | 'ended';
  is_photo_wall_active: boolean;
  is_contest_active: boolean;
  contest_reward?: string;
  contest_vote_type?: 'unique' | 'libre';
  contest_participant_limit?: number;
  contest_participation_duration?: number; // minutes
  contest_voting_duration?: number; // minutes
  contest_phase?: 'participation' | 'voting' | 'ended';
  contest_started_at?: string;
  contest_voting_started_at?: string;
  created_at?: string;
}

export interface BarPhoto {
  id: string;
  store_id: string;
  event_id?: string;
  user_id?: string;
  image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  featured_at?: string | null;
  created_at: string;
  likes_count?: number;
}

export interface BarEventPhoto {
  id: string;
  event_id: string;
  user_id: string;
  photo_url: string;
  status: 'pending' | 'approved' | 'rejected';
  votes_count: number;
  created_at: string;
}

export const barService = {
  // --- EVENTS ---
  async getEventsByStore(storeId: string): Promise<BarEvent[]> {
    const { data, error } = await supabase
      .from('bar_events')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getEventById(eventId: string): Promise<BarEvent | null> {
    const { data, error } = await supabase
      .from('bar_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) throw error;
    return data;
  },

  async createEvent(event: Partial<BarEvent>): Promise<BarEvent> {
    const { data, error } = await supabase
      .from('bar_events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateEvent(eventId: string, updates: Partial<BarEvent>): Promise<BarEvent> {
    const { data, error } = await supabase
      .from('bar_events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- PHOTOS ---
  async getPhotosByStore(storeId: string, status?: BarPhoto['status'], currentUserId?: string): Promise<BarPhoto[]> {
    let query = supabase
      .from('bar_photos')
      .select('*, likes:bar_photo_likes(count)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (currentUserId && status === 'approved') {
      // Show approved photos OR user's own photos
      query = query.or(`status.eq.approved,user_id.eq.${currentUserId}`);
    } else if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Format likes_count
    return (data || []).map(photo => ({
      ...photo,
      likes_count: photo.likes ? photo.likes[0].count : 0,
    }));
  },

  async updatePhotoStatus(photoId: string, status: BarPhoto['status']): Promise<void> {
    const { error } = await supabase
      .from('bar_photos')
      .update({ status })
      .eq('id', photoId);

    if (error) throw error;
  },

  async setPhotoFeatured(photoId: string, isFeatured: boolean): Promise<void> {
    const { error } = await supabase
      .from('bar_photos')
      .update({ featured_at: isFeatured ? new Date().toISOString() : null })
      .eq('id', photoId);

    if (error) throw error;
  },

  // --- SCREENS CONTROL (Seller) ---
  async updateScreenSettings(storeId: string, mode: string, message?: string): Promise<void> {
    const { error } = await supabase
      .from('stores')
      .update({
        screen_current_mode: mode,
        screen_message: message || null
      })
      .eq('id', storeId);

    if (error) throw error;
  },

  // --- CONTEST (CLIENT) ---
  async getContestPhotos(eventId: string, currentUserId?: string): Promise<BarEventPhoto[]> {
    let query = supabase
      .from('bar_event_photos')
      .select('*')
      .eq('event_id', eventId)
      .order('votes_count', { ascending: false });

    if (currentUserId) {
      query = query.or(`status.eq.approved,user_id.eq.${currentUserId}`);
    } else {
      query = query.eq('status', 'approved');
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async uploadContestPhoto(eventId: string, userId: string, photoUrl: string): Promise<void> {
    const { error } = await supabase
      .from('bar_event_photos')
      .insert({ event_id: eventId, user_id: userId, photo_url: photoUrl, status: 'approved' });

    if (error) throw error;
  },

  // --- CONTEST MODERATION (Seller) ---
  async getContestPhotosPending(eventId: string): Promise<BarEventPhoto[]> {
    const { data, error } = await supabase
      .from('bar_event_photos')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async moderateContestPhoto(photoId: string, status: 'approved' | 'rejected'): Promise<void> {
    const { error } = await supabase
      .from('bar_event_photos')
      .update({ status })
      .eq('id', photoId);

    if (error) throw error;
  },

  async startContestVotingPhase(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('bar_events')
      .update({ 
        contest_phase: 'voting',
        contest_voting_started_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (error) throw error;
  },

  async endContest(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('bar_events')
      .update({ contest_phase: 'ended' })
      .eq('id', eventId);

    if (error) throw error;
  },

  async startContest(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('bar_events')
      .update({ 
        contest_phase: 'participation',
        contest_started_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (error) throw error;
  },

  async voteForContestPhoto(eventId: string, photoId: string, userId: string): Promise<void> {
    // 1. Insert vote
    const { error: voteError } = await supabase
      .from('bar_event_votes')
      .insert({ event_id: eventId, photo_id: photoId, user_id: userId });
    
    if (voteError) throw voteError;

    // 2. Increment votes count (this could be done via a trigger in production, but we do it manually here if RLS allows)
    // First get current votes
    const { data: photoData } = await supabase.from('bar_event_photos').select('votes_count').eq('id', photoId).single();
    if (photoData) {
      await supabase.from('bar_event_photos').update({ votes_count: photoData.votes_count + 1 }).eq('id', photoId);
    }
  },

  async checkIfUserVoted(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('bar_event_votes')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return false;
    return !!data;
  },

  async getPhotosForEvent(eventId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('bar_event_photos')
      .select('*')
      .eq('event_id', eventId)
      .order('votes_count', { ascending: false });
    
    if (error) {
      console.error('Error fetching event photos:', error);
      return [];
    }
    return data || [];
  },

  async checkIfUserParticipated(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('bar_event_photos')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return false;
    return !!data;
  },

  // --- CLIENT ACTIONS ---
  async checkIsFollowing(storeId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('store_followers')
      .select('id')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) return false;
    return !!data;
  },

  async followStore(storeId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('store_followers')
      .insert({ store_id: storeId, user_id: userId });
    
    if (error) throw error;
  },

  async unfollowStore(storeId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('store_followers')
      .delete()
      .eq('store_id', storeId)
      .eq('user_id', userId);
    
    if (error) throw error;
  },

  async uploadClientPhoto(photo: { store_id: string; event_id?: string; user_id?: string; image_url: string; decoration_type?: string }): Promise<BarPhoto> {
    // Check if store has auto-validation enabled
    let finalStatus = 'pending';
    const { data: storeData } = await supabase
      .from('stores')
      .select('is_photo_auto_validate')
      .eq('id', photo.store_id)
      .single();
      
    if (storeData?.is_photo_auto_validate) {
      finalStatus = 'approved';
    }

    const { data, error } = await supabase
      .from('bar_photos')
      .insert({
        ...photo,
        status: finalStatus
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateStoreTheme(storeId: string, themeData: { tv_wall_theme: string; tv_primary_color?: string; tv_secondary_color?: string }): Promise<void> {
    const { error } = await supabase
      .from('stores')
      .update(themeData)
      .eq('id', storeId);
      
    if (error) throw error;
  },

  async checkUserLike(photoId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('bar_photo_likes')
      .select('id')
      .eq('photo_id', photoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return false;
    return !!data;
  },

  async togglePhotoLike(photoId: string, userId: string, isCurrentlyLiked: boolean): Promise<void> {
    if (isCurrentlyLiked) {
      const { error } = await supabase
        .from('bar_photo_likes')
        .delete()
        .eq('photo_id', photoId)
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('bar_photo_likes')
        .insert({ photo_id: photoId, user_id: userId });
      if (error) throw error;
    }
  },

  // --- PROMO BANNERS (store_promos) ---
  async getPromosByStore(storeId: string): Promise<{ id: string; title: string; subtitle: string; image_url: string; sort_order: number }[]> {
    const { data, error } = await supabase
      .from('store_promos')
      .select('id, title, subtitle, image_url, sort_order')
      .eq('store_id', storeId)
      .eq('enabled', true)
      .order('sort_order', { ascending: true });

    if (error) return [];
    return data || [];
  },

  // --- AUTO VALIDATE ---
  async updateStoreAutoValidate(storeId: string, value: boolean): Promise<void> {
    const { error } = await supabase
      .from('stores')
      .update({ is_photo_auto_validate: value })
      .eq('id', storeId);
    if (error) throw error;
  },

  // --- REALTIME ---
  subscribeToPhotos(storeId: string, callback: (photo: any) => void) {
    return supabase
      .channel(`bar_photos_${storeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bar_photos',
        filter: `store_id=eq.${storeId}`,
      }, (payload) => {
        callback(payload);
      })
      .subscribe();
  },
};

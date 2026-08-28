import { supabase } from '../lib/supabase';
import { BarEvent } from './barService';

export interface BarEventParticipant {
  event_id: string;
  user_id: string;
  created_at?: string;
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

export interface BarEventVote {
  id: string;
  event_id: string;
  photo_id: string;
  user_id: string;
  created_at?: string;
}

class BarContestService {
  async participateInEvent(eventId: string): Promise<void> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Vous devez être connecté pour participer.');
    }

    const { error } = await supabase
      .from('bar_event_participants')
      .insert({
        event_id: eventId,
        user_id: user.id,
      });

    if (error) {
      if (error.code === '23505') {
        throw new Error('Vous participez déjà à cet événement.');
      }
      throw error;
    }
  }

  async hasParticipated(eventId: string): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { data, error } = await supabase
      .from('bar_event_participants')
      .select('event_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  }

  async getParticipantCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from('bar_event_participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (error) throw error;

    return count ?? 0;
  }

  async isEventFull(event: BarEvent): Promise<boolean> {
    const count = await this.getParticipantCount(event.id);

    return (
      event.contest_participant_limit !== undefined &&
      count >= event.contest_participant_limit
    );
  }

  async uploadContestPhoto(
    eventId: string,
    photoUrl: string
  ): Promise<BarEventPhoto> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Vous devez être connecté.');
    }

    const { data: participation, error: participationError } = await supabase
      .from('bar_event_participants')
      .select('event_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (participationError) throw participationError;

    if (!participation) {
      throw new Error(
        'Vous devez participer à l’événement avant de soumettre une photo.'
      );
    }

    // UX check: ensure the event is in the 'participation' phase
    const { data: event, error: eventError } = await supabase
      .from('bar_events')
      .select('contest_phase')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    if (event.contest_phase !== 'participation') {
      throw new Error('La période de participation est terminée.');
    }

    const { data, error } = await supabase
      .from('bar_event_photos')
      .insert({
        event_id: eventId,
        user_id: user.id,
        photo_url: photoUrl,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async getContestPhotos(eventId: string): Promise<BarEventPhoto[]> {
    const { data, error } = await supabase
      .from('bar_event_photos')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('votes_count', { ascending: false });

    if (error) throw error;

    return data ?? [];
  }

  async getPendingContestPhotos(eventId: string): Promise<BarEventPhoto[]> {
    const { data, error } = await supabase
      .from('bar_event_photos')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'pending');
      
    if (error) throw error;
    
    return data ?? [];
  }

  async moderateContestPhoto(photoId: string, status: 'approved' | 'rejected'): Promise<void> {
    const { error } = await supabase
      .from('bar_event_photos')
      .update({ status })
      .eq('id', photoId);

    if (error) {
      if (error.code === '42501') {
        throw new Error('Vous n’avez pas l’autorisation de modérer cette photo.');
      }
      throw error;
    }
  }

  async voteForPhoto(photoId: string): Promise<void> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Vous devez être connecté pour voter.');
    }

    const { data: photo, error: photoError } = await supabase
      .from('bar_event_photos')
      .select('id, event_id, status')
      .eq('id', photoId)
      .single();

    if (photoError) throw photoError;

    if (photo.status !== 'approved') {
      throw new Error('Cette photo ne peut pas recevoir de vote.');
    }

    const { data: event, error: eventError } = await supabase
      .from('bar_events')
      .select('contest_phase')
      .eq('id', photo.event_id)
      .single();

    if (eventError) throw eventError;

    if (event.contest_phase !== 'voting') {
      throw new Error('La période de vote est fermée.');
    }

    const { error } = await supabase
      .from('bar_event_votes')
      .insert({
        event_id: photo.event_id,
        photo_id: photoId,
        user_id: user.id,
      });

    if (error) {
      if (error.code === '23505') {
        throw new Error('Vous avez déjà voté pour cette photo.');
      }
      throw error;
    }
  }

  async hasVoted(photoId: string): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { data, error } = await supabase
      .from('bar_event_votes')
      .select('id')
      .eq('photo_id', photoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  }

  async startContest(eventId: string): Promise<void> {
    const { error } = await supabase.rpc('start_bar_event', {
      p_event_id: eventId,
    });

    if (error) throw error;
  }

  async startVoting(eventId: string): Promise<void> {
    const { error } = await supabase.rpc('start_bar_voting', {
      p_event_id: eventId,
    });

    if (error) throw error;
  }

  async endContest(eventId: string): Promise<void> {
    const { error } = await supabase.rpc('end_bar_event', {
      p_event_id: eventId,
    });

    if (error) throw error;
  }
}

export const barContestService = new BarContestService();

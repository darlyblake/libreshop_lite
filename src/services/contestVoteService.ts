import { supabase } from '../lib/supabase';

/**
 * Secure contest voting API.
 * The authenticated Supabase session is the only source of user identity.
 * Callers must never supply or trust a user_id.
 */
export const contestVoteService = {
  async vote(eventId: string, photoId: string): Promise<void> {
    const { data: { user }, error: authError } = await supabase!.auth.getUser();
    if (authError || !user) {
      throw new Error('Vous devez être connecté pour voter.');
    }

    const { error } = await supabase!
      .from('bar_event_votes')
      .insert({
        event_id: eventId,
        photo_id: photoId,
        user_id: user.id,
      });

    if (error) {
      if (error.code === '23505') {
        throw new Error('Vous avez déjà voté pour cette photo.');
      }
      if (error.code === '42501') {
        throw new Error('Vous devez être connecté pour voter.');
      }
      throw error;
    }
  },

  async hasVoted(photoId: string): Promise<boolean> {
    const { data: { user }, error: authError } = await supabase!.auth.getUser();
    if (authError || !user) return false;

    const { data, error } = await supabase!
      .from('bar_event_votes')
      .select('id')
      .eq('photo_id', photoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return false;
    return !!data;
  },
};

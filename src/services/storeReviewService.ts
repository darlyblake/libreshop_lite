import { useSupabase, StoreReview } from '../lib/supabase';
import { notificationService } from './notificationService';
import { storeService } from './storeService';

export const storeReviewService = {
  async getByStore(storeId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_reviews')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as StoreReview[];
  },

  async create(review: Omit<StoreReview, 'id' | 'created_at' | 'updated_at'>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_reviews')
      .insert({
        store_id: review.store_id,
        user_name: review.user_name,
        rating: review.rating,
        comment: review.comment,
      })
      .select('*')
      .single();
    if (error) throw error;
    
    // Send notification to store owner
    try {
      const store = await storeService.getById(review.store_id);
      if (store && store.user_id) {
        await notificationService.create({
          user_id: store.user_id,
          title: '💬 Nouveau commentaire sur votre boutique',
          body: `${review.user_name} a laissé un avis de ${review.rating} étoiles${review.comment ? ': "' + review.comment.substring(0, 50) + (review.comment.length > 50 ? '...' : '') + '"' : ''}`,
          type: 'comment',
          data: {
            storeId: review.store_id,
            reviewId: data.id,
            rating: review.rating,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to send review notification:', e);
    }
    
    return data as StoreReview;
  },

  async update(id: string, review: Partial<Omit<StoreReview, 'id' | 'created_at'>>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_reviews')
      .update(review)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as StoreReview;
  },

  async delete(id: string) {
    const client = useSupabase();
    const { error } = await client
      .from('store_reviews')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

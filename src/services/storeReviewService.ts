import { useSupabase, StoreReview } from '../lib/supabase';

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

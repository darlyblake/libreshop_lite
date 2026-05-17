import { useSupabase } from '../lib/supabase';
import { notificationService } from './notificationService';

export const reviewService = {
  async getByProduct(productId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getByStore(storeId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('product_reviews')
      .select('*, products!inner(store_id)')
      .eq('products.store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(review: any) {
    const client = useSupabase();
    const { data, error } = await client
      .from('product_reviews')
      .insert(review)
      .select('*, products(name, store_id, stores(user_id))')
      .single();
    if (error) throw error;

    // 🔔 Notifier le vendeur d'un nouvel avis produit
    try {
      const sellerId = data?.products?.stores?.user_id;
      const productName = data?.products?.name || 'votre produit';
      const rating = data?.rating;
      const comment = data?.comment || data?.body || '';
      if (sellerId) {
        const stars = rating ? '⭐'.repeat(Math.min(Number(rating), 5)) : '';
        await notificationService.create({
          user_id: sellerId,
          title: `Nouvel avis sur "${productName}" ${stars}`,
          body: comment
            ? `"${comment.slice(0, 80)}${comment.length > 80 ? '…' : ''}"`
            : `Un client a laissé une note de ${rating}/5 sur "${productName}".`,
          type: 'comment',
          data: {
            productId: review.product_id,
            reviewId: data?.id,
            rating,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to send review notification:', e);
    }

    return data;
  },

  async update(id: string, review: any) {
    const client = useSupabase();
    const { data, error } = await client
      .from('product_reviews')
      .update(review)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const client = useSupabase();
    const { error } = await client
      .from('product_reviews')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

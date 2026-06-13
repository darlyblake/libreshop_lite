import { useSupabase } from '../lib/supabase';
import { notificationService } from './notificationService';
import { OrderReview, CreateReviewPayload, UpdateReviewPayload, ReviewStats } from '../types/review';

export const orderReviewService = {
  /**
   * Récupère les évaluations d'une boutique
   */
  async getByStore(storeId: string): Promise<OrderReview[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('order_reviews')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère les évaluations d'un utilisateur
   */
  async getByUser(userId: string): Promise<OrderReview[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('order_reviews')
      .select('*, stores(name), orders(total_amount)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère une évaluation par commande
   */
  async getByOrder(orderId: string): Promise<OrderReview | null> {
    const client = useSupabase();
    const { data, error } = await client
      .from('order_reviews')
      .select('*')
      .eq('order_id', orderId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  },

  /**
   * Crée une nouvelle évaluation de commande
   */
  async create(payload: CreateReviewPayload): Promise<OrderReview> {
    const client = useSupabase();
    const { data, error } = await client
      .from('order_reviews')
      .insert(payload)
      .select('*, orders(user_id, stores(user_id))')
      .single();
    
    if (error) throw error;

    // Notifier le vendeur
    try {
      const sellerId = data?.orders?.stores?.user_id;
      if (sellerId) {
        const stars = '⭐'.repeat(Math.min(payload.rating, 5));
        await notificationService.create({
          user_id: sellerId,
          title: `Nouvelle évaluation de commande ${stars}`,
          body: payload.comment
            ? `"${payload.comment.slice(0, 80)}${payload.comment.length > 80 ? '…' : ''}"`
            : `Un client a laissé une note de ${payload.rating}/5 sur sa commande.`,
          type: 'review',
          data: {
            orderId: payload.order_id,
            reviewId: data.id,
            rating: payload.rating,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to send review notification:', e);
    }

    return data;
  },

  /**
   * Met à jour une évaluation (réponse du vendeur)
   */
  async update(id: string, payload: UpdateReviewPayload): Promise<OrderReview> {
    const client = useSupabase();
    const { data, error } = await client
      .from('order_reviews')
      .update(payload)
      .eq('id', id)
      .select('*, orders(user_id)')
      .single();
    
    if (error) throw error;

    // Notifier le client si le vendeur a répondu
    if (payload.seller_response) {
      try {
        const userId = data?.orders?.user_id;
        if (userId) {
          await notificationService.create({
            user_id: userId,
            title: 'Réponse du vendeur à votre évaluation',
            body: payload.seller_response.slice(0, 100),
            type: 'review_response',
            data: {
              orderId: data.order_id,
              reviewId: data.id,
            },
          });
        }
      } catch (e) {
        console.warn('Failed to send review response notification:', e);
      }
    }

    return data;
  },

  /**
   * Supprime une évaluation
   */
  async delete(id: string): Promise<void> {
    const client = useSupabase();
    const { error } = await client
      .from('order_reviews')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Calcule les statistiques d'évaluation d'une boutique
   */
  async getStoreStats(storeId: string): Promise<ReviewStats> {
    const client = useSupabase();
    const { data, error } = await client
      .from('order_reviews')
      .select('rating')
      .eq('store_id', storeId);
    
    if (error) throw error;

    const reviews = data || [];
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    const ratingDistribution = {
      1: reviews.filter(r => r.rating === 1).length,
      2: reviews.filter(r => r.rating === 2).length,
      3: reviews.filter(r => r.rating === 3).length,
      4: reviews.filter(r => r.rating === 4).length,
      5: reviews.filter(r => r.rating === 5).length,
    };

    return {
      average_rating: Math.round(averageRating * 10) / 10,
      total_reviews: totalReviews,
      rating_distribution: ratingDistribution,
    };
  },
};

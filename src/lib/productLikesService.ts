import { supabase } from './supabase';
import { notificationService } from './notificationService';

export interface ProductLike {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export const productLikesService = {
  // Récupérer les likes d'un produit
  async getLikesCount(productId: string): Promise<number> {
    const { data, error } = await supabase!
      .from('product_likes')
      .select('id', { count: 'exact' })
      .eq('product_id', productId);
    
    if (error) throw error;
    return data?.length || 0;
  },

  // Vérifier si un utilisateur a liké un produit
  async hasLiked(userId: string, productId: string): Promise<boolean> {
    const { data, error } = await supabase!
      .from('product_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  // Ajouter un like + notifier le vendeur
  async addLike(userId: string, productId: string): Promise<ProductLike> {
    try {
      const { data, error } = await supabase!
        .from('product_likes')
        .insert({ user_id: userId, product_id: productId })
        .select()
        .single();
      
      if (error) throw error;

      // Récupérer les infos du produit et du vendeur
      const { data: product, error: productError } = await supabase!
        .from('products')
        .select('id, name, user_id, store_id')
        .eq('id', productId)
        .single();

      if (!productError && product) {
        // Notifier le vendeur
        const { data: seller } = await supabase!
          .from('users')
          .select('id')
          .eq('id', product.user_id)
          .single();

        if (seller) {
          await notificationService.create({
            user_id: seller.id,
            title: '❤️ Nouveau like sur votre produit',
            body: `Quelqu'un a aimé votre produit "${product.name}"`,
            type: 'system',
            read: false,
            data: {
              productId: productId,
              likedBy: userId,
            },
          });
        }
      }

      return data;
    } catch (error) {
      console.error('Error adding like:', error);
      throw error;
    }
  },

  // Supprimer un like
  async removeLike(userId: string, productId: string): Promise<void> {
    const { error } = await supabase!
      .from('product_likes')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);
    
    if (error) throw error;
  },

  // Récupérer tous les likes d'un utilisateur (ses produits likés)
  async getUserLikedProducts(userId: string): Promise<string[]> {
    const { data, error } = await supabase!
      .from('product_likes')
      .select('product_id')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data?.map(item => item.product_id) || [];
  },

  // Basculer le like (ajouter ou supprimer)
  async toggleLike(userId: string, productId: string): Promise<boolean> {
    const hasLiked = await this.hasLiked(userId, productId);
    
    if (hasLiked) {
      await this.removeLike(userId, productId);
      return false;
    } else {
      await this.addLike(userId, productId);
      return true;
    }
  },
};

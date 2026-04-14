import { supabase } from '../lib/supabase';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { notificationService } from './notificationService';
import { storeService } from './storeService';

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
      .select('id')
      .eq('product_id', productId);
    
    if (error) throw error;
    return data?.length || 0;
  },

  // Récupérer le nombre total de likes pour tous les produits d'une boutique
  async getStoreLikesCount(storeId: string): Promise<number> {
    const { data, error } = await supabase!
      .from('product_likes')
      .select('id, products!inner(store_id)')
      .eq('products.store_id', storeId);
    
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
      .maybeSingle();
    
    if (error) throw error;
    return !!data;
  },

  // Ajouter un like + notifier le vendeur
  async addLike(userId: string, productId: string): Promise<ProductLike> {
    if (!userId || !productId) return {} as any;

    try {
      // Vérifier si un like existe déjà pour éviter l'erreur 409 Conflict dans la console réseau
      const existingLike = await this.hasLiked(userId, productId);
      if (existingLike) {
        return { user_id: userId, product_id: productId } as ProductLike;
      }

      const { data, error } = await supabase!
        .from('product_likes')
        .upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
        .select()
        .maybeSingle();

      if (error && error.code !== '23505' && (error as any)?.status !== 409) throw error;

      const likeData = data || { user_id: userId, product_id: productId } as ProductLike;

      // Récupérer les infos du produit et du vendeur
      let product: any = null;
      try {
        const { data: p, error: productError } = await supabase!
          .from('products')
          .select('id, name, user_id, store_id')
          .eq('id', String(productId).trim())
          .maybeSingle();

        if (!productError) {
          product = p;
        } else {
          // If column `user_id` doesn't exist (42703), try a safer select
          if (String(productError?.code) === '42703' || String(productError?.message || '').includes('does not exist')) {
            try {
              const { data: p2, error: e2 } = await supabase!
                .from('products')
                .select('id, name, store_id')
                .eq('id', String(productId).trim())
                .maybeSingle();
              if (!e2 && p2) {
                product = p2;
                // fetch store owner as fallback for user_id
                if (product?.store_id) {
                  try {
                    const store = await storeService.getById(product.store_id);
                    if (store && (store as any).user_id) product.user_id = (store as any).user_id;
                  } catch (se) {
                    console.warn('productLikesService: failed to fetch store for owner fallback', se);
                  }
                }
              }
            } catch (inner) {
              console.warn('productLikesService: fallback product fetch failed', inner);
            }
          } else {
            console.warn('productLikesService: product fetch error', productError);
          }
        }
      } catch (fetchErr) {
        console.warn('productLikesService: product fetch thrown', fetchErr);
      }

      if (product) {
        // Notifier le vendeur
        await notificationService.create({
          user_id: product.user_id,
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

      return likeData;
    } catch (error: any) {
      if (error?.code === '23505' || (error as any)?.status === 409) return { user_id: userId, product_id: productId } as any;
      errorHandler.handleDatabaseError(error, 'Error adding like:');
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

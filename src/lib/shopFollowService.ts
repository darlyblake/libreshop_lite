import { supabase } from './supabase';
import { notificationService } from './notificationService';

export interface ShopFollow {
  id: string;
  user_id: string;
  store_id: string;
  created_at: string;
}

export const shopFollowService = {
  // Récupérer le nombre de followers d'une boutique
  async getFollowersCount(storeId: string): Promise<number> {
    const { data, error } = await supabase!
      .from('shop_follows')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId);
    
    if (error) throw error;
    return data?.length || 0;
  },

  // Vérifier si un utilisateur suit une boutique
  async isFollowing(userId: string, storeId: string): Promise<boolean> {
    const { data, error } = await supabase!
      .from('shop_follows')
      .select('id')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  // Ajouter un follow + notifier le vendeur
  async addFollow(userId: string, storeId: string): Promise<ShopFollow> {
    try {
      const { data, error } = await supabase!
        .from('shop_follows')
        .insert({ user_id: userId, store_id: storeId })
        .select()
        .single();
      
      if (error) throw error;

      // Récupérer les infos de la boutique et du vendeur
      const { data: store, error: storeError } = await supabase!
        .from('stores')
        .select('id, name, user_id')
        .eq('id', storeId)
        .single();

      if (!storeError && store) {
        // Notifier le vendeur
        await notificationService.create({
          user_id: store.user_id,
          title: '👥 Nouveau follower!',
          body: `Quelqu'un a suivi votre boutique "${store.name}"`,
          type: 'system',
          read: false,
          data: {
            storeId: storeId,
            followedBy: userId,
          },
        });
      }

      return data;
    } catch (error) {
      console.error('Error adding follow:', error);
      throw error;
    }
  },

  // Supprimer un follow
  async removeFollow(userId: string, storeId: string): Promise<void> {
    const { error } = await supabase!
      .from('shop_follows')
      .delete()
      .eq('user_id', userId)
      .eq('store_id', storeId);
    
    if (error) throw error;
  },

  // Récupérer toutes les boutiques suivies par un utilisateur
  async getUserFollowedStores(userId: string): Promise<string[]> {
    const { data, error } = await supabase!
      .from('shop_follows')
      .select('store_id')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data?.map(item => item.store_id) || [];
  },

  // Récupérer tous les followers d'une boutique
  async getStoreFollowers(storeId: string): Promise<ShopFollow[]> {
    const { data, error } = await supabase!
      .from('shop_follows')
      .select('*')
      .eq('store_id', storeId);
    
    if (error) throw error;
    return data || [];
  },

  // Basculer le follow (ajouter ou supprimer)
  async toggleFollow(userId: string, storeId: string): Promise<boolean> {
    const isFollowing = await this.isFollowing(userId, storeId);
    
    if (isFollowing) {
      await this.removeFollow(userId, storeId);
      return false;
    } else {
      await this.addFollow(userId, storeId);
      return true;
    }
  },
};

import { supabase } from './supabase';
import { Product } from './supabase';

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  product?: Product;
  created_at: string;
}

export const wishlistService = {
  async getByUser(userId: string): Promise<WishlistItem[]> {
    const { data, error } = await supabase!
      .from('wishlists')
      .select('*, product:products(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async add(userId: string, productId: string): Promise<WishlistItem> {
    const { data, error } = await supabase!
      .from('wishlists')
      .insert({ user_id: userId, product_id: productId })
      .select('*, product:products(*)')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(userId: string, productId: string): Promise<void> {
    const { error } = await supabase!
      .from('wishlists')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);
    if (error) throw error;
  },

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const { data, error } = await supabase!
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();
    if (error) return false;
    return !!data;
  },

  async clear(userId: string): Promise<void> {
    const { error } = await supabase!
      .from('wishlists')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },
};


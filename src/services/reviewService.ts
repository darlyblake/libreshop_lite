import { useSupabase } from '../lib/supabase';

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
      .select('*')
      .single();
    if (error) throw error;
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

import { useSupabase } from '../lib/supabase';

export interface RestockHistory {
  id: string;
  product_id: string;
  quantity_added: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  restock_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export const restockService = {
  async create(restock: Omit<RestockHistory, 'id' | 'created_at'>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('restock_history')
      .insert(restock)
      .select('*')
      .single();
    if (error) throw error;
    return data as RestockHistory;
  },

  async getByProduct(productId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('restock_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as RestockHistory[];
  },

  async deleteByProduct(productId: string) {
    const client = useSupabase();
    const { error } = await client
      .from('restock_history')
      .delete()
      .eq('product_id', productId);
    if (error) throw error;
  },

  async deleteById(id: string) {
    const client = useSupabase();
    const { error } = await client
      .from('restock_history')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

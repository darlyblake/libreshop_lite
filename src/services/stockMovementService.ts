import { useSupabase } from '../lib/supabase';
import { productService } from './productService';

export interface StockMovement {
  id?: string;
  product_id: string;
  quantity_changed: number;
  previous_stock: number;
  new_stock: number;
  type: 'restock' | 'sale' | 'loss' | 'theft' | 'return' | 'manual';
  reason?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  products?: {
    name: string;
  };
}

export const stockMovementService = {
  async create(movement: Omit<StockMovement, 'id' | 'created_at'>) {
    const client = useSupabase();

    // 1. Insert stock movement record
    const { data, error } = await client
      .from('stock_movements')
      .insert(movement)
      .select('*, products(name)')
      .single();

    if (error) throw error;

    // 2. Automatically update product stock in database
    await productService.update(movement.product_id, {
      stock: movement.new_stock,
    } as any);

    return data as StockMovement;
  },

  async getByProduct(productId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('stock_movements')
      .select('*, products(name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as StockMovement[];
  },

  async getByStore(storeId: string) {
    const client = useSupabase();
    
    // First, get all product IDs for this store
    const products = await productService.getByStoreAll(storeId);
    if (!products || products.length === 0) return [];

    const productIds = products.map(p => p.id);

    // Fetch movements for these products
    const { data, error } = await client
      .from('stock_movements')
      .select('*, products(name)')
      .in('product_id', productIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as StockMovement[];
  },

  async deleteById(id: string) {
    const client = useSupabase();
    const { error } = await client
      .from('stock_movements')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

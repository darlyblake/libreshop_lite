import { supabase } from '../lib/supabase';
import { notificationService } from './notificationService';
import { storeService } from './storeService';

export interface LowStockProduct {
  product_id: string;
  product_name: string;
  current_stock: number;
  low_stock_threshold: number;
  store_id: string;
}

export const lowStockAlertService = {
  // Get all products with low stock for a store
  async getLowStockProducts(storeId: string): Promise<LowStockProduct[]> {
    const { data, error } = await supabase!
      .rpc('get_low_stock_products', { p_store_id: storeId });
    
    if (error) throw error;
    return data || [];
  },

  // Check and send low stock alerts for a store
  async checkAndSendAlerts(storeId: string): Promise<void> {
    const { data, error } = await supabase!
      .rpc('check_low_stock_alerts', { p_store_id: storeId });
    
    if (error) throw error;
    
    const products = data as LowStockProduct[];
    if (!products || products.length === 0) return;

    // Get store owner
    const store = await storeService.getById(storeId);
    if (!store || !(store as any).user_id) return;

    const sellerId = (store as any).user_id;

    // Send notification for each product that hasn't had an alert sent
    for (const product of products) {
      // Check if alert was already sent
      const { data: productData } = await supabase!
        .from('products')
        .select('low_stock_alert_sent')
        .eq('id', product.product_id)
        .single();

      if (productData && !productData.low_stock_alert_sent) {
        // Send notification
        await notificationService.create({
          user_id: sellerId,
          title: '⚠️ Stock faible',
          body: `${product.product_name} n'a plus que ${product.current_stock} unités en stock (seuil: ${product.low_stock_threshold})`,
          type: 'system',
          data: {
            productId: product.product_id,
            storeId: product.store_id,
            currentStock: product.current_stock,
            threshold: product.low_stock_threshold,
          },
        });

        // Mark alert as sent
        await supabase!
          .from('products')
          .update({ low_stock_alert_sent: true })
          .eq('id', product.product_id);
      }
    }
  },

  // Reset low stock alert flag when product is restocked
  async resetAlertFlag(productId: string): Promise<void> {
    const { error } = await supabase!
      .from('products')
      .update({ low_stock_alert_sent: false })
      .eq('id', productId);
    
    if (error) throw error;
  },

  // Update low stock threshold for a product
  async updateThreshold(productId: string, threshold: number): Promise<void> {
    const { error } = await supabase!
      .from('products')
      .update({ low_stock_threshold: threshold })
      .eq('id', productId);
    
    if (error) throw error;
  },

  // Get low stock threshold for a product
  async getThreshold(productId: string): Promise<number> {
    const { data, error } = await supabase!
      .from('products')
      .select('low_stock_threshold')
      .eq('id', productId)
      .single();
    
    if (error) throw error;
    return data?.low_stock_threshold || 5;
  },
};

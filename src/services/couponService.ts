import { supabase } from '../lib/supabase';

export interface Coupon {
  id: string;
  store_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed' | 'free_shipping';
  discount_value: number;
  min_order_amount?: number;
  start_date: string;
  end_date?: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const couponService = {
  async getByStore(storeId: string): Promise<Coupon[]> {
    const { data, error } = await supabase!
      .from('coupons')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(coupon: Omit<Coupon, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<Coupon> {
    const { data, error } = await supabase!
      .from('coupons')
      .insert({
        ...coupon,
        code: coupon.code.toUpperCase(), // Toujours en majuscules
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Coupon>): Promise<Coupon> {
    const { data, error } = await supabase!
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase!
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async validateCoupon(code: string, storeId: string, orderAmount: number): Promise<{ isValid: boolean; discountAmount: number; discountType?: string; message?: string }> {
    const { data, error } = await supabase!
      .from('coupons')
      .select('*')
      .eq('store_id', storeId)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return { isValid: false, discountAmount: 0, message: 'Code promo invalide ou introuvable.' };
    }

    const coupon = data as Coupon;

    // Check expiration
    if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
      return { isValid: false, discountAmount: 0, message: 'Ce code promo a expiré.' };
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return { isValid: false, discountAmount: 0, message: 'Ce code promo a atteint sa limite d\'utilisation.' };
    }

    // Check minimum order amount
    if (coupon.min_order_amount && orderAmount < coupon.min_order_amount) {
      return { isValid: false, discountAmount: 0, message: `Montant minimum requis : ${coupon.min_order_amount} FCFA.` };
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = orderAmount * (coupon.discount_value / 100);
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = coupon.discount_value;
    }

    return { 
      isValid: true, 
      discountAmount, 
      discountType: coupon.discount_type,
      message: coupon.discount_type === 'free_shipping' ? 'Livraison offerte !' : 'Code promo appliqué avec succès !' 
    };
  }
};

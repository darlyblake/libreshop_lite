import { useSupabase } from '../lib/supabase';

// plan management types and service (moved out of storeService)
export interface Plan {
  id: string;
  name: string;
  price: number;
  duration?: string;   // e.g. "mois", "jours"
  months?: number;     // quantitative duration in months
  trial_days?: number; // free trial length
  product_limit?: number;
  has_caisse?: boolean;
  has_online_store?: boolean;
  has_analytics?: boolean;
  features?: string[];
  status?: 'active' | 'inactive';
  is_free?: boolean;
  duration_days?: number;
  created_at?: string;
}

export const planService = {
  async getAll() {
    const client = useSupabase();
    const { data, error } = await client.from('plans').select('*');
    if (error) throw error;
    return data as Plan[];
  },

  async getById(id: string) {
    const client = useSupabase();
    const { data, error } = await client.from('plans').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Plan;
  },

  async create(plan: Partial<Plan>) {
    const client = useSupabase();
    const { data, error } = await client.from('plans').insert(plan).select('*').single();
    if (error) throw error;
    return data as Plan;
  },

  async update(id: string, plan: Partial<Plan>) {
    const client = useSupabase();
    const { data, error } = await client.from('plans').update(plan).eq('id', id).select('*').single();
    if (error) throw error;
    return data as Plan;
  },

  async delete(id: string) {
    const client = useSupabase();
    const { error } = await client.from('plans').delete().eq('id', id);
    if (error) throw error;
  },

  async checkFreePlanUsed(storeId: string, planId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('subscriptions')
      .select('id')
      .eq('store_id', storeId)
      .eq('plan_id', planId)
      .limit(1);
    if (error) throw error;
    return (data || []).length > 0;
  },
};

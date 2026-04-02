import { useSupabase } from '../lib/supabase';

export const storeStatsService = {
  async getByStore(storeId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_stats')
      .select('*')
      .eq('store_id', storeId)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // ignore not found
    return data;
  },

  async updateStats(storeId: string, stats: any) {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_stats')
      .upsert({ store_id: storeId, ...stats }, { onConflict: 'store_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async getByStores(storeIds: string[]) {
    if (!storeIds.length) return [];
    const client = useSupabase();
    const { data, error } = await client
      .from('store_stats')
      .select('*')
      .in('store_id', storeIds);
    if (error) throw error;
    return data || [];
  },
};

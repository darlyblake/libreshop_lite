import { supabase } from './supabase';

export interface City {
  id: string;
  country_id: string;
  name: string;
  created_at?: string;
}

export const cityService = {
  async searchByCountry(countryId: string, query: string, limit: number = 20): Promise<City[]> {
    if (!supabase) throw new Error('Supabase not initialized');

    const q = String(query || '').trim();

    let builder = supabase
      .from('cities')
      .select('*')
      .eq('country_id', countryId)
      .order('name', { ascending: true })
      .limit(limit);

    if (q) {
      builder = builder.ilike('name', `%${q}%`);
    }

    const { data, error } = await builder;
    if (error) throw error;
    return (data || []) as City[];
  },
};

import { supabase } from '../lib/supabase';

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
  async getAllByCountry(countryId: string): Promise<City[]> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .eq('country_id', countryId)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as City[];
  },
  async create(name: string, countryId: string): Promise<City> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase.from('cities').insert({ name, country_id: countryId }).select().single();
    if (error) throw error;
    return data as City;
  },
  async update(id: string, name: string, countryId: string): Promise<City> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase.from('cities').update({ name, country_id: countryId }).eq('id', id).select().single();
    if (error) throw error;
    return data as City;
  },
  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { error } = await supabase.from('cities').delete().eq('id', id);
    if (error) throw error;
  }
};

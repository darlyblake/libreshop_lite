import { supabase } from '../lib/supabase';

export interface Country {
  id: string;
  name: string;
  code: string;
  created_at?: string;
}

export const countryService = {
  async getAll(): Promise<Country[]> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase
      .from('countries')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as Country[];
  },
  async create(name: string, code: string): Promise<Country> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase.from('countries').insert({ name, code }).select().single();
    if (error) throw error;
    return data as Country;
  },
  async update(id: string, name: string, code: string): Promise<Country> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase.from('countries').update({ name, code }).eq('id', id).select().single();
    if (error) throw error;
    return data as Country;
  },
  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { error } = await supabase.from('countries').delete().eq('id', id);
    if (error) throw error;
  }
};

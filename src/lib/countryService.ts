import { supabase } from './supabase';

export interface Country {
  id: string;
  name: string;
  code: string;
  created_at?: string;
}

export const countryService = {
  async getAll(): Promise<Country[]> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase.from('countries').select('*').order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as Country[];
  },
};

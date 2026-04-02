import { useSupabase } from '../lib/supabase';

export interface HomeBanner {
  id: string;
  placement: 'carousel' | 'promo';
  title: string;
  subtitle?: string | null;
  image_url?: string | null;
  color?: string | null;
  link_screen?: string | null;
  link_params?: Record<string, any> | null;
  position: number;
  start_at?: string | null;
  end_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const homeBannerService = {
  async getActiveByPlacement(placement: 'carousel' | 'promo'): Promise<HomeBanner[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('home_banners')
      .select('*')
      .eq('placement', placement)
      .eq('is_active', true)
      .order('position', { ascending: true })
      .limit(6);
    if (error) throw error;
    return (data || []) as HomeBanner[];
  },

  async getAll(): Promise<HomeBanner[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('home_banners')
      .select('*')
      .order('placement', { ascending: true })
      .order('position', { ascending: true });
    if (error) throw error;
    return (data || []) as HomeBanner[];
  },

  async create(banner: Omit<HomeBanner, 'id' | 'created_at' | 'updated_at'>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('home_banners')
      .insert(banner)
      .select('*')
      .single();
    if (error) throw error;
    return data as HomeBanner;
  },

  async update(id: string, banner: Partial<HomeBanner>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('home_banners')
      .update(banner)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as HomeBanner;
  },

  async delete(id: string): Promise<void> {
    const client = useSupabase();
    const { error } = await client.from('home_banners').delete().eq('id', id);
    if (error) throw error;
  },
};

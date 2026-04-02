import { useSupabase } from '../lib/supabase';
import { Collection } from '../lib/supabase';

export const collectionService = {
  async create(collection: Partial<Collection>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('collections')
      .insert(collection)
      .select('*')
      .single();
    if (error) throw error;
    return data as Collection;
  },

  async getById(id: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('collections')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Collection;
  },

  async getByStore(storeId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('collections')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Collection[];
  },

  async update(id: string, collection: Partial<Collection>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('collections')
      .update(collection)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as Collection;
  },

  async delete(id: string) {
    const client = useSupabase();
    const { error } = await client.from('collections').delete().eq('id', id);
    if (error) throw error;
  },
};

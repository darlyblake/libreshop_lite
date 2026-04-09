// src/services/categoryService.ts
import { supabase } from '../lib/supabase';
import { Category } from '../lib/supabase';

export interface PopularCategory {
  id?: string;
  name: string;
  slug?: string;
  icon?: string;
  shop_count: number;
  popularity_score: number;
}

// Helper commun
const normalize = (str: string) =>
  str?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';

// Category Service
export const categoryService = {

  // ====================== CATÉGORIES DE BASE ======================
  async getAll(): Promise<Category[]> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Category> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getBySlug(slug: string): Promise<Category> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) throw error;
    return data;
  },

  async getByParent(parentId: string | null): Promise<Category[]> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = parentId
      ? await supabase.from('categories').select('*').eq('parent_id', parentId).order('name', { ascending: true })
      : await supabase.from('categories').select('*').is('parent_id', null).order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async create(category: Partial<Category>): Promise<Category> {
    if (!supabase) throw new Error('Supabase not initialized');
    const slug = category.slug ||
      category.name?.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || '';
    const { id, createdAt, ...validData } = category as any;
    const { data, error } = await supabase
      .from('categories')
      .insert({ ...validData, slug })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, category: Partial<Category>): Promise<Category> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { id: _, createdAt, ...validData } = category as any;
    const { data, error } = await supabase
      .from('categories')
      .update(validData)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  },

  // ====================== CATÉGORIES POPULAIRES ======================
  async getPopularCategories(limit: number = 6): Promise<PopularCategory[]> {
    try {
      if (!supabase) return [];

      // Essayer d'abord la RPC (beaucoup plus rapide)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_popular_categories', { p_limit: limit });

      if (!rpcError && rpcData?.length) {
        return rpcData.map((c: any) => ({
          ...c,
          name: c.name || c.category,
        }));
      }

      // Fallback côté client (si RPC pas encore créée)
      const { data: stores } = await supabase
        .from('stores')
        .select('category, rating_avg, store_stats(followers_count, customers_count)')
        .eq('status', 'active')
        .eq('visible', true)
        .limit(300);

      if (!stores?.length) return [];

      const catStats: Record<string, any> = {};

      stores.forEach((s: any) => {
        if (!s.category) return;
        if (!catStats[s.category]) {
          catStats[s.category] = { count: 0, sales: 0, ratingSum: 0, ratingCount: 0, views: 0, followers: 0 };
        }
        const stats = Array.isArray(s.store_stats) ? s.store_stats[0] : s.store_stats;

        catStats[s.category].count += 1;
        catStats[s.category].sales += (stats?.customers_count || 0);
        catStats[s.category].views += 0; // Column missing
        catStats[s.category].followers += (stats?.followers_count || 0);
        if (s.rating_avg) {
          catStats[s.category].ratingSum += s.rating_avg;
          catStats[s.category].ratingCount += 1;
        }
      });

      const scores = Object.entries(catStats).map(([name, stats]) => {
        const avgRating = stats.ratingCount > 0 ? stats.ratingSum / stats.ratingCount : 0;
        const score =
          (stats.count * 0.25) +
          (stats.sales * 0.35) +
          (avgRating * 0.15 * 10) +
          (stats.views * 0.15) +
          (stats.followers * 0.10);
        return { name, score, count: stats.count };
      });

      return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({
          name: item.name,
          shop_count: item.count,
          popularity_score: Math.round(item.score),
        }));

    } catch (err) {
      console.error('Erreur getPopularCategories:', err);
      return [];
    }
  },

  // ====================== BOUTIQUES PAR CATÉGORIE ======================
  async getStoresByCategory(category: string, limit: number = 5) {
    try {
      if (!supabase) return [];

      // ⚠️ Fetch all stores and filter client-side to handle:
      // - Case-insensitive matching
      // - Accents/diacritics normalization
      // - Whitespace trimming
      const { data, error } = await supabase
        .from('stores')
        .select('*, store_stats(followers_count, customers_count, rating_avg)')
        .eq('status', 'active')
        .eq('visible', true)
        .order('created_at', { ascending: false })
        .limit(limit * 10); // Fetch more to account for filtering

      if (error) throw error;

      // Robust ranking: verified → sales → followers → rating → date
      return (data || [])
        .filter(s => normalize(s.category) === normalize(category))
        .sort((a, b) => {
          // 1️⃣ Verified first
          if (a.verified !== b.verified) {
            return a.verified ? -1 : 1;
          }
          
          // Get stats (handle array or object format)
          const statsA = Array.isArray(a.store_stats) ? a.store_stats[0] : a.store_stats;
          const statsB = Array.isArray(b.store_stats) ? b.store_stats[0] : b.store_stats;
          
          // 2️⃣ By sales (customers_count) - higher = first
          const customersA = Number(statsA?.customers_count || 0);
          const customersB = Number(statsB?.customers_count || 0);
          if (customersB !== customersA) {
            return customersB - customersA;
          }
          
          // 3️⃣ By followers (popularity) - higher = first
          const followersA = Number(statsA?.followers_count || 0);
          const followersB = Number(statsB?.followers_count || 0);
          if (followersB !== followersA) {
            return followersB - followersA;
          }
          
          // 4️⃣ By rating - higher = first
          const ratingA = Number(statsA?.rating_avg || 0);
          const ratingB = Number(statsB?.rating_avg || 0);
          if (ratingB !== ratingA) {
            return ratingB - ratingA;
          }
          
          // 5️⃣ By creation date - newer = first
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        })
        .slice(0, limit);

    } catch (err) {
      console.error('Erreur getStoresByCategory:', err);
      return [];
    }
  },

  // ====================== BOUTIQUES EN VEDETTE ======================
  async getFeaturedStores(limit: number = 5) {
    try {
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('stores')
        .select('*, store_stats(followers_count, customers_count, rating_avg)')
        .eq('status', 'active')
        .eq('visible', true)
        .limit(limit * 10); // Fetch more to sort client-side

      if (error) throw error;

      // Robust ranking: verified → sales → followers → rating → date
      return (data || [])
        .sort((a, b) => {
          // 1️⃣ Verified first
          if (a.verified !== b.verified) {
            return a.verified ? -1 : 1;
          }
          
          // Get stats (handle array or object format)
          const statsA = Array.isArray(a.store_stats) ? a.store_stats[0] : a.store_stats;
          const statsB = Array.isArray(b.store_stats) ? b.store_stats[0] : b.store_stats;
          
          // 2️⃣ By sales (customers_count) - higher = first
          const customersA = Number(statsA?.customers_count || 0);
          const customersB = Number(statsB?.customers_count || 0);
          if (customersB !== customersA) {
            return customersB - customersA;
          }
          
          // 3️⃣ By followers (popularity) - higher = first
          const followersA = Number(statsA?.followers_count || 0);
          const followersB = Number(statsB?.followers_count || 0);
          if (followersB !== followersA) {
            return followersB - followersA;
          }
          
          // 4️⃣ By rating - higher = first
          const ratingA = Number(statsA?.rating_avg || 0);
          const ratingB = Number(statsB?.rating_avg || 0);
          if (ratingB !== ratingA) {
            return ratingB - ratingA;
          }
          
          // 5️⃣ By creation date - newer = first
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        })
        .slice(0, limit);

    } catch (err) {
      console.error('Erreur getFeaturedStores:', err);
      return [];
    }
  }
};

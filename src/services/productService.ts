import { useSupabase } from '../lib/supabase';
import { Product, ProductReview } from '../lib/supabase';

export type SortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'date_asc' | 'date_desc';

export const productService = {
  async create(product: Partial<Product>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('products')
      .insert(product)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async getByStore(storeId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByStoreAvailable(storeId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .gt('stock', 0)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByStoreAll(storeId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByStorePaginated(storeId: string, options: {
    page?: number;
    limit?: number;
    collectionId?: string;
    stockFilter?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
    search?: string;
    sortBy?: SortOption;
    isActive?: boolean;
  }) {
    const client = useSupabase();
    const page = options.page || 0;
    const limit = options.limit || 20;
    const offset = page * limit;
    
    let query = client
      .from('products')
      .select('*', { count: 'exact' })
      .eq('store_id', storeId);

    if (options.collectionId) {
      query = query.eq('collection_id', options.collectionId);
    }

    if (options.stockFilter && options.stockFilter !== 'all') {
      switch (options.stockFilter) {
        case 'in_stock':
          query = query.gt('stock', 0);
          break;
        case 'low_stock':
          query = query.lte('stock', 10).gt('stock', 0);
          break;
        case 'out_of_stock':
          query = query.eq('stock', 0);
          break;
      }
    }

    if (options.search) {
      query = query.ilike('name', `%${options.search}%`);
    }

    if (options.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options.sortBy) {
      switch (options.sortBy) {
        case 'name_asc': query = query.order('name', { ascending: true }); break;
        case 'name_desc': query = query.order('name', { ascending: false }); break;
        case 'price_asc': query = query.order('price', { ascending: true }); break;
        case 'price_desc': query = query.order('price', { ascending: false }); break;
        case 'stock_asc': query = query.order('stock', { ascending: true }); break;
        case 'stock_desc': query = query.order('stock', { ascending: false }); break;
        case 'date_asc': query = query.order('created_at', { ascending: true }); break;
        case 'date_desc':
        default: query = query.order('created_at', { ascending: false }); break;
      }
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const hasMore = (offset + limit) < (count || 0);
    const totalPages = Math.ceil((count || 0) / limit);

    return {
      products: data || [],
      hasMore,
      totalCount: count || 0,
      currentPage: page,
      totalPages,
      limit
    };
  },

  async getAll(page = 0, pageSize = 20, sort: 'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top' = 'newest') {
    const client = useSupabase();
    const from = page * pageSize;
    const to = from + pageSize - 1;
    if (sort === 'ranked') {
      const maxFetch = Math.max(200, pageSize * 10);
      const { data, error } = await client
        .from('products')
        .select('*, stores(name, logo_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(0, maxFetch - 1);
      if (error) throw error;

      const now = Date.now();
      const scored = (data || []).map((p: any) => {
        const total_sales = Number(p.total_sales || 0);
        const view_count = Number(p.view_count || 0);
        const ageDays = Math.max(0, (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const freshness = Math.max(0, (30 - ageDays) / 30);
        const score = total_sales * 0.5 + view_count * 0.3 + freshness * 100 * 0.2;
        return { ...p, __score: score };
      });

      scored.sort((a: any, b: any) => b.__score - a.__score);
      const paged = scored.slice(from, to + 1).map((s: any) => {
        delete s.__score; return s;
      });
      return paged;
    }

    let query = client
      .from('products')
      .select('*, stores(name, logo_url)')
      .eq('is_active', true);

    if (sort === 'popular' || sort === 'trending') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'sales' || sort === 'top') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query.range(from, to);
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, product: Partial<Product>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('products')
      .update(product)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const client = useSupabase();
    const { error } = await client
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async search(query: string, page = 0, pageSize = 20) {
    const client = useSupabase();
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from('products')
      .select('*, stores(name, logo_url)')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .eq('is_active', true)
      .gt('stock', 0)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return data;
  },

  async incrementViews(productId: string) {
    const client = useSupabase();
    try {
      // Fetch current views
      const { data: current } = await client
        .from('products')
        .select('view_count')
        .eq('id', productId)
        .maybeSingle();
      
      const newCount = (Number(current?.view_count) || 0) + 1;
      
      // Update with new count
      await client
        .from('products')
        .update({ view_count: newCount })
        .eq('id', productId);
    } catch (e) {
      console.warn('Failed to increment views:', e);
    }
  },

  async getProductStats(productId: string) {
    const client = useSupabase();
    try {
      // Execute all counts in parallel for performance
      const [productRes, likesRes, salesRes] = await Promise.all([
        client.from('products').select('view_count').eq('id', productId).single(),
        client.from('product_likes').select('id', { count: 'exact', head: true }).eq('product_id', productId),
        client.from('order_items').select('quantity, orders(status)').eq('product_id', productId)
      ]);

      // Only count sales from successful orders (paid, shipped, or delivered)
      const confirmedStatuses = ['paid', 'shipped', 'delivered'];
      const totalSales = (salesRes.data || [])
        .filter((item: any) => item.orders && confirmedStatuses.includes(item.orders.status))
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      return {
        views: Number(productRes.data?.view_count) || 0,
        likes: likesRes.count || 0,
        sales: totalSales
      };
    } catch (e) {
      console.error('Error fetching product stats:', e);
      return { views: 0, likes: 0, sales: 0 };
    }
  },

  async recordSale(productId: string, quantity = 1) {
    const client = useSupabase();
    try {
      // This is now primarily handled by RPC confirm_order_payment
      // Keeping as a safe fallback that won't 400 if column is missing
      await client
        .from('products')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', productId);
    } catch (e) {
      // Silently fail - product sales stats are now handled by RPC functions
    }
  },
};



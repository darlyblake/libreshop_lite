import { useSupabase } from '../lib/supabase';
import { Product, ProductReview } from '../lib/supabase';

export type SortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'date_asc' | 'date_desc';

/**
 * Unified 6-tier product ranking system
 * Ensures consistent product ordering across all display contexts
 */
function rankProducts(products: any[], sort: 'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top' = 'newest'): any[] {
  const now = Date.now();
  
  return products.map((p: any) => {
    const view_count = Number(p.view_count || 0);
    const ageDays = Math.max(0, (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const freshness = Math.max(0, (30 - ageDays) / 30);
    
    // Calculate different ranking scores based on sort type
    let score = 0;
    
    switch (sort) {
      case 'newest':
        // 1. Newly launched: prioritize recent products
        score = -new Date(p.created_at).getTime();
        break;
        
      case 'popular':
        // 2. Popular: total view count (lifetime popularity)
        score = -view_count;
        break;
        
      case 'trending':
        // 3. Trending: recent view surge + freshness + view velocity
        // Prioritize products with high views that are relatively new
        score = -(view_count * 0.6 + freshness * 40);
        break;
        
      case 'ranked':
        // 4. Ranked: composite score (views + freshness weighted)
        score = -(view_count * 0.3 + freshness * 100 * 0.2);
        break;
        
      case 'sales':
        // 5. Sales: proxy using view count with recent boost
        // Products with high views + recently active get priority
        score = -(view_count * 0.7 + freshness * 50);
        break;
        
      case 'top':
        // 6. Top: monthly winners (recent views + freshness)
        // Products performing well in the last 30 days
        const recentBoost = ageDays <= 30 ? (30 - ageDays) / 30 : 0;
        score = -(view_count * (1 + recentBoost));
        break;
    }
    
    return { ...p, __score: score };
  })
  .sort((a: any, b: any) => a.__score - b.__score)
  .map((p: any) => {
    delete p.__score;
    return p;
  });
}

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
      const searchPattern = `%${options.search}%`;
      query = query.or(`name.ilike.${searchPattern},reference.ilike.${searchPattern}`);
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

    // For simple sorts (newest, popular), let Supabase do the sorting server-side
    // — no need to over-fetch. For composite ranking sorts, fetch 3× for quality.
    const needsClientRanking = ['trending', 'ranked', 'sales', 'top'].includes(sort);
    
    if (!needsClientRanking) {
      const orderCol = sort === 'popular' ? 'view_count' : 'created_at';
      const { data, error } = await client
        .from('products')
        .select('id, name, description, price, compare_price, images, view_count, created_at, is_active, stock, stores(name, logo_url, category)')
        .eq('is_active', true)
        .gt('stock', 0)
        .order(orderCol, { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data || [];
    }

    // Composite sorts: fetch 3× pageSize for ranking quality (down from 10-200×)
    const fetchSize = Math.min(pageSize * 3, 60);
    const { data, error } = await client
      .from('products')
      .select('id, name, description, price, compare_price, images, view_count, created_at, is_active, stock, stores(name, logo_url, category)')
      .eq('is_active', true)
      .gt('stock', 0)
      .order('created_at', { ascending: false })
      .range(from, from + fetchSize - 1);

    if (error) throw error;

    // Apply unified ranking system on the smaller fetch
    const ranked = rankProducts(data || [], sort);
    return ranked.slice(0, pageSize);
  },

  /**
   * Get products by category (via collections)
   * Category → Collection → Product relationship
   */
  async getAllByCategory(
    categoryName: string,
    page = 0,
    pageSize = 20,
    sort: 'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top' = 'newest'
  ) {
    const client = useSupabase();
    
    try {
      // Step 1: Get category ID by name
      const { data: categoryData, error: catError } = await client
        .from('categories')
        .select('id, name')
        .ilike('name', categoryName)
        .single();
      
      if (catError || !categoryData?.id) {
        return [];
      }

      const categoryId = categoryData.id;

      // Step 2: Get all collections for this category
      const { data: collections, error: collError } = await client
        .from('collections')
        .select('id, name')
        .eq('category_id', categoryId)
        .eq('is_active', true);
      
      if (collError) throw collError;
      
      if (!collections || collections.length === 0) {
        return [];
      }

      const collectionIds = collections.map((c: any) => c.id);
      
      // Step 3: Fetch products from these collections with ranking
      const fetchSize = Math.max(200, pageSize * 10);
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data: products, error: prodError } = await client
        .from('products')
        .select('id, name, description, price, compare_price, images, view_count, created_at, is_active, stock, stores(name, logo_url, category)')
        .in('collection_id', collectionIds)
        .eq('is_active', true)
        .gt('stock', 0)
        .order('created_at', { ascending: false })
        .range(0, fetchSize - 1);

      if (prodError) throw prodError;

      // Apply unified ranking system
      const ranked = rankProducts(products || [], sort);
      
      // Return paginated results from ranked data
      return ranked.slice(from, to + 1);
    } catch (err) {
      return [];
    }
  },

  /**
   * Cursor-based pagination for infinite scroll with unified ranking
   * Returns next cursor along with data for stable pagination
   */
  async getAllWithCursor(
    cursor: string | null,
    pageSize = 8,
    sort: 'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top' = 'newest'
  ) {
    const client = useSupabase();
    
    // For cursor-based ranking, we fetch a larger batch to ensure quality rankings
    const batchSize = Math.max(pageSize * 15, 120);
    
    let query = client
      .from('products')
      .select('id, name, description, price, compare_price, images, view_count, created_at, is_active, stock, stores(name, logo_url, category)')
      .eq('is_active', true)
      .gt('stock', 0)
      .order('created_at', { ascending: false });

    let allData: any[] = [];
    
    // Fetch initial batch
    if (!cursor) {
      const { data, error } = await query.limit(batchSize);
      if (error) throw error;
      allData = data || [];
    } else {
      // With cursor, we still need to fetch fresh batch from start for proper ranking
      // This ensures ranking consistency across page loads
      try {
        const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
        const offset = decodedCursor.offset || 0;
        
        const { data, error } = await query.range(offset, offset + batchSize - 1);
        if (error) throw error;
        allData = data || [];
      } catch (e) {
        console.warn('[ProductService] Invalid cursor, fetching from start:', e);
        const { data, error } = await query.limit(batchSize);
        if (error) throw error;
        allData = data || [];
      }
    }

    // Apply unified ranking to the batch
    const rankedData = rankProducts(allData, sort);
    
    // Take pageSize items from ranked data
    const items = rankedData.slice(0, pageSize);
    const hasMore = rankedData.length > pageSize;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      // Calculate next offset based on cursor position
      const currentOffset = cursor ? 
        JSON.parse(Buffer.from(cursor, 'base64').toString()).offset || 0 : 0;
      const nextOffset = currentOffset + pageSize;
      
      nextCursor = Buffer.from(
        JSON.stringify({
          offset: nextOffset,
          sort
        })
      ).toString('base64');
    }

    return {
      data: items,
      nextCursor,
      hasMore
    };
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

  async getPopularByCategory(category: string, limit: number = 4) {
    const client = useSupabase();
    // Fetch more products to rank and return top ones
    const fetchLimit = Math.max(50, limit * 10);
    
    const { data, error } = await client
      .from('products')
      .select('id, name, price, compare_price, images, view_count, created_at, is_active, stock, stores!inner(category)')
      .eq('stores.is_active', true)
      .eq('is_active', true)
      .gt('stock', 0)
      .order('created_at', { ascending: false })
      .limit(fetchLimit);

    if (error) throw error;
    
    // Filter by category (case-insensitive, normalized)
    const categoryNorm = category.toLowerCase().trim();
    const filtered = (data || []).filter((p: any) => 
      p.stores && 
      (Array.isArray(p.stores) ? 
        p.stores.some((s: any) => s.category?.toLowerCase().trim() === categoryNorm) : 
        p.stores.category?.toLowerCase().trim() === categoryNorm)
    );
    
    // Apply popular ranking (view-count based + quality metrics)
    const ranked = rankProducts(filtered, 'popular');
    
    return ranked.slice(0, limit);
  },

  async getStoreHomepageProducts(storeId: string, limit = 8) {
    const client = useSupabase();
    
    // First try to get featured products
    const { data: featured, error: featuredError } = await client
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('featured', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (featuredError && featuredError.code !== 'PGRST116') {
      throw featuredError;
    }

    // If we have featured products, return them
    if (featured && featured.length > 0) {
      return featured;
    }

    // Otherwise, fall back to recent products
    const { data: recent, error: recentError } = await client
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (recentError) throw recentError;
    return recent || [];
  },

  async getFeaturedCount(storeId: string) {
    const client = useSupabase();
    const { count, error } = await client
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('featured', true);
      
    if (error) throw error;
    return count || 0;
  },

  async getStorePromotionProducts(storeId: string) {
    const client = useSupabase();
    
    // Get all active products for the store
    const { data: allProducts, error } = await client
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true);
    
    if (error) throw error;
    
    // Filter products with promotions on client side
    const promotionProducts = (allProducts || []).filter(product => {
      // Product has active sale
      if (product.sale_active === true) return true;
      
      // Product has compare_price greater than price (indicates discount)
      if (product.compare_price && product.compare_price > product.price) return true;
      
      return false;
    });
    
    // Calculate discount percent for products with compare_price but no discount_percent
    const productsWithDiscount = promotionProducts.map(product => {
      if (!product.discount_percent && product.compare_price && product.compare_price > product.price) {
        const discountPercent = Math.round(((product.compare_price - product.price) / product.compare_price) * 100);
        return { ...product, discount_percent: discountPercent };
      }
      return product;
    });
    
    // Sort by discount percent (highest first)
    productsWithDiscount.sort((a, b) => {
      const discountA = a.discount_percent || 0;
      const discountB = b.discount_percent || 0;
      return discountB - discountA;
    });
    
    return productsWithDiscount;
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
    const normalizedQuery = query.trim();
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const searchPattern = `%${normalizedQuery}%`;

    const { data, error } = await client
      .from('products')
      .select('*, stores(name, logo_url)')
      .or(
        `name.ilike.${searchPattern},description.ilike.${searchPattern},category.ilike.${searchPattern},reference.ilike.${searchPattern}`
      )
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
      // Use legacy 2-step fetch+update to avoid throwing 404 network errors
      // if the 'increment_product_views' RPC function is not deployed yet.
      const { data: current } = await client
        .from('products').select('view_count').eq('id', productId).maybeSingle();
      
      if (current) {
        await client
          .from('products')
          .update({ view_count: (Number(current.view_count) || 0) + 1 })
          .eq('id', productId);
      }
    } catch {
      // Non-critical: silently ignore
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

  async updateStock(productId: string, quantityToAdd: number) {
    const client = useSupabase();
    const { data: product, error: fetchError } = await client
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const newStock = (product.stock || 0) + quantityToAdd;
    
    const { data, error } = await client
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getProductOptions(productId: string) {
    const client = useSupabase();
    try {
      const { data, error } = await client
        .from('product_options')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Error fetching product options:', e);
      return [];
    }
  },

  async getSimilarProducts(product: Product, limit = 6) {
    const client = useSupabase();
    try {
      if (!product.category || !product.store_id) {
        return [];
      }
      // First, prefer products from the same seller collection (if set)
      const collected: any[] = [];

      if ((product as any).collection_id) {
        const { data: collData, error: collError } = await client
          .from('products')
          .select('*')
          .eq('collection_id', (product as any).collection_id)
          .eq('is_active', true)
          .neq('id', product.id)
          .limit(limit);

        if (collError) throw collError;
        if (collData && collData.length) collected.push(...collData);
      }

      // If we still need more, fetch from same store & category
      if (collected.length < limit) {
        const remaining = limit - collected.length;
        const { data: storeData, error: storeError } = await client
          .from('products')
          .select('*')
          .eq('category', product.category)
          .eq('is_active', true)
          .neq('id', product.id)
          .eq('store_id', product.store_id)
          .limit(remaining);

        if (storeError) throw storeError;
        if (storeData && storeData.length) collected.push(...storeData);
      }

      // If still under limit, fill with other stores in same category
      if (collected.length < limit) {
        const remaining = limit - collected.length;
        const { data: otherData, error: otherError } = await client
          .from('products')
          .select('*')
          .eq('category', product.category)
          .eq('is_active', true)
          .neq('id', product.id)
          .neq('store_id', product.store_id)
          .limit(remaining);

        if (otherError) throw otherError;
        if (otherData && otherData.length) collected.push(...otherData);
      }

      // Deduplicate and return up to limit
      const unique: any[] = [];
      const seen = new Set<string>();
      for (const p of collected) {
        if (!p || !p.id) continue;
        if (p.id === product.id) continue;
        if (seen.has(String(p.id))) continue;
        seen.add(String(p.id));
        unique.push(p);
        if (unique.length >= limit) break;
      }

      return unique;
    } catch (e) {
      console.error('Error fetching similar products:', e);
      return [];
    }
  },
};



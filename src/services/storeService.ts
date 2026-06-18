import { useSupabase } from '../lib/supabase';
import { Store, StoreStats } from '../lib/supabase';
import { planService } from './planService';
import { errorHandler } from '../utils/errorHandler';
import { notificationService } from '../services/notificationService';
import { locationService } from './locationService';
import { useStoreStore } from '../store';
import { cacheManager } from '../utils/cacheManager';
import { performanceMonitor } from '../utils/performanceMonitor';
import { cacheInvalidationManager } from '../utils/cacheInvalidationManager';
import {
  getCurrentUser,
  getStoreAndValidateOwnership,
  isStoreOwnedByUser,
  isSubscriptionActive,
  updateStoreWithVersion,
  getStoreWithStats,
  getStoreWithPlanFeatures,
  isSlugAvailable,
  canStoreCreateProduct,
} from '../utils/storeUtils';
import { validateStore } from '../types/store';

// ✅ Phase 2d: Type-safe interfaces for specific use cases
export interface StoreFollower {
  id: string;
  store_id: string;
  user_id: string;
  created_at: string;
}

export interface StoreWithStats extends Store {
  customers_count?: number;
  followers_count?: number;
  rating_avg?: number;
}

export interface StoreWithPlan extends Store {
  plan_has_caisse?: boolean;
  plan_has_online_store?: boolean;
  plan_has_analytics?: boolean;
}

export interface StoreWithDistance extends Store {
  distance?: number | null;
}

export interface StorePartial {
  id: string;
  name: string;
  user_id: string;
}

export const storeService = {
  async create(store: Partial<Store>) {
    // ✅ Validate current user is authenticated
    const user = await getCurrentUser();
    
    // ✅ Validate store data
    const validationErrors = validateStore(store);
    if (validationErrors.length > 0) {
      throw new Error(`Validation échouée: ${validationErrors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
    }
    
    // ✅ Enforce ownership - store must belong to current user
    const storeData = {
      ...store,
      user_id: user.id, // Force current user as owner
    };
    
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .insert(storeData)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    
    // ✅ Phase 2e: Invalidate discovery/list caches on new store creation
    void cacheInvalidationManager.triggerInvalidation({
      type: 'storeUpdated',
      storeId: data.id,
      timestamp: new Date(),
    });
    
    return data;
  },

  async getById(id: string) {
    const cacheKey = `store_${id}`;
    const startTime = performance.now();

    const { data, fromCache } = await cacheManager.swr(
      cacheKey,
      async () => {
        const client = useSupabase();
        const { data, error } = await client
          .from('stores')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      { ttl: 10 * 60 * 1000 } // 10 minutes cache
    );

    // ✅ Phase 2e: Track performance metrics
    performanceMonitor.recordMetric({
      operation: 'storeService.getById',
      duration: performance.now() - startTime,
      timestamp: new Date(),
      itemsFetched: data ? 1 : 0,
      itemsReturned: data ? 1 : 0,
      cacheHit: fromCache,
      rpcUsed: false,
    });

    return data;
  },

  async getStoresByUser(userId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getByUser(userId: string) {
    const activeStore = useStoreStore.getState().store;
    if (activeStore && activeStore.user_id === userId) {
      return activeStore;
    }

    const client = useSupabase();
    // ✅ Phase 2b: Use RPC to fetch store with plan details in single query (eliminates N+1)
    const { data: storeData, error } = await client
      .rpc('get_user_store_with_plan', { p_user_id: userId })
      .single();

    if (error) {
      // Fallback to direct query if RPC not available
      console.warn('[storeService] RPC get_user_store_with_plan failed, using direct query:', error);
      const { data: store, error: fallbackError } = await client
        .from('stores')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackError) throw fallbackError;
      if (!store) return null;
      
      // Sync feature flags with the plan (fallback path)
      if (store.subscription_plan) {
        try {
          const { data: plan } = await client
            .from('plans')
            .select('has_caisse, has_online_store, has_analytics')
            .eq('name', store.subscription_plan)
            .maybeSingle();

          if (plan) {
            if (plan.has_caisse) store.cashier_active = true;
            if (plan.has_online_store) store.online_store_active = true;
            if (plan.has_analytics) store.analytics_active = true;
            
            if (plan.has_caisse === false) store.cashier_active = false;
            if (plan.has_online_store === false) store.online_store_active = false;
            if (plan.has_analytics === false) store.analytics_active = false;
          }
        } catch (err) {
          console.warn('[storeService] Failed to sync plan features:', err);
        }
      }

      if (!activeStore) {
        useStoreStore.getState().setStore(store);
      }

      return store;
    }

    if (!storeData) return null;

    // ✅ Phase 2d: Type-safe mapping of RPC response (plan_* columns)
    const store = storeData as StoreWithPlan;
    if (store.plan_has_caisse) store.cashier_active = true;
    if (store.plan_has_online_store) store.online_store_active = true;
    if (store.plan_has_analytics) store.analytics_active = true;
    
    if (store.plan_has_caisse === false) store.cashier_active = false;
    if (store.plan_has_online_store === false) store.online_store_active = false;
    if (store.plan_has_analytics === false) store.analytics_active = false;

    // Set the store as active if none is set yet
    if (!activeStore) {
      useStoreStore.getState().setStore(store);
    }

    return store;
  },

  async incrementOrders(storeId: string) {
    const client = useSupabase();
    try {
      // Use RPC confirm_order_payment instead - this is now handled atomically
      // Keeping this as a no-op fallback for backwards compatibility
      const { data: current } = await client
        .from('stores')
        .select('id')
        .eq('id', storeId)
        .maybeSingle();
      
      if (current) {
        await client
          .from('stores')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', storeId);
      }
    } catch (e) {
      // Silently fail - order stats are now handled by RPC functions
      console.warn('incrementOrders (legacy):', e);
    }
  },

  async search(query: string) {
    const startTime = performance.now();
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('status', 'active')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,address.ilike.%${query}%`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    // ✅ Phase 2e: Track performance metrics
    performanceMonitor.recordMetric({
      operation: 'storeService.search',
      duration: performance.now() - startTime,
      timestamp: new Date(),
      itemsFetched: (data || []).length,
      itemsReturned: (data || []).length,
      cacheHit: false,
      rpcUsed: false,
    });
    
    return data || [];
  },

  async getAll(page = 0, pageSize = 20, sort: 'newest' | 'top' | 'smart' | 'score' = 'newest') {
    const cacheKey = `stores_all_${page}_${pageSize}_${sort}`;
    
    // SWR: Return cached data immediately, then fetch fresh data in background
    const fetcher = async () => {
      const client = useSupabase();
      const from = page * pageSize;
      const to = from + pageSize - 1;
      try {
        const { data, error } = await client
          .from('stores')
          .select('*, store_stats(rating_avg, rating_count, followers_count, customers_count)')
          .eq('status', 'active')
          .eq('visible', true)
          .order('created_at', { ascending: false })
          .order('verified', { ascending: false })
          .range(from, to);
        if (error) throw error;
        return data;
      } catch (e: any) {
        try {
          const { data: data2, error: error2 } = await client
            .from('stores')
            .select('*, store_stats(rating_avg, rating_count, followers_count, customers_count)')
            .eq('status', 'active')
            .eq('visible', true)
            .order('created_at', { ascending: false })
            .order('verified', { ascending: false })
            .range(from, to);
          if (error2) throw error2;
          return data2;
        } catch (e2) {
          throw e;
        }
      }
    };

    const result = await cacheManager.swr(cacheKey, fetcher, { ttl: 5 * 60 * 1000 });
    return result.data;
  },

  async getFeatured() {
    const cacheKey = 'stores_featured';
    const startTime = performance.now();
    
    // SWR: Return cached data immediately, then fetch fresh data in background
    const fetcher = async () => {
      const client = useSupabase();
      const methodStart = performance.now();
      let itemsFetched = 0;
      
      // ✅ Phase 2b: Use RPC for optimized ranking (eliminates over-fetch from 50→10)
      const { data, error } = await client
        .rpc('get_featured_stores', { p_limit: 15 }) // Fetch 15 instead of 50
        .order('rating_avg', { ascending: false, nullsFirst: false });
      
      let result = data;
      itemsFetched = (data || []).length;
      
      if (error) {
        // Fallback to direct query if RPC not available
        console.warn('[storeService] RPC get_featured_stores failed, using fallback:', error);
        const { data: fallbackData, error: fallbackError } = await client
          .from('stores')
          .select('id, name, slug, description, category, logo_url, banner_url, verified, status, visible, created_at, store_stats(followers_count, customers_count, rating_avg, rating_count)')
          .eq('status', 'active')
          .eq('visible', true)
          .limit(15); // Reduced from 50 to 15
        if (fallbackError) throw fallbackError;
        
        const fallbackMapped = (fallbackData || []).map((s: any) => ({
           ...s,
           store_stats: Array.isArray(s.store_stats) ? s.store_stats[0] : s.store_stats
        }));
        
        result = fallbackMapped;
        itemsFetched = fallbackMapped.length;
      } else if (result && result.length > 0) {
        // Enrich RPC results with missing lightweight columns securely without overloading
        const storeIds = result.map((s: any) => s.id);
        const { data: enrichedData } = await client
          .from('stores')
          .select('id, description, banner_url, logo_url, category, verified, latitude, longitude, store_stats(rating_avg, rating_count, followers_count, customers_count)')
          .in('id', storeIds);

        if (enrichedData && enrichedData.length > 0) {
          const enrichedMap: Record<string, any> = {};
          enrichedData.forEach((s: any) => {
             enrichedMap[s.id] = {
               ...s,
               store_stats: Array.isArray(s.store_stats) ? s.store_stats[0] : s.store_stats
             };
          });
          
          result = result.map((s: any) => ({
             ...s,
             ...(enrichedMap[s.id] || {})
          }));
        }
      }
      
      // Client-side ranking: verified → sales → followers → rating → date
      // Database already pre-ranked, we just apply final client-side sorting if needed
      return (result || [])
        .sort((a: StoreWithStats, b: StoreWithStats) => {
          // 1️⃣ Verified first (from DB ranking)
          if (a.verified !== b.verified) {
            return a.verified ? -1 : 1;
          }
          
          // 2️⃣ By sales (customers_count) - higher = first
          const customersA = Number(a.customers_count || 0);
          const customersB = Number(b.customers_count || 0);
          if (customersB !== customersA) {
            return customersB - customersA;
          }
          
          // 3️⃣ By followers (popularity) - higher = first
          const followersA = Number(a.followers_count || 0);
          const followersB = Number(b.followers_count || 0);
          if (followersB !== followersA) {
            return followersB - followersA;
          }
          
          // 4️⃣ By rating - higher = first
          const ratingA = Number(a.rating_avg || 0);
          const ratingB = Number(b.rating_avg || 0);
          if (ratingB !== ratingA) {
            return ratingB - ratingA;
          }
          
          // 5️⃣ By creation date - newer = first
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        })
        .slice(0, 10); // Return 10 from 15 fetched (67% reduction vs 50 before)
    };

    const result = await cacheManager.swr(cacheKey, fetcher, { ttl: 10 * 60 * 1000 });
    
    // ✅ Phase 2e: Track performance metrics
    performanceMonitor.recordMetric({
      operation: 'storeService.getFeatured',
      duration: performance.now() - startTime,
      timestamp: new Date(),
      itemsFetched: (result.data || []).length,
      itemsReturned: (result.data || []).length,
      cacheHit: result.fromCache,
      rpcUsed: true,
    });
    
    return result.data;
  },

  async getPopularStores(limit: number = 4) {
    const cacheKey = `stores_popular_${limit}`;
    const startTime = performance.now();
    
    // SWR: Return cached data immediately, then fetch fresh data in background
    const fetcher = async () => {
      const client = useSupabase();
      let itemsFetched = 0;
      
      try {
        // ✅ Phase 2b: Use RPC for optimized ranking (eliminates over-fetch from 20→4)
        const { data: stores, error } = await client
          .rpc('get_popular_stores', { p_limit: Math.max(limit + 1, 5) }); // Fetch limit+1 (usually 5-6)
        itemsFetched = (stores || []).length;

        if (error) {
          // Fallback to direct query if RPC not available
          console.warn('[storeService] RPC get_popular_stores failed, using fallback:', error);
          const { data: fallbackStores, error: fallbackError } = await client
            .from('stores')
            .select('id, name, slug, description, category, logo_url, banner_url, verified, status, visible, created_at, store_stats(rating_avg, rating_count, followers_count, customers_count)')
            .eq('status', 'active')
            .eq('visible', true)
            .order('verified', { ascending: false })
            .limit(Math.max(limit + 1, 5)); // Reduced from 20 to 5-6
          itemsFetched = (fallbackStores || []).length;

          if (fallbackError) throw fallbackError;
          if (!fallbackStores || fallbackStores.length === 0) return [];

          const scoredStores = fallbackStores.map((s: any) => {
            const embedded = Array.isArray(s.store_stats) ? s.store_stats[0] : s.store_stats;
            const foll = Number(embedded?.followers_count || 0);
            const cust = Number(embedded?.customers_count || 0);
            return { ...s, store_stats: embedded || null, _score: foll * 2 + cust };
          });

          scoredStores.sort((a: any, b: any) => b._score - a._score);
          return scoredStores.slice(0, limit).map((s: any) => {
            delete s._score;
            return s;
          });
        }

        if (!stores || stores.length === 0) return [];
        
        // RPC already ranked, but might be missing description, banner_url or store_stats
        // We fetch these specific lightweight columns to enrich the RPC result securely without overloading
        const storeIds = stores.map((s: any) => s.id);
        const { data: enrichedData } = await client
          .from('stores')
          .select('id, description, banner_url, logo_url, category, verified, latitude, longitude, store_stats(rating_avg, rating_count)')
          .in('id', storeIds);

        let finalStores = stores;
        if (enrichedData && enrichedData.length > 0) {
          const enrichedMap: Record<string, any> = {};
          enrichedData.forEach((s: any) => {
             enrichedMap[s.id] = {
               ...s,
               store_stats: Array.isArray(s.store_stats) ? s.store_stats[0] : s.store_stats
             };
          });
          
          finalStores = stores.map((s: any) => ({
             ...s,
             ...(enrichedMap[s.id] || {})
          }));
        }

        return finalStores.slice(0, limit);
      } catch (e) {
        console.error('getPopularStores error:', e);
        return [];
      }
    };

    const result = await cacheManager.swr(cacheKey, fetcher, { ttl: 10 * 60 * 1000 });
    return result.data;
  },

  async getNewStores(limit: number = 4) {
    const startTime = performance.now();
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('status', 'active')
      .eq('visible', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    
    // ✅ Phase 2e: Track performance metrics
    performanceMonitor.recordMetric({
      operation: 'storeService.getNewStores',
      duration: performance.now() - startTime,
      timestamp: new Date(),
      itemsFetched: (data || []).length,
      itemsReturned: (data || []).length,
      cacheHit: false,
      rpcUsed: false,
    });
    
    return data || [];
  },

  async getBySlug(slug: string) {
    const startTime = performance.now();
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();
    if (error) throw error;
    
    // ✅ Phase 2e: Track performance metrics
    performanceMonitor.recordMetric({
      operation: 'storeService.getBySlug',
      duration: performance.now() - startTime,
      timestamp: new Date(),
      itemsFetched: data ? 1 : 0,
      itemsReturned: data ? 1 : 0,
      cacheHit: false,
      rpcUsed: false,
    });
    
    return data;
  },

  async isSlugAvailable(slug: string): Promise<boolean> {
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !data;
  },

  async update(id: string, store: Partial<Store>) {
    // ✅ Phase 2c: Validate current user owns the store (RLS)
    const currentStore = await getStoreAndValidateOwnership(id);
    
    // ✅ Validate store data
    const validationErrors = validateStore(store);
    if (validationErrors.length > 0) {
      throw new Error(`Validation échouée: ${validationErrors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
    }
    
    const client = useSupabase();
    const now = new Date();
    
    // ✅ Phase 2c: Use optimistic locking to prevent lost updates
    // Increment version and use version field for conflict detection
    const updateData = {
      ...store,
      version: ((currentStore.version || 0) + 1),
      updated_at: now.toISOString(),
    };
    
    const { data, error } = await client
      .from('stores')
      .update(updateData)
      .eq('id', id)
      .eq('version', (currentStore.version || 0)) // Version matching for optimistic locking
      .select('*')
      .single();
    
    // Check if update failed due to version mismatch (conflict)
    if (!data && error?.code === 'PGRST116') {
      throw new Error('La boutique a été modifiée - veuillez recharger et réessayer (conflict détecté)');
    }
    
    if (error) throw error;
    
    // ✅ Phase 2e: Invalidate store caches on update
    void cacheInvalidationManager.triggerInvalidation({
      type: 'storeUpdated',
      storeId: id,
      timestamp: new Date(),
    });
    
    return data;
  },

  async createWithPlan(userId: string, store: Partial<Store>, planId: string) {
    // ✅ Validate current user is authenticated
    const currentUser = await getCurrentUser();
    
    // ✅ Prevent privilege escalation - can only create stores for yourself
    if (currentUser.id !== userId) {
      throw new Error('Vous ne pouvez créer des boutiques que pour vous-même');
    }
    
    // ✅ Validate store data
    const validationErrors = validateStore(store);
    if (validationErrors.length > 0) {
      throw new Error(`Validation échouée: ${validationErrors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
    }
    
    const plan = await planService.getById(planId);
    const now = new Date();
    let end: Date | null = null;
    
    if (plan.months && plan.months > 0) {
      end = new Date(now.getTime() + plan.months * 30 * 24 * 60 * 60 * 1000);
    } else if (plan.trial_days && plan.trial_days > 0) {
      end = new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000);
    }

    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .insert({
        user_id: userId,
        ...store,
        status: 'active',
        subscription_plan: plan.name,
        subscription_start: now.toISOString(),
        subscription_end: end ? end.toISOString() : null,
        subscription_status:
          plan.price === 0 && plan.trial_days ? 'trial' : 'active',
        product_limit: plan.product_limit || 0,
        visible: true,
      })
      .select('*')
      .single();
    if (error) throw error;
    
    // ✅ Phase 2e: Invalidate discovery caches on new store with plan creation
    void cacheInvalidationManager.triggerInvalidation({
      type: 'storeUpdated',
      storeId: data.id,
      timestamp: new Date(),
    });
    
    return data;
  },

  async createWithPlanSlugRetry(userId: string, store: Partial<Store>, planId: string) {
    try {
      return await this.createWithPlan(userId, store, planId);
    } catch (e: any) {
      const msg = String(e?.message || '');
      const code = String(e?.code || '');
      const isSlugConflict =
        code === '23505' || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique');

      if (!isSlugConflict || !store.slug) {
        throw e;
      }

      const suffix = Math.floor(1000 + Math.random() * 9000);
      const nextSlug = `${String(store.slug).replace(/-\d{4}$/, '')}-${suffix}`;
      return await this.createWithPlan(userId, { ...store, slug: nextSlug }, planId);
    }
  },

  async createWithTrial(userId: string, store: Partial<Store>) {
    // ✅ Validate current user is authenticated
    const currentUser = await getCurrentUser();
    
    // ✅ Prevent privilege escalation - can only create stores for yourself
    if (currentUser.id !== userId) {
      throw new Error('Vous ne pouvez créer des boutiques que pour vous-même');
    }
    
    // ✅ Validate store data
    const validationErrors = validateStore(store);
    if (validationErrors.length > 0) {
      throw new Error(`Validation échouée: ${validationErrors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
    }
    
    try {
      const plans = await planService.getAll();
      const trial = plans.find(p => p.name.toLowerCase() === 'trial' || p.id === 'trial');
      if (trial) {
        return this.createWithPlan(userId, store, trial.id);
      }
    } catch {}
    
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .insert({
        user_id: userId,
        ...store,
        status: 'active',
        subscription_plan: 'trial',
        subscription_start: now.toISOString(),
        subscription_end: end.toISOString(),
        subscription_status: 'trial',
        product_limit: 10,
        visible: true,
      })
      .select('*')
      .single();
    if (error) throw error;
    
    // ✅ Phase 2e: Invalidate discovery caches on new store with trial creation
    void cacheInvalidationManager.triggerInvalidation({
      type: 'storeUpdated',
      storeId: data.id,
      timestamp: new Date(),
    });
    
    return data;
  },

  async createWithTrialSlugRetry(userId: string, store: Partial<Store>) {
    try {
      return await this.createWithTrial(userId, store);
    } catch (e: any) {
      const msg = String(e?.message || '');
      const code = String(e?.code || '');
      const isSlugConflict =
        code === '23505' || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique');
      if (!isSlugConflict || !store.slug) throw e;

      const suffix = Math.floor(1000 + Math.random() * 9000);
      const nextSlug = `${String(store.slug).replace(/-\d{4}$/, '')}-${suffix}`;
      return await this.createWithTrial(userId, { ...store, slug: nextSlug });
    }
  },

  async upgradeSubscription(storeId: string, planId: string) {
    // ✅ Validate current user owns the store
    const store = await getStoreAndValidateOwnership(storeId);
    
    const client = useSupabase();
    const plan = await planService.getById(planId);
    
    const now = new Date();
    let credit = 0;

    if (store.subscription_status === 'active' && store.subscription_end) {
      const currentEnd = new Date(store.subscription_end);
      if (currentEnd > now) {
        const remainingMs = currentEnd.getTime() - now.getTime();
        const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        const currentPrice = Number(store.subscription_price || 0);
        if (currentPrice > 0) {
          credit = Math.floor((currentPrice / 30) * remainingDays);
        }
      }
    }

    const newPrice = Math.max(0, plan.price - credit);
    let end: Date | null = null;
    if (plan.months && plan.months > 0) {
      end = new Date(now.getTime() + plan.months * 30 * 24 * 60 * 60 * 1000);
    } else if (plan.trial_days && plan.trial_days > 0) {
      end = new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000);
    }

    // ✅ Phase 2c: Use optimistic locking to prevent lost updates during subscription change
    // Include version matching to detect concurrent modifications
    const { data, error } = await client
      .from('stores')
      .update({
        subscription_plan: plan.name,
        subscription_price: newPrice,
        subscription_start: now.toISOString(), 
        subscription_end: end ? end.toISOString() : null,
        subscription_status: 'active',
        billing_status: 'paid',
        product_limit: plan.product_limit || 0,
        visible: true,
        version: ((store.version || 0) + 1),
        updated_at: now.toISOString(),
      })
      .eq('id', storeId)
      .eq('version', (store.version || 0)) // Version matching for optimistic locking
      .select('*')
      .single();
    
    // Check if update failed due to version mismatch (concurrent modification)
    if (!data && error?.code === 'PGRST116') {
      throw new Error('La boutique a été modifiée - veuillez recharger et réessayer');
    }
      
    if (error) throw error;
    
    // ✅ Phase 2e: Invalidate store caches on subscription upgrade
    void cacheInvalidationManager.triggerInvalidation({
      type: 'storeUpdated',
      storeId: storeId,
      timestamp: new Date(),
    });
    
    return data;
  },

  async expireTrials() {
    const client = useSupabase();
    const { error } = await client
      .from('stores')
      .update({ subscription_status: 'expired', visible: false })
      .lt('subscription_end', new Date().toISOString())
      .neq('subscription_status', 'expired');
    if (error) throw error;
  },

  /**
   * Centralized logic to determine if a store's subscription is truly active
   * checking both the status string and the expiration date.
   */
  getSubscriptionStatus(store: Partial<Store> | null): 'trial' | 'active' | 'expired' | 'cancelled' | 'unknown' {
    if (!store) return 'unknown';
    
    // 1. Check explicit status
    const status = String(store.subscription_status || '').toLowerCase();
    
    // 2. If already marked as expired/cancelled, trust it
    if (status === 'expired' || status === 'cancelled') {
      return status as 'expired' | 'cancelled';
    }
    
    // 3. Check expiration date if it exists
    if (store.subscription_end) {
      const end = new Date(store.subscription_end);
      if (!Number.isNaN(end.getTime()) && end < new Date()) {
        return 'expired';
      }
    }
    
    // 4. Fallback to status or active
    const validStatus = status as 'trial' | 'active' | 'expired' | 'cancelled' | '';
    return validStatus || 'active';
  },

  isSubscriptionActive(store: Partial<Store> | null): boolean {
    if (!store) return false;
    const status = this.getSubscriptionStatus(store);
    return status === 'active' || status === 'trial';
  },

  // Logic from shopFollowService
  async getFollowersCount(storeId: string): Promise<number> {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_followers')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId);
    
    if (error) throw error;
    return data?.length || 0;
  },

  async isFollowing(userId: string, storeId: string): Promise<boolean> {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_followers')
      .select('id')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .maybeSingle();
    
    if (error) throw error;
    return !!data;
  },

  async addFollow(userId: string, storeId: string): Promise<StoreFollower> {
    // ✅ Validate current user is authenticated
    const currentUser = await getCurrentUser();
    
    // ✅ Prevent privilege escalation - can only follow as yourself
    if (currentUser.id !== userId) {
      throw new Error('Vous ne pouvez suivre des boutiques que avec votre propre compte');
    }
    
    // ✅ Validate inputs
    if (!userId || !storeId || storeId === 'undefined') {
      throw new Error('Les IDs utilisateur et boutique sont requis');
    }

    const client = useSupabase();
    try {
      // ✅ Phase 2c: Use RPC with UPSERT to prevent race condition
      // RPC handles ON CONFLICT DO UPDATE for idempotent follows
      const { data, error } = await client
        .rpc('add_store_follower', {
          p_user_id: userId,
          p_store_id: storeId
        })
        .single();
      
      if (error) {
        // RPC will throw if store doesn't exist
        if (error.message.includes('does not exist')) {
          throw new Error('La boutique n\'existe pas ou n\'est pas visible');
        }
        throw error;
      }

      // Send notification to store owner (best effort - don't fail follow if notification fails)
      try {
        const { data: storeData } = await client
          .from('stores')
          .select('id, name, user_id')
          .eq('id', storeId)
          .single();
        
        if (storeData) {
          const storePartial = storeData as StorePartial;
          await notificationService.create({
            user_id: storePartial.user_id,
            title: '👥 Nouveau follower!',
            body: `Quelqu'un a suivi votre boutique "${storePartial.name}"`,
            type: 'system',
            data: {
              storeId: storeId,
              followedBy: userId,
            },
          });
        }
      } catch (notificationError) {
        // Don't fail the follow operation if notification fails
        console.error('Failed to send follow notification:', notificationError);
      }

      // ✅ Phase 2e: Invalidate store follower caches on follow
      void cacheInvalidationManager.triggerInvalidation({
        type: 'storeUpdated',
        storeId: storeId,
        timestamp: new Date(),
      });

      return data as StoreFollower;
    } catch (error: any) {
      errorHandler.handleDatabaseError(error, 'Error adding follow:');
      throw error;
    }
  },

  async removeFollow(userId: string, storeId: string): Promise<void> {
    const client = useSupabase();
    const { error } = await client
      .from('store_followers')
      .delete()
      .eq('user_id', userId)
      .eq('store_id', storeId);
    
    if (error) throw error;
  },

  async toggleFollow(userId: string, storeId: string): Promise<boolean> {
    const isFollowing = await this.isFollowing(userId, storeId);
    if (isFollowing) {
      await this.removeFollow(userId, storeId);
      return false;
    } else {
      await this.addFollow(userId, storeId);
      return true;
    }
  },

  async getFollowed(userId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_followers')
      .select('*, store:stores(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Mettre à jour la localisation d'une boutique
   */
  async updateStoreLocation(storeId: string, location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  }) {
    // ✅ Validate current user owns the store
    const store = await getStoreAndValidateOwnership(storeId);
    
    // ✅ Validate coordinates are valid numbers
    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      throw new Error('Les coordonnées doivent être des nombres');
    }
    
    if (location.latitude < -90 || location.latitude > 90 || location.longitude < -180 || location.longitude > 180) {
      throw new Error('Les coordonnées doivent être dans les plages valides');
    }
    
    const client = useSupabase();
    
    const now = new Date();
    // ✅ Phase 2c: Use optimistic locking to prevent lost updates during location changes
    const { data, error } = await client
      .from('stores')
      .update({
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        city: location.city,
        location_set_at: now.toISOString(),
        version: ((store.version || 0) + 1),
        updated_at: now.toISOString(),
      })
      .eq('id', storeId)
      .eq('version', (store.version || 0)) // Version matching for optimistic locking
      .select()
      .single();
    
    // Check if update failed due to version mismatch (concurrent modification)
    if (!data && error?.code === 'PGRST116') {
      throw new Error('La boutique a été modifiée - veuillez recharger et réessayer');
    }
    
    if (error) throw error;
    
    // ✅ Phase 2e: Invalidate nearby stores caches on location update
    void cacheInvalidationManager.triggerInvalidation({
      type: 'storeUpdated',
      storeId: storeId,
      timestamp: new Date(),
    });
    
    return data;
  },

  /**
   * Trouver les boutiques près d'une position
   */
  async findNearbyStores(
    lat: number, 
    lon: number, 
    radiusKm: number = 10
  ): Promise<Store[]> {
    const client = useSupabase();
    
    // ✅ Phase 2b: Use RPC with geo-indexing (eliminates full-table scan)
    // PostgreSQL earth distance operator with GiST index for O(log N) lookup
    const { data, error } = await client
      .rpc('find_nearby_stores', {
        p_latitude: lat,
        p_longitude: lon,
        p_radius_km: radiusKm,
        p_limit: 50 // Reasonable limit for UI
      });
    
    if (error) {
      // Fallback to client-side calculation if RPC not available
      console.warn('[storeService] RPC find_nearby_stores failed, using fallback:', error);
      const { data: allStores, error: fallbackError } = await client
        .from('stores')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .eq('status', 'active');
      
      if (fallbackError) throw fallbackError;
      
      const userCoords = { latitude: lat, longitude: lon };
      
      // Filtrer par distance côté client et trier
      const storesWithDistance = (allStores || [])
        .map(store => ({
          ...store,
          distance: locationService.calculateDistanceToStore(userCoords, store)
        }))
        .filter(store => store.distance !== null && store.distance <= radiusKm)
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      return storesWithDistance as StoreWithDistance[];
    }
    
    // RPC returns data already sorted by distance
    return (data || []) as StoreWithDistance[];
  },
};

export const storeStatsService = {
  async getByStore(storeId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_stats')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) throw error;
    return data as StoreStats | null;
  },

  async getByStores(storeIds: string[]) {
    if (!storeIds.length) return [] as StoreStats[];
    const client = useSupabase();
    const { data, error } = await client
      .from('store_stats')
      .select('*')
      .in('store_id', storeIds);
    if (error) throw error;
    return (data || []) as StoreStats[];
  },
};

// ✅ Phase 2e: Cache management and statistics export functions
/**
 * Get comprehensive cache statistics for store service
 * Returns hit rates, TTL data, and performance metrics
 */
export function getStoreCacheStats() {
  const stats = performanceMonitor.getAllStats();
  
  return {
    operations: stats,
    cacheConfig: {
      featured: { ttl: 10 * 60 * 1000, description: 'Featured stores (10 min)' },
      popular: { ttl: 15 * 60 * 1000, description: 'Popular stores (15 min)' },
      userStores: { ttl: 5 * 60 * 1000, description: 'User stores (5 min)' },
      search: { ttl: 2 * 60 * 1000, description: 'Search results (2 min)' },
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get TTL configuration for different store queries
 * Useful for cache invalidation strategies
 */
export function getStoreDataTTL() {
  return {
    getFeatured: 10 * 60 * 1000,
    getPopularStores: 15 * 60 * 1000,
    getNewStores: 5 * 60 * 1000,
    search: 2 * 60 * 1000,
    getByUser: 5 * 60 * 1000,
    getById: 30 * 60 * 1000,
    getBySlug: 30 * 60 * 1000,
    findNearbyStores: 10 * 60 * 1000,
  };
}

/**
 * Pre-warm store caches on app startup
 * Reduces perceived latency on first load
 */
export async function warmStoreCacheForStartup() {
  try {
    const cacheWarmer = async () => {
      // Parallel warm-up of key caches
      await Promise.allSettled([
        storeService.getFeatured(),
        storeService.getPopularStores(4),
        storeService.getNewStores(4),
      ]);
    };

    // Run in background, don't block startup
    void cacheWarmer();

    return { status: 'warming', timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('[storeService] Cache warm-up failed:', error);
    return { status: 'error', error: String(error), timestamp: new Date().toISOString() };
  }
}

/**
 * Subscribe to store cache invalidation events
 * Useful for reactive UI updates when store data changes
 */
export function subscribeToStoreCacheEvents(callback: (event: any) => void) {
  return cacheInvalidationManager.subscribe((event) => {
    if (event.type === 'storeUpdated') {
      callback({
        type: 'storeUpdated',
        storeId: event.storeId,
        timestamp: event.timestamp,
        description: `Store ${event.storeId} was updated`,
      });
    }
  });
}

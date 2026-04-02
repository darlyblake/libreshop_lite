import { useSupabase } from '../lib/supabase';
import { Store, StoreStats } from '../lib/supabase';
import { planService } from './planService';
import { errorHandler } from '../utils/errorHandler';
import { notificationService } from '../services/notificationService';

export interface StoreFollower {
  id: string;
  store_id: string;
  user_id: string;
  created_at: string;
}

export const storeService = {
  async create(store: Partial<Store>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .insert(store)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByUser(userId: string) {
    const client = useSupabase();
    const { data: store, error } = await client
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!store) return null;

    // Sync feature flags with the plan if they are null at the store level
    if (store.subscription_plan) {
      try {
        const { data: plan } = await client
          .from('plans')
          .select('has_caisse, has_online_store, has_analytics')
          .eq('name', store.subscription_plan)
          .maybeSingle();

        if (plan) {
          // Sync store flags with plan. Plan features take precedence if they are enabled.
          // This ensures that when an admin enables a feature on a plan, it's immediately 
          // available to all stores on that plan.
          if (plan.has_caisse) store.cashier_active = true;
          if (plan.has_online_store) store.online_store_active = true;
          if (plan.has_analytics) store.analytics_active = true;
          
          // Fallback cases for when features are NOT in the plan
          if (plan.has_caisse === false) store.cashier_active = false;
          if (plan.has_online_store === false) store.online_store_active = false;
          if (plan.has_analytics === false) store.analytics_active = false;
        }
      } catch (err) {
        console.warn('[storeService] Failed to sync plan features:', err);
      }
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
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('status', 'active')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,address.ilike.%${query}%`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getAll(page = 0, pageSize = 20, sort: 'newest' | 'top' | 'smart' | 'score' = 'newest') {
    const client = useSupabase();
    const from = page * pageSize;
    const to = from + pageSize - 1;
    try {
      const { data, error } = await client
        .from('stores')
        .select('*')
        .eq('status', 'active')
        .eq('visible', true)
        // Note: columns like 'store_score' and 'view_count' are currently missing from the DB
        // Falling back to standard columns to avoid 400 errors.
        .order('created_at', { ascending: false })
        .order('verified', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data;
    } catch (e: any) {
      try {
        const { data: data2, error: error2 } = await client
          .from('stores')
          .select('*')
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
  },

  async getFeatured() {
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('status', 'active')
      .eq('visible', true)
      .order('verified', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data;
  },

  async getBySlug(slug: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();
    if (error) throw error;
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
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .update(store)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async createWithPlan(userId: string, store: Partial<Store>, planId: string) {
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
    const client = useSupabase();
    const [storeRes, plan] = await Promise.all([
      client.from('stores').select('subscription_end, subscription_status, subscription_price').eq('id', storeId).single(),
      planService.getById(planId)
    ]);
    
    if (storeRes.error) throw storeRes.error;
    const store = storeRes.data;
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
      })
      .eq('id', storeId)
      .select('*')
      .single();
      
    if (error) throw error;
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
    if (status === 'expired' || status === 'cancelled') return status as any;
    
    // 3. Check expiration date if it exists
    if (store.subscription_end) {
      const end = new Date(store.subscription_end);
      if (!Number.isNaN(end.getTime()) && end < new Date()) {
        return 'expired';
      }
    }
    
    // 4. Fallback to status or active
    return (status as any) || 'active';
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
    if (!userId || !storeId || storeId === 'undefined') {
      console.warn('[storeService] Tentative de follow avec des IDs invalides:', { userId, storeId });
      return {} as any;
    }

    const client = useSupabase();
    try {
      const existingFollowing = await this.isFollowing(userId, storeId);
      if (existingFollowing) {
        return { user_id: userId, store_id: storeId } as StoreFollower;
      }

      const { data, error } = await client
        .from('store_followers')
        .upsert({ user_id: userId, store_id: storeId }, { onConflict: 'user_id,store_id', ignoreDuplicates: true })
        .select()
        .single();
      
      if (error && error.code !== '23505') throw error;
      
      const followData = data || { user_id: userId, store_id: storeId } as StoreFollower;

      const { data: store, error: storeError } = await client
        .from('stores')
        .select('id, name, user_id')
        .eq('id', storeId)
        .single();

      if (!storeError && store) {
        await notificationService.create({
          user_id: store.user_id,
          title: '👥 Nouveau follower!',
          body: `Quelqu'un a suivi votre boutique "${store.name}"`,
          type: 'system',
          read: false,
          data: {
            storeId: storeId,
            followedBy: userId,
          },
        });
      }

      return followData as StoreFollower;
    } catch (error: any) {
      if (error?.code === '23505') return { user_id: userId, store_id: storeId } as any;
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

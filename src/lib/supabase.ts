import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseConfig } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

// Initialize Supabase client only once, preserving across hot reloads
const globalForSupabase = globalThis as unknown as {
  supabaseClient: SupabaseClient | null;
};

const getSupabaseClient = (): SupabaseClient | null => {
  if (globalForSupabase.supabaseClient) {
    return globalForSupabase.supabaseClient;
  }

  const { supabaseUrl, supabaseAnonKey } = supabaseConfig;
  
  // log the values loaded from config so it's easier to debug env issues
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    const keyLabel = supabaseAnonKey ? supabaseAnonKey.replace(/(.{5}).+(.{5})/, '$1…$2') : 'null';
    // Log: `Supabase config loaded url=${supabaseUrl} key=${keyLabel}`;
  }

  // Check if credentials are properly configured
  if (!supabaseUrl || supabaseUrl.includes('your-project') ||
      !supabaseAnonKey || supabaseAnonKey === 'YOUR_ANON_KEY') {
    console.warn(
      '⚠️ Supabase credentials not configured. Using demo mode. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
    return null;
  }
  
  // Additional check: test if URL is reachable
  if (typeof window !== 'undefined') {
    // Test URL resolution synchronously by checking if it's a valid Supabase URL pattern
    const urlPattern = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
    if (!urlPattern.test(supabaseUrl)) {
      console.warn(
        '⚠️ Invalid Supabase URL format. Using demo mode. URL should be like: https://project-id.supabase.co'
      );
      return null;
    }
  }
  
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: typeof window !== 'undefined',
      lock: Platform.OS === 'web' 
        ? async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
            return await fn();
          }
        : undefined,
    },
  });
  globalForSupabase.supabaseClient = client;

  return globalForSupabase.supabaseClient;
};

export const supabase = getSupabaseClient();

// Helper function to safely use supabase
const useSupabase = (): SupabaseClient => {
  if (!supabase) {
    throw new Error('Supabase not initialized. Please configure your credentials in src/config/theme.ts');
  }
  return supabase;
};

// Types pour les utilisateurs
export type UserRole = 'client' | 'seller' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  whatsapp_number?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
}

// Types pour les boutiques
export interface Store {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  subcategory?: string;
  logo_url?: string;
  banner_url?: string;
  email?: string;
  phone?: string;
  address?: string;
  country_id?: string;
  city_id?: string;
  website?: string;
  social?: Record<string, string>;
  verified?: boolean;
  promo_enabled?: boolean;
  promo_title?: string;
  promo_subtitle?: string;
  promo_image_url?: string;
  promo_target_type?: 'collection' | 'product' | 'url';
  promo_target_id?: string;
  promo_target_url?: string;
  status: 'active' | 'suspended' | 'pending';
  subscription_plan?: string;
  subscription_price?: number;
  subscription_start?: string;
  subscription_end?: string;
  subscription_status?: 'trial' | 'active' | 'expired';
  billing_status?: 'pending' | 'paid' | 'failed';
  product_limit?: number;
  visible?: boolean;
  tax_rate?: number;
  shipping_fee?: number;
  total_orders?: number;
  rating_avg?: number;
  rating_count?: number;
  products_count?: number; // Calculé ou via trigger
  created_at: string;
}

// Types pour les produits
export interface Product {
  id: string;
  store_id: string;
  collection_id: string;
  name: string;
  description?: string;
  price: number;
  compare_price?: number;
  stock: number;
  reference?: string;
  images: string[];
  is_active: boolean;
  is_online_sale: boolean;
  is_physical_sale: boolean;
  category?: string;
  sale_active?: boolean;
  sale_price?: number;
  discount_percent?: number;
  sale_start_date?: string;
  sale_end_date?: string;
  view_count?: number;
  total_sales?: number;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

// Types pour les commandes
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'mobile_money' | 'card' | 'cash_on_delivery';

export interface Order {
  id: string;
  user_id: string;
  store_id: string;
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: 'pending' | 'paid' | 'failed';
  customer_name?: string;
  shipping_address?: string;
  customer_phone?: string;
  notes?: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  product?: Product;
}

// Types pour les catégories
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: string | null;
  status?: 'active' | 'inactive';
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Collection {
  id: string;
  store_id: string;
  category_id?: string | null;
  name: string;
  description?: string;
  icon?: string;
  cover_color?: string;
  is_active: boolean;
  created_at: string;
}

export interface StoreStats {
  store_id: string;
  followers_count: number;
  customers_count: number;
  rating_avg: number;
  rating_count: number;
  updated_at: string;
}

export interface StoreFollower {
  id: string;
  store_id: string;
  user_id: string;
  created_at: string;
}

export type HomeBannerPlacement = 'carousel' | 'promo';

export interface HomeBanner {
  id: string;
  placement: HomeBannerPlacement;
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

// Auth functions
export const authService = {
  async signUp(email: string, password: string, fullName: string, role: UserRole = 'client') {
    const client = useSupabase();
    
    // Determine redirect URL for email confirmation
    // Use web base URL if available (production), otherwise fallback
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    const emailRedirectTo = webBaseUrl 
      ? `${webBaseUrl}/auth/confirm`
      : 'http://localhost:3000';  // Fallback for development
    
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo,  // Tell Supabase where to redirect after confirmation
      },
    });
    if (error) throw error;
    return data;
  },

  async signInAnonymously() {
    const client = useSupabase();
    const fn = (client.auth as any)?.signInAnonymously;
    if (typeof fn !== 'function') {
      throw new Error('signInAnonymously not supported by current Supabase client');
    }
    const { data, error } = await fn.call(client.auth);
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const client = useSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signInWithGoogle(redirectUrl: string) {
    const client = useSupabase();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
      },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const client = useSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const client = useSupabase();
    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    return user;
  },

  async resetPassword(email: string) {
    const client = useSupabase();
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async resendSignupConfirmation(email: string) {
    const client = useSupabase();
    
    // Determine redirect URL for email confirmation
    // Use web base URL if available (production), otherwise fallback
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    const emailRedirectTo = webBaseUrl 
      ? `${webBaseUrl}/auth/confirm`
      : 'http://localhost:3000';  // Fallback for development
    
    const { data, error } = await client.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo,  // Tell Supabase where to redirect after confirmation
      },
    });
    if (error) throw error;
    return data;
  },

  async updatePassword(newPassword: string) {
    const client = useSupabase();
    const { error } = await client.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  },

  async updateEmail(newEmail: string) {
    const client = useSupabase();
    const { error } = await client.auth.updateUser({
      email: newEmail
    });
    if (error) throw error;
  },
};

export const homeBannerService = {
  async getActiveByPlacement(placement: HomeBannerPlacement): Promise<HomeBanner[]> {
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

// Store functions
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
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async incrementOrders(storeId: string) {
    const client = useSupabase();
    try {
      const { data: current } = await client
        .from('stores')
        .select('total_orders')
        .eq('id', storeId)
        .maybeSingle();
      
      const newCount = (current?.total_orders || 0) + 1;
      
      await client
        .from('stores')
        .update({ total_orders: newCount })
        .eq('id', storeId);
    } catch (e) {
      console.warn('Failed to increment store orders:', e);
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
    // Try primary query; if the DB doesn't accept ordering by total_orders (400),
    // fallback to ordering by created_at to avoid breaking the client.
    try {
      const { data, error } = await client
        .from('stores')
        .select('*')
        .eq('status', 'active')
        .eq('visible', true)
        // ordering options:
        // - 'score' : use precomputed store_score
        // - 'smart' : dynamic multi-field ordering (total_orders, rating_avg, view_count, verified, created_at)
        // - 'top'   : total_orders
        // - default : created_at
        .order(sort === 'score' ? 'store_score' : sort === 'top' ? 'total_orders' : sort === 'smart' ? 'total_orders' : 'created_at', { ascending: false })
        // additional secondary ordering for 'score'/'smart'
        .order((sort === 'score' || sort === 'smart') ? 'rating_avg' : 'verified', { ascending: false })
        .order((sort === 'score' || sort === 'smart') ? 'view_count' : 'created_at', { ascending: false })
        .order('verified', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data;
    } catch (e: any) {
      // If the error is a Bad Request (likely invalid order column), retry with created_at ordering
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
        // rethrow original error if fallback also fails
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


  // create a store using a specific plan record (trial or paid)
  async createWithPlan(userId: string, store: Partial<Store>, planId: string) {
    const plan = await planService.getById(planId);
    const now = new Date();
    let end: Date | null = null;
    
    // Use plan.months if available, otherwise fallback to trial_days
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

  // backward‑compat stub: call createWithPlan('trial')
  async createWithTrial(userId: string, store: Partial<Store>) {
    // assume there is a plan with name or id 'trial'
    try {
      const plans = await planService.getAll();
      const trial = plans.find(p => p.name.toLowerCase() === 'trial' || p.id === 'trial');
      if (trial) {
        return this.createWithPlan(userId, store, trial.id);
      }
    } catch {}
    // fallback to 7‑day hardcoded behavior
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

  // upgrade using a canonical plan id from the plans table
  async upgradeSubscription(storeId: string, planId: string) {
    const client = useSupabase();
    
    // 1. Fetch the store and the target plan
    const [storeRes, plan] = await Promise.all([
      client.from('stores').select('subscription_end, subscription_status, subscription_price').eq('id', storeId).single(),
      planService.getById(planId)
    ]);
    
    if (storeRes.error) throw storeRes.error;
    const store = storeRes.data;
    
    const now = new Date();
    let credit = 0;

    // 2. Calculate Credit from remaining days if current subscription is active
    if (store.subscription_status === 'active' && store.subscription_end) {
      const currentEnd = new Date(store.subscription_end);
      if (currentEnd > now) {
        const remainingMs = currentEnd.getTime() - now.getTime();
        const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        
        // We assume a 30-day billing cycle for the credit calculation
        const currentPrice = Number(store.subscription_price || 0);
        if (currentPrice > 0) {
          credit = Math.floor((currentPrice / 30) * remainingDays);
        }
      }
    }

    // 3. Calculate final price (New Price - Credit)
    const newPrice = Math.max(0, plan.price - credit);

    // 4. Calculate new end date (Today + Duration)
    // We restart the duration because the user is "paying" for a new full period (discounted)
    let end: Date | null = null;
    if (plan.months && plan.months > 0) {
      end = new Date(now.getTime() + plan.months * 30 * 24 * 60 * 60 * 1000);
    } else if (plan.trial_days && plan.trial_days > 0) {
      end = new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000);
    }

    // 5. Update the store
    const { data, error } = await client
      .from('stores')
      .update({
        subscription_plan: plan.name,
        subscription_price: newPrice, // Store the prorated price paid
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

  // Check if store has active subscription (not expired and visible)
  isSubscriptionActive(store: Store | null): boolean {
    if (!store) return false;
    // Subscription is active if: visible=true AND subscription_status != 'expired'
    return store.visible !== false && store.subscription_status !== 'expired';
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

export const storeFollowerService = {
  async isFollowing(storeId: string, userId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_followers')
      .select('id')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data?.id);
  },

  async follow(storeId: string, userId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('store_followers')
      .upsert(
        { store_id: storeId, user_id: userId },
        { onConflict: 'user_id,store_id', ignoreDuplicates: true }
      )
      .select('*')
      .single();
    if (error) throw error;
    return data as StoreFollower;
  },

  async unfollow(storeId: string, userId: string) {
    const client = useSupabase();
    const { error } = await client
      .from('store_followers')
      .delete()
      .eq('store_id', storeId)
      .eq('user_id', userId);
    if (error) throw error;
  },
};

// plan management types and service (moved out of storeService)
export interface Plan {
  id: string;
  name: string;
  price: number;
  duration?: string;   // e.g. "mois", "jours"
  months?: number;     // quantitative duration in months
  trial_days?: number; // free trial length
  product_limit?: number;
  has_caisse?: boolean;
  has_online_store?: boolean;
  features?: string[];
  status?: 'active' | 'inactive';
  created_at?: string;
}

export const planService = {
  async getAll() {
    const client = useSupabase();
    const { data, error } = await client.from('plans').select('*');
    if (error) throw error;
    return data as Plan[];
  },

  async getById(id: string) {
    const client = useSupabase();
    const { data, error } = await client.from('plans').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Plan;
  },

  async create(plan: Partial<Plan>) {
    const client = useSupabase();
    const { data, error } = await client.from('plans').insert(plan).select('*').single();
    if (error) throw error;
    return data as Plan;
  },

  async update(id: string, plan: Partial<Plan>) {
    const client = useSupabase();
    const { data, error } = await client.from('plans').update(plan).eq('id', id).select('*').single();
    if (error) throw error;
    return data as Plan;
  },

  async delete(id: string) {
    const client = useSupabase();
    const { error } = await client.from('plans').delete().eq('id', id);
    if (error) throw error;
  },
};

// Product functions
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

    // 🎯 Filtres intelligents
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

    // 🎯 Tri optimisé
    if (options.sortBy) {
      switch (options.sortBy) {
        case 'name_asc':
          query = query.order('name', { ascending: true });
          break;
        case 'name_desc':
          query = query.order('name', { ascending: false });
          break;
        case 'price_asc':
          query = query.order('price', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('price', { ascending: false });
          break;
        case 'stock_asc':
          query = query.order('stock', { ascending: true });
          break;
        case 'stock_desc':
          query = query.order('stock', { ascending: false });
          break;
        case 'date_asc':
          query = query.order('created_at', { ascending: true });
          break;
        case 'date_desc':
        default:
          query = query.order('created_at', { ascending: false });
          break;
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
    // For 'ranked' sort we compute a combined score client-side
    if (sort === 'ranked') {
      // fetch a reasonable window to rank (avoid fetching unlimited rows)
      const maxFetch = Math.max(200, pageSize * 10);
      const { data, error } = await client
        .from('products')
        .select('*, stores(name, logo_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(0, maxFetch - 1);
      if (error) throw error;

      // compute score: 0.5 * total_sales + 0.3 * view_count + 0.2 * freshness
      const now = Date.now();
      const scored = (data || []).map((p: any) => {
        const total_sales = Number(p.total_sales || 0);
        const view_count = Number(p.view_count || 0);
        const ageDays = Math.max(0, (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
        // freshness bonus: products within 30 days get linear bonus [0..1]
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
      query = query
        .order('view_count', { ascending: false })
        .order('created_at', { ascending: false });
    } else if (sort === 'sales' || sort === 'top') {
      // Prioritise products that actually sell, fallback to views and recency
      query = query
        .order('total_sales', { ascending: false })
        .order('view_count', { ascending: false })
        .order('created_at', { ascending: false });
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
      const { data: current } = await client
        .from('products')
        .select('view_count')
        .eq('id', productId)
        .maybeSingle();
      
      const newCount = (current?.view_count || 0) + 1;
      
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
      const [productRes, likesRes, salesRes] = await Promise.all([
        client.from('products').select('view_count').eq('id', productId).maybeSingle(),
        client.from('product_likes').select('id', { count: 'exact', head: true }).eq('product_id', productId),
        client.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', productId)
      ]);

      return {
        views: productRes.data?.view_count || 0,
        likes: likesRes.count || 0,
        sales: salesRes.count || 0
      };
    } catch (e) {
      console.error('Error fetching product stats:', e);
      return { views: 0, likes: 0, sales: 0 };
    }
  },

  async recordSale(productId: string, quantity = 1) {
    const client = useSupabase();
    try {
      const { data: current } = await client
        .from('products')
        .select('total_sales')
        .eq('id', productId)
        .maybeSingle();
      
      const newCount = (current?.total_sales || 0) + quantity;
      
      await client
        .from('products')
        .update({ total_sales: newCount })
        .eq('id', productId);
    } catch (e) {
      console.warn('Failed to record product sale:', e);
    }
  },
};

export const reviewService = {
  async getByProduct(productId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ProductReview[];
  },

  async create(review: Omit<ProductReview, 'id' | 'created_at'>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('product_reviews')
      .insert(review)
      .select('*')
      .single();
    if (error) throw error;
    return data as ProductReview;
  },
};

// Types et service pour l'historique de réapprovisionnement
export interface RestockHistory {
  id: string;
  product_id: string;
  quantity_added: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  restock_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export const restockService = {
  async create(restock: Omit<RestockHistory, 'id' | 'created_at'>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('restock_history')
      .insert(restock)
      .select('*')
      .single();
    if (error) throw error;
    return data as RestockHistory;
  },

  async getByProduct(productId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('restock_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as RestockHistory[];
  },

  async deleteByProduct(productId: string) {
    const client = useSupabase();
    const { error } = await client
      .from('restock_history')
      .delete()
      .eq('product_id', productId);
    if (error) throw error;
  },

  async deleteById(id: string) {
    const client = useSupabase();
    const { error } = await client
      .from('restock_history')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

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

// Order functions
export const orderService = {
  async create(order: Partial<Order>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .insert(order)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async getById(orderId: string, options?: { includeUser?: boolean; includeStore?: boolean }) {
    const client = useSupabase();
    const selectParts = ['*', 'order_items(*, products(*))'];
    if (options?.includeUser) selectParts.push('users(*)');
    if (options?.includeStore) selectParts.push('stores(*)');

    const { data, error } = await client
      .from('orders')
      .select(selectParts.join(', '))
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByUser(userId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .select('*, stores(*), users(*), order_items(*, products(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByStore(storeId: string, options?: { 
  includeUser?: boolean; 
  limit?: number; 
  cursor?: string;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
    const client = useSupabase();
    const select = options?.includeUser
      ? '*, users(*), order_items(*, products(*))'
      : '*, order_items(*, products(*))';
    
    const limit = options?.limit || 20;
    
    let query = client
      .from('orders')
      .select(select)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // +1 pour savoir s'il y a plus de données

    // 🎯 Cursor pagination (plus rapide que OFFSET)
    if (options?.cursor) {
      query = query.lt('created_at', options.cursor);
    }

    // 🎯 Filtrage intelligent
    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      query = query.or(`customer_name.ilike.%${options.search}%,customer_phone.ilike.%${options.search}%`);
    }

    if (options?.dateFrom) {
      query = query.gte('created_at', options.dateFrom);
    }

    if (options?.dateTo) {
      query = query.lte('created_at', options.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 🔄 Gestion du curseur et hasMore
    const hasMore = data.length > limit;
    const orders = hasMore ? data.slice(0, -1) : data;
    const nextCursor = orders.length > 0 ? orders[orders.length - 1].created_at : null;

    return {
      orders,
      hasMore,
      nextCursor,
      count: orders.length
    };
  },

  async updateStatus(id: string, status: OrderStatus) {
    const client = useSupabase();
    const { data: order, error } = await client
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select('*, order_items(*)')
      .single();
    
    if (error) throw error;

    // Trigger ranking updates if order is paid
    if (status === 'paid' && order) {
      try {
        await storeService.incrementOrders(order.store_id);
        if (order.order_items) {
          for (const item of order.order_items) {
            await productService.recordSale(item.product_id, item.quantity);
          }
        }
      } catch (e) {
        console.warn('Failed to update ranking stats after order payment:', e);
      }
    }

    return order;
  },
};


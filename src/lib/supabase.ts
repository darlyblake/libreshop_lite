import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseConfig } from '../config/theme';

// Initialize Supabase client only once
let supabaseClient: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { supabaseUrl, supabaseAnonKey } = supabaseConfig;
  
  // log the values loaded from config so it's easier to debug env issues
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    const keyLabel = supabaseAnonKey ? supabaseAnonKey.replace(/(.{5}).+(.{5})/, '$1…$2') : 'null';
    console.log(`Supabase config loaded url=${supabaseUrl} key=${keyLabel}`);
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
    },
  });
  supabaseClient = client;

  return supabaseClient;
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
  logo_url?: string;
  banner_url?: string;
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
  subscription_start?: string;
  subscription_end?: string;
  subscription_status?: 'trial' | 'active' | 'expired';
  product_limit?: number;
  visible?: boolean;
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
      .order('position', { ascending: true });
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
      .single();
    if (error) throw error;
    return data;
  },

  async getAll() {
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
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

  async getFeatured() {
    const client = useSupabase();
    const { data, error } = await client
      .from('stores')
      .select('*')
      .eq('status', 'active')
      .eq('visible', true)
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
    if (plan.trial_days && plan.trial_days > 0) {
      end = new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000);
    } else if (plan.months && plan.months > 0) {
      end = new Date(now.getTime() + plan.months * 30 * 24 * 60 * 60 * 1000);
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

  // upgrade using a canonical plan id from the plans table instead of
  // passing raw strings/durations from the caller. this ensures that the plan
  // metadata controlled by the admin is applied consistently.
  async upgradeSubscription(storeId: string, planId: string) {
    const client = useSupabase();
    // fetch plan, will throw if not found
    const p = await planService.getById(planId);
    const now = new Date();
    let end: Date | null = null;
    if (p.trial_days && p.trial_days > 0) {
      end = new Date(now.getTime() + p.trial_days * 24 * 60 * 60 * 1000);
    } else if (p.months && p.months > 0) {
      end = new Date(now.getTime() + p.months * 30 * 24 * 60 * 60 * 1000);
    }

    const { data, error } = await client
      .from('stores')
      .update({
        subscription_plan: p.name,
        subscription_start: now.toISOString(),
        subscription_end: end ? end.toISOString() : null,
        subscription_status: 'active',
        product_limit: p.product_limit || 0,
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
      .insert({ store_id: storeId, user_id: userId })
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

  async getAll() {
    const client = useSupabase();
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
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

  async search(query: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('products')
      .select('*, stores(*)')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .eq('is_active', true)
      .gt('stock', 0);
    if (error) throw error;
    return data;
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
      .single();
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

  async getByStore(storeId: string, options?: { includeUser?: boolean }) {
    const client = useSupabase();
    const select = options?.includeUser
      ? '*, users(*), order_items(*, products(*))'
      : '*, order_items(*, products(*))';
    const { data, error } = await client
      .from('orders')
      .select(select)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: OrderStatus) {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
};


import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseConfig } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

// Initialize Supabase client only once, preserving across hot reloads
const globalForSupabase = globalThis as unknown as {
  supabaseClient: SupabaseClient | null;
};

const getStorageAdapter = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: async (key: string) => {
        try { return Promise.resolve(window.localStorage.getItem(key)); }
        catch (error) { console.error(`[StorageAdapter] Error getting ${key}:`, error); return Promise.resolve(null); }
      },
      setItem: async (key: string, value: string) => {
        try { window.localStorage.setItem(key, value); return Promise.resolve(); }
        catch (error) { console.error(`[StorageAdapter] Error setting ${key}:`, error); return Promise.resolve(); }
      },
      removeItem: async (key: string) => {
        try { window.localStorage.removeItem(key); return Promise.resolve(); }
        catch (error) { console.error(`[StorageAdapter] Error removing ${key}:`, error); return Promise.resolve(); }
      },
    };
  }
  return AsyncStorage;
};

const getSupabaseClient = (): SupabaseClient | null => {
  if (globalForSupabase.supabaseClient) return globalForSupabase.supabaseClient;
  const { supabaseUrl, supabaseAnonKey } = supabaseConfig;

  if (!supabaseUrl || supabaseUrl.includes('your-project') || !supabaseAnonKey || supabaseAnonKey === 'YOUR_ANON_KEY') {
    console.warn('⚠️ Supabase credentials not configured. Using demo mode. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    return null;
  }
  if (typeof window !== 'undefined') {
    const urlPattern = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
    if (!urlPattern.test(supabaseUrl)) {
      console.warn('⚠️ Invalid Supabase URL format. Using demo mode. URL should be like: https://project-id.supabase.co');
      return null;
    }
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: getStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: typeof window !== 'undefined',
      lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => await fn(),
    },
  });
  globalForSupabase.supabaseClient = client;
  return client;
};

export const supabase = getSupabaseClient();

export const useSupabase = (): SupabaseClient => {
  if (!supabase) throw new Error('Supabase not initialized. Please configure your credentials in src/config/theme.ts');
  return supabase;
};

export type UserRole = 'client' | 'seller' | 'admin';
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  whatsapp_number?: string;
  role: UserRole;
  avatar_url?: string;
  address?: string;
  theme_preference?: 'light' | 'dark' | 'system';
  created_at: string;
}

export interface Store {
  id: string; user_id: string; name: string; slug: string; description?: string; category: string;
  store_type?: 'general' | 'restaurant' | 'bar' | 'hotel' | 'logement'; logo_url?: string; banner_url?: string;
  email?: string; phone?: string; whatsapp_number?: string; phone_number?: string; address?: string;
  country_id?: string; city_id?: string; website?: string; social?: Record<string, any>; verified?: boolean;
  promo_enabled?: boolean; promo_title?: string; promo_subtitle?: string; promo_image_url?: string;
  promo_target_type?: 'collection' | 'product' | 'url'; promo_target_id?: string; promo_target_url?: string;
  status: 'active' | 'suspended' | 'pending'; subscription_plan?: string; subscription_price?: number;
  subscription_start?: string; subscription_end?: string; subscription_status?: 'trial' | 'active' | 'expired' | 'cancelled' | null;
  billing_status?: 'pending' | 'paid' | 'failed'; cashier_active?: boolean; online_store_active?: boolean;
  analytics_active?: boolean; product_limit?: number; visible?: boolean; tax_rate?: number; shipping_price?: number;
  delivery_mode?: 'fixed' | 'km' | 'city'; delivery_price_km?: number; delivery_city_fees?: Record<string, number>;
  total_orders?: number; rating_avg?: number; rating_count?: number; products_count?: number;
  latitude?: number; longitude?: number; city?: string; location_set_at?: string;
  business_hours?: Record<string, { isOpen: boolean; open: string; close: string }>;
  is_paused?: boolean; announcement_banner?: string; announcement_banner_enabled?: boolean;
  announcement_popup?: string; announcement_popup_enabled?: boolean; version?: number; created_at: string;
}

export interface Product {
  id: string; store_id: string; collection_id: string; name: string; description?: string; price: number;
  compare_price?: number; cost_price?: number; stock: number; attributes?: Record<string, any>; reference?: string;
  images: string[]; is_active: boolean; is_online_sale: boolean; is_physical_sale: boolean; category?: string;
  discount_percent?: number; view_count?: number; featured?: boolean; condition?: string; created_at: string;
  stores?: { name: string; logo_url?: string; }; store_name?: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface ProductOption { id: string; product_id: string; name: string; values: string[]; created_at: string; updated_at?: string; }

export interface StoreReview {
  id: string;
  store_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at?: string;
}

export type OrderStatus = 'pending' | 'accepted' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentMethod = 'mobile_money' | 'card' | 'cash_on_delivery';
export interface Order { id: string; user_id: string; store_id: string; total_amount: number; status: OrderStatus; payment_method: PaymentMethod; payment_status: 'pending' | 'paid' | 'failed'; customer_name?: string; shipping_address?: string; customer_phone?: string; notes?: string; city?: string; latitude?: number; longitude?: number; created_at: string; updated_at?: string; tracking_number?: string; shipping_provider?: string; estimated_delivery_date?: string; issue_type?: 'out_of_stock' | 'resolved_partial' | 'waiting_restock' | null; issue_details?: Array<{ product_id: string; name: string; quantity: number; restock_date?: string }>; restock_status?: 'expected' | 'no_restock' | null; }
export interface OrderItem { id: string; order_id: string; product_id: string; quantity: number; price: number; cost_price?: number; product?: Product; }
export interface Category { id: string; name: string; slug: string; description?: string; icon?: string; parent_id?: string | null; status?: 'active' | 'inactive'; store_type?: 'general' | 'restaurant' | 'bar' | 'hotel' | 'logement'; attribute_schema?: any[]; order_index?: number; created_at?: string; updated_at?: string; }
export interface Collection { id: string; store_id: string; category_id?: string | null; name: string; description?: string; icon?: string; cover_color?: string; is_active: boolean; custom_attributes?: any[]; created_at: string; updated_at?: string; }
export interface StoreStats { store_id: string; followers_count: number; customers_count: number; rating_avg: number; rating_count: number; updated_at: string; }
export interface StoreFollower { id: string; store_id: string; user_id: string; created_at: string; }
export type HomeBannerPlacement = 'carousel' | 'promo';
export interface HomeBanner { id: string; placement: HomeBannerPlacement; }

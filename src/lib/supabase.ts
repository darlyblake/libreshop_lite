import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseConfig } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

// Initialize Supabase client only once, preserving across hot reloads
const globalForSupabase = globalThis as unknown as {
  supabaseClient: SupabaseClient | null;
};

/**
 * Storage adapter for web to use localStorage instead of AsyncStorage
 * AsyncStorage doesn't persist reliably on web between page reloads
 */
const getStorageAdapter = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: (key: string) => {
        try {
          return window.localStorage.getItem(key);
        } catch (error) {
          console.error(`[StorageAdapter] Error getting ${key}:`, error);
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          window.localStorage.setItem(key, value);
        } catch (error) {
          console.error(`[StorageAdapter] Error setting ${key}:`, error);
        }
      },
      removeItem: (key: string) => {
        try {
          window.localStorage.removeItem(key);
        } catch (error) {
          console.error(`[StorageAdapter] Error removing ${key}:`, error);
        }
      },
    };
  }
  // Fallback to AsyncStorage for native platforms
  return AsyncStorage;
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
      storage: getStorageAdapter(),
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
export const useSupabase = (): SupabaseClient => {
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
  cashier_active?: boolean;
  online_store_active?: boolean;
  analytics_active?: boolean;
  product_limit?: number;
  visible?: boolean;
  tax_rate?: number;
  shipping_fee?: number;
  total_orders?: number;
  rating_avg?: number;
  rating_count?: number;
  products_count?: number; // Calculé ou via trigger
  created_at: string;
  store_stats?: any;
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
  stores?: {
    name: string;
    logo_url?: string;
  };
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
export type OrderStatus = 'pending' | 'accepted' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
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

// Services moved to src/services/


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
  has_analytics?: boolean;
  features?: string[];
  status?: 'active' | 'inactive';
  created_at?: string;
}

// All services moved to src/services/



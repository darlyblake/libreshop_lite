/**
 * Store Types - Complete type system for store management
 * Re-exports Store, StoreStats, StoreFollower from src/lib/supabase
 * Adds validation and payload types for form handling
 */

// Inline type definitions (previously re-exported from ../lib/supabase, causing webpack warnings)
export interface Store {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string;
  store_type?: 'general' | 'restaurant' | 'bar' | 'hotel' | 'logement';
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
  status: 'active' | 'suspended' | 'pending';
  subscription_plan?: string;
  subscription_price?: number;
  subscription_start?: string;
  subscription_end?: string;
  subscription_status?: 'trial' | 'active' | 'expired';
  billing_status?: 'pending' | 'paid' | 'failed';
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  rating_avg?: number;
  rating_count?: number;
  products_count?: number;
  total_orders?: number;
  version?: number;
  created_at: string;
  store_stats?: any;
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

/**
 * Validation error structure
 */
export interface StoreValidationError {
  field: string;
  message: string;
}

/**
 * Payload for creating a new store
 */
export interface CreateStorePayload {
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  address?: string;
  city?: string;
  country?: string;
}

/**
 * Payload for updating a store
 */
export interface UpdateStorePayload {
  name?: string;
  slug?: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  social?: Record<string, string>;
  version?: number; // For optimistic locking
}

/**
 * Payload for updating store location
 */
export interface StoreLocationPayload {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
}

/**
 * Store with optional distance field for geo-queries
 */
export interface StoreWithDistance {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'pending';
  verified?: boolean;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  logo_url?: string;
  distance?: number; // Distance in kilometers from search origin
}

/**
 * Validate a store object for required fields and constraints
 * @param store The store object to validate
 * @param isPartialUpdate If true, only validates fields that are present in the object (for partial updates)
 * @returns Array of validation errors (empty if valid)
 */
export function validateStore(store: Record<string, any>, isPartialUpdate: boolean = false): StoreValidationError[] {
  const errors: StoreValidationError[] = [];

  // Name validation - only required for full updates (creation)
  if (!isPartialUpdate || store.name !== undefined) {
    if (!store.name) {
      errors.push({ field: 'name', message: 'Le nom est requis' });
    } else if (typeof store.name !== 'string') {
      errors.push({ field: 'name', message: 'Le nom doit être une chaîne de caractères' });
    } else if (store.name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Le nom doit contenir au moins 2 caractères' });
    } else if (store.name.length > 100) {
      errors.push({ field: 'name', message: 'Le nom doit contenir au maximum 100 caractères' });
    }
  }

  // Slug validation - only if present
  if (store.slug !== undefined) {
    if (typeof store.slug !== 'string') {
      errors.push({ field: 'slug', message: 'L\'URL personnalisée doit être une chaîne de caractères' });
    } else if (store.slug.length < 2) {
      errors.push({ field: 'slug', message: 'L\'URL personnalisée doit contenir au moins 2 caractères' });
    } else if (store.slug.length > 50) {
      errors.push({ field: 'slug', message: 'L\'URL personnalisée doit contenir au maximum 50 caractères' });
    } else if (!/^[a-z0-9-]+$/.test(store.slug)) {
      errors.push({ field: 'slug', message: 'L\'URL personnalisée doit contenir uniquement des lettres minuscules, des chiffres et des tirets' });
    }
  }

  // Description validation - only if present
  if (store.description !== undefined) {
    if (typeof store.description !== 'string') {
      errors.push({ field: 'description', message: 'La description doit être une chaîne de caractères' });
    } else if (store.description.length > 500) {
      errors.push({ field: 'description', message: 'La description doit contenir au maximum 500 caractères' });
    }
  }

  return errors;
}

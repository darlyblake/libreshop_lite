/**
 * Store Utilities - RLS validation, permission checks, helpers
 * Used by storeService to enforce authorization
 */

import { useSupabase } from '../lib/supabase';
import type { Store } from '../types/store';

/**
 * Get current authenticated user
 * ✅ Throws if not authenticated
 */
export async function getCurrentUser() {
  const client = useSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  
  if (error || !user) {
    throw new Error('Non authentifié - Impossible de procéder');
  }
  
  return user;
}

/**
 * Get store and verify ownership
 * ✅ Returns store if caller owns it
 * ✅ Throws if not found or not owned by caller
 */
export async function getStoreAndValidateOwnership(storeId: string): Promise<Store> {
  const client = useSupabase();
  const user = await getCurrentUser();
  
  const { data: store, error } = await client
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .eq('user_id', user.id)
    .single();
  
  if (error || !store) {
    throw new Error(`Boutique ${storeId} non trouvée ou vous n'êtes pas propriétaire`);
  }
  
  return store as Store;
}

/**
 * Check if user owns a store (returns boolean)
 * ✅ Safe - doesn't throw, just returns false if not owned
 */
export async function isStoreOwnedByUser(storeId: string, userId: string): Promise<boolean> {
  const client = useSupabase();
  
  const { data: store, error } = await client
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.error('[storeUtils] Error checking store ownership:', error);
    return false;
  }
  
  return !!store;
}

/**
 * Check if store subscription is active
 * ✅ Validates both status string and expiration date
 */
export function isSubscriptionActive(store: Partial<Store>): boolean {
  if (!store) return false;
  
  const status = String(store.subscription_status || '').toLowerCase();
  
  // If marked as expired/cancelled, it's not active
  if (status === 'expired' || status === 'cancelled') {
    return false;
  }
  
  // Check expiration date if exists
  if (store.subscription_end) {
    const end = new Date(store.subscription_end);
    if (!Number.isNaN(end.getTime()) && end < new Date()) {
      return false; // Expired
    }
  }
  
  // Active if status is 'active' or 'trial'
  return status === 'active' || status === 'trial';
}

/**
 * Check if store can create more products
 * ✅ Compares current count against limit
 */
export async function canStoreCreateProduct(storeId: string): Promise<boolean> {
  const client = useSupabase();
  
  const [storeRes, countRes] = await Promise.all([
    client.from('stores').select('product_limit').eq('id', storeId).single(),
    client.from('products').select('id', { count: 'exact' }).eq('store_id', storeId)
  ]);
  
  if (storeRes.error || countRes.error) {
    console.error('[storeUtils] Error checking product limit:', storeRes.error || countRes.error);
    return false;
  }
  
  const store = storeRes.data;
  const currentCount = countRes.count || 0;
  const limit = Number(store?.product_limit || 0);
  
  if (limit === -1 || limit <= 0) return true;
  return currentCount < limit;
}

/**
 * Get all stores owned by user
 * ✅ Enforces ownership at query level
 */
export async function getUserStores(userId: string): Promise<Store[]> {
  const client = useSupabase();
  
  const { data: stores, error } = await client
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[storeUtils] Error fetching user stores:', error);
    return [];
  }
  
  return (stores || []) as Store[];
}

/**
 * Verify slug is available for store
 * ✅ Checks for exact slug match
 */
export async function isSlugAvailable(slug: string, excludeStoreId?: string): Promise<boolean> {
  const client = useSupabase();
  
  let query = client.from('stores').select('id').eq('slug', slug);
  
  if (excludeStoreId) {
    query = query.neq('id', excludeStoreId);
  }
  
  const { data, error } = await query.maybeSingle();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[storeUtils] Error checking slug availability:', error);
    return false;
  }
  
  return !data;
}

/**
 * Update store with versioning
 * ✅ Prevents lost updates with optimistic locking
 */
export async function updateStoreWithVersion(
  storeId: string,
  updates: Record<string, any>,
  currentVersion?: number
): Promise<Store> {
  const client = useSupabase();
  
  // Build update object with version increment
  const updateData = {
    ...updates,
    version: (currentVersion || 0) + 1,
    updated_at: new Date().toISOString(),
  };
  
  let query = client
    .from('stores')
    .update(updateData)
    .eq('id', storeId);
  
  // If version provided, check for concurrent updates
  if (typeof currentVersion === 'number') {
    query = query.eq('version', currentVersion);
  }
  
  const { data: store, error } = await query
    .select('*')
    .single();
  
  if (error) {
    if (typeof currentVersion === 'number') {
      throw new Error('La boutique a été modifiée - veuillez recharger et réessayer');
    }
    throw error;
  }
  
  return store as Store;
}

/**
 * Get store with stats (handle array/object response)
 */
export async function getStoreWithStats(storeId: string): Promise<Store | null> {
  const client = useSupabase();
  
  const { data: store, error } = await client
    .from('stores')
    .select('*, store_stats(*)')
    .eq('id', storeId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  
  return store as Store;
}

/**
 * Get store with plan features synced
 * ✅ Merges plan defaults with store overrides
 */
export async function getStoreWithPlanFeatures(storeId: string): Promise<Store | null> {
  const client = useSupabase();
  
  const { data: store, error } = await client
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  // If store has a subscription_plan, sync features with plan
  if (store.subscription_plan) {
    try {
      const { data: plan } = await client
        .from('plans')
        .select('has_caisse, has_online_store, has_analytics')
        .eq('name', store.subscription_plan)
        .maybeSingle();
      
      if (plan) {
        // Plan features take precedence - use plan as source of truth
        store.cashier_active = plan.has_caisse;
        store.online_store_active = plan.has_online_store;
        store.analytics_active = plan.has_analytics;
      }
    } catch (err) {
      console.warn('[storeUtils] Failed to sync plan features:', err);
    }
  }
  
  return store as Store;
}

/**
 * Calculate distance between user coordinates and store
 * ✅ Returns null if store doesn't have location
 */
export function calculateDistanceToStore(
  userCoords: { latitude: number; longitude: number },
  store: Store
): number | null {
  if (!store.latitude || !store.longitude) return null;
  
  const R = 6371; // Earth radius in km
  const dLat = ((store.latitude - userCoords.latitude) * Math.PI) / 180;
  const dLon = ((store.longitude - userCoords.longitude) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((userCoords.latitude * Math.PI) / 180) *
      Math.cos((store.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

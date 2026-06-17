import { supabase } from '../lib/supabase';
import { User } from '../lib/supabase';
import { cacheManager } from '../utils/cacheManager';
import { cacheInvalidationManager } from '../utils/cacheInvalidationManager';
import { performanceMonitor } from '../utils/performanceMonitor';
import { CACHE_CONFIG } from '../utils/cacheConfig';

// ============================================================================
// DOMAIN INTERFACES (Phase 3a: Type Safety)
// ============================================================================

/**
 * UserProfile: Core user identity and contact information
 * Represents the primary user record in the users table
 */
export interface UserProfile extends User {
  version: number; // For optimistic locking (auto-incremented on updates)
  is_active: boolean; // Soft-delete flag (GDPR compliant)
  deleted_at: string | null; // Timestamp when user was soft-deleted
  deleted_by: string | null; // UUID of admin who deleted the user
  deletion_reason: string | null; // Reason for soft-delete (e.g., 'user_requested', 'spam')
}

/**
 * UserProfileUpdate: Partial update payload for profile mutations
 * Only updatable fields, excludes system fields (id, version, deleted_at, etc.)
 */
export interface UserProfileUpdate {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  whatsapp_number?: string;
  status?: string;
}

/**
 * UserAddress: User delivery address record
 * Supports multiple addresses per user with default selection
 */
export interface UserAddress {
  id: string; // UUID
  user_id: string; // FK to users(id)
  label: string; // e.g., 'Home', 'Work', 'Other'
  street: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string; // Delivery contact
  is_default: boolean; // Primary address for checkout
  created_at: string;
  updated_at: string;
}

/**
 * UserPreferences: User application preferences and settings
 * Stored as structured JSON for type-safe validation
 */
export interface UserPreferences {
  language?: 'en' | 'fr' | 'es'; // UI language
  currency?: string; // Preferred currency code
  notifications_enabled?: boolean; // Email/push notifications opt-in
  newsletter_subscribed?: boolean; // Marketing emails
  theme?: 'light' | 'dark' | 'auto'; // UI theme preference
  timezone?: string; // IANA timezone
}

/**
 * VersionConflict: Result when optimistic locking detects a concurrent update
 * Client should handle this by re-fetching and showing merge UI
 */
export interface VersionConflict {
  type: 'conflict';
  currentVersion: number;
  expectedVersion: number;
  reason: 'concurrent_update';
}

/**
 * SoftDeleteResult: Result of soft-deleting a user profile
 * Returns anonymized user record
 */
export interface SoftDeleteResult {
  id: string;
  email: string;
  is_active: boolean;
  deleted_at: string;
  deleted_by: string;
  deletion_reason: string;
}

// ============================================================================
// HELPER FUNCTION: Convert JSON object to JSONB for RPC
// ============================================================================

function toRpcJsonb(obj: Record<string, any>): Record<string, any> {
  // RPC expects object keys as strings (already handled)
  return obj;
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

export const userService = {
  /**
   * Get user profile by ID via secure RPC with cache
   * Uses SWR (Stale-While-Revalidate) pattern for optimal performance
   * RLS enforced server-side: Users see own profile, admins see any active profile
   * 
   * Phase 3c: Cache integration - returns cached data immediately, refreshes in background
   * 
   * @param userId - User ID to fetch
   * @returns Complete user profile with cache status
   * @throws Error if user not found or permission denied
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const startTime = performance.now();
    const cacheKey = `user_profile_${userId}`;

    try {
      // Use SWR pattern: return cached data immediately, refresh in background
      const { data, fromCache } = await cacheManager.swr<UserProfile>(
        cacheKey,
        async () => {
          // Fetcher function
          const { data, error } = await supabase!
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (error) throw new Error(`Failed to get profile: ${error.message}`);
          if (!data) {
            throw new Error('User profile not found or access denied');
          }

          return data as UserProfile;
        },
        {
          ttl: CACHE_CONFIG.userProfile.ttl,
          forceRefresh: false,
        }
      );

      // Record performance metric
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.getProfile',
        duration,
        cacheHit: fromCache,
        rpcUsed: !fromCache,
        timestamp: new Date(),
      });

      return data;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.getProfile',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  /**
   * Get current user's profile directly via secure RPC
   * RLS enforced server-side (no JS permission checks needed)
   * 
   * Safe for post-login scenarios where auth.getUser() may race
   * 
   * @param userId - Current user ID
   * @returns User profile or null if not found/deleted
   */
  async getSelfProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[userService.getSelfProfile] error:', error.message);
        return null;
      }
      if (!data) {
        return null;
      }
      return data as UserProfile;
    } catch (e) {
      console.warn('[userService.getSelfProfile] Unexpected error:', e);
      return null;
    }
  },

  /**
   * Get or create user profile on first login
   * - Fetches existing profile via secure RPC
   * - Creates new profile with OAuth metadata if not found
   * - Auto-updates full_name from OAuth if missing
   * 
   * @param userId - User ID from auth
   * @returns User profile
   * @throws Error if creation fails
   */
  async getOrCreateProfile(userId: string): Promise<UserProfile> {
    // Try to fetch existing profile (RLS enforced server-side)
    const { data, error } = await supabase!
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // If profile exists, return it
    if (!error && data) {
      const profile = data as UserProfile;
      
      // Check if full_name needs updating from OAuth metadata
      const authRes = await supabase!.auth.getUser();
      const user = authRes.data.user;
      const metadataFullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
      
      if (metadataFullName && (!profile.full_name || profile.full_name === profile.email?.split('@')[0] || profile.full_name === 'Acheteur' || profile.full_name === 'Vendeur')) {
        // Background update to not block login
        this.updateProfile(userId, { full_name: metadataFullName }).catch(console.error);
        return { ...profile, full_name: metadataFullName };
      }
      
      return profile;
    }

    // Profile doesn't exist, create it
    return await this.upsertProfile(userId, {});
  },

  /**
   * Upsert user profile (create or update)
   * Used during signup/login flows for profile creation
   * Direct table write (not via RPC, as RPC is read-only on insert)
   * 
   * @param userId - User ID from auth
   * @param updates - Partial profile updates
   * @returns Complete user profile
   * @throws Error if upsert fails
   */
  async upsertProfile(userId: string, updates: UserProfileUpdate): Promise<UserProfile> {
    const authRes = await supabase!.auth.getUser();
    const user = authRes.data.user;
    const email = user?.email;
    // Anonymous users do not have an email. Our `public.users.email` column is NOT NULL,
    // and `orders.user_id` has a FK to `public.users(id)`, so we must create a profile row
    // with a deterministic placeholder email.
    const resolvedEmail = email || `guest-${userId}@anon.local`;

    const metadataFullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    let fallbackFullName = '';
    if (email) {
      fallbackFullName = email.split('@')[0];
    }
    
    const resolvedFullName = updates.full_name || metadataFullName || fallbackFullName;

    const payload: UserProfile = {
      id: userId,
      email: resolvedEmail,
      full_name: resolvedFullName,
      version: 0,
      is_active: true,
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
      ...updates,
    } as UserProfile;

    const { data, error } = await supabase!
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as UserProfile;
  },

  /**
   * Update user profile with optimistic locking and cache invalidation
   * Uses RPC to increment version and detect conflicts
   * Automatically invalidates cache on successful update
   * 
   * Phase 3c: Includes cache invalidation and performance monitoring
   * 
   * RLS enforced server-side via RPC SECURITY DEFINER
   * Version conflict = concurrent update detected (return VersionConflict result)
   * 
   * @param userId - User ID to update
   * @param updates - Profile fields to update
   * @param expectedVersion - Current version (for conflict detection). If null, no version check
   * @returns Updated profile, or VersionConflict if mismatch detected
   * @throws Error if RPC fails or user not found
   */
  async updateProfile(
    userId: string,
    updates: UserProfileUpdate,
    expectedVersion?: number
  ): Promise<UserProfile | VersionConflict> {
    const startTime = performance.now();
    const cacheKey = `user_profile_${userId}`;

    try {
      // Build JSONB payload for RPC
      const jsonbUpdates = toRpcJsonb(updates);

      // Call versioned RPC (auto-increments version on success)
      const { data, error } = await supabase!.rpc(
        'update_user_profile_versioned',
        {
          p_user_id: userId,
          p_updates: jsonbUpdates,
          p_expected_version: expectedVersion ?? null,
        }
      );

      if (error) {
        throw new Error(`Failed to update profile: ${error.message}`);
      }

      // Check if RPC returned empty (version mismatch)
      if (!data || data.length === 0) {
        // Version conflict detected - record metric and return conflict
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric({
          operation: 'userService.updateProfile',
          duration,
          error: 'version_conflict',
          timestamp: new Date(),
        });

        // Fetch current profile to return current version
        const { data: currentProfile, error: fetchError } = await supabase!
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError || !currentProfile) {
          throw new Error('Failed to fetch current profile after conflict');
        }

        return {
          type: 'conflict',
          currentVersion: currentProfile.version,
          expectedVersion: expectedVersion ?? -1,
          reason: 'concurrent_update',
        };
      }

      // Success! Invalidate cache and record metric
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.updateProfile',
        duration,
        rpcUsed: true,
        timestamp: new Date(),
      });

      // Trigger cache invalidation event
      await cacheInvalidationManager.triggerInvalidation({
        type: 'userProfileUpdated',
        storeId: userId,
        timestamp: new Date(),
      });

      // Also invalidate the cached profile directly
      await cacheManager.remove(cacheKey);

      return data[0] as UserProfile;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.updateProfile',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  /**
   * Update user avatar URL
   * Uses versioned update with automatic conflict detection
   * 
   * @param userId - User ID
   * @param avatarUrl - New avatar URL (from Cloudinary or similar)
   * @param currentVersion - Current version for optimistic locking (optional)
   * @returns Updated profile or VersionConflict
   * @throws Error if permission denied
   */
  async uploadAvatar(
    userId: string,
    avatarUrl: string,
    currentVersion?: number
  ): Promise<UserProfile | VersionConflict> {
    return this.updateProfile(userId, { avatar_url: avatarUrl }, currentVersion);
  },

  /**
   * Update user phone number
   * Uses versioned update with automatic conflict detection
   * 
   * @param userId - User ID
   * @param phone - New phone number
   * @param currentVersion - Current version for optimistic locking (optional)
   * @returns Updated profile or VersionConflict
   * @throws Error if permission denied
   */
  async updatePhone(
    userId: string,
    phone: string,
    currentVersion?: number
  ): Promise<UserProfile | VersionConflict> {
    return this.updateProfile(userId, { phone }, currentVersion);
  },

  /**
   * Update user full name
   * Uses versioned update with automatic conflict detection
   * 
   * @param userId - User ID
   * @param fullName - New full name
   * @param currentVersion - Current version for optimistic locking (optional)
   * @returns Updated profile or VersionConflict
   * @throws Error if permission denied
   */
  async updateFullName(
    userId: string,
    fullName: string,
    currentVersion?: number
  ): Promise<UserProfile | VersionConflict> {
    return this.updateProfile(userId, { full_name: fullName }, currentVersion);
  },

  /**
   * Update WhatsApp number for customer support
   * Uses versioned update with automatic conflict detection
   * 
   * @param userId - User ID
   * @param whatsappNumber - New WhatsApp number
   * @param currentVersion - Current version for optimistic locking (optional)
   * @returns Updated profile or VersionConflict
   * @throws Error if permission denied
   */
  async updateWhatsappNumber(
    userId: string,
    whatsappNumber: string,
    currentVersion?: number
  ): Promise<UserProfile | VersionConflict> {
    return this.updateProfile(userId, { whatsapp_number: whatsappNumber }, currentVersion);
  },

  /**
   * Soft-delete user profile (GDPR compliance)
   * Anonymizes all PII and marks as inactive
   * Can only be called by the user themselves or an admin
   * 
   * @param userId - User ID to delete
   * @param reason - Reason for deletion (e.g., 'user_requested', 'spam')
   * @returns Anonymized user record
   * @throws Error if permission denied or user not found
   */
  async softDeleteUser(
    userId: string,
    reason: string = 'user_requested'
  ): Promise<SoftDeleteResult> {
    // Get current user (who is requesting deletion)
    const { data: { user: currentUser } } = await supabase!.auth.getUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Only user can delete themselves OR admin can delete anyone
    const currentRole = currentUser.user_metadata?.role || currentUser.app_metadata?.role;
    if (currentUser.id !== userId && currentRole !== 'admin') {
      throw new Error('Accès non autorisé - cannot delete another user');
    }

    // Call soft-delete RPC
    const { data, error } = await supabase!.rpc('soft_delete_user', {
      p_user_id: userId,
      p_deleted_by: currentUser.id,
      p_reason: reason,
    });

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('User not found or already deleted');
    }

    return data[0] as SoftDeleteResult;
  },

  // ============================================================================
  // ADDRESS MANAGEMENT (Phase 3c)
  // ============================================================================

  /**
   * Get all delivery addresses for a user
   * Uses cache with 30 minute TTL (addresses rarely change)
   * RLS ensures users only see their own addresses
   * 
   * @param userId - User ID
   * @returns List of user's addresses
   * @throws Error if access denied
   */
  async getAddresses(userId: string): Promise<UserAddress[]> {
    const startTime = performance.now();
    const cacheKey = `user_addresses_${userId}`;

    try {
      const { data, fromCache } = await cacheManager.swr<UserAddress[]>(
        cacheKey,
        async () => {
          const { data, error } = await supabase!
            .from('user_addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data as UserAddress[];
        },
        {
          ttl: CACHE_CONFIG.userAddresses.ttl,
        }
      );

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.getAddresses',
        duration,
        itemsReturned: data?.length ?? 0,
        cacheHit: fromCache,
        timestamp: new Date(),
      });

      return data;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.getAddresses',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  /**
   * Get a specific address by ID
   * RLS ensures users only access their own addresses
   * 
   * @param addressId - Address UUID
   * @param userId - User ID (for validation)
   * @returns Address details
   * @throws Error if not found or access denied
   */
  async getAddress(addressId: string, userId: string): Promise<UserAddress> {
    const startTime = performance.now();

    try {
      const { data, error } = await supabase!
        .from('user_addresses')
        .select('*')
        .eq('id', addressId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Address not found');

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.getAddress',
        duration,
        timestamp: new Date(),
      });

      return data as UserAddress;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.getAddress',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  /**
   * Create a new delivery address for user
   * Automatically invalidates the addresses cache
   * 
   * @param userId - User ID
   * @param address - Address data (without id, created_at, updated_at)
   * @returns Created address
   * @throws Error if creation fails
   */
  async createAddress(
    userId: string,
    address: Omit<UserAddress, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<UserAddress> {
    const startTime = performance.now();

    try {
      const { data, error } = await supabase!
        .from('user_addresses')
        .insert([
          {
            ...address,
            user_id: userId,
          },
        ])
        .select('*')
        .single();

      if (error) throw error;

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.createAddress',
        duration,
        timestamp: new Date(),
      });

      // Invalidate cache
      await cacheInvalidationManager.triggerInvalidation({
        type: 'userAddressesUpdated',
        storeId: userId,
        timestamp: new Date(),
      });

      return data as UserAddress;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.createAddress',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  /**
   * Update a delivery address
   * Automatically invalidates the addresses cache
   * 
   * @param addressId - Address UUID
   * @param userId - User ID (for validation)
   * @param updates - Address fields to update
   * @returns Updated address
   * @throws Error if not found or access denied
   */
  async updateAddress(
    addressId: string,
    userId: string,
    updates: Partial<Omit<UserAddress, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<UserAddress> {
    const startTime = performance.now();

    try {
      const { data, error } = await supabase!
        .from('user_addresses')
        .update(updates)
        .eq('id', addressId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Address not found');

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.updateAddress',
        duration,
        timestamp: new Date(),
      });

      // Invalidate cache
      await cacheInvalidationManager.triggerInvalidation({
        type: 'userAddressesUpdated',
        storeId: userId,
        timestamp: new Date(),
      });

      return data as UserAddress;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.updateAddress',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  /**
   * Delete a delivery address
   * Automatically invalidates the addresses cache
   * 
   * @param addressId - Address UUID
   * @param userId - User ID (for validation)
   * @throws Error if not found or access denied
   */
  async deleteAddress(addressId: string, userId: string): Promise<void> {
    const startTime = performance.now();

    try {
      // Prevent deleting the default address if it's the only one
      const currentAddresses = await this.getAddresses(userId);
      const addressToDelete = currentAddresses.find(a => a.id === addressId);
      
      if (!addressToDelete) {
        throw new Error('Address not found');
      }

      if (addressToDelete.is_default && currentAddresses.length === 1) {
        throw new Error('Cannot delete the only address. Please add another address first.');
      }

      // If deleting default address, promote another to default
      if (addressToDelete.is_default && currentAddresses.length > 1) {
        const nextDefault = currentAddresses.find(a => a.id !== addressId);
        if (nextDefault) {
          await this.setDefaultAddress(nextDefault.id, userId);
        }
      }

      const { error } = await supabase!
        .from('user_addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', userId);

      if (error) throw error;

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.deleteAddress',
        duration,
        timestamp: new Date(),
      });

      // Invalidate cache
      await cacheInvalidationManager.triggerInvalidation({
        type: 'userAddressesUpdated',
        storeId: userId,
        timestamp: new Date(),
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.deleteAddress',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  /**
   * Set a specific address as the default delivery address
   * Automatically invalidates the addresses cache
   * 
   * @param addressId - Address UUID to set as default
   * @param userId - User ID (for validation)
   * @returns Updated address
   * @throws Error if not found or access denied
   */
  async setDefaultAddress(addressId: string, userId: string): Promise<UserAddress> {
    const startTime = performance.now();

    try {
      // Get all addresses to reset is_default
      const addresses = await this.getAddresses(userId);
      
      // Verify address belongs to user
      const addressToSet = addresses.find(a => a.id === addressId);
      if (!addressToSet) {
        throw new Error('Address not found');
      }

      // Reset all addresses to not default
      const { error: resetError } = await supabase!
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);

      if (resetError) throw resetError;

      // Set this one as default
      const { data, error } = await supabase!
        .from('user_addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .select('*')
        .single();

      if (error) throw error;

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.setDefaultAddress',
        duration,
        timestamp: new Date(),
      });

      // Invalidate cache
      await cacheInvalidationManager.triggerInvalidation({
        type: 'userAddressesUpdated',
        storeId: userId,
        timestamp: new Date(),
      });

      return data as UserAddress;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.setDefaultAddress',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  // ============================================================================
  // USER PREFERENCES (Phase 3d)
  // ============================================================================

  /**
   * Récupérer les préférences utilisateur avec cache
   * Crée les préférences par défaut si elles n'existent pas
   * Utilise un cache de 10 minutes (changements peu fréquents)
   * 
   * @param userId - ID de l'utilisateur
   * @returns Préférences de l'utilisateur
   * @throws Erreur si accès refusé
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    const startTime = performance.now();
    const cacheKey = `user_preferences_${userId}`;

    try {
      const { data, fromCache } = await cacheManager.swr<UserPreferences>(
        cacheKey,
        async () => {
          const { data, error } = await supabase!.rpc('get_user_preferences', {
            p_user_id: userId,
          });

          if (error) throw new Error(`Erreur RPC: ${error.message}`);
          if (!data || data.length === 0) {
            throw new Error('Préférences non trouvées');
          }

          const prefs = data[0];
          return {
            language: prefs.language,
            currency: prefs.currency,
            theme: prefs.theme,
            timezone: prefs.timezone,
            notifications_enabled: prefs.notifications_enabled,
            newsletter_subscribed: prefs.newsletter_subscribed,
          } as UserPreferences;
        },
        {
          ttl: CACHE_CONFIG.userPreferences.ttl,
          forceRefresh: false,
        }
      );

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.getPreferences',
        duration,
        cacheHit: fromCache,
        rpcUsed: !fromCache,
        timestamp: new Date(),
      });

      return data;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.getPreferences',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  /**
   * Mettre à jour les préférences utilisateur avec lock optimiste
   * Détecte automatiquement les conflits de version concurrents
   * Invalide le cache après mise à jour réussie
   * 
   * Phase 3d: Intégration du cache et monitoring
   * 
   * @param userId - ID de l'utilisateur
   * @param updates - Champs de préférences à mettre à jour
   * @param expectedVersion - Version actuelle (pour détection de conflits)
   * @returns Préférences mises à jour ou VersionConflict
   * @throws Erreur si la RPC échoue
   */
  async updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>,
    expectedVersion?: number
  ): Promise<UserPreferences | VersionConflict> {
    const startTime = performance.now();
    const cacheKey = `user_preferences_${userId}`;

    try {
      // Convertir les mises à jour en JSONB
      const jsonbUpdates: Record<string, any> = {};
      
      if (updates.language !== undefined) jsonbUpdates.language = updates.language;
      if (updates.currency !== undefined) jsonbUpdates.currency = updates.currency;
      if (updates.theme !== undefined) jsonbUpdates.theme = updates.theme;
      if (updates.timezone !== undefined) jsonbUpdates.timezone = updates.timezone;
      if (updates.notifications_enabled !== undefined) jsonbUpdates.notifications_enabled = updates.notifications_enabled;
      if (updates.newsletter_subscribed !== undefined) jsonbUpdates.newsletter_subscribed = updates.newsletter_subscribed;

      // Appeler la RPC versionnée (auto-incrémente la version)
      const { data, error } = await supabase!.rpc(
        'update_user_preferences',
        {
          p_user_id: userId,
          p_updates: jsonbUpdates,
          p_expected_version: expectedVersion ?? null,
        }
      );

      if (error) {
        throw new Error(`Erreur mise à jour: ${error.message}`);
      }

      // Vérifier si RPC retourna une ligne vide (version conflict)
      if (!data || data.length === 0) {
        // Conflit de version détecté
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric({
          operation: 'userService.updatePreferences',
          duration,
          error: 'version_conflict',
          timestamp: new Date(),
        });

        // Récupérer la version actuelle
        const { data: currentPrefs } = await supabase!.rpc(
          'get_user_preferences',
          { p_user_id: userId }
        );

        if (!currentPrefs || currentPrefs.length === 0) {
          throw new Error('Impossible de récupérer les préférences actuelles');
        }

        return {
          type: 'conflict',
          currentVersion: currentPrefs[0].version,
          expectedVersion: expectedVersion ?? -1,
          reason: 'concurrent_update',
        };
      }

      // Succès! Invalider le cache et enregistrer la métrique
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.updatePreferences',
        duration,
        rpcUsed: true,
        timestamp: new Date(),
      });

      // Déclencher invalidation du cache
      await cacheInvalidationManager.triggerInvalidation({
        type: 'userPreferencesUpdated',
        storeId: userId,
        timestamp: new Date(),
      });

      // Invalider aussi directement
      await cacheManager.remove(cacheKey);

      const prefs = data[0];
      return {
        language: prefs.language,
        currency: prefs.currency,
        theme: prefs.theme,
        timezone: prefs.timezone,
        notifications_enabled: prefs.notifications_enabled,
        newsletter_subscribed: prefs.newsletter_subscribed,
      } as UserPreferences;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.updatePreferences',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  /**
   * Réinitialiser les préférences aux valeurs par défaut
   * Invalide le cache après réinitialisation
   * 
   * @param userId - ID de l'utilisateur
   * @returns Préférences réinitialisées
   * @throws Erreur si l'utilisateur n'existe pas
   */
  async resetPreferences(userId: string): Promise<UserPreferences> {
    const startTime = performance.now();
    const cacheKey = `user_preferences_${userId}`;

    try {
      const { data, error } = await supabase!.rpc('reset_user_preferences', {
        p_user_id: userId,
      });

      if (error) {
        throw new Error(`Erreur réinitialisation: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Utilisateur non trouvé');
      }

      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.resetPreferences',
        duration,
        timestamp: new Date(),
      });

      // Invalider le cache
      await cacheInvalidationManager.triggerInvalidation({
        type: 'userPreferencesUpdated',
        storeId: userId,
        timestamp: new Date(),
      });

      await cacheManager.remove(cacheKey);

      const prefs = data[0];
      return {
        language: prefs.language,
        currency: prefs.currency,
        theme: prefs.theme,
        timezone: prefs.timezone,
        notifications_enabled: prefs.notifications_enabled,
        newsletter_subscribed: prefs.newsletter_subscribed,
      } as UserPreferences;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'userService.resetPreferences',
        duration,
        error: (error as Error).message,
        timestamp: new Date(),
      });
      throw error;
    }
  },

  // ============================================================================
  // PHASE 3C: Cache Management Functions (Implemented)
  // ============================================================================

  /**
   * Get current cache statistics for user profiles
   * Returns real cache hit/miss rates from performance monitor
   * 
   * @returns Cache stats including hit rate, size, TTL
   */
  async getUserCacheStats(): Promise<{
    hitRate: number;
    missRate: number;
    totalRequests: number;
    cacheSize: number;
    avgTTL: number;
  }> {
    // Get stats from performance monitor for user service operations
    const stats = performanceMonitor.getStats('userService.getProfile');
    
    return {
      hitRate: stats?.cacheHitRate ?? 0,
      missRate: 100 - (stats?.cacheHitRate ?? 0),
      totalRequests: stats?.count ?? 0,
      cacheSize: 0, // Would require AsyncStorage inspection
      avgTTL: CACHE_CONFIG.userProfile.ttl / 1000, // in seconds
    };
  },

  /**
   * Warm up user cache on login
   * Pre-loads user profile into cache to improve first-page performance
   * Uses SWR pattern so cached data is immediately available
   * 
   * @param userId - User ID to pre-load
   * @returns Cached user profile
   */
  async warmUserCacheOnLogin(userId: string): Promise<UserProfile> {
    // getProfile already uses cacheManager.swr, so this preloads the cache
    return this.getProfile(userId);
  },

  /**
   * Subscribe to user cache invalidation events
   * Allows components to react to profile changes in real-time
   * 
   * @param callback - Function called when any user cache is invalidated
   * @returns Unsubscribe function
   */
  subscribeToUserCacheEvents(
    callback: (event: { type: string; userId?: string; timestamp: Date }) => void
  ): () => void {
    // Subscribe to invalidation manager
    return cacheInvalidationManager.subscribe((event: any) => {
      // Filter for user-related events
      if (
        event.type === 'userProfileUpdated' ||
        event.type === 'userAddressesUpdated' ||
        event.type === 'userPreferencesUpdated' ||
        event.type === 'userDeleted'
      ) {
        callback({
          type: event.type,
          userId: event.storeId,
          timestamp: event.timestamp,
        });
      }
    });
  },
};


/**
 * addressService.ts
 *
 * Gestion des adresses de livraison des clients.
 * Toutes les adresses sont stockées dans la table Supabase `user_addresses`
 * pour être accessibles depuis n'importe quel appareil après connexion Google.
 *
 * Pattern : DB en source de vérité + AsyncStorage en cache local (rapidité).
 */
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Address {
  id: string;
  user_id: string;
  label: string;
  city: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  note?: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export type AddressInput = Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

const LOCAL_CACHE_KEY = (userId: string) => `@libreshop_addresses_${userId}`;
const MIGRATION_FLAG = (userId: string) => `@libreshop_addr_migrated_${userId}`;

export const addressService = {
  /**
   * Récupère toutes les adresses d'un utilisateur depuis Supabase.
   * Met à jour le cache local automatiquement.
   */
  async getByUser(userId: string): Promise<Address[]> {
    const { data, error } = await supabase!
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    const list = data || [];
    // Update local cache silently
    AsyncStorage.setItem(LOCAL_CACHE_KEY(userId), JSON.stringify(list)).catch(() => {});
    return list;
  },

  /**
   * Retourne les adresses depuis le cache local (pour affichage instantané),
   * puis lance une mise à jour depuis la DB en arrière-plan.
   */
  async getFromCacheThenDB(
    userId: string,
    onUpdate: (addresses: Address[]) => void
  ): Promise<Address[]> {
    // 1. Retourner le cache local immédiatement
    let cachedList: Address[] = [];
    try {
      const cached = await AsyncStorage.getItem(LOCAL_CACHE_KEY(userId));
      if (cached) {
        cachedList = JSON.parse(cached);
      }
    } catch {}

    // 2. Fetch depuis la DB en arrière-plan et notifier
    this.getByUser(userId)
      .then(onUpdate)
      .catch((e) => console.warn('[addressService] BG sync failed:', e));

    return cachedList;
  },

  /**
   * Ajoute une nouvelle adresse dans Supabase.
   */
  async add(userId: string, input: AddressInput): Promise<Address> {
    // Si c'est la première adresse ou si is_default = true, reset les autres
    if (input.is_default) {
      await supabase!
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { data, error } = await supabase!
      .from('user_addresses')
      .insert({ ...input, user_id: userId })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Met à jour une adresse existante.
   */
  async update(id: string, userId: string, input: Partial<AddressInput>): Promise<Address> {
    if (input.is_default) {
      await supabase!
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { data, error } = await supabase!
      .from('user_addresses')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Définit une adresse comme adresse par défaut.
   */
  async setDefault(id: string, userId: string): Promise<void> {
    // Reset toutes les adresses de cet utilisateur
    await supabase!
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId);

    // Puis activer celle-ci
    const { error } = await supabase!
      .from('user_addresses')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * Supprime une adresse.
   */
  async remove(id: string, userId: string): Promise<void> {
    const { error } = await supabase!
      .from('user_addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * Migration one-shot : transfère les adresses du AsyncStorage local vers Supabase.
   * Ne s'exécute qu'une seule fois par utilisateur (flag en AsyncStorage).
   * Retourne true si la migration a eu lieu, false si déjà faite.
   */
  async migrateFromLocal(userId: string): Promise<boolean> {
    try {
      const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_FLAG(userId));
      if (alreadyMigrated === 'true') return false;

      const localKey = `@libreshop_addresses_${userId}`;
      const stored = await AsyncStorage.getItem(localKey);
      if (!stored) {
        // Rien à migrer, marquer comme fait quand même
        await AsyncStorage.setItem(MIGRATION_FLAG(userId), 'true');
        return false;
      }

      const localAddresses: any[] = JSON.parse(stored);
      if (localAddresses.length === 0) {
        await AsyncStorage.setItem(MIGRATION_FLAG(userId), 'true');
        return false;
      }

      // Vérifier si la DB contient déjà des adresses (ex: autre appareil déjà migré)
      const { data: existing } = await supabase!
        .from('user_addresses')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (existing && existing.length > 0) {
        // La DB a déjà des données, ne pas dupliquer
        await AsyncStorage.setItem(MIGRATION_FLAG(userId), 'true');
        return false;
      }

      // Insérer toutes les adresses locales dans Supabase
      const toInsert = localAddresses.map((addr: any) => ({
        user_id: userId,
        label: addr.label || 'Maison',
        city: addr.city || '',
        address: addr.address || '',
        latitude: addr.latitude || null,
        longitude: addr.longitude || null,
        note: addr.note || null,
        is_default: addr.is_default || false,
      }));

      const { error } = await supabase!
        .from('user_addresses')
        .insert(toInsert);

      if (error) throw error;

      // Marquer la migration comme complète
      await AsyncStorage.setItem(MIGRATION_FLAG(userId), 'true');
      console.log(`[addressService] Migrated ${toInsert.length} address(es) for user ${userId}`);
      return true;
    } catch (e) {
      console.warn('[addressService] Migration failed (non-fatal):', e);
      return false;
    }
  },

  /**
   * Vide le cache local uniquement (ne touche pas la DB).
   */
  async clearLocalCache(userId: string): Promise<void> {
    await AsyncStorage.removeItem(LOCAL_CACHE_KEY(userId));
  },
};

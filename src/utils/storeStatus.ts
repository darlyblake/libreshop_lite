import { Store } from '../lib/supabase';

export type StoreStatus = {
  isOpen: boolean;
  reason?: 'paused' | 'schedule' | 'manual';
  nextOpening?: string;
};

/**
 * Checks if a store is currently open based on its schedule and pause status.
 */
export const getStoreStatus = (store: Partial<Store>): StoreStatus => {
  // 1. La vente en ligne est bloquée UNIQUEMENT si la boutique est mise en pause manuellement
  if (store.is_paused) {
    return { isOpen: false, reason: 'paused' };
  }

  // Les horaires d'ouverture (business_hours) n'affectent plus la possibilité de commander en ligne
  return { isOpen: true };
};

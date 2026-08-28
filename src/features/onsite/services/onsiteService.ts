/**
 * src/features/onsite/services/onsiteService.ts
 * Service de validation des tokens QR et de récupération du contexte table.
 * Appelle la RPC Supabase validate_table_qr_token (à créer côté backend).
 */

import { supabase } from '../../../lib/supabase';
import { OnsiteTableContext, QrTokenValidationResult } from '../types';

export const onsiteService = {
  /**
   * Valide un token QR et retourne le contexte de la table.
   * Le backend résout : token → store → table.
   * Le frontend ne génère jamais lui-même le storeId/tableId.
   */
  async validateQrToken(token: string): Promise<OnsiteTableContext> {
    if (!supabase) throw new Error('Supabase non initialisé.');
    if (!token || token.trim() === '') throw new Error('Token QR manquant.');

    const { data, error } = await supabase.rpc('validate_table_qr_token', {
      p_token: token,
    });

    if (error) {
      console.error('[OnsiteService] Erreur RPC validate_table_qr_token:', error);
      throw new Error('QR invalide ou expiré.');
    }

    const result = data as QrTokenValidationResult;

    if (!result?.valid) {
      switch (result?.error) {
        case 'table_disabled':
          throw new Error('Cette table n\'est plus disponible.');
        case 'store_disabled':
          throw new Error('Cet établissement n\'est pas disponible.');
        default:
          throw new Error('QR invalide ou expiré.');
      }
    }

    if (!result.store_id || !result.table_id || !result.table_number) {
      throw new Error('Données de table incomplètes.');
    }

    return {
      token,
      storeId: result.store_id,
      storeName: result.store_name || '',
      tableId: result.table_id,
      tableNumber: result.table_number,
      isActive: result.is_active,
    };
  },

  /**
   * Liste les tables d'un store depuis Supabase (pour le dashboard vendeur).
   */
  async listTables(storeId: string) {
    if (!supabase) throw new Error('Supabase non initialisé.');

    const { data, error } = await supabase
      .from('pos_tables')
      .select('*')
      .eq('store_id', storeId)
      .order('table_number', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Régénère le token QR d'une table via RPC sécurisée.
   * Vérifie côté backend que l'appelant est propriétaire de la boutique.
   */
  async regenerateTableQr(tableId: string): Promise<string> {
    if (!supabase) throw new Error('Supabase non initialisé.');

    const { data, error } = await supabase.rpc('regenerate_table_qr_token', {
      p_table_id: tableId,
    });

    if (error) {
      if (error.code === '42501') throw new Error('Non autorisé à modifier cette table.');
      throw error;
    }

    return data as string;
  },

  /**
   * Active ou désactive une table.
   */
  async setTableActive(tableId: string, isActive: boolean): Promise<void> {
    if (!supabase) throw new Error('Supabase non initialisé.');

    const { error } = await supabase
      .from('pos_tables')
      .update({ is_active: isActive })
      .eq('id', tableId);

    if (error) {
      if (error.code === '42501') throw new Error('Non autorisé à modifier cette table.');
      throw error;
    }
  },
};

import { useSupabase } from '../lib/supabase';
import { productService } from './productService';
import { accountingService } from './accountingService';

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'shipped' | 'received' | 'completed' | 'cancelled';

export interface ProductReturn {
  id: string;
  order_id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  reason: string;
  status: ReturnStatus;
  refund_amount: number;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  updated_at?: string;
  products?: {
    name: string;
    images: string[];
  };
}

export const returnService = {
  // --- Actions Client ---
  
  /**
   * Créer une demande de retour
   */
  async requestReturn(returnRow: Partial<ProductReturn>) {
    const { data, error } = await useSupabase()
      .from('returns')
      .insert({
        ...returnRow,
        status: 'requested',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as ProductReturn;
  },

  /**
   * Récupérer les retours d'un client
   */
  async getUserReturns(userId: string) {
    const { data, error } = await useSupabase()
      .from('returns')
      .select('*, products(name, images), orders(id, customer_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as ProductReturn[];
  },

  // --- Actions Vendeur ---

  /**
   * Récupérer tous les retours d'une boutique
   */
  async getStoreReturns(storeId: string) {
    const { data, error } = await useSupabase()
      .from('returns')
      .select('*, products(name, images), orders(id, customer_name, customer_phone)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as ProductReturn[];
  },

  /**
   * Mettre à jour le statut d'un retour
   * Gère automatiquement le stock et la comptabilité selon le statut
   */
  async updateReturnStatus(returnId: string, status: ReturnStatus, notes?: string) {
    const supabase = useSupabase();
    
    // 1. Récupérer les données actuelles du retour
    const { data: currentReturn, error: fetchError } = await supabase
      .from('returns')
      .select('*')
      .eq('id', returnId)
      .single();
    
    if (fetchError) throw fetchError;

    // 2. Logique spécifique selon le nouveau statut
    
    // Si le produit est REÇU : on réintègre le stock
    if (status === 'received' && currentReturn.status !== 'received') {
      await productService.updateStock(currentReturn.product_id, currentReturn.quantity);
    }

    // Si le retour est TERMINÉ : on enregistre le remboursement comptable
    if (status === 'completed' && currentReturn.status !== 'completed') {
      await accountingService.recordRefund({
        store_id: currentReturn.store_id,
        order_id: currentReturn.order_id,
        amount: currentReturn.refund_amount,
        reason: `Retour: ${currentReturn.reason}`
      });
    }

    // 3. Mise à jour en base de données
    const { data, error } = await supabase
      .from('returns')
      .update({ 
        status, 
        updated_at: new Date().toISOString()
      })
      .eq('id', returnId)
      .select()
      .single();

    if (error) throw error;
    return data as ProductReturn;
  },

  /**
   * Statistiques des retours pour le dashboard
   */
  async getReturnStats(storeId: string) {
    const returns = await this.getStoreReturns(storeId);
    return {
      pending: returns.filter(r => r.status === 'requested').length,
      approved: returns.filter(r => r.status === 'approved' || r.status === 'shipped').length,
      completed: returns.filter(r => r.status === 'completed').length,
      totalRefunded: returns
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.refund_amount || 0), 0)
    };
  }
};

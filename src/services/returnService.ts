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
    id?: string;
    name: string;
    images: string[];
    reference?: string;
    price?: number;
  };
}

export const returnService = {
  // --- Actions Client ---
  
  /**
   * Créer une demande de retour
   */
  async requestReturn(returnRow: Partial<ProductReturn>) {
    const supabase = useSupabase();
    const { data, error } = await supabase
      .from('returns')
      .insert({
        ...returnRow,
        status: 'requested',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;

    // 🔥 NOTIFIER LE VENDEUR DE LA NOUVELLE DEMANDE DE RETOUR
    if (data.store_id) {
      try {
        const { data: storeData } = await supabase
          .from('stores')
          .select('user_id, name')
          .eq('id', data.store_id)
          .single();
          
        if (storeData && storeData.user_id) {
          // Import dynamique pour éviter les dépendances circulaires au besoin
          const { notificationService } = require('./notificationService');
          await notificationService.create({
            user_id: storeData.user_id,
            title: 'Nouvelle demande de retour',
            body: `Un client a demandé un retour pour la commande #${(data.order_id || '').substring(0, 8)}.`,
            type: 'system',
            targetRole: 'seller',
            data: { returnId: data.id, orderId: data.order_id, action: 'return_requested' }
          });
        }
      } catch (err) {
        console.error('[ReturnService] Impossible de notifier le vendeur pour le retour:', err);
      }
    }

    return data as ProductReturn;
  },

  /**
   * Récupérer les retours d'un client
   */
  async getUserReturns(userId: string) {
    const { data, error } = await useSupabase()
      .from('returns')
      .select('*, products(*), orders(id, customer_name, notes, payment_method)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as ProductReturn[];
  },

  // --- Actions Vendeur ---

  /**
   * Créer un retour directement depuis la caisse (déjà remboursé)
   */
  async createPosReturn(returnRow: Partial<ProductReturn>) {
    const { data, error } = await useSupabase()
      .from('returns')
      .insert({
        ...returnRow,
        status: 'completed',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as ProductReturn;
  },

  /**
   * Récupérer tous les retours d'une boutique
   */
  async getStoreReturns(storeId: string) {
    const { data, error } = await useSupabase()
      .from('returns')
      .select('*, products(*), orders(id, customer_name, customer_phone, notes, payment_method)')
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
    
    // 1. Récupérer les données actuelles du retour + infos produit + client
    const { data: currentReturn, error: fetchError } = await supabase
      .from('returns')
      .select('*, products(name), orders(user_id, customer_name)')
      .eq('id', returnId)
      .single();
    
    if (fetchError) throw fetchError;

    const { notificationService } = require('./notificationService');
    const productName = (currentReturn as any).products?.name || 'le produit';
    const orderRef = `#${currentReturn.order_id.slice(0, 8)}`;
    const clientUserId = (currentReturn as any).orders?.user_id;

    // 2. Logique spécifique selon le nouveau statut

    // ✅ ACCEPTÉ : Notif client + enregistrement immédiat dans refunds pour traçabilité
    if (status === 'approved' && currentReturn.status !== 'approved') {
      // Notifier le client
      if (clientUserId) {
        await notificationService.create({
          user_id: clientUserId,
          title: '✅ Retour accepté',
          body: `Votre demande de retour pour "${productName}" (commande ${orderRef}) a été acceptée. Renvoyez le produit au vendeur.`,
          type: 'return',
          targetRole: 'client',
          data: { returnId, orderId: currentReturn.order_id, action: 'return_approved' }
        });
      }

      // Enregistrement comptable préventif : dette de remboursement à payer
      await accountingService.recordRefund({
        store_id: currentReturn.store_id,
        order_id: currentReturn.order_id,
        amount: currentReturn.refund_amount,
        reason: `Retour accepté: ${productName} — Commande ${orderRef}${notes ? ` (${notes})` : ''}`,
      });
    }

    // 📦 REÇU : Réintégration du stock + Notif client
    if (status === 'received' && currentReturn.status !== 'received') {
      await productService.updateStock(currentReturn.product_id, currentReturn.quantity);

      if (clientUserId) {
        await notificationService.create({
          user_id: clientUserId,
          title: '📦 Produit reçu',
          body: `Le vendeur a bien reçu "${productName}" retourné. Votre remboursement de ${currentReturn.refund_amount.toLocaleString()} FCFA va être traité.`,
          type: 'return',
          targetRole: 'client',
          data: { returnId, orderId: currentReturn.order_id, action: 'return_received' }
        });
      }
    }

    // 💰 TERMINÉ : Enregistrement comptable final + Notif client
    if (status === 'completed' && currentReturn.status !== 'completed') {
      await accountingService.recordRefund({
        store_id: currentReturn.store_id,
        order_id: currentReturn.order_id,
        amount: currentReturn.refund_amount,
        reason: `Remboursement confirmé: ${productName} — Commande ${orderRef}`,
      });

      if (clientUserId) {
        await notificationService.create({
          user_id: clientUserId,
          title: '💰 Remboursement confirmé',
          body: `Votre remboursement de ${currentReturn.refund_amount.toLocaleString()} FCFA pour "${productName}" a été confirmé par le vendeur.`,
          type: 'return',
          targetRole: 'client',
          data: { returnId, orderId: currentReturn.order_id, action: 'return_completed' }
        });
      }
    }

    // ❌ REFUSÉ : Notif client
    if (status === 'rejected' && currentReturn.status !== 'rejected') {
      if (clientUserId) {
        await notificationService.create({
          user_id: clientUserId,
          title: '❌ Retour refusé',
          body: `Votre demande de retour pour "${productName}" (commande ${orderRef}) a été refusée par le vendeur.${notes ? ` Motif : ${notes}` : ''}`,
          type: 'return',
          targetRole: 'client',
          data: { returnId, orderId: currentReturn.order_id, action: 'return_rejected' }
        });
      }
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

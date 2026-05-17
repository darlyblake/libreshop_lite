import { useSupabase } from '../lib/supabase';
import { productService } from './productService';
import { stockMovementService } from './stockMovementService';
import { accountingService } from './accountingService';

// Getter sécurisé pour s'assurer que supabase n'est jamais null (résout ts(18047))
const getSupabase = () => useSupabase();

// Types pour les remboursements
export interface RefundRequest {
  orderId: string;
  productId?: string;
  amount: number;
  reason: string;
  type: 'full' | 'partial';
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  items?: RefundItem[];
}

export interface RefundItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  refundAmount: number;
}

export interface Refund {
  id: string;
  orderId: string;
  orderDate: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  amount: number;
  reason: string;
  type: 'full' | 'partial';
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  items: RefundItem[];
  processedAt?: string;
  processedBy?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface RefundReason {
  id: string;
  reason: string;
  description?: string;
  isActive: boolean;
  category: 'product' | 'delivery' | 'service' | 'other';
}

export const refundService = {
  // Créer une demande de remboursement
  async createRefund(request: RefundRequest): Promise<Refund> {
    const supabase = getSupabase();
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, store_id')
        .eq('id', request.orderId)
        .single();

      if (orderError) throw orderError;

      const { data, error } = await supabase
        .from('refunds')
        .insert({
          order_id: request.orderId,
          store_id: order.store_id,
          amount: request.amount,
          reason: request.reason,
          type: request.type,
          status: 'pending',
          items: request.items,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return this.mapToRefund(data);
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  },

  // Approuver un remboursement
  async approveRefund(refundId: string, processedBy: string, notes?: string): Promise<Refund> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('refunds')
        .update({
          status: 'approved',
          processed_by: processedBy,
          notes: notes,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundId)
        .select()
        .single();

      if (error) throw error;

      // Mettre à jour le statut de la commande si remboursement complet
      if (data.type === 'full') {
        await supabase
          .from('orders')
          .update({ status: 'refunded' })
          .eq('id', data.order_id);
      }

      // 1. Remettre les produits retournés en stock et enregistrer le mouvement
      const items = data.items || [];
      for (const item of items) {
        try {
          const prodId = item.productId || item.product_id;
          if (prodId) {
            const product = await productService.getById(prodId);
            if (product) {
              const currentStock = product.stock || 0;
              const quantityReturned = Number(item.quantity || 1);
              
              await stockMovementService.create({
                product_id: prodId,
                quantity_changed: quantityReturned,
                previous_stock: currentStock,
                new_stock: currentStock + quantityReturned,
                type: 'return',
                reason: `Retour commande #${data.order_id?.slice(0, 8)}`,
                notes: notes,
                created_by: processedBy,
              });
            }
          }
        } catch (stockErr) {
          console.error(`[RefundService] Error restoring stock for item:`, stockErr);
        }
      }

      // 2. Enregistrer l'opération comptable
      try {
        await accountingService.recordRefund({
          order_id: data.order_id,
          store_id: data.store_id,
          amount: data.amount,
          reason: data.reason || 'Retour commande client',
        });
      } catch (accountingErr) {
        console.error(`[RefundService] Error recording accounting refund:`, accountingErr);
      }

      return this.mapToRefund(data);
    } catch (error) {
      console.error('Error approving refund:', error);
      throw error;
    }
  },

  // Rejeter un remboursement
  async rejectRefund(refundId: string, processedBy: string, notes?: string): Promise<Refund> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('refunds')
        .update({
          status: 'rejected',
          processed_by: processedBy,
          notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundId)
        .select()
        .single();

      if (error) throw error;

      return this.mapToRefund(data);
    } catch (error) {
      console.error('Error rejecting refund:', error);
      throw error;
    }
  },

  // Marquer un remboursement comme traité
  async markAsProcessed(refundId: string, processedBy: string): Promise<Refund> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('refunds')
        .update({
          status: 'processed',
          processed_by: processedBy,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundId)
        .select()
        .single();

      if (error) throw error;

      return this.mapToRefund(data);
    } catch (error) {
      console.error('Error marking refund as processed:', error);
      throw error;
    }
  },

  // Obtenir tous les remboursements d'un magasin
  async getRefundsByStore(storeId: string, status?: string): Promise<Refund[]> {
    const supabase = getSupabase();
    try {
      let query = supabase
        .from('refunds')
        .select('*, orders(customer_name, customer_phone)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data?.map(item => this.mapToRefund(item)) || [];
    } catch (error) {
      console.error('Error fetching refunds:', error);
      return [];
    }
  },

  // Obtenir les remboursements d'une commande
  async getRefundsByOrder(orderId: string): Promise<Refund[]> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('refunds')
        .select('*, orders(customer_name, customer_phone)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data?.map(item => this.mapToRefund(item)) || [];
    } catch (error) {
      console.error('Error fetching order refunds:', error);
      return [];
    }
  },

  // Obtenir un remboursement par ID
  async getRefundById(refundId: string): Promise<Refund | null> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('refunds')
        .select('*, orders(customer_name, customer_phone)')
        .eq('id', refundId)
        .single();

      if (error) throw error;

      return this.mapToRefund(data);
    } catch (error) {
      console.error('Error fetching refund:', error);
      return null;
    }
  },

  // Obtenir les raisons de remboursement
  async getRefundReasons(): Promise<RefundReason[]> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('refund_reasons')
        .select('*')
        .eq('is_active', true)
        .order('reason', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching refund reasons:', error);
      return [];
    }
  },

  // Créer une raison de remboursement
  async createRefundReason(reason: string, category: 'product' | 'delivery' | 'service' | 'other', description?: string): Promise<RefundReason> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('refund_reasons')
        .insert({
          reason,
          description,
          category,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating refund reason:', error);
      throw error;
    }
  },

  // Mettre à jour une raison de remboursement
  async updateRefundReason(reasonId: string, updates: Partial<RefundReason>): Promise<RefundReason> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('refund_reasons')
        .update(updates)
        .eq('id', reasonId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating refund reason:', error);
      throw error;
    }
  },

  // Supprimer (désactiver) une raison de remboursement
  async deleteRefundReason(reasonId: string): Promise<void> {
    const supabase = getSupabase();
    try {
      const { error } = await supabase
        .from('refund_reasons')
        .update({ is_active: false })
        .eq('id', reasonId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting refund reason:', error);
      throw error;
    }
  },

  // Calculer le montant remboursable pour une commande
  async calculateRefundableAmount(orderId: string): Promise<number> {
    const supabase = getSupabase();
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select('total, status')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      // Vérifier si la commande est éligible au remboursement
      if (order.status === 'cancelled' || order.status === 'refunded') {
        return 0;
      }

      // Obtenir les remboursements déjà effectués
      const refunds = await this.getRefundsByOrder(orderId);
      const alreadyRefunded = refunds
        .filter(r => r.status === 'approved' || r.status === 'processed')
        .reduce((sum, r) => sum + r.amount, 0);

      return Math.max(0, order.total - alreadyRefunded);
    } catch (error) {
      console.error('Error calculating refundable amount:', error);
      return 0;
    }
  },

  // Automatisation: Approuver automatiquement les remboursements sous un certain montant
  async autoApproveRefunds(storeId: string, maxAmount: number): Promise<Refund[]> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('refunds')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'pending')
        .lte('amount', maxAmount);

      if (error) throw error;

      const approvedRefunds: Refund[] = [];

      for (const refund of data || []) {
        try {
          const approved = await this.approveRefund(refund.id, 'system', 'Auto-approved: Amount under threshold');
          approvedRefunds.push(approved);
        } catch (e) {
          console.error(`Error auto-approving refund ${refund.id}:`, e);
        }
      }

      return approvedRefunds;
    } catch (error) {
      console.error('Error auto-approving refunds:', error);
      return [];
    }
  },

  // Obtenir les statistiques de remboursement
  async getRefundStats(storeId: string, startDate?: Date, endDate?: Date): Promise<{
    totalRefunds: number;
    totalAmount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    processedCount: number;
    averageRefundAmount: number;
  }> {
    const supabase = getSupabase();
    try {
      let query = supabase
        .from('refunds')
        .select('amount, status')
        .eq('store_id', storeId);

      if (startDate && endDate) {
        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const refunds = data || [];
      const totalAmount = refunds.reduce((sum, r) => sum + r.amount, 0);
      const averageRefundAmount = refunds.length > 0 ? totalAmount / refunds.length : 0;

      return {
        totalRefunds: refunds.length,
        totalAmount,
        pendingCount: refunds.filter(r => r.status === 'pending').length,
        approvedCount: refunds.filter(r => r.status === 'approved').length,
        rejectedCount: refunds.filter(r => r.status === 'rejected').length,
        processedCount: refunds.filter(r => r.status === 'processed').length,
        averageRefundAmount,
      };
    } catch (error) {
      console.error('Error fetching refund stats:', error);
      return {
        totalRefunds: 0,
        totalAmount: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        processedCount: 0,
        averageRefundAmount: 0,
      };
    }
  },

  // Helper: Mapper les données de la base vers le type Refund
  mapToRefund(data: any): Refund {
    return {
      id: data.id,
      orderId: data.order_id,
      orderDate: data.created_at,
      customerId: data.customer_id,
      customerName: data.orders?.customer_name,
      customerPhone: data.orders?.customer_phone,
      amount: data.amount,
      reason: data.reason,
      type: data.type,
      status: data.status,
      items: data.items || [],
      processedAt: data.processed_at,
      processedBy: data.processed_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      notes: data.notes,
    };
  },
};

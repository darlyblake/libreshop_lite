import { useSupabase } from '../lib/supabase';
import { notificationService } from './notificationService';
import { Dispute, CreateDisputePayload, UpdateDisputePayload } from '../types/dispute';

export const disputeService = {
  /**
   * Récupère tous les litiges (admin)
   */
  async getAll(): Promise<Dispute[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('disputes')
      .select('*, orders(id, total_amount), returns(id, status), users(full_name, email), stores(name), admins(full_name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère les litiges d'un utilisateur
   */
  async getByUser(userId: string): Promise<Dispute[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('disputes')
      .select('*, orders(id, total_amount), returns(id, status), stores(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère les litiges d'une boutique
   */
  async getByStore(storeId: string): Promise<Dispute[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('disputes')
      .select('*, orders(id, total_amount), returns(id, status), users(full_name, email)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère un litige par ID
   */
  async getById(id: string): Promise<Dispute | null> {
    const client = useSupabase();
    const { data, error } = await client
      .from('disputes')
      .select('*, orders(*), returns(*), users(*), stores(*), admins(*)')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  /**
   * Crée un nouveau litige
   */
  async create(payload: CreateDisputePayload): Promise<Dispute> {
    const client = useSupabase();
    const { data, error } = await client
      .from('disputes')
      .insert({
        ...payload,
        status: 'open',
        priority: 'medium',
        created_at: new Date().toISOString(),
      })
      .select('*, stores(user_id)')
      .single();
    
    if (error) throw error;

    // Notifier le vendeur
    try {
      const sellerId = data?.stores?.user_id;
      if (sellerId) {
        await notificationService.create({
          user_id: sellerId,
          title: '⚠️ Nouveau litige ouvert',
          body: `Un client a ouvert un litige concernant votre commande. Veuillez consulter le tableau de bord.`,
          type: 'system',
          targetRole: 'seller',
          data: {
            disputeId: data.id,
            orderId: payload.order_id,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to send dispute notification to seller:', e);
    }

    // Notifier les admins
    try {
      await notificationService.sendBroadcastToAdmins({
        title: '🛡️ Nouveau litige à traiter',
        body: `Un nouveau litige a été ouvert et nécessite une intervention administrative.`,
        type: 'system',
        data: {
          disputeId: data.id,
        },
      });
    } catch (e) {
      console.warn('Failed to send dispute notification to admins:', e);
    }

    return data;
  },

  /**
   * Met à jour un litige (admin)
   */
  async update(id: string, payload: UpdateDisputePayload): Promise<Dispute> {
    const client = useSupabase();
    const { data, error } = await client
      .from('disputes')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, user_id, store_id')
      .single();
    
    if (error) throw error;

    // Notifier l'utilisateur et le vendeur du changement de statut
    if (payload.status) {
      try {
        const statusMessages = {
          investigating: 'Votre litige est en cours d\'investigation',
          resolved: 'Votre litige a été résolu',
          rejected: 'Votre litige a été rejeté',
          closed: 'Votre litige a été clôturé',
        };

        const message = statusMessages[payload.status as keyof typeof statusMessages];
        if (message) {
          await notificationService.create({
            user_id: data.user_id,
            title: 'Mise à jour de votre litige',
            body: message,
            type: 'system',
            targetRole: 'client',
            data: {
              disputeId: id,
            },
          });
        }
      } catch (e) {
        console.warn('Failed to send dispute status notification:', e);
      }
    }

    return data;
  },

  /**
   * Supprime un litige (admin only)
   */
  async delete(id: string): Promise<void> {
    const client = useSupabase();
    const { error } = await client
      .from('disputes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  /**
   * Récupère les statistiques de litiges
   */
  async getStats(): Promise<{
    total: number;
    open: number;
    investigating: number;
    resolved: number;
    rejected: number;
  }> {
    const client = useSupabase();
    const { data, error } = await client
      .from('disputes')
      .select('status');
    
    if (error) throw error;

    const disputes = data || [];
    return {
      total: disputes.length,
      open: disputes.filter(d => d.status === 'open').length,
      investigating: disputes.filter(d => d.status === 'investigating').length,
      resolved: disputes.filter(d => d.status === 'resolved').length,
      rejected: disputes.filter(d => d.status === 'rejected').length,
    };
  },
};

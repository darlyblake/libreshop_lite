import { useSupabase } from '../lib/supabase';
import { CommunicationLog, CreateCommunicationLogPayload } from '../types/communicationLog';

export const communicationLogService = {
  /**
   * Crée un nouveau log de communication
   */
  async create(payload: CreateCommunicationLogPayload): Promise<CommunicationLog> {
    const client = useSupabase();
    const { data, error } = await client
      .from('communication_logs')
      .insert({
        ...payload,
        status: payload.status || 'sent',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Récupère les logs de communication d'un utilisateur
   */
  async getByUser(userId: string, limit: number = 50): Promise<CommunicationLog[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('communication_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère les logs de communication d'une boutique
   */
  async getByStore(storeId: string, limit: number = 50): Promise<CommunicationLog[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('communication_logs')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère les logs de communication d'une commande
   */
  async getByOrder(orderId: string): Promise<CommunicationLog[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('communication_logs')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Met à jour le statut d'un log de communication
   */
  async updateStatus(id: string, status: 'sent' | 'delivered' | 'failed', errorMessage?: string): Promise<CommunicationLog> {
    const client = useSupabase();
    const { data, error } = await client
      .from('communication_logs')
      .update({
        status,
        error_message: errorMessage,
        delivered_at: status === 'delivered' ? new Date().toISOString() : undefined,
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Log une communication WhatsApp
   */
  async logWhatsApp(payload: {
    user_id: string;
    store_id?: string;
    order_id?: string;
    direction: 'outbound' | 'inbound';
    recipient?: string;
    message: string;
  }): Promise<CommunicationLog> {
    return this.create({
      ...payload,
      channel: 'whatsapp',
      status: 'sent',
      metadata: {
        platform: 'whatsapp',
      },
    });
  },

  /**
   * Log une communication SMS
   */
  async logSMS(payload: {
    user_id: string;
    store_id?: string;
    order_id?: string;
    direction: 'outbound' | 'inbound';
    recipient?: string;
    message: string;
  }): Promise<CommunicationLog> {
    return this.create({
      ...payload,
      channel: 'sms',
      status: 'sent',
      metadata: {
        platform: 'sms',
      },
    });
  },

  /**
   * Log une communication email
   */
  async logEmail(payload: {
    user_id: string;
    store_id?: string;
    order_id?: string;
    direction: 'outbound' | 'inbound';
    recipient?: string;
    subject: string;
    message: string;
  }): Promise<CommunicationLog> {
    return this.create({
      ...payload,
      channel: 'email',
      status: 'sent',
      metadata: {
        platform: 'email',
      },
    });
  },
};

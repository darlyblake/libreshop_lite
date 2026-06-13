/**
 * Types pour le logging des communications
 */

export type CommunicationChannel = 'whatsapp' | 'sms' | 'email' | 'push' | 'in_app';
export type CommunicationDirection = 'outbound' | 'inbound';

export interface CommunicationLog {
  id: string;
  user_id: string;
  store_id?: string;
  order_id?: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  recipient?: string;
  sender?: string;
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  error_message?: string;
  created_at: string;
  delivered_at?: string;
}

export interface CreateCommunicationLogPayload {
  user_id: string;
  store_id?: string;
  order_id?: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  recipient?: string;
  sender?: string;
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
  status?: 'sent' | 'delivered' | 'failed' | 'pending';
  error_message?: string;
}

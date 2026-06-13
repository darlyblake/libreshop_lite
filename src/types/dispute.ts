/**
 * Types pour le système de litiges
 */

export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'rejected' | 'closed';
export type DisputeType = 'order' | 'return' | 'payment' | 'delivery' | 'product_quality' | 'other';
export type DisputePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Dispute {
  id: string;
  order_id?: string;
  return_id?: string;
  user_id: string;
  store_id: string;
  type: DisputeType;
  status: DisputeStatus;
  priority: DisputePriority;
  title: string;
  description: string;
  evidence_urls?: string[];
  admin_id?: string;
  admin_notes?: string;
  resolution?: string;
  resolution_date?: string;
  created_at: string;
  updated_at?: string;
  
  // Relations
  orders?: any;
  returns?: any;
  users?: any;
  stores?: any;
  admins?: any;
}

export interface CreateDisputePayload {
  order_id?: string;
  return_id?: string;
  user_id: string;
  store_id: string;
  type: DisputeType;
  title: string;
  description: string;
  evidence_urls?: string[];
}

export interface UpdateDisputePayload {
  status?: DisputeStatus;
  priority?: DisputePriority;
  admin_notes?: string;
  resolution?: string;
  resolution_date?: string;
}

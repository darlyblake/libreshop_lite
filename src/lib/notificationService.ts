import { supabase } from './supabase';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'order' | 'payment' | 'promo' | 'system';
  read: boolean;
  created_at: string;
  data?: Record<string, any>;
}

// Notification Service
export const notificationService = {
  async getByUser(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase!
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase!
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
    return count || 0;
  },

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase!
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    if (error) throw error;
  },

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase!
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
  },

  async delete(notificationId: string): Promise<void> {
    const { error } = await supabase!
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (error) throw error;
  },

  async deleteAllByUser(userId: string): Promise<void> {
    const { error } = await supabase!
      .from('notifications')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },

  async create(notification: Partial<Notification>): Promise<Notification> {
    const { data, error } = await supabase!
      .from('notifications')
      .insert(notification)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // Create notification for multiple users
  async createBulk(
    userIds: string[],
    notification: Omit<Notification, 'id' | 'user_id' | 'created_at'>
  ): Promise<void> {
    const notifications = userIds.map((user_id) => ({
      ...notification,
      user_id,
    }));
    const { error } = await supabase!
      .from('notifications')
      .insert(notifications);
    if (error) throw error;
  },
};


import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'order' | 'payment' | 'promo' | 'system' | 'comment' | 'like' | 'admin';
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
    const { error } = await supabase!
      .from('notifications')
      .insert(notification);
    if (error) throw error;

    // Tentative d'envoi de notification push en arrière-plan
    if (notification.user_id) {
      this.sendPushNotification(notification.user_id, {
        title: notification.title || 'Nouvelle notification',
        body: notification.body || '',
        data: notification.data,
      }).catch(console.error);
    }

    return notification as Notification;
  },

  // Service interne pour envoyer au serveur Expo
  async sendPushNotification(userId: string, pushData: { title: string, body: string, data?: any }) {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      // Récupérer le token du destinataire
      const { data: user, error } = await supabase!
        .from('users')
        .select('expo_push_token')
        .eq('id', userId)
        .maybeSingle();
      
      if (error || !user?.expo_push_token) return;

      const message = {
        to: user.expo_push_token,
        sound: 'default',
        title: pushData.title,
        body: pushData.body,
        data: pushData.data,
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch (e) {
      console.error('Error sending push notification:', e);
    }
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

    // Push notifications pour tout le monde
    userIds.forEach(uid => {
        this.sendPushNotification(uid, {
            title: notification.title,
            body: notification.body,
            data: notification.data
        }).catch(() => {});
    });
  },

  // Send broadcast notification to all users of a specific role
  async sendBroadcastToRole(
    role: 'client' | 'seller' | 'admin',
    notification: Omit<Notification, 'id' | 'user_id' | 'created_at'>
  ): Promise<void> {
    const { data: users, error } = await supabase!
      .from('users')
      .select('id')
      .eq('role', role);
    
    if (error) throw error;
    
    const userIds = users?.map((u: any) => u.id) || [];
    if (userIds.length > 0) {
      await this.createBulk(userIds, notification);
    }
  },

  // Send broadcast notification to all sellers
  async sendBroadcastToSellers(
    notification: Omit<Notification, 'id' | 'user_id' | 'created_at'>
  ): Promise<void> {
    await this.sendBroadcastToRole('seller', notification);
  },

  // Send broadcast notification to all clients
  async sendBroadcastToClients(
    notification: Omit<Notification, 'id' | 'user_id' | 'created_at'>
  ): Promise<void> {
    await this.sendBroadcastToRole('client', notification);
  },

  // Send broadcast notification to all admins
  async sendBroadcastToAdmins(
    notification: Omit<Notification, 'id' | 'user_id' | 'created_at'>
  ): Promise<void> {
    await this.sendBroadcastToRole('admin', notification);
  },

  // Register device token
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
    deviceInfo?: Record<string, any>
  ): Promise<void> {
    const { error } = await supabase!
      .from('device_tokens')
      .upsert({
        user_id: userId,
        token,
        platform,
        device_info: deviceInfo,
        last_used_at: new Date().toISOString(),
      });
    if (error) throw error;
  },
};


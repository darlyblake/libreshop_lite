import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

// Configuration du comportement des notifications quand l'application est au premier plan
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

class NotificationService {
  private expoPushToken: string | null = null;

  async registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') {
      console.log('[Notifications] Push notifications non supportées sur le web pour le moment.');
      return null;
    }

    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return;
      }
      
      try {
        const projectId = 'votre-project-id'; // Normalement récupéré depuis Constants.expoConfig.extra.eas.projectId
        // On récupère le token d'appareil
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        this.expoPushToken = token;
        
        // Enregistrer le token dans Supabase si l'utilisateur est connecté
        this.saveTokenToDatabase(token);
      } catch (error: any) {
        errorHandler.handle(error, 'Notification token error', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      }
    } else {
      console.warn('Must use physical device for Push Notifications');
    }

    return token;
  }

  private async saveTokenToDatabase(token: string) {
    try {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // En théorie, vous auriez une table `push_tokens` dans Supabase
        // await supabase.from('push_tokens').upsert({ user_id: user.id, token });
        console.log('Push token prêt pour l\'utilisateur:', user.id, token);
      }
    } catch (e) {
      console.warn('Could not save push token to db', e);
    }
  }

  // ==========================================
  // NOTIFICATIONS CLIENT
  // ==========================================

  // Planifie un rappel de panier abandonné (ex: dans 2 heures)
  async scheduleCartReminder() {
    if (Platform.OS === 'web') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🛒 Vous avez oublié quelque chose ?",
        body: "Votre panier LibreShop vous attend ! Finalisez votre commande avant la rupture de stock.",
        data: { screen: 'Cart' },
      },
      trigger: {
        seconds: 2 * 60 * 60, // 2 heures (pour le test on pourrait mettre 10 secondes)
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  }

  // Notifie quand une boutique suivie publie un nouveau produit
  async notifyNewProductFromFollowedStore(storeName: string, productName: string) {
    if (Platform.OS === 'web') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Nouveauté chez ${storeName} ! 🎉`,
        body: `Découvrez leur nouvel article : ${productName}.`,
        data: { type: 'new_product' },
      },
      trigger: null, // null = immédiat
    });
  }

  // Notification d'engagement programmée (pour inciter le client à revenir)
  async scheduleEngagementNotification() {
    if (Platform.OS === 'web') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🌟 Découvrez les nouveautés locales",
        body: "De nouvelles boutiques et produits sont arrivés sur LibreShop. Venez explorer votre marché local !",
        data: { screen: 'ClientHome' },
      },
      trigger: {
        seconds: 3 * 24 * 60 * 60, // 3 jours après
        repeats: true, // Si supporté
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  }

  // ==========================================
  // NOTIFICATIONS VENDEUR
  // ==========================================

  async notifyNewOrder(orderId: string, amount: string) {
    if (Platform.OS === 'web') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "💸 Nouvelle commande !",
        body: `Vous avez reçu une nouvelle commande (ID: ${orderId}) d'un montant de ${amount}. Préparez-la vite !`,
        data: { screen: 'SellerOrders' },
        sound: true,
      },
      trigger: null,
    });
  }

  async notifyLowStock(productName: string) {
    if (Platform.OS === 'web') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚠️ Rupture de stock imminente",
        body: `Le produit "${productName}" est presque épuisé. Pensez à réapprovisionner !`,
        data: { screen: 'SellerProducts' },
      },
      trigger: null,
    });
  }

  async notifyNewInteraction(type: 'like' | 'comment', productName: string) {
    if (Platform.OS === 'web') return;
    const actionText = type === 'like' ? 'a aimé' : 'a commenté';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Nouvelle interaction ❤️",
        body: `Quelqu'un ${actionText} votre produit "${productName}".`,
      },
      trigger: null,
    });
  }

  // ==========================================
  // NOTIFICATIONS ADMINISTRATEUR
  // ==========================================

  async notifyAdminActionRequired(actionType: string) {
    if (Platform.OS === 'web') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🛡️ Action Administrateur Requise",
        body: `Une nouvelle tâche nécessite votre attention : ${actionType}`,
        data: { screen: 'AdminDashboard' },
      },
      trigger: null,
    });
  }

  // ==========================================
  // NOTIFICATIONS BASE DE DONNÉES
  // ==========================================

  async create(notification: {
    user_id: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    type?: string;
  }) {
    try {
      if (!supabase) {
        console.warn('[NotificationService] Supabase not available');
        return null;
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.user_id,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          type: notification.type || 'info',
          read: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (e) {
      errorHandler.handle(e, 'Failed to create notification', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      return null;
    }
  }

  async getByUser(userId: string) {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.error(e);
      return 0;
    }
  }

  async markAsRead(notificationId: string) {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      if (error) throw error;
    } catch (e) {
      console.error(e);
    }
  }

  async markAllAsRead(userId: string) {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) throw error;
    } catch (e) {
      console.error(e);
    }
  }

  async deleteAllByUser(userId: string) {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      console.error(e);
    }
  }

  async sendBroadcastToRole(role: string, notificationData: any) {
    if (!supabase) return;
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('role', role);
        
      if (usersError) throw usersError;
      
      if (users && users.length > 0) {
        const notifications = users.map(u => ({
          user_id: u.id,
          title: notificationData.title,
          body: notificationData.body,
          type: notificationData.type || 'admin',
          data: notificationData.data || {},
          read: false,
        }));
        
        // Bulk insert notifications
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(notifications);
          
        if (insertError) throw insertError;
      }
    } catch (e) {
      console.error(`Failed to broadcast to ${role}:`, e);
      throw e;
    }
  }

  async sendBroadcastToClients(notification: any) {
    return this.sendBroadcastToRole('client', notification);
  }

  async sendBroadcastToSellers(notification: any) {
    return this.sendBroadcastToRole('seller', notification);
  }

  async sendBroadcastToAdmins(notification: any) {
    return this.sendBroadcastToRole('admin', notification);
  }
}

export const notificationService = new NotificationService();

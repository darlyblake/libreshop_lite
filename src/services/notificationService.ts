import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'votre-project-id';
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
        const { error } = await supabase.from('push_tokens').upsert({ user_id: user.id, token });
        if (error) throw error;
        console.log('Push token prêt pour l\'utilisateur:', user.id, token);
      }
    } catch (e) {
      errorHandler.handle(e, 'Could not save push token to db', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
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

  async notifyNewProductFromFollowedStore(clientId: string, storeName: string, productName: string) {
    await this.create({
      user_id: clientId,
      title: `Nouveauté chez ${storeName} ! 🎉`,
      body: `Découvrez leur nouvel article : ${productName}.`,
      data: { type: 'new_product' },
      type: 'info',
      targetRole: 'client'
    });
    // Appel géré par la méthode this.create qui invoque l'Edge Function
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

  async notifyNewOrder(sellerId: string, orderId: string, amount: string) {
    await this.create({
      user_id: sellerId,
      title: "💸 Nouvelle commande !",
      body: `Vous avez reçu une nouvelle commande (ID: ${orderId}) d'un montant de ${amount}. Préparez-la vite !`,
      data: { screen: 'SellerOrders' },
      type: 'order',
      targetRole: 'seller'
    });
  }

  async notifyLowStock(sellerId: string, productName: string) {
    await this.create({
      user_id: sellerId,
      title: "⚠️ Rupture de stock imminente",
      body: `Le produit "${productName}" est presque épuisé. Pensez à réapprovisionner !`,
      data: { screen: 'SellerProducts' },
      type: 'alert',
      targetRole: 'seller'
    });
  }

  async notifyNewInteraction(sellerId: string, type: 'like' | 'comment', productName: string) {
    const actionText = type === 'like' ? 'a aimé' : 'a commenté';
    await this.create({
      user_id: sellerId,
      title: "Nouvelle interaction ❤️",
      body: `Quelqu'un ${actionText} votre produit "${productName}".`,
      type: 'interaction',
      targetRole: 'seller'
    });
  }

  // ==========================================
  // NOTIFICATIONS ADMINISTRATEUR
  // ==========================================

  async notifyAdminActionRequired(adminId: string, actionType: string) {
    await this.create({
      user_id: adminId,
      title: "🛡️ Action Administrateur Requise",
      body: `Une nouvelle tâche nécessite votre attention : ${actionType}`,
      data: { screen: 'AdminDashboard' },
      type: 'admin',
      targetRole: 'admin'
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
    targetRole?: 'client' | 'seller' | 'admin';
  }) {
    try {
      if (!supabase) {
        console.warn('[NotificationService] Supabase not available');
        return null;
      }

      // Normalize type to match DB CHECK constraint: ('order', 'payment', 'promo', 'system')
      const validTypes = ['order', 'payment', 'promo', 'system'];
      const rawType = notification.type || 'system';
      const dbType = validTypes.includes(rawType) ? rawType : 'system';

      const finalData = {
        ...(notification.data || {}),
        targetRole: notification.targetRole || 'client',
        originalType: rawType, // Preserve original type in data for display purposes
      };

      const { data, error } = await supabase.rpc('create_system_notification', {
        p_user_id: notification.user_id,
        p_title: notification.title,
        p_body: notification.body,
        p_type: dbType,
        p_target_role: notification.targetRole || 'client',
        p_data: finalData
      });

      if (error) {
        // Fallback for local development if RPC doesn't exist yet
        console.warn('RPC create_system_notification failed, falling back to direct insert', error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('notifications')
          .insert({
            user_id: notification.user_id,
            title: notification.title,
            body: notification.body,
            data: finalData,
            type: dbType,
            read: false,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (fallbackError) throw fallbackError;
      }

      // Appel à l'Edge Function pour envoyer la notification Push réelle via Expo
      try {
        const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: notification.user_id,
            title: notification.title,
            body: notification.body,
            data: finalData,
            type: notification.type || 'info',
          }
        });
        if (pushError) {
          console.warn('[NotificationService] Erreur lors de l\'invocation de l\'Edge Function', pushError);
        }
      } catch (invokeError) {
        console.warn('[NotificationService] Échec de l\'invocation de send-push-notification', invokeError);
      }

      return data;
    } catch (e) {
      errorHandler.handle(e, 'Failed to create notification', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      return null;
    }
  }

  /**
   * Crée une notification avec système de fallback (push -> SMS -> email)
   * Utilise cette méthode pour les notifications critiques qui doivent absolument être délivrées
   */
  async createWithFallback(notification: {
    user_id: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    type?: string;
    targetRole?: 'client' | 'seller' | 'admin';
    priority?: 'low' | 'medium' | 'high';
  }) {
    const channels = ['push', 'sms', 'email'];
    const priority = notification.priority || 'medium';

    // Pour les notifications de faible priorité, on essaie seulement push
    if (priority === 'low') {
      return this.create(notification);
    }

    // Pour les notifications de haute priorité, on essaie tous les canaux
    for (const channel of channels) {
      try {
        await this.sendViaChannel(notification, channel);
        console.log(`[NotificationService] Notification sent via ${channel}`);
        return; // Succès, arrêter
      } catch (error) {
        console.warn(`[NotificationService] ${channel} failed, trying next...`, error);
      }
    }

    // Tous les canaux ont échoué
    console.error('[NotificationService] All notification channels failed');
    throw new Error('All notification channels failed');
  }

  /**
   * Envoie une notification via un canal spécifique
   */
  private async sendViaChannel(notification: {
    user_id: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    type?: string;
    targetRole?: 'client' | 'seller' | 'admin';
  }, channel: 'push' | 'sms' | 'email') {
    switch (channel) {
      case 'push':
        return this.create(notification);
      case 'sms':
        return this.sendSMS(notification);
      case 'email':
        return this.sendEmail(notification);
    }
  }

  /**
   * Envoie une notification SMS (placeholder pour intégration Twilio)
   */
  private async sendSMS(notification: {
    user_id: string;
    title: string;
    body: string;
  }) {
    // TODO: Intégrer Twilio ou un autre service SMS
    // Pour l'instant, on loggue l'action
    console.log('[NotificationService] SMS notification (not implemented yet):', {
      user_id: notification.user_id,
      title: notification.title,
      body: notification.body,
    });

    // Exemple d'implémentation future avec Twilio:
    // const { data: userData } = await supabase
    //   .from('profiles')
    //   .select('phone')
    //   .eq('user_id', notification.user_id)
    //   .single();
    //
    // if (!userData?.phone) throw new Error('No phone number found');
    //
    // await fetch('https://api.twilio.com/2010-04-01/Accounts/.../Messages.json', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': 'Basic ' + btoa(ACCOUNT_SID + ':' + AUTH_TOKEN),
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //   },
    //   body: new URLSearchParams({
    //     From: TWILIO_PHONE_NUMBER,
    //     To: userData.phone,
    //     Body: `${notification.title}\n\n${notification.body}`,
    //   }),
    // });

    throw new Error('SMS not implemented yet');
  }

  /**
   * Envoie une notification email (placeholder pour intégration SendGrid/Mailgun)
   */
  private async sendEmail(notification: {
    user_id: string;
    title: string;
    body: string;
  }) {
    // TODO: Intégrer SendGrid, Mailgun ou un autre service email
    // Pour l'instant, on loggue l'action
    console.log('[NotificationService] Email notification (not implemented yet):', {
      user_id: notification.user_id,
      title: notification.title,
      body: notification.body,
    });

    // Exemple d'implémentation future avec SendGrid:
    // const { data: userData } = await supabase
    //   .from('profiles')
    //   .select('email')
    //   .eq('user_id', notification.user_id)
    //   .single();
    //
    // if (!userData?.email) throw new Error('No email found');
    //
    // await fetch('https://api.sendgrid.com/v3/mail/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': 'Bearer ' + SENDGRID_API_KEY,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     personalizations: [{
    //       to: [{ email: userData.email }],
    //       subject: notification.title,
    //     }],
    //     from: { email: 'noreply@libreshop.com' },
    //     content: [{
    //       type: 'text/plain',
    //       value: notification.body,
    //     }],
    //   }),
    // });

    throw new Error('Email not implemented yet');
  }

  async getByUser(userId: string, role?: 'client' | 'seller' | 'admin', limit: number = 50) {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId);

      if (role) {
        if (role === 'client') {
          // Pour gérer la rétrocompatibilité (anciennes notifications sans targetRole),
          // on accepte celles dont targetRole est 'client' OU null
          query = query.or(`data->>targetRole.eq.client,data->>targetRole.is.null`);
        } else {
          query = query.eq('data->>targetRole', role);
        }
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (e) {
      errorHandler.handle(e, 'Failed to get notifications', ErrorCategory.DATABASE, ErrorSeverity.LOW);
      return [];
    }
  }

  async getUnreadCount(userId: string, role?: 'client' | 'seller' | 'admin'): Promise<number> {
    if (!supabase) return 0;
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (role) {
        if (role === 'client') {
          query = query.or(`data->>targetRole.eq.client,data->>targetRole.is.null`);
        } else {
          query = query.eq('data->>targetRole', role);
        }
      }

      const { count, error } = await query;
      return count || 0;
    } catch (e) {
      errorHandler.handle(e, 'Failed to get unread count', ErrorCategory.DATABASE, ErrorSeverity.LOW);
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
      errorHandler.handle(e, 'Failed to mark notification as read', ErrorCategory.DATABASE, ErrorSeverity.LOW);
    }
  }

  async markAllAsRead(userId: string, role?: 'client' | 'seller' | 'admin') {
    if (!supabase) return;
    try {
      let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (role) {
        if (role === 'client') {
          query = query.or(`data->>targetRole.eq.client,data->>targetRole.is.null`);
        } else {
          query = query.eq('data->>targetRole', role);
        }
      }

      const { error } = await query;
      if (error) throw error;
    } catch (e) {
      errorHandler.handle(e, 'Failed to mark all as read', ErrorCategory.DATABASE, ErrorSeverity.LOW);
    }
  }

  async deleteAllByUser(userId: string, role?: 'client' | 'seller' | 'admin') {
    if (!supabase) return;
    try {
      let query = supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (role) {
        if (role === 'client') {
          query = query.or(`data->>targetRole.eq.client,data->>targetRole.is.null`);
        } else {
          query = query.eq('data->>targetRole', role);
        }
      }

      const { error } = await query;
    } catch (e) {
      errorHandler.handle(e, 'Failed to delete notifications', ErrorCategory.DATABASE, ErrorSeverity.LOW);
    }
  }

  async sendBroadcastToRole(role: string, notificationData: any) {
    if (!supabase) return;
    try {
      // Remplacement du bulk insert client par un appel à une Edge Function Supabase
      // L'Edge Function s'occupera de créer les entrées DB et d'envoyer les Push via Expo
      const { error } = await supabase.functions.invoke('broadcast-push-notification', {
        body: {
          role: role,
          title: notificationData.title,
          body: notificationData.body,
          type: notificationData.type || 'admin',
          data: notificationData.data || {},
        }
      });
      
      if (error) throw error;
    } catch (e) {
      errorHandler.handle(e, `Failed to broadcast to ${role}`, ErrorCategory.DATABASE, ErrorSeverity.HIGH);
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

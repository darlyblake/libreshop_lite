import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import type * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { errorHandler } from '../utils/errorHandler';

// Public VAPID key is safe to expose in the client. Keep the private key server-side.
const VAPID_PUBLIC_KEY = 'BACkyGyicWJ1RoTJbHQsKTfLxTiLvl95OmPFQA9gue65hLQkELvND-OBuMgCo57srhUvoLgbnpUsqPJVvn79_XI';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export interface PushNotificationState {
  expoPushToken: string | undefined;
  notification: Notifications.Notification | undefined;
}

export const usePushNotifications = (userId: string | undefined): PushNotificationState => {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const notificationListener = useRef<any>(undefined);
  const responseListener = useRef<any>(undefined);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    const initNotifications = async () => {
      try {
        if (Platform.OS === 'web') {
          await registerWebPush(userId);
        } else {
          const NotificationsModule = await import('expo-notifications');
          const token = await registerForPushNotificationsAsync();
          if (isMounted) {
            setExpoPushToken(token);
            if (token) await saveToken(userId, token);
          }
          notificationListener.current = NotificationsModule.addNotificationReceivedListener((n) => {
            if (isMounted) setNotification(n);
          });
          responseListener.current = NotificationsModule.addNotificationResponseReceivedListener((response) => {
            console.log('Notification response received:', response);
          });
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    void initNotifications();
    return () => {
      isMounted = false;
      notificationListener.current?.remove?.();
      responseListener.current?.remove?.();
    };
  }, [userId]);

  const registerWebPush = async (uid: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const subJSON = subscription.toJSON();
      if (!subJSON.endpoint || !subJSON.keys?.p256dh || !subJSON.keys?.auth) return;
      const { error } = await supabase!.from('web_push_subscriptions').upsert({
        user_id: uid,
        endpoint: subJSON.endpoint,
        p256dh: subJSON.keys.p256dh,
        auth: subJSON.keys.auth,
        last_used_at: new Date().toISOString(),
      }, { onConflict: 'user_id, endpoint' });
      if (error) console.error('[WebPush] Erreur sauvegarde abonnement:', error);
    } catch (error) {
      console.error('[WebPush] Erreur d\'enregistrement:', error);
    }
  };

  const saveToken = async (uid: string, token: string) => {
    try {
      const { error } = await supabase!.from('device_tokens').upsert({ user_id: uid, token, platform: Platform.OS, last_used_at: new Date().toISOString() }, { onConflict: 'user_id,token' });
      if (error) throw error;
    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'save_push_token');
    }
  };

  return { expoPushToken, notification };
};

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return;
  const NotificationsModule = await import('expo-notifications');
  let token;
  if (Platform.OS === 'android') {
    await NotificationsModule.setNotificationChannelAsync('default', {
      name: 'default', importance: NotificationsModule.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250], lightColor: '#FF231F7C',
    });
  }
  if (Device.isDevice) {
    const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await NotificationsModule.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    const googleServicesFile = Constants?.expoConfig?.android?.googleServicesFile;
    if (Platform.OS === 'android' && !googleServicesFile) return;
    if (!projectId) return;
    try { token = (await NotificationsModule.getExpoPushTokenAsync({ projectId })).data; }
    catch (e) { console.error('Error getting push token:', e); }
  }
  return token;
}

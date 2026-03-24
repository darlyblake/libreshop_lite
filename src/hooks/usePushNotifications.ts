import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import type * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { errorHandler } from '../utils/errorHandler';

export interface PushNotificationState {
  expoPushToken: string | undefined;
  notification: Notifications.Notification | undefined;
}

export const usePushNotifications = (userId: string | undefined): PushNotificationState => {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const notificationListener = useRef<Notifications.Subscription>(undefined);
  const responseListener = useRef<Notifications.Subscription>(undefined);

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;

    let isMounted = true;

    const initNotifications = async () => {
      try {
        const NotificationsModule = await import('expo-notifications');
        
        const token = await registerForPushNotificationsAsync();
        if (isMounted) {
          setExpoPushToken(token);
          if (token) {
            saveTokenToUser(userId, token);
          }
        }

        notificationListener.current = NotificationsModule.addNotificationReceivedListener((notification) => {
          if (isMounted) setNotification(notification);
        });

        responseListener.current = NotificationsModule.addNotificationResponseReceivedListener((response) => {
          console.log('Notification response received:', response);
        });
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    void initNotifications();

    return () => {
      isMounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);

  const saveTokenToUser = async (uid: string, token: string) => {
    try {
      const { error } = await supabase!
        .from('users')
        .update({ expo_push_token: token })
        .eq('id', uid);
      
      if (error) throw error;
      console.log('Push token saved successfully');
    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'save_push_token');
    }
  };

  return {
    expoPushToken,
    notification,
  };
};

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return;
  
  const NotificationsModule = await import('expo-notifications');
  let token;

  if (Platform.OS === 'android') {
    await NotificationsModule.setNotificationChannelAsync('default', {
      name: 'default',
      importance: NotificationsModule.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await NotificationsModule.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
      return;
    }

    try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        if (!projectId) {
            console.warn('Project ID non trouvé dans app.json. Les notifications push ne fonctionneront pas sans liaison EAS.');
            return;
        }
        token = (await NotificationsModule.getExpoPushTokenAsync({
            projectId,
        })).data;
    } catch (e) {
        console.error('Error getting push token:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

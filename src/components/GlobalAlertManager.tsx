import React, { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useAlertModal } from './AlertModal';

export const GlobalAlertManager: React.FC = () => {
  const { show: showAlert, AlertModalComponent } = useAlertModal();

  useEffect(() => {
    // Override the global Alert.alert from React Native
    const originalAlert = Alert.alert;
    
    Alert.alert = (
      title: string,
      message?: string,
      buttons?: any[],
      options?: any
    ) => {
      let type: 'info' | 'error' | 'success' | 'warning' = 'info';
      
      const lowerTitle = title?.toLowerCase() || '';
      if (lowerTitle.includes('erreur') || lowerTitle.includes('error') || lowerTitle.includes('impossible')) type = 'error';
      else if (lowerTitle.includes('succès') || lowerTitle.includes('success') || lowerTitle.includes('✅')) type = 'success';
      else if (lowerTitle.includes('attention') || lowerTitle.includes('warning') || lowerTitle.includes('requise')) type = 'warning';

      let mappedButtons;
      if (buttons && buttons.length > 0) {
        mappedButtons = buttons.map(btn => ({
          text: btn.text || 'OK',
          onPress: btn.onPress,
          style: btn.style,
        }));
      } else {
        mappedButtons = [{ text: 'OK', style: 'default' }];
      }

      showAlert({
        type,
        title: title || 'Alerte',
        message: message || '',
        buttons: mappedButtons as any,
      });
    };

    // Override window.alert for Web explicitly
    let originalWindowAlert: any;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      originalWindowAlert = window.alert;
      window.alert = (msg: string) => {
        let type: 'error' | 'info' = 'info';
        let cleanMsg = msg || '';
        if (cleanMsg.toLowerCase().startsWith('erreur:')) {
          type = 'error';
          cleanMsg = cleanMsg.substring(7).trim();
        }
        showAlert({ 
          type, 
          title: type === 'error' ? 'Erreur' : 'Information', 
          message: cleanMsg 
        });
      };
    }

    return () => {
      Alert.alert = originalAlert;
      if (originalWindowAlert && typeof window !== 'undefined') {
        window.alert = originalWindowAlert;
      }
    };
  }, [showAlert]);

  return <>{AlertModalComponent}</>;
};

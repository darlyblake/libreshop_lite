/**
 * Cross-platform utilities for browser APIs
 * Safe to use in both web and React Native environments
 */

import { Alert } from 'react-native';

/**
 * Safe alert that works in both React Native and Web
 */
export const showAlert = (title: string, message?: string) => {
  try {
    if (typeof window !== 'undefined' && window.alert) {
      // Web environment
      if (message) {
        window.alert(`${title}\n\n${message}`);
      } else {
        window.alert(title);
      }
    } else {
      // React Native environment
      Alert.alert(title, message || '');
    }
  } catch (e) {
    errorHandler.handleDatabaseError(title, message, 'Alert failed:');
  }
};

/**
 * Safe confirm that works in both React Native and Web
 * Returns a Promise that resolves to a boolean
 */
export const showConfirm = (title: string, message?: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      if (typeof window !== 'undefined' && window.confirm) {
        // Web environment
        const result = window.confirm(message ? `${title}\n\n${message}` : title);
        resolve(result);
      } else {
        // React Native environment
        Alert.alert(
          title,
          message || '',
          [
            { text: 'Annuler', onPress: () => resolve(false), style: 'cancel' },
            { text: 'OK', onPress: () => resolve(true) },
          ]
        );
      }
    } catch (e) {
      errorHandler.handleDatabaseError(title, message, 'Confirm failed:');
      resolve(false);
    }
  });
};

/**
 * Safe window.open that works in both environments
 */
export const openURL = (url: string, target = '_blank') => {
  try {
    if (typeof window !== 'undefined' && window.open) {
      // Web environment
      window.open(url, target);
    } else {
      // React Native - use Linking
      const { Linking } = require('react-native');
      Linking.openURL(url).catch((err: any) => {
        errorHandler.handleDatabaseError(url, err, 'Failed to open URL:');
      });
    }
  } catch (e) {
    errorHandler.handleDatabaseError(url, 'Open URL failed:');
  }
};

/**
 * Safe location.reload for web, no-op in React Native
 */
export const reloadPage = () => {
  try {
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    } else {
      errorHandler.handle('Page reload not available in React Native', 'UnknownContext', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
    }
  } catch (e) {
    errorHandler.handleDatabaseError(e, 'Reload failed:');
  }
};

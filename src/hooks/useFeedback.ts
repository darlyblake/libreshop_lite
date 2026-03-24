import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../config/theme';

export type FeedbackType = 'success' | 'error' | 'warning' | 'info';

export interface FeedbackOptions {
  message: string;
  type?: FeedbackType;
  duration?: number;
  haptic?: boolean;
  sound?: boolean;
}

/**
 * Hook pour le feedback utilisateur amélioré
 * Gère les notifications haptiques, visuelles et sonores
 */
export const useFeedback = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackOptions | null>(null);

  /**
   * Déclenche un feedback utilisateur
   */
  const showFeedback = useCallback((options: FeedbackOptions) => {
    const {
      message,
      type = 'info',
      duration = 3000,
      haptic = true,
      sound = true
    } = options;

    // Feedback haptique
    if (haptic && Platform.OS !== 'web') {
      triggerHaptic(type);
    }

    // Feedback sonore (simulé pour l'instant)
    if (sound && Platform.OS !== 'web') {
      // TODO: Implémenter les sons selon le type
      playSound(type);
    }

    // Feedback visuel
    setCurrentFeedback({ message, type, duration });
    setIsVisible(true);

    // Auto-hide après la durée
    setTimeout(() => {
      setIsVisible(false);
    }, duration);
  }, []);

  /**
   * Cache manuellement le feedback
   */
  const hideFeedback = useCallback(() => {
    setIsVisible(false);
    setCurrentFeedback(null);
  }, []);

  /**
   * Déclenche le feedback haptique selon le type
   */
  const triggerHaptic = useCallback((type: FeedbackType) => {
    try {
      switch (type) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'info':
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    } catch (error) {
      // Silently fail if haptics not available
      console.warn('Haptic feedback not available:', error);
    }
  }, []);

  /**
   * Joue un son selon le type (placeholder)
   */
  const playSound = useCallback((type: FeedbackType) => {
    // TODO: Implémenter les sons avec expo-av
    console.log(`Playing ${type} sound`);
  }, []);

  /**
   * Raccourcis pour les types de feedback courants
   */
  const success = useCallback((message: string, options?: Partial<FeedbackOptions>) => {
    showFeedback({ message, type: 'success', ...options });
  }, [showFeedback]);

  const error = useCallback((message: string, options?: Partial<FeedbackOptions>) => {
    showFeedback({ message, type: 'error', ...options });
  }, [showFeedback]);

  const warning = useCallback((message: string, options?: Partial<FeedbackOptions>) => {
    showFeedback({ message, type: 'warning', ...options });
  }, [showFeedback]);

  const info = useCallback((message: string, options?: Partial<FeedbackOptions>) => {
    showFeedback({ message, type: 'info', ...options });
  }, [showFeedback]);

  /**
   * Affiche une alerte native avec haptics
   */
  const alert = useCallback((title: string, message: string, type?: FeedbackType) => {
    if (type) {
      triggerHaptic(type);
    }
    
    Alert.alert(title, message, [{ text: 'OK' }], { cancelable: false });
  }, [triggerHaptic]);

  /**
   * Affiche une confirmation avec haptics
   */
  const confirm = useCallback(
    (title: string, message: string, onConfirm: () => void, type?: FeedbackType) => {
      if (type) {
        triggerHaptic(type);
      }
      
      Alert.alert(
        title,
        message,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Confirmer', onPress: onConfirm }
        ],
        { cancelable: false }
      );
    },
    [triggerHaptic]
  );

  return {
    // État
    isVisible,
    currentFeedback,
    
    // Actions
    showFeedback,
    hideFeedback,
    
    // Raccourcis
    success,
    error,
    warning,
    info,
    
    // Alertes natives
    alert,
    confirm,
  };
};

/**
 * Hook pour les animations de feedback visuel
 */
export const useFeedbackAnimations = () => {
  const [animations, setAnimations] = useState<Record<string, boolean>>({});

  const triggerAnimation = useCallback((key: string, duration: number = 1000) => {
    setAnimations(prev => ({ ...prev, [key]: true }));
    
    setTimeout(() => {
      setAnimations(prev => ({ ...prev, [key]: false }));
    }, duration);
  }, []);

  const isAnimating = useCallback((key: string) => {
    return animations[key] || false;
  }, [animations]);

  return {
    triggerAnimation,
    isAnimating,
  };
};

export default useFeedback;

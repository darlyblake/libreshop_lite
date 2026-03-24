/**
 * Hook pour la réduction de mouvement (accessibilité)
 * Détecte les préférences utilisateur et ajuste les animations
 */

import { useState, useEffect, useMemo } from 'react';
import { useThemeContext } from '../context/ThemeContext';

interface ReducedMotionConfig {
  enableAutoDetection: boolean;
  forceReducedMotion: boolean;
  customAnimationDuration?: number;
}

export const useReducedMotion = (config: ReducedMotionConfig = {
  enableAutoDetection: true,
  forceReducedMotion: false,
}) => {
  const { theme } = useThemeContext();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [customDuration, setCustomDuration] = useState(config.customAnimationDuration || 300);

  // Détection automatique des préférences
  useEffect(() => {
    if (!config.enableAutoDetection) return;

    const checkMotionPreferences = () => {
      // Vérifier les préférences système
      if (typeof window !== 'undefined' && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        // Écouter les changements
        const handleChange = (e: MediaQueryListEvent) => {
          setPrefersReducedMotion(e.matches);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
    };

    checkMotionPreferences();
  }, [config.enableAutoDetection]);

  // Configuration des animations
  const animationConfig = useMemo(() => ({
    duration: config.forceReducedMotion || prefersReducedMotion ? 0 : customDuration,
    useNativeDriver: !(config.forceReducedMotion || prefersReducedMotion),
    scale: config.forceReducedMotion || prefersReducedMotion ? 1 : 0.95,
    opacity: config.forceReducedMotion || prefersReducedMotion ? 1 : 0.8,
    delay: config.forceReducedMotion || prefersReducedMotion ? 0 : 50,
  }), [config.forceReducedMotion, prefersReducedMotion, customDuration]);

  // Styles d'animation adaptés
  const getAnimationStyles = useMemo(() => ({
    // Animation de fade
    fade: {
      opacity: animationConfig.opacity,
    },
    
    // Animation de scale
    scale: {
      transform: [{ scale: animationConfig.scale }],
    },
    
    // Animation de slide
    slide: {
      transform: [{ translateY: animationConfig.duration > 0 ? 10 : 0 }],
    },
    
    // Animation de rotation
    rotate: {
      transform: [{ rotate: animationConfig.duration > 0 ? '180deg' : '0deg' }],
    },
  }), [animationConfig]);

  // Fonctions d'animation adaptatives
  const animateWithReduction = useMemo(() => ({
    // Animation de fade
    fade: (animatedValue: any, toValue: number) => {
      return {
        duration: animationConfig.duration,
        useNativeDriver: animationConfig.useNativeDriver,
        toValue,
      };
    },
    
    // Animation de scale
    scale: (animatedValue: any, toValue: number) => {
      return {
        duration: animationConfig.duration,
        useNativeDriver: animationConfig.useNativeDriver,
        toValue,
      };
    },
    
    // Animation de sequence
    sequence: (animations: any[]) => {
      if (animationConfig.duration === 0) {
        return animations.map(anim => ({ ...anim, duration: 0 }));
      }
      return animations;
    },
  }), [animationConfig]);

  return {
    ...theme,
    // État
    prefersReducedMotion,
    animationConfig,
    
    // Styles
    getAnimationStyles,
    
    // Fonctions
    animateWithReduction,
    
    // Actions
    setCustomDuration,
    toggleReducedMotion: () => setPrefersReducedMotion(!prefersReducedMotion),
  };
};

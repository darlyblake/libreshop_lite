import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withSequence,
  withTiming,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { COLORS, SPACING, FONT_SIZE } from '../config/theme';
import { productLikesService } from '../lib/productLikesService';
import { useAuthStore } from '../store';

interface LikeButtonProps {
  productId: string;
  userId?: string; // Optionnel car on peut utiliser useAuthStore
  initialLiked?: boolean;
  initialCount?: number;
  onLikeChange?: (liked: boolean, count: number) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outline' | 'rounded';
  showCount?: boolean;
  showLabel?: boolean;
  disabled?: boolean;
  hapticFeedback?: boolean;
  testID?: string;
}

type SizeConfig = {
  icon: number;
  text: number;
  padding: number;
  gap: number;
};

const SIZE_CONFIG: Record<'small' | 'medium' | 'large', SizeConfig> = {
  small: {
    icon: 16,
    text: 11,
    padding: SPACING.xs,
    gap: SPACING.xs,
  },
  medium: {
    icon: 20,
    text: 12,
    padding: SPACING.xs,
    gap: SPACING.xs,
  },
  large: {
    icon: 24,
    text: 14,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
};

export const LikeButton: React.FC<LikeButtonProps> = memo(({
  productId,
  userId: propUserId,
  initialLiked = false,
  initialCount = 0,
  onLikeChange,
  size = 'medium',
  variant = 'default',
  showCount = true,
  showLabel = false,
  disabled = false,
  hapticFeedback = true,
  testID,
}) => {
  const { user } = useAuthStore();
  const effectiveUserId = propUserId || user?.id;

  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Valeurs partagées pour les animations
  const scale = useSharedValue(1);
  const heartScale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const sizeConfig = SIZE_CONFIG[size];

  // Charger les données initiales
  useEffect(() => {
    if (!effectiveUserId || !productId) {
      setLiked(false);
      setLikeCount(0);
      return;
    }

    loadLikeData();
  }, [effectiveUserId, productId]);

  const loadLikeData = async (): Promise<void> => {
    try {
      const [hasLiked, count] = await Promise.all([
        productLikesService.hasLiked(effectiveUserId!, productId),
        productLikesService.getLikesCount(productId),
      ]);
      setLiked(hasLiked);
      setLikeCount(count);
      setError(null);
    } catch (error) {
      console.error('Error loading like data:', error);
      setError('Erreur de chargement');
    }
  };

  // Animation du cœur
  const animateHeart = (): void => {
    'worklet';
    heartScale.value = withSequence(
      withSpring(1.3, { damping: 2, stiffness: 200 }),
      withSpring(1, { damping: 4, stiffness: 300 })
    );
    
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
  };

  // Animation de pulsation (quand on ajoute un like)
  const animatePulse = (): void => {
    'worklet';
    opacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withTiming(1, { duration: 100 }),
      withTiming(0.7, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
  };

  // Styles animés
  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const heartAnimatedStyles = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const countAnimatedStyles = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Feedback haptique
  const triggerHaptic = (type: 'light' | 'success' | 'warning'): void => {
    if (!hapticFeedback) return;
    
    try {
      const Haptics = require('expo-haptics');
      if (type === 'light') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      // Haptics non disponible
    }
  };

  const handleLike = useCallback(async (): Promise<void> => {
    if (!effectiveUserId) {
      Alert.alert(
        'Connexion requise',
        'Vous devez être connecté pour aimer ce produit',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => console.log('Navigate to login') }
        ]
      );
      return;
    }

    if (loading || disabled) return;

    setLoading(true);
    setError(null);

    // Optimistic update
    const previousLiked = liked;
    const previousCount = likeCount;
    
    const newLiked = !liked;
    const newCount = newLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    
    setLiked(newLiked);
    setLikeCount(newCount);

    // Animation
    runOnJS(animateHeart)();
    if (newLiked) {
      runOnJS(animatePulse)();
    }
    runOnJS(triggerHaptic)(newLiked ? 'success' : 'light');

    try {
      console.log('Toggling like for product', productId, 'user', effectiveUserId);
      const result = await productLikesService.toggleLike(effectiveUserId, productId);
      console.log('Like toggle result:', result);
      
      // Vérifier que le résultat correspond à l'optimistic update
      if (result !== newLiked) {
        console.log('Incohérence détectée, recharging like data');
        // Incohérence, recharger les données
        await loadLikeData();
      } else {
        // Recharger juste le compteur pour être sûr
        const count = await productLikesService.getLikesCount(productId);
        setLikeCount(count);
      }
      
      onLikeChange?.(result, newCount);
    } catch (error) {
      console.error('Error toggling like:', error);
      
      // Rollback en cas d'erreur
      setLiked(previousLiked);
      setLikeCount(previousCount);
      setError('Action impossible');
      
      runOnJS(triggerHaptic)('warning');
      
      Alert.alert(
        'Erreur',
        `Impossible d'effectuer cette action: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      );
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, productId, liked, likeCount, loading, disabled]);

  const getButtonStyle = () => {
    const baseStyle = [styles.button, { gap: sizeConfig.gap }];
    
    switch (variant) {
      case 'outline':
        return [
          ...baseStyle,
          styles.buttonOutline,
          { borderColor: liked ? COLORS.danger : COLORS.border },
        ];
      case 'rounded':
        return [
          ...baseStyle,
          styles.buttonRounded,
          { 
            backgroundColor: liked ? COLORS.danger + '15' : 'transparent',
            borderColor: liked ? COLORS.danger + '30' : COLORS.border,
          },
        ];
      default:
        return baseStyle;
    }
  };

  const getIconColor = (): string => {
    if (disabled) return COLORS.textMuted;
    if (liked) return COLORS.danger;
    return COLORS.white;
  };

  const getTextColor = (): string => {
    if (disabled) return COLORS.textMuted;
    if (liked) return COLORS.danger;
    return COLORS.white;
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <TouchableOpacity onPress={loadLikeData} disabled={loading}>
          <Ionicons name="refresh" size={sizeConfig.icon} color={COLORS.warning} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, animatedStyles]}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handleLike}
        disabled={loading || disabled}
        activeOpacity={0.7}
        testID={testID}
      >
        <Animated.View style={heartAnimatedStyles}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={sizeConfig.icon}
            color={getIconColor()}
          />
        </Animated.View>

        {showCount && (
          <Animated.Text 
            style={[
              styles.count, 
              { 
                fontSize: sizeConfig.text,
                color: getTextColor(),
              },
              countAnimatedStyles,
            ]}
          >
            {likeCount > 0 ? likeCount.toLocaleString() : '0'}
          </Animated.Text>
        )}

        {showLabel && (
          <Text 
            style={[
              styles.label,
              { 
                fontSize: sizeConfig.text,
                color: getTextColor(),
              }
            ]}
          >
            {liked ? 'J\'aime' : 'J\'aime'}
          </Text>
        )}

        {loading && (
          <ActivityIndicator 
            size="small" 
            color={liked ? COLORS.danger : COLORS.textSecondary} 
            style={styles.loader}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: SPACING.xs,
  },
  buttonOutline: {
    borderWidth: 1,
    borderRadius: SPACING.md,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  buttonRounded: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  count: {
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  label: {
    fontWeight: '500',
    marginLeft: SPACING.xs,
  },
  loader: {
    marginLeft: SPACING.xs,
  },
  errorContainer: {
    padding: SPACING.xs,
  },
});

LikeButton.displayName = 'LikeButton';

export default LikeButton;
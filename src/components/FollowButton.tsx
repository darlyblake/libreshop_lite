import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withSequence,
  withTiming,
  useSharedValue,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { shopFollowService } from '../lib/shopFollowService';
import { authService } from '../lib/supabase';
import { useAuthStore } from '../store';

interface FollowButtonProps {
  storeId: string;
  userId?: string;
  initialFollowing?: boolean;
  initialFollowerCount?: number;
  onFollowChange?: (following: boolean, count: number) => void;
  storeName?: string;
  variant?: 'primary' | 'outline' | 'minimal';
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  showCount?: boolean;
  showLabel?: boolean;
  disabled?: boolean;
  hapticFeedback?: boolean;
  style?: any;
  testID?: string;
}

type SizeConfig = {
  icon: number;
  fontSize: number;
  paddingVertical: number;
  paddingHorizontal: number;
  gap: number;
  borderRadius: number;
};

const getSizeConfig = (SPACING: any, RADIUS: any): Record<'small' | 'medium' | 'large', SizeConfig> => ({
  small: {
    icon: 16,
    fontSize: 12,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  medium: {
    icon: 18,
    fontSize: 14,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  large: {
    icon: 22,
    fontSize: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
  },
});

export const FollowButton: React.FC<FollowButtonProps> = memo(({
  storeId,
  userId: propUserId,
  initialFollowing = false,
  initialFollowerCount = 0,
  onFollowChange,
  storeName = 'cette boutique',
  variant = 'primary',
  size = 'medium',
  showIcon = true,
  showCount = true,
  showLabel = true,
  disabled = false,
  hapticFeedback = true,
  style,
  testID,
}) => {
  const { user } = useAuthStore();
  const effectiveUserId = propUserId || user?.id;

  const themeContext = useTheme();
  const { theme, getColor: COLORS, spacing: SPACING, radius: RADIUS } = themeContext;
  
  const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(themeContext) : ({} as any), [themeContext]);

  const [following, setFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Valeurs partagées pour les animations
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const countOpacity = useSharedValue(1);
  const buttonWidth = useSharedValue(0);

  const sizeConfig = React.useMemo(() => getSizeConfig(SPACING, RADIUS)[size], [SPACING, RADIUS, size]);

  // Animation de pulsation pour le bouton
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Animation de rotation pour l'icône
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  // Animation pour le compteur
  const countAnimatedStyle = useAnimatedStyle(() => ({
    opacity: countOpacity.value,
    transform: [{ scale: interpolate(countOpacity.value, [0, 1], [0.5, 1]) }],
  }));

  // Charger les données
  useEffect(() => {
    if (!effectiveUserId || !storeId) {
      setFollowing(false);
      setFollowerCount(0);
      return;
    }

    loadFollowData();
  }, [effectiveUserId, storeId]);

  const loadFollowData = useCallback(async (): Promise<void> => {
    try {
      const [isFollowing, count] = await Promise.all([
        shopFollowService.isFollowing(effectiveUserId!, storeId),
        shopFollowService.getFollowersCount(storeId),
      ]);
      setFollowing(isFollowing);
      setFollowerCount(count);
      setError(null);
    } catch (error: any) {
      errorHandler.handleDatabaseError(error, 'Error loading follow data:');
      setError('Erreur de chargement');
    }
  }, [effectiveUserId, storeId]);

  // Animation de clic
  const animateClick = useCallback((): void => {
    'worklet';
    scale.value = withSequence(
      withSpring(0.9, { damping: 2, stiffness: 200 }),
      withSpring(1, { damping: 4, stiffness: 300 })
    );
    
    if (!following) {
      rotate.value = withSequence(
        withTiming(10, { duration: 100 }),
        withTiming(-10, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
    }

    countOpacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
  }, [following]);

  // Feedback haptique
  const triggerHaptic = useCallback((type: 'light' | 'success' | 'warning'): void => {
    if (!hapticFeedback) return;
    
    try {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
      }
    } catch (error) {
      // Haptics non disponible
    }
  }, [hapticFeedback]);

  const handleFollow = useCallback(async (): Promise<void> => {
    if (!effectiveUserId) {
      try {
        const { data: { session } } = await authService.signInAnonymously();
        if (!session?.user) throw new Error('Auth failed');
        Alert.alert('Presque fini', `Identité créée. Réessayez de suivre ${storeName} !`);
        return;
      } catch (err) {
        Alert.alert('Action impossible', 'Veuillez vérifier votre connexion internet.');
        return;
      }
    }

    if (!storeId || storeId === '' || storeId === 'undefined') {
      console.warn('[FollowButton] storeId invalide, action ignorée:', storeId);
      return;
    }

    if (loading || disabled) return;

    setLoading(true);
    setError(null);

    // Optimistic update
    const previousFollowing = following;
    const previousCount = followerCount;
    
    const newFollowing = !following;
    const newCount = newFollowing ? followerCount + 1 : Math.max(0, followerCount - 1);
    
    setFollowing(newFollowing);
    setFollowerCount(newCount);

    // Animation
    runOnJS(animateClick)();
    runOnJS(triggerHaptic)(newFollowing ? 'success' : 'light');

    try {
      const result = await shopFollowService.toggleFollow(effectiveUserId, storeId);
      
      // Vérifier la cohérence
      if (result !== newFollowing) {
        // Recharger les données en cas d'incohérence
        await loadFollowData();
      } else {
        // Mettre à jour le compteur
        const count = await shopFollowService.getFollowersCount(storeId);
        setFollowerCount(count);
      }
      
      onFollowChange?.(result, newCount);
    } catch (error: any) {
      errorHandler.handleDatabaseError(error, 'Error toggling follow:');
      
      // Rollback
      setFollowing(previousFollowing);
      setFollowerCount(previousCount);
      setError('Action impossible');
      
      runOnJS(triggerHaptic)('warning');
      
      Alert.alert(
        'Erreur',
        `Impossible de ${newFollowing ? 'suivre' : 'ne plus suivre'} ${storeName}. Veuillez réessayer.`
      );
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, storeId, following, followerCount, loading, disabled, storeName]);

  const getButtonStyles = (): any[] => {
    const baseStyles = [
      styles.button,
      {
        paddingVertical: sizeConfig.paddingVertical,
        paddingHorizontal: sizeConfig.paddingHorizontal,
        gap: sizeConfig.gap,
        borderRadius: sizeConfig.borderRadius,
      },
      buttonAnimatedStyle,
    ];

    if (disabled) {
      return [...baseStyles, styles.disabled];
    }

    if (following) {
      switch (variant) {
        case 'outline':
          return [...baseStyles, styles.followingOutline];
        case 'minimal':
          return [...baseStyles, styles.followingMinimal];
        default:
          return [...baseStyles, styles.followingPrimary];
      }
    }

    switch (variant) {
      case 'outline':
        return [...baseStyles, styles.followOutline];
      case 'minimal':
        return [...baseStyles, styles.followMinimal];
      default:
        return [...baseStyles, styles.followPrimary];
    }
  };

  const getTextColor = (): string => {
    if (disabled) return COLORS.textMuted;
    if (following) {
      switch (variant) {
        case 'primary':
          return COLORS.text;
        case 'outline':
          return COLORS.success;
        case 'minimal':
          return COLORS.success;
        default:
          return COLORS.text;
      }
    }
    return COLORS.text;
  };

  const getIconColor = (): string => {
    if (disabled) return COLORS.textMuted;
    if (following) {
      switch (variant) {
        case 'outline':
          return COLORS.success;
        case 'minimal':
          return COLORS.success;
        default:
          return COLORS.text;
      }
    }
    return COLORS.text;
  };

  const getBackgroundGradient = (): [string, string] | null => {
    if (disabled || following || variant !== 'primary') return null;
    return [COLORS.accent, COLORS.accent2];
  };

  if (error) {
    return (
      <TouchableOpacity
        style={[styles.errorContainer, style]}
        onPress={loadFollowData}
        disabled={loading}
      >
        <Ionicons name="refresh" size={sizeConfig.icon} color={COLORS.warning} />
        <Text style={[styles.errorText, { fontSize: sizeConfig.fontSize }]}>
          Réessayer
        </Text>
      </TouchableOpacity>
    );
  }

  const ButtonContent = () => (
    <Animated.View style={getButtonStyles()}>
      {showIcon && (
        <Animated.View style={iconAnimatedStyle}>
          <Ionicons
            name={following ? 'checkmark' : 'add'}
            size={sizeConfig.icon}
            color={getIconColor()}
          />
        </Animated.View>
      )}

      {showLabel && (
        <Text
          style={[
            styles.text,
            {
              fontSize: sizeConfig.fontSize,
              color: getTextColor(),
            },
          ]}
        >
          {following ? 'Suivi(e)' : 'Suivre'}
        </Text>
      )}

      {showCount && (
        <Animated.Text
          style={[
            styles.count,
            {
              fontSize: sizeConfig.fontSize * 0.8,
              color: getTextColor(),
            },
            countAnimatedStyle,
          ]}
        >
          {followerCount > 0 ? followerCount.toLocaleString() : '0'}
        </Animated.Text>
      )}

      {loading && (
        <ActivityIndicator
          size="small"
          color={getTextColor()}
          style={styles.loader}
        />
      )}
    </Animated.View>
  );

  return (
    <TouchableOpacity
      onPress={handleFollow}
      disabled={loading || disabled}
      activeOpacity={0.7}
      testID={testID}
      style={style}
    >
      {getBackgroundGradient() ? (
        <LinearGradient
          colors={getBackgroundGradient()!}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientButton,
            {
              borderRadius: sizeConfig.borderRadius,
            },
          ]}
        >
          <ButtonContent />
        </LinearGradient>
      ) : (
        <ButtonContent />
      )}
    </TouchableOpacity>
  );
});

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Variantes suivre
    followPrimary: {
      backgroundColor: COLORS.accent,
    },
    followOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.accent,
    },
    followMinimal: {
      backgroundColor: 'transparent',
    },
    // Variantes suivi
    followingPrimary: {
      backgroundColor: COLORS.success,
    },
    followingOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.success,
    },
    followingMinimal: {
      backgroundColor: 'transparent',
    },
    disabled: {
      opacity: 0.5,
      backgroundColor: COLORS.textMuted,
    },
    text: {
      fontWeight: '600',
    },
    count: {
      fontWeight: '500',
      opacity: 0.9,
    },
    loader: {
      marginLeft: SPACING.xs,
    },
    gradientButton: {
      overflow: 'hidden',
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      padding: SPACING.xs,
    },
    errorText: {
      color: COLORS.warning,
      fontWeight: '500',
    },
  });
};

FollowButton.displayName = 'FollowButton';

export default FollowButton;
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../config/theme';
import { productLikesService } from '../lib/productLikesService';

interface LikeButtonProps {
  userId: string;
  productId: string;
  onLikeChange?: (liked: boolean) => void;
  size?: number;
  showCount?: boolean;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
  userId,
  productId,
  onLikeChange,
  size = 24,
  showCount = true,
}) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLikeData();
  }, [userId, productId]);

  const loadLikeData = async () => {
    if (!userId || !productId) {
      setLiked(false);
      setLikeCount(0);
      return;
    }

    try {
      const [hasLiked, count] = await Promise.all([
        productLikesService.hasLiked(userId, productId),
        productLikesService.getLikesCount(productId),
      ]);
      setLiked(hasLiked);
      setLikeCount(count);
    } catch (error) {
      console.warn('Error loading like data:', error);
    }
  };

  const handleLike = async () => {
    if (!userId || !productId) {
      console.warn('User not connected or product not found');
      return;
    }

    if (loading) return;

    setLoading(true);
    try {
      const newLiked = await productLikesService.toggleLike(userId, productId);
      setLiked(newLiked);
      
      // Mettre à jour le compteur
      const count = await productLikesService.getLikesCount(productId);
      setLikeCount(count);
      
      onLikeChange?.(newLiked);
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleLike}
        disabled={loading || !userId}
        activeOpacity={0.7}
      >
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={size}
          color={liked ? COLORS.danger : COLORS.textSecondary}
        />
        {showCount && (
          <Text style={[styles.count, { color: liked ? COLORS.danger : COLORS.textSecondary }]}>
            {likeCount}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 40,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
  },
});

import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { shopFollowService } from '../lib/shopFollowService';

interface FollowButtonProps {
  userId: string;
  storeId: string;
  onFollowChange?: (following: boolean) => void;
  storeName?: string;
  style?: any;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  storeId,
  onFollowChange,
  storeName = 'Boutique',
  style,
}) => {
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFollowData();
  }, [userId, storeId]);

  const loadFollowData = async () => {
    try {
      const [isFollowing, count] = await Promise.all([
        shopFollowService.isFollowing(userId, storeId),
        shopFollowService.getFollowersCount(storeId),
      ]);
      setFollowing(isFollowing);
      setFollowerCount(count);
    } catch (error) {
      console.warn('Error loading follow data:', error);
    }
  };

  const handleFollow = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const newFollowing = await shopFollowService.toggleFollow(userId, storeId);
      setFollowing(newFollowing);
      
      // Mettre à jour le compteur
      const count = await shopFollowService.getFollowersCount(storeId);
      setFollowerCount(count);
      
      onFollowChange?.(newFollowing);
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <TouchableOpacity style={[styles.button, styles.loading, style]} disabled>
        <ActivityIndicator color={COLORS.white} size="small" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        following ? styles.buttonFollowing : styles.buttonFollow,
        style,
      ]}
      onPress={handleFollow}
      activeOpacity={0.7}
    >
      <Ionicons
        name={following ? 'checkmark' : 'add'}
        size={18}
        color={following ? COLORS.success : COLORS.white}
      />
      <Text style={[styles.text, { color: following ? COLORS.success : COLORS.white }]}>
        {following ? 'Suivi' : 'Suivre'}
      </Text>
      <Text style={[styles.count, { color: following ? COLORS.success : COLORS.white }]}>
        ({followerCount})
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  buttonFollow: {
    backgroundColor: COLORS.primary,
  },
  buttonFollowing: {
    backgroundColor: COLORS.lightBackground,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  loading: {
    backgroundColor: COLORS.primary,
    opacity: 0.6,
  },
  text: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  count: {
    fontSize: FONT_SIZE.xs,
    opacity: 0.8,
  },
});

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';

const { width } = Dimensions.get('window');

interface StoreHeaderProps {
  store: {
    id: string;
    name: string;
    category: string;
    logo_url?: string;
    banner_url?: string;
    description?: string;
    verified?: boolean;
    rating?: number;
    rating_count?: number;
  };
  onShare?: () => void;
  onContact?: () => void;
  onFollow?: () => void;
}

const FALLBACK_BANNER = 'https://picsum.photos/800/400?random=1';
const FALLBACK_LOGO = 'https://via.placeholder.com/100/ffffff/7C3AED?text=S';

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  store,
  onShare,
  onContact,
  onFollow,
}) => {
  const bannerUrl = store.banner_url || FALLBACK_BANNER;
  const logoUrl = store.logo_url || FALLBACK_LOGO;
  const rating = store.rating || 4.7;
  const ratingCount = store.rating_count || 312;

  const logoAnim = React.useRef(new Animated.Value(0)).current;

  const pulseAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  React.useEffect(() => {
    Animated.spring(logoAnim, {
      toValue: 1,
      friction: 8,
      tension: 80,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [logoAnim]);

  const renderStarRating = (avg: number) => {
    const safe = Number.isFinite(avg) ? Math.max(0, Math.min(5, avg)) : 0;
    const full = Math.floor(safe);
    const half = safe - full >= 0.5;

    return (
      <View style={styles.starsRow}>
        {[...Array(5)].map((_, i) => {
          if (i < full)
            return (
              <Ionicons
                key={i}
                name="star"
                size={16}
                color="#FFD700"
              />
            );
          if (i === full && half)
            return (
              <Ionicons
                key={i}
                name="star-half"
                size={16}
                color="#FFD700"
              />
            );
          return (
            <Ionicons
              key={i}
              name="star-outline"
              size={16}
              color="#FFD700"
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Large Banner with content overlaid */}
      <View style={styles.bannerContainer}>
        <Image
          source={{ uri: bannerUrl }}
          style={styles.banner}
          resizeMode="cover"
        />
        <View style={styles.bannerOverlay} />

        {/* Content INSIDE banner */}
        <View style={styles.bannerContent}>
          {/* Logo top-left */}
          <View style={styles.logoWrapper} pointerEvents="none">
            <Animated.View
              style={[
                styles.logoPulse,
                {
                  transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                  opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                },
              ]}
            />
            <Animated.Image
              source={{ uri: logoUrl }}
              style={[
                styles.logo,
                {
                  transform: [
                    { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                    { scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
                  ],
                  opacity: logoAnim,
                },
              ]}
              resizeMode="cover"
            />
          </View>

          {/* Top right: Store name + rating + status */}
          <View style={styles.topRight}>
            <View>
              <Text style={styles.storeName}>{store.name}</Text>
              <View style={styles.ratingStatusRow}>
                {renderStarRating(rating)}
                <Text style={styles.ratingNumber}>⭐ {rating.toFixed(1)}</Text>
                <Text style={styles.ratingCount}> 🟣 {ratingCount}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.openBadge}
              onPress={onContact}
            >
              <Ionicons name="location" size={14} color="#7C3AED" />
              <Text style={styles.openText}>Ouvert maintenant</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
  },
  bannerContainer: {
    position: 'relative',
    height: 340,
    overflow: 'visible',
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  bannerContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    paddingLeft: SPACING.lg + 130,
  },
  logoWrapper: {
    position: 'absolute',
    left: SPACING.lg,
    bottom: SPACING.lg,
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
    }),
    zIndex: 20,
  },
  logo: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  logoPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.primary,
    left: -8,
    top: -8,
  },
  topRight: {
    flex: 1,
    marginLeft: SPACING.lg,
    justifyContent: 'space-between',
    height: '100%',
  },
  storeName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  ratingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingNumber: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  ratingCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.white,
    fontWeight: '500',
  },
  openBadge: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
  },
  openText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primary || '#7C3AED',
  },
  descriptionContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  description: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    color: COLORS.text,
  },
});

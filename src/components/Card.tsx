import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { cloudinaryService } from '../services/cloudinaryService';

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
    card: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.xl,
    },
    // Store Card Styles
    storeCard: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.xl,
      alignItems: 'center',
      minHeight: 200,
      justifyContent: 'space-between',
    },
    storeImageContainer: {
      marginBottom: SPACING.md,
    },
    storeImage: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 2,
      borderColor: COLORS.accent,
    },
    storeImagePlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: COLORS.accent + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    storeImagePlaceholderText: {
      fontSize: FONT_SIZE.xl,
      fontWeight: '700',
      color: COLORS.accent,
    },
    storeName: {
      fontSize: FONT_SIZE.md,
      fontWeight: '700',
      color: COLORS.text,
      textAlign: 'center',
      marginBottom: 2,
    },
    storeCategory: {
      fontSize: 10,
      color: COLORS.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    storeDescription: {
      fontSize: FONT_SIZE.xs,
      color: COLORS.textSoft,
      textAlign: 'center',
      marginBottom: SPACING.md,
    },
    statsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: SPACING.xs,
      marginTop: 'auto',
    },
    statBadge: {
      backgroundColor: COLORS.borderLight,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)',
    },
    statBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: COLORS.textSoft,
    },
    // Product Card Styles
    productCard: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    productImageContainer: {
      aspectRatio: 0.5,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    productImage: {
      width: '100%',
      height: '100%',
    },
    productImagePlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    productImagePlaceholderText: {
      fontSize: 40,
    },
    productName: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      color: COLORS.text,
      padding: SPACING.sm,
      paddingBottom: SPACING.xs,
    },
    priceContainer: {
      paddingHorizontal: SPACING.sm,
      paddingBottom: SPACING.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    productPrice: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '700',
      color: COLORS.accent,
    },
    productComparePrice: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.textMuted,
      textDecorationLine: 'line-through',
    },
    promoBadge: {
      position: 'absolute',
      top: SPACING.sm,
      left: SPACING.sm,
      backgroundColor: '#FF3B30',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
      elevation: 4,
    },
    promoBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
};

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
  const themeContext = useTheme();
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {children}
    </Wrapper>
  );
};

// Store Card Component
interface StoreCardProps {
  name: string;
  category: string;
  description?: string;
  logoUrl?: string;
  productCount?: number;
  followersCount?: number;
  orderCount?: number;
  onPress: () => void;
}

export const StoreCard: React.FC<StoreCardProps> = ({
  name,
  category,
  description,
  logoUrl,
  productCount,
  followersCount,
  orderCount,
  onPress,
}) => {
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  return (
    <TouchableOpacity style={styles.storeCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.storeImageContainer}>
        {logoUrl ? (
          <Image source={{ uri: cloudinaryService.getOptimizedUrl(logoUrl, 150) }} style={styles.storeImage} />
        ) : (
          <View style={styles.storeImagePlaceholder}>
            <Text style={styles.storeImagePlaceholderText}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.storeName}>{name}</Text>
      <Text style={styles.storeCategory}>{category}</Text>
      {description && <Text style={styles.storeDescription}>{description}</Text>}
      <View style={styles.statsContainer}>
        {orderCount !== undefined && orderCount > 0 && (
          <View style={[styles.statBadge, { backgroundColor: COLORS.success + '20' }]}>
            <Text style={[styles.statBadgeText, { color: COLORS.success }]}>📦 {orderCount}</Text>
          </View>
        )}
        {followersCount !== undefined && followersCount > 0 && (
          <View style={[styles.statBadge, { backgroundColor: COLORS.accent + '20' }]}>
            <Text style={[styles.statBadgeText, { color: COLORS.accent }]}>👤 {followersCount}</Text>
          </View>
        )}
        {productCount !== undefined && (
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeText}>{productCount} prod.</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Product Card Component
interface ProductCardProps {
  name: string;
  price: number;
  comparePrice?: number;
  imageUrl?: string;
  onPress: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  price,
  comparePrice,
  imageUrl,
  onPress,
}) => {
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  return (
    <TouchableOpacity style={styles.productCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.productImageContainer}>
        {imageUrl ? (
          <Image source={{ uri: cloudinaryService.getOptimizedUrl(imageUrl, 400) }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.productImagePlaceholderText}>📦</Text>
          </View>
        )}
        {comparePrice && comparePrice > (price || 0) && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>PROMO</Text>
          </View>
        )}
      </View>
      <Text style={styles.productName} numberOfLines={2}>{name}</Text>
      <View style={styles.priceContainer}>
        <Text style={styles.productPrice}>{(price || 0).toLocaleString()} FCFA</Text>
        {comparePrice && comparePrice > (price || 0) && (
          <Text style={styles.productComparePrice}>
            {comparePrice.toLocaleString()}FCFA
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};


import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../config/theme';

interface SkeletonLoaderProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = RADIUS.md,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Skeleton pour carte produit
export const ProductCardSkeleton: React.FC = () => (
  <View style={productCardStyles.container}>
    <SkeletonLoader height={100} borderRadius={RADIUS.md} />
    <View style={productCardStyles.content}>
      <SkeletonLoader width="80%" height={16} style={{ marginTop: SPACING.md }} />
      <SkeletonLoader width="50%" height={14} style={{ marginTop: SPACING.sm }} />
      <View style={productCardStyles.footer}>
        <SkeletonLoader width={80} height={24} borderRadius={RADIUS.sm} />
        <SkeletonLoader width={60} height={24} borderRadius={RADIUS.sm} />
      </View>
    </View>
  </View>
);

// Skeleton pour carte de commande
export const OrderCardSkeleton: React.FC = () => (
  <View style={orderCardStyles.container}>
    <View style={orderCardStyles.header}>
      <SkeletonLoader width={120} height={14} />
      <SkeletonLoader width={70} height={20} borderRadius={RADIUS.full} />
    </View>
    <View style={orderCardStyles.body}>
      <SkeletonLoader width={40} height={40} borderRadius={20} />
      <View style={orderCardStyles.info}>
        <SkeletonLoader width="60%" height={14} />
        <SkeletonLoader width="40%" height={12} style={{ marginTop: SPACING.xs }} />
      </View>
    </View>
    <SkeletonLoader width="100%" height={1} style={{ marginVertical: SPACING.md }} />
    <View style={orderCardStyles.footer}>
      <SkeletonLoader width="30%" height={16} />
      <SkeletonLoader width={100} height={32} borderRadius={RADIUS.md} />
    </View>
  </View>
);

// Skeleton pour carte client
export const ClientCardSkeleton: React.FC = () => (
  <View style={clientCardStyles.container}>
    <View style={clientCardStyles.header}>
      <SkeletonLoader width={48} height={48} borderRadius={24} />
      <View style={clientCardStyles.info}>
        <SkeletonLoader width="60%" height={16} />
        <SkeletonLoader width="40%" height={12} style={{ marginTop: SPACING.xs }} />
      </View>
    </View>
    <View style={clientCardStyles.stats}>
      <SkeletonLoader width="30%" height={40} borderRadius={RADIUS.sm} />
      <SkeletonLoader width="30%" height={40} borderRadius={RADIUS.sm} />
      <SkeletonLoader width="30%" height={40} borderRadius={RADIUS.sm} />
    </View>
  </View>
);

// Skeleton pour statistics
export const StatCardSkeleton: React.FC = () => (
  <View style={statCardStyles.container}>
    <SkeletonLoader width={40} height={40} borderRadius={RADIUS.sm} />
    <SkeletonLoader width="60%" height={12} style={{ marginTop: SPACING.md }} />
    <SkeletonLoader width="40%" height={24} style={{ marginTop: SPACING.sm }} />
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.border,
  },
});

const productCardStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  content: {
    marginTop: SPACING.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
});

const orderCardStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

const clientCardStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  info: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

const statCardStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
});


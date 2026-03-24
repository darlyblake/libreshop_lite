import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue, Platform } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface SkeletonLoaderProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius,
  style,
}) => {
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  
  const finalBorderRadius = borderRadius ?? RADIUS.md;
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
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
          borderRadius: finalBorderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Skeleton pour carte produit
export const ProductCardSkeleton: React.FC = () => {
  const themeContext = useTheme();
  const { spacing: SPACING, radius: RADIUS } = themeContext;
  const styles = React.useMemo(() => getProductCardStyles(themeContext), [themeContext]);
  
  return (
    <View style={styles.container}>
      <SkeletonLoader height={100} borderRadius={RADIUS.md} />
      <View style={styles.content}>
        <SkeletonLoader width="80%" height={16} style={{ marginTop: SPACING.md }} />
        <SkeletonLoader width="50%" height={14} style={{ marginTop: SPACING.sm }} />
        <View style={styles.footer}>
          <SkeletonLoader width={80} height={24} borderRadius={RADIUS.sm} />
          <SkeletonLoader width={60} height={24} borderRadius={RADIUS.sm} />
        </View>
      </View>
    </View>
  );
};

// Skeleton pour carte de commande
export const OrderCardSkeleton: React.FC = () => {
  const themeContext = useTheme();
  const { spacing: SPACING, radius: RADIUS } = themeContext;
  const styles = React.useMemo(() => getOrderCardStyles(themeContext), [themeContext]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SkeletonLoader width={120} height={14} />
        <SkeletonLoader width={70} height={20} borderRadius={RADIUS.full} />
      </View>
      <View style={styles.body}>
        <SkeletonLoader width={40} height={40} borderRadius={20} />
        <View style={styles.info}>
          <SkeletonLoader width="60%" height={14} />
          <SkeletonLoader width="40%" height={12} style={{ marginTop: SPACING.xs }} />
        </View>
      </View>
      <SkeletonLoader width="100%" height={1} style={{ marginVertical: SPACING.md }} />
      <View style={styles.footer}>
        <SkeletonLoader width="30%" height={16} />
        <SkeletonLoader width={100} height={32} borderRadius={RADIUS.md} />
      </View>
    </View>
  );
};

// Skeleton pour carte client
export const ClientCardSkeleton: React.FC = () => {
  const themeContext = useTheme();
  const { spacing: SPACING, radius: RADIUS } = themeContext;
  const styles = React.useMemo(() => getClientCardStyles(themeContext), [themeContext]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SkeletonLoader width={48} height={48} borderRadius={24} />
        <View style={styles.info}>
          <SkeletonLoader width="60%" height={16} />
          <SkeletonLoader width="40%" height={12} style={{ marginTop: SPACING.xs }} />
        </View>
      </View>
      <View style={styles.stats}>
        <SkeletonLoader width="30%" height={40} borderRadius={RADIUS.sm} />
        <SkeletonLoader width="30%" height={40} borderRadius={RADIUS.sm} />
        <SkeletonLoader width="30%" height={40} borderRadius={RADIUS.sm} />
      </View>
    </View>
  );
};

// Skeleton pour statistics
export const StatCardSkeleton: React.FC = () => {
  const themeContext = useTheme();
  const { spacing: SPACING, radius: RADIUS } = themeContext;
  const styles = React.useMemo(() => getStatCardStyles(themeContext), [themeContext]);

  return (
    <View style={styles.container}>
      <SkeletonLoader width={40} height={40} borderRadius={RADIUS.sm} />
      <SkeletonLoader width="60%" height={12} style={{ marginTop: SPACING.md }} />
      <SkeletonLoader width="40%" height={24} style={{ marginTop: SPACING.sm }} />
    </View>
  );
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  return StyleSheet.create({
    skeleton: {
      backgroundColor: COLORS.border,
    },
  });
};

const getProductCardStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  return StyleSheet.create({
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
};

const getOrderCardStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  return StyleSheet.create({
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
};

const getClientCardStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  return StyleSheet.create({
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
};

const getStatCardStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  return StyleSheet.create({
    container: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
    },
  });
};



import React from 'react';
import { View, StyleSheet, ViewStyle, Text, TouchableOpacity } from 'react-native';
import { useResponsive } from '../utils/useResponsive';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: boolean;
  center?: boolean;
  row?: boolean;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  style,
  padding = true,
  center = false,
  row = false,
}) => {
  const { spacing, component, isMobile, isTablet, isDesktop } = useResponsive();

  const containerStyle: ViewStyle = {
    flex: 1,
    padding: padding ? spacing.lg : 0,
    maxWidth: isDesktop ? 1200 : isTablet ? 800 : '100%',
    alignSelf: center ? 'center' : 'auto',
    width: '100%',
    flexDirection: row ? 'row' : 'column',
    ...style,
  };

  return <View style={containerStyle}>{children}</View>;
};

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns,
  gap,
}) => {
  const { grid, spacing } = useResponsive();

  const gridStyle: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gap || spacing.md,
    justifyContent: 'space-between',
  };

  return <View style={gridStyle}>{children}</View>;
};

interface ResponsiveGridItemProps {
  children: React.ReactNode;
  columns?: number;
  flex?: number;
}

export const ResponsiveGridItem: React.FC<ResponsiveGridItemProps> = ({
  children,
  columns,
  flex = 1,
}) => {
  const { grid, width, spacing } = useResponsive();

  const itemStyle: ViewStyle = {
    flex,
    minWidth: columns ? (width - spacing.md * (columns + 1)) / columns : 'auto',
  };

  return <View style={itemStyle}>{children}</View>;
};

interface ResponsiveCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  children,
  style,
}) => {
  const { component, spacing } = useResponsive();

  const cardStyle: ViewStyle = {
    backgroundColor: 'COLORS.text',
    borderRadius: component.cardBorderRadius,
    padding: component.cardPadding,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    // CSS box-shadow for web compatibility
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    ...style,
  };

  return <View style={cardStyle}>{children}</View>;
};

interface ResponsiveButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
}

export const ResponsiveButton: React.FC<ResponsiveButtonProps> = ({
  children,
  onPress,
  style,
  variant = 'primary',
  size = 'medium',
}) => {
  const { component, fontSize, spacing } = useResponsive();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: component.buttonBorderRadius,
      flexDirection: 'row',
    };

    // Size variants
    switch (size) {
      case 'small':
        return {
          ...baseStyle,
          height: component.buttonHeight * 0.8,
          paddingHorizontal: spacing.md,
        };
      case 'large':
        return {
          ...baseStyle,
          height: component.buttonHeight * 1.2,
          paddingHorizontal: spacing.xl,
        };
      default:
        return {
          ...baseStyle,
          height: component.buttonHeight,
          paddingHorizontal: component.buttonPadding,
        };
    }
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return { backgroundColor: 'COLORS.lightGray' };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: 'COLORS.gray',
        };
      default:
        return { backgroundColor: 'COLORS.categoryColors[5]' };
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), getVariantStyle(), style]}
      onPress={onPress}
    >
      <Text
        style={[
          {
            color: variant === 'primary' ? 'COLORS.text' : '#374151',
            fontSize: fontSize.md,
            fontWeight: '600',
          },
        ]}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
};

interface ResponsiveTextProps {
  children: React.ReactNode;
  variant?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'title' | 'titleLarge' | 'heading';
  color?: string;
  style?: any;
  center?: boolean;
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  children,
  variant = 'md',
  color = '#374151',
  style,
  center = false,
}) => {
  const { fontSize } = useResponsive();

  const textStyle = {
    fontSize: fontSize[variant],
    color,
    textAlign: center ? 'center' : 'auto',
    ...style,
  };

  return <Text style={textStyle}>{children}</Text>;
};

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'accent';
type BadgeSize = 'small' | 'medium' | 'large';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string;
  style?: ViewStyle;
}

const getVariantStyles = (variant: BadgeVariant) => {
  switch (variant) {
    case 'success':
      return { bg: COLORS.success + '20', text: COLORS.success };
    case 'warning':
      return { bg: COLORS.warning + '20', text: COLORS.warning };
    case 'danger':
      return { bg: COLORS.danger + '20', text: COLORS.danger };
    case 'accent':
      return { bg: COLORS.accent + '20', text: COLORS.accent };
    default:
      return { bg: COLORS.textMuted + '20', text: COLORS.textMuted };
  }
};

const getSizeStyles = (size: BadgeSize) => {
  switch (size) {
    case 'small':
      return { 
        padding: SPACING.xs,
        iconSize: 12,
        fontSize: FONT_SIZE.xs,
      };
    case 'large':
      return { 
        padding: SPACING.md,
        iconSize: 20,
        fontSize: FONT_SIZE.md,
      };
    default:
      return { 
        padding: SPACING.sm,
        iconSize: 16,
        fontSize: FONT_SIZE.sm,
      };
  }
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'medium',
  icon,
  style,
}) => {
  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);

  return (
    <View style={[
      styles.badge, 
      { 
        backgroundColor: variantStyles.bg,
        paddingHorizontal: sizeStyles.padding,
        paddingVertical: sizeStyles.padding / 2,
      }, 
      style
    ]}>
      {icon && (
        <Ionicons 
          name={icon} 
          size={sizeStyles.iconSize} 
          color={variantStyles.text} 
          style={styles.icon}
        />
      )}
      <Text style={[
        styles.text, 
        { 
          color: variantStyles.text,
          fontSize: sizeStyles.fontSize,
        }
      ]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.full,
  },
  icon: {
    marginRight: SPACING.xs,
  },
  text: {
    fontWeight: '600',
  },
});


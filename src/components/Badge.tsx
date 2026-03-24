import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContext';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'small' | 'medium' | 'large';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string;
  style?: ViewStyle;
}

const getVariantStyles = (variant: BadgeVariant, theme: any) => {
  switch (variant) {
    case 'success':
      return { bg: theme.getColor.success + '20', text: theme.getColor.success };
    case 'warning':
      return { bg: theme.getColor.warning + '20', text: theme.getColor.warning };
    case 'error':
      return { bg: theme.getColor.error + '20', text: theme.getColor.error };
    case 'info':
      return { bg: theme.getColor.info + '20', text: theme.getColor.info };
    default:
      return { bg: theme.getColor.textTertiary + '20', text: theme.getColor.textTertiary };
  }
};

const getSizeStyles = (size: BadgeSize, theme: any) => {
  switch (size) {
    case 'small':
      return { 
        padding: theme.spacing.xs,
        iconSize: 12,
        fontSize: theme.fontSize.xs,
      };
    case 'large':
      return { 
        padding: theme.spacing.md,
        iconSize: 20,
        fontSize: theme.fontSize.md,
      };
    default:
      return { 
        padding: theme.spacing.sm,
        iconSize: 16,
        fontSize: theme.fontSize.sm,
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
  const { theme } = useThemeContext();
  const variantStyles = getVariantStyles(variant, theme);
  const sizeStyles = getSizeStyles(size, theme);

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
    borderRadius: 9999, // full radius
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
  },
});


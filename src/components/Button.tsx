import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning' | 'accent';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode | string;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
}) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  const buttonStyles = [
    styles.button,
    styles[variant],
    styles[`${size}Size`],
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
  ];

  const renderIcon = () => {
    if (!icon) return null;
    
    // Si l'icône est une chaîne de caractères, utiliser Ionicons
    if (typeof icon === 'string') {
      const iconColor = variant === 'outline' ? COLORS.text : COLORS.text;
      const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;
      
      return <Ionicons name={icon} size={iconSize} color={iconColor} />;
    }
    
    // Sinon, rendre le nœud React directement
    return icon;
  };

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'outline' ? COLORS.accent : COLORS.text} 
          size="small" 
        />
      ) : (
        <>
          {renderIcon()}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
  },
  primary: {
    backgroundColor: COLORS.accent,
  },
  secondary: {
    backgroundColor: COLORS.accent2,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  danger: {
    backgroundColor: COLORS.danger,
  },
  success: {
    backgroundColor: COLORS.success,
  },
  warning: {
    backgroundColor: COLORS.warning,
  },
  accent: {
    backgroundColor: COLORS.accent,
  },
  smallSize: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  mediumSize: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  largeSize: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
  primaryText: {
    color: COLORS.textInverse,
  },
  secondaryText: {
    color: COLORS.textInverse,
  },
  outlineText: {
    color: COLORS.text,
  },
  dangerText: {
    color: COLORS.textInverse,
  },
  successText: {
    color: COLORS.textInverse,
  },
  warningText: {
    color: COLORS.textInverse,
  },
  accentText: {
    color: COLORS.textInverse,
  },
  smallText: {
    fontSize: FONT_SIZE.sm,
  },
  mediumText: {
    fontSize: FONT_SIZE.md,
  },
  largeText: {
    fontSize: FONT_SIZE.lg,
  },
  disabledText: {
    color: COLORS.textMuted,
  },
});
};


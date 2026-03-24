import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

const getIconName = (type: ToastType): string => {
  switch (type) {
    case 'success':
      return 'checkmark-circle';
    case 'error':
      return 'close-circle';
    case 'warning':
      return 'warning';
    case 'info':
      return 'information-circle';
    default:
      return 'information-circle';
  }
};

const getColors = (type: ToastType, COLORS: any) => {
  switch (type) {
    case 'success':
      return { bg: COLORS.success + '20', border: COLORS.success, text: COLORS.success };
    case 'error':
      return { bg: COLORS.danger + '20', border: COLORS.danger, text: COLORS.danger };
    case 'warning':
      return { bg: COLORS.warning + '20', border: COLORS.warning, text: COLORS.warning };
    case 'info':
    default:
      return { bg: COLORS.info + '20', border: COLORS.info, text: COLORS.info };
  }
};

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  visible,
  onHide,
  duration = 3000,
}) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  const colors = getColors(type, COLORS);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(duration),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => onHide());
    }
  }, [visible, duration, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity },
      ]}
    >
      <Ionicons name={getIconName(type) as any} size={24} color={colors.text} />
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
    </Animated.View>
  );
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: SPACING.xl,
    right: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
    // Amélioration du contraste avec ombre portée
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    // Assurer le contraste même sur les couleurs de statut
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
};


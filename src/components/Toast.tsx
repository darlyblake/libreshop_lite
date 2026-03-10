import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';

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

const getColors = (type: ToastType) => {
  switch (type) {
    case 'success':
      return { bg: COLORS.success + '20', border: COLORS.success, text: COLORS.success };
    case 'error':
      return { bg: COLORS.danger + '20', border: COLORS.danger, text: COLORS.danger };
    case 'warning':
      return { bg: COLORS.warning + '20', border: COLORS.warning, text: COLORS.warning };
    case 'info':
    default:
      return { bg: COLORS.accent + '20', border: COLORS.accent, text: COLORS.accent };
  }
};

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  visible,
  onHide,
  duration = 3000,
}) => {
  const colors = getColors(type);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(duration),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
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

const styles = StyleSheet.create({
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
  },
  message: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
});


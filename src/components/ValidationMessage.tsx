import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ValidationMessageProps {
  error?: string;
  visible?: boolean;
  type?: 'error' | 'warning' | 'info';
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  error,
  visible = true,
  type = 'error',
}) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(themeContext) : ({} as any), [themeContext]);

  if (!visible || !error) return null;

  const getContainerStyles = () => {
    switch (type) {
      case 'warning':
        return [styles.container, styles.warningContainer];
      case 'info':
        return [styles.container, styles.infoContainer];
      default:
        return [styles.container, styles.errorContainer];
    }
  };

  const getTextStyles = () => {
    switch (type) {
      case 'warning':
        return styles.warningText;
      case 'info':
        return styles.infoText;
      default:
        return styles.errorText;
    }
  };

  return (
    <View style={getContainerStyles()}>
      <Text style={getTextStyles()}>{error}</Text>
    </View>
  );
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;

  return StyleSheet.create({
    container: {
      marginTop: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: 4,
    },
    errorContainer: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderLeftWidth: 3,
      borderLeftColor: COLORS.danger,
    },
    warningContainer: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderLeftWidth: 3,
      borderLeftColor: COLORS.warning,
    },
    infoContainer: {
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderLeftWidth: 3,
      borderLeftColor: COLORS.info,
    },
    errorText: {
      fontSize: FONT_SIZE.xs,
      color: COLORS.danger,
      fontWeight: '500' as const,
    },
    warningText: {
      fontSize: FONT_SIZE.xs,
      color: COLORS.warning,
      fontWeight: '500' as const,
    },
    infoText: {
      fontSize: FONT_SIZE.xs,
      color: COLORS.info,
      fontWeight: '500' as const,
    },
  });
};

export default ValidationMessage;

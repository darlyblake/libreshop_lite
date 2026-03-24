import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface ErrorDisplayProps {
  error: Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'modal' | 'inline' | 'banner';
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  variant = 'inline'
}) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(themeContext) : ({} as any), [themeContext]);

  const errorMessage = typeof error === 'string' ? error : error.message;
  
  const getErrorIcon = (message: string): keyof typeof Ionicons.glyphMap => {
    if (message.includes('réseau') || message.includes('network')) {
      return 'wifi-outline';
    }
    if (message.includes('permission') || message.includes('accès')) {
      return 'lock-closed-outline';
    }
    if (message.includes('connexion') || message.includes('auth')) {
      return 'person-outline';
    }
    return 'alert-circle-outline';
  };

  const getErrorColor = (message: string) => {
    if (message.includes('réseau') || message.includes('network')) {
      return COLORS.warning;
    }
    if (message.includes('permission') || message.includes('accès')) {
      return COLORS.danger;
    }
    return COLORS.warning;
  };

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;

  return StyleSheet.create({
    container: {
      backgroundColor: variant === 'banner' ? 'rgba(239, 68, 68, 0.1)' : COLORS.card,
      borderWidth: variant === 'banner' ? 1 : 0,
      borderColor: variant === 'banner' ? COLORS.danger : 'transparent',
      borderRadius: variant === 'modal' ? RADIUS.lg : RADIUS.md,
      padding: variant === 'modal' ? SPACING.lg : SPACING.md,
      margin: variant === 'banner' ? SPACING.sm : SPACING.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    icon: {
      marginRight: SPACING.sm,
      color: getErrorColor(errorMessage),
    },
    title: {
      fontSize: FONT_SIZE.md,
      fontWeight: '600',
      color: COLORS.text,
      flex: 1,
    },
    message: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.textSoft,
      lineHeight: 20,
      marginBottom: SPACING.md,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: SPACING.sm,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.sm,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    buttonText: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.accent,
      marginLeft: SPACING.xs,
    },
  });
};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons 
          name={getErrorIcon(errorMessage)} 
          size={20} 
          style={styles.icon} 
        />
        <Text style={styles.title}>Erreur</Text>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss}>
            <Ionicons name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.message}>
        {errorMessage}
      </Text>
      
      {(onRetry || onDismiss) && (
        <View style={styles.actions}>
          {onRetry && (
            <TouchableOpacity style={styles.button} onPress={onRetry}>
              <Ionicons name="refresh-outline" size={16} color={COLORS.accent} />
              <Text style={styles.buttonText}>Réessayer</Text>
            </TouchableOpacity>
          )}
          {onDismiss && variant !== 'banner' && (
            <TouchableOpacity style={styles.button} onPress={onDismiss}>
              <Ionicons name="close-outline" size={16} color={COLORS.textMuted} />
              <Text style={[styles.buttonText, { color: COLORS.textMuted }]}>
                Fermer
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default ErrorDisplay;

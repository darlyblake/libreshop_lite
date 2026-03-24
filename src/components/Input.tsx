import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onIconPress?: () => void;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  editable?: boolean;
}

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
    container: {
      marginBottom: SPACING.lg,
    },
    label: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '500',
      color: COLORS.textSoft,
      marginBottom: SPACING.sm,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.lg, // Changed from full to lg for a more modern look like in the screenshot
      paddingHorizontal: SPACING.lg,
    },
    inputFocused: {
      borderColor: COLORS.accent,
      backgroundColor: theme.isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
    },
    inputError: {
      borderColor: COLORS.danger,
      borderWidth: 2,
      backgroundColor: theme.isDark ? 'rgba(183, 28, 28, 0.1)' : 'rgba(183, 28, 28, 0.05)',
    },
    input: {
      flex: 1,
      paddingVertical: SPACING.md,
      fontSize: FONT_SIZE.md,
      color: COLORS.text,
    },
    multilineInput: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    icon: {
      marginRight: SPACING.sm,
    },
    error: {
      fontSize: FONT_SIZE.xs,
      color: COLORS.danger,
      marginTop: SPACING.xs,
      fontWeight: '600',
    },
  });
};

export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  icon,
  onIconPress,
  multiline = false,
  numberOfLines = 1,
  style,
  editable = true,
}) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = getStyles(themeContext);

  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        {icon && (
          <TouchableOpacity onPress={onIconPress} disabled={!onIconPress}>
            <Ionicons
              name={icon}
              size={20}
              color={COLORS.textSoft}
              style={styles.icon}
            />
          </TouchableOpacity>
        )}
        <TextInput
          style={[styles.input, multiline && styles.multilineInput]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={COLORS.textSoft}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};



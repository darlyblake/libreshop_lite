import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useLegacyPalette } from '../hooks/useLegacyPalette';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  onClear?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  style?: ViewStyle;
  autoFocus?: boolean;
  showCancelButton?: boolean;
  onCancel?: () => void;
  isLoading?: boolean;
  editable?: boolean;
  testID?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onSubmitEditing,
  onClear,
  onFocus,
  onBlur,
  placeholder = 'Rechercher...',
  style,
  autoFocus = false,
  showCancelButton = false,
  onCancel,
  isLoading = false,
  editable = true,
  testID = 'searchBar',
}) => {
  const palette = useLegacyPalette();
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const styles = useMemo(
    () => createSearchBarStyles(palette, theme.spacing, theme.radius, theme.fontSize),
    [palette, theme.spacing, theme.radius, theme.fontSize]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  const handleClear = useCallback(() => {
    onChangeText('');
    onClear?.();
  }, [onChangeText, onClear]);

  const hasValue = value.length > 0;

  return (
    <View style={[styles.container, style]}>
      {/* Icon de recherche */}
      <Ionicons
        name="search"
        size={20}
        color={isFocused ? palette.accent : palette.textMuted}
        style={styles.icon}
      />

      {/* Input */}
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        editable={editable && !isLoading}
        selectionColor={palette.accent}
      />

      {/* Loading Indicator */}
      {isLoading && (
        <ActivityIndicator
          size="small"
          color={palette.accent}
          style={styles.loader}
        />
      )}

      {/* Clear Button */}
      {hasValue && !isLoading && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="searchBarClear"
        >
          <Ionicons name="close-circle" size={20} color={palette.textMuted} />
        </TouchableOpacity>
      )}

      {/* Cancel Button */}
      {showCancelButton && isFocused && (
        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="searchBarCancel"
        >
          <Ionicons name="close" size={24} color={palette.text} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const createSearchBarStyles = (palette: any, SPACING: any, RADIUS: any, FONT_SIZE: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.card,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: SPACING.lg,
      height: 48,
      gap: SPACING.sm,
    },
    icon: {
      marginRight: SPACING.xs,
    },
    input: {
      flex: 1,
      fontSize: FONT_SIZE.md,
      color: palette.text,
      paddingVertical: 0,
      fontWeight: '500',
    },
    clearButton: {
      padding: SPACING.sm,
      marginRight: -SPACING.sm,
    },
    cancelButton: {
      padding: SPACING.sm,
      marginRight: -SPACING.sm,
    },
    loader: {
      marginRight: SPACING.sm,
    },
  });


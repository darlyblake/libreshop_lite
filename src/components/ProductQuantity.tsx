import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';

interface ProductQuantityProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min?: number;
  max?: number;
  style?: ViewStyle;
}

export const ProductQuantity: React.FC<ProductQuantityProps> = ({
  quantity,
  onIncrease,
  onDecrease,
  min = 1,
  max = 99,
  style,
}) => {
  const canDecrease = quantity > min;
  const canIncrease = quantity < max;

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.button, !canDecrease && styles.buttonDisabled]}
        onPress={onDecrease}
        disabled={!canDecrease}
      >
        <Ionicons
          name="remove"
          size={20}
          color={canDecrease ? COLORS.text : COLORS.textMuted}
        />
      </TouchableOpacity>
      <View style={styles.valueContainer}>
        <Text style={styles.value}>{quantity}</Text>
      </View>
      <TouchableOpacity
        style={[styles.button, !canIncrease && styles.buttonDisabled]}
        onPress={onIncrease}
        disabled={!canIncrease}
      >
        <Ionicons
          name="add"
          size={20}
          color={canIncrease ? COLORS.text : COLORS.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  valueContainer: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
    height: 44,
  },
  value: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
});


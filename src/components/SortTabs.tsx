import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../config/theme';

type Option<T extends string> = { id: T; label: string };

export function SortTabs<T extends string>(props: {
  options: Option<T>[];
  selected: T;
  onSelect: (id: T) => void;
  style?: any;
}) {
  const { options, selected, onSelect } = props;
  return (
    <View style={styles.container}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          style={[styles.tab, selected === opt.id && styles.tabActive]}
          onPress={() => onSelect(opt.id)}
        >
          <Text style={[styles.tabText, selected === opt.id && styles.tabTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)'
  },
  tabActive: {
    backgroundColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  tabTextActive: {
    color: 'white'
  }
});

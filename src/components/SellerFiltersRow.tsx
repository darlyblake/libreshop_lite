import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';

export type SellerFilterItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  filters: SellerFilterItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  counts?: Record<string, number>;
  isMobile?: boolean;
};

export const SellerFiltersRow: React.FC<Props> = ({
  filters,
  selectedId,
  onSelect,
  counts,
  isMobile,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.statsContainer}
      key="filters-scroll"
      style={styles.filtersScrollView}
    >
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter.id}
          style={[
            styles.statCard,
            selectedId === filter.id && styles.statCardActive,
            { width: isMobile ? 140 : 160 },
          ]}
          onPress={() => onSelect(filter.id)}
          activeOpacity={0.7}
        >
          <View style={styles.statIconContainer}>
            <Ionicons
              name={filter.icon as any}
              size={24}
              color={selectedId === filter.id ? COLORS.white : COLORS.accent}
            />
          </View>
          <View>
            <Text
              style={[
                styles.statValue,
                { color: selectedId === filter.id ? COLORS.white : COLORS.text },
              ]}
            >
              {counts ? counts[filter.id] || 0 : 0}
            </Text>
            <Text
              style={[
                styles.statLabel,
                {
                  color:
                    selectedId === filter.id
                      ? COLORS.white + 'CC'
                      : COLORS.textSoft,
                },
              ]}
            >
              {filter.label}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  filtersScrollView: {
    maxHeight: 100,
    minHeight: 80,
    zIndex: 2,
    backgroundColor: COLORS.bg,
  },
  statsContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    height: 72,
    minHeight: 72,
  },
  statCardActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
  },
});

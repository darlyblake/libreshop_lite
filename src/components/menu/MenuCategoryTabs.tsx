import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type MenuCategory = {
  id: string;
  label: string;
  emoji: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// ─── Catégories prédéfinies Restaurant ────────────────────────────────────────
export const RESTAURANT_CATEGORIES: MenuCategory[] = [
  { id: 'all', label: 'Tout', emoji: '📋', icon: 'list-outline' },
  { id: 'entree', label: 'Entrées', emoji: '🥗', icon: 'leaf-outline' },
  { id: 'plat', label: 'Plats', emoji: '🍽️', icon: 'restaurant-outline' },
  { id: 'pizza', label: 'Pizzas', emoji: '🍕', icon: 'pizza-outline' },
  { id: 'pate', label: 'Pâtes & Riz', emoji: '🍝', icon: 'flame-outline' },
  { id: 'grillade', label: 'Grillades', emoji: '🥩', icon: 'flame-outline' },
  { id: 'dessert', label: 'Desserts', emoji: '🍰', icon: 'ice-cream-outline' },
  { id: 'boisson', label: 'Boissons', emoji: '🥤', icon: 'water-outline' },
];

// ─── Catégories prédéfinies Bar ───────────────────────────────────────────────
export const BAR_CATEGORIES: MenuCategory[] = [
  { id: 'all', label: 'Tout', emoji: '📋', icon: 'list-outline' },
  { id: 'biere', label: 'Bières', emoji: '🍺', icon: 'beer-outline' },
  { id: 'vin', label: 'Vins', emoji: '🍷', icon: 'wine-outline' },
  { id: 'spiritueux', label: 'Spiritueux', emoji: '🥃', icon: 'flask-outline' },
  { id: 'cocktail', label: 'Cocktails', emoji: '🍸', icon: 'color-fill-outline' },
  { id: 'jus', label: 'Jus & Softs', emoji: '🧃', icon: 'nutrition-outline' },
  { id: 'chaud', label: 'Chauds', emoji: '☕', icon: 'cafe-outline' },
];

type Props = {
  categories: MenuCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
  counts?: Record<string, number>;
  accentColor: string;
  accentLight: string;
};

export const MenuCategoryTabs: React.FC<Props> = ({
  categories,
  selectedId,
  onSelect,
  counts = {},
  accentColor,
  accentLight,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {categories.map((cat) => {
        const active = selectedId === cat.id;
        const count = cat.id === 'all'
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[cat.id] ?? 0);

        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.75}
            style={[
              styles.chip,
              {
                backgroundColor: active ? accentColor : accentLight,
                borderColor: active ? accentColor : 'transparent',
              },
            ]}
          >
            <Text style={styles.emoji}>{cat.emoji}</Text>
            <Text style={[styles.label, { color: active ? '#fff' : '#555' }]}>
              {cat.label}
            </Text>
            {count > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: active ? 'rgba(255,255,255,0.3)' : accentColor },
                ]}
              >
                <Text style={styles.badgeText}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

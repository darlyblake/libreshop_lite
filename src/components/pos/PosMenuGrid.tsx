/**
 * PosMenuGrid.tsx
 * Composant partagé : Grille de produits/menu pour les interfaces POS
 * Utilisé par : SellerCaisseScreen, RestaurantCaisseScreen, BarCaisseScreen
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from '../OptimizedImage';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../config/theme';

export type PosProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  maxStock?: number;
  category?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  reference?: string;
  cost_price?: number;
  image_url?: string;
  description?: string;
};

export type PosCartItem = PosProduct & {
  quantity: number;
  maxStock: number;
  notes?: string; // Notes spéciales (sans oignons, allergie, etc.)
};

type Props = {
  products: PosProduct[];
  onAddToCart: (product: PosProduct) => void;
  numColumns?: number;
  cartItems?: PosCartItem[];
  /** Mode d'affichage : 'grid' (défaut), 'large' (restaurant, avec photo), 'compact' (bar, rapide) */
  displayMode?: 'grid' | 'large' | 'compact';
  /** Couleur d'accentuation selon l'interface (boutique/restaurant/bar) */
  accentColor?: string;
};

export const PosMenuGrid = React.memo(({
  products,
  onAddToCart,
  numColumns = 2,
  cartItems = [],
  displayMode = 'grid',
  accentColor = COLORS.info,
}: Props) => {
  const cartMap = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach(item => map.set(item.id, item.quantity));
    return map;
  }, [cartItems]);

  const renderItem = useCallback(({ item }: { item: PosProduct }) => {
    const inCart = cartMap.get(item.id) || 0;
    const outOfStock = item.stock <= 0;

    if (displayMode === 'large') {
      return (
        <TouchableOpacity
          style={[styles.largeTile, outOfStock && styles.outOfStock]}
          onPress={() => !outOfStock && onAddToCart(item)}
          activeOpacity={outOfStock ? 1 : 0.75}
        >
          {item.image_url ? (
            <OptimizedImage
              uri={item.image_url}
              style={styles.largeImage}
            />
          ) : (
            <View style={[styles.largeImagePlaceholder, { backgroundColor: accentColor + '20' }]}>
              <Ionicons
                name={(item.icon as any) || 'restaurant-outline'}
                size={40}
                color={accentColor}
              />
            </View>
          )}
          <View style={styles.largeTileInfo}>
            <Text style={styles.largeTileName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.largeTileFooter}>
              <Text style={[styles.largeTilePrice, { color: accentColor }]}>
                {item.price.toLocaleString('fr-FR')} FCFA
              </Text>
              {inCart > 0 && (
                <View style={[styles.cartBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.cartBadgeText}>{inCart}</Text>
                </View>
              )}
            </View>
            {outOfStock && (
              <Text style={styles.outOfStockLabel}>Épuisé</Text>
            )}
          </View>
          {!outOfStock && (
            <View style={[styles.largeTileAddBtn, { backgroundColor: accentColor }]}>
              <Ionicons name="add" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      );
    }

    if (displayMode === 'compact') {
      return (
        <TouchableOpacity
          style={[styles.compactTile, outOfStock && styles.outOfStock]}
          onPress={() => !outOfStock && onAddToCart(item)}
          activeOpacity={outOfStock ? 1 : 0.75}
        >
          <View style={styles.compactLeft}>
            <View style={[styles.compactIcon, { backgroundColor: accentColor + '15' }]}>
              <Ionicons
                name={(item.icon as any) || 'beer-outline'}
                size={20}
                color={accentColor}
              />
            </View>
            <View style={styles.compactInfo}>
              <Text style={styles.compactName} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.compactPrice, { color: accentColor }]}>
                {item.price.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          </View>
          <View style={styles.compactRight}>
            {inCart > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: accentColor }]}>
                <Text style={styles.cartBadgeText}>{inCart}</Text>
              </View>
            )}
            {outOfStock ? (
              <Text style={styles.outOfStockLabel}>Épuisé</Text>
            ) : (
              <View style={[styles.addBtn, { backgroundColor: accentColor }]}>
                <Ionicons name="add" size={18} color="#fff" />
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    // Mode 'grid' — défaut
    return (
      <TouchableOpacity
        style={[styles.gridTile, outOfStock && styles.outOfStock]}
        onPress={() => !outOfStock && onAddToCart(item)}
        activeOpacity={outOfStock ? 1 : 0.75}
      >
        <View style={[styles.gridIconWrapper, { backgroundColor: accentColor + '15' }]}>
          <Ionicons
            name={(item.icon as any) || 'cube-outline'}
            size={28}
            color={outOfStock ? '#94a3b8' : accentColor}
          />
          {inCart > 0 && (
            <View style={[styles.cartBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.cartBadgeText}>{inCart}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.gridName, outOfStock && { color: COLORS.textMuted }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.gridPrice, { color: outOfStock ? COLORS.textMuted : accentColor }]}>
          {outOfStock ? 'Épuisé' : `${item.price.toLocaleString('fr-FR')} F`}
        </Text>
      </TouchableOpacity>
    );
  }, [cartMap, onAddToCart, displayMode, accentColor]);

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      numColumns={displayMode === 'compact' ? 1 : numColumns}
      key={`${displayMode}-${numColumns}`}
      columnWrapperStyle={
        displayMode !== 'compact' && numColumns > 1 ? styles.row : undefined
      }
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={5}
      removeClippedSubviews={Platform.OS !== 'web'}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>Aucun article trouvé</Text>
        </View>
      }
    />
  );
});

PosMenuGrid.displayName = 'PosMenuGrid';

const styles = StyleSheet.create({
  grid: {
    paddingBottom: 80,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  // Grid tile (mode défaut)
  gridTile: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    margin: SPACING.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 110,
    justifyContent: 'center',
  },
  gridIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  gridName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  gridPrice: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '800',
    textAlign: 'center',
  },

  // Large tile (mode restaurant)
  largeTile: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    margin: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    minHeight: 180,
    position: 'relative',
  },
  largeImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  largeImagePlaceholder: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeTileInfo: {
    padding: SPACING.sm,
  },
  largeTileName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  largeTileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  largeTilePrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
  largeTileAddBtn: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Compact tile (mode bar)
  compactTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  compactPrice: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  // Add button
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cart badge
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Out of stock
  outOfStock: {
    opacity: 0.5,
  },
  outOfStockLabel: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.md,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Product } from '../types/product';

const CATEGORIES = [
  { id: 'all', label: 'Tout' },
  { id: 'biere', label: '🍺 Bières' },
  { id: 'cocktail', label: '🍸 Cocktails' },
  { id: 'vin', label: '🍷 Vins' },
  { id: 'soft', label: '🧃 Softs' },
  { id: 'chaud', label: '☕ Chauds' }
];

const categoryLabels: Record<string, string> = {
  biere: "Bières",
  cocktail: "Cocktails",
  vin: "Vins",
  soft: "Jus & Softs",
  chaud: "Chauds"
};

interface BarMenuSectionProps {
  products: Product[];
  cart: Record<string, number>;
  onAddToCart: (product: Product) => void;
}

export const BarMenuSection: React.FC<BarMenuSectionProps> = ({ products, cart, onAddToCart }) => {
  const [currentCategory, setCurrentCategory] = useState('all');

  const filteredProducts = currentCategory === 'all'
    ? products
    : products.filter(p => {
        // Here we map our generic product categories to the bar categories if possible,
        // or just use a fallback if the product has tags.
        const desc = p.description?.toLowerCase() || '';
        const name = p.name.toLowerCase();
        if (currentCategory === 'biere') return desc.includes('biere') || desc.includes('bière') || name.includes('bière') || name.includes('biere');
        if (currentCategory === 'cocktail') return desc.includes('cocktail') || name.includes('cocktail') || name.includes('mojito');
        if (currentCategory === 'vin') return desc.includes('vin') || name.includes('vin');
        if (currentCategory === 'soft') return desc.includes('soft') || desc.includes('jus') || name.includes('coca') || name.includes('eau');
        if (currentCategory === 'chaud') return desc.includes('chaud') || name.includes('café') || name.includes('thé');
        return false;
      });

  // If "all", we group them
  const renderProduct = (item: Product) => {
    return (
      <View key={item.id} style={styles.productCard}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          {item.description ? <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text> : null}
          <Text style={styles.productPrice}>{item.price.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => onAddToCart(item)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>🍸 Carte des boissons</Text>
          </View>
          <View style={styles.tableBadge}>
            <Text style={styles.tableBadgeText}>Table 7</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity 
            key={cat.id} 
            style={[styles.catBtn, currentCategory === cat.id && styles.catBtnActive]}
            onPress={() => setCurrentCategory(cat.id)}
          >
            <Text style={[styles.catBtnText, currentCategory === cat.id && styles.catBtnTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.productsContainer}>
        {currentCategory === 'all' ? (
          CATEGORIES.filter(c => c.id !== 'all').map(cat => {
            const items = products.filter(p => {
              const desc = p.description?.toLowerCase() || '';
              const name = p.name.toLowerCase();
              if (cat.id === 'biere') return desc.includes('biere') || desc.includes('bière') || name.includes('bière') || name.includes('biere');
              if (cat.id === 'cocktail') return desc.includes('cocktail') || name.includes('cocktail') || name.includes('mojito');
              if (cat.id === 'vin') return desc.includes('vin') || name.includes('vin');
              if (cat.id === 'soft') return desc.includes('soft') || desc.includes('jus') || name.includes('coca') || name.includes('eau');
              if (cat.id === 'chaud') return desc.includes('chaud') || name.includes('café') || name.includes('thé');
              return false;
            });
            if (items.length === 0) return null;
            return (
              <View key={cat.id} style={{ marginBottom: 24 }}>
                <Text style={styles.sectionTitle}>{categoryLabels[cat.id] || cat.label}</Text>
                <View style={styles.productList}>
                  {items.map(renderProduct)}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.productList}>
            {filteredProducts.map(renderProduct)}
            {filteredProducts.length === 0 && (
              <Text style={{color: '#a1a1aa', textAlign: 'center', marginTop: 20}}>Aucune boisson dans cette catégorie.</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f0f13',
    paddingBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
  },
  header: {
    backgroundColor: '#6c3483', // We'll use a solid color here or linear gradient if possible
    padding: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  tableBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tableBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  categories: {
    backgroundColor: '#0f0f13',
    paddingVertical: 14,
  },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#2e2e3a',
    backgroundColor: '#1a1a24',
    marginRight: 8,
  },
  catBtnActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  catBtnText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '600',
  },
  catBtnTextActive: {
    color: '#fff',
  },
  productsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#a1a1aa',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productList: {
    flexDirection: 'column',
    gap: 10,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2e2e3a',
    marginBottom: 10,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  productDesc: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  }
});

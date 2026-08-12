import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { productService } from '../services/productService';
import { collectionService } from '../services/collectionService';
import { type Product } from '../types/product';
import {
  MenuCategoryTabs,
  BAR_CATEGORIES,
} from '../components/menu/MenuCategoryTabs';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { AddMenuItemModal } from '../components/menu/AddMenuItemModal';

const ACCENT = '#7C3AED';
const ACCENT_LIGHT = '#7C3AED15';
const GRADIENT: readonly [string, string] = ['#6C3483', '#8E44AD'];

// ─── Initialisation des catégories bar dans Supabase ─────────────────────────
async function ensureBarCategories(storeId: string) {
  const existing = await collectionService.getByStore(storeId);
  const existingCategoryIds = existing
    .map(c => {
      const desc = (c as any).description ?? '';
      const match = desc.match(/^menu_category:(.+)$/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  const toCreate = BAR_CATEGORIES.filter(
    cat => cat.id !== 'all' && !existingCategoryIds.includes(cat.id)
  );

  for (const cat of toCreate) {
    await collectionService.create({
      store_id: storeId,
      name: `${cat.emoji} ${cat.label}`,
      description: `menu_category:${cat.id}`,
    } as any);
  }
}

export const BarProductsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const navigation = useNavigation<NavigationProp<any>>();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('Mon Bar');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // ─── Charger la boutique ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;
      try {
        const store = await storeService.getByUser(user.id);
        if (!store) return;
        setStoreId(store.id);
        setStoreName(store.name ?? 'Mon Bar');
        await ensureBarCategories(store.id);
      } catch (e) {
        console.warn('BarProductsScreen init error', e);
      }
    };
    init();
  }, [user?.id]);

  // ─── Charger les boissons ─────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const all = await productService.getByStoreAll(storeId);
      setProducts(Array.isArray(all) ? all : []);
    } catch (e) {
      console.warn('loadProducts bar error', e);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  // ─── Compteurs par catégorie ──────────────────────────────────────────────
  const counts: Record<string, number> = {};
  for (const p of products) {
    const cat = p.category ?? 'autre';
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  // ─── Filtrage ─────────────────────────────────────────────────────────────
  const filtered =
    selectedCategory === 'all'
      ? products
      : products.filter(p => p.category === selectedCategory);

  // ─── Actions rapides ──────────────────────────────────────────────────────
  const handleToggleAvailable = async (item: Product) => {
    try {
      await productService.update(item.id, { is_active: !item.is_active });
      setProducts(prev =>
        prev.map(p => p.id === item.id ? { ...p, is_active: !p.is_active } : p)
      );
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de modifier la disponibilité.');
    }
  };

  const handleDelete = async (item: Product) => {
    try {
      await productService.delete(item.id);
      setProducts(prev => prev.filter(p => p.id !== item.id));
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de supprimer cette boisson.');
    }
  };

  const handleSaved = (product: Product) => {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = product;
        return next;
      }
      return [product, ...prev];
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8f8f8' }}>
      {/* Header gradient violet */}
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🍸 Carte des boissons</Text>
          <Text style={styles.headerSub}>{storeName}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { marginRight: 8 }]}
          onPress={() => navigation.navigate('BarProfit')}
        >
          <Ionicons name="stats-chart" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setEditProduct(null); setShowAddModal(true); }}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {products.length} boisson{products.length !== 1 ? 's' : ''} au total
          {'  ·  '}
          <Text style={{ color: '#22c55e' }}>
            {products.filter(p => p.is_active).length} disponibles
          </Text>
          {'  ·  '}
          <Text style={{ color: '#ef4444' }}>
            {products.filter(p => !p.is_active).length} épuisées
          </Text>
        </Text>
      </View>

      {/* Catégories bar */}
      <MenuCategoryTabs
        categories={BAR_CATEGORIES}
        selectedId={selectedCategory}
        onSelect={setSelectedCategory}
        counts={counts}
        accentColor={ACCENT}
        accentLight={ACCENT_LIGHT}
      />

      {/* Liste des boissons */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Chargement de la carte...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>🍸</Text>
          <Text style={styles.emptyTitle}>
            {selectedCategory === 'all'
              ? 'Aucune boisson dans la carte'
              : 'Aucune boisson dans cette catégorie'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Appuie sur le bouton + pour ajouter ta première boisson
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: ACCENT }]}
            onPress={() => { setEditProduct(null); setShowAddModal(true); }}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.emptyBtnText}>Ajouter une boisson</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <MenuItemCard
              item={item}
              accentColor={ACCENT}
              onEdit={p => { setEditProduct(p); setShowAddModal(true); }}
              onToggleAvailable={handleToggleAvailable}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal ajout/édition */}
      {storeId && (
        <AddMenuItemModal
          visible={showAddModal}
          onClose={() => { setShowAddModal(false); setEditProduct(null); }}
          onSaved={handleSaved}
          storeId={storeId}
          categories={BAR_CATEGORIES}
          accentColor={ACCENT}
          accentGradient={GRADIENT}
          editProduct={editProduct}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    padding: 10,
  },
  statsBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

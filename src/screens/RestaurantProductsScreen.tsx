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
  RESTAURANT_CATEGORIES,
  type MenuCategory,
} from '../components/menu/MenuCategoryTabs';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { AddMenuItemModal } from '../components/menu/AddMenuItemModal';

const ACCENT = '#FF6B35';
const ACCENT_LIGHT = '#FF6B3515';
const GRADIENT: readonly [string, string] = ['#FF6B35', '#FF8C42'];

// ─── Initialisation des catégories restaurant dans Supabase ──────────────────
async function ensureRestaurantCategories(storeId: string) {
  const existing = await collectionService.getByStore(storeId);
  const existingCategoryIds = existing
    .map(c => {
      const desc = (c as any).description ?? '';
      const match = desc.match(/^menu_category:(.+)$/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  const toCreate = RESTAURANT_CATEGORIES.filter(
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

export const RestaurantProductsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const navigation = useNavigation<NavigationProp<any>>();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('Mon Restaurant');
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
        setStoreName(store.name ?? 'Mon Restaurant');
        // Créer les catégories par défaut si pas encore fait
        await ensureRestaurantCategories(store.id);
      } catch (e) {
        console.warn('RestaurantProductsScreen init error', e);
      }
    };
    init();
  }, [user?.id]);

  // ─── Charger les produits ─────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const all = await productService.getByStoreAll(storeId);
      setProducts(Array.isArray(all) ? all : []);
    } catch (e) {
      console.warn('loadProducts error', e);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  // ─── Calcul des compteurs par catégorie ───────────────────────────────────
  const counts: Record<string, number> = {};
  for (const p of products) {
    const cat = (p.category ?? 'autre');
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
      Alert.alert('Erreur', 'Impossible de supprimer ce plat.');
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
      {/* Header gradient */}
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🍽️ Carte du restaurant</Text>
          <Text style={styles.headerSub}>{storeName}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { marginRight: 8 }]}
          onPress={() => navigation.navigate('RestaurantProfit')}
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
          {products.length} plat{products.length !== 1 ? 's' : ''} au total
          {'  ·  '}
          <Text style={{ color: '#22c55e' }}>
            {products.filter(p => p.is_active).length} disponibles
          </Text>
          {'  ·  '}
          <Text style={{ color: '#ef4444' }}>
            {products.filter(p => !p.is_active).length} épuisés
          </Text>
        </Text>
      </View>

      {/* Catégories */}
      <MenuCategoryTabs
        categories={RESTAURANT_CATEGORIES}
        selectedId={selectedCategory}
        onSelect={setSelectedCategory}
        counts={counts}
        accentColor={ACCENT}
        accentLight={ACCENT_LIGHT}
      />

      {/* Liste */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Chargement de la carte...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>🍽️</Text>
          <Text style={styles.emptyTitle}>
            {selectedCategory === 'all'
              ? 'Aucun plat dans la carte'
              : `Aucun plat dans cette catégorie`}
          </Text>
          <Text style={styles.emptySubtitle}>
            Appuie sur le bouton + pour ajouter votre premier plat
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: ACCENT }]}
            onPress={() => { setEditProduct(null); setShowAddModal(true); }}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.emptyBtnText}>Ajouter un plat</Text>
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
          categories={RESTAURANT_CATEGORIES}
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

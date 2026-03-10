import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { AddProductModal } from '../components/AddProductModal';
import { SellerFiltersRow } from '../components/SellerFiltersRow';
import { useResponsive } from '../utils/useResponsive';
import {
  collectionService,
  productService,
  storeService,
  type Collection,
  type Product as SupabaseProduct,
} from '../lib/supabase';
import { cloudinaryService } from '../lib/cloudinaryService';
import { useAuthStore } from '../store';

type ProductFilter = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap };

export const SellerProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { 
    width, 
    height,
    isMobile, 
    isTablet, 
    isDesktop, 
    spacing, 
    fontSize, 
    component, 
    grid 
  } = useResponsive();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const getProductPublicUrl = React.useCallback((productId: string) => {
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    return webBaseUrl ? `${webBaseUrl}/product/${productId}` : Linking.createURL(`/product/${productId}`);
  }, []);

  const shareOrCopyProductUrl = React.useCallback(
    async (productId: string) => {
      const url = getProductPublicUrl(productId);
      if (Platform.OS === 'web') {
        const clipboard = (globalThis as any)?.navigator?.clipboard;
        if (clipboard?.writeText) {
          await clipboard.writeText(url);
          Alert.alert('Copié', 'Lien du produit copié');
          return;
        }
      }
      await Share.share({ message: url, url });
    },
    [getProductPublicUrl]
  );

  const loadProducts = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const store = await storeService.getByUser(user.id);
      if (!store?.id) {
        setStoreId(null);
        setProducts([]);
        setCollections([]);
        return;
      }
      setStoreId(store.id);

      const cols = await collectionService.getByStore(store.id);
      setCollections(cols);

      const data = await productService.getByStoreAll(store.id);
      setProducts((data as any[]) as SupabaseProduct[]);
    } catch (e) {
      console.error('load products', e);
      Alert.alert('Erreur', 'Impossible de charger les produits');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const collectionFilters = useMemo(() => {
    return (collections || [])
      .filter((c) => c.is_active)
      .map((c) => ({ id: c.id, label: c.name, icon: 'albums-outline' as const }));
  }, [collections]);

const filters: ProductFilter[] = useMemo(() => {
    return [{ id: 'all', label: 'Tous', icon: 'apps-outline' }, ...collectionFilters];
  }, [collectionFilters]);

  // Advanced filters state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const filteredProducts = useMemo(() => {
    let filtered = (products || []).filter((product) => {
      const matchesSearch = String(product.name || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesFilter =
        selectedFilter === 'all' ||
        String((product as any)?.collection_id || '') === selectedFilter;
      
      // Advanced filters
      let matchesPrice = true;
      if (priceRange.min) {
        matchesPrice = product.price >= parseFloat(priceRange.min);
      }
      if (priceRange.max) {
        matchesPrice = matchesPrice && product.price <= parseFloat(priceRange.max);
      }

      let matchesStock = true;
      if (stockFilter === 'in_stock') {
        matchesStock = product.stock > 3;
      } else if (stockFilter === 'low_stock') {
        matchesStock = product.stock > 0 && product.stock <= 3;
      } else if (stockFilter === 'out_of_stock') {
        matchesStock = product.stock <= 0;
      }

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const productDate = new Date(product.created_at);
        const now = new Date();
        if (dateFilter === 'today') {
          matchesDate = productDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = productDate >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = productDate >= monthAgo;
        }
      }

      return matchesSearch && matchesFilter && matchesPrice && matchesStock && matchesDate;
    });
    return filtered;
  }, [products, searchQuery, selectedFilter, priceRange, stockFilter, dateFilter]);

  // Reset advanced filters
  const resetAdvancedFilters = () => {
    setPriceRange({ min: '', max: '' });
    setStockFilter('all');
    setDateFilter('all');
  };

  const hasActiveAdvancedFilters = priceRange.min || priceRange.max || stockFilter !== 'all' || dateFilter !== 'all';

  const stats = useMemo(() => {
    const collectionStats: { [key: string]: number } = { all: (products || []).length };
    collectionFilters.forEach((c) => {
      collectionStats[c.id] = (products || []).filter((p) => String((p as any)?.collection_id || '') === c.id).length;
    });
    return collectionStats;
  }, [products, collectionFilters]);

  const hasAnyCollection = (collections || []).length > 0;

  const renderProduct = (product: SupabaseProduct) => (
    <TouchableOpacity 
      key={product.id} 
      style={[
        styles.productCard,
        isDesktop && styles.productCardDesktop,
        isTablet && styles.productCardTablet,
      ]}
        onPress={() => navigation.navigate('SellerProductActions', { productId: product.id })}
      activeOpacity={0.7}
    >
      <View style={[
        styles.productImageContainer,
        isDesktop && styles.productImageDesktop,
        isTablet && styles.productImageTablet,
      ]}>
        <Image 
          source={{ uri: (product.images && product.images[0]) ? product.images[0] : undefined }} 
          style={[
            styles.productImage,
            isDesktop && styles.productImageDesktop,
            isTablet && styles.productImageTablet,
          ]}
        />
        {(!product.images || !product.images[0]) && (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="image-outline" size={40} color={COLORS.textMuted} />
          </View>
        )}
      </View>
      
      <View style={styles.productInfo}>
        <Text style={[styles.productName, { fontSize: fontSize.lg }]} numberOfLines={2}>
          {product.name}
        </Text>
        
        <View style={styles.priceContainer}>
          <Text style={[styles.productPrice, { fontSize: fontSize.md }]}>
            {product.price.toLocaleString()} FCA
          </Text>
          {(product as any).compare_price ? (
            <Text style={[styles.comparePrice, { fontSize: fontSize.sm }]}>
              {Number((product as any).compare_price).toLocaleString()} FCA
            </Text>
          ) : null}
        </View>
        
        <View style={styles.productMeta}>
          <View style={[
            styles.stockBadge,
            { backgroundColor: product.stock > 0 ? COLORS.success + '20' : COLORS.danger + '20' }
          ]}>
            <Ionicons 
              name={product.stock > 0 ? 'checkmark-circle' : 'alert-circle'} 
              size={14} 
              color={product.stock > 0 ? COLORS.success : COLORS.danger} 
            />
            <Text style={[
              styles.stockText,
              { color: product.stock > 0 ? COLORS.success : COLORS.danger }
            ]}>
              {product.stock > 0 ? `${product.stock} en stock` : 'Rupture'}
            </Text>
          </View>
          
          <View style={[
            styles.statusBadge,
            { backgroundColor: product.is_active ? COLORS.accent + '20' : COLORS.textMuted + '20' }
          ]}>
            <Ionicons 
              name={product.is_active ? 'eye' : 'eye-off'} 
              size={14} 
              color={product.is_active ? COLORS.accent : COLORS.textMuted} 
            />
            <Text style={[
              styles.statusText,
              { color: product.is_active ? COLORS.accent : COLORS.textMuted }
            ]}>
              {product.is_active ? 'Actif' : 'Inactif'}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.productActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => shareOrCopyProductUrl(product.id)}
        >
          <Ionicons name="share-social-outline" size={20} color={COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('SellerProductPreview', { productId: product.id })}
        >
          <Ionicons name="eye-outline" size={20} color={COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('SellerEditProduct', { productId: product.id })}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDeleteProduct(product.id)}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Grille responsive pour desktop/tablette
  const renderGridView = () => {
    const numColumns = isDesktop ? 3 : isTablet ? 2 : 1;
    const items = [...filteredProducts];
    const rows = [];
    
    for (let i = 0; i < items.length; i += numColumns) {
      const rowItems = items.slice(i, i + numColumns);
      rows.push(
        <View key={i} style={styles.gridRow}>
          {rowItems.map(item => (
            <View key={item.id} style={[styles.gridItem, { flex: 1 / numColumns }]}>
              {renderProduct(item)}
            </View>
          ))}
        </View>
      );
    }
    
    return rows;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, flex: 1 }]}>
      {/* Header with gradient */}
      <LinearGradient
        colors={[COLORS.accent, COLORS.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { fontSize: fontSize.heading }]}>
              Gestion des produits
            </Text>
            <Text style={[styles.headerSubtitle, { fontSize: fontSize.sm }]}>
              {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                if (!hasAnyCollection) {
                  Alert.alert(
                    'Collections requises',
                    'Vous devez créer au moins une collection avant d’ajouter un produit.',
                    [
                      { text: 'Créer une collection', onPress: () => navigation.navigate('SellerCollection') },
                      { text: 'OK', style: 'cancel' },
                    ]
                  );
                  return;
                }
                setShowAddProductModal(true);
              }}
            >
              <Ionicons name="add" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <SellerFiltersRow
        filters={filters}
        selectedId={selectedFilter}
        onSelect={setSelectedFilter}
        counts={stats as any}
        isMobile={isMobile}
      />

      {/* Search Bar */}
      <View style={[styles.searchContainer, { paddingHorizontal: spacing.lg, marginTop: SPACING.md }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
          <TextInput
            style={[styles.searchInput, { fontSize: fontSize.md }]}
            placeholder="Rechercher un produit..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Products List/Grid */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.productsContent,
          { paddingHorizontal: spacing.lg, paddingBottom: 100 }
        ]}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={[styles.loadingText, { fontSize: fontSize.md }]}>Chargement des produits...</Text>
          </View>
        ) : storeId && !hasAnyCollection ? (
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={80} color={COLORS.textMuted} />
            <Text style={[styles.emptyStateTitle, { fontSize: fontSize.titleLarge }]}>Aucune collection trouvée</Text>
            <Text style={[styles.emptyStateText, { fontSize: fontSize.md }]}
            >
              Pour ajouter un produit, vous devez d’abord créer une collection.
            </Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={() => navigation.navigate('SellerCollection')}>
              <Text style={styles.emptyStateButtonText}>Créer une collection</Text>
            </TouchableOpacity>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={80} color={COLORS.textMuted} />
              <Text style={[styles.emptyStateTitle, { fontSize: fontSize.titleLarge }]}>
                Aucun produit trouvé
              </Text>
            <Text style={[styles.emptyStateText, { fontSize: fontSize.md }]}>
              {storeId ? 'Essayez de modifier votre recherche ou ajoutez un nouveau produit' : 'Aucune boutique trouvée pour ce compte. Crée ta boutique avant d’ajouter des produits.'}
            </Text>
            <TouchableOpacity 
              style={styles.emptyStateButton}
              onPress={() => {
                if (!storeId) return;
                if (!hasAnyCollection) {
                  navigation.navigate('SellerCollection');
                  return;
                }
                setShowAddProductModal(true);
              }}
              disabled={!storeId || !hasAnyCollection}
            >
              <Text style={styles.emptyStateButtonText}>Ajouter un produit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          isDesktop || isTablet ? renderGridView() : (
            filteredProducts.map(renderProduct)
          )
        )}
      </ScrollView>

      {/* FAB for mobile */}
      {isMobile && (
        <TouchableOpacity 
          style={[styles.fab, { bottom: spacing.xxl + 25, right: spacing.lg }]}
          onPress={() => {
            if (!hasAnyCollection) {
              navigation.navigate('SellerCollection');
              return;
            }
            setShowAddProductModal(true);
          }}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* Modal pour ajouter un produit réutilisable */}
      <AddProductModal
        visible={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        collections={(collections || []).filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name }))}
        onAdd={async (product) => {
          if (!storeId) {
            Alert.alert('Erreur', 'Aucune boutique trouvée pour ce compte');
            return;
          }

          if (!product.collectionId) {
            Alert.alert('Erreur', 'Veuillez sélectionner une collection');
            return;
          }
          try {
            const uploadedUrls: string[] = [];
            if (Array.isArray(product.images) && product.images.length > 0) {
              for (const uri of product.images.slice(0, 5)) {
                const url = await cloudinaryService.uploadImage(uri, { folder: 'libreshop/products' });
                uploadedUrls.push(url);
              }
            }

            const created = await productService.create({
              store_id: storeId,
              collection_id: product.collectionId,
              name: String(product.name || '').trim(),
              price: Number.parseInt(product.price, 10) || 0,
              compare_price: product.comparePrice ? Number.parseInt(product.comparePrice, 10) : undefined,
              stock: Number.parseInt(product.stock || '0', 10) || 0,
              reference: product.barcode ? String(product.barcode) : undefined,
              images: uploadedUrls.length > 0 ? uploadedUrls : [],
              is_active: true,
              is_online_sale: true,
              is_physical_sale: true,
            } as any);
            setProducts((prev) => [created as any as SupabaseProduct, ...prev]);
            setShowAddProductModal(false);
            Alert.alert('Succès', 'Produit ajouté avec succès');
          } catch (e) {
            console.error('create product', e);
            Alert.alert('Erreur', "Impossible d'ajouter le produit");
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    zIndex: 1,
  },
  headerGradient: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    color: COLORS.white + 'CC',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  searchContainer: {
    paddingVertical: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    color: COLORS.text,
  },
  productsContent: {
    flexGrow: 1,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productCardDesktop: {
    flexDirection: 'column',
    width: '100%',
  },
  productCardTablet: {
    flexDirection: 'column',
    width: '100%',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    marginRight: SPACING.md,
  },
  productImageDesktop: {
    width: '100%',
    height: 150,
    marginRight: 0,
    marginBottom: SPACING.md,
  },
  productImageTablet: {
    width: '100%',
    height: 120,
    marginRight: 0,
    marginBottom: SPACING.md,
  },
  productInfo: {
    flex: 1,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  productPrice: {
    fontWeight: '700',
    color: COLORS.accent2,
  },
  comparePrice: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  productMeta: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  productName: {
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  stockText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  productActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  actionButton: {
    padding: SPACING.xs,
  },
  gridRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  gridItem: {
    marginHorizontal: SPACING.xs / 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyStateTitle: {
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    color: COLORS.textSoft,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  emptyStateButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  emptyStateButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  loadingText: {
    marginTop: SPACING.lg,
    color: COLORS.textSoft,
  },
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: `0px 4px 8px ${COLORS.accent}40` }
      : {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    maxHeight: '80%',
  },
  modalContentDesktop: {
    maxWidth: 800,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  productImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageContainer: {
    position: 'relative',
  },
});

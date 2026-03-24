import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { errorHandler } from '../utils/errorHandler';
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
  Switch,
  Modal,
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
  type Store,
} from '../lib/supabase';
import { cloudinaryService } from '../lib/cloudinaryService';
import { useAuthStore } from '../store';

type SortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'date_desc' | 'date_asc';
type ViewMode = 'list' | 'grid';
type StockFilterType = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

const SORT_OPTIONS: { id: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'date_desc', label: 'Plus récents', icon: 'time-outline' },
  { id: 'date_asc', label: 'Plus anciens', icon: 'time-outline' },
  { id: 'name_asc', label: 'Nom A → Z', icon: 'text-outline' },
  { id: 'name_desc', label: 'Nom Z → A', icon: 'text-outline' },
  { id: 'price_asc', label: 'Prix croissant', icon: 'trending-up-outline' },
  { id: 'price_desc', label: 'Prix décroissant', icon: 'trending-down-outline' },
  { id: 'stock_asc', label: 'Stock faible d\'abord', icon: 'alert-circle-outline' },
  { id: 'stock_desc', label: 'Stock élevé d\'abord', icon: 'checkmark-circle-outline' },
];

export const SellerProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { width, isMobile, isTablet, isDesktop, spacing, fontSize } = useResponsive();

  // Core state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Advanced filters
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [stockFilter, setStockFilter] = useState<StockFilterType>('all');

  const getProductPublicUrl = useCallback((productId: string) => {
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    return webBaseUrl ? `${webBaseUrl}/product/${productId}` : Linking.createURL(`/product/${productId}`);
  }, []);

  const shareOrCopyProductUrl = useCallback(async (productId: string) => {
    const url = getProductPublicUrl(productId);
    if (Platform.OS === 'web') {
      const clipboard = (globalThis as any)?.navigator?.clipboard;
      if (clipboard?.writeText) {
        await clipboard.writeText(url);
        Alert.alert('✅ Copié !', 'Le lien du produit a été copié.');
        return;
      }
    }
    await Share.share({ message: url, url });
  }, [getProductPublicUrl]);

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
      setStore(store);
      setStoreId(store.id);
      const cols = await collectionService.getByStore(store.id);
      setCollections(cols);
      const data = await productService.getByStoreAll(store.id);
      setProducts((data as any[]) as SupabaseProduct[]);
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'load products');
      Alert.alert('Erreur', 'Impossible de charger les produits');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  const collectionFilters = useMemo(() => {
    return (collections || []).filter(c => c.is_active).map(c => ({ id: c.id, label: c.name, icon: 'albums-outline' as const }));
  }, [collections]);

  const filters = useMemo(() => [{ id: 'all', label: 'Tous', icon: 'apps-outline' as const }, ...collectionFilters], [collectionFilters]);

  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter(p => p.stock > 3).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 3).length;
    const outOfStock = products.filter(p => p.stock <= 0).length;
    const promoCount = products.filter(p => p.compare_price && p.compare_price > p.price).length;
    const totalViews = products.reduce((sum, p) => sum + (Number(p.views_count) || 0), 0);
    return { total, inStock, lowStock, outOfStock, promoCount, totalViews };
  }, [products]);

  const collectionStats = useMemo(() => {
    const s: { [key: string]: number } = { all: products.length };
    collectionFilters.forEach(c => {
      s[c.id] = products.filter(p => String((p as any).collection_id || '') === c.id).length;
    });
    return s;
  }, [products, collectionFilters]);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = String(product.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCollection = selectedFilter === 'all' || String((product as any).collection_id || '') === selectedFilter;
      let matchesPrice = true;
      if (priceRange.min) matchesPrice = product.price >= parseFloat(priceRange.min);
      if (priceRange.max) matchesPrice = matchesPrice && product.price <= parseFloat(priceRange.max);
      let matchesStock = true;
      if (stockFilter === 'in_stock') matchesStock = product.stock > 3;
      else if (stockFilter === 'low_stock') matchesStock = product.stock > 0 && product.stock <= 3;
      else if (stockFilter === 'out_of_stock') matchesStock = product.stock <= 0;
      return matchesSearch && matchesCollection && matchesPrice && matchesStock;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'stock_asc': return a.stock - b.stock;
        case 'stock_desc': return b.stock - a.stock;
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date_desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default: return 0;
      }
    });

    return filtered;
  }, [products, searchQuery, selectedFilter, priceRange, stockFilter, sortBy]);

  const hasAnyCollection = collections.length > 0;
  const hasActiveFilters = priceRange.min || priceRange.max || stockFilter !== 'all';

  const handleQuickToggleActive = async (product: SupabaseProduct) => {
    const newValue = !product.is_active;
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: newValue } : p));
    try {
      await productService.update(product.id, { is_active: newValue } as any);
    } catch (e) {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: product.is_active } : p));
      Alert.alert('Erreur', 'Impossible de mettre à jour le produit');
    }
  };

  const handleDuplicateProduct = async (product: SupabaseProduct) => {
    Alert.alert(
      'Dupliquer le produit',
      `Voulez-vous créer une copie de "${product.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Dupliquer',
          onPress: async () => {
            try {
              setLoading(true);
              const newProduct = await productService.create({
                store_id: storeId!,
                collection_id: (product as any).collection_id,
                name: `${product.name} (copie)`,
                price: product.price,
                compare_price: (product as any).compare_price,
                stock: product.stock,
                reference: (product as any).reference,
                images: product.images,
                is_active: false,
                is_online_sale: (product as any).is_online_sale ?? true,
                is_physical_sale: (product as any).is_physical_sale ?? true,
              } as any);
              setProducts(prev => [newProduct as any as SupabaseProduct, ...prev]);
              Alert.alert('✅ Succès', 'Produit dupliqué (inactif par défaut).');
            } catch (e) {
              errorHandler.handleDatabaseError(e as Error, 'duplicate product');
              Alert.alert('Erreur', 'Impossible de dupliquer le produit.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteProduct = (productId: string) => {
    Alert.alert(
      '⚠️ Supprimer le produit',
      'Cette action est irréversible. Le produit sera définitivement supprimé.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.delete(productId);
              setProducts(prev => prev.filter(p => p.id !== productId));
              Alert.alert('✅ Supprimé', 'Le produit a été supprimé.');
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de supprimer le produit.');
            }
          },
        },
      ]
    );
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleBulkActivate = async (activate: boolean) => {
    const ids = Array.from(selectedProducts);
    setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, is_active: activate } : p));
    try {
      await Promise.all(ids.map(id => productService.update(id, { is_active: activate } as any)));
      Alert.alert('✅ Succès', `${ids.length} produit(s) ${activate ? 'activé(s)' : 'désactivé(s)'}.`);
    } catch (e) {
      loadProducts();
      Alert.alert('Erreur', 'Une erreur est survenue.');
    }
    setSelectedProducts(new Set());
    setSelectionMode(false);
  };

  const handleBulkDelete = () => {
    const count = selectedProducts.size;
    Alert.alert(
      `⚠️ Supprimer ${count} produit(s)`,
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const ids = Array.from(selectedProducts);
            try {
              await Promise.all(ids.map(id => productService.delete(id)));
              setProducts(prev => prev.filter(p => !ids.includes(p.id)));
              Alert.alert('✅ Supprimé', `${count} produit(s) supprimé(s).`);
            } catch (e) {
              Alert.alert('Erreur', 'Une erreur est survenue.');
            }
            setSelectedProducts(new Set());
            setSelectionMode(false);
          },
        },
      ]
    );
  };

  const getStockInfo = (stock: number) => {
    if (stock <= 0) return { label: 'Rupture de stock', color: COLORS.danger, icon: 'close-circle' as const };
    if (stock <= 3) return { label: `⚠️ Stock faible (${stock})`, color: '#F59E0B', icon: 'alert-circle' as const };
    return { label: `${stock} en stock`, color: COLORS.success, icon: 'checkmark-circle' as const };
  };

  const renderProduct = (product: SupabaseProduct) => {
    const stockInfo = getStockInfo(product.stock);
    const hasPromo = product.compare_price && product.compare_price > (product.price || 0);
    const isSelected = selectedProducts.has(product.id);
    const isGrid = viewMode === 'grid';

    return (
      <TouchableOpacity
        key={product.id}
        style={[
          styles.productCard,
          isGrid && styles.productCardGrid,
          isSelected && styles.productCardSelected,
        ]}
        onPress={() => {
          if (selectionMode) { toggleSelectProduct(product.id); return; }
          navigation.navigate('SellerProductActions', { productId: product.id });
        }}
        onLongPress={() => { setSelectionMode(true); toggleSelectProduct(product.id); }}
        activeOpacity={0.8}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <View style={styles.checkbox}>
            {isSelected
              ? <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />
              : <Ionicons name="ellipse-outline" size={24} color={COLORS.textMuted} />}
          </View>
        )}

        {/* Image */}
        <View style={[styles.productImageContainer, isGrid && styles.productImageContainerGrid]}>
          {product.images && product.images[0] ? (
            <Image source={{ uri: product.images[0] }} style={[styles.productImage, isGrid && styles.productImageGrid]} resizeMode="cover" />
          ) : (
            <LinearGradient colors={[COLORS.border + '60', COLORS.border + '20']} style={[styles.productImage, isGrid && styles.productImageGrid, styles.imagePlaceholder]}>
              {isGrid ? (
                <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.textMuted + '80' }}>
                  {product.name.charAt(0).toUpperCase()}
                </Text>
              ) : (
                <>
                  <Ionicons name="cube-outline" size={28} color={COLORS.textMuted} />
                  <Text style={styles.imagePlaceholderText}>Pas d'image</Text>
                </>
              )}
            </LinearGradient>
          )}
          {/* Promo badge */}
          {hasPromo && (
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>PROMO</Text>
            </View>
          )}
          {/* Stock overlay for grid */}
          {isGrid && product.stock <= 0 && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockText}>Rupture</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={[styles.productInfo, isGrid && styles.productInfoGrid]}>
          <Text style={[styles.productName, isGrid && styles.productNameGrid]} numberOfLines={isGrid ? 2 : 1}>
            {product.name}
          </Text>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.productPrice}>
              {product.price.toLocaleString()} FCFA
            </Text>
            {hasPromo && (
              <Text style={styles.comparePrice}>
                {Number((product as any).compare_price).toLocaleString()} FCFA
              </Text>
            )}
          </View>

          {/* Stock badge */}
          <View style={[styles.stockBadge, { backgroundColor: stockInfo.color + '18' }]}>
            <Ionicons name={stockInfo.icon} size={13} color={stockInfo.color} />
            <Text style={[styles.stockText, { color: stockInfo.color }]}>{stockInfo.label}</Text>
          </View>

          {/* Engagement metrics & Chevron */}
          <View style={styles.engagementRow}>
            <View style={styles.engagementItem}>
              <Ionicons name="eye-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.engagementText}>{Number(product.view_count || 0).toLocaleString()}</Text>
            </View>
            {!isGrid && (
              <Ionicons name="chevron-forward" size={20} color={COLORS.border} style={styles.chevron} />
            )}
          </View>

          {!isGrid && (
            <View style={styles.bottomRow}>
              {/* Active toggle */}
              <View style={styles.activeToggleRow}>
                <Text style={styles.activeLabel}>{product.is_active ? 'Visible' : 'Masqué'}</Text>
                <Switch
                  value={product.is_active}
                  onValueChange={() => handleQuickToggleActive(product)}
                  trackColor={{ false: COLORS.border, true: COLORS.accent + '60' }}
                  thumbColor={product.is_active ? COLORS.accent : COLORS.textMuted}
                  style={{ transform: [{ scale: 0.85 }] }}
                />
              </View>

              {/* Actions */}
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => shareOrCopyProductUrl(product.id)}>
                  <Ionicons name="share-social-outline" size={18} color={COLORS.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('SellerProductActions', { productId: product.id })}>
                  <Ionicons name="eye-outline" size={18} color={COLORS.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('SellerEditProduct', { productId: product.id })}>
                  <Ionicons name="create-outline" size={18} color={COLORS.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDuplicateProduct(product)}>
                  <Ionicons name="copy-outline" size={18} color={COLORS.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteProduct(product.id)}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isGrid && (
            <View style={styles.gridActionsRow}>
              <TouchableOpacity style={styles.gridActionBtn} onPress={() => handleQuickToggleActive(product)}>
                <Ionicons name={product.is_active ? 'eye' : 'eye-off'} size={16} color={product.is_active ? COLORS.accent : COLORS.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.gridActionBtn} onPress={() => navigation.navigate('SellerEditProduct', { productId: product.id })}>
                <Ionicons name="create-outline" size={16} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.gridActionBtn} onPress={() => handleDuplicateProduct(product)}>
                <Ionicons name="copy-outline" size={16} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.gridActionBtn} onPress={() => handleDeleteProduct(product.id)}>
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderGridLayout = () => {
    const numCols = isDesktop ? 3 : isTablet ? 2 : 2;
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < filteredProducts.length; i += numCols) {
      const rowItems = filteredProducts.slice(i, i + numCols);
      rows.push(
        <View key={i} style={styles.gridRow}>
          {rowItems.map(item => (
            <View key={item.id} style={[styles.gridCell, { width: `${100 / numCols}%` }]}>
              {renderProduct(item)}
            </View>
          ))}
          {rowItems.length < numCols && Array.from({ length: numCols - rowItems.length }).map((_, j) => (
            <View key={`empty-${j}`} style={[styles.gridCell, { width: `${100 / numCols}%` }]} />
          ))}
        </View>
      );
    }
    return rows;
  };

  const currentSort = SORT_OPTIONS.find(s => s.id === sortBy);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={[COLORS.accent, COLORS.accent2 || COLORS.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerTitle}>Mes Produits</Text>
          <View style={styles.planBadgeContainer}>
            <Text style={styles.headerSubtitle}>
              {products.length}{store?.product_limit ? ` / ${store.product_limit}` : ''} produit{products.length !== 1 ? 's' : ''}
              {products.length > 0 ? ' • Appuyez pour plus d\'options' : ''}
            </Text>
            {store?.subscription_plan && (
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{store.subscription_plan}</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (!hasAnyCollection) {
              Alert.alert('Collections requises', 'Créez d\'abord une collection pour organiser vos produits.', [
                { text: 'Créer une collection', onPress: () => navigation.navigate('SellerCollection') },
                { text: 'Annuler', style: 'cancel' },
              ]);
              return;
            }
            if (store?.product_limit && products.length >= store.product_limit) {
              Alert.alert(
                'Limite atteinte',
                `Vous avez atteint la limite de ${store.product_limit} produits de votre plan "${store.subscription_plan}".`,
                [{ text: 'OK' }]
              );
              return;
            }
            setShowAddProductModal(true);
          }}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: COLORS.accent }]}>{stats.inStock}</Text>
          <Text style={styles.statLabel}>✅ En stock</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{stats.lowStock}</Text>
          <Text style={styles.statLabel}>⚠️ Stock faible</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: COLORS.danger }]}>{stats.outOfStock}</Text>
          <Text style={styles.statLabel}>❌ Rupture</Text>
        </View>
        {stats.promoCount > 0 && <>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#8B5CF6' }]}>{stats.promoCount}</Text>
            <Text style={styles.statLabel}>🏷️ Promo</Text>
          </View>
        </>}
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: COLORS.accent }]}>
             {stats.totalViews >= 1000 ? `${(stats.totalViews / 1000).toFixed(1)}K` : stats.totalViews}
          </Text>
          <Text style={styles.statLabel}>👁️ Vues</Text>
        </View>
      </View>

      {/* Collection filters */}
      <SellerFiltersRow
        filters={filters}
        selectedId={selectedFilter}
        onSelect={setSelectedFilter}
        counts={collectionStats as any}
        isMobile={isMobile}
      />

      {/* Search + controls bar */}
      <View style={styles.controlsBar}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort button */}
        <TouchableOpacity style={styles.controlBtn} onPress={() => setShowSortModal(true)}>
          <Ionicons name="funnel-outline" size={18} color={COLORS.accent} />
        </TouchableOpacity>

        {/* Filters button */}
        <TouchableOpacity
          style={[styles.controlBtn, hasActiveFilters && styles.controlBtnActive]}
          onPress={() => setShowFiltersModal(true)}
        >
          <Ionicons name="options-outline" size={18} color={hasActiveFilters ? '#fff' : COLORS.accent} />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </TouchableOpacity>

        {/* View mode toggle */}
        <TouchableOpacity style={styles.controlBtn} onPress={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}>
          <Ionicons name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} size={18} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Selection mode bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedProducts(new Set()); }}>
            <Text style={styles.selectionCancel}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.selectionCount}>{selectedProducts.size} sélectionné(s)</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.selActionBtn} onPress={() => handleBulkActivate(true)}>
              <Ionicons name="eye" size={16} color={COLORS.success} />
              <Text style={[styles.selActionText, { color: COLORS.success }]}>Activer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.selActionBtn} onPress={() => handleBulkActivate(false)}>
              <Ionicons name="eye-off" size={16} color={COLORS.textMuted} />
              <Text style={[styles.selActionText, { color: COLORS.textMuted }]}>Masquer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.selActionBtn} onPress={handleBulkDelete}>
              <Ionicons name="trash" size={16} color={COLORS.danger} />
              <Text style={[styles.selActionText, { color: COLORS.danger }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Product list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.md, paddingBottom: 100 }]}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Chargement des produits…</Text>
          </View>
        ) : storeId && !hasAnyCollection ? (
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={72} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Aucune collection</Text>
            <Text style={styles.emptyText}>Créez d'abord une collection pour y ajouter des produits.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('SellerCollection')}>
              <Text style={styles.emptyBtnText}>Créer une collection</Text>
            </TouchableOpacity>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={72} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>
              {searchQuery || hasActiveFilters ? 'Aucun résultat' : 'Aucun produit'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery || hasActiveFilters
                ? 'Essayez de modifier votre recherche ou vos filtres.'
                : storeId
                  ? 'Commencez à ajouter vos produits ici.'
                  : 'Créez votre boutique avant d\'ajouter des produits.'}
            </Text>
            {storeId && hasAnyCollection && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => {
                  if (store?.product_limit && products.length >= store.product_limit) {
                    Alert.alert(
                      'Limite atteinte',
                      `Vous avez atteint la limite de ${store.product_limit} produits de votre plan "${store.subscription_plan}".`,
                      [{ text: 'OK' }]
                    );
                    return;
                  }
                  setShowAddProductModal(true);
                }}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Ajouter un produit</Text>
              </TouchableOpacity>
            )}
            {(searchQuery || hasActiveFilters) && (
              <TouchableOpacity style={styles.emptyBtnOutline} onPress={() => { setSearchQuery(''); setPriceRange({ min: '', max: '' }); setStockFilter('all'); }}>
                <Text style={styles.emptyBtnOutlineText}>Effacer les filtres</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : viewMode === 'grid' ? (
          renderGridLayout()
        ) : (
          filteredProducts.map(renderProduct)
        )}
      </ScrollView>

      {/* FAB */}
      {isMobile && !selectionMode && (
        <TouchableOpacity
          style={[styles.fab, { bottom: spacing.xxl + 25, right: spacing.lg }]}
          onPress={() => {
            if (!hasAnyCollection) { navigation.navigate('SellerCollection'); return; }
            if (store?.product_limit && products.length >= store.product_limit) {
              Alert.alert(
                'Limite atteinte',
                `Vous avez atteint la limite de ${store.product_limit} produits de votre plan "${store.subscription_plan}".`,
                [{ text: 'OK' }]
              );
              return;
            }
            setShowAddProductModal(true);
          }}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Sort Modal */}
      <Modal visible={showSortModal} transparent animationType="slide" onRequestClose={() => setShowSortModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSortModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Trier par</Text>
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.sortOption, sortBy === opt.id && styles.sortOptionActive]}
                onPress={() => { setSortBy(opt.id); setShowSortModal(false); }}
              >
                <Ionicons name={opt.icon} size={18} color={sortBy === opt.id ? COLORS.accent : COLORS.textMuted} />
                <Text style={[styles.sortOptionText, sortBy === opt.id && { color: COLORS.accent, fontWeight: '700' }]}>
                  {opt.label}
                </Text>
                {sortBy === opt.id && <Ionicons name="checkmark" size={18} color={COLORS.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filters Modal */}
      <Modal visible={showFiltersModal} transparent animationType="slide" onRequestClose={() => setShowFiltersModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFiltersModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtres avancés</Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={() => { setPriceRange({ min: '', max: '' }); setStockFilter('all'); }}>
                  <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.sm }}>Réinitialiser</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.filterSectionTitle}>Fourchette de prix (FCFA)</Text>
            <View style={styles.priceRangeRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={priceRange.min}
                onChangeText={v => setPriceRange(p => ({ ...p, min: v }))}
              />
              <Text style={{ color: COLORS.textMuted }}>—</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={priceRange.max}
                onChangeText={v => setPriceRange(p => ({ ...p, max: v }))}
              />
            </View>

            <Text style={styles.filterSectionTitle}>Niveau de stock</Text>
            {([
              { id: 'all', label: 'Tous', color: COLORS.text },
              { id: 'in_stock', label: '✅ En stock (> 3)', color: COLORS.success },
              { id: 'low_stock', label: '⚠️ Stock faible (1–3)', color: '#F59E0B' },
              { id: 'out_of_stock', label: '❌ Rupture de stock', color: COLORS.danger },
            ] as { id: StockFilterType; label: string; color: string }[]).map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.filterOption, stockFilter === opt.id && styles.filterOptionActive]}
                onPress={() => setStockFilter(opt.id)}
              >
                <Text style={[styles.filterOptionText, { color: opt.color }]}>{opt.label}</Text>
                {stockFilter === opt.id && <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFiltersModal(false)}>
              <Text style={styles.applyBtnText}>
                Appliquer {filteredProducts.length > 0 ? `(${filteredProducts.length} résultat(s))` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Product Modal */}
      <AddProductModal
        visible={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        collections={(collections || []).filter(c => c.is_active).map(c => ({ id: c.id, name: c.name }))}
        onAdd={async (product) => {
          if (!storeId) { Alert.alert('Erreur', 'Aucune boutique trouvée pour ce compte'); return; }
          if (!product.collectionId) { Alert.alert('Erreur', 'Veuillez sélectionner une collection'); return; }
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
              images: uploadedUrls,
              is_active: true,
              is_online_sale: true,
              is_physical_sale: true,
            } as any);
            setProducts(prev => [created as any as SupabaseProduct, ...prev]);
            setShowAddProductModal(false);
            Alert.alert('✅ Succès', 'Produit ajouté avec succès !');
          } catch (e) {
            errorHandler.handleDatabaseError(e as Error, 'create product');
            Alert.alert('Erreur', "Impossible d'ajouter le produit");
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: '#fff' },
  planBadgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  headerSubtitle: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.8)' },
  planBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  planBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },

  // Stats bar
  statsBar: { flexDirection: 'row', backgroundColor: COLORS.card, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: FONT_SIZE.xl, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // Controls
  controlsBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.xs, backgroundColor: COLORS.bg },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  searchInput: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.md },
  controlBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  controlBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  filterDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.danger },

  // Selection bar
  selectionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, elevation: 5, ...Platform.select({ web: { boxShadow: '0 -2px 4px rgba(0,0,0,0.1)' } as any, default: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4 } }) },
  selectionCancel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  selectionCount: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.accent },
  selectionActions: { flexDirection: 'row', gap: SPACING.sm },
  selActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: COLORS.card },
  selActionText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },

  // List
  listContent: { paddingTop: SPACING.md },

  // Product card (LIST)
  productCard: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  productCardSelected: { borderColor: COLORS.accent, borderWidth: 2 },

  // Product card (GRID)
  productCardGrid: { flexDirection: 'column', borderRadius: RADIUS.lg, marginBottom: 0 },

  // Image (LIST)
  productImageContainer: { position: 'relative' },
  productImage: { width: 90, height: 90, borderRadius: 0 },
  productImageContainerGrid: { width: '100%' },
  productImageGrid: { width: '100%', height: 130, borderRadius: 0 },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderText: { fontSize: 9, color: COLORS.textMuted, marginTop: 4 },

  // Badges on image
  promoBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#8B5CF6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  promoBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  outOfStockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  outOfStockText: { color: '#fff', fontWeight: '800', fontSize: FONT_SIZE.sm },

  // Checkbox
  checkbox: { position: 'absolute', top: 8, left: 8, zIndex: 10 },

  // Product info
  productInfo: { flex: 1, padding: SPACING.md, justifyContent: 'space-between' },
  productInfoGrid: { padding: SPACING.sm },
  productName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  productNameGrid: { fontSize: FONT_SIZE.sm },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 6 },
  productPrice: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.accent },
  comparePrice: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textDecorationLine: 'line-through' },

  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, alignSelf: 'flex-start', marginBottom: 6 },
  stockText: { fontSize: 11, fontWeight: '600' },
  engagementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  engagementItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  engagementText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  chevron: { marginLeft: 'auto' },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  activeToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  actionButtons: { flexDirection: 'row', gap: SPACING.xs },
  actionBtn: { padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg },

  gridActionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.xs },
  gridActionBtn: { padding: 4 },

  gridRow: { flexDirection: 'row', marginBottom: SPACING.md, gap: SPACING.sm },
  gridCell: { paddingHorizontal: SPACING.xs / 2, flex: 1 },

  // Empty state
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl * 2 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.accent, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.lg },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
  emptyBtnOutline: { marginTop: SPACING.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  emptyBtnOutlineText: { color: COLORS.textMuted, fontWeight: '600' },

  // Loading
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl * 2 },
  loadingText: { marginTop: SPACING.lg, color: COLORS.textMuted },

  // FAB
  fab: {
    position: 'absolute',
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: `0px 4px 16px ${COLORS.accent}50` }
      : { elevation: 10, ...Platform.select({ web: { boxShadow: `0 6px 12px ${COLORS.accent}66` } as any, default: { shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } } }) }),
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.lg },

  sortOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.xs },
  sortOptionActive: { backgroundColor: COLORS.accent + '15' },
  sortOptionText: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text },

  filterSectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm, marginTop: SPACING.md },
  priceRangeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  priceInput: { flex: 1, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, color: COLORS.text, fontSize: FONT_SIZE.md },
  filterOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.xs },
  filterOptionActive: { backgroundColor: COLORS.accent + '15' },
  filterOptionText: { fontSize: FONT_SIZE.md, fontWeight: '500' },
  applyBtn: { backgroundColor: COLORS.accent, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center', marginTop: SPACING.lg },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});

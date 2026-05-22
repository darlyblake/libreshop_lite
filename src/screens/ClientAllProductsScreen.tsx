import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler } from '../utils/errorHandler';
import { ProductCard, ProductCardSkeleton } from '../components';
import { SortTabs } from '../components/SortTabs';
import { productService } from '../services/productService';
import { categoryService } from '../services/categoryService';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useResponsive } from '../utils/responsive';

const { width } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 1200;

export const ClientAllProductsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, isMobile, isTablet, isDesktop, isLargeDesktop } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [generalCategories, setGeneralCategories] = useState<any[]>([]);
  const [selectedGeneralCategory, setSelectedGeneralCategory] = useState<any>(null);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialSort = route.params?.sort || 'newest';
  const [sort, setSort] = useState<'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top'>(initialSort);

  const numColumns = isLargeDesktop ? 6 : isDesktop ? 4 : isTablet ? 3 : 2;
  const contentWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH);

  const itemWidth = useMemo(() => {
    const totalPadding = SPACING.lg * 2;
    const gap = SPACING.md * (numColumns - 1);
    return (contentWidth - totalPadding - gap) / numColumns;
  }, [contentWidth, numColumns]);

  // Load general categories from database
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoryData = await categoryService.getByParent(null);
        setGeneralCategories([{ id: 'all', name: 'Toutes' }, ...categoryData]);
      } catch (err) {
        console.error('Failed to load categories:', err);
        setGeneralCategories([{ id: 'all', name: 'Toutes' }]);
      }
    };
    loadCategories();
  }, []);

  // Load subcategories when general category changes
  useEffect(() => {
    const loadSubCategories = async () => {
      try {
        if (!selectedGeneralCategory || selectedGeneralCategory.id === 'all') {
          const allCats = await categoryService.getAll();
          const subCats = allCats.filter((c: any) => c.parent_id !== null);
          setSubCategories([{ id: 'all_sub', name: 'Toutes les sous-catégories' }, ...subCats]);
        } else {
          const subCatData = await categoryService.getByParent(selectedGeneralCategory.id);
          setSubCategories([{ id: 'all_sub', name: 'Toutes les sous-catégories' }, ...subCatData]);
        }
      } catch (err) {
        console.error('Failed to load subcategories:', err);
        setSubCategories([]);
      }
    };
    loadSubCategories();
  }, [selectedGeneralCategory]);

  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      setError(null);
      const currentPage = reset ? 0 : page;
      const pageSize = 20;

      // Fetch products based on selected category
      let productsData;
      const targetCategoryName = selectedSubCategory && selectedSubCategory.id !== 'all_sub'
        ? selectedSubCategory.name
        : (selectedGeneralCategory && selectedGeneralCategory.id !== 'all' ? selectedGeneralCategory.name : 'Toutes');

      if (targetCategoryName === 'Toutes') {
        productsData = await productService.getAll(currentPage, pageSize, sort);
      } else {
        productsData = await productService.getAllByCategory(targetCategoryName, currentPage, pageSize, sort);
      }

      if (productsData) {
        if (reset) {
          setProducts(productsData);
        } else {
          setProducts(prev => [...prev, ...productsData]);
        }
        setHasMore(productsData.length === pageSize);
      }
    } catch (e: any) {
      console.error('[ClientAllProducts] Error loading products:', e);
      errorHandler.handleDatabaseError?.(e, 'Failed to load products');
      setError(e.message || 'Impossible de charger les produits');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (page > 0) {
      loadData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGeneralCategory, selectedSubCategory]);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const SORT_OPTIONS: { id: typeof sort; label: string }[] = [
    { id: 'newest', label: 'Nouveautés' },
    { id: 'popular', label: 'Populaire' },
    { id: 'trending', label: 'Tendances' },
    { id: 'ranked', label: 'Tendance' },
    { id: 'sales', label: 'Top ventes' },
  ];

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Category filtering is done server-side, so we only do text search here
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [products, searchQuery]);

  const renderProductItem = useCallback(({ item }: { item: any }) => (
    <View style={[styles.productCardWrapper, { width: itemWidth }]}> 
      <ProductCard
        name={item.name}
        price={item.price}
        comparePrice={item.compare_price}
        imageUrl={item.images?.[0]}
        onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
      />
      <Text style={styles.storeName} numberOfLines={1}>{item.stores?.name || 'Boutique'}</Text>
    </View>
  ), [itemWidth, styles.productCardWrapper, styles.storeName, navigation]);

  return (
    <View style={styles.maxWidthContainer}>
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Produits</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={COLORS.textSoft} />
            <TextInput
              style={styles.searchInput}
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

        <View style={styles.sortContainer}>
          <SortTabs options={SORT_OPTIONS} selected={sort} onSelect={(id: any) => setSort(id)} />
        </View>

        <View style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
            {generalCategories.map((category) => {
              const isActive = (!selectedGeneralCategory && category.id === 'all') || selectedGeneralCategory?.id === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  onPress={() => {
                    setSelectedGeneralCategory(category.id === 'all' ? null : category);
                    setSelectedSubCategory(null);
                  }}
                >
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{category.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.mainContentRow}>
          {subCategories.length > 0 && (
            <View style={[styles.sidebar, { width: isMobile ? 130 : 200 }]}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarContent}>
                {subCategories.map((subCat) => {
                  const isActive = (!selectedSubCategory && subCat.id === 'all_sub') || selectedSubCategory?.id === subCat.id;
                  return (
                    <TouchableOpacity
                      key={subCat.id}
                      style={[styles.subCategoryItem, isActive && styles.subCategoryItemActive]}
                      onPress={() => setSelectedSubCategory(subCat.id === 'all_sub' ? null : subCat)}
                    >
                      <Text style={[styles.subCategoryText, isActive && styles.subCategoryTextActive]}>{subCat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.flex1}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>{filteredProducts.length} produits trouvés</Text>
            </View>

            {loading ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, padding: SPACING.lg }}>
                {Array.from({ length: numColumns * 2 }).map((_, idx) => (
                  <View key={`product-sk-${idx}`} style={{ width: itemWidth, marginBottom: SPACING.md }}>
                    <ProductCardSkeleton />
                  </View>
                ))}
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
                <Text style={styles.errorTitle}>Erreur de chargement</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => loadData(true)}>
                  <Text style={styles.retryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          renderItem={renderProductItem}
          ListFooterComponent={loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : null}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Aucun produit</Text>
              <Text style={styles.emptyText}>Essayez un autre filtre ou mot-clé.</Text>
            </View>
          )}
          
          // Performance Tuning Options:
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          updateCellsBatchingPeriod={50}
        />
            )}
          </View>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  maxWidthContainer: { flex: 1, alignItems: 'center', backgroundColor: COLORS.bg },
  container: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, backgroundColor: COLORS.bg, flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  placeholder: { width: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xxxl, paddingHorizontal: SPACING.xl, gap: SPACING.md },
  errorTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  errorText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.lg },
  retryButton: { backgroundColor: COLORS.accent, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.full },
  retryButtonText: { color: COLORS.text, fontWeight: '600', fontSize: FONT_SIZE.md },
  searchContainer: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  searchInput: { flex: 1, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text },
  categoriesContainer: { paddingBottom: SPACING.md },
  categoriesList: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  categoryChip: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  categoryText: { fontSize: FONT_SIZE.sm, fontWeight: '500', color: COLORS.textSoft },
  categoryTextActive: { color: COLORS.text },
  mainContentRow: { flex: 1, flexDirection: 'row' },
  sidebar: { borderRightWidth: 1, borderRightColor: COLORS.border, paddingRight: SPACING.sm },
  sidebarContent: { paddingHorizontal: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.sm },
  subCategoryItem: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md },
  subCategoryItemActive: { backgroundColor: COLORS.card },
  subCategoryText: { fontSize: FONT_SIZE.sm, fontWeight: '500', color: COLORS.textSoft },
  subCategoryTextActive: { color: COLORS.primary, fontWeight: '700' },
  flex1: { flex: 1 },
  resultsHeader: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  resultsCount: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  sortContainer: { paddingVertical: SPACING.sm, backgroundColor: COLORS.bg },
  row: { justifyContent: 'flex-start', gap: SPACING.md },
  productCardWrapper: { marginBottom: SPACING.lg },
  storeName: { marginTop: 6, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  footerLoader: { paddingVertical: SPACING.lg },
  emptyState: { padding: SPACING.xl, alignItems: 'center' },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

export default ClientAllProductsScreen;

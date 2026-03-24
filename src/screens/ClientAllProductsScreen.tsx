import React, { useState, useMemo, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler } from '../utils/errorHandler';
import { ProductCard } from '../components';
import { SortTabs } from '../components/SortTabs';
import { productService } from '../lib/supabase';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useResponsive } from '../utils/responsive';

const { width } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 1200;

const CATEGORIES = ['Toutes', 'Électronique', 'Mode', 'Beauté', 'Maison', 'Alimentation', 'Audio', 'Sports'];

export const ClientAllProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, isMobile, isTablet, isDesktop, isLargeDesktop } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top'>('newest');

  const numColumns = isLargeDesktop ? 6 : isDesktop ? 4 : isTablet ? 3 : 2;
  const contentWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH);

  const itemWidth = useMemo(() => {
    const totalPadding = SPACING.lg * 2;
    const gap = SPACING.md * (numColumns - 1);
    return (contentWidth - totalPadding - gap) / numColumns;
  }, [contentWidth, numColumns]);

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

      const productsData = await productService.getAll(currentPage, pageSize, sort);

      if (productsData) {
        if (reset) {
          setProducts(productsData);
        } else {
          setProducts(prev => [...prev, ...productsData]);
        }
        setHasMore(productsData.length === pageSize);
      }
    } catch (e: any) {
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

    if (selectedCategory !== 'Toutes') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [products, searchQuery, selectedCategory]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Produits</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Produits</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Erreur de chargement</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadData(true)}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>{category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>{filteredProducts.length} produits trouvés</Text>
        </View>

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
          renderItem={({ item }) => (
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
          )}
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
        />

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  maxWidthContainer: { flex: 1, alignItems: 'center', backgroundColor: COLORS.background },
  container: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, backgroundColor: COLORS.background, flex: 1 },
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
  resultsHeader: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  resultsCount: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  sortContainer: { paddingVertical: SPACING.sm, backgroundColor: COLORS.background },
  row: { justifyContent: 'flex-start', gap: SPACING.md },
  productCardWrapper: { marginBottom: SPACING.lg },
  storeName: { marginTop: 6, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  footerLoader: { paddingVertical: SPACING.lg },
  emptyState: { padding: SPACING.xl, alignItems: 'center' },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

export default ClientAllProductsScreen;

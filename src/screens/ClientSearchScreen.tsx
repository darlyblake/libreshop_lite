import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Keyboard,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import Animated, { 
  FadeInDown, 
  FadeOut,
  Layout,
  SlideInRight,
  SlideInLeft,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SearchBar } from '../components/SearchBar';
import { ProductCard, StoreCard } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useSearchStore } from '../store/searchStore';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOWS } from '../config/theme';
import { RootStackParamList } from '../navigation/types';
import { productService, storeService, Product, Store } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

// Constantes optimisées
const SEARCH_DEBOUNCE_DELAY = 300;
const MIN_QUERY_LENGTH = 2;
const INITIAL_BATCH_SIZE = 8;
const ANIMATION_DURATION = 400;

// Types avancés
interface Category {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

// Catégories populaires
const POPULAR_CATEGORIES: Category[] = [
  { id: '1', name: 'Smartphones', icon: 'phone-portrait-outline', color: '#8B5CF6' },
  { id: '2', name: 'Ordinateurs', icon: 'laptop-outline', color: '#EC4899' },
  { id: '3', name: 'Audio', icon: 'headset-outline', color: '#3B82F6' },
  { id: '4', name: 'Tablettes', icon: 'tablet-portrait-outline', color: '#10B981' },
  { id: '5', name: 'Accessoires', icon: 'watch-outline', color: '#F59E0B' },
  { id: '6', name: 'Caméras', icon: 'camera-outline', color: '#EF4444' },
];

// Suggestions de recherche
const SUGGESTIONS = [
  'iPhone 15',
  'MacBook Pro',
  'AirPods',
  'Samsung Galaxy',
  'PlayStation 5',
];

// Calcul réactif du nombre de colonnes avec gestion d'orientation
const useResponsiveGrid = () => {
  const [dimensions, setDimensions] = useState({ width, height });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  return useMemo(() => {
    const { width } = dimensions;
    if (width < 380) return 2;
    if (width < 600) return 2;
    if (width < 900) return 3;
    if (width < 1200) return 4;
    return 5;
  }, [dimensions]);
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Hook personnalisé pour la recherche optimisée
const useSearch = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < MIN_QUERY_LENGTH) {
      setProducts([]);
      setStores([]);
      setHasSearched(false);
      setError(null);
      setSuggestions([]);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setHasSearched(true);
    setError(null);

    try {
      // Générer des suggestions basées sur la requête
      const filteredSuggestions = SUGGESTIONS.filter(s => 
        s.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filteredSuggestions);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });

      const searchPromise = Promise.all([
        productService.search(query, abortControllerRef.current.signal),
        storeService.search(query, abortControllerRef.current.signal)
      ]);

      const [productsData, storesData] = await Promise.race([
        searchPromise,
        timeoutPromise
      ]) as [Product[], Store[]];

      setProducts(productsData || []);
      setStores(storesData || []);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      
      console.error('Search error:', error);
      setError('Une erreur est survenue lors de la recherche');
      setProducts([]);
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, SEARCH_DEBOUNCE_DELAY);
  }, [performSearch]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    products,
    stores,
    loading,
    hasSearched,
    error,
    suggestions,
    debouncedSearch
  };
};

export const ClientSearchScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const numColumns = useResponsiveGrid();
  const scrollY = useSharedValue(0);
  
  const { recentSearches, addToRecent, clearRecent } = useSearchStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const { products, stores, loading, hasSearched, error, suggestions, debouncedSearch } = useSearch();

  // Valeurs mémoïsées
  const productItemWidth = useMemo(() => 
    (width - SPACING.xl * 2 - SPACING.sm * (numColumns - 1)) / numColumns,
    [numColumns]
  );

  const hasResults = useMemo(() => 
    products.length > 0 || stores.length > 0,
    [products.length, stores.length]
  );

  // Animations du header
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 50],
      [1, 0.95],
      Extrapolate.CLAMP
    );
    
    const translateY = interpolate(
      scrollY.value,
      [0, 50],
      [0, -5],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // Handlers
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
    if (selectedCategory) setSelectedCategory(null);
  }, [debouncedSearch, selectedCategory]);

  const handleSearchSubmit = useCallback(() => {
    Keyboard.dismiss();
    if (searchQuery.trim().length >= MIN_QUERY_LENGTH) {
      addToRecent(searchQuery.trim());
    }
  }, [searchQuery, addToRecent]);

  const handleCategoryPress = useCallback((category: Category) => {
    setSelectedCategory(category.name);
    setSearchQuery(category.name);
    debouncedSearch(category.name);
    setIsFocused(false);
  }, [debouncedSearch]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    setSearchQuery(suggestion);
    addToRecent(suggestion);
    debouncedSearch(suggestion);
    Keyboard.dismiss();
  }, [addToRecent, debouncedSearch]);

  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate('ProductDetail', { productId: product.id });
  }, [navigation]);

  const handleStorePress = useCallback((store: Store) => {
    navigation.navigate('StoreDetail', { storeId: store.id });
  }, [navigation]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory(null);
    Keyboard.dismiss();
  }, []);

  // Renderers
  const renderProductItem = useCallback(({ item, index }: { item: Product; index: number }) => (
    <Animated.View
      entering={SlideInRight
        .delay(index * 30)
        .springify()
        .damping(12)
        .stiffness(100)
      }
      style={[
        styles.productItemContainer,
        { width: productItemWidth }
      ]}
    >
      <ProductCard
        name={item.name}
        price={item.price}
        imageUrl={item.images?.[0]}
        onPress={() => handleProductPress(item)}
      />
    </Animated.View>
  ), [productItemWidth, handleProductPress]);

  const renderStoreItem = useCallback(({ item, index }: { item: Store; index: number }) => (
    <Animated.View
      entering={SlideInLeft
        .delay(index * 30)
        .springify()
        .damping(14)
      }
    >
      <StoreCard
        name={item.name}
        category={item.category || 'Boutique'}
        description={item.description}
        logoUrl={item.logo_url}
        productCount={item.product_count}
        onPress={() => handleStorePress(item)}
      />
    </Animated.View>
  ), [handleStorePress]);

  const renderCategoryItem = useCallback(({ item, index }: { item: Category; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
    >
      <TouchableOpacity
        style={[
          styles.categoryItem,
          selectedCategory === item.name && styles.categoryItemActive
        ]}
        onPress={() => handleCategoryPress(item)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={selectedCategory === item.name 
            ? [item.color, `${item.color}DD`]
            : [COLORS.card, COLORS.card]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.categoryGradient}
        >
          <View style={[
            styles.categoryIconContainer,
            selectedCategory === item.name && styles.categoryIconContainerActive
          ]}>
            <Ionicons 
              name={item.icon} 
              size={24} 
              color={selectedCategory === item.name ? COLORS.white : item.color} 
            />
          </View>
          <Text style={[
            styles.categoryName,
            selectedCategory === item.name && styles.categoryNameActive
          ]}>
            {item.name}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  ), [selectedCategory, handleCategoryPress]);

  const renderRecentSearch = useCallback(({ item, index }: { item: string; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 30)}
      exiting={FadeOut}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        style={styles.recentItem}
        onPress={() => {
          setSearchQuery(item);
          addToRecent(item);
          debouncedSearch(item);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.recentIconContainer}>
          <Ionicons name="time-outline" size={20} color={COLORS.accent} />
        </View>
        <Text style={styles.recentText} numberOfLines={1}>
          {item}
        </Text>
        <Ionicons name="arrow-up" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  ), [addToRecent, debouncedSearch]);

  const renderSuggestionItem = useCallback(({ item, index }: { item: string; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 30)}
    >
      <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => handleSuggestionPress(item)}
        activeOpacity={0.7}
      >
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <Text style={styles.suggestionText}>{item}</Text>
      </TouchableOpacity>
    </Animated.View>
  ), [handleSuggestionPress]);

  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, headerAnimatedStyle]}>
      <BlurView intensity={80} tint="light" style={styles.headerBlur}>
        <View style={[styles.headerContent, { paddingTop: insets.top }]}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onClear={handleClearSearch}
            placeholder="Rechercher des produits ou boutiques..."
            style={styles.searchBar}
            autoFocus={false}
            showCancelButton={isFocused}
            onCancel={() => {
              setIsFocused(false);
              Keyboard.dismiss();
            }}
          />
        </View>
      </BlurView>
    </Animated.View>
  );

  const renderResults = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <EmptyState
          title="Oups ! Une erreur est survenue"
          description={error}
          icon="alert-circle-outline"
          actionLabel="Réessayer"
          onAction={() => debouncedSearch(searchQuery)}
          imageStyle={styles.emptyStateImage}
        />
      );
    }

    if (!hasResults && hasSearched) {
      return (
        <EmptyState
          title="Aucun résultat trouvé"
          description={`Désolé, nous n'avons rien trouvé pour "${searchQuery}". Essayez avec d'autres mots-clés.`}
          icon="search-outline"
          secondaryActionLabel="Voir les catégories"
          onSecondaryAction={() => setSelectedCategory(null)}
          imageStyle={styles.emptyStateImage}
        />
      );
    }

    return (
      <Animated.ScrollView
        style={styles.resultsContainer}
        contentContainerStyle={styles.resultsContent}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          scrollY.value = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        entering={FadeIn.duration(ANIMATION_DURATION)}
      >
        {products.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="cube-outline" size={22} color={COLORS.accent} />
                <Text style={styles.sectionTitle}>Produits</Text>
              </View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionCount}>{products.length}</Text>
              </View>
            </View>
            
            <FlatList
              data={products.slice(0, INITIAL_BATCH_SIZE)}
              renderItem={renderProductItem}
              keyExtractor={(item) => `product-${item.id}`}
              numColumns={numColumns}
              scrollEnabled={false}
              columnWrapperStyle={styles.productsGrid}
              initialNumToRender={INITIAL_BATCH_SIZE}
              maxToRenderPerBatch={INITIAL_BATCH_SIZE}
              windowSize={3}
              removeClippedSubviews={Platform.OS === 'android'}
            />
            
            {products.length > INITIAL_BATCH_SIZE && (
              <TouchableOpacity 
                style={styles.viewMoreButton}
                onPress={() => navigation.navigate('ProductList', { 
                  query: searchQuery,
                  category: selectedCategory 
                })}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[COLORS.accent, COLORS.accentLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.viewMoreGradient}
                >
                  <Text style={styles.viewMoreText}>Voir tous les produits</Text>
                  <View style={styles.viewMoreIconContainer}>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        {stores.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="storefront-outline" size={22} color={COLORS.accent} />
                <Text style={styles.sectionTitle}>Boutiques</Text>
              </View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionCount}>{stores.length}</Text>
              </View>
            </View>
            
            <FlatList
              data={stores}
              renderItem={renderStoreItem}
              keyExtractor={(item) => `store-${item.id}`}
              scrollEnabled={false}
              contentContainerStyle={styles.storesList}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={3}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          </View>
        )}
      </Animated.ScrollView>
    );
  };

  const renderInitialState = () => (
    <Animated.ScrollView
      style={styles.initialContainer}
      contentContainerStyle={styles.initialContent}
      showsVerticalScrollIndicator={false}
      entering={FadeIn.duration(ANIMATION_DURATION)}
    >
      {/* Catégories populaires */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="apps-outline" size={22} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Catégories populaires</Text>
          </View>
        </View>
        
        <FlatList
          data={POPULAR_CATEGORIES}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Suggestions */}
      {SUGGESTIONS.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="flash-outline" size={22} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Suggestions</Text>
            </View>
          </View>
          
          <View style={styles.suggestionsGrid}>
            {SUGGESTIONS.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => handleSuggestionPress(suggestion)}
                activeOpacity={0.7}
              >
                <Ionicons name="search-outline" size={16} color={COLORS.accent} />
                <Text style={styles.suggestionChipText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Recherches récentes */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="time-outline" size={22} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Récent</Text>
            </View>
            <TouchableOpacity onPress={clearRecent} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.clearButton}>Tout effacer</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={recentSearches}
            renderItem={renderRecentSearch}
            keyExtractor={(item, index) => `recent-${index}`}
            scrollEnabled={false}
          />
        </View>
      )}
    </Animated.ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {renderHeader()}
      
      {hasSearched ? renderResults() : renderInitialState()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    ...SHADOWS.medium,
  },
  headerBlur: {
    overflow: 'hidden',
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  headerContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  searchBar: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.xl,
    ...SHADOWS.small,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
  resultsContainer: {
    flex: 1,
    paddingTop: 100, // Espace pour le header fixe
  },
  resultsContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  initialContainer: {
    flex: 1,
    paddingTop: 100, // Espace pour le header fixe
  },
  initialContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionBadge: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.round,
  },
  sectionCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  categoriesList: {
    gap: SPACING.md,
    paddingRight: SPACING.xl,
  },
  categoryItem: {
    width: 100,
    marginRight: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  categoryItemActive: {
    transform: [{ scale: 1.05 }],
  },
  categoryGradient: {
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  categoryIconContainerActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  categoryName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryNameActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.round,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  suggestionChipText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  recentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  recentText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  clearButton: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  productsGrid: {
    gap: SPACING.sm,
  },
  productItemContainer: {
    marginBottom: SPACING.md,
  },
  storesList: {
    gap: SPACING.md,
  },
  viewMoreButton: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  viewMoreGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  viewMoreText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.white,
    fontWeight: '600',
  },
  viewMoreIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  emptyStateImage: {
    width: 200,
    height: 200,
  },
});
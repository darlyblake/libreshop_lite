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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeOut, Layout, SlideInRight, SlideInLeft, useAnimatedStyle, useSharedValue, interpolate, Extrapolate } from 'react-native-reanimated';
import { SortTabs } from '../components/SortTabs';
import { SearchBar } from '../components/SearchBar';
import { ProductCard, StoreCard, EmptyState, LoadingSpinner } from '../components';
import { categoryService } from '../services/categoryService';
import { grocService } from '../services/grocService';
import { productService } from '../services/productService';
import { errorHandler } from '../utils/errorHandler';
import { useLegacyPalette } from '../hooks/useLegacyPalette';
import { useTheme } from '../hooks/useTheme';
import { useSearchStore } from '../store/searchStore';
import { SHADOWS } from '../config/theme';
import { locationService } from '../services/locationService';

const { width, height } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 1200;
const PAGE_SIZE = 20;

// Nearby radius options
const NEARBY_RADIUS_OPTIONS = [
  { id: 5, label: '5 km' },
  { id: 10, label: '10 km' },
  { id: 20, label: '20 km' },
];

// Types
type Product = {
  id: string;
  name: string;
  price: number;
  images?: string[];
  stores?: { name: string };
  created_at?: string;
  total_sales?: number;
  view_count?: number;
};

type Store = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  logo_url?: string;
  product_count?: number;
};

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

// Helper to get icon based on category name
const getCategoryIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('smart')) return 'phone-portrait-outline';
  if (lowerName.includes('ordinateur') || lowerName.includes('computer') || lowerName.includes('laptop')) return 'laptop-outline';
  if (lowerName.includes('audio') || lowerName.includes('écouteur') || lowerName.includes('casque')) return 'headset-outline';
  if (lowerName.includes('tablet')) return 'tablet-portrait-outline';
  if (lowerName.includes('accessoire')) return 'watch-outline';
  if (lowerName.includes('caméra') || lowerName.includes('photo') || lowerName.includes('image')) return 'camera-outline';
  if (lowerName.includes('jeux') || lowerName.includes('game')) return 'game-controller-outline';
  if (lowerName.includes('mode') || lowerName.includes('vêtement')) return 'shirt-outline';
  if (lowerName.includes('maison') || lowerName.includes('home')) return 'home-outline';
  if (lowerName.includes('électro')) return 'flash-outline';
  if (lowerName.includes('beauté') || lowerName.includes('soin')) return 'sparkles-outline';
  return 'apps-outline';
};

// Helper to get color based on index
const getCategoryColor = (index: number): string => {
  const colors = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#F43F5E'];
  return colors[index % colors.length];
};

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
    if (width < 1500) return 5;
    return 6;
  }, [dimensions]);
};

// Styles for search sort tabs will be appended to styles object below.

type NavigationProp = any;

// Global flag to avoid repeated 504/timeouts if the dev API server is not running
let isHybridApiAvailable = true;

const useSearch = (sort: 'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top' = 'popular') => {
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popularSuggestions, setPopularSuggestions] = useState<string[]>([]);
  const [popularCategories, setPopularCategories] = useState<Category[]>([]);
  const [intentKeywords, setIntentKeywords] = useState<string[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [popularProducts, categoriesData] = await Promise.all([
          productService.getAll(0, 8, sort as any),
          categoryService.getByParent(null)
        ]);

        if (popularProducts) {
          const names = Array.from(new Set(popularProducts.map(p => p.name))).slice(0, 6);
          setPopularSuggestions(names);
        }

        if (categoriesData) {
          const formattedCategories = categoriesData.map((cat, index) => ({
            id: cat.id,
            name: cat.name,
            icon: getCategoryIcon(cat.name),
            color: getCategoryColor(index)
          }));
          setPopularCategories(formattedCategories);
        }
      } catch (err) {
        console.warn('Failed to fetch trending data:', err);
      }
    };
    fetchData();
  }, [sort]);

  const performSearch = useCallback(async (query: string, reset = true) => {
    const q = query.trim();
    if (!q || q.length < MIN_QUERY_LENGTH) {
      setProducts([]);
      setStores([]);
      setHasSearched(false);
      setError(null);
      setSuggestions([]);
      setIntentKeywords([]);
      return;
    }

    if (reset) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      setLoading(true);
      setPage(0);
      setHasMore(true);
      setCurrentQuery(q);
    } else {
      setLoadingMore(true);
    }
    
    setHasSearched(true);
    setError(null);

    const currentPage = reset ? 0 : page;

    try {
      const filteredSuggestions = popularSuggestions.filter(s => 
        s.toLowerCase().includes(q.toLowerCase())
      );
      setSuggestions(filteredSuggestions);

      // Try server-side hybrid search first (fast when deployed). Fallback to grocService.
      if (isHybridApiAvailable) {
        try {
          const apiTimeout = 2000; // Shorter timeout for local dev
          const apiController = new AbortController();
          const apiTimeoutId = setTimeout(() => apiController.abort(), apiTimeout);
          
          const apiRes = await fetch(`/api/search?q=${encodeURIComponent(q)}&perPage=${PAGE_SIZE}`, {
            signal: apiController.signal
          });
          clearTimeout(apiTimeoutId);
          
          if (apiRes.ok) {
            const ct = (apiRes.headers.get('content-type') || '').toLowerCase();
            if (!ct.includes('application/json')) {
              throw new Error('non-json');
            }
            const json = await apiRes.json();
            const productsData = json.data || [];
            setIntentKeywords((json.intentKeywords || []).filter((t: string) => t.toLowerCase() !== q.toLowerCase()));
            if (reset) {
              setProducts(productsData || []);
              setStores([]);
            } else {
              setProducts(prev => [...prev, ...(productsData || [])]);
            }
            setHasMore((productsData?.length || 0) === PAGE_SIZE);
            setLoading(false);
            setLoadingMore(false);
            return;
          } else {
            // If we get a 504 or 404, the API server is likely not running locally.
            // Disable further attempts to avoid console pollution.
            if (apiRes.status === 504 || apiRes.status === 404 || apiRes.status === 502) {
              isHybridApiAvailable = false;
              console.log('Hybrid API search unavailable (504/404), falling back to client-side grocService for this session.');
            }
            throw new Error('api-not-ok');
          }
        } catch (e) {
          // ignore and fallback to grocService
        }
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });

      const searchPromise = Promise.all([
        grocService.searchProducts(q, currentPage, PAGE_SIZE),
        reset ? grocService.searchStores(q) : Promise.resolve([])
      ]);

      const [productsResult, storesData] = await Promise.race([
        searchPromise,
        timeoutPromise
      ]) as [any, Store[]];

      const productsData = productsResult?.products || [];
      const intentTerms = productsResult?.keywords || [];
      setIntentKeywords(intentTerms.filter((term: string) => term.toLowerCase() !== q.toLowerCase()));

      // If 'ranked' sort is requested, compute score and sort client-side
      const computeScored = (arr: any[]) => {
        const now = Date.now();
        return (arr || []).map(p => {
          const total_sales = Number(p.total_sales || 0);
          const view_count = Number(p.view_count || 0);
          const ageDays = Math.max(0, (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
          const freshness = Math.max(0, (30 - ageDays) / 30);
          const score = total_sales * 0.5 + view_count * 0.3 + freshness * 100 * 0.2;
          return { ...p, __score: score };
        }).sort((a:any,b:any) => b.__score - a.__score);
      };

      if (reset) {
        if (sort === 'ranked') {
          const scored = computeScored(productsData || []);
          setProducts(scored.map(s => { const copy = { ...s }; delete copy.__score; return copy; }));
        } else {
          setProducts(productsData || []);
        }
        setStores(storesData || []);
      } else {
        if (sort === 'ranked') {
          const combined = [...products, ...(productsData || [])];
          const scored = computeScored(combined);
          setProducts(scored.map(s => { const copy = { ...s }; delete copy.__score; return copy; }));
        } else {
          setProducts(prev => [...prev, ...(productsData || [])]);
        }
      }
      setHasMore((productsData?.length || 0) === PAGE_SIZE);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      const appError = errorHandler.handleNetworkError(error, 'ProductSearch');
      setError(appError.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page, popularSuggestions, products, sort]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore && currentQuery) {
      setPage(prev => prev + 1);
    }
  }, [loading, loadingMore, hasMore, currentQuery]);

  useEffect(() => {
    if (page > 0 && currentQuery) {
      performSearch(currentQuery, false);
    }
  }, [page]);

  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query, true);
    }, SEARCH_DEBOUNCE_DELAY);
  }, [performSearch]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return {
    products,
    stores,
    loading,
    loadingMore,
    hasMore,
    hasSearched,
    error,
    suggestions,
    popularSuggestions,
    popularCategories,
    intentKeywords,
    debouncedSearch,
    loadMore
  };
};

export const ClientSearchScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const numColumns = useResponsiveGrid();
  const scrollY = useSharedValue(0);

  const palette = useLegacyPalette();
  const { spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE } = useTheme();
  const styles = useMemo(
    () => createClientSearchStyles(palette, SPACING, RADIUS, FONT_SIZE, SHADOWS),
    [palette, SPACING, RADIUS, FONT_SIZE, SHADOWS]
  );
  
  const { recentSearches, addRecentSearch, clearRecent } = useSearchStore();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top'>('popular');

  // Nearby filter state
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(10);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);

  const { 
    products, 
    stores, 
    loading, 
    loadingMore,
    hasMore,
    hasSearched, 
    error, 
    suggestions, 
    popularSuggestions,
    popularCategories,
    intentKeywords,
    debouncedSearch,
    loadMore 
  } = useSearch(sort);

  const route = useRoute<any>();
  const recognitionRef = useRef<any>(null);

  // Update nearbyStores when stores change and filter is enabled
  useEffect(() => {
    if (nearbyEnabled && userLocation) {
      const storesWithDistance = stores
        .filter(store => store.latitude && store.longitude)
        .map(store => ({
          ...store,
          distance: locationService.calculateDistance(
            userLocation.latitude, 
            userLocation.longitude, 
            store.latitude, 
            store.longitude
          )
        }))
        .filter(store => store.distance <= nearbyRadius)
        .sort((a, b) => (a as any).distance - (b as any).distance);
      
      setNearbyStores(storesWithDistance);
    }
  }, [stores, nearbyEnabled, userLocation, nearbyRadius]);

  const startVoiceInSearch = useCallback((lang = 'fr-FR') => {
    if (Platform.OS !== 'web') return;
    const w: any = window as any;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) return;
    try {
      const r = new Rec();
      recognitionRef.current = r;
      r.interimResults = true;
      r.lang = lang;
      r.onresult = (ev: any) => {
        const transcript = Array.from(ev.results).map((res: any) => res[0].transcript).join('');
        setSearchQuery(transcript);
        debouncedSearch(transcript);
      };
      r.onend = () => {
        recognitionRef.current = null;
      };
      r.onerror = () => {
        recognitionRef.current = null;
      };
      r.start();
    } catch (err) {
      // ignore
    }
  }, [debouncedSearch]);

  useEffect(() => {
    // If navigated with startVoice param, begin voice recognition here
    try {
      if (route?.params?.startVoice) {
        const initial = String(route.params.query || '') || '';
        if (initial) {
          setSearchQuery(initial);
          debouncedSearch(initial);
        }
        startVoiceInSearch();
      } else if (route?.params?.query) {
        setSearchQuery(String(route.params.query || ''));
        debouncedSearch(String(route.params.query || ''));
      }
    } catch (e) {}
  }, [route?.params, debouncedSearch, startVoiceInSearch]);

  useEffect(() => {
    return () => {
      const r = recognitionRef.current;
      if (r && typeof r.stop === 'function') {
        try { r.stop(); } catch (e) {}
      }
      recognitionRef.current = null;
    };
  }, []);

  // Valeurs mémoïsées
  const productItemWidth = useMemo(() => {
    const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
    return (contentWidth - SPACING.xl * 2 - SPACING.sm * (numColumns - 1)) / numColumns;
  }, [numColumns, SPACING]);

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
      addRecentSearch(searchQuery.trim());
    }
  }, [searchQuery, addRecentSearch]);

  const handleCategoryPress = useCallback((category: Category) => {
    setSelectedCategory(category.name);
    setSearchQuery(category.name);
    debouncedSearch(category.name);
    setIsFocused(false);
  }, [debouncedSearch]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    setSearchQuery(suggestion);
    addRecentSearch(suggestion);
    debouncedSearch(suggestion);
    Keyboard.dismiss();
  }, [addRecentSearch, debouncedSearch]);

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

  // Handle nearby filter toggle
  const handleToggleNearby = useCallback(async () => {
    if (!nearbyEnabled) {
      // Enable nearby filter
      setLoadingNearby(true);
      try {
        const location = await locationService.getCurrentPosition();
        setUserLocation(location);
        
        // Filter existing stores by distance
        const storesWithDistance = stores
          .filter(store => store.latitude && store.longitude)
          .map(store => ({
            ...store,
            distance: locationService.calculateDistance(
              location.latitude, 
              location.longitude, 
              store.latitude, 
              store.longitude
            )
          }))
          .filter(store => store.distance <= nearbyRadius)
          .sort((a, b) => (a as any).distance - (b as any).distance);
        
        setNearbyStores(storesWithDistance);
        setNearbyEnabled(true);
      } catch (error) {
        console.error('Error getting nearby stores:', error);
        Alert.alert('Erreur', 'Impossible d\'accéder à votre position');
      } finally {
        setLoadingNearby(false);
      }
    } else {
      // Disable nearby filter
      setNearbyEnabled(false);
      setNearbyStores([]);
      setUserLocation(null);
    }
  }, [nearbyEnabled, nearbyRadius, stores]);

  // Handle radius change
  const handleRadiusChange = useCallback(async (radius: number) => {
    setNearbyRadius(radius);
    if (nearbyEnabled && userLocation) {
      setLoadingNearby(true);
      try {
        // Filter existing stores by distance with new radius
        const storesWithDistance = stores
          .filter(store => store.latitude && store.longitude)
          .map(store => ({
            ...store,
            distance: locationService.calculateDistance(
              userLocation.latitude, 
              userLocation.longitude, 
              store.latitude, 
              store.longitude
            )
          }))
          .filter(store => store.distance <= radius)
          .sort((a, b) => (a as any).distance - (b as any).distance);
        
        setNearbyStores(storesWithDistance);
      } catch (error) {
        console.error('Error updating nearby stores:', error);
      } finally {
        setLoadingNearby(false);
      }
    }
  }, [nearbyEnabled, userLocation, stores]);

  // Renderers
  const renderProductItem = useCallback(({ item, index }: { item: Product & { comparePrice?: number }; index: number }) => (
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
        comparePrice={item.comparePrice}
        imageUrl={item.images?.[0]}
        onPress={() => handleProductPress(item)}
      />
      <View style={styles.storeNameBadge}>
        <Text style={styles.storeNameText} numberOfLines={1}>
          {item.stores?.name || 'Boutique'}
        </Text>
      </View>
    </Animated.View>
  ), [productItemWidth, handleProductPress]);

  const renderStoreItem = useCallback(({ item, index }: { item: Store; index: number }) => {
    let distance: number | null = null;
    
    if (nearbyEnabled && userLocation && item.latitude && item.longitude) {
      distance = locationService.calculateDistance(userLocation.latitude, userLocation.longitude, item.latitude, item.longitude);
    }

    return (
      <Animated.View
        entering={SlideInLeft
          .delay(index * 30)
          .springify()
          .damping(14)
        }
        style={{ position: 'relative' }}
      >
        <StoreCard
          name={item.name}
          category={item.category || 'Boutique'}
          description={item.description}
          logoUrl={item.logo_url}
          productCount={item.product_count}
          onPress={() => handleStorePress(item)}
        />
        {distance !== null && (
          <View style={styles.distanceBadge}>
            <Ionicons name="location-outline" size={12} color={palette.accent} />
            <Text style={styles.distanceBadgeText}>{distance.toFixed(1)} km</Text>
          </View>
        )}
      </Animated.View>
    );
  }, [handleStorePress, nearbyEnabled, userLocation, palette.accent, styles.distanceBadge, styles.distanceBadgeText]);

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
            : [palette.card, palette.card]
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
              color={selectedCategory === item.name ? palette.text : item.color} 
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
          addRecentSearch(item);
          debouncedSearch(item);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.recentIconContainer}>
          <Ionicons name="time-outline" size={20} color={palette.accent} />
        </View>
        <Text style={styles.recentText} numberOfLines={1}>
          {item}
        </Text>
        <Ionicons name="arrow-up" size={18} color={palette.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  ), [addRecentSearch, debouncedSearch]);

  const renderSuggestionItem = useCallback(({ item, index }: { item: string; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 30)}
    >
      <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => handleSuggestionPress(item)}
        activeOpacity={0.7}
      >
        <Ionicons name="search-outline" size={18} color={palette.textMuted} />
        <Text style={styles.suggestionText}>{item}</Text>
      </TouchableOpacity>
    </Animated.View>
  ), [handleSuggestionPress]);

  const renderSuggestionsDropdown = () => {
    if (!isFocused || searchQuery.length < MIN_QUERY_LENGTH || suggestions.length === 0) {
      return null;
    }

    return (
      <Animated.View 
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={[styles.suggestionsDropdown, { top: 85 + insets.top }]}
      >
        <BlurView intensity={95} tint="light" style={styles.suggestionsBlur}>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestionItem}
            keyExtractor={(item) => `suggestion-${item}`}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.suggestionsList}
          />
        </BlurView>
      </Animated.View>
    );
  };

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

    const renderIntentSuggestions = () => {
      if (intentKeywords.length === 0) return null;
      return (
        <View style={styles.intentSuggestionContainer}>
          <Text style={styles.intentSuggestionTitle}>Suggestions basées sur votre recherche</Text>
          <View style={styles.intentSuggestionChips}>
            {intentKeywords.map((keyword) => (
              <TouchableOpacity
                key={`intent-${keyword}`}
                style={styles.intentSuggestionChip}
                onPress={() => {
                  setSearchQuery(keyword);
                  addRecentSearch(keyword);
                  debouncedSearch(keyword);
                  Keyboard.dismiss();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.intentSuggestionText}>{keyword}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    };

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
        {intentKeywords.length > 0 && renderIntentSuggestions()}
        {products.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="cube-outline" size={22} color={palette.accent} />
                <Text style={styles.sectionTitle}>Produits</Text>
              </View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionCount}>{products.length}</Text>
              </View>
            </View>
            {/* Sort tabs for search results */}
            <SortTabs
              options={[
                { id: 'popular', label: 'Populaires' },
                { id: 'ranked', label: 'Tendance' },
                { id: 'newest', label: 'Nouveaux' },
                { id: 'sales', label: 'Top ventes' },
              ]}
              selected={sort}
              onSelect={(id) => { setSort(id as any); debouncedSearch(searchQuery); }}
            />
            
            <FlatList
              data={products}
              renderItem={renderProductItem}
              keyExtractor={(item) => `product-${item.id}`}
              numColumns={numColumns}
              key={numColumns}
              scrollEnabled={false}
              columnWrapperStyle={styles.productsGrid}
              initialNumToRender={PAGE_SIZE}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
            />
            
            {loadingMore && (
              <View style={styles.loadMoreItem}>
                <LoadingSpinner size="small" />
              </View>
            )}
          </View>
        )}

        {stores.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="storefront-outline" size={22} color={palette.accent} />
                <Text style={styles.sectionTitle}>Boutiques</Text>
              </View>
              <View style={styles.sectionHeaderActions}>
                <TouchableOpacity 
                  style={[styles.nearbyButton, nearbyEnabled && styles.nearbyButtonActive]}
                  onPress={handleToggleNearby}
                  disabled={loadingNearby}
                >
                  <Ionicons 
                    name="navigate" 
                    size={16} 
                    color={nearbyEnabled ? 'white' : palette.text} 
                  />
                  <Text style={[styles.nearbyButtonText, nearbyEnabled && styles.nearbyButtonTextActive]}>
                    {loadingNearby ? '...' : nearbyEnabled ? 'Près de moi' : 'Près de chez moi'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionCount}>{nearbyEnabled ? nearbyStores.length : stores.length}</Text>
                </View>
              </View>
            </View>
            {nearbyEnabled && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.radiusSelector}
              >
                {NEARBY_RADIUS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.radiusChip, nearbyRadius === option.id && styles.radiusChipActive]}
                    onPress={() => handleRadiusChange(option.id)}
                  >
                    <Text style={[styles.radiusChipText, nearbyRadius === option.id && styles.radiusChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            <FlatList
              data={nearbyEnabled ? nearbyStores : stores}
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
            <Ionicons name="apps-outline" size={22} color={palette.accent} />
            <Text style={styles.sectionTitle}>Catégories populaires</Text>
          </View>
        </View>
        
        <FlatList
          data={popularCategories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Suggestions */}
      {popularSuggestions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="flash-outline" size={22} color={palette.accent} />
              <Text style={styles.sectionTitle}>Suggestions du moment</Text>
            </View>
          </View>
          
          <View style={styles.suggestionsGrid}>
            {popularSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => handleSuggestionPress(suggestion)}
                activeOpacity={0.7}
              >
                <Ionicons name="search-outline" size={16} color={palette.accent} />
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
              <Ionicons name="time-outline" size={22} color={palette.accent} />
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
    <View style={styles.flexContainer}>
      <View style={styles.maxWidthContainer}>
        <View style={[styles.container, { backgroundColor: palette.bg }]}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
          
          {renderHeader()}
          
          {hasSearched ? renderResults() : renderInitialState()}

          {renderSuggestionsDropdown()}
        </View>
      </View>
    </View>
  );
};

function createClientSearchStyles(palette: LegacyPalette, SPACING: any, RADIUS: any, FONT_SIZE: any, shadows: typeof SHADOWS) {
  return StyleSheet.create({
  flexContainer: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  maxWidthContainer: {
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    ...shadows.medium,
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
    ...shadows.small,
  },
  loadMoreItem: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  storeNameBadge: {
    marginTop: 4,
    paddingHorizontal: 4,
  },
  storeNameText: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: palette.textMuted,
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
    color: palette.text,
  },
  sectionBadge: {
    backgroundColor: palette.accent + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.round,
  },
  sectionCount: {
    fontSize: FONT_SIZE.sm,
    color: palette.accent,
    fontWeight: '600',
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  nearbyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  nearbyButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  nearbyButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    color: palette.textSoft,
  },
  nearbyButtonTextActive: {
    color: 'white',
  },
  radiusSelector: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  radiusChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  radiusChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  radiusChipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    color: palette.textSoft,
  },
  radiusChipTextActive: {
    color: 'white',
  },
  distanceBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: palette.card,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: palette.accent,
  },
  distanceBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: palette.accent,
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
    ...shadows.small,
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
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  categoryIconContainerActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  categoryName: {
    fontSize: FONT_SIZE.sm,
    color: palette.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryNameActive: {
    color: palette.text,
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
    backgroundColor: palette.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.round,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadows.small,
  },
  suggestionChipText: {
    fontSize: FONT_SIZE.md,
    color: palette.text,
    fontWeight: '500',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadows.small,
  },
  recentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.accent + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  recentText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: palette.text,
    fontWeight: '500',
  },
  clearButton: {
    fontSize: FONT_SIZE.sm,
    color: palette.accent,
    fontWeight: '600',
  },
  productsGrid: {
    justifyContent: 'flex-start',
    gap: SPACING.md,
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
    ...shadows.medium,
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
    color: palette.text,
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
  /* search sort tabs now use shared component SortTabs */
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  suggestionText: {
    fontSize: FONT_SIZE.md,
    color: palette.text,
  },
  emptyStateImage: {
    width: 200,
    height: 200,
  },
  suggestionsDropdown: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 1000,
    maxHeight: 300,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...shadows.large,
    borderWidth: 1,
    borderColor: palette.border,
  },
  suggestionsBlur: {
    flex: 1,
  },
  suggestionsList: {
    paddingVertical: SPACING.sm,
  },
  intentSuggestionContainer: {
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadows.small,
  },
  intentSuggestionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: palette.text,
    marginBottom: SPACING.sm,
  },
  intentSuggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  intentSuggestionChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: palette.accent + '15',
    borderRadius: RADIUS.round,
  },
  intentSuggestionText: {
    color: palette.accent,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
});
}
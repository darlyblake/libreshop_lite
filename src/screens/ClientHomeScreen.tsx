// Clean sync comment to force IDE refresh
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  Platform,
} from 'react-native';
import OptimizedImage from '../components/OptimizedImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyPalette, type LegacyPalette } from '../hooks/useLegacyPalette';
import { useTheme } from '../hooks/useTheme';
import { useThemeRefresh } from '../hooks/useThemeRefresh';
import { navigateToClientTab } from '../navigation/clientNavigation';
import { errorHandler } from '../utils/errorHandler';
import { ProductCard, StoreCardSkeleton, ProductCardSkeleton, CategoryShowcase, SearchBar } from '../components';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { PWAUpdateBanner } from '../components/PWAUpdateBanner';
import { SortTabs } from '../components/SortTabs';
import { useResponsive } from '../utils/responsive';
import { useClientHomeState } from '../hooks/useClientHomeState';
import { Store, Product, HomeBanner, Collection } from '../lib/supabase';
import { storeService } from '../services/storeService';
import { storeStatsService } from '../services/storeStatsService';
import { productService } from '../services/productService';
import { homeBannerService } from '../services/homeBannerService';
import { collectionService } from '../services/collectionService';
import { useCartStore, useAuthStore } from '../store';
import { categoryService } from '../services/categoryService';
import { cloudinaryService } from '../services/cloudinaryService';
import { cacheService } from '../services/cacheService';
import { recommendationService, RecommendedProduct } from '../services/recommendationService';
import { CACHE_TTL } from '../config/cacheConfig';
import { cacheMonitor } from '../utils/cacheMonitor';

// Cache Keys
const CACHE_KEYS = {
  CAROUSEL: 'HOME_CAROUSEL_BANNERS',
  PROMO: 'HOME_PROMO_BANNERS',
  STORES: 'HOME_FEATURED_STORES',
  PRODUCTS: 'HOME_FEATURED_PRODUCTS',
  CATEGORIES: 'HOME_POPULAR_CATEGORIES',
  COLLECTIONS: 'HOME_COLLECTIONS',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 1200;

// Sort options configuration
const SORT_OPTIONS = [
  { id: 'popular', label: 'Populaires' },
  { id: 'ranked', label: 'Tendance' },
  { id: 'newest', label: 'Nouveaux' },
  { id: 'sales', label: 'Top ventes' },
];

const normalizeHexColor = (value?: string | null) => {
  if (!value) return undefined;
  const v = String(value).trim();
  if (!v) return undefined;
  return v.startsWith('#') ? v : `#${v}`;
};

const mergeStoreStats = (store: Store, stats: any) => {
  if (!stats) return store;
  return {
    ...store,
    store_stats: [stats],
    rating_avg: stats.rating_avg,
    rating_count: stats.rating_count,
  };
};

export const ClientHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  /* sort tabs now use shared component SortTabs */
  const insets = useSafeAreaInsets();
  const { width, isMobile, isTablet, isDesktop, isLargeDesktop } = useResponsive();
  const { items } = useCartStore();
  const palette = useLegacyPalette();
  const { spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE, isDark, getColor } = useTheme();
  useThemeRefresh(); // Force le re-rendu au changement de thème
  const styles = useMemo(
    () => createClientHomeStyles(palette, SPACING, RADIUS, FONT_SIZE),
    [palette, SPACING, RADIUS, FONT_SIZE, isDark] // Ajoute isDark pour forcer le re-rendu au changement de thème
  );
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const logoAnim = useRef(new Animated.Value(1)).current;

  // Initialize state with reducer
  const { state, dispatch } = useClientHomeState();

  const user = useAuthStore((s) => s.user);
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Stabilized recommendations loading - only changes when user changes
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const loadRecommendations = useCallback(async () => {
    try {
      setLoadingRecommendations(true);
      const data = await recommendationService.getRecommendations(userIdRef.current || null);
      setRecommendations(data || []);
    } catch (e) {
      console.warn("[ClientHome] Failed to load recommendations:", e);
    } finally {
      setLoadingRecommendations(false);
    }
  }, []);

  // Load recommendations when user changes
  useEffect(() => {
    loadRecommendations();
  }, [user?.id, loadRecommendations]);

  // Destructure state for easier reading
  const {
    stores,
    products,
    collections,
    loading,
    loadingStores,
    loadingProducts,
    error,
    refreshing,
    carouselBanners,
    promoBanners,
    categoriesList,
    productCursor,
    hasMoreProducts,
    loadingMoreProducts,
    selectedCategory,
    productSort,
    isPaused,
    newsletterEmail,
    newsletterLoading,
    newsletterSuccess,
    currentBannerIndex,
    selectedCollection,
  } = state;

  // Animation pulse pour le bouton "Ouvrir ma boutique"
  useEffect(() => {
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    };
    startPulse();
  }, []);

  // Logo subtle pulsing animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoAnim, { toValue: 1.03, duration: 1400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(logoAnim, { toValue: 1, duration: 1400, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, [logoAnim]);

  // Start cache monitoring for performance metrics
  useEffect(() => {
    // Avoid running cache monitor on web to reduce background work in the browser
    if (Platform.OS === 'web') return;
    const stopMonitoring = cacheMonitor.start(60000, true); // start silently
    return () => {
      stopMonitoring();
    };
  }, []);

  // Grille adaptative en fonction de la taille de l'écran pour un rendu premium sur mobile et PC
  const numProductColumns = useMemo(() => {
    if (width >= 1024) return 5; // PC / Large screens
    if (width >= 768) return 4;  // Tablets
    return 2;                    // Mobile
  }, [width]);

  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);

  const responsiveProductCardWidth = useMemo(() => {
    const totalHorizontalPadding = SPACING.xl * 2; // paddingHorizontal des deux côtés
    const totalGap = SPACING.md * (numProductColumns - 1); // gap entre colonnes
    return (contentWidth - totalHorizontalPadding - totalGap) / numProductColumns;
  }, [contentWidth, numProductColumns, SPACING]);

  // Auto-play carousel logic - using ref to avoid dependency on currentBannerIndex
  const currentBannerIndexRef = useRef(currentBannerIndex);
  
  useEffect(() => {
    currentBannerIndexRef.current = currentBannerIndex;
  }, [currentBannerIndex]);

  useEffect(() => {
    if (carouselBanners.length <= 1 || isPaused) return;

    // We want: 1,2,3,... then back: 3,2,1, and loop.
    let direction: 1 | -1 = 1;

    const interval = setInterval(() => {
      const current = currentBannerIndexRef.current;
      const max = carouselBanners.length - 1;

      let next = current + direction;

      if (next > max) {
        direction = -1;
        next = max - 1 >= 0 ? max - 1 : 0;
      } else if (next < 0) {
        direction = 1;
        next = 1 <= max ? 1 : 0;
      }

      // IMPORTANT: do not dispatch here. Let onMomentumScrollEnd update the index.
      // This prevents UI desync (dots change but list doesn't move on web).
      try {
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        currentBannerIndexRef.current = next;
      } catch (err) {
        // Silent fail - index out of bounds on initial render
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [carouselBanners.length, isPaused]);



  // Cache loading logic - only on mount
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const [cachedCarousel, cachedPromo, cachedStores, cachedProducts, cachedCats, cachedColls] = await Promise.all([
          cacheService.get<HomeBanner[]>(CACHE_KEYS.CAROUSEL),
          cacheService.get<HomeBanner[]>(CACHE_KEYS.PROMO),
          cacheService.get<Store[]>(CACHE_KEYS.STORES),
          cacheService.get<Product[]>(CACHE_KEYS.PRODUCTS),
          cacheService.get<string[]>(CACHE_KEYS.CATEGORIES),
          cacheService.get<Collection[]>(CACHE_KEYS.COLLECTIONS),
        ]);

        if (cachedCarousel || cachedPromo) {
          dispatch({
            type: 'SET_BANNERS',
            payload: {
              carousel: cachedCarousel || [],
              promo: cachedPromo || [],
            },
          });
        }
        if (cachedStores) dispatch({ type: 'SET_STORES', payload: cachedStores });
        if (cachedProducts) dispatch({ type: 'SET_PRODUCTS', payload: cachedProducts });
        if (cachedCats) dispatch({ type: 'SET_CATEGORIES', payload: cachedCats });
        if (cachedColls) dispatch({ type: 'SET_COLLECTIONS', payload: cachedColls });

        if (cachedProducts || cachedStores) {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (e) {
        console.warn('[ClientHome] Failed to load cached data:', e);
      }
    };
    loadCachedData();
  }, []);

  // Load banners independently - only once on mount, never refresh
  useEffect(() => {
    const loadBanners = async () => {
      try {
        const [carousel, promo] = await Promise.all([
          homeBannerService.getActiveByPlacement('carousel').catch(() => []),
          homeBannerService.getActiveByPlacement('promo').catch(() => []),
        ]);

        if (carousel?.length) {
          // Prefetch carousel images to avoid reloads during scroll
          try {
            const urls = (carousel || []).map((b: any) => cloudinaryService.getOptimizedUrl(b.image_url, 800)).filter(Boolean);
            try {
              await (OptimizedImage as any).preload(urls);
            } catch (e) {
              // ignore prefetch errors
            }
          } catch (e) {
            // ignore prefetch errors
          }

          dispatch({
            type: 'SET_BANNERS',
            payload: {
              carousel,
              promo: promo || [],
            },
          });
          cacheService.set(CACHE_KEYS.CAROUSEL, carousel, CACHE_TTL.CAROUSEL.duration, CACHE_TTL.CAROUSEL.stale);
        }
        if (promo?.length) {
          cacheService.set(CACHE_KEYS.PROMO, promo, CACHE_TTL.PROMO.duration, CACHE_TTL.PROMO.stale);
        }
      } catch (e) {
        console.warn('[ClientHome] Failed to load banners:', e);
      }
    };
    loadBanners();
  }, []); // Only run once on mount

  // Load data from Supabase with high resilience
  const loadData = useCallback(
    async (refresh = false) => {
      try {
        if (!refresh) dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        loadRecommendations();

        // Parallel data loading with individual error handling
        const [storesResult, productsResult] = await Promise.allSettled([
          // Load stores based on selected category
          (async () => {
            let data;
            if (selectedCategory) {
              data = await categoryService.getStoresByCategory(selectedCategory, 5);
            } else {
              data = await storeService.getFeatured();
            }
            if (data && data.length > 0) {
              const storeIds = data.map((store) => store.id).filter(Boolean);
              let stats: any[] = [];
              try {
                stats = await storeStatsService.getByStores(storeIds);
              } catch (err) {
                console.warn('[ClientHome] Error loading store stats:', err);
              }
              const statsById = (stats || []).reduce((acc, stat) => {
                acc[stat.store_id] = stat;
                return acc;
              }, {} as Record<string, any>);

              const enrichedStores = (data || []).map((store) => mergeStoreStats(store, statsById[store.id]));
              dispatch({ type: 'SET_STORES', payload: enrichedStores });
              cacheService.set(CACHE_KEYS.STORES, enrichedStores, CACHE_TTL.STORES.duration, CACHE_TTL.STORES.stale);
            }
            return data;
          })(),
          productService.getAllWithCursor(null, 8, productSort as any).then(result => {
            if (result.data && result.data.length > 0) {
              dispatch({
                type: 'SET_PRODUCTS_WITH_CURSOR',
                payload: {
                  data: result.data,
                  cursor: result.nextCursor,
                  hasMore: result.hasMore,
                },
              });
              cacheService.set(CACHE_KEYS.PRODUCTS, result.data, CACHE_TTL.PRODUCTS.duration, CACHE_TTL.PRODUCTS.stale);
            }
            return result;
          }),
        ]);

        // Load categories separately (not dependent on anything, load once)
        try {
          const cats = await categoryService.getPopularCategories(6).catch(() => []);
          if (cats?.length) {
            const catNames = ['Toutes', ...cats.map(c => c.name)];
            dispatch({ type: 'SET_CATEGORIES', payload: catNames });
            cacheService.set(CACHE_KEYS.CATEGORIES, catNames, CACHE_TTL.CATEGORIES.duration, CACHE_TTL.CATEGORIES.stale);
          }
        } catch (e) {
          console.warn('[ClientHome] Error loading categories:', e);
        }

        // Check for critical failures
        if (productsResult.status === 'rejected' && products.length === 0) {
          dispatch({ type: 'SET_ERROR', payload: 'Impossible de charger les produits' });
        }
      } catch (e) {
        errorHandler.handleDatabaseError(e, 'ClientHomeScreen loadData error');
        if (products.length === 0 && stores.length === 0) {
          dispatch({ type: 'SET_ERROR', payload: 'Une erreur est survenue lors du chargement' });
        }
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'SET_REFRESHING', payload: false });
      }
    },
    [dispatch, productSort, selectedCategory, loadRecommendations]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLoadMoreProducts = useCallback(async () => {
    if (loadingMoreProducts || !hasMoreProducts) return;

    try {
      dispatch({ type: 'SET_LOADING_PRODUCTS', payload: true });
      const result = await productService.getAllWithCursor(
        productCursor,
        8,
        productSort as any
      );

      if (result.data && result.data.length > 0) {
        dispatch({
          type: 'ADD_MORE_PRODUCTS',
          payload: {
            data: result.data,
            hasMore: result.hasMore,
            cursor: result.nextCursor,
          },
        });
      } else {
        dispatch({
          type: 'ADD_MORE_PRODUCTS',
          payload: { data: [], hasMore: false, cursor: null },
        });
      }
    } catch (e) {
      console.error('Error loading more products:', e);
      dispatch({ type: 'SET_LOADING_PRODUCTS', payload: false });
    }
  }, [loadingMoreProducts, hasMoreProducts, productCursor, productSort, dispatch]);

  const handleProductSortChange = useCallback(
    async (sort: any) => {
      dispatch({ type: 'UPDATE_SORT', payload: sort });
      try {
        const data = await productService.getAll(0, 8, sort);
        dispatch({ type: 'SET_PRODUCTS', payload: data || [] });
      } catch (e) {
        console.error('Error sorting products:', e);
        dispatch({ type: 'SET_LOADING_PRODUCTS', payload: false });
      }
    },
    [dispatch]
  );

  // Quick Actions Handlers
  const handleFlashDeals = useCallback(() => {
    handleProductSortChange('sales');
  }, [handleProductSortChange]);

  const handleBonPlans = useCallback(() => {
    dispatch({ type: 'UPDATE_CATEGORY', payload: null });
  }, [dispatch]);

  const handleNouveautes = useCallback(() => {
    handleProductSortChange('newest');
  }, [handleProductSortChange]);

  const handleFavorites = useCallback(() => {
    navigateToClientTab(navigation, 'Wishlist');
  }, [navigation]);

  const handleNewsletterSubscribe = useCallback(async () => {
    if (!newsletterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newsletterEmail)) {
      Alert.alert('Email invalide', 'Veuillez entrer une adresse email valide');
      return;
    }

    dispatch({ type: 'SET_NEWSLETTER_LOADING', payload: true });
    try {
      dispatch({ type: 'SET_NEWSLETTER_SUCCESS', payload: true });
      dispatch({ type: 'SET_NEWSLETTER_EMAIL', payload: '' });
      setTimeout(() => dispatch({ type: 'SET_NEWSLETTER_SUCCESS', payload: false }), 3000);
    } catch (e) {
      console.error('Error subscribing to newsletter:', e);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'inscription');
    } finally {
      dispatch({ type: 'SET_NEWSLETTER_LOADING', payload: false });
    }
  }, [newsletterEmail, dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch({ type: 'SET_REFRESHING', payload: true });
    dispatch({ type: 'UPDATE_CATEGORY', payload: null });
    loadData(true);
  }, [loadData, dispatch]);

  const handleCategoryPress = useCallback(
    async (category: string) => {
      dispatch({ type: 'SET_LOADING_STORES', payload: true });
      dispatch({ type: 'UPDATE_CATEGORY', payload: category === 'Toutes' ? null : category });

      try {
        let data;
        if (category === 'Toutes') {
          data = await categoryService.getFeaturedStores(5);
        } else {
          data = await categoryService.getStoresByCategory(category, 5);
        }
        if (data && data.length > 0) {
          const storeIds = data.map((store) => store.id).filter(Boolean);
          let stats: any[] = [];
          try {
            stats = await storeStatsService.getByStores(storeIds);
          } catch (err) {
            console.warn('[ClientHome] Error loading store stats:', err);
          }
          const statsById = (stats || []).reduce((acc, stat) => {
            acc[stat.store_id] = stat;
            return acc;
          }, {} as Record<string, any>);

          const enrichedStores = data.map((store) => mergeStoreStats(store, statsById[store.id]));
          dispatch({ type: 'SET_STORES', payload: enrichedStores });
          cacheService.set(CACHE_KEYS.STORES, enrichedStores, CACHE_TTL.STORES.duration, CACHE_TTL.STORES.stale);
        }
      } catch (e) {
        console.error('Error filtering stores by category:', e);
        dispatch({ type: 'SET_ERROR', payload: `Erreur: Impossible de charger les boutiques` });
      } finally {
        dispatch({ type: 'SET_LOADING_STORES', payload: false });
      }
    },
    [dispatch]
  );

  const handleBannerPress = useCallback((banner: HomeBanner) => {
    const screen = banner.link_screen;
    if (!screen) return;
    navigation.navigate(screen, banner.link_params || undefined);
  }, [navigation]);

  const bannerWidth = SCREEN_WIDTH - SPACING.xl * 2;

  const renderBannerItem = useCallback(
    ({ item, index }: { item: HomeBanner; index: number }) => {
      const inputRange = [
        (index - 1) * bannerWidth,
        index * bannerWidth,
        (index + 1) * bannerWidth,
      ];

      const scale = scrollX.interpolate({
        inputRange,
        outputRange: [0.8, 1, 0.8],
        extrapolate: 'clamp',
      });

      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.6, 1, 0.6],
        extrapolate: 'clamp',
      });

      return (
        <TouchableOpacity
          key={item.id}
          activeOpacity={0.9}
          onPress={() => handleBannerPress(item)}
          style={{ width: bannerWidth }}
        >
          <Animated.View style={[styles.bannerCard, { transform: [{ scale }], opacity }]}>
            {item.image_url ? (
              <OptimizedImage
                uri={cloudinaryService.getOptimizedUrl(item.image_url, 800)}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : null}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.bannerGradient}
            />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.bannerSubtitle}>{item.subtitle}</Text> : null}
              <View style={styles.bannerButton}>
                <Text style={styles.bannerButtonText}>Découvrir</Text>
                <Ionicons name="arrow-forward" size={16} color="white" />
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>
      );
    },
    // Important: do NOT depend on `styles` to avoid remount/reload of images on web.
    [bannerWidth, scrollX, handleBannerPress, SPACING.xl, styles.bannerCard, styles.bannerImage, styles.bannerGradient, styles.bannerContent, styles.bannerTitle, styles.bannerSubtitle, styles.bannerButton, styles.bannerButtonText]
  );


  const renderCategoryChip = useCallback((category: string) => {
    const isActive = selectedCollection === category;
    return (
      <TouchableOpacity
        key={category}
        style={[styles.categoryChip, isActive && styles.categoryChipActive]}
        onPress={() => handleCategoryPress(category)}
      >
        <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
          {category}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedCollection, styles.categoryChip, styles.categoryChipActive, styles.categoryChipText, styles.categoryChipTextActive, handleCategoryPress]);

  const renderStars = useCallback((rating: number) => {
    const filledStars = Math.floor(rating);
    return (
      <View style={styles.starsRow}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Ionicons
            key={index}
            name={index < filledStars ? 'star' : 'star-outline'}
            size={13}
            color={palette.accent}
          />
        ))}
      </View>
    );
  }, [palette.accent, styles.starsRow]);

  // Calcul des dimensions responsive
  const storeCardWidth = isDesktop ? 220 : isTablet ? 200 : 180;

  const renderStoreCard = useCallback(({ item, index }: { item: Store; index: number }) => {
    const stats = Array.isArray(item.store_stats) ? item.store_stats[0] : item.store_stats;
    const ratingAvg = item.rating_avg ?? stats?.rating_avg ?? 0;
    const ratingCount = item.rating_count ?? stats?.rating_count ?? 0;
    const productsCount = item.products_count ?? stats?.products_count ?? 0;
    const logoUrl = item.logo_url;
    const bannerUrl = item.banner_url;
    const createdAt = (item as any).created_at || (item as any).inserted_at || null;
    const isNew = createdAt ? (Date.now() - new Date(createdAt).getTime()) < 1000 * 60 * 60 * 24 * 30 : false;
    const isPopular = (ratingCount || 0) > 30 || (stats?.followers_count || 0) > 100;
    return (
      <View key={item.id} style={[styles.storeCardOuter, { width: storeCardWidth }]}> 
        <TouchableOpacity
          activeOpacity={0.87}
          style={styles.storeCard}
          onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}
        >
          <View style={styles.storeMedia}>
            {bannerUrl ? (
              <Image
                source={{ uri: cloudinaryService.getOptimizedUrl(bannerUrl, 600) }}
                style={styles.storeBanner}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[palette.accent + '30', palette.accent + '08']}
                style={styles.storeBannerPlaceholder}
              />
            )}

            <View style={styles.storeLogoWrap}>
              {logoUrl ? (
                <Image
                  source={{ uri: cloudinaryService.getOptimizedUrl(logoUrl, 150) }}
                  style={styles.storeLogo}
                />
              ) : (
                <View style={styles.storeLogoPlaceholder}>
                  <Ionicons name="storefront" size={22} color={palette.accent} />
                </View>
              )}
            </View>

            {item.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={palette.success} />
              </View>
            )}

            {/* Rating badge overlay */}
            <View style={styles.bannerRatingBadge}>
              <Ionicons name="star" size={12} color="white" />
              <Text style={styles.bannerRatingText}>{ratingAvg ? ratingAvg.toFixed(1) : '0.0'}</Text>
              <Text style={styles.bannerRatingCount}>({ratingCount})</Text>
            </View>
          </View>

          <View style={styles.storeBody}>
            <View style={styles.storeTopRow}>
              <Text numberOfLines={1} style={styles.storeName}>{item.name}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={[styles.categoryPill, isPopular ? styles.popularBadge : isNew ? styles.newBadge : {}]}>
                <Text numberOfLines={1} style={[styles.categoryPillText, isPopular || isNew ? { color: 'white' } : {}]}>
                  {isPopular ? 'Populaire' : isNew ? 'Nouveau' : (item.category ?? 'Boutique')}
                </Text>
              </View>
              {stats?.followers_count ? (
                <View style={styles.followerPill}>
                  <Ionicons name="people" size={12} color={palette.textMuted} />
                  <Text style={styles.followerText}>{stats.followers_count}</Text>
                </View>
              ) : null}
            </View>

            {item.description ? (
              <Text numberOfLines={2} style={styles.storeDesc}>{item.description}</Text>
            ) : null}

            <View style={styles.statsRow}>
              <View style={styles.ratingContainer}>
                {renderStars(ratingAvg)}
                <Text style={styles.ratingText}>{ratingAvg ? ratingAvg.toFixed(1) : '0.0'}</Text>
                <Text style={styles.ratingCount}>({ratingCount})</Text>
              </View>
              {productsCount > 0 && (
                <View style={styles.productsCount}>
                  <Ionicons name="cube-outline" size={12} color={palette.textMuted} />
                  <Text style={styles.productsCountText}>{productsCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [navigation, palette.accent, palette.success, palette.textMuted, renderStars, storeCardWidth, styles]);

  const renderProductCard = useCallback(({ item }: { item: any }) => (
    <View style={[styles.productCardWrapper, { width: responsiveProductCardWidth }]}>
      <ProductCard
        name={item.name}
        price={item.price}
        comparePrice={item.compare_price}
        imageUrl={item.images?.[0]}
        onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
      />
      <Text style={styles.storeNameLabel} numberOfLines={1}>
        {item.stores?.name || 'Boutique'}
      </Text>
    </View>
  ), [responsiveProductCardWidth, styles.productCardWrapper, styles.storeNameLabel, navigation]);

  // Header Component de la FlatList (regroupe tout sauf la grille de produits principale)
  const renderHeader = useCallback(() => {
    if (loading || error) return null;

    return (
      <View style={styles.maxWidthContainer}>
        <LinearGradient
          colors={[palette.accent, palette.accentDark || palette.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoAnim }] }]}> 
              <Animated.Text style={[styles.logoText, { transform: [{ scale: pulseAnim }] }]} numberOfLines={1} adjustsFontSizeToFit>Libreshop</Animated.Text>
              <Text style={styles.logoSlogan} numberOfLines={1}>
                {user 
                  ? `Bonjour, ${user.full_name?.split(' ')[0] || 'Acheteur'} ! 👋` 
                  : 'Connectez-vous pour commander'}
              </Text>
            </Animated.View>
            <TouchableOpacity
              style={styles.openShopButton}
              onPress={async () => {
                try {
                  let currentUserId = user?.id;
                  if (!currentUserId) {
                    const { supabase } = require('../lib/supabase');
                    const { data } = await supabase.auth.getUser();
                    currentUserId = data?.user?.id;
                  }

                  if (currentUserId) {
                    const { storeService } = require('../services/storeService');
                    const { sessionStorage } = require('../lib/storage');
                    const stores = await storeService.getStoresByUser(currentUserId);
                    await sessionStorage.saveUserRole('seller');
                    if (stores && stores.length > 0) {
                      navigation.reset({ index: 0, routes: [{ name: 'SellerTabs' }] });
                    } else {
                      navigation.reset({ index: 0, routes: [{ name: 'SellerAddStore' }] });
                    }
                  } else {
                    navigation.navigate('SellerAuth');
                  }
                } catch (e) {
                  navigation.navigate('SellerAuth');
                }
              }}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }], flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="storefront" size={16} color="white" />
                {!isMobile && (
                  <Text style={styles.openShopButtonText}>Ouvrir ma boutique</Text>
                )}
              </Animated.View>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Cart')}
              >
                <Ionicons name="cart-outline" size={22} color="white" />
                {items.length > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{items.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <SearchBar
            value={state.searchQuery}
            onChangeText={(text) => dispatch({ type: 'SET_SEARCH_QUERY', payload: text })}
            onFocus={() => {
              navigation.navigate('ClientSearch', { query: state.searchQuery });
            }}
            onVoiceStart={() => {
              navigation.navigate('ClientSearch', { query: state.searchQuery, startVoice: true });
            }}
            onSubmitEditing={() => {
              if (state.searchQuery.trim()) {
                navigation.navigate('ClientSearch', { query: state.searchQuery });
              }
            }}
            onClear={() => dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })}
            placeholder="Rechercher un produit, une boutique..."
            style={styles.searchBar}
          />
        </LinearGradient>

        {/* Banner Carousel */}
        {carouselBanners.length > 0 ? (
          <View style={styles.bannerSection}>
            <Animated.FlatList
              ref={flatListRef}
              data={carouselBanners}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: Platform.OS !== 'web' }
              )}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / (SCREEN_WIDTH - SPACING.xl * 2));
                dispatch({ type: 'SET_CURRENT_BANNER_INDEX', payload: index });
              }}
              renderItem={renderBannerItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.bannerList}
              snapToInterval={SCREEN_WIDTH - SPACING.xl * 2}
              decelerationRate="fast"
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH - SPACING.xl * 2,
                offset: (SCREEN_WIDTH - SPACING.xl * 2) * index,
                index,
              })}
              snapToAlignment="center"
              onScrollBeginDrag={() => dispatch({ type: 'SET_IS_PAUSED', payload: true })}
              onScrollEndDrag={() => {
                setTimeout(() => dispatch({ type: 'SET_IS_PAUSED', payload: false }), 2000);
              }}
              onScrollToIndexFailed={(info) => {
                const wait = new Promise(resolve => setTimeout(resolve, 500));
                wait.then(() => {
                  flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                });
              }}
              windowSize={5}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              removeClippedSubviews={Platform.OS !== 'web'}
            />

            {/* Pagination Dots */}
            <View style={styles.paginationContainer}>
              {carouselBanners.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    flatListRef.current?.scrollToIndex({ index, animated: true });
                    dispatch({ type: 'SET_CURRENT_BANNER_INDEX', payload: index });
                  }}
                >
                  <View style={[
                    styles.paginationDot,
                    currentBannerIndex === index && styles.paginationDotActive,
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={handleFlashDeals}>
            <LinearGradient
              colors={[palette.accent + '20', palette.accent + '05']}
              style={styles.quickActionIcon}
            >
              <Ionicons name="flash" size={24} color={palette.accent} />
            </LinearGradient>
            <Text style={styles.quickActionText}>Flash deals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={handleBonPlans}>
            <LinearGradient
              colors={[palette.success + '20', palette.success + '05']}
              style={styles.quickActionIcon}
            >
              <Ionicons name="gift" size={24} color={palette.success} />
            </LinearGradient>
            <Text style={styles.quickActionText}>Bons plans</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={handleNouveautes}>
            <LinearGradient
              colors={[palette.warning + '20', palette.warning + '05']}
              style={styles.quickActionIcon}
            >
              <Ionicons name="star" size={24} color={palette.warning} />
            </LinearGradient>
            <Text style={styles.quickActionText}>Nouveautés</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={handleFavorites}>
            <LinearGradient
              colors={[palette.info + '20', palette.info + '05']}
              style={styles.quickActionIcon}
            >
              <Ionicons name="heart" size={24} color={palette.info} />
            </LinearGradient>
            <Text style={styles.quickActionText}>Favoris</Text>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <View style={styles.categoriesSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <LinearGradient
                colors={[palette.accent, palette.accent2 || palette.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionIconBackground}
              >
                <Ionicons name="grid" size={20} color="white" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Catégories populaires</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ClientAllStores')}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          >
            {categoriesList.map(renderCategoryChip)}
          </ScrollView>
        </View>

        {/* Featured Stores */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrapper}>
              <LinearGradient
                colors={[palette.accent, palette.accent2 || palette.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionIconBackground}
              >
                <Ionicons name="storefront" size={20} color="white" />
              </LinearGradient>
              <View>
                <Text style={styles.sectionTitle}>Boutiques les plus visitées</Text>
                <Text style={styles.sectionSubtitle}>
                  {selectedCategory && selectedCategory !== 'Toutes' 
                    ? `Dans ${selectedCategory}`
                    : 'Le meilleur du commerce local'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ClientAllStores')}>
              <Text style={styles.seeAll}>Tout voir</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storesList}
            snapToInterval={storeCardWidth + SPACING.md}
            decelerationRate="fast"
          >
            {loadingStores ? (
              [1, 2, 3].map((i) => (
                <StoreCardSkeleton key={i} />
              ))
            ) : stores.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aucune boutique pour cette catégorie</Text>
              </View>
            ) : (
              stores.slice(0, 5).map((item, index) => renderStoreCard({ item, index }))
            )}
          </ScrollView>
        </View>

        {promoBanners.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleBannerPress(promoBanners[0])}
            style={styles.promoSection}
          >
            <LinearGradient
              colors={[
                normalizeHexColor(promoBanners[0].color) || palette.danger,
                palette.dangerGradient[1],
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.promoBanner}
            >
              <View style={styles.promoContent}>
                <Text style={styles.promoTitle}>{promoBanners[0].title}</Text>
                {promoBanners[0].subtitle ? (
                  <Text style={styles.promoSubtitle}>{promoBanners[0].subtitle}</Text>
                ) : null}
                <View style={styles.promoButton}>
                  <Text style={styles.promoButtonText}>Je profite</Text>
                  <Ionicons name="arrow-forward" size={18} color="white" />
                </View>
              </View>
              {promoBanners[0].image_url ? (
                <Image source={{ uri: cloudinaryService.getOptimizedUrl(promoBanners[0].image_url, 800) }} style={styles.promoImage} />
              ) : null}
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {/* Category Showcase - Amazon style */}
        <CategoryShowcase
          categories={categoriesList}
          onNavigate={(cat) => handleCategoryPress(cat)}
        />

        {/* AI Recommendations Section */}
        {(loadingRecommendations || recommendations.length > 0) && (
          <View style={styles.recommendationsSection}>
            <View style={[styles.sectionHeader, { paddingHorizontal: SPACING.xl }]}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>Recommandé pour vous</Text>
                  <LinearGradient
                    colors={[palette.accent, palette.accent2 || palette.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.aiBadge}
                  >
                    <Text style={styles.aiBadgeText}>✨ IA LibreShop</Text>
                  </LinearGradient>
                </View>
                <Text style={styles.sectionSubtitle}>Sélections personnalisées d'après vos goûts</Text>
              </View>
            </View>

            {loadingRecommendations ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendationsList}
              >
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={{ width: 170 }}>
                    <ProductCardSkeleton />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendationsList}
                decelerationRate="fast"
                snapToInterval={170 + SPACING.md}
              >
                {recommendations.map((item, idx) => (
                  <View key={item.product.id || idx} style={styles.recommendedCardWrapper}>
                    <ProductCard
                      name={item.product.name}
                      price={item.product.price}
                      comparePrice={item.product.compare_price}
                      imageUrl={item.product.images?.[0]}
                      onPress={() => navigation.navigate('ProductDetail', { productId: item.product.id })}
                    />
                    <View style={styles.aiReasonContainer}>
                      <Ionicons name="sparkles" size={10} color={palette.accent} />
                      <Text style={styles.aiReasonText} numberOfLines={2}>
                        {item.reason}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Featured Products Header */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrapper}>
              <LinearGradient
                colors={[palette.accent, palette.accent2 || palette.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionIconBackground}
              >
                <Ionicons name="pricetag" size={20} color="white" />
              </LinearGradient>
              <View>
                <Text style={styles.sectionTitle}>Les plus vendus</Text>
                <Text style={styles.sectionSubtitle}>Les tendances du moment</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ClientAllProducts')}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {/* Sort tabs */}
          <SortTabs
            options={SORT_OPTIONS}
            selected={productSort}
            onSelect={(id) => handleProductSortChange(id as any)}
          />
        </View>

        {/* Mapped loading skeleton loaders if products list is currently loading products */}
        {loadingProducts && products.length === 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, paddingHorizontal: SPACING.xl }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: responsiveProductCardWidth }}>
                <ProductCardSkeleton />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }, [
    loading,
    error,
    palette,
    logoAnim,
    pulseAnim,
    navigation,
    isMobile,
    items,
    state.searchQuery,
    carouselBanners,
    currentBannerIndex,
    categoriesList,
    selectedCategory,
    loadingStores,
    stores,
    promoBanners,
    loadingRecommendations,
    recommendations,
    productSort,
    SORT_OPTIONS,
    loadingProducts,
    products.length,
    responsiveProductCardWidth,
    SPACING,
    storeCardWidth,
    renderBannerItem,
    renderCategoryChip,
    handleProductSortChange,
  ]);

  // Footer Component de la FlatList (regroupe la newsletter et le bouton Charger plus)
  const renderFooter = useCallback(() => {
    if (loading || error) return null;

    return (
      <View style={styles.maxWidthContainer}>
        {/* Newsletter */}
        <View style={styles.newsletterSection}>
          <Text style={styles.newsletterTitle}>Ne manquez aucune offre</Text>
          <Text style={styles.newsletterText}>
            Inscrivez-vous à notre newsletter et recevez -10% sur votre première commande
          </Text>
          {newsletterSuccess ? (
            <View style={styles.newsletterSuccess}>
              <Ionicons name="checkmark-circle" size={24} color={palette.success} />
              <Text style={styles.newsletterSuccessText}>Merci de votre inscription !</Text>
            </View>
          ) : (
            <View style={styles.newsletterForm}>
              <TextInput
                style={styles.newsletterInput}
                placeholder="Votre adresse email"
                placeholderTextColor={palette.textMuted}
                value={newsletterEmail}
                onChangeText={(email) => dispatch({ type: 'SET_NEWSLETTER_EMAIL', payload: email })}
                keyboardType="email-address"
                editable={!newsletterLoading}
              />
              <TouchableOpacity
                style={[styles.newsletterButton, newsletterLoading && styles.newsletterButtonDisabled]}
                onPress={handleNewsletterSubscribe}
                disabled={newsletterLoading}
              >
                {newsletterLoading ? (
                  <ActivityIndicator size="small" color={palette.text} />
                ) : (
                  <>
                    <Text style={styles.newsletterButtonText}>S'inscrire</Text>
                    <Ionicons name="mail-outline" size={18} color="white" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Load More */}
        {hasMoreProducts && (
          <View style={styles.loadMoreContainer}>
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMoreProducts}
              disabled={loadingMoreProducts}
            >
              {loadingMoreProducts ? (
                <ActivityIndicator size="small" color={palette.accent} />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={palette.accent} />
                  <Text style={styles.loadMoreText}>Charger plus de produits</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [
    loading,
    error,
    newsletterSuccess,
    newsletterEmail,
    newsletterLoading,
    hasMoreProducts,
    loadingMoreProducts,
    palette,
    handleNewsletterSubscribe,
    handleLoadMoreProducts,
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={palette.bg} />
      
      {loading && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>Chargement des meilleures offres...</Text>
        </View>
      ) : error && products.length === 0 ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={64} color={palette.danger} />
          <Text style={styles.errorTitle}>Oups !</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductCard}
          keyExtractor={(item) => item.id}
          numColumns={numProductColumns}
          key={numProductColumns}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 0 }]}
          columnWrapperStyle={numProductColumns > 1 ? {
            paddingHorizontal: SPACING.xl,
            justifyContent: 'flex-start',
            gap: SPACING.md,
          } : undefined}
          
          // Performance Tuning Options:
          initialNumToRender={6}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          updateCellsBatchingPeriod={50}
        />
      )}

      {/* PWA Install Button - Only on Web */}
      {Platform.OS === 'web' && <PWAInstallButton />}

      {/* PWA Update Banner - Slides in when a new version is deployed */}
      {Platform.OS === 'web' && <PWAUpdateBanner />}
    </View>
  );
};

function createClientHomeStyles(palette: LegacyPalette, SPACING: any, RADIUS: any, FONT_SIZE: any) {
  return StyleSheet.create({
    promoSection: {
      marginBottom: SPACING.xl,
    },
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    scrollContent: {
      flexGrow: 1,
      backgroundColor: palette.bg,
    },
    maxWidthContainer: {
      maxWidth: Platform.OS === 'web' ? '100%' : MAX_CONTENT_WIDTH,
      width: '100%',
      alignSelf: 'center',
      flex: 1,
    },
    header: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xl,
      paddingBottom: SPACING.xl,
      borderBottomLeftRadius: RADIUS.xl,
      borderBottomRightRadius: RADIUS.xl,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    logoContainer: {
      flex: 1,
    },
    logoText: {
      fontSize: FONT_SIZE.xl,
      fontWeight: '800',
      color: palette.text,
      letterSpacing: 0.5,
    },
    logoSlogan: {
      fontSize: FONT_SIZE.xs,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    openShopButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.3)',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.5)',
      marginRight: SPACING.sm,
      ...(Platform.OS === 'web' ? { boxShadow: '0 0 15px rgba(255,255,255,0.4)' } : { elevation: 5 }),
    },
    openShopButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: 'white',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cartBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: palette.danger,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: palette.border,
    },
    cartBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: palette.text,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.card,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      gap: SPACING.sm,
    },
    searchPlaceholder: {
      flex: 1,
      fontSize: FONT_SIZE.sm,
      color: palette.textMuted,
    },

    // Banner Carousel
    bannerSection: {
      marginTop: -SPACING.lg,
      marginBottom: SPACING.md,
    },
    bannerList: {
      paddingHorizontal: SPACING.xl,
    },
    bannerCard: {
      width: '100%',
      height: 180,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      backgroundColor: palette.card,
      ...(Platform.OS === 'web'
        ? { boxShadow: '0px 4px 8px rgba(0,0,0,0.2)' }
        : {
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
          elevation: 5,
        }),
    },
    bannerImage: {
      width: '100%',
      height: '100%',
      position: 'absolute',
    },
    bannerGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '70%',
    },
    bannerContent: {
      position: 'absolute',
      bottom: SPACING.lg,
      left: SPACING.lg,
      right: SPACING.lg,
    },
    bannerTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '800',
      color: palette.text,
      marginBottom: 4,
      ...(Platform.OS === 'web'
        ? { textShadow: '0px 1px 2px rgba(0,0,0,0.3)' }
        : {
          textShadow: '0px 1px 2px rgba(0,0,0,0.3)',
        }),
    },
    bannerSubtitle: {
      fontSize: FONT_SIZE.sm,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: SPACING.sm,
      ...(Platform.OS === 'web'
        ? { textShadow: '0px 1px 2px rgba(0,0,0,0.3)' }
        : {
          textShadow: '0px 1px 2px rgba(0,0,0,0.3)',
        }),
    },
    bannerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
      gap: SPACING.xs,
    },
    bannerButtonText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      color: palette.text,
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: SPACING.md,
      gap: SPACING.xs,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: palette.border,
    },
    paginationDotActive: {
      width: 24,
      backgroundColor: palette.accent,
    },

    // Quick Actions
    quickActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: SPACING.xl,
      marginBottom: SPACING.xl,
    },
    quickAction: {
      alignItems: 'center',
      gap: SPACING.xs,
    },
    quickActionIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '500',
      color: palette.text,
    },

    // Categories
    categoriesSection: {
      marginBottom: SPACING.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    sectionTitleWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      flex: 1,
    },
    sectionIconBackground: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web'
        ? { boxShadow: '0px 4px 12px rgba(0,0,0,0.15)' }
        : { elevation: 5 }),
    },
    sectionTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '800',
      color: palette.text,
      letterSpacing: 0.5,
    },
    sectionSubtitle: {
      fontSize: FONT_SIZE.xs,
      color: palette.textMuted,
      marginTop: 2,
    },
    seeAll: {
      fontSize: FONT_SIZE.sm,
      color: palette.accent,
      fontWeight: '700',
    },
    categoriesList: {
      paddingHorizontal: SPACING.xl,
      gap: SPACING.sm,
    },
    categoryChip: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
    },
    categoryChipActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    },
    categoryChipText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '500',
      color: palette.textSoft,
    },
    categoryChipTextActive: {
      color: palette.text,
    },

    // Sections
    section: {
      marginBottom: SPACING.xl * 1.2,
    },
    storesList: {
      paddingHorizontal: SPACING.xl,
      gap: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    productsList: {
      paddingHorizontal: SPACING.xl,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      ...(Platform.OS === 'web' && {
        WebkitOverflowScrolling: 'touch',
        overflow: 'visible',
      }),
    },
    productsGrid: {
      justifyContent: 'flex-start',
      gap: SPACING.md,
    },
    productCardWrapper: {
      marginBottom: SPACING.lg,
    },
    storeNameLabel: {
      fontSize: FONT_SIZE.xs,
      color: palette.textMuted,
      marginTop: 4,
      paddingHorizontal: 2,
    },
    storeCardOuter: {
      marginRight: SPACING.md,
      marginBottom: SPACING.md,
    },
    storeCard: {
      backgroundColor: palette.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: palette.border,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? { boxShadow: '0px 6px 20px rgba(0,0,0,0.12)' }
        : { boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.12)', elevation: 6 }),
    },
    storeMedia: {
      height: 110,
      width: '100%',
      position: 'relative',
      backgroundColor: palette.bg,
    },
    storeBanner: {
      width: '100%',
      height: '100%',
    },
    storeBannerPlaceholder: {
      width: '100%',
      height: '100%',
    },
    storeLogoWrap: {
      position: 'absolute',
      left: SPACING.md,
      bottom: -24,
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 3,
      borderColor: palette.card,
      backgroundColor: palette.card,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? { boxShadow: '0px 4px 12px rgba(0,0,0,0.15)' }
        : { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)', elevation: 5 }),
    },
    storeLogo: {
      width: '100%',
      height: '100%',
    },
    storeLogoPlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.bg,
    },
    verifiedBadge: {
      position: 'absolute',
      top: SPACING.sm,
      right: SPACING.sm,
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 2,
    },
    storeBody: {
      paddingHorizontal: SPACING.md,
      paddingTop: 36,
      paddingBottom: SPACING.md,
    },
    storeTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    storeName: {
      flex: 1,
      fontSize: FONT_SIZE.md,
      fontWeight: '800',
      color: palette.text,
      letterSpacing: 0.3,
    },
    categoryPill: {
      alignSelf: 'flex-start',
      marginBottom: SPACING.sm,
      backgroundColor: 'rgba(0,0,0,0.05)',
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.sm,
    },
    categoryPillText: {
      fontSize: FONT_SIZE.xs,
      color: palette.accent,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    storeDesc: {
      fontSize: FONT_SIZE.xs,
      color: palette.textSoft,
      lineHeight: 16,
      marginBottom: SPACING.sm,
      fontWeight: '400',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    starsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 1,
    },
    ratingText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '700',
      color: palette.text,
      marginLeft: 3,
    },
    bannerRatingBadge: {
      position: 'absolute',
      right: SPACING.md,
      bottom: SPACING.md,
      backgroundColor: palette.accent,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      ...(Platform.OS === 'web' ? { boxShadow: '0 6px 18px rgba(0,0,0,0.12)' } : { elevation: 6 }),
    },
    bannerRatingText: {
      color: 'white',
      fontWeight: '800',
      fontSize: FONT_SIZE.xs,
      marginLeft: 4,
    },
    bannerRatingCount: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: FONT_SIZE.xs - 2,
      marginLeft: 4,
    },
    popularBadge: {
      backgroundColor: palette.danger, // warm color
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    newBadge: {
      backgroundColor: palette.success,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    followerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.card,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.xs,
      paddingVertical: SPACING.xs,
      borderWidth: 1,
      borderColor: palette.border,
    },
    followerText: {
      marginLeft: SPACING.xs / 2,
      color: palette.textMuted,
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
    },
    ratingCount: {
      fontSize: FONT_SIZE.xs,
      color: palette.textMuted,
    },
    productsCount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    productsCountText: {
      fontSize: FONT_SIZE.xs,
      color: palette.textMuted,
    },

    // Promo Banner
    promoBanner: {
      flexDirection: 'row',
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.xl,
      marginTop: SPACING.lg,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      height: 160,
      ...(Platform.OS === 'web'
        ? { boxShadow: '0px 8px 24px rgba(0,0,0,0.15)' }
        : { elevation: 8 }),
    },
    promoContent: {
      flex: 1,
      padding: SPACING.lg,
      justifyContent: 'center',
    },
    promoTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '800',
      color: palette.text,
      marginBottom: 6,
      letterSpacing: 0.3,
    },
    promoSubtitle: {
      fontSize: FONT_SIZE.sm,
      color: 'rgba(255,255,255,0.95)',
      marginBottom: SPACING.md,
      fontWeight: '500',
    },
    promoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.25)',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      gap: SPACING.xs,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
    },
    promoButtonText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '700',
      color: 'white',
      letterSpacing: 0.3,
    },
    promoImage: {
      width: 140,
      height: '100%',
    },

    // Newsletter
    newsletterSection: {
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.xl,
      padding: SPACING.xl,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      alignItems: 'center',
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
    },
    newsletterTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: palette.text,
      marginBottom: SPACING.sm,
      textAlign: 'center',
    },
    newsletterText: {
      fontSize: FONT_SIZE.sm,
      color: palette.textMuted,
      textAlign: 'center',
      marginBottom: SPACING.lg,
    },
    newsletterForm: {
      width: '100%',
      gap: SPACING.sm,
    },
    newsletterInput: {
      backgroundColor: palette.bg,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      fontSize: FONT_SIZE.sm,
      color: palette.text,
    },
    newsletterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.accent,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.full,
      gap: SPACING.sm,
    },
    newsletterButtonDisabled: {
      opacity: 0.6,
    },
    newsletterButtonText: {
      fontSize: FONT_SIZE.md,
      fontWeight: '600',
      color: palette.text,
    },
    newsletterSuccess: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: palette.bg,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
    },
    newsletterSuccessText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      color: palette.success,
    },

    // Load More
    loadMoreContainer: {
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    loadMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: palette.card,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: palette.border,
    },
    loadMoreText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      color: palette.accent,
    },

    // Loading & Error States
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: SPACING.xxxl,
      gap: SPACING.md,
    },
    loadingText: {
      fontSize: FONT_SIZE.md,
      color: palette.textMuted,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: SPACING.xxxl,
      paddingHorizontal: SPACING.xl,
      gap: SPACING.md,
    },
    errorTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: '700',
      color: palette.text,
    },
    errorText: {
      fontSize: FONT_SIZE.md,
      color: palette.textMuted,
      textAlign: 'center',
      marginBottom: SPACING.lg,
    },
    retryButton: {
      backgroundColor: palette.accent,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.full,
    },
    retryButtonText: {
      color: palette.text,
      fontWeight: '600',
      fontSize: FONT_SIZE.md,
    },

    // Empty States
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.xl,
    },
    emptyText: {
      fontSize: FONT_SIZE.md,
      color: palette.textMuted,
      textAlign: 'center',
    },

    // AI Recommendations
    recommendationsSection: {
      marginBottom: SPACING.xl * 1.2,
      backgroundColor: 'rgba(0,0,0,0.02)',
      paddingVertical: SPACING.lg,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderTopColor: palette.border,
      borderBottomColor: palette.border,
    },
    recommendationsList: {
      paddingLeft: SPACING.xl,
      paddingRight: SPACING.md,
      gap: SPACING.md,
      paddingBottom: SPACING.md,
    },
    recommendedCardWrapper: {
      width: 170,
      gap: SPACING.xs,
    },
    aiBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: RADIUS.sm,
      justifyContent: 'center',
      alignItems: 'center',
      ...(Platform.OS === 'web'
        ? { boxShadow: '0px 2px 8px rgba(0,0,0,0.1)' }
        : { elevation: 2 }),
    },
    aiBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#ffffff',
      letterSpacing: 0.3,
    },
    aiReasonContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 5,
      marginTop: 3,
      paddingHorizontal: SPACING.xs,
    },
    aiReasonText: {
      fontSize: FONT_SIZE.xs - 1,
      color: palette.accent,
      fontWeight: '600',
      flex: 1,
      lineHeight: 13,
    },
  });
}

export default ClientHomeScreen;
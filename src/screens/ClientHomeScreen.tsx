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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyPalette, type LegacyPalette } from '../hooks/useLegacyPalette';
import { useTheme } from '../hooks/useTheme';
import { navigateToClientTab } from '../navigation/clientNavigation';
import { errorHandler } from '../utils/errorHandler';
import { StoreCard, ProductCard, StoreCardSkeleton, ProductCardSkeleton, CategoryShowcase, SearchBar } from '../components';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { SortTabs } from '../components/SortTabs';
import { useResponsive } from '../utils/responsive';
import { useClientHomeState } from '../hooks/useClientHomeState';
import { Store, Product, HomeBanner, Collection } from '../lib/supabase';
import { storeService } from '../services/storeService';
import { productService } from '../services/productService';
import { homeBannerService } from '../services/homeBannerService';
import { collectionService } from '../services/collectionService';
import { useCartStore } from '../store';
import { categoryService } from '../services/categoryService';
import { cloudinaryService } from '../services/cloudinaryService';
import { cacheService } from '../services/cacheService';
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

export const ClientHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  /* sort tabs now use shared component SortTabs */
  const insets = useSafeAreaInsets();
  const { width, isMobile, isTablet, isDesktop, isLargeDesktop } = useResponsive();
  const { items } = useCartStore();
  const palette = useLegacyPalette();
  const { spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE, isDark } = useTheme();
  const styles = useMemo(
    () => createClientHomeStyles(palette, SPACING, RADIUS, FONT_SIZE),
    [palette, SPACING, RADIUS, FONT_SIZE]
  );
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize state with reducer
  const { state, dispatch } = useClientHomeState();

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

  // Start cache monitoring for performance metrics
  useEffect(() => {
    console.log('[ClientHome] 🚀 Starting cache optimization monitoring...');
    const stopMonitoring = cacheMonitor.start(60000); // Log every 60 seconds
    return () => {
      stopMonitoring();
      console.log('[ClientHome] ⏹️ Cache monitoring stopped');
    };
  }, []);

  // Calculer le nombre de colonnes et la largeur des cartes dynamiquement
  const numProductColumns = isLargeDesktop ? 6 : isDesktop ? 4 : isTablet ? 3 : 2;
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

    const interval = setInterval(() => {
      const nextIndex = (currentBannerIndexRef.current + 1) % carouselBanners.length;
      try {
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      } catch (err) {
        // Silent fail - index out of bounds on initial render
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [carouselBanners.length, isPaused]);

  // Cache loading logic
  const loadCachedData = useCallback(async () => {
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
  }, [dispatch]);

  useEffect(() => {
    loadCachedData();
  }, [loadCachedData]);

  // Load data from Supabase with high resilience
  const loadData = useCallback(
    async (refresh = false) => {
      try {
        if (!refresh) dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });

        // Parallel data loading with individual error handling
        const [storesResult, productsResult, bannersResult] = await Promise.allSettled([
          // Load stores based on selected category
          (async () => {
            let data;
            if (selectedCategory) {
              data = await categoryService.getStoresByCategory(selectedCategory, 5);
            } else {
              data = await storeService.getFeatured();
            }
            if (data) {
              dispatch({ type: 'SET_STORES', payload: data });
              cacheService.set(CACHE_KEYS.STORES, data, CACHE_TTL.STORES.duration, CACHE_TTL.STORES.stale);
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
          Promise.all([
            homeBannerService.getActiveByPlacement('carousel').catch(() => []),
            homeBannerService.getActiveByPlacement('promo').catch(() => []),
            categoryService.getPopularCategories(6).catch(() => []),
          ]).then(([carousel, promo, cats]) => {
            if (carousel?.length) {
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
            if (cats?.length) {
              const catNames = ['Toutes', ...cats.map(c => c.name)];
              dispatch({ type: 'SET_CATEGORIES', payload: catNames });
              cacheService.set(CACHE_KEYS.CATEGORIES, catNames, CACHE_TTL.CATEGORIES.duration, CACHE_TTL.CATEGORIES.stale);
            }
          }),
        ]);

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
    [dispatch, productSort, selectedCategory, products.length, stores.length]
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
          dispatch({ type: 'SET_STORES', payload: data });
          cacheService.set(CACHE_KEYS.STORES, data, CACHE_TTL.STORES.duration, CACHE_TTL.STORES.stale);
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

  const renderBannerItem = useCallback(({ item, index }: { item: HomeBanner; index: number }) => {
    const bannerWidth = SCREEN_WIDTH - SPACING.xl * 2;
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
        activeOpacity={0.9}
        onPress={() => handleBannerPress(item)}
        style={{ width: bannerWidth }}
      >
        <Animated.View style={[styles.bannerCard, { transform: [{ scale }], opacity }]}>
          {item.image_url ? (
            <Image 
              source={{ uri: cloudinaryService.getOptimizedUrl(item.image_url, 800) }} 
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
  }, [SPACING.xl, scrollX, styles, handleBannerPress]);

  const renderCategoryChip = (category: string) => {
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
  };

  const renderStoreCard = useCallback(({ item }: { item: Store }) => (
    <StoreCard
      name={item.name}
      category={item.category}
      description={item.description}
      logoUrl={item.logo_url}
      onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}
    />
  ), [navigation]);

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

  // Calcul des dimensions responsive
  const storeCardWidth = isDesktop ? 220 : isTablet ? 200 : 180;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={palette.bg} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }
      >
        <View style={styles.maxWidthContainer}>
          <LinearGradient
            colors={[palette.accent, palette.accentDark || palette.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText} numberOfLines={1} adjustsFontSizeToFit>libreshop</Text>
                <Text style={styles.logoSlogan} numberOfLines={1}>Achetez local, vivez mieux</Text>
              </View>
              <TouchableOpacity
                style={styles.openShopButton}
                onPress={() => navigation.navigate('SellerAuth')}
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
                  onPress={() => navigateToClientTab(navigation, 'Wishlist')}
                >
                  <Ionicons name="heart-outline" size={22} color="white" />
                </TouchableOpacity>
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

          {/* Loading/Error State */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={styles.loadingText}>Chargement des meilleures offres...</Text>
            </View>
          )}

          {error && !loading && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={64} color={palette.danger} />
              <Text style={styles.errorTitle}>Oups !</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && (
            <>
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
                    windowSize={3}
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
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
                  <Text style={styles.sectionTitle}>Catégories populaires</Text>
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
                  <View>
                    <Text style={styles.sectionTitle}>Boutiques populaires</Text>
                    <Text style={styles.sectionSubtitle}>
                      {selectedCategory && selectedCategory !== 'Toutes' 
                        ? `Dans ${selectedCategory}`
                        : 'Le meilleur du commerce local'}
                    </Text>
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
                    stores.slice(0, 5).map((item) => (
                      <StoreCard
                        key={item.id}
                        name={item.name}
                        category={item.category}
                        description={item.description}
                        logoUrl={item.logo_url}
                        orderCount={item.total_orders || (Array.isArray(item.store_stats) ? item.store_stats[0]?.customers_count : item.store_stats?.customers_count) || 0}
                        followersCount={(Array.isArray(item.store_stats) ? item.store_stats[0]?.followers_count : item.store_stats?.followers_count) || 0}
                        onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}
                      />
                    ))
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

              {/* Featured Products */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Produits</Text>
                    <Text style={styles.sectionSubtitle}>Les tendances du moment</Text>
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

                {loadingProducts ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md }}>
                    {[1, 2, 3, 4].map((i) => (
                      <View key={i} style={{ width: responsiveProductCardWidth }}>
                        <ProductCardSkeleton />
                      </View>
                    ))}
                  </View>
                ) : (
                  <FlatList
                    data={products}
                    renderItem={renderProductCard}
                    keyExtractor={(item) => item.id}
                    numColumns={numProductColumns}
                    key={numProductColumns}
                    scrollEnabled={false}
                    nestedScrollEnabled={false}
                    columnWrapperStyle={styles.productsGrid}
                    contentContainerStyle={styles.productsList}
                    initialNumToRender={numProductColumns * 2}
                    maxToRenderPerBatch={numProductColumns}
                    updateCellsBatchingPeriod={50}
                    removeClippedSubviews={Platform.OS === 'android'}
                    windowSize={3}
                  />
                )}
              </View>

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
            </>
          )}
        </View>
      </ScrollView>

      {/* PWA Install Button - Only on Web */}
      {Platform.OS === 'web' && <PWAInstallButton />}
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
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: palette.text,
    },
    sectionSubtitle: {
      fontSize: FONT_SIZE.xs,
      color: palette.textMuted,
      marginTop: 2,
    },
    seeAll: {
      fontSize: FONT_SIZE.sm,
      color: palette.accent,
      fontWeight: '600',
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
      marginBottom: SPACING.xl,
    },
    storesList: {
      paddingHorizontal: SPACING.xl,
      gap: SPACING.md,
    },
    productsList: {
      paddingHorizontal: SPACING.xl,
      gap: SPACING.md,
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

    // Promo Banner
    promoBanner: {
      flexDirection: 'row',
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.xl,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      height: 140,
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
      marginBottom: 4,
    },
    promoSubtitle: {
      fontSize: FONT_SIZE.sm,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: SPACING.md,
    },
    promoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      gap: SPACING.xs,
    },
    promoButtonText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      color: palette.text,
    },
    promoImage: {
      width: 120,
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
  });
}

export default ClientHomeScreen;
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown,
  FadeIn,
  Layout,
} from 'react-native-reanimated';

import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import StoreFiltersModal from '../components/StoreFiltersModal';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { Store, StoreStats } from '../lib/supabase';
import { storeService } from '../services/storeService';
import { storeStatsService } from '../services/storeStatsService';
import { useResponsive } from '../utils/responsive';
import { cloudinaryService } from '../services/cloudinaryService';
import { SearchBar } from '../components/SearchBar';
import { useSearch } from '../hooks/useSearch';
import { locationService } from '../services/locationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 1200;

// Nearby radius options
const NEARBY_RADIUS_OPTIONS = [
  { id: 5, label: '5 km' },
  { id: 10, label: '10 km' },
  { id: 20, label: '20 km' },
];

export const ClientAllStoresScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isMobile, isTablet, isDesktop, isLargeDesktop } = useResponsive();

  // Calcul dynamique du nombre de colonnes selon la largeur
  const getNumColumns = () => {
    if (SCREEN_WIDTH >= 1400) return 6; // Très grand écran
    if (SCREEN_WIDTH >= 1200) return 5; // Desktop large
    if (SCREEN_WIDTH >= 900) return 4;  // Desktop
    if (SCREEN_WIDTH >= 600) return 3;  // Tablette
    return 2; // Mobile
  };

  const [numColumns, setNumColumns] = useState(getNumColumns());

  // Mettre à jour le nombre de colonnes lors du redimensionnement
  useEffect(() => {
    const updateColumns = () => {
      setNumColumns(getNumColumns());
    };
    
    const subscription = Dimensions.addEventListener('change', updateColumns);
    return () => subscription?.remove();
  }, []);

  const { query, setQuery, isLoading: searchLoading } = useSearch({ debounceDelay: 300 });
  const [selectedCategory, setSelectedCategory] = useState('Toutes');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<string[]>(['Toutes']);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{ deliveryOnly?: boolean; minRating?: number; countryId?: string; cityId?: string }>({});
  const [statsByStoreId, setStatsByStoreId] = useState<Record<string, StoreStats>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Nearby filter state
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(10);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);

  useEffect(() => {
    loadStores();
  }, []);

  // Update nearbyStores when stores change and filter is enabled
  useEffect(() => {
    if (nearbyEnabled && userLocation) {
      const storesWithDistance = stores
        .map(store => ({
          ...store,
          distance: locationService.calculateDistanceToStore(userLocation, store)
        }))
        .filter(store => store.distance !== null && store.distance <= nearbyRadius)
        .sort((a, b) => (a as any).distance! - (b as any).distance!);
      
      setNearbyStores(storesWithDistance as any);
    }
  }, [stores, nearbyEnabled, userLocation, nearbyRadius]);

  const loadStores = async (reset = true) => {
    try {
      if (reset) {
        setIsLoading(true);
        setPage(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      
      setError(null);
      const currentPage = reset ? 0 : page;
      const pageSize = 20;

      // Récupérer les boutiques avec le tri passé en paramètre ou par défaut
      const sortParam = route.params?.sort || 'score';
      const data = await storeService.getAll(currentPage, pageSize, sortParam);
      const list = (data || []) as Store[];
      
      if (reset) {
        setStores(list);
        const uniqueCategories = Array.from(
          new Set(list.map((s) => s.category).filter(Boolean))
        ) as string[];
        setCategories(['Toutes', ...uniqueCategories]);
      } else {
        setStores(prev => [...prev, ...list]);
      }
      
      setHasMore(list.length === pageSize);

      const storeIds = list.map((s) => s.id);
      if (storeIds.length > 0) {
        const stats = await storeStatsService.getByStores(storeIds);
        setStatsByStoreId(prev => {
          const next = { ...prev };
          for (const st of stats) {
            next[st.store_id] = st;
          }
          return next;
        });
      }
    } catch (e: any) {
      errorHandler.handleDatabaseError(e, 'ClientAllStoresScreen loadStores error');
      setError('Impossible de charger les boutiques');
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoading && !loadingMore && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (page > 0) {
      loadStores(false);
    }
  }, [page]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStores();
  }, []);

  // Handle nearby filter toggle
  const handleToggleNearby = useCallback(async () => {
    if (!nearbyEnabled) {
      // Enable nearby filter
      setLoadingNearby(true);
      try {
        const location = await locationService.getCurrentPosition();
        if (!location) {
          Alert.alert('Erreur', 'Impossible d\'accéder à votre position');
          return;
        }
        setUserLocation(location);
        
        // Filter existing stores by distance
        const storesWithDistance = stores
          .map(store => ({
            ...store,
            distance: locationService.calculateDistanceToStore(location, store)
          }))
          .filter(store => store.distance !== null && store.distance <= nearbyRadius)
          .sort((a, b) => (a as any).distance! - (b as any).distance!);
        
        setNearbyStores(storesWithDistance as any);
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
          .map(store => ({
            ...store,
            distance: locationService.calculateDistanceToStore(userLocation, store)
          }))
          .filter(store => store.distance !== null && store.distance <= radius)
          .sort((a, b) => (a as any).distance! - (b as any).distance!);
        
        setNearbyStores(storesWithDistance as any);
      } catch (error) {
        console.error('Error updating nearby stores:', error);
      } finally {
        setLoadingNearby(false);
      }
    }
  }, [nearbyEnabled, userLocation, stores]);

  const dynamicStyles = useMemo(() => ({
    listContent: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xxl + insets.bottom,
    },
    columnWrapper: {
      justifyContent: 'space-between' as const,
      marginBottom: SPACING.md,
    },
    cardWidth: (SCREEN_WIDTH - (SPACING.lg * 2) - (SPACING.md * (numColumns - 1))) / numColumns,
  }), [insets.bottom, numColumns]);

  const filteredStores = useMemo(() => {
    let storesList = nearbyEnabled ? nearbyStores : stores;

    if (selectedCategory !== 'Toutes') {
      storesList = storesList.filter((store) => store.category === selectedCategory);
    }

    // apply modal filters
    if (filters.deliveryOnly) {
      storesList = storesList.filter((s) => (s.shipping_price || 0) > 0);
    }
    if (typeof filters.minRating === 'number' && filters.minRating > 0) {
      storesList = storesList.filter((s) => {
        const st = statsByStoreId[s.id];
        const avg = st?.rating_avg || 0;
        return avg >= (filters.minRating || 0);
      });
    }
    if (filters.countryId) {
      storesList = storesList.filter((s) => s.country_id === filters.countryId);
    }
    if (filters.cityId) {
      storesList = storesList.filter((s) => s.city_id === filters.cityId);
    }

    if (query.trim()) {
      const searchTerm = query.toLowerCase().trim();
      storesList = storesList.filter(
        (store) =>
          store.name?.toLowerCase().includes(searchTerm) ||
          store.description?.toLowerCase().includes(searchTerm) ||
          store.category?.toLowerCase().includes(searchTerm)
      );
    }

    return storesList;
  }, [query, selectedCategory, stores, filters, statsByStoreId, nearbyEnabled, nearbyStores]);

  const renderStars = useCallback((avg: number) => {
    const safe = Number.isFinite(avg) ? Math.max(0, Math.min(5, avg)) : 0;
    const full = Math.floor(safe);
    const half = safe - full >= 0.5;
    
    return (
      <View style={styles.starsRow}>
        {[...Array(5)].map((_, i) => {
          if (i < full) {
            return <Ionicons key={i} name="star" size={12} color={COLORS.warning} />;
          } else if (i === full && half) {
            return <Ionicons key={i} name="star-half" size={12} color={COLORS.warning} />;
          } else {
            return <Ionicons key={i} name="star-outline" size={12} color={COLORS.textMuted} />;
          }
        })}
      </View>
    );
  }, []);

  const renderStoreCard = useCallback(
    ({ item, index }: { item: Store; index: number }) => {
      const stats = statsByStoreId[item.id];
      const ratingAvg = stats?.rating_avg ?? 0;
      const ratingCount = stats?.rating_count ?? 0;
      const logoUrl = item.logo_url;
      const bannerUrl = item.banner_url;

      return (
        <Animated.View
          entering={FadeInDown.delay(index * 50).duration(400)}
          layout={Layout.springify()}
          style={[
            styles.storeCardOuter,
            { width: dynamicStyles.cardWidth }
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.storeCard}
            onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}
          >
            <View style={styles.storeMedia}>
              {bannerUrl ? (
                <Image source={{ uri: cloudinaryService.getOptimizedUrl(bannerUrl, 600) }} style={styles.storeBanner} resizeMode="cover" />
              ) : (
                <LinearGradient
                  colors={[COLORS.accent + '40', COLORS.accent + '10']}
                  style={styles.storeBannerPlaceholder}
                />
              )}

              <View style={styles.storeLogoWrap}>
                {logoUrl ? (
                  <Image source={{ uri: cloudinaryService.getOptimizedUrl(logoUrl, 150) }} style={styles.storeLogo} />
                ) : (
                  <View style={styles.storeLogoPlaceholder}>
                    <Ionicons name="storefront" size={20} color={COLORS.accent} />
                  </View>
                )}
              </View>

              {/* Badge vérifié */}
              {item.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.info} />
                </View>
              )}

              {/* Distance badge */}
              {(() => {
                const distance = nearbyEnabled ? locationService.calculateDistanceToStore(userLocation, item) : null;
                if (distance === null) return null;
                return (
                  <View style={styles.distanceBadge}>
                    <Ionicons name="location-outline" size={12} color={COLORS.accent} />
                    <Text style={styles.distanceBadgeText}>
                      {distance.toFixed(1)} km
                    </Text>
                  </View>
                );
              })()}
            </View>

            <View style={styles.storeBody}>
              <View style={styles.storeTopRow}>
                <Text numberOfLines={1} style={styles.storeName}>
                  {item.name}
                </Text>
              </View>

              <View style={styles.categoryPill}>
                <Text numberOfLines={1} style={styles.categoryPillText}>
                  {item.category ?? 'Non catégorisé'}
                </Text>
              </View>

              {item.description ? (
                <Text numberOfLines={2} style={styles.storeDesc}>
                  {item.description}
                </Text>
              ) : null}

              <View style={styles.statsRow}>
                <View style={styles.ratingContainer}>
                  {renderStars(ratingAvg)}
                  <Text style={styles.ratingText}>
                    {ratingAvg ? ratingAvg.toFixed(1) : '0.0'}
                  </Text>
                  <Text style={styles.ratingCount}>
                    ({ratingCount})
                  </Text>
                </View>

                {(stats as any)?.total_products > 0 && (
                  <View style={styles.productsCount}>
                    <Ionicons name="cube-outline" size={12} color={COLORS.textMuted} />
                    <Text style={styles.productsCountText}>{(stats as any).total_products}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [navigation, renderStars, statsByStoreId, dynamicStyles.cardWidth, nearbyEnabled, userLocation]
  );

  const handleSelectCategory = useCallback((cat: string) => {
    setSelectedCategory(cat);
  }, []);

  const renderCategoryChip = useCallback(
    (category: string) => {
      const isActive = selectedCategory === category;
      return (
        <TouchableOpacity
          key={category}
          activeOpacity={0.7}
          style={[styles.categoryChip, isActive && styles.categoryChipActive]}
          onPress={() => handleSelectCategory(category)}
        >
          <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
            {category}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedCategory, handleSelectCategory]
  );

  return (
    <View style={styles.maxWidthContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexContainer}
        keyboardVerticalOffset={insets.top}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Header avec dégradé */}
          <LinearGradient
            colors={[COLORS.accent, COLORS.accentDark || COLORS.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={22} color="white" />
              </TouchableOpacity>

              <View style={styles.headerTitles}>
                <Text style={styles.title}>Boutiques</Text>
                <Text style={styles.subtitle}>Découvrez nos vendeurs partenaires</Text>
              </View>

              <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(true)}>
                <Ionicons name="options-outline" size={22} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterBtn, nearbyEnabled && styles.filterBtnActive]}
                onPress={handleToggleNearby}
                disabled={loadingNearby}
              >
                <Ionicons 
                  name="navigate" 
                  size={22} 
                  color={nearbyEnabled ? COLORS.accent : "white"} 
                />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Barre de recherche flottante */}
          <BlurView intensity={80} tint="light" style={styles.searchContainer}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher une boutique..."
              isLoading={searchLoading}
              onClear={() => setQuery('')}
            />
          </BlurView>

          {/* Catégories scrollables */}
          <View style={styles.categoriesWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
            >
              {categories.map(renderCategoryChip)}
            </ScrollView>
          </View>

          {/* Sélecteur de rayon pour le filtre proximité */}
          {nearbyEnabled && (
            <View style={styles.radiusWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.radiusList}
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
            </View>
          )}

          {/* En-tête des résultats */}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {isLoading ? 'Chargement...' : `${filteredStores.length} boutique${filteredStores.length !== 1 ? 's' : ''}`}
            </Text>
            {!isLoading && filteredStores.length > 0 && (
              <Text style={styles.resultsSubtext}>
                {selectedCategory !== 'Toutes' ? `Dans ${selectedCategory}` : 'Toutes catégories'}
              </Text>
            )}
          </View>

          {/* Liste des boutiques */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.accent} />
              <Text style={styles.loadingText}>Chargement des boutiques...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={64} color={COLORS.danger} />
              <Text style={styles.errorTitle}>Oups !</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadStores(true)}>
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <FlatList
                data={filteredStores}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                key={numColumns}
                contentContainerStyle={dynamicStyles.listContent}
                columnWrapperStyle={numColumns > 1 ? dynamicStyles.columnWrapper : undefined}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={onRefresh}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  loadingMore ? (
                    <View style={styles.footerLoader}>
                      <ActivityIndicator color={COLORS.accent} />
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  <Animated.View entering={FadeIn} style={styles.emptyState}>
                    <Ionicons name="storefront-outline" size={80} color={COLORS.textMuted} />
                    <Text style={styles.emptyTitle}>Aucune boutique trouvée</Text>
                    <Text style={styles.emptyText}>
                      Essayez avec un autre mot-clé ou une autre catégorie
                    </Text>
                    {(query || selectedCategory !== 'Toutes') && (
                      <TouchableOpacity
                        style={styles.clearFiltersButton}
                        onPress={() => {
                          setQuery('');
                          setSelectedCategory('Toutes');
                        }}
                      >
                        <Text style={styles.clearFiltersText}>Effacer les filtres</Text>
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                }
                renderItem={renderStoreCard}
              />

              <StoreFiltersModal
                visible={showFilters}
                onClose={() => setShowFilters(false)}
                categories={categories}
                initial={{
                  category: selectedCategory,
                  deliveryOnly: Boolean(filters.deliveryOnly),
                  minRating: filters.minRating || 0,
                  countryId: filters.countryId,
                  cityId: filters.cityId,
                }}
                onApply={(f) => {
                  setSelectedCategory(f.category || 'Toutes');
                  setFilters({ deliveryOnly: f.deliveryOnly, minRating: f.minRating, countryId: f.countryId, cityId: f.cityId });
                }}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  maxWidthContainer: {
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  footerLoader: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  flexContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: SPACING.xl,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? { boxShadow: `0px 4px 8px ${COLORS.accent}33` }
      : {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FONT_SIZE.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    marginTop: -SPACING.lg,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    elevation: 3,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }
      : {
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        }),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    height: 52,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft, // Utiliser textSoft pour le contraste
    paddingVertical: 0,
  },
  categoriesWrapper: {
    marginTop: SPACING.lg,
  },
  categoriesList: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }
      : {
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
          elevation: 2,
        }),
  },
  categoryChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSoft,
  },
  categoryTextActive: {
    color: COLORS.text,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  resultsCount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  resultsSubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  errorTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  retryButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  clearFiltersButton: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearFiltersText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  storeCardOuter: {
    marginBottom: SPACING.md,
  },
  storeCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.05)' }
      : {
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
          elevation: 2,
        }),
  },
  storeMedia: {
    height: 90,
    width: '100%',
    position: 'relative',
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
    bottom: -20,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: COLORS.card,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }
      : {
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          elevation: 3,
        }),
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
    backgroundColor: COLORS.bg,
  },
  verifiedBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 2,
  },
  distanceBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  distanceBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.accent,
  },
  filterBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  radiusWrapper: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  radiusList: {
    gap: SPACING.sm,
  },
  radiusChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  radiusChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  radiusChipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  radiusChipTextActive: {
    color: 'white',
  },
  storeBody: {
    paddingHorizontal: SPACING.md,
    paddingTop: 28,
    paddingBottom: SPACING.md,
  },
  storeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  storeName: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
  },
  categoryPillText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  storeDesc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSoft,
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: 2,
  },
  ratingCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  productsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  productsCountText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
});

export default ClientAllStoresScreen;
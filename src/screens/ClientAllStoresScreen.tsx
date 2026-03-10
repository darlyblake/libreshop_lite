import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
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
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown,
  FadeIn,
  Layout,
} from 'react-native-reanimated';

import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { storeService, storeStatsService, Store, StoreStats } from '../lib/supabase';
import { useResponsive } from '../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ClientAllStoresScreen: React.FC = () => {
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<string[]>(['Toutes']);
  const [statsByStoreId, setStatsByStoreId] = useState<Record<string, StoreStats>>({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await storeService.getAll();
      const list = (data || []) as Store[];
      setStores(list);

      const uniqueCategories = Array.from(
        new Set(list.map((s) => s.category).filter(Boolean))
      ) as string[];
      setCategories(['Toutes', ...uniqueCategories]);

      const storeIds = list.map((s) => s.id);
      const stats = await storeStatsService.getByStores(storeIds);
      const nextStatsById: Record<string, StoreStats> = {};
      for (const st of stats) {
        nextStatsById[st.store_id] = st;
      }
      setStatsByStoreId(nextStatsById);
    } catch (e) {
      console.error('ClientAllStoresScreen loadStores error', e);
      setError('Impossible de charger les boutiques');
      Alert.alert('Erreur', 'Impossible de charger les boutiques. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStores();
  }, []);

  const dynamicStyles = useMemo(() => ({
    listContent: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xxl + insets.bottom,
    },
    columnWrapper: {
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    cardWidth: (SCREEN_WIDTH - (SPACING.lg * 2) - (SPACING.md * (numColumns - 1))) / numColumns,
  }), [insets.bottom, numColumns]);

  const filteredStores = useMemo(() => {
    let storesList = stores;

    if (selectedCategory !== 'Toutes') {
      storesList = storesList.filter((store) => store.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      storesList = storesList.filter(
        (store) =>
          store.name?.toLowerCase().includes(query) ||
          store.description?.toLowerCase().includes(query) ||
          store.category?.toLowerCase().includes(query)
      );
    }

    return storesList;
  }, [searchQuery, selectedCategory, stores]);

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
                <Image source={{ uri: bannerUrl }} style={styles.storeBanner} resizeMode="cover" />
              ) : (
                <LinearGradient
                  colors={[COLORS.accent + '40', COLORS.accent + '10']}
                  style={styles.storeBannerPlaceholder}
                />
              )}

              <View style={styles.storeLogoWrap}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.storeLogo} />
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

                {stats?.total_products > 0 && (
                  <View style={styles.productsCount}>
                    <Ionicons name="cube-outline" size={12} color={COLORS.textMuted} />
                    <Text style={styles.productsCountText}>{stats.total_products}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [navigation, renderStars, statsByStoreId, dynamicStyles.cardWidth]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

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

            <TouchableOpacity style={styles.filterBtn}>
              <Ionicons name="options-outline" size={22} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Barre de recherche flottante */}
        <BlurView intensity={80} tint="light" style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une boutique..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
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
            <TouchableOpacity style={styles.retryButton} onPress={loadStores}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
            ListEmptyComponent={
              <Animated.View entering={FadeIn} style={styles.emptyState}>
                <Ionicons name="storefront-outline" size={80} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Aucune boutique trouvée</Text>
                <Text style={styles.emptyText}>
                  Essayez avec un autre mot-clé ou une autre catégorie
                </Text>
                {(searchQuery || selectedCategory !== 'Toutes') && (
                  <TouchableOpacity
                    style={styles.clearFiltersButton}
                    onPress={() => {
                      setSearchQuery('');
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
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
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
    color: 'white',
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: SPACING.lg,
    height: 52,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
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
    color: 'white',
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
    color: 'white',
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
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
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
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
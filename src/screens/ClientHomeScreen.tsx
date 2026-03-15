import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { StoreCard, ProductCard } from '../components';
import { useResponsive } from '../utils/responsive';
import {
  storeService,
  productService,
  Store,
  Product,
  homeBannerService,
  HomeBanner,
  collectionService,
  Collection,
} from '../lib/supabase';
import { useCartStore } from '../store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const normalizeHexColor = (value?: string | null) => {
  if (!value) return undefined;
  const v = String(value).trim();
  if (!v) return undefined;
  return v.startsWith('#') ? v : `#${v}`;
};

export const ClientHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width, isMobile, isTablet, isDesktop } = useResponsive();
  const { items } = useCartStore();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [selectedCollection, setSelectedCollection] = useState<string>('Toutes');
  
  // Calculer le nombre de colonnes et la largeur des cartes dynamiquement
  const numProductColumns = isDesktop ? 4 : isTablet ? 3 : 2;
  const responsiveProductCardWidth = useMemo(() => {
    const totalHorizontalPadding = SPACING.xl * 2; // paddingHorizontal des deux côtés
    const totalGap = SPACING.md * (numProductColumns - 1); // gap entre colonnes
    return (width - totalHorizontalPadding - totalGap) / numProductColumns;
  }, [width, numProductColumns]);
  
  // Real data states
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [carouselBanners, setCarouselBanners] = useState<HomeBanner[]>([]);
  const [promoBanners, setPromoBanners] = useState<HomeBanner[]>([]);

  // Auto-play carousel
  useEffect(() => {
    const interval = setInterval(() => {
      if (carouselBanners.length > 0) {
        setCurrentBannerIndex((prev) => (prev + 1) % carouselBanners.length);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [currentBannerIndex, carouselBanners.length]);

  // Extract unique categories from collections
  const extractCategoriesFromCollections = (collectionsList: Collection[]) => {
    const uniqueCategories = Array.from(new Set(collectionsList.map(collection => collection.category).filter(Boolean)));
    return ['Toutes', ...uniqueCategories];
  };

  // Filter stores by selected category
  const filteredStores = selectedCollection === 'Toutes' 
    ? stores 
    : stores.filter(store => store.category === selectedCollection);

  // Load data from Supabase
  const loadData = async (refresh = false) => {
    try {
      if (!refresh) setLoading(true);
      setError(null);
      
      // Load featured stores (verified, active)
      const storesData = await storeService.getFeatured();
      setStores(storesData || []);
      
      // Load collections from all stores
      const allCollections: Collection[] = [];
      if (storesData && storesData.length > 0) {
        for (const store of storesData) {
          const storeCollections = await collectionService.getByStore(store.id);
          allCollections.push(...storeCollections);
        }
        setCollections(allCollections);
      }
      
      // Load featured products (active, limit 8)
      const productsData = await productService.search('');
      setProducts((productsData || []).slice(0, 8));

      try {
        const [carousel, promo] = await Promise.all([
          homeBannerService.getActiveByPlacement('carousel'),
          homeBannerService.getActiveByPlacement('promo'),
        ]);
        setCarouselBanners(carousel || []);
        setPromoBanners(promo || []);
      } catch (bannerErr) {
        console.warn('ClientHomeScreen banners unavailable', bannerErr);
        setCarouselBanners([]);
        setPromoBanners([]);
      }
    } catch (e) {
      console.error('ClientHomeScreen loadData error', e);
      setError('Impossible de charger les données');
      Alert.alert('Erreur', 'Impossible de charger les données. Veuillez réessayer.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleBannerPress = (banner: HomeBanner) => {
    const screen = banner.link_screen;
    if (!screen) return;
    navigation.navigate(screen, banner.link_params || undefined);
  };

  const renderBannerItem = ({ item, index }: { item: HomeBanner; index: number }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
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
        style={{ width: SCREEN_WIDTH - SPACING.xl * 2 }}
      >
        <Animated.View style={[styles.bannerCard, { transform: [{ scale }], opacity }]}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.bannerImage} />
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
  };

  const renderCategoryChip = (category: string) => {
    const isActive = selectedCollection === category;
    return (
      <TouchableOpacity
        key={category}
        style={[styles.categoryChip, isActive && styles.categoryChipActive]}
        onPress={() => setSelectedCollection(category)}
      >
        <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
          {category}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderStoreCard = ({ item }: { item: Store }) => (
    <StoreCard
      name={item.name}
      category={item.category}
      description={item.description}
      logoUrl={item.logo_url}
      onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}
    />
  );

  const renderProductCard = ({ item }: { item: Product }) => (
    <View style={[styles.productCardWrapper, { width: responsiveProductCardWidth }]}>
      <ProductCard
        name={item.name}
        price={item.price}
        imageUrl={item.images?.[0]}
        onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
      />
    </View>
  );

  // Calcul des dimensions responsive
  const storeCardWidth = isDesktop ? 220 : isTablet ? 200 : 180;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={[COLORS.accent, COLORS.accentDark || COLORS.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>libreshop</Text>
              <Text style={styles.logoSlogan}>Achetez local, vivez mieux</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton}>
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
          <TouchableOpacity 
            style={styles.searchBar}
            onPress={() => navigation.navigate('ClientSearch')}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
            <Text style={styles.searchPlaceholder}>Rechercher un produit, une boutique...</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Loading/Error State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Chargement des meilleures offres...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={64} color={COLORS.danger} />
            <Text style={styles.errorTitle}>Oups !</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content only when not loading */}
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
                    setCurrentBannerIndex(index);
                  }}
                  renderItem={renderBannerItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.bannerList}
                  snapToInterval={SCREEN_WIDTH - SPACING.xl * 2}
                  decelerationRate="fast"
                />

                {/* Pagination Dots */}
                <View style={styles.paginationContainer}>
                  {carouselBanners.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        flatListRef.current?.scrollToIndex({ index, animated: true });
                        setCurrentBannerIndex(index);
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
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={[COLORS.accent + '20', COLORS.accent + '05']}
                  style={styles.quickActionIcon}
                >
                  <Ionicons name="flash" size={24} color={COLORS.accent} />
                </LinearGradient>
                <Text style={styles.quickActionText}>Flash deals</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={[COLORS.success + '20', COLORS.success + '05']}
                  style={styles.quickActionIcon}
                >
                  <Ionicons name="gift" size={24} color={COLORS.success} />
                </LinearGradient>
                <Text style={styles.quickActionText}>Bons plans</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={[COLORS.warning + '20', COLORS.warning + '05']}
                  style={styles.quickActionIcon}
                >
                  <Ionicons name="star" size={24} color={COLORS.warning} />
                </LinearGradient>
                <Text style={styles.quickActionText}>Nouveautés</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={[COLORS.info + '20', COLORS.info + '05']}
                  style={styles.quickActionIcon}
                >
                  <Ionicons name="heart" size={24} color={COLORS.info} />
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
                {extractCategoriesFromCollections(collections).map(renderCategoryChip)}
              </ScrollView>
            </View>

            {/* Trending Stores */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Boutiques en vedette</Text>
                  <Text style={styles.sectionSubtitle}>
                    {filteredStores.length} boutiques {selectedCollection !== 'Toutes' && `dans ${selectedCollection}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('ClientAllStores')}>
                  <Text style={styles.seeAll}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              
              <FlatList
                horizontal
                data={filteredStores}
                renderItem={renderStoreCard}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storesList}
                snapToInterval={storeCardWidth + SPACING.md}
                decelerationRate="fast"
              />
            </View>

            {promoBanners.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handleBannerPress(promoBanners[0])}
              >
                <LinearGradient
                  colors={[
                    normalizeHexColor(promoBanners[0].color) || '#FF6B6B',
                    '#FF8E8E',
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
                    <Image source={{ uri: promoBanners[0].image_url }} style={styles.promoImage} />
                  ) : null}
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            {/* Featured Products */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Produits populaires</Text>
                  <Text style={styles.sectionSubtitle}>Les tendances du moment</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('ClientAllProducts')}>
                  <Text style={styles.seeAll}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={products}
                renderItem={renderProductCard}
                keyExtractor={(item) => item.id}
                numColumns={numProductColumns}
                scrollEnabled={false}
                columnWrapperStyle={styles.productsGrid}
                contentContainerStyle={styles.productsList}
              />
            </View>

            {/* Newsletter */}
            <BlurView intensity={80} tint="light" style={styles.newsletterSection}>
              <Text style={styles.newsletterTitle}>Ne manquez aucune offre</Text>
              <Text style={styles.newsletterText}>
                Inscrivez-vous à notre newsletter et recevez -10% sur votre première commande
              </Text>
              <TouchableOpacity style={styles.newsletterButton}>
                <Text style={styles.newsletterButtonText}>S'inscrire</Text>
                <Ionicons name="mail-outline" size={18} color="white" />
              </TouchableOpacity>
            </BlurView>

            {/* Load More */}
            <View style={styles.loadMoreContainer}>
              <TouchableOpacity style={styles.loadMoreButton}>
                <Ionicons name="refresh" size={16} color={COLORS.accent} />
                <Text style={styles.loadMoreText}>Charger plus de produits</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
    color: 'white',
    letterSpacing: 0.5,
  },
  logoSlogan: {
    fontSize: FONT_SIZE.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
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
    backgroundColor: COLORS.danger,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
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
    backgroundColor: COLORS.card,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 8px rgba(0,0,0,0.2)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
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
    color: 'white',
    marginBottom: 4,
    ...(Platform.OS === 'web'
      ? { textShadow: '0px 1px 2px rgba(0,0,0,0.3)' }
      : {
          textShadowColor: 'rgba(0,0,0,0.3)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }),
  },
  bannerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: SPACING.sm,
    ...(Platform.OS === 'web'
      ? { textShadow: '0px 1px 2px rgba(0,0,0,0.3)' }
      : {
          textShadowColor: 'rgba(0,0,0,0.3)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
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
    color: 'white',
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
    backgroundColor: COLORS.border,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: COLORS.accent,
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
    color: COLORS.text,
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
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  seeAll: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
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
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryChipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.textSoft,
  },
  categoryChipTextActive: {
    color: 'white',
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
    justifyContent: 'space-between',
  },
  productCardWrapper: {
    // Largeur calculée dynamiquement dans renderProductCard
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
    color: 'white',
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
    color: 'white',
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
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  newsletterTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  newsletterText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  newsletterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
  },
  newsletterButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: 'white',
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
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadMoreText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.accent,
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
    color: COLORS.textMuted,
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
    color: COLORS.text,
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
});

export default ClientHomeScreen;
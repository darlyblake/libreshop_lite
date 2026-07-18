import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
  InteractionManager,
  ScrollView,
  Dimensions,
  Alert,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useCartStore, useAuthStore } from '../store';
import { useClientHomeState } from '../hooks/useClientHomeState';
import { ProductCard, ProductCardSkeleton, StoreCard, StoreCardSkeleton } from '../components';
import OptimizedImage from '../components/OptimizedImage';
import { useResponsive } from '../utils/responsive';
import { storeService } from '../services/storeService';
import { cloudinaryService } from '../services/cloudinaryService';
import { useNotificationStore } from '../store/notificationStore';

// No MAX_CONTENT_WIDTH anymore

const CATEGORIES = [
  { name: 'Produits', emoji: '🛍️', bg: '#f4e8ff' },
  { name: 'Restaurants', emoji: '🍽️', bg: '#fef3c7' },
  { name: 'Hôtels', emoji: '🏨', bg: '#e0e7ff' },
  { name: 'Immobilier', emoji: '🏠', bg: '#dcfce7' },
  { name: 'Boutiques', emoji: '🏬', bg: '#ffe4e6' },
  { name: 'Bars', emoji: '🍻', bg: '#ffedd5' },
];

const BeautifulStoreCard = ({ store, onPress, width, palette, RADIUS, SPACING, FONT_SIZE }: any) => {
  const stats = Array.isArray(store.store_stats) ? store.store_stats[0] : store.store_stats;
  const ratingAvg = stats?.rating_avg ?? 0;
  const ratingCount = stats?.rating_count ?? 0;
  const logoUrl = store.logo_url || store.logo;
  const bannerUrl = store.banner_url || store.banner;

  const renderStars = (avg: number) => {
    const safe = Number.isFinite(avg) ? Math.max(0, Math.min(5, avg)) : 0;
    const full = Math.floor(safe);
    const half = safe - full >= 0.5;
    
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        {[...Array(5)].map((_, i) => {
          if (i < full) return <Ionicons key={i} name="star" size={12} color="#f59e0b" />;
          if (i === full && half) return <Ionicons key={i} name="star-half" size={12} color="#f59e0b" />;
          return <Ionicons key={i} name="star-outline" size={12} color={palette.textMuted} />;
        })}
      </View>
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={store.isNavigating}
      style={{
        width,
        backgroundColor: palette.card,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: palette.border,
        overflow: 'hidden',
        ...(Platform.OS === 'web' ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.05)' } : { elevation: 2 })
      }}
      onPress={onPress}
    >
      <View style={{ height: 90, width: '100%', position: 'relative' }}>
        {bannerUrl ? (
          <OptimizedImage source={{ uri: cloudinaryService.getOptimizedUrl(bannerUrl, 600) }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: palette.accent + '20' }} />
        )}

        {store.isNavigating && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            <ActivityIndicator size="large" color={palette.accent} />
          </View>
        )}

        <View style={{
          position: 'absolute', left: SPACING.md, bottom: -20, width: 48, height: 48, borderRadius: 24,
          borderWidth: 3, borderColor: palette.card, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}>
          {logoUrl ? (
            <OptimizedImage source={{ uri: cloudinaryService.getOptimizedUrl(logoUrl, 150) }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Ionicons name="storefront" size={20} color={palette.accent} />
          )}
        </View>

        {store.verified && (
          <View style={{ position: 'absolute', top: SPACING.sm, right: SPACING.sm, backgroundColor: palette.card, borderRadius: 12, padding: 2 }}>
            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: SPACING.md, paddingTop: 28, paddingBottom: SPACING.md }}>
        <Text numberOfLines={1} style={{ fontSize: FONT_SIZE.md, fontWeight: '700', color: palette.text, marginBottom: 2 }}>
          {store.name || 'Boutique'}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: FONT_SIZE.xs, color: palette.accent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.xs }}>
          {store.category || 'Général'}
        </Text>
        <Text numberOfLines={2} style={{ fontSize: FONT_SIZE.xs, color: palette.textSoft, lineHeight: 16, marginBottom: SPACING.sm, height: 32 }}>
          {store.description || ' '}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {renderStars(ratingAvg)}
            <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: '700', color: palette.text, marginLeft: 2 }}>
              {ratingAvg ? ratingAvg.toFixed(1) : '0.0'}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.xs, color: palette.textMuted }}>({ratingCount})</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const ClientHomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { width } = useResponsive();
  const { items } = useCartStore();
  const { user } = useAuthStore();
  const { spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE, getColor: palette } = useTheme();
  
  const { state, dispatch } = useClientHomeState();

  const [isReady, setIsReady] = useState(false);
  const [topStores, setTopStores] = useState<any[]>([]);
  const [allPopularStores, setAllPopularStores] = useState<any[]>([]);
  const [storesPage, setStoresPage] = useState(0);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingMoreStores, setLoadingMoreStores] = useState(false);
  const [navigatingState, setNavigatingState] = useState<string | null>(null);
  
  const handleNavigate = useCallback((screen: string, params?: any, id?: string) => {
    const navId = id || screen;
    if (navigatingState) return;
    setNavigatingState(navId);
    navigation.navigate(screen, params);
    setTimeout(() => {
      setNavigatingState(null);
    }, 800);
  }, [navigation, navigatingState]);
  
  const clientUnreadCount = useNotificationStore((state) => state.clientUnreadCount);

  const [hasMoreStores, setHasMoreStores] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingToSeller, setSwitchingToSeller] = useState(false);

  const fetchStores = async (pageToLoad: number, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageToLoad === 0) setLoadingStores(true);
      else setLoadingMoreStores(true);

      let sourceList = allPopularStores;
      
      // Load from server on first page or refresh
      if (pageToLoad === 0 || isRefresh || sourceList.length === 0) {
        const data = await storeService.getPopularStores(100);
        sourceList = data || [];
        setAllPopularStores(sourceList);
      }

      // Paginate locally by chunks of 20
      const startIndex = pageToLoad * 20;
      const pageData = sourceList.slice(startIndex, startIndex + 20);

      if (pageToLoad === 0 || isRefresh) {
        setTopStores(pageData);
      } else {
        setTopStores(prev => {
          // Prevent duplicates just in case
          const existingIds = new Set(prev.map(s => s.id));
          const newItems = pageData.filter(s => !existingIds.has(s.id));
          return [...prev, ...newItems];
        });
      }
      
      setHasMoreStores(startIndex + 20 < sourceList.length);
    } catch (e) {
      console.warn('Failed to load top stores', e);
    } finally {
      setLoadingStores(false);
      setLoadingMoreStores(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Diffère légèrement le rendu pour la fluidité (InteractionManager bug parfois sur Web)
    const timer = setTimeout(() => {
      setIsReady(true);
      fetchStores(0);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const numColumns = useMemo(() => {
    if (width >= 1400) return 6;
    if (width >= 1200) return 5;
    if (width >= 900) return 4;
    if (width >= 768) return 3;
    return 2;
  }, [width]);

  const contentWidth = width;
  const cardWidth = useMemo(() => {
    const totalPadding = SPACING.md * 2;
    const totalGap = SPACING.md * (numColumns - 1);
    return Math.max(0, (contentWidth - totalPadding - totalGap) / numColumns);
  }, [contentWidth, numColumns, SPACING]);

  const handleRefresh = useCallback(() => {
    setStoresPage(0);
    fetchStores(0, true);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!loadingMoreStores && hasMoreStores) {
      const nextPage = storesPage + 1;
      setStoresPage(nextPage);
      fetchStores(nextPage);
    }
  }, [loadingMoreStores, hasMoreStores, storesPage]);

  const handleSwitchToSeller = async () => {
    if (switchingToSeller) return;
    
    if (!user) {
      navigation.navigate('SellerAuth');
      return;
    }

    setSwitchingToSeller(true);
    try {
      const stores = await storeService.getStoresByUser(user.id);
      if (stores && stores.length > 0) {
        // If they have a store, go to Hub
        navigation.navigate('SellerTabs');
      } else {
        // Connected but no store: direct them to Auth / Add Store
        navigation.navigate('SellerAuth');
      }
    } catch (error) {
      navigation.navigate('SellerAuth');
    } finally {
      setSwitchingToSeller(false);
    }
  };

  const renderHeader = useCallback(() => {
    return (
      <View style={{ width: '100%' }}>
        {/* Header Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
          <Text style={{ fontSize: FONT_SIZE.xl, fontWeight: '900', color: palette.accent }}>LibreShop</Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            <TouchableOpacity style={{ padding: SPACING.xs }} onPress={handleSwitchToSeller} disabled={switchingToSeller}>
              {switchingToSeller ? (
                <ActivityIndicator size={24} color={palette.textMuted} />
              ) : (
                <Ionicons name="briefcase-outline" size={24} color={palette.textMuted} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: SPACING.xs }} onPress={() => navigation.navigate('ClientMap')}>
              <Ionicons name="location-outline" size={24} color={palette.textMuted} />
            </TouchableOpacity>
            {user && (
              <TouchableOpacity style={{ padding: SPACING.xs, position: 'relative' }} onPress={() => navigation.navigate('Notifications', { context: 'client' })}>
                <Ionicons name="notifications-outline" size={24} color={palette.textMuted} />
                {clientUnreadCount > 0 && (
                  <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: palette.accent, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: palette.bg, paddingHorizontal: 2 }}>
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{clientUnreadCount > 99 ? '99+' : clientUnreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ padding: SPACING.xs }} onPress={() => navigation.navigate('ClientProfile')}>
              <Ionicons name={user ? "person-circle-outline" : "person-outline"} size={user ? 28 : 24} color={palette.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: SPACING.xs, position: 'relative' }} onPress={() => navigation.navigate('Cart')}>
              <Ionicons name="cart-outline" size={24} color={palette.textMuted} />
              {items.length > 0 && (
                <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: palette.accent, borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: palette.bg }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{items.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 48, marginBottom: SPACING.lg, borderWidth: 1, borderColor: palette.border }}>
          <Ionicons name="search-outline" size={20} color={palette.textMuted} />
          <TextInput
            placeholder="Rechercher une boutique, un produit..."
            placeholderTextColor={palette.textMuted}
            style={{ flex: 1, marginLeft: SPACING.sm, color: palette.text, fontSize: FONT_SIZE.md, outlineStyle: 'none' } as any}
            onFocus={() => navigation.navigate('ClientSearch')}
          />
          <TouchableOpacity onPress={() => navigation.navigate('ClientSearch', { startVoice: true })}>
            <Ionicons name="mic-outline" size={22} color={palette.accent} />
          </TouchableOpacity>
        </View>

        {/* Hero Banner */}
        <View style={{ height: 180, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.xl, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.card }}>
          <OptimizedImage source={{ uri: 'https://picsum.photos/id/1015/800/400' }} style={{ position: 'absolute', width: '100%', height: '100%' }} />
          <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: palette.accent, opacity: 0.7 }} />
          <Text style={{ color: 'white', fontSize: FONT_SIZE.xxl, fontWeight: 'bold', textAlign: 'center', marginBottom: SPACING.xs }}>Tout le Gabon, au même endroit</Text>
          <Text style={{ color: 'white', fontSize: FONT_SIZE.md, textAlign: 'center', opacity: 0.9 }}>Boutiques • Restaurants • Hôtels • Logements</Text>
        </View>

        {/* Categories Chips */}
        <View style={{ marginBottom: SPACING.xl }}>
          <Text style={{ fontSize: FONT_SIZE.lg, fontWeight: '700', color: palette.text, marginBottom: SPACING.md, textAlign: 'center' }}>Explorer</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ 
              flexGrow: 1, 
              justifyContent: width >= 768 ? 'center' : 'space-between', 
              gap: width >= 768 ? 48 : SPACING.md, 
              paddingHorizontal: SPACING.md 
            }}
          >
            {CATEGORIES.map((cat, i) => (
              <TouchableOpacity 
                key={i} 
                disabled={!!navigatingState}
                style={{ alignItems: 'center', gap: 8 }}
                onPress={() => {
                  if (cat.name === 'Boutiques') {
                    handleNavigate('ClientAllStores', undefined, cat.name);
                  } else if (cat.name === 'Produits') {
                    handleNavigate('ClientAllProducts', undefined, cat.name);
                  } else {
                    Alert.alert('Bientôt disponible', `La catégorie ${cat.name} sera bientôt disponible !`);
                  }
                }}
              >
                <View style={{ width: 72, height: 72, backgroundColor: cat.bg, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }}>
                  {navigatingState === cat.name ? (
                    <ActivityIndicator color={palette.text} />
                  ) : (
                    <Text style={{ fontSize: 32 }}>{cat.emoji}</Text>
                  )}
                </View>
                <Text style={{ color: palette.text, fontWeight: '600', fontSize: FONT_SIZE.sm }}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
          <Text style={{ fontSize: FONT_SIZE.lg, fontWeight: '700', color: palette.text }}>Top 20 Boutiques</Text>
          <TouchableOpacity disabled={!!navigatingState} onPress={() => handleNavigate('ClientAllStores', undefined, 'voir_plus_boutiques')}>
            {navigatingState === 'voir_plus_boutiques' ? (
               <ActivityIndicator size="small" color={palette.accent} />
            ) : (
               <Text style={{ fontSize: FONT_SIZE.sm, fontWeight: '600', color: palette.accent }}>Voir plus</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [navigation, items.length, palette, SPACING, FONT_SIZE, RADIUS, navigatingState, handleNavigate, clientUnreadCount, user, switchingToSeller, handleSwitchToSeller]);

  // Si l'écran vient de s'ouvrir ou que les données initiales chargent, on affiche un skeleton
  if (!isReady || (loadingStores && topStores.length === 0)) {
    return (
      <ScrollView 
        style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}
        contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 100, alignSelf: 'center', width: '100%' }}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md }}>
          {Array.from({ length: numColumns * 2 }).map((_, i) => (
            <View key={i} style={{ width: cardWidth, marginBottom: SPACING.md }}>
              <StoreCardSkeleton />
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}
      contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100, alignSelf: 'center', width: '100%' }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.accent} />}
      onScroll={({ nativeEvent }) => {
        // Load more when scrolling near bottom
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) {
          handleLoadMore();
        }
      }}
      scrollEventThrottle={400}
    >
      {renderHeader()}
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg }}>
        {topStores.map((store: any) => (
          <BeautifulStoreCard
            key={store.id}
            store={{...store, isNavigating: navigatingState === `store_${store.id}`}}
            width={cardWidth}
            palette={palette}
            RADIUS={RADIUS}
            SPACING={SPACING}
            FONT_SIZE={FONT_SIZE}
            onPress={() => handleNavigate('StoreDetail', { storeId: store.id }, `store_${store.id}`)}
          />
        ))}
      </View>

      {loadingMoreStores && (
        <ActivityIndicator size="large" color={palette.accent} style={{ marginVertical: SPACING.lg }} />
      )}
    </ScrollView>
  );
};
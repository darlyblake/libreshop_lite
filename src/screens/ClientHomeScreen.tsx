import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform, ActivityIndicator, ScrollView, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useCartStore, useAuthStore } from '../store';
import { useClientHomeState } from '../hooks/useClientHomeState';
import { StoreCardSkeleton } from '../components';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import OptimizedImage from '../components/OptimizedImage';
import { useResponsive } from '../utils/responsive';
import { storeService } from '../services/storeService';
import { storeDiscoveryService } from '../services/storeDiscoveryService';
import { cloudinaryService } from '../services/cloudinaryService';
import { useNotificationStore } from '../store/notificationStore';

const CATEGORIES = [
  { name: 'Produits', emoji: '🛍️', bg: '#f4e8ff' },
  { name: 'Restaurants', emoji: '🍽️', bg: '#fef3c7' },
  { name: 'Hôtels', emoji: '🏨', bg: '#e0e7ff' },
  { name: 'Immobilier', emoji: '🏠', bg: '#dcfce7' },
  { name: 'Boutiques', emoji: '🏬', bg: '#ffe4e6' },
  { name: 'Bars', emoji: '🍻', bg: '#ffedd5' },
];

const DISCOVERY_SECTIONS = [
  { key: 'bar', title: 'Coins chauds', subtitle: 'Bars populaires', icon: '🍻' },
  { key: 'restaurant', title: 'Restaurants populaires', subtitle: 'Les mieux classés', icon: '🍽️' },
  { key: 'general', title: 'Boutiques populaires', subtitle: 'Les plus appréciées', icon: '🛍️' },
  { key: 'other', title: 'À découvrir', subtitle: 'Autres activités populaires', icon: '⭐' },
] as const;

const SkeletonBlock = ({ style }: { style?: any }) => (
  <View style={[{ backgroundColor: '#e9edf3', borderRadius: 8 }, style]} />
);

const HomeDiscoverySkeleton = ({ width, palette, SPACING, RADIUS }: any) => {
  const columns = width >= 1400 ? 6 : width >= 1200 ? 5 : width >= 900 ? 4 : width >= 768 ? 3 : 2;
  const cardWidth = Math.max(0, (width - SPACING.md * 2 - SPACING.md * (columns - 1)) / columns);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ paddingTop: SPACING.md, paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl }}
      scrollEnabled={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
        <SkeletonBlock style={{ width: 118, height: 25, borderRadius: 7 }} />
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} style={{ width: 28, height: 28, borderRadius: 14 }} />)}
        </View>
      </View>

      {/* Search */}
      <SkeletonBlock style={{ width: '100%', height: 48, borderRadius: RADIUS.md, marginBottom: SPACING.lg }} />

      {/* Categories */}
      <View style={{ flexDirection: 'row', marginBottom: SPACING.lg }}>
        {CATEGORIES.map((cat) => (
          <View key={cat.name} style={{ width: 54, marginRight: SPACING.md, alignItems: 'center' }}>
            <SkeletonBlock style={{ width: 54, height: 54, borderRadius: 27, marginBottom: SPACING.xs }} />
            <SkeletonBlock style={{ width: 42, height: 9, borderRadius: 5 }} />
          </View>
        ))}
      </View>

      {/* Location line */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
        <SkeletonBlock style={{ width: 16, height: 16, borderRadius: 8, marginRight: 6 }} />
        <SkeletonBlock style={{ width: 175, height: 10, borderRadius: 5 }} />
      </View>

      {/* Same structure as the real Top 20: 4 groups x up to 5 cards */}
      {DISCOVERY_SECTIONS.map((section) => (
        <View key={section.key} style={{ marginBottom: SPACING.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
            <SkeletonBlock style={{ width: 22, height: 22, borderRadius: 11, marginRight: 8 }} />
            <View>
              <SkeletonBlock style={{ width: Math.min(width * 0.55, 210), height: 16, borderRadius: 6, marginBottom: 6 }} />
              <SkeletonBlock style={{ width: 125, height: 9, borderRadius: 5 }} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <View key={index} style={{ width: cardWidth, backgroundColor: palette.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' }}>
                <SkeletonBlock style={{ width: '100%', height: 90, borderRadius: 0 }} />
                <View style={{ paddingHorizontal: SPACING.md, paddingTop: 28, paddingBottom: SPACING.md }}>
                  <SkeletonBlock style={{ width: '78%', height: 13, borderRadius: 5, marginBottom: 8 }} />
                  <SkeletonBlock style={{ width: '52%', height: 9, borderRadius: 5, marginBottom: 9 }} />
                  <SkeletonBlock style={{ width: '92%', height: 9, borderRadius: 5, marginBottom: 5 }} />
                  <SkeletonBlock style={{ width: '65%', height: 9, borderRadius: 5, marginBottom: 12 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <SkeletonBlock style={{ width: 62, height: 10, borderRadius: 5, marginRight: 7 }} />
                    <SkeletonBlock style={{ width: 25, height: 10, borderRadius: 5 }} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const BeautifulStoreCard = ({ store, onPress, width, palette, RADIUS, SPACING, FONT_SIZE }: any) => {
  const stats = Array.isArray(store.store_stats) ? store.store_stats[0] : store.store_stats;
  const ratingAvg = stats?.rating_avg ?? store.rating_avg ?? 0;
  const ratingCount = stats?.rating_count ?? store.rating_count ?? 0;
  const logoUrl = store.logo_url || store.logo;
  const bannerUrl = store.banner_url || store.banner;
  const safeRating = Number.isFinite(Number(ratingAvg)) ? Math.max(0, Math.min(5, Number(ratingAvg))) : 0;
  const full = Math.floor(safeRating);
  const half = safeRating - full >= 0.5;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={store.isNavigating}
      style={{ width, backgroundColor: palette.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', ...(Platform.OS === 'web' ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.05)' } : { elevation: 2 }) }}
      onPress={onPress}
    >
      <View style={{ height: 90, width: '100%', position: 'relative' }}>
        {bannerUrl ? <OptimizedImage source={{ uri: cloudinaryService.getOptimizedUrl(bannerUrl, 600) }} style={{ width: '100%', height: '100%' }} /> : <View style={{ width: '100%', height: '100%', backgroundColor: palette.accent + '20' }} />}
        {store.isNavigating && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}><ActivityIndicator size="large" color={palette.accent} /></View>}
        <View style={{ position: 'absolute', left: SPACING.md, bottom: -20, width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: palette.card, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {logoUrl ? <OptimizedImage source={{ uri: cloudinaryService.getOptimizedUrl(logoUrl, 150) }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="storefront" size={20} color={palette.accent} />}
        </View>
        {store.verified && <View style={{ position: 'absolute', top: SPACING.sm, right: SPACING.sm, backgroundColor: palette.card, borderRadius: 12, padding: 2 }}><Ionicons name="checkmark-circle" size={16} color="#3b82f6" /></View>}
      </View>
      <View style={{ paddingHorizontal: SPACING.md, paddingTop: 28, paddingBottom: SPACING.md }}>
        <Text numberOfLines={1} style={{ fontSize: FONT_SIZE.md, fontWeight: '700', color: palette.text, marginBottom: 2 }}>{store.name || 'Boutique'}</Text>
        <Text numberOfLines={1} style={{ fontSize: FONT_SIZE.xs, color: palette.accent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.xs }}>{store.category || 'Général'}</Text>
        <Text numberOfLines={2} style={{ fontSize: FONT_SIZE.xs, color: palette.textSoft, lineHeight: 16, marginBottom: SPACING.sm, height: 32 }}>{store.description || ' '}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            {[...Array(5)].map((_, i) => i < full ? <Ionicons key={i} name="star" size={12} color="#f59e0b" /> : (i === full && half ? <Ionicons key={i} name="star-half" size={12} color="#f59e0b" /> : <Ionicons key={i} name="star-outline" size={12} color={palette.textMuted} />))}
          </View>
          <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: '700', color: palette.text, marginLeft: 4 }}>{safeRating ? safeRating.toFixed(1) : '0.0'}</Text>
          <Text style={{ fontSize: FONT_SIZE.xs, color: palette.textMuted, marginLeft: 3 }}>({ratingCount})</Text>
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
  const [discoveryGroups, setDiscoveryGroups] = useState<Record<string, any[]>>({ bar: [], restaurant: [], general: [], other: [] });
  const [discoveryLocation, setDiscoveryLocation] = useState<{ cityName: string | null; countryName: string | null }>({ cityName: null, countryName: null });
  const [loadingStores, setLoadingStores] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [navigatingState, setNavigatingState] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingToSeller, setSwitchingToSeller] = useState(false);
  const clientUnreadCount = useNotificationStore((state) => state.clientUnreadCount);

  const handleNavigate = useCallback((screen: string, params?: any, id?: string) => {
    const navId = id || screen;
    if (navigatingState) return;
    setNavigatingState(navId);
    navigation.navigate(screen, params);
    setTimeout(() => setNavigatingState(null), 800);
  }, [navigation, navigatingState]);

  const fetchStores = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoadingStores(true);
      const result = await storeDiscoveryService.getHomeTopStores();
      setTopStores(result.stores.slice(0, 20));
      setDiscoveryGroups(result.groups);
      setDiscoveryLocation({ cityName: result.location.cityName, countryName: result.location.countryName });
    } catch (e) {
      console.warn('Failed to load location-aware top stores', e);
      try {
        const fallback = await storeService.getPopularStores(20);
        setTopStores(fallback || []);
        setDiscoveryGroups({ bar: (fallback || []).filter((s: any) => s.discovery_group === 'bar').slice(0, 5), restaurant: (fallback || []).filter((s: any) => s.discovery_group === 'restaurant').slice(0, 5), general: (fallback || []).filter((s: any) => s.discovery_group === 'general').slice(0, 5), other: (fallback || []).filter((s: any) => !['bar', 'restaurant', 'general'].includes(s.discovery_group)).slice(0, 5) });
      } catch (fallbackError) {
        console.warn('Fallback store discovery failed', fallbackError);
      }
    } finally {
      setLoadingStores(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { setIsReady(true); fetchStores(); }, 50);
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

  const handleRefresh = useCallback(() => { fetchStores(true); }, []);

  const handleSwitchToSeller = async () => {
    if (switchingToSeller) return;
    if (!user) { navigation.navigate('SellerAuth'); return; }
    setSwitchingToSeller(true);
    try {
      const stores = await storeService.getStoresByUser(user.id);
      if (stores && stores.length > 0) navigation.navigate('SellerTabs'); else navigation.navigate('SellerAuth');
    } catch (error) { navigation.navigate('SellerAuth'); } finally { setSwitchingToSeller(false); }
  };

  const renderHeader = useCallback(() => (
    <View style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
        <Text style={{ fontSize: FONT_SIZE.xl, fontWeight: '900', color: palette.accent }}>LibreShop</Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <TouchableOpacity style={{ padding: SPACING.xs }} onPress={handleSwitchToSeller} disabled={switchingToSeller}>{switchingToSeller ? <ActivityIndicator size={24} color={palette.textMuted} /> : <Ionicons name="briefcase-outline" size={24} color={palette.textMuted} />}</TouchableOpacity>
          <TouchableOpacity style={{ padding: SPACING.xs }} onPress={() => setShowScanner(true)}><Ionicons name="qr-code-outline" size={24} color={palette.textMuted} /></TouchableOpacity>
          <TouchableOpacity style={{ padding: SPACING.xs }} onPress={() => navigation.navigate('ClientMap')}><Ionicons name="location-outline" size={24} color={palette.textMuted} /></TouchableOpacity>
          {user && <TouchableOpacity style={{ padding: SPACING.xs, position: 'relative' }} onPress={() => navigation.navigate('Notifications', { context: 'client' })}><Ionicons name="notifications-outline" size={24} color={palette.textMuted} />{clientUnreadCount > 0 && <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: palette.accent, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: palette.bg, paddingHorizontal: 2 }}><Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{clientUnreadCount > 99 ? '99+' : clientUnreadCount}</Text></View>}</TouchableOpacity>}
          <TouchableOpacity style={{ padding: SPACING.xs }} onPress={() => navigation.navigate('ClientProfile')}><Ionicons name={user ? 'person-circle-outline' : 'person-outline'} size={user ? 28 : 24} color={palette.textMuted} /></TouchableOpacity>
          <TouchableOpacity style={{ padding: SPACING.xs, position: 'relative' }} onPress={() => navigation.navigate('Cart')}><Ionicons name="cart-outline" size={24} color={palette.textMuted} />{items.length > 0 && <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: palette.accent, borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: palette.bg }}><Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{items.length}</Text></View>}</TouchableOpacity>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 48, marginBottom: SPACING.lg, borderWidth: 1, borderColor: palette.border }}>
        <Ionicons name="search-outline" size={20} color={palette.textMuted} />
        <TextInput placeholder="Rechercher une boutique, un produit..." placeholderTextColor={palette.textMuted} style={{ flex: 1, marginLeft: SPACING.sm, color: palette.text, fontSize: FONT_SIZE.md, outlineStyle: 'none' } as any} onFocus={() => navigation.navigate('ClientSearch')} />
        <TouchableOpacity onPress={() => navigation.navigate('ClientSearch', { startVoice: true })}><Ionicons name="mic-outline" size={22} color={palette.accent} /></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.lg }}>
        {CATEGORIES.map((cat) => <TouchableOpacity key={cat.name} onPress={() => navigation.navigate('ClientSearch', { category: cat.name })} style={{ alignItems: 'center', marginRight: SPACING.md }}><View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: cat.bg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs }}><Text style={{ fontSize: 24 }}>{cat.emoji}</Text></View><Text style={{ fontSize: FONT_SIZE.xs, color: palette.text, fontWeight: '600' }}>{cat.name}</Text></TouchableOpacity>)}
      </ScrollView>
      {discoveryLocation.cityName && <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}><Ionicons name="location" size={15} color={palette.accent} /><Text style={{ marginLeft: 5, fontSize: FONT_SIZE.xs, color: palette.textSoft, fontWeight: '600' }}>Populaire près de {discoveryLocation.cityName}{discoveryLocation.countryName ? `, ${discoveryLocation.countryName}` : ''}</Text></View>}
    </View>
  ), [SPACING, FONT_SIZE, palette, handleSwitchToSeller, switchingToSeller, user, clientUnreadCount, items.length, navigation, discoveryLocation]);

  const renderSection = (section: typeof DISCOVERY_SECTIONS[number]) => {
    const stores = discoveryGroups[section.key] || [];
    if (!stores.length) return null;
    return (
      <View key={section.key} style={{ marginBottom: SPACING.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
          <Text style={{ fontSize: 20, marginRight: 7 }}>{section.icon}</Text>
          <View><Text style={{ fontSize: FONT_SIZE.lg, fontWeight: '800', color: palette.text }}>{section.title}</Text><Text style={{ fontSize: FONT_SIZE.xs, color: palette.textMuted }}>{section.subtitle} · {stores.length}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md }}>
          {stores.slice(0, 5).map((store: any) => <BeautifulStoreCard key={store.id} store={{ ...store, isNavigating: navigatingState === `store_${store.id}` }} width={cardWidth} palette={palette} RADIUS={RADIUS} SPACING={SPACING} FONT_SIZE={FONT_SIZE} onPress={() => handleNavigate('StoreDetail', { storeId: store.id }, `store_${store.id}`)} />)}
        </View>
      </View>
    );
  };

  if (!isReady || loadingStores) {
    return <HomeDiscoverySkeleton width={width} palette={palette} SPACING={SPACING} RADIUS={RADIUS} />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ paddingTop: insets.top + SPACING.md, paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + SPACING.xl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />} scrollEventThrottle={400}>
      {renderHeader()}
      {DISCOVERY_SECTIONS.map(renderSection)}
      <BarcodeScannerModal visible={showScanner} onClose={() => setShowScanner(false)} hintText="Scannez le QR code de la table ou de la boutique" onScan={(data) => {
        setShowScanner(false);
        try {
          const url = new URL(data);
          if (url.hostname.includes('libreshop') || url.hostname === 'localhost') {
            const path = url.pathname;
            if (path.startsWith('/onsite/')) { const token = path.split('/onsite/')[1]; if (token) { navigation.navigate('OnsiteMenu', { token }); return; } }
            if (path.includes('/live')) { const onsiteToken = url.searchParams.get('token'); if (onsiteToken) { navigation.navigate('OnsiteMenu', { token: onsiteToken }); return; } Alert.alert('QR périmé', 'Ce QR code est ancien. Demandez au responsable de générer un nouveau QR sécurisé.'); return; }
          }
          if (Platform.OS === 'web') window.location.href = data; else import('react-native').then(({ Linking }) => Linking.openURL(data).catch(() => Alert.alert('Erreur', 'Lien non supporté.')));
        } catch (e) { Alert.alert('Erreur', 'Code invalide.'); }
      }} />
    </ScrollView>
  );
};
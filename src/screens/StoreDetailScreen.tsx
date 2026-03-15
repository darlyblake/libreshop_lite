import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ExpoLinking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { ProductCard, FollowButton } from '../components';
import { collectionService, productService, storeFollowerService, storeService, storeStatsService } from '../lib/supabase';
import { shopFollowService } from '../lib/shopFollowService';
import { useAuthStore } from '../store';

const { width } = Dimensions.get('window');

// Mock data
const STORE_DATA = {
  id: '1',
  name: 'Tech Store',
  category: 'Électronique',
  logoUrl: 'https://picsum.photos/200?5',
  bannerUrl: 'https://picsum.photos/800?100',
  description: 'Votre destination pour les dernières technologies. Smartphones, ordinateurs, accessoires et gadgets innovants.',
  products: 48,
  rating: 4.8,
  customers: '2k+',
  verified: true,
  promoEnabled: false,
  promoTitle: '',
  promoSubtitle: '',
  promoImageUrl: '',
  promoTargetType: null,
  promoTargetId: null,
  promoTargetUrl: null,
};

const FALLBACK_BANNER = 'https://picsum.photos/800?100';
const FALLBACK_LOGO = 'https://picsum.photos/200?5';
const FALLBACK_PRODUCT_IMAGE = 'https://picsum.photos/400?15';

export const StoreDetailScreen: React.FC = () => {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('Tous');
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { storeId: storeIdParam, slug: slugParam } = route.params || {};
  const { user } = useAuthStore();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [storeStats, setStoreStats] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedStoreIdFromUrl = useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get('storeId');
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const effectiveSlug = useMemo(() => {
    const s = slugParam != null ? String(slugParam) : '';
    if (!s) return null;
    if (s === 'undefined' || s === 'null') return null;
    return s;
  }, [slugParam]);

  const effectiveStoreId = useMemo(() => {
    const fromParams = storeIdParam != null ? String(storeIdParam) : '';
    if (fromParams) return fromParams;
    if (parsedStoreIdFromUrl) return String(parsedStoreIdFromUrl);
    return null;
  }, [storeIdParam, parsedStoreIdFromUrl]);

  const loadStore = useCallback(async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      let s: any = null;

      if (effectiveSlug) {
        s = await storeService.getBySlug(effectiveSlug);
      } else if (effectiveStoreId) {
        s = await storeService.getById(effectiveStoreId);
      } else {
        setErrorMsg("Lien invalide: impossible de trouver l'identifiant de la boutique.");
        setStore(null);
        setProducts([]);
        return;
      }

      setStore(s);

      const storeIdForProducts = s?.id || effectiveStoreId;
      if (storeIdForProducts) {
        const [p, c, stats] = await Promise.all([
          productService.getByStoreAvailable(String(storeIdForProducts)),
          collectionService.getByStore(String(storeIdForProducts)),
          storeStatsService.getByStore(String(storeIdForProducts)).catch(() => null),
        ]);
        const nextProducts = Array.isArray(p) ? p : [];
        setProducts(nextProducts);
        setCollections(Array.isArray(c) ? c : []);

        setStoreStats(stats);

        if (user?.id) {
          const following = await storeFollowerService
            .isFollowing(String(storeIdForProducts), String(user.id))
            .catch(() => false);
          setIsFollowing(Boolean(following));
        } else {
          setIsFollowing(false);
        }
      } else {
        setProducts([]);
        setCollections([]);
        setStoreStats(null);
        setIsFollowing(false);
      }
    } catch (e: any) {
      console.warn('failed to load store', e);
      setErrorMsg(
        e?.message
          ? String(e.message)
          : "Impossible de charger cette boutique. Vérifie la connexion et les règles RLS (Supabase)."
      );
      setStore(null);
      setProducts([]);
      setCollections([]);
      setStoreStats(null);
      setIsFollowing(false);
    } finally {
      setLoading(false);
    }
  }, [effectiveSlug, effectiveStoreId, user?.id]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!mounted) return;
      await loadStore();
    })();
    return () => {
      mounted = false;
    };
  }, [loadStore]);

  const storeData = store
    ? {
        name: store.name || STORE_DATA.name,
        category: store.category || '',
        logoUrl: store.logo_url || FALLBACK_LOGO,
        bannerUrl: store.banner_url || FALLBACK_BANNER,
        description: store.description || '',
        phone: (store as any).phone,
        verified: Boolean((store as any)?.verified),
        promoEnabled: Boolean((store as any)?.promo_enabled),
        promoTitle: String((store as any)?.promo_title || ''),
        promoSubtitle: String((store as any)?.promo_subtitle || ''),
        promoImageUrl: String((store as any)?.promo_image_url || ''),
        promoTargetType: (store as any)?.promo_target_type as any,
        promoTargetId: (store as any)?.promo_target_id ? String((store as any).promo_target_id) : null,
        promoTargetUrl: (store as any)?.promo_target_url ? String((store as any).promo_target_url) : null,
      }
    : STORE_DATA;

  const collectionFilters = useMemo(() => {
    return [
      { id: 'Tous', name: 'Tous' },
      { id: '__new__', name: 'Nouveautés' },
      { id: '__trend__', name: 'Tendances' },
      ...(collections || []).map((c: any) => ({ id: String(c?.id), name: String(c?.name || 'Collection') })),
    ];
  }, [collections]);

  const filteredProducts = useMemo(() => {
    if (selectedCollectionId === 'Tous' || selectedCollectionId === '__new__' || selectedCollectionId === '__trend__') {
      return products;
    }
    return (products || []).filter((p) => String((p as any)?.collection_id || '') === selectedCollectionId);
  }, [products, selectedCollectionId]);

  const newestProducts = useMemo(() => {
    return [...(filteredProducts || [])].sort((a: any, b: any) => {
      const da = new Date(String(a?.created_at || 0)).getTime();
      const db = new Date(String(b?.created_at || 0)).getTime();
      return db - da;
    });
  }, [filteredProducts]);

  const trendingProducts = useMemo(() => {
    // If we don't have per-product popularity signals yet, fallback to recency updates
    return [...(filteredProducts || [])].sort((a: any, b: any) => {
      const da = new Date(String(a?.updated_at || a?.created_at || 0)).getTime();
      const db = new Date(String(b?.updated_at || b?.created_at || 0)).getTime();
      return db - da;
    });
  }, [filteredProducts]);

  const displayedProducts = useMemo(() => {
    if (selectedCollectionId === '__new__') return newestProducts;
    if (selectedCollectionId === '__trend__') return trendingProducts;
    return filteredProducts;
  }, [newestProducts, trendingProducts, filteredProducts, selectedCollectionId]);

  const productsTitle = useMemo(() => {
    if (selectedCollectionId === '__new__') return 'Nouveautés';
    if (selectedCollectionId === '__trend__') return 'Tendances';
    return 'Produits';
  }, [selectedCollectionId]);

  const handleShareStore = useCallback(async () => {
    try {
      if (!store?.id) return;

      const slug = store?.slug && String(store.slug) !== 'undefined' ? String(store.slug) : 'undefined';
      const link = ExpoLinking.createURL(`/store/${slug}`, {
        queryParams: { storeId: String(store.id) },
      });

      if (Platform.OS === 'web') {
        try {
          const nav: any = typeof navigator !== 'undefined' ? navigator : null;
          if (nav?.clipboard?.writeText) {
            await nav.clipboard.writeText(link);
            Alert.alert('Lien copié', 'Le lien de la boutique a été copié dans le presse-papiers.');
            return;
          }
        } catch {}

        try {
          const w: any = typeof window !== 'undefined' ? window : null;
          if (w?.prompt) {
            w.prompt('Copiez le lien de la boutique :', link);
            return;
          }
        } catch {}
      }

      await Share.share({ message: link });
    } catch (e) {
      console.warn('share failed', e);
    }
  }, [store]);

  const handlePromoPress = useCallback(async () => {
    if (!storeData?.promoEnabled) return;
    const t = String(storeData?.promoTargetType || '');
    if (t === 'collection') {
      const id = storeData?.promoTargetId;
      if (id) setSelectedCollectionId(String(id));
      return;
    }
    if (t === 'product') {
      const id = storeData?.promoTargetId;
      if (id) navigation.navigate('ProductDetail', { productId: String(id) });
      return;
    }
    if (t === 'url') {
      const url = storeData?.promoTargetUrl;
      if (url) {
        await Linking.openURL(String(url));
      }
    }
  }, [navigation, storeData]);

  const shouldShowPromo = useMemo(() => {
    if (!storeData?.promoEnabled) return false;
    const hasContent = Boolean(
      String(storeData?.promoTitle || '').trim() ||
        String(storeData?.promoSubtitle || '').trim() ||
        String(storeData?.promoImageUrl || '').trim()
    );
    return hasContent;
  }, [storeData]);

  const handleToggleFollow = useCallback(async () => {
    if (!store?.id) return;
    if (!user?.id) {
      Alert.alert('Connexion requise', 'Connecte-toi pour suivre cette boutique.');
      return;
    }
    if (followBusy) return;

    setFollowBusy(true);
    try {
      if (isFollowing) {
        await storeFollowerService.unfollow(String(store.id), String(user.id));
        setIsFollowing(false);
      } else {
        await storeFollowerService.follow(String(store.id), String(user.id));
        setIsFollowing(true);
      }
      const nextStats = await storeStatsService.getByStore(String(store.id)).catch(() => null);
      setStoreStats(nextStats);
    } catch (e: any) {
      Alert.alert('Erreur', String(e?.message || 'Action impossible'));
    } finally {
      setFollowBusy(false);
    }
  }, [store?.id, user?.id, isFollowing, followBusy]);

  const handleWhatsAppContact = async () => {
    const raw = String((store as any)?.phone || (storeData as any)?.phone || '').trim();
    if (!raw) {
      Alert.alert('WhatsApp', "Cette boutique n'a pas de numéro WhatsApp renseigné.");
      return;
    }

    const cleaned = raw.replace(/[^\d+]/g, '');
    const waNumber = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
    if (!waNumber) {
      Alert.alert('WhatsApp', "Numéro WhatsApp invalide.");
      return;
    }

    const url = `https://wa.me/${waNumber}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('WhatsApp', "Impossible d'ouvrir WhatsApp sur cet appareil.");
      return;
    }
    await Linking.openURL(url);
  };

  const mapProductToCard = useCallback(
    (p: any) => {
      const images = Array.isArray(p?.images) ? p.images : [];
      const imageUrl =
        p?.image_url ||
        p?.imageUrl ||
        images?.[0] ||
        FALLBACK_PRODUCT_IMAGE;

      return {
        id: String(p?.id),
        name: String(p?.name || 'Produit'),
        price: Number(p?.price || 0),
        comparePrice: (p as any)?.compare_price ?? p?.compare_price,
        imageUrl: String(imageUrl),
      };
    },
    []
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('ClientTabs', { screen: 'ClientHome' })}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Boutique</Text>
        <TouchableOpacity style={styles.cartButton} onPress={handleShareStore}>
          <Ionicons name="share-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={{ paddingTop: 120, paddingBottom: 20, alignItems: 'center' }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        )}

        {!!errorMsg && !loading && (
          <View style={{ paddingHorizontal: SPACING.xl, paddingTop: 120, paddingBottom: SPACING.lg }}>
            <Text style={{ color: COLORS.danger, textAlign: 'center' }}>{errorMsg}</Text>
          </View>
        )}
        {/* Store Banner */}
        <View style={styles.storeBanner}>
          <Image source={{ uri: storeData.bannerUrl }} style={styles.bannerImage} resizeMode="cover" />
          <View style={styles.bannerOverlay} />
        </View>

        {/* Store Info */}
        <View style={styles.storeInfo}>
          <View style={styles.logoContainer}>
            <Image source={{ uri: storeData.logoUrl }} style={styles.storeLogo} />
          </View>
          
          <View style={styles.storeDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.storeName}>{storeData.name}</Text>
              {storeData.verified && (
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              )}
            </View>
            {!!storeData.category && <Text style={styles.storeCategory}>{storeData.category}</Text>}
            {!!storeData.description && <Text style={styles.storeDescription}>{storeData.description}</Text>}
            
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{(products?.length || 0).toLocaleString('fr-FR')}</Text>
                <Text style={styles.statLabel}>Produits</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {typeof storeStats?.rating_avg === 'number'
                    ? Number(storeStats.rating_avg).toFixed(1)
                    : '-'}
                </Text>
                <Text style={styles.statLabel}>Note</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {typeof storeStats?.followers_count === 'number'
                    ? Number(storeStats.followers_count).toLocaleString('fr-FR')
                    : '-'}
                </Text>
                <Text style={styles.statLabel}>Abonnés</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <FollowButton
                userId={user?.id ? String(user.id) : ''}
                storeId={store?.id ? String(store.id) : ''}
                storeName={String(store?.name || 'Boutique')}
              />
              <TouchableOpacity style={styles.secondaryButton} onPress={handleWhatsAppContact}>
                <Ionicons name="logo-whatsapp" size={20} color={COLORS.textSoft} />
                <Text style={styles.secondaryButtonText}>Contacter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {shouldShowPromo && (
          <TouchableOpacity style={styles.promoCard} onPress={handlePromoPress} activeOpacity={0.85}>
            {!!storeData.promoImageUrl && (
              <Image source={{ uri: storeData.promoImageUrl }} style={styles.promoImage} resizeMode="cover" />
            )}
            <View style={styles.promoContent}>
              {!!String(storeData.promoTitle || '').trim() && (
                <Text style={styles.promoTitle}>{String(storeData.promoTitle)}</Text>
              )}
              {!!String(storeData.promoSubtitle || '').trim() && (
                <Text style={styles.promoSubtitle}>{String(storeData.promoSubtitle)}</Text>
              )}
              <View style={styles.promoCtaRow}>
                <Text style={styles.promoCtaText}>Voir l’offre</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Collections */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {collectionFilters.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.categoryButton,
                selectedCollectionId === c.id && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCollectionId(c.id)}
            >
              <Text style={[
                styles.categoryText,
                selectedCollectionId === c.id && styles.categoryTextActive,
              ]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Produits */}
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>{productsTitle}</Text>
          <View style={styles.productsGrid}>
            {displayedProducts.slice(0, 24).map((p) => {
              const product = mapProductToCard(p);
              return (
              <View key={product.id} style={styles.productCardWrapper}>
                <ProductCard
                  name={product.name}
                  price={product.price}
                  comparePrice={product.comparePrice}
                  imageUrl={product.imageUrl}
                  onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
                />
              </View>
              );
            })}
          </View>
        </View>

        {/* Load More */}
        <View style={styles.loadMoreContainer}>
          <TouchableOpacity style={styles.loadMoreButton}>
            <Ionicons name="refresh" size={16} color={COLORS.textSoft} />
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeBanner: {
    height: 150,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  promoCard: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  promoImage: {
    width: '100%',
    height: 120,
  },
  promoContent: {
    padding: SPACING.lg,
  },
  promoTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  promoSubtitle: {
    color: COLORS.textSoft,
    marginTop: 6,
  },
  promoCtaRow: {
    marginTop: SPACING.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  promoCtaText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  storeInfo: {
    paddingHorizontal: SPACING.xl,
    marginTop: -40,
    position: 'relative',
    zIndex: 5,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  storeLogo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: COLORS.accent,
  },
  storeDetails: {
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  storeName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  storeCategory: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.xs,
  },
  storeDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xxl,
    marginTop: SPACING.lg,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.textSoft,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  categoriesContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  categoryButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.textSoft,
  },
  categoryTextActive: {
    color: COLORS.white,
  },
  productsSection: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  productCardWrapper: {
    width: width < 500 ? (width - SPACING.xl * 2 - SPACING.md * 6) / 3 - SPACING.sm : width < 800 ? (width - SPACING.xl * 2 - SPACING.md * 4) / 5 - SPACING.sm : (width - SPACING.xl * 2 - SPACING.md * 7) / 8 - SPACING.sm,
  },
  loadMoreContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.xxxl,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadMoreText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSoft,
  },
});


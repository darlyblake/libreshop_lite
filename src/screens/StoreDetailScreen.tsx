import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  errorHandler,
  ErrorCategory,
  ErrorSeverity,
} from "../utils/errorHandler";
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
  Platform,
  Share,
  TextInput,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ExpoLinking from "expo-linking";
import { contactStore } from '../services/contactService';
import { openURL } from '../utils/platformUtils';
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../config/theme";
import { ProductCard, FollowButton, StoreHeader, StoreTabs, StoreInfoCard } from "../components";
import { collectionService } from '../services/collectionService';
import { productService } from '../services/productService';
import { storeService } from '../services/storeService';
import { cloudinaryService } from '../services/cloudinaryService';
import { storeStatsService } from '../services/storeStatsService';
import { storeReviewService } from '../services/storeReviewService';
import { useAuthStore } from "../store";
import { useResponsive } from "../utils/responsive";
import { useTheme } from "../hooks/useTheme";

const { width } = Dimensions.get("window");

// Mock data
const STORE_DATA = {
  id: "1",
  name: "Tech Store",
  category: "Électronique",
  logoUrl: "https://picsum.photos/200?5",
  bannerUrl: "https://picsum.photos/800?100",
  description:
    "Votre destination pour les dernières technologies. Smartphones, ordinateurs, accessoires et gadgets innovants.",
  products: 48,
  rating: 4.8,
  customers: "2000+",
  verified: true,
  promoEnabled: false,
  promoTitle: "",
  promoSubtitle: "",
  promoImageUrl: "",
  promoTargetType: null,
  promoTargetId: null,
  promoTargetUrl: null,
};

const FALLBACK_BANNER = "https://picsum.photos/800?100";
const FALLBACK_LOGO = "https://picsum.photos/200?5";
const FALLBACK_PRODUCT_IMAGE = "https://picsum.photos/400?15";
const PAGE_SIZE = 24;

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
const SkeletonBox = ({ style }: { style?: any }) => (
  <View
    style={[{ backgroundColor: COLORS.border, borderRadius: RADIUS.md }, style]}
  />
);

const StoreSkeleton = () => (
  <View>
    {/* Banner skeleton */}
    <SkeletonBox style={{ height: 220 }} />
    {/* Info skeleton */}
    <View style={{ paddingHorizontal: SPACING.xl, marginTop: -40 }}>
      <View style={{ alignItems: "center", marginBottom: SPACING.lg }}>
        <SkeletonBox style={{ width: 100, height: 100, borderRadius: 50 }} />
      </View>
      <View style={{ alignItems: "center", gap: SPACING.sm }}>
        <SkeletonBox style={{ width: 160, height: 22 }} />
        <SkeletonBox style={{ width: 100, height: 14 }} />
        <SkeletonBox style={{ width: "90%", height: 14 }} />
        <SkeletonBox style={{ width: "70%", height: 14 }} />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: SPACING.xxl,
          marginTop: SPACING.lg,
        }}
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ alignItems: "center", gap: 4 }}>
            <SkeletonBox style={{ width: 40, height: 20 }} />
            <SkeletonBox style={{ width: 50, height: 12 }} />
          </View>
        ))}
      </View>
    </View>
    {/* Products skeleton */}
    <View style={{ paddingHorizontal: SPACING.xl, marginTop: SPACING.xl }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.md }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBox
            key={i}
            style={{
              width: (width - SPACING.xl * 2 - SPACING.md * 2) / 3,
              height: 180,
              borderRadius: RADIUS.lg,
            }}
          />
        ))}
      </View>
    </View>
  </View>
);

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRating = ({ avg, count }: { avg: number; count?: number }) => {
  const safe = Number.isFinite(avg) ? Math.max(0, Math.min(5, avg)) : 0;
  const full = Math.floor(safe);
  const half = safe - full >= 0.5;

  return (
    <View style={starStyles.row}>
      {[...Array(5)].map((_, i) => {
        if (i < full)
          return <Ionicons key={i} name="star" size={14} color={COLORS.star} />;
        if (i === full && half)
          return (
            <Ionicons key={i} name="star-half" size={14} color={COLORS.star} />
          );
        return (
          <Ionicons
            key={i}
            name="star-outline"
            size={14}
            color={COLORS.textMuted}
          />
        );
      })}
      <Text style={starStyles.avg}>{safe > 0 ? safe.toFixed(1) : "-"}</Text>
      {typeof count === "number" && count > 0 && (
        <Text style={starStyles.count}>({count})</Text>
      )}
    </View>
  );
};

const starStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3 },
  avg: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "700",
    color: COLORS.text,
    marginLeft: 2,
  },
  count: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const StoreDetailScreen: React.FC = () => {
  const [selectedCollectionId, setSelectedCollectionId] =
    useState<string>("Tous");
  const [activeTab, setActiveTab] = useState<string>("accueil");
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { storeId: storeIdParam, slug: slugParam } = route.params || {};
  const { user } = useAuthStore();
  const { isMobile, isTablet } = useResponsive();
  const { isDark } = useTheme();

  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [homepageProducts, setHomepageProducts] = useState<any[]>([]);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [collections, setCollections] = useState<any[]>([]);
  const [storeStats, setStoreStats] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [storeReviews, setStoreReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const parsedStoreIdFromUrl = useMemo(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get("storeId");
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const effectiveSlug = useMemo(() => {
    const s = slugParam != null ? String(slugParam) : "";
    if (!s) return null;
    if (s === "undefined" || s === "null") return null;
    return s;
  }, [slugParam]);

  const effectiveStoreId = useMemo(() => {
    const fromParams = storeIdParam != null ? String(storeIdParam) : "";
    if (fromParams && fromParams !== "undefined" && fromParams !== "null")
      return fromParams;
    if (
      parsedStoreIdFromUrl &&
      parsedStoreIdFromUrl !== "undefined" &&
      parsedStoreIdFromUrl !== "null"
    )
      return String(parsedStoreIdFromUrl);
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
        setErrorMsg(
          "Lien invalide: impossible de trouver l'identifiant de la boutique.",
        );
        setStore(null);
        setProducts([]);
        return;
      }

      setStore(s);

      // Check following status for current user
      if (user?.id && s?.id) {
        try {
          const following = await storeService.isFollowing(String(user.id), String(s.id));
          setIsFollowing(Boolean(following));
        } catch (e) {
          console.warn('[StoreDetail] could not determine follow status', e);
        }
      } else {
        setIsFollowing(false);
      }

      const storeIdForProducts = s?.id || effectiveStoreId;
      if (storeIdForProducts) {
        const [p, c, stats, reviews] = await Promise.all([
          productService.getByStoreAvailable(String(storeIdForProducts)),
          collectionService.getByStore(String(storeIdForProducts)),
          storeStatsService
            .getByStore(String(storeIdForProducts))
            .catch(() => null),
          storeReviewService.getByStore(String(storeIdForProducts)).catch(() => []),
        ]);
        const nextProducts = Array.isArray(p) ? p : [];
        setProducts(nextProducts);
        setCollections(Array.isArray(c) ? c : []);
        setStoreStats(stats);
        setStoreReviews(Array.isArray(reviews) ? reviews : []);
        setDisplayedCount(PAGE_SIZE);
      } else {
        setProducts([]);
        setCollections([]);
        setStoreStats(null);
        setStoreReviews([]);
      }
    } catch (e: any) {
      errorHandler.handle(
        e,
        "failed to load store",
        ErrorCategory.SYSTEM,
        ErrorSeverity.LOW,
      );
      setErrorMsg(
        e?.message
          ? String(e.message)
          : "Impossible de charger cette boutique. Vérifie la connexion et les règles RLS (Supabase).",
      );
      setStore(null);
      setProducts([]);
      setCollections([]);
      setStoreStats(null);
      setStoreReviews([]);
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

  useEffect(() => {
    let mounted = true;
    const loadHomepageProducts = async () => {
      if (!mounted) return;
      if (!effectiveStoreId) return;
      
      try {
        const products = await productService.getStoreHomepageProducts(effectiveStoreId, 8);
        if (mounted) {
          setHomepageProducts(products);
        }
      } catch (error) {
        console.error('[StoreDetail] Error loading homepage products:', error);
      }
    };
    
    loadHomepageProducts();
    return () => {
      mounted = false;
    };
  }, [effectiveStoreId]);

  const storeData = store
    ? {
        name: store.name || STORE_DATA.name,
        category: store.category || "",
        logoUrl: store.logo_url || FALLBACK_LOGO,
        bannerUrl: store.banner_url || FALLBACK_BANNER,
        description: store.description || "",
        phone: (store as any).phone,
        verified: Boolean((store as any)?.verified),
        promoEnabled: Boolean((store as any)?.promo_enabled),
        promoTitle: String((store as any)?.promo_title || ""),
        promoSubtitle: String((store as any)?.promo_subtitle || ""),
        promoImageUrl: String((store as any)?.promo_image_url || ""),
        promoTargetType: (store as any)?.promo_target_type as any,
        promoTargetId: (store as any)?.promo_target_id
          ? String((store as any).promo_target_id)
          : null,
        promoTargetUrl: (store as any)?.promo_target_url
          ? String((store as any).promo_target_url)
          : null,
      }
    : STORE_DATA;

  // Product count per collection
  const productCountByCollection = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const cid = String((p as any)?.collection_id || "");
      if (cid) map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [products]);

  const collectionFilters = useMemo(() => {
    return [
      { id: "Tous", name: "Tous", count: products.length },
      { id: "__new__", name: "Nouveautés", count: null },
      { id: "__trend__", name: "Tendances", count: null },
      ...(collections || []).map((c: any) => ({
        id: String(c?.id),
        name: String(c?.name || "Collection"),
        count: productCountByCollection[String(c?.id)] ?? 0,
      })),
    ];
  }, [collections, products.length, productCountByCollection]);

  const filteredByCollection = useMemo(() => {
    if (
      selectedCollectionId === "Tous" ||
      selectedCollectionId === "__new__" ||
      selectedCollectionId === "__trend__"
    ) {
      return products;
    }
    return (products || []).filter(
      (p) => String((p as any)?.collection_id || "") === selectedCollectionId,
    );
  }, [products, selectedCollectionId]);

  // Apply search filter
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return filteredByCollection;
    const q = searchQuery.toLowerCase().trim();
    return filteredByCollection.filter(
      (p: any) =>
        String(p?.name || "")
          .toLowerCase()
          .includes(q) ||
        String(p?.description || "")
          .toLowerCase()
          .includes(q),
    );
  }, [filteredByCollection, searchQuery]);

  const newestProducts = useMemo(() => {
    return [...filteredProducts].sort((a: any, b: any) => {
      const da = new Date(String(a?.created_at || 0)).getTime();
      const db = new Date(String(b?.created_at || 0)).getTime();
      return db - da;
    });
  }, [filteredProducts]);

  const trendingProducts = useMemo(() => {
    return [...filteredProducts].sort((a: any, b: any) => {
      const da = new Date(
        String(a?.updated_at || a?.created_at || 0),
      ).getTime();
      const db = new Date(
        String(b?.updated_at || b?.created_at || 0),
      ).getTime();
      return db - da;
    });
  }, [filteredProducts]);

  const allDisplayedProducts = useMemo(() => {
    if (selectedCollectionId === "__new__") return newestProducts;
    if (selectedCollectionId === "__trend__") return trendingProducts;
    return filteredProducts;
  }, [
    newestProducts,
    trendingProducts,
    filteredProducts,
    selectedCollectionId,
  ]);

  const paginatedProducts = useMemo(() => {
    return allDisplayedProducts.slice(0, displayedCount);
  }, [allDisplayedProducts, displayedCount]);

  const hasMore = displayedCount < allDisplayedProducts.length;

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount((prev) => prev + PAGE_SIZE);
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, hasMore]);

  const productsTitle = useMemo(() => {
    if (selectedCollectionId === "__new__") return "Nouveautés";
    if (selectedCollectionId === "__trend__") return "Tendances";
    const col = collectionFilters.find((c) => c.id === selectedCollectionId);
    return col?.name || "Produits";
  }, [selectedCollectionId, collectionFilters]);

  // Responsive columns
  const numColumns = useMemo(() => {
    const w = width;
    if (w >= 1200) return 5;
    if (w >= 900) return 4;
    if (w >= 600) return 3;
    return 2;
  }, []);

  const cardWidth = useMemo(() => {
    const horizontalPad = SPACING.xl * 2;
    const gaps = SPACING.md * (numColumns - 1);
    return (width - horizontalPad - gaps) / numColumns;
  }, [numColumns]);

  // BUG FIX: Use storeId in URL if slug is undefined/empty
  const handleShareStore = useCallback(async () => {
    try {
      if (!store?.id) return;

      const slug =
        store?.slug &&
        String(store.slug) !== "undefined" &&
        String(store.slug).trim()
          ? String(store.slug)
          : null;

      const link = slug
        ? ExpoLinking.createURL(`/store/${slug}`, {
            queryParams: { storeId: String(store.id) },
          })
        : ExpoLinking.createURL(`/store`, {
            queryParams: { storeId: String(store.id) },
          });

      if (Platform.OS === "web") {
        try {
          const nav: any = typeof navigator !== "undefined" ? navigator : null;
          if (nav?.clipboard?.writeText) {
            await nav.clipboard.writeText(link);
            Alert.alert(
              "Lien copié",
              "Le lien de la boutique a été copié dans le presse-papiers.",
            );
            return;
          }
        } catch {}

        try {
          const w: any = typeof window !== "undefined" ? window : null;
          if (w?.prompt) {
            w.prompt("Copiez le lien de la boutique :", link);
            return;
          }
        } catch {}
      }

      await Share.share({ message: link });
    } catch (e: any) {
      errorHandler.handle(
        e,
        "share failed",
        ErrorCategory.SYSTEM,
        ErrorSeverity.LOW,
      );
    }
  }, [store]);

  const handlePromoPress = useCallback(async () => {
    if (!storeData?.promoEnabled) return;
    const t = String(storeData?.promoTargetType || "");
    if (t === "collection") {
      const id = storeData?.promoTargetId;
      if (id) setSelectedCollectionId(String(id));
      return;
    }
    if (t === "product") {
      const id = storeData?.promoTargetId;
      if (id) navigation.navigate("ProductDetail", { productId: String(id) });
      return;
    }
    if (t === "url") {
      const url = storeData?.promoTargetUrl;
      if (url) {
        openURL(String(url));
      }
    }
  }, [navigation, storeData]);

  const shouldShowPromo = useMemo(() => {
    if (!storeData?.promoEnabled) return false;
    const hasContent = Boolean(
      String(storeData?.promoTitle || "").trim() ||
      String(storeData?.promoSubtitle || "").trim() ||
      String(storeData?.promoImageUrl || "").trim(),
    );
    return hasContent;
  }, [storeData]);

  // Hide WhatsApp button when no phone set
  const hasPhone = useMemo(() => {
    const raw = String(
      (store as any)?.phone || (storeData as any)?.phone || "",
    ).trim();
    return raw.length > 0;
  }, [store, storeData]);

  const handleWhatsAppContact = async () => {
    const raw = String(
      (store as any)?.phone || (storeData as any)?.phone || "",
    ).trim();
    if (!raw) {
      Alert.alert(
        "WhatsApp",
        "Cette boutique n'a pas de numéro WhatsApp renseigné.",
      );
      return;
    }

    const cleaned = raw.replace(/[^\d+]/g, "");
    const waNumber = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
    if (!waNumber) {
      Alert.alert("WhatsApp", "Numéro WhatsApp invalide.");
      return;
    }

    contactStore({ rawPhone: waNumber });
  };

  const handleFollowStore = useCallback(async () => {
    if (!store?.id || !user?.id) {
      Alert.alert("Suivi", "Vous devez être connecté pour suivre une boutique.");
      return;
    }
    try {
      const newState = await storeService.toggleFollow(String(user.id), String(store.id));
      setIsFollowing(Boolean(newState));

      // Update followers count locally if available
      try {
        setStoreStats((prev: any) => {
          if (!prev) return prev;
          const before = Number(prev.followers_count || prev.total_followers || 0);
          const after = newState ? before + 1 : Math.max(0, before - 1);
          return { ...prev, followers_count: after, total_followers: after };
        });
      } catch {}

      Alert.alert(
        "Suivi",
        newState ? "Vous suivez maintenant cette boutique! ❤️" : "Abonnement annulé.",
      );
    } catch (e: any) {
      errorHandler.handle(
        e,
        "follow failed",
        ErrorCategory.SYSTEM,
        ErrorSeverity.LOW,
      );
      Alert.alert("Suivi", "Impossible de modifier l'abonnement. Réessayez plus tard.");
    }
  }, [store?.id, user?.id]);

  const mapProductToCard = useCallback((p: any) => {
    const images = Array.isArray(p?.images) ? p.images : [];
    const imageUrl =
      p?.image_url || p?.imageUrl || images?.[0] || FALLBACK_PRODUCT_IMAGE;

    return {
      id: String(p?.id),
      name: String(p?.name || "Produit"),
      price: Number(p?.price || 0),
      comparePrice: (p as any)?.compare_price ?? p?.compare_price,
      imageUrl: String(imageUrl),
    };
  }, []);

  // Related/suggested products (other products from same category, different random ones)
  const suggestedProducts = useMemo(() => {
    if (products.length <= 3) return [];
    // Show last 4 products as "suggestions" (placeholder for real recommendation logic)
    return [...products].reverse().slice(0, 4);
  }, [products]);

  const ratingAvg =
    typeof storeStats?.rating_avg === "number" ? storeStats.rating_avg : 0;
  const ratingCount =
    typeof storeStats?.rating_count === "number" ? storeStats.rating_count : 0;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={COLORS.bg}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            navigation.navigate("ClientTabs", { screen: "ClientHome" })
          }
          accessibilityLabel="Retour à l'accueil"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Boutique</Text>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={handleShareStore}
          accessibilityLabel="Partager cette boutique"
          accessibilityRole="button"
        >
          <Ionicons name="share-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Loading */}
        {loading && <StoreSkeleton />}

        {/* Error */}
        {!!errorMsg && !loading && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={48} color={COLORS.danger} />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadStore}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !errorMsg && (
          <>
            {/* NEW: Modern Store Header with StoreHeader component */}
            <StoreHeader
              store={{
                id: store?.id || "",
                name: store?.name || storeData?.name || "Boutique",
                category: store?.category || storeData?.category || "",
                logo_url: store?.logo_url || storeData?.logoUrl,
                banner_url: store?.banner_url || storeData?.bannerUrl,
                description: store?.description || storeData?.description,
                verified: Boolean(store?.verified || storeData?.verified),
                rating: ratingAvg,
                rating_count: ratingCount,
              }}
              onShare={handleShareStore}
              onContact={() => {
                if (hasPhone) {
                  handleWhatsAppContact();
                }
              }}
              onFollow={() => {
                // Follow is handled by the component if needed
              }}
            />

            {/* NEW: Store Info Card */}
            {store && (
              <StoreInfoCard
                store={{
                  phone: store?.phone,
                  address: store?.address,
                  opening_hours: store?.opening_hours,
                  delivery_time: store?.delivery_time,
                  email: store?.email,
                }}
              />
            )}

            {/* Action Buttons: Contact & Follow */}
            <View style={styles.actionButtonsSection}>
              <TouchableOpacity 
                style={styles.contactButton}
                onPress={() => {
                  if (hasPhone) {
                    handleWhatsAppContact();
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="call" 
                  size={18} 
                  color={COLORS.white}
                />
                <Text style={styles.contactButtonText}>Contacter</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.followButton}
                onPress={handleFollowStore}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={isFollowing ? 'heart' : 'heart-outline'} 
                  size={18} 
                  color={isFollowing ? COLORS.accent : COLORS.text}
                />
                <Text style={styles.followButtonText}>{isFollowing ? 'Suivi' : 'Suivre'}</Text>
              </TouchableOpacity>
            </View>

            {/* NEW: Store Tabs Navigation */}
            <StoreTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              tabs={[
                { id: "accueil", label: "Accueil" },
                { id: "produits", label: "Produits" },
                { id: "apropos", label: "À propos" },
                { id: "avis", label: "Avis" },
              ]}
            />

            {/* Old Store Header (now replaced by StoreHeader component above) - Code hidden for cleanliness */}

            {/* ─── TAB-BASED CONTENT ─── */}

            {/* ACCUEIL TAB */}
            {activeTab === "accueil" && (
              <>
                {/* Promo Banner */}
                {shouldShowPromo && (
                  <TouchableOpacity
                    style={styles.promoCard}
                    onPress={handlePromoPress}
                    activeOpacity={0.85}
                  >
                    {!!storeData.promoImageUrl && (
                      <Image
                        source={{ uri: cloudinaryService.getOptimizedUrl(storeData.promoImageUrl, 800) }}
                        style={styles.promoImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.promoContent}>
                      {!!String(storeData.promoTitle || "").trim() && (
                        <Text style={styles.promoTitle}>
                          {String(storeData.promoTitle)}
                        </Text>
                      )}
                      {!!String(storeData.promoSubtitle || "").trim() && (
                        <Text style={styles.promoSubtitle}>
                          {String(storeData.promoSubtitle)}
                        </Text>
                      )}
                      <View style={styles.promoCtaRow}>
                        <Text style={styles.promoCtaText}>Voir l'offre</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={16}
                          color={COLORS.text}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Welcome section */}
                <View style={styles.welcomeSection}>
                  <Text style={styles.sectionTitle}>Bienvenue</Text>
                  <Text style={styles.descriptionText}>{storeData.description}</Text>
                </View>

                {/* Featured/Recent Products */}
                {homepageProducts && homepageProducts.length > 0 && (
                  <View style={styles.homepageProductsSection}>
                    <Text style={styles.sectionTitle}>
                      {homepageProducts.some(p => p.featured) ? 'Produits en vedette' : 'Produits récents'}
                    </Text>
                    <View style={styles.productsGrid}>
                            {homepageProducts.map((product, idx) => {
                              const card = mapProductToCard(product);
                              return (
                                <View key={card.id || `hp-${idx}`} style={[styles.productCardWrapper, { width: cardWidth }]}> 
                                  <ProductCard
                                    name={card.name}
                                    price={card.price}
                                    comparePrice={card.comparePrice}
                                    imageUrl={card.imageUrl}
                                    onPress={() => navigation.push('ProductDetail', { productId: card.id, storeId: effectiveStoreId })}
                                  />
                                </View>
                              );
                            })}
                    </View>
                  </View>
                )}
              </>
            )}

            {/* PRODUITS TAB */}
            {activeTab === "produits" && (
              <>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
              <Ionicons
                name="search-outline"
                size={18}
                color={COLORS.textMuted}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher dans la boutique..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel="Rechercher des produits"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  accessibilityLabel="Effacer la recherche"
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Collection Filters */}
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
                    selectedCollectionId === c.id &&
                      styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCollectionId(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrer par ${c.name}`}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCollectionId === c.id &&
                        styles.categoryTextActive,
                    ]}
                  >
                    {c.name}
                    {c.count !== null && c.count > 0 ? ` (${c.count})` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Products Section */}
            <View style={styles.productsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{productsTitle}</Text>
                <Text style={styles.sectionCount}>
                  {allDisplayedProducts.length} produit
                  {allDisplayedProducts.length !== 1 ? "s" : ""}
                </Text>
              </View>

              {/* Empty search state */}
              {searchQuery.trim() !== "" &&
                allDisplayedProducts.length === 0 && (
                  <View style={styles.emptySearch}>
                    <Ionicons
                      name="search-outline"
                      size={40}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.emptySearchText}>
                      Aucun produit pour "{searchQuery}"
                    </Text>
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Text style={styles.emptySearchClear}>
                        Effacer la recherche
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

              <View style={styles.productsGrid}>
                {paginatedProducts.map((p) => {
                  const product = mapProductToCard(p);
                  return (
                    <View
                      key={product.id}
                      style={[styles.productCardWrapper, { width: cardWidth }]}
                    >
                      <ProductCard
                        name={product.name}
                        price={product.price}
                        comparePrice={product.comparePrice}
                        imageUrl={product.imageUrl}
                        onPress={() =>
                          navigation.navigate("ProductDetail", {
                            productId: product.id,
                          })
                        }
                      />
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Load More */}
            {hasMore && (
              <View style={styles.loadMoreContainer}>
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  accessibilityLabel="Charger plus de produits"
                  accessibilityRole="button"
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={COLORS.accent}
                      />
                      <Text style={styles.loadMoreText}>
                        Charger plus (
                        {allDisplayedProducts.length - displayedCount} restants)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* You may also like section */}
            {suggestedProducts.length > 0 && (
              <View style={styles.suggestedSection}>
                <Text style={styles.sectionTitle}>Vous aimerez aussi</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestedList}
                >
                  {suggestedProducts.map((p) => {
                    const product = mapProductToCard(p);
                    return (
                      <View
                        key={`sug-${product.id}`}
                        style={styles.suggestedCard}
                      >
                        <ProductCard
                          name={product.name}
                          price={product.price}
                          comparePrice={product.comparePrice}
                          imageUrl={product.imageUrl}
                          onPress={() =>
                            navigation.navigate("ProductDetail", {
                              productId: product.id,
                            })
                          }
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
              </>
            )}

            {/* À PROPOS TAB */}
            {activeTab === "apropos" && (
              <View style={styles.aboutSection}>
                {/* Description */}
                <View style={styles.aboutCard}>
                  <Text style={styles.aboutTitle}>À propos de {storeData.name}</Text>
                  <Text style={styles.descriptionText}>{storeData.description}</Text>
                </View>

                {/* Contact & Hours */}
                <View style={styles.aboutCard}>
                  <Text style={styles.aboutTitle}>Informations de contact</Text>
                  
                  {store?.phone && (
                    <TouchableOpacity
                      style={styles.contactItem}
                      onPress={() => contactStore({ rawPhone: store.phone, fallback: 'tel' })}
                    >
                      <Ionicons
                        name="call"
                        size={20}
                        color={COLORS.accent}
                        style={styles.contactIcon}
                      />
                      <View>
                        <Text style={styles.contactLabel}>Téléphone</Text>
                        <Text style={styles.contactValue}>{store.phone}</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {store?.email && (
                    <TouchableOpacity
                      style={styles.contactItem}
                      onPress={() => openURL(`mailto:${store.email}`)}
                    >
                      <Ionicons
                        name="mail"
                        size={20}
                        color={COLORS.accent}
                        style={styles.contactIcon}
                      />
                      <View>
                        <Text style={styles.contactLabel}>Email</Text>
                        <Text style={styles.contactValue}>{store.email}</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {store?.address && (
                    <TouchableOpacity
                      style={styles.contactItem}
                      onPress={() => openURL(`geo:0,0?q=${encodeURIComponent(store.address)}`)}
                    >
                      <Ionicons
                        name="location"
                        size={20}
                        color={COLORS.accent}
                        style={styles.contactIcon}
                      />
                      <View>
                        <Text style={styles.contactLabel}>Adresse</Text>
                        <Text style={styles.contactValue}>{store.address}</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {store?.opening_hours && (
                    <View style={styles.contactItem}>
                      <Ionicons
                        name="time"
                        size={20}
                        color={COLORS.accent}
                        style={styles.contactIcon}
                      />
                      <View>
                        <Text style={styles.contactLabel}>Horaires</Text>
                        <Text style={styles.contactValue}>{store.opening_hours}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Stats */}
                {storeStats && (
                  <View style={styles.statsGrid}>
                    {storeStats.total_products !== undefined && (
                      <View style={styles.statBox}>
                        <Text style={styles.statNumber}>
                          {storeStats.total_products}
                        </Text>
                        <Text style={styles.statLabel}>Produits</Text>
                      </View>
                    )}
                    {storeStats.total_followers !== undefined && (
                      <View style={styles.statBox}>
                        <Text style={styles.statNumber}>
                          {storeStats.total_followers}
                        </Text>
                        <Text style={styles.statLabel}>Abonnés</Text>
                      </View>
                    )}
                    {storeStats.total_orders !== undefined && (
                      <View style={styles.statBox}>
                        <Text style={styles.statNumber}>
                          {storeStats.total_orders}
                        </Text>
                        <Text style={styles.statLabel}>Commandes</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* AVIS TAB */}
            {activeTab === "avis" && (
              <View style={styles.reviewsSection}>
                <View style={styles.reviewHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Avis clients</Text>
                    {storeStats?.rating_avg !== undefined && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.xs }}>
                        <StarRating
                          avg={Number(storeStats.rating_avg) || 0}
                          count={Number(storeStats.rating_count) || 0}
                        />
                      </View>
                    )}
                  </View>
                </View>

                {/* Add Review Form */}
                <View style={styles.reviewFormContainer}>
                  <Text style={styles.formTitle}>Laissez un avis</Text>
                  
                  <Text style={styles.formLabel}>Votre nom *</Text>
                  <TextInput
                    style={styles.reviewInput}
                    placeholder="Entrez votre nom"
                    placeholderTextColor={COLORS.textMuted}
                    value={reviewName}
                    onChangeText={setReviewName}
                    editable={!submittingReview}
                  />

                  <Text style={styles.formLabel}>Note *</Text>
                  <View style={styles.ratingSelector}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setReviewRating(star)}
                        disabled={submittingReview}
                      >
                        <Ionicons
                          name={star <= reviewRating ? "star" : "star-outline"}
                          size={32}
                          color={star <= reviewRating ? COLORS.star : COLORS.textMuted}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>Commentaire *</Text>
                  <TextInput
                    style={[styles.reviewInput, styles.reviewTextarea]}
                    placeholder="Partagez votre avis..."
                    placeholderTextColor={COLORS.textMuted}
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    multiline
                    numberOfLines={4}
                    editable={!submittingReview}
                  />

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      submittingReview && styles.submitButtonDisabled,
                      (!reviewName || !reviewComment) && styles.submitButtonDisabled,
                    ]}
                    onPress={async () => {
                      if (!store?.id || !reviewName || !reviewComment) {
                        Alert.alert("Erreur", "Veuillez remplir tous les champs");
                        return;
                      }
                      
                      setSubmittingReview(true);
                      try {
                        await storeReviewService.create({
                          store_id: store.id,
                          user_name: reviewName,
                          rating: reviewRating,
                          comment: reviewComment,
                        });
                        
                        // Reload reviews
                        const updated = await storeReviewService.getByStore(store.id);
                        setStoreReviews(Array.isArray(updated) ? updated : []);
                        
                        // Reset form
                        setReviewName("");
                        setReviewRating(5);
                        setReviewComment("");
                        
                        Alert.alert("Succès", "Votre avis a été ajouté");
                      } catch (error) {
                        console.error("Error submitting review:", error);
                        Alert.alert("Erreur", "Impossible d'ajouter votre avis");
                      } finally {
                        setSubmittingReview(false);
                      }
                    }}
                    disabled={submittingReview || !reviewName || !reviewComment}
                  >
                    {submittingReview ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.submitButtonText}>Soumettre l'avis</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Reviews List */}
                {storeReviews && storeReviews.length > 0 ? (
                  <View style={styles.reviewsList}>
                    {storeReviews.map((review, index) => (
                      <View key={review.id || index} style={styles.reviewItem}>
                        <View style={styles.reviewTop}>
                          <View>
                            <Text style={styles.reviewName}>{review.user_name}</Text>
                            <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Ionicons
                                  key={star}
                                  name={star <= review.rating ? "star" : "star-outline"}
                                  size={16}
                                  color={star <= review.rating ? COLORS.star : COLORS.textMuted}
                                />
                              ))}
                            </View>
                          </View>
                          <Text style={styles.reviewDate}>
                            {review.created_at ? new Date(review.created_at).toLocaleDateString('fr-FR') : ""}
                          </Text>
                        </View>
                        <Text style={styles.reviewComment}>{review.comment}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyReviews}>
                    <Ionicons
                      name="star-outline"
                      size={48}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.emptyReviewsText}>
                      Pas d'avis pour le moment
                    </Text>
                    <Text style={styles.emptyReviewsSubtext}>
                      Soyez le premier à évaluer cette boutique
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ height: SPACING.xxxl * 2 }} />
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 8px rgba(0,0,0,0.12)" }
      : { elevation: 3 }),
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: "600",
    color: COLORS.text,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 8px rgba(0,0,0,0.12)" }
      : { elevation: 3 }),
  },
  // Error state
  errorContainer: {
    paddingTop: 120,
    paddingHorizontal: SPACING.xl,
    alignItems: "center",
    gap: SPACING.md,
  },
  errorText: {
    color: COLORS.danger,
    textAlign: "center",
    fontSize: FONT_SIZE.sm,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  retryButtonText: {
    color: COLORS.textInverse,
    fontWeight: "600",
    fontSize: FONT_SIZE.md,
  },
  // Banner — increased to 220px
  storeBanner: {
    height: 220,
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  // Promo
  promoCard: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  promoImage: {
    width: "100%",
    height: 120,
  },
  promoContent: {
    padding: SPACING.lg,
  },
  promoTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: "700",
  },
  promoSubtitle: {
    color: COLORS.textSoft,
    marginTop: 6,
  },
  promoCtaRow: {
    marginTop: SPACING.md,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  promoCtaText: {
    color: COLORS.textInverse,
    fontWeight: "600",
  },
  // Store info
  storeInfo: {
    paddingHorizontal: SPACING.xl,
    marginTop: -50,
    position: "relative",
    zIndex: 5,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  storeLogo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: COLORS.bg,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 16px rgba(139,92,246,0.25)" }
      : { elevation: 6 }),
  },
  storeDetails: {
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  storeName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "700",
    color: COLORS.text,
  },
  storeCategory: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: SPACING.xs,
  },
  storeDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    textAlign: "center",
    marginTop: SPACING.md,
    lineHeight: 22,
    maxWidth: 500,
  },
  ratingWrapper: {
    marginTop: SPACING.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xl,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  statValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: "700",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.xl,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  followButtonWrapper: {
    minWidth: 130,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  followButtonDisabled: {
    backgroundColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  followButtonDisabledText: {
    color: COLORS.textMuted,
    fontWeight: "600",
    fontSize: FONT_SIZE.md,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "600",
    fontSize: FONT_SIZE.md,
  },
  // Search Bar
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    paddingVertical: 0,
  },
  // Collections
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
    fontWeight: "500",
    color: COLORS.textSoft,
  },
  categoryTextActive: {
    color: COLORS.textInverse,
    fontWeight: "700",
  },
  // Products
  productsSection: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: "700",
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  productCardWrapper: {
    // width is set dynamically
  },
  // Empty search
  emptySearch: {
    alignItems: "center",
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptySearchText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    textAlign: "center",
  },
  emptySearchClear: {
    color: COLORS.accent,
    fontWeight: "600",
    fontSize: FONT_SIZE.sm,
  },
  // Load More
  loadMoreContainer: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent + "60",
    minWidth: 200,
    justifyContent: "center",
  },
  loadMoreText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
    color: COLORS.accent,
  },
  // Suggested section
  suggestedSection: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.xl,
  },
  suggestedList: {
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  suggestedCard: {
    width: 160,
  },
  // Action Buttons
  actionButtonsSection: {
    flexDirection: "row",
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  contactButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: FONT_SIZE.sm,
  },
  followButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  followButtonText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: FONT_SIZE.sm,
  },
  // Welcome section (Accueil tab)
  welcomeSection: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  // About section (À propos tab)
  aboutSection: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  aboutCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  aboutTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  descriptionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    lineHeight: 22,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  contactIcon: {
    marginTop: 2,
  },
  contactLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: FONT_SIZE.xl,
    fontWeight: "700",
    color: COLORS.accent,
    marginBottom: SPACING.xs,
  },
  // Reviews section (Avis tab)
  reviewsSection: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  reviewHeader: {
    marginBottom: SPACING.xl,
  },
  reviewFormContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  formTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  reviewTextarea: {
    textAlignVertical: "top",
    maxHeight: 120,
  },
  ratingSelector: {
    flexDirection: "row",
    gap: SPACING.md,
    marginVertical: SPACING.md,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: SPACING.lg,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
  },
  reviewsList: {
    gap: SPACING.md,
  },
  reviewItem: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  reviewName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
    color: COLORS.text,
  },
  reviewDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  reviewComment: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  emptyReviews: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyReviewsText: {
    fontSize: FONT_SIZE.md,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptyReviewsSubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  // Homepage products section
  homepageProductsSection: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.bg,
  },
  productInfo: {
    padding: SPACING.md,
  },
  productName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  productPrice: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.accent,
  },
});


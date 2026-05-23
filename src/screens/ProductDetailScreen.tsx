import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
  FlatList,
  Animated,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "../config/theme";
import { useResponsive } from "../utils/responsive";
import { useCartStore, useAuthStore } from "../store";
import { useTheme } from "../hooks/useTheme";
import { LikeButton, SkeletonLoader } from "../components";
import OptimizedImage from "../components/OptimizedImage";
import { type Product, type ProductReview, type ProductOption, type Store } from '../lib/supabase';
import { productService } from '../services/productService';
import { reviewService } from '../services/reviewService';
import { cloudinaryService } from '../services/cloudinaryService';
import { storeService } from '../services/storeService';
import { errorHandler, ErrorCategory, ErrorSeverity } from "../utils/errorHandler";
import { contactStore } from '../services/contactService';
import { shareContent } from "../components/ShareButton";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type TabType = 'description' | 'characteristics' | 'reviews' | 'similar';

const COLOR_MAP: Record<string, string> = {
  'rouge': '#FF3B30',
  'bleu': '#007AFF',
  'vert': '#34C759',
  'jaune': '#FFCC00',
  'noir': '#000000',
  'blanc': '#FFFFFF',
  'gris': '#8E8E93',
  'rose': '#FF2D55',
  'violet': '#AF52DE',
  'orange': '#FF9500',
  'marron': '#A2845E',
  'cyan': '#32ADE6',
  'magenta': '#FF2D55',
  'or': '#FFD700',
  'argent': '#C0C0C0',
  'red': '#FF3B30',
  'blue': '#007AFF',
  'green': '#34C759',
  'yellow': '#FFCC00',
  'black': '#000000',
  'white': '#FFFFFF',
  'grey': '#8E8E93',
  'gray': '#8E8E93',
  'pink': '#FF2D55',
  'purple': '#AF52DE',
  'brown': '#A2845E',
  'gold': '#FFD700',
  'silver': '#C0C0C0',
};

const getColorHex = (colorName: string): string | null => {
  const normalized = colorName.toLowerCase().trim();
  return COLOR_MAP[normalized] || null;
};

export const ProductDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, isDesktop } = useResponsive();
  const themeContext = useTheme();
  const { theme, getColor: COLORS, spacing: SPACING, radius: RADIUS } = themeContext;
  const styles = useMemo(() => getStyles(themeContext), [themeContext]);
  const { addItem, items } = useCartStore();
  const { user, showAuthModal } = useAuthStore();

  const imageOpacity = useRef(new Animated.Value(0)).current;
  const { productId } = route.params || {};

  // State
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedVariantLabel, setSelectedVariantLabel] = useState<string | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [showAllCities, setShowAllCities] = useState(false);

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [activeTab, setActiveTab] = useState<TabType>('description');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const isWideScreen = width >= 1024;

  const productData = useMemo(() => {
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      comparePrice: (product as any).compare_price ?? product.compare_price,
      images: Array.isArray(product.images) ? product.images : [],
      store: store
        ? {
            id: store.id,
            name: store.name,
            logoUrl: store.logo_url || "",
            verified: true,
          }
        : null,
      inStock: (product.stock ?? 0) > 0,
      category: product.category || "",
      attributes: (product as any).attributes || {},
    };
  }, [product, store]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return null;
    const avg = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length;
    return Math.round(avg * 10) / 10;
  }, [reviews]);

  const variantImageMap = useMemo<Record<string, string>>(() => {
    if (!product?.attributes || typeof product.attributes !== 'object') return {} as Record<string, string>;
    const raw = (product.attributes as any).image_variants;
    if (!raw || typeof raw !== 'object') return {} as Record<string, string>;
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([key, value]) => typeof key === 'string' && typeof value === 'string',
      ),
    ) as Record<string, string>;
  }, [product]);

  const variantLabels = useMemo(() => {
    return Array.from(new Set(Object.values(variantImageMap).filter(Boolean)));
  }, [variantImageMap]);

  useEffect(() => {
    if (!variantLabels.length) return;
    const matched = Object.values(selectedOptions).find((value) =>
      variantLabels.includes(value),
    );
    if (matched && matched !== selectedVariantLabel) {
      setSelectedVariantLabel(matched);
    }
  }, [selectedOptions, variantLabels, selectedVariantLabel]);

  const galleryImages = useMemo(() => {
    if (!productData) return [];
    const images = Array.isArray(productData.images) ? productData.images : [];
    if (selectedVariantLabel) {
      const filtered = images.filter(
        (image) => variantImageMap[image] === selectedVariantLabel,
      );
      if (filtered.length) return filtered;
    }

    const selectedValues = Object.values(selectedOptions).filter(Boolean);
    if (selectedValues.length) {
      const filtered = images.filter((image) =>
        selectedValues.some((value) => variantImageMap[image] === value),
      );
      if (filtered.length) return filtered;
    }

    return images;
  }, [productData, selectedOptions, selectedVariantLabel, variantImageMap]);

  useEffect(() => {
    if (selectedImageIndex >= galleryImages.length && galleryImages.length > 0) {
      setSelectedImageIndex(0);
    }
  }, [galleryImages.length, selectedImageIndex]);

  // Load product, store, options, and similar products
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (!productId) {
          if (mounted) setLoading(false);
          return;
        }

        // Fetch product
        const p = (await productService.getById(String(productId))) as Product;
        if (!mounted) return;
        setProduct(p);

        // Track analytics
        if (p?.id) {
          void productService.incrementViews(p.id);
        }

        // Fetch store
        if (p?.store_id) {
          const s = (await storeService.getById(String(p.store_id))) as Store;
          if (!mounted) return;
          setStore(s);
        }

        // Fetch product options
        if (p?.id) {
          const opts = await productService.getProductOptions(String(p.id));
          if (!mounted) return;
          setOptions(opts);
          // Initialize selected options
          const initialSelected: Record<string, string> = {};
          opts.forEach(opt => {
            if (opt.values && opt.values.length > 0) {
              initialSelected[opt.name] = opt.values[0];
            }
          });
          setSelectedOptions(initialSelected);
        }

        // Fetch similar products
        if (p) {
          const similar = await productService.getSimilarProducts(p, 6);
          if (!mounted) return;
          setSimilarProducts(similar);
        }
      } catch (e) {
        errorHandler.handle(e, "failed to load product", ErrorCategory.SYSTEM, ErrorSeverity.LOW);
        Alert.alert("Erreur", "Impossible de charger le produit");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [productId, user?.id]);

  // Load reviews
  useEffect(() => {
    let mounted = true;
    const loadReviews = async () => {
      try {
        if (!productId) return;
        setReviewsLoading(true);
        const data = await reviewService.getByProduct(String(productId));
        if (!mounted) return;
        setReviews(data);
      } catch (e) {
        errorHandler.handle(e, "failed to load reviews", ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      } finally {
        if (mounted) setReviewsLoading(false);
      }
    };

    void loadReviews();
    return () => {
      mounted = false;
    };
  }, [productId]);

  const handleOptionChange = (optionName: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionName]: value,
    }));
  };

  const submitReview = async () => {
    try {
      if (!product) return;

      if (!user?.id) {
        showAuthModal({ type: 'LEAVE_REVIEW', payload: { productId: product.id, comment: reviewComment.trim(), rating: reviewRating } });
        return;
      }

      const comment = reviewComment.trim();
      const name = (user.full_name || user.email || 'Utilisateur').trim();

      if (!comment) {
        Alert.alert("Erreur", "Veuillez entrer un commentaire");
        return;
      }
      if (reviewRating < 1 || reviewRating > 5) {
        Alert.alert("Erreur", "La note doit être entre 1 et 5");
        return;
      }

      setSubmittingReview(true);
      await reviewService.create({
        product_id: product.id,
        user_name: name,
        rating: reviewRating,
        comment,
      });

      setReviewRating(5);
      setReviewComment("");

      const data = await reviewService.getByProduct(String(product.id));
      setReviews(data);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      errorHandler.handle(e, "failed to create review", ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      Alert.alert("Erreur", "Impossible d'envoyer votre avis");
    } finally {
      setSubmittingReview(false);
    }
  };

  const normalizeWhatsappNumber = (raw: string) => {
    if (!raw) return null;
    const cleaned = String(raw).trim().replace(/[^0-9+]/g, "");
    const waNumber = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
    return waNumber || null;
  };

  const handleDiscussWithSeller = async () => {
    const raw = String((store as any)?.whatsapp_number || (store as any)?.phone || (store as any)?.phone_number || "").trim();
    const waNumber = normalizeWhatsappNumber(raw);
    if (!waNumber) {
      Alert.alert("Discuter", "Le vendeur n'a pas de numéro WhatsApp renseigné.");
      return;
    }

    const text = `Bonjour, je suis intéressé par: ${productData?.name || "ce produit"}`;
    try {
      contactStore({ rawPhone: waNumber, message: text });
    } catch (e) {
      errorHandler.handle(e, "open whatsapp failed", ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      Alert.alert("Erreur", "Impossible d'ouvrir WhatsApp.");
    }
  };

  const increaseQuantity = () => {
    setQuantity((q) => q + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const decreaseQuantity = () => {
    setQuantity((q) => Math.max(1, q - 1));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ============ RENDER FUNCTIONS ============

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('ClientTabs');
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.headerContent}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleGoBack}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {productData?.name || ""}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              if (productData) {
                shareContent({
                  title: productData.name,
                  description: productData.description || '',
                  url: `https://libreshop.shop/product/${productData.id}`,
                  imageUrl: productData.images?.[0] ? cloudinaryService.getOptimizedUrl(productData.images[0], 500) : undefined,
                  price: `${productData.price} FCFA`,
                  type: 'product'
                });
              }
            }}
          >
            <Ionicons name="share-social-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Cart')}
          >
            <View style={styles.cartIconContainer}>
              <Ionicons name="bag-handle" size={22} color="white" />
              {items.length > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{items.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          {user?.id && (
            <View style={styles.headerLikeContainer}>
              <LikeButton
                productId={String(productId || "")}
                userId={user.id ? String(user.id) : undefined}
                showCount={false}
                size="medium"
                showLabel={false}
                variant="rounded"
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const renderImageGallery = () => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        if ((galleryImages?.length || 0) === 0) return;
        setImageViewerVisible(true);
      }}
      style={styles.imageGallery}
    >
      {variantLabels.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.variantChipRow}
          contentContainerStyle={styles.variantChipContent}
        >
          <TouchableOpacity
            style={[
              styles.variantChip,
              selectedVariantLabel === null && styles.variantChipActive,
            ]}
            onPress={() => setSelectedVariantLabel(null)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.variantChipText,
                selectedVariantLabel === null && styles.variantChipTextActive,
              ]}
            >
              Toutes
            </Text>
          </TouchableOpacity>
          {variantLabels.map((label) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.variantChip,
                selectedVariantLabel === label && styles.variantChipActive,
              ]}
              onPress={() => setSelectedVariantLabel(label)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.variantChipText,
                  selectedVariantLabel === label && styles.variantChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {loading ? (
        <View style={[styles.mainImage, styles.loaderContainer]}>
          <SkeletonLoader width="100%" height="100%" borderRadius={RADIUS.lg} />
        </View>
      ) : galleryImages?.[selectedImageIndex] ? (
        <>
            <OptimizedImage
              source={{ uri: cloudinaryService.getOptimizedUrl(galleryImages[selectedImageIndex], 800) }}
              style={styles.mainImage}
            />
          {!!productData?.comparePrice && productData.comparePrice > (productData.price || 0) && (
            <View style={[styles.discountBadge, { backgroundColor: COLORS.danger }]}>
              <Text style={styles.discountText}>
                -{Math.round((1 - productData.price / productData.comparePrice) * 100)}%
              </Text>
            </View>
          )}
          <BlurView intensity={80} tint="dark" style={styles.zoomButton}>
            <Ionicons name="expand-outline" size={20} color="white" />
          </BlurView>
        </>
      ) : (
        <View style={[styles.mainImage, styles.imagePlaceholder]}>
          <Ionicons name="image-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.imagePlaceholderText}>Aucune image</Text>
        </View>
      )}

      {(galleryImages?.length || 0) > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbnailStrip}
          contentContainerStyle={styles.thumbnailContent}
        >
          {galleryImages?.map((image, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setSelectedImageIndex(index);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.thumb,
                selectedImageIndex === index && styles.thumbActive,
              ]}
              activeOpacity={0.85}
            >
              <OptimizedImage
                source={{ uri: cloudinaryService.getOptimizedUrl(image, 200) }}
                style={styles.thumbImage}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </TouchableOpacity>
  );

  const renderStoreInfo = () => {
    if (!productData?.store?.id) return null;
    return (
      <TouchableOpacity
        style={styles.storePill}
        onPress={() =>
          productData.store?.id && navigation.navigate("StoreDetail", { storeId: productData.store.id })
        }
        activeOpacity={0.85}
      >
        {productData.store.logoUrl ? (
          <OptimizedImage
            source={{ uri: cloudinaryService.getOptimizedUrl(productData.store.logoUrl, 100) }}
            style={styles.storeLogo}
          />
        ) : (
          <View style={styles.storeLogoPlaceholder} />
        )}
        <View style={styles.storeTextContainer}>
          <Text style={styles.storeLabel}>Vendeur</Text>
          <Text style={styles.storeName} numberOfLines={1}>
            {productData.store.name}
          </Text>
        </View>
        {productData.store.verified && (
          <Ionicons name="checkmark-circle" size={16} color={COLORS.info} />
        )}
      </TouchableOpacity>
    );
  };

  const renderProductInfo = () => (
    <View style={styles.infoSection}>
      {renderStoreInfo()}

      <Text style={styles.productTitle}>{productData?.name}</Text>

      <View style={styles.ratingRow}>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((i) => {
            const filled = (averageRating ?? 0) >= i;
            const half = !filled && (averageRating ?? 0) >= i - 0.5;
            return (
              <Ionicons
                key={i}
                name={
                  filled ? "star" : half ? "star-half" : "star-outline"
                }
                size={18}
                color={COLORS.star}
              />
            );
          })}
          <Text style={styles.ratingValue}>
            {averageRating ? `${averageRating}` : "—"}
          </Text>
        </View>
        <Text style={styles.reviewCount}>({reviews.length} avis)</Text>
      </View>

      <View style={styles.priceSection}>
        <Text style={styles.price}>
          {(productData?.price || 0).toLocaleString()} <Text style={styles.currency}>FCFA</Text>
        </Text>
        {!!productData?.comparePrice && productData.comparePrice > (productData.price || 0) && (
          <Text style={styles.comparePrice}>
            ~{(productData.comparePrice).toLocaleString()} FCFA
          </Text>
        )}
      </View>

      {/* Product Options */}
      {options.length > 0 && (
        <View style={styles.optionsSection}>
          <Text style={styles.sectionLabel}>Options</Text>
          {options.map((option) => (
            <View key={option.id} style={styles.optionContainer}>
              <Text style={styles.optionName}>{option.name}</Text>
              <View style={styles.optionValuesRow}>
                {option.values?.map((value) => {
                  const isColorOption = option.name.toLowerCase().includes('couleur') || option.name.toLowerCase().includes('color');
                  const colorHex = isColorOption ? getColorHex(value) : null;
                  const isSelected = selectedOptions[option.name] === value;

                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => handleOptionChange(option.name, value)}
                      style={[
                        styles.optionValue,
                        isSelected && styles.optionValueSelected,
                        isColorOption && styles.optionColorValue,
                        isColorOption && isSelected && styles.optionColorValueSelected,
                      ]}
                      activeOpacity={0.7}
                    >
                      {colorHex && (
                        <View style={[
                          styles.colorCircle, 
                          { backgroundColor: colorHex }, 
                          colorHex === '#FFFFFF' && { borderWidth: 1, borderColor: '#DDD' }
                        ]} />
                      )}
                      <Text
                        style={[
                          styles.optionValueText,
                          isSelected && styles.optionValueTextSelected,
                          isColorOption && { marginLeft: 6 }
                        ]}
                      >
                        {value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quantity */}
      <View style={styles.quantitySection}>
        <Text style={styles.sectionLabel}>Quantité</Text>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={[
              styles.quantityButton,
              quantity <= 1 && styles.quantityButtonDisabled,
            ]}
            onPress={decreaseQuantity}
            disabled={quantity <= 1}
            activeOpacity={0.85}
          >
            <Ionicons
              name="remove"
              size={20}
              color={quantity <= 1 ? COLORS.textMuted : COLORS.text}
            />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={increaseQuantity}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Delivery Info */}
      {store && store.delivery_mode && (
        <View style={styles.deliverySection}>
          <Text style={styles.sectionLabel}>Livraison</Text>
          <View style={styles.deliveryCard}>
            <View style={styles.deliveryIconBox}>
              <Ionicons name="bicycle-outline" size={24} color={COLORS.accent} />
            </View>
            <View style={styles.deliveryTextContainer}>
              {store.delivery_mode === 'fixed' && (
                <>
                  <Text style={styles.deliveryTitle}>Frais de livraison fixe</Text>
                  <Text style={styles.deliveryPrice}>
                    {store.shipping_price ? `${store.shipping_price.toLocaleString()} FCFA` : 'Gratuite'}
                  </Text>
                </>
              )}
              {store.delivery_mode === 'km' && (
                <>
                  <Text style={styles.deliveryTitle}>Livraison par distance</Text>
                  <Text style={styles.deliverySubtitle}>
                    {store.delivery_price_km ? `${store.delivery_price_km.toLocaleString()} FCFA / km` : 'Sur devis'}
                  </Text>
                </>
              )}
              {store.delivery_mode === 'city' && (
                <>
                  <Text style={styles.deliveryTitle}>Livraison par ville</Text>
                  {store.delivery_city_fees && Object.keys(store.delivery_city_fees).length > 0 ? (
                    <View style={styles.cityFeesList}>
                      {Object.entries(store.delivery_city_fees)
                        .slice(0, showAllCities ? undefined : 3)
                        .map(([city, fee]) => (
                        <View key={city} style={styles.cityFeeItem}>
                          <Text style={styles.cityFeeName}>• {city}</Text>
                          <Text style={styles.cityFeePrice}>{(fee as number).toLocaleString()} FCFA</Text>
                        </View>
                      ))}
                      {Object.keys(store.delivery_city_fees).length > 3 && (
                        <TouchableOpacity 
                          onPress={() => setShowAllCities(!showAllCities)}
                          style={{ marginTop: 4, paddingVertical: 4 }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: COLORS.accent, fontSize: FONT_SIZE.sm, fontWeight: '600' }}>
                            {showAllCities 
                              ? "Voir moins" 
                              : `+ ${Object.keys(store.delivery_city_fees).length - 3} autres villes`}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.deliverySubtitle}>Tarifs selon la ville</Text>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[
            styles.chatButton,
            !productData?.inStock && styles.chatButtonDisabled,
          ]}
          onPress={handleDiscussWithSeller}
          disabled={!productData?.inStock}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-whatsapp" size={18} color={COLORS.text} />
          <Text style={styles.chatButtonText}>Contacter</Text>
        </TouchableOpacity>

        <View style={[styles.followButton, !productData?.inStock && styles.followButtonDisabled]}>
          <LikeButton
            productId={String(productId || "")}
            userId={user?.id ? String(user.id) : undefined}
            showCount={true}
            size="medium"
            showLabel={true}
            variant="default"
            disabled={!productData?.inStock}
          />
        </View>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'description':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSectionLabel}>Description complète</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>
                {productData?.description?.trim()
                  ? productData.description
                  : "Aucune description disponible."}
              </Text>
            </View>
            {!!productData?.category && (
              <View style={styles.categoryBadge}>
                <Ionicons name="folder-outline" size={14} color={COLORS.accent} />
                <Text style={styles.categoryText}>{productData.category}</Text>
              </View>
            )}
          </View>
        );

      case 'characteristics': {
        const attributes = (productData as any)?.attributes || {};
        // Filter out internal attributes like image_variants
        const attributeKeys = Object.keys(attributes).filter(key => key !== 'image_variants');
        
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSectionLabel}>Caractéristiques</Text>
            {attributeKeys.length > 0 || options.length > 0 ? (
              <View style={styles.characteristicsGrid}>
                {attributeKeys.map((key) => (
                  <View key={`attr-${key}`} style={styles.characteristicItem}>
                    <Text style={styles.characteristicName}>{key}</Text>
                    <Text style={styles.characteristicValues}>
                      {Array.isArray(attributes[key]) ? attributes[key].join(", ") : String(attributes[key])}
                    </Text>
                  </View>
                ))}
                {options.map((opt) => (
                  <View key={`opt-${opt.id}`} style={styles.characteristicItem}>
                    <Text style={styles.characteristicName}>{opt.name}</Text>
                    <Text style={styles.characteristicValues}>
                      {opt.values?.join(", ") || "N/A"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Aucune caractéristique disponible</Text>
            )}
          </View>
        );
      }

      case 'reviews':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSectionLabel}>Avis clients</Text>

            {/* Review form */}
            <View style={styles.reviewForm}>
              {!user?.id && (
                <Text style={styles.reviewNotice}>
                  Vous devez être connecté pour laisser un avis.
                </Text>
              )}

              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Votre avis..."
                placeholderTextColor={COLORS.textMuted}
                style={[styles.reviewInput, styles.reviewInputMultiline]}
                multiline
                numberOfLines={4}
              />

              <View style={styles.ratingSelector}>
                <Text style={styles.ratingSelectorLabel}>Note:</Text>
                <View style={styles.ratingSelectorStars}>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setReviewRating(r)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={r <= reviewRating ? "star" : "star-outline"}
                        size={24}
                        color={COLORS.star}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitReviewButton,
                  submittingReview && styles.submitReviewButtonDisabled,
                ]}
                onPress={submitReview}
                disabled={submittingReview}
                activeOpacity={0.85}
              >
                {submittingReview ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="white" />
                    <Text style={styles.submitReviewButtonText}>Envoyer l'avis</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Reviews list */}
            {reviewsLoading ? (
              <View style={styles.reviewsLoading}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : reviews.length === 0 ? (
              <Text style={styles.emptyText}>Aucun avis pour le moment</Text>
            ) : (
              <View style={styles.reviewsList}>
                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>
                          {(review.user_name || "?").slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.reviewInfo}>
                        <Text style={styles.reviewAuthor}>{review.user_name}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(review.created_at).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reviewRatingRow}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Ionicons
                          key={i}
                          name={i <= review.rating ? "star" : "star-outline"}
                          size={14}
                          color={COLORS.star}
                        />
                      ))}
                    </View>

                    <Text style={styles.reviewText}>{review.comment}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      case 'similar':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSectionLabel}>Produits similaires</Text>
            {similarProducts.length === 0 ? (
              <Text style={styles.emptyText}>Aucun produit similaire</Text>
            ) : (
              <FlatList
                scrollEnabled={false}
                data={similarProducts}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.productsGridRow}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.similarProductCard}
                    onPress={() =>
                      navigation.push("ProductDetail", { productId: item.id })
                    }
                    activeOpacity={0.85}
                  >
                    {item.images && item.images.length > 0 ? (
                      <Image
                        source={{
                          uri: cloudinaryService.getOptimizedUrl(item.images[0], 300),
                        }}
                        style={styles.similarProductImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.similarProductImagePlaceholder}>
                        <Ionicons
                          name="image-outline"
                          size={32}
                          color={COLORS.textMuted}
                        />
                      </View>
                    )}
                    <Text style={styles.similarProductName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.similarProductPrice}>
                      {(item.price || 0).toLocaleString()} FCFA
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const renderTabs = () => (
    <View style={styles.tabsWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        {(['description', 'characteristics', 'reviews', 'similar'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.tabButton,
              activeTab === tab && styles.tabButtonActive,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === tab && styles.tabButtonTextActive,
              ]}
            >
              {tab === 'description' && 'Description'}
              {tab === 'characteristics' && 'Caractéristiques'}
              {tab === 'reviews' && 'Avis'}
              {tab === 'similar' && 'Similaires'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderBottomBar = () => (
    <View
      style={[
        styles.bottomBar,
        { paddingBottom: Math.max(insets.bottom, SPACING.md) },
      ]}
    >
      <View style={styles.bottomPriceCol}>
        <Text style={styles.bottomPriceLabel}>Total</Text>
        <Text style={styles.bottomPrice}>
          {((productData?.price || 0) * quantity).toLocaleString()} <Text style={styles.bottomCurrency}>FCFA</Text>
        </Text>
      </View>
      <View style={styles.bottomButtonsRow}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            !productData?.inStock && styles.primaryButtonDisabled,
          ]}
          onPress={() => {
            if (!productData?.inStock) return;
            if (!product) {
              Alert.alert("Erreur", "Produit indisponible");
              return;
            }
            if (!user?.id) {
              showAuthModal({ type: 'BUY_NOW', payload: { product, quantity } });
              return;
            }
            addItem(product, quantity);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.navigate('Cart');
          }}
          disabled={!productData?.inStock}
          activeOpacity={0.85}
        >
          <Ionicons name="flash" size={18} color="white" />
          <Text style={styles.primaryButtonText}>Acheter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            !productData?.inStock && styles.secondaryButtonDisabled,
          ]}
          onPress={() => {
            if (!productData?.inStock) return;
            if (!product) {
              Alert.alert("Erreur", "Produit indisponible");
              return;
            }
            if (!user?.id) {
              showAuthModal({ type: 'ADD_TO_CART', payload: { product, quantity } });
              return;
            }
            addItem(product, quantity);
            const { notificationService } = require('../services/notificationService');
            notificationService.scheduleCartReminder();
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
          disabled={!productData?.inStock}
          activeOpacity={0.85}
        >
          <Ionicons name="bag-handle" size={18} color="white" />
          <Text style={styles.secondaryButtonText}>Panier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
        {renderHeader()}
        <ScrollView style={styles.loadingContent} contentContainerStyle={styles.loadingContentContainer}>
          <SkeletonLoader width="100%" height={SCREEN_WIDTH} borderRadius={0} style={styles.skeletonImage} />
          <View style={styles.loadingMeta}>
            <SkeletonLoader width={120} height={32} borderRadius={16} />
            <SkeletonLoader width="80%" height={40} borderRadius={8} />
            <SkeletonLoader width="60%" height={24} borderRadius={8} />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!productData) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
        {renderHeader()}
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Produit introuvable</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
            activeOpacity={0.85}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      {renderHeader()}

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image gallery */}
        {renderImageGallery()}

        {/* Product info and options */}
        {renderProductInfo()}

        {/* Tabs */}
        {renderTabs()}

        {/* Tab content */}
        {renderTabContent()}
      </ScrollView>

      {/* Bottom action bar */}
      {renderBottomBar()}

      {/* Image viewer */}
      {imageViewerVisible && productData?.images && productData.images.length > 0 && (
        <View style={styles.imageViewer}>
          <TouchableOpacity
            style={[styles.viewerClose, { top: insets.top + SPACING.md }]}
            onPress={() => setImageViewerVisible(false)}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={productData.images}
            keyExtractor={(_, index) => index.toString()}
            initialScrollIndex={selectedImageIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / SCREEN_WIDTH
              );
              setSelectedImageIndex(index);
            }}
            renderItem={({ item }) => (
              <View style={styles.viewerSlide}>
                <Image
                  source={{ uri: cloudinaryService.getOptimizedUrl(item, 800) }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />

          <View style={styles.viewerPagination}>
            {productData.images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === selectedImageIndex && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const getStyles = (themeContext: any) => {
  const { getColor: COLORS, spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE } = themeContext;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    minHeight: 60,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: SPACING.md,
    color: 'white',
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cartIconContainer: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: FONT_SIZE.xs,
    fontWeight: '800',
  },
  headerLikeContainer: {},
  content: {
    flex: 1,
    marginTop: 80,
  },
  loadingContent: {
    flex: 1,
    marginTop: 80,
  },
  contentContainer: {
    paddingBottom: 120,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  loadingContentContainer: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  loadingMeta: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  viewerSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  skeletonImage: {
    marginBottom: SPACING.md,
  },

  imageGallery: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 600,
    backgroundColor: 'rgba(255,255,255,0.02)',
    position: 'relative',
    alignSelf: 'center',
  },
  mainImage: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    // subtle depth for web
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    elevation: 3,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: SPACING.sm,
  },
  imagePlaceholderText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  discountBadge: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  discountText: {
    color: 'white',
    fontWeight: '800',
    fontSize: FONT_SIZE.sm,
  },
  zoomButton: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailStrip: {
    position: 'absolute',
    bottom: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
  },
  thumbnailContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  variantChipRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  variantChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.md,
  },
  variantChip: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: SPACING.sm,
  },
  variantChipActive: {
    backgroundColor: COLORS.accent + '18',
    borderColor: COLORS.accent,
  },
  variantChipText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  variantChipTextActive: {
    color: COLORS.accent,
  },
  thumb: {
    width: 65,
    height: 65,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbActive: {
    borderColor: COLORS.accent,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },

  // Store Info
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'flex-start',
  },
  storeLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  storeLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  storeTextContainer: {
    flex: 1,
  },
  storeLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  storeName: {
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },

  // Info Section
  infoSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  productTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: 34,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    marginLeft: SPACING.sm,
    color: COLORS.text,
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  reviewCount: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  priceSection: {
    gap: SPACING.xs,
  },
  price: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.accent2,
  },
  currency: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  comparePrice: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },

  // Options
  optionsSection: {
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
    color: COLORS.text,
  },
  optionContainer: {
    gap: SPACING.sm,
  },
  optionName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  optionValuesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionValue: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  optionValueSelected: {
    backgroundColor: COLORS.accent + '20',
    borderColor: COLORS.accent,
  },
  optionValueText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.sm,
  },
  optionValueTextSelected: {
    color: COLORS.accent,
    fontWeight: '700',
  },

  // Quantity
  quantitySection: {
    gap: SPACING.sm,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '900',
    color: COLORS.text,
    minWidth: 50,
    textAlign: 'center',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chatButtonDisabled: {
    opacity: 0.6,
  },
  chatButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  followButtonDisabled: {
    opacity: 0.6,
  },
  followButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },

  // Tabs
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  tabButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabButtonActive: {
    backgroundColor: COLORS.accent + '25',
  },
  tabButtonText: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  tabButtonTextActive: {
    color: COLORS.accent,
  },

  // Tab Content
  tabContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.lg,
  },
  tabSectionLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '900',
    color: COLORS.text,
  },
  descriptionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  descriptionText: {
    color: COLORS.textSoft,
    lineHeight: 24,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accent + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
  },
  categoryText: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: FONT_SIZE.xs,
  },

  // Characteristics
  characteristicsGrid: {
    gap: SPACING.md,
  },
  characteristicItem: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  characteristicName: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: FONT_SIZE.xs,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  characteristicValues: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },

  // Reviews
  reviewForm: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  reviewInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  reviewInputMultiline: {
    textAlignVertical: 'top',
    minHeight: 100,
  },
  reviewNotice: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  ratingSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  ratingSelectorLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  ratingSelectorStars: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  submitReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  submitReviewButtonDisabled: {
    opacity: 0.6,
  },
  submitReviewButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  reviewsLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  reviewsList: {
    gap: SPACING.md,
  },
  reviewItem: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  reviewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    color: COLORS.accent,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewAuthor: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  reviewDate: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  reviewRatingRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: SPACING.md,
  },
  reviewText: {
    color: COLORS.textSoft,
    lineHeight: 20,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },

  // Similar Products
  productsGridRow: {
    gap: SPACING.md,
    paddingHorizontal: 0,
  },
  similarProductCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  similarProductImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  similarProductImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarProductName: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  similarProductPrice: {
    color: COLORS.accent2,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    zIndex: 50,
  },
  bottomPriceCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  bottomPriceLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  bottomPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.accent,
  },
  bottomCurrency: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    flexShrink: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minWidth: 100,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 90,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },

  // Image Viewer
  imageViewer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    zIndex: 200,
  },
  viewerClose: {
    position: 'absolute',
    left: SPACING.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerPagination: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  paginationDotActive: {
    backgroundColor: 'white',
    width: 24,
  },

  // Empty states
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  
  // Option Color overrides
  optionColorValue: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  optionColorValueSelected: {
    borderColor: COLORS.accent,
  },
  colorCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  
  // Delivery Section
  deliverySection: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  deliveryCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: SPACING.md,
    alignItems: 'center',
  },
  deliveryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryTextContainer: {
    flex: 1,
  },
  deliveryTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  deliverySubtitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  deliveryPrice: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
  cityFeesList: {
    gap: 4,
  },
  cityFeeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cityFeeName: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  cityFeePrice: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
});
};

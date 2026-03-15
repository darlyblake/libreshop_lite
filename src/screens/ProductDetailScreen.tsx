import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '../config/theme';
import { useResponsive } from '../utils/responsive';
import { useCartStore } from '../store';
import { useAuthStore } from '../store';
import { wishlistService } from '../lib/wishlistService';
import { LikeButton } from '../components';
import {
  productService,
  reviewService,
  storeService,
  type Product,
  type ProductReview,
  type Store,
} from '../lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ProductDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, isDesktop } = useResponsive();

  const { addItem, items } = useCartStore();
  const { user } = useAuthStore();

  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<string>>(null);

  const { productId } = route.params || {};

  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [cartButtonAnimation, setCartButtonAnimation] = useState(false);

  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const isWideScreen = width >= 1024;

  // Vérifier si le produit est dans les favoris
  const checkIfFavorite = async () => {
    if (!user?.id || !productId) return;
    
    try {
      const favorites = await wishlistService.getByUser(String(user.id));
      const isFav = favorites.some(item => item.product_id === productId);
      setIsFavorite(isFav);
    } catch (error: any) {
      console.warn('Error checking favorite status:', error);
      // Si la table n'existe pas, considérer comme non favori
      if (error?.code === 'PGRST116' || error?.message?.includes('Could not find the table')) {
        setIsFavorite(false);
      }
    }
  };

  // Ajouter/retirer des favoris
  const toggleFavorite = async () => {
    if (!user?.id || !productId) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour ajouter des favoris');
      return;
    }

    try {
      setLoadingFavorite(true);
      
      if (isFavorite) {
        // Retirer des favoris
        await wishlistService.remove(String(user.id), productId);
        setIsFavorite(false);
        Alert.alert('Succès', 'Produit retiré des favoris');
      } else {
        // Ajouter aux favoris
        await wishlistService.add(String(user.id), productId);
        setIsFavorite(true);
        Alert.alert('Succès', 'Produit ajouté aux favoris');
      }
      
      void Haptics.notificationAsync(
        isFavorite ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
      );
    } catch (error: any) {
      console.warn('Error toggling favorite:', error);
      
      if (error?.code === 'PGRST116' || error?.message?.includes('Could not find the table')) {
        Alert.alert('Info', 'La fonctionnalité favoris sera bientôt disponible');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour les favoris');
      }
    } finally {
      setLoadingFavorite(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (!productId) {
          if (mounted) setLoading(false);
          return;
        }

        const p = (await productService.getById(String(productId))) as Product;
        if (!mounted) return;
        setProduct(p);

        if (p?.store_id) {
          const s = (await storeService.getById(String(p.store_id))) as Store;
          if (!mounted) return;
          setStore(s);
        }

        // Vérifier si le produit est dans les favoris
        if (mounted) {
          await checkIfFavorite();
        }
      } catch (e) {
        console.warn('failed to load product', e);
        Alert.alert('Erreur', 'Impossible de charger le produit');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [productId, user?.id]);

  // Mettre à jour le compteur de favoris dans le profil quand on change l'état
  useEffect(() => {
    // Déclencher une mise à jour du compteur dans le profil
    if (user?.id) {
      // Le profil écoute déjà les changements via son propre useEffect
      // Mais on peut forcer une mise à jour si nécessaire
    }
  }, [isFavorite, user?.id]);

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
        console.warn('failed to load reviews', e);
      } finally {
        if (mounted) setReviewsLoading(false);
      }
    };

    void loadReviews();
    return () => {
      mounted = false;
    };
  }, [productId]);

  const productData = useMemo(() => {
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price,
      comparePrice: (product as any).compare_price ?? product.compare_price,
      images: Array.isArray(product.images) ? product.images : [],
      store: store
        ? {
            id: store.id,
            name: store.name,
            logoUrl: store.logo_url || '',
            verified: true,
          }
        : null,
      inStock: (product.stock ?? 0) > 0,
      category: product.category || '',
    };
  }, [product, store]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return null;
    const avg = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length;
    return Math.round(avg * 10) / 10;
  }, [reviews]);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [100, 70],
    extrapolate: 'clamp',
  });

  const increaseQuantity = () => {
    setQuantity((q) => q + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const decreaseQuantity = () => {
    setQuantity((q) => Math.max(1, q - 1));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const normalizeWhatsappNumber = (raw: string) => {
    if (!raw) return null;
    const cleaned = String(raw).trim().replace(/[^0-9+]/g, '');
    const waNumber = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
    return waNumber || null;
  };

  const handleDiscussWithSeller = async () => {
    const raw = String((store as any)?.whatsapp_number || (store as any)?.phone || (store as any)?.phone_number || '').trim();
    const waNumber = normalizeWhatsappNumber(raw);
    if (!waNumber) {
      Alert.alert('Discuter', "Le vendeur n'a pas de numéro WhatsApp renseigné.");
      return;
    }

    const text = `Bonjour, je suis intéressé par: ${productData?.name || 'ce produit'}`;
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
        return;
      }

      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('WhatsApp', "Impossible d'ouvrir WhatsApp sur cet appareil.");
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      console.warn('open whatsapp failed', e);
      Alert.alert('Erreur', "Impossible d'ouvrir WhatsApp.");
    }
  };

  const submitReview = async () => {
    try {
      if (!product) return;

      const name = reviewName.trim();
      const comment = reviewComment.trim();

      if (!name) {
        Alert.alert('Erreur', 'Veuillez entrer votre nom');
        return;
      }
      if (!comment) {
        Alert.alert('Erreur', 'Veuillez entrer un commentaire');
        return;
      }
      if (reviewRating < 1 || reviewRating > 5) {
        Alert.alert('Erreur', 'La note doit être entre 1 et 5');
        return;
      }

      setSubmittingReview(true);
      await reviewService.create({
        product_id: product.id,
        user_name: name,
        rating: reviewRating,
        comment,
      });

      setReviewName('');
      setReviewRating(5);
      setReviewComment('');

      const data = await reviewService.getByProduct(String(product.id));
      setReviews(data);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn('failed to create review', e);
      Alert.alert('Erreur', "Impossible d'envoyer votre avis");
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderImageGallery = () => (
    <View style={[styles.imageSection, isWideScreen && styles.imageSectionDesktop]}>
      <View style={styles.imageWrapper}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if ((productData?.images?.length || 0) === 0) return;
            setImageViewerVisible(true);
          }}
          style={styles.mainImageTouchable}
        >
          {loading ? (
            <View style={[styles.mainImage, styles.loaderContainer]}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
          ) : productData?.images?.[selectedImageIndex] ? (
            <Image
              source={{ uri: productData.images[selectedImageIndex] }}
              style={styles.mainImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.mainImage, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.imagePlaceholderText}>Aucune image</Text>
            </View>
          )}

          {!!productData?.comparePrice && !!productData?.price && (
            <LinearGradient
              colors={[COLORS.danger, '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.discountBadge}
            >
              <Text style={styles.discountText}>
                -{Math.round((1 - productData.price / productData.comparePrice) * 100)}%
              </Text>
            </LinearGradient>
          )}

          <BlurView intensity={80} tint="dark" style={styles.zoomButton}>
            <Ionicons name="expand-outline" size={20} color="white" />
          </BlurView>
        </TouchableOpacity>

        {(productData?.images?.length || 0) > 1 && (
          <FlatList
            ref={flatListRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={productData?.images || []}
            keyExtractor={(_, index) => index.toString()}
            contentContainerStyle={styles.thumbnailStrip}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={() => {
                  setSelectedImageIndex(index);
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.thumb, selectedImageIndex === index && styles.thumbActive]}
                activeOpacity={0.85}
              >
                <Image source={{ uri: item }} style={styles.thumbImage} resizeMode="contain" />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );

  const renderStorePill = () => {
    if (!productData?.store?.id) return null;
    return (
      <TouchableOpacity
        style={styles.shopBrand}
        onPress={() => navigation.navigate('StoreDetail', { storeId: productData.store.id })}
        activeOpacity={0.85}
      >
        {productData.store.logoUrl ? (
          <Image source={{ uri: productData.store.logoUrl }} style={styles.shopImg} />
        ) : (
          <View style={styles.shopImgPlaceholder} />
        )}
        <Text style={styles.shopName} numberOfLines={1}>
          {productData.store.name}
        </Text>
        {productData.store.verified && <Ionicons name="checkmark-circle" size={16} color={COLORS.info} />}
      </TouchableOpacity>
    );
  };

  const AnimatedHeader = () => (
    <Animated.View
      style={[
        styles.animatedHeader,
        {
          height: headerHeight,
          opacity: headerOpacity,
          paddingTop: insets.top,
        },
      ]}
    >
      <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.animatedHeaderContent}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('ClientTabs', { screen: 'ClientHome' })}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.animatedHeaderTitle} numberOfLines={1}>
          {productData?.name || ''}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Cart')}>
            <View style={styles.cartIconContainer}>
              <Ionicons name="bag-handle" size={22} color="white" />
              {items.length > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{items.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => Alert.alert('Partager', 'Fonctionnalité à venir')}>
            <Ionicons name="share-outline" size={22} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggleFavorite}
            disabled={loadingFavorite}
          >
            {loadingFavorite ? (
              <ActivityIndicator size="small" color={COLORS.danger} />
            ) : (
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={22} color={isFavorite ? COLORS.danger : 'white'} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={[COLORS.bg, '#0e1018', COLORS.bg]} style={StyleSheet.absoluteFill} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </View>
    );
  }

  if (!productData) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={[COLORS.bg, '#0e1018', COLORS.bg]} style={StyleSheet.absoluteFill} />
        <View style={[styles.centerState, { padding: SPACING.lg }]}> 
          <Text style={styles.notFoundTitle}>Produit introuvable</Text>
          <TouchableOpacity style={styles.backCta} onPress={() => navigation.navigate('ClientTabs', { screen: 'ClientHome' })} activeOpacity={0.85}>
            <Text style={styles.backCtaText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={[COLORS.bg, '#0e1018', COLORS.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <AnimatedHeader />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
      >
        <View style={styles.pageCenter}>
          <BlurView intensity={24} tint="dark" style={styles.productCard}>
            <View style={[styles.productGrid, isWideScreen && styles.productGridDesktop]}>
              {renderImageGallery()}

              <View style={styles.productInfo}>
                {renderStorePill()}

                <Text style={[styles.productTitle, isDesktop && styles.productTitleDesktop]}>{productData.name}</Text>

                <View style={styles.ratingRow}>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((i) => {
                      const filled = (averageRating ?? 0) >= i;
                      const half = !filled && (averageRating ?? 0) >= i - 0.5;
                      return (
                        <Ionicons
                          key={i}
                          name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
                          size={18}
                          color="#FFB800"
                        />
                      );
                    })}
                    <Text style={styles.ratingValue}>{averageRating ? `(${averageRating})` : '(—)'}</Text>
                  </View>
                  <Text style={styles.reviewsCount}>{reviews.length} avis</Text>
                </View>

                <View style={styles.priceCart}>
                  <Text style={styles.price}>
                    {productData.price.toLocaleString()} <Text style={styles.currency}>FCFA</Text>
                  </Text>
                  <View style={styles.buttonsRow}>
                    <TouchableOpacity
                      style={[styles.buyNowBtn, !productData.inStock && styles.buyNowBtnDisabled]}
                      onPress={() => {
                        if (!productData.inStock) return;
                        if (!product) {
                          Alert.alert('Erreur', 'Produit indisponible');
                          return;
                        }
                        addItem(product, quantity);
                        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        navigation.navigate('Cart');
                      }}
                      disabled={!productData.inStock}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="flash" size={18} color="white" />
                      <Text style={styles.buyNowText}>Acheter maintenant</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.addToCartBtn, 
                        !productData.inStock && styles.addToCartBtnDisabled,
                        cartButtonAnimation && styles.addToCartBtnAnimated
                      ]}
                      onPress={() => {
                        if (!productData.inStock) return;
                        if (!product) {
                          Alert.alert('Erreur', 'Produit indisponible');
                          return;
                        }
                        addItem(product, quantity);
                        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Succès', 'Produit ajouté au panier !');
                        
                        // Animation feedback
                        setCartButtonAnimation(true);
                        setTimeout(() => setCartButtonAnimation(false), 300);
                      }}
                      disabled={!productData.inStock}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="bag-handle" size={18} color="white" />
                      <Text style={styles.addToCartText}>Ajouter au panier</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.chatBtn} onPress={handleDiscussWithSeller} activeOpacity={0.85}>
                  <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
                  <Text style={styles.chatBtnText}>Discuter avec le vendeur</Text>
                </TouchableOpacity>

                <View style={styles.likeSection}>
                  <LikeButton 
                    userId={user?.id ? String(user.id) : ''} 
                    productId={String(productId || '')}
                    showCount={true}
                    size={24}
                  />
                </View>

                <View style={styles.descriptionSection}>
                  <Text style={styles.sectionLabel}>Description</Text>
                  <View style={styles.descriptionCard}>
                    <Text style={styles.descriptionText}>
                      {productData.description?.trim() ? productData.description : 'Aucune description disponible.'}
                    </Text>
                  </View>
                </View>

                {!!productData.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{productData.category}</Text>
                  </View>
                )}

                <View style={styles.quantitySection}>
                  <Text style={styles.sectionLabel}>Quantité</Text>
                  <View style={styles.quantityContainer}>
                    <TouchableOpacity
                      style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
                      onPress={decreaseQuantity}
                      disabled={quantity <= 1}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="remove" size={20} color={quantity <= 1 ? COLORS.textMuted : COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <TouchableOpacity style={styles.quantityButton} onPress={increaseQuantity} activeOpacity={0.85}>
                      <Ionicons name="add" size={20} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.commentsSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="chatbubbles" size={18} color={COLORS.accent2} />
                <Text style={styles.sectionTitle}>
                  Commentaires{productData?.store?.name ? ` · ${productData.store.name}` : ''}
                </Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>★ {averageRating ?? '—'}</Text>
                </View>
              </View>

              <View style={styles.composer}>
                <TextInput
                  value={reviewName}
                  onChangeText={setReviewName}
                  placeholder="Votre nom"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.inputPill}
                />

                <View style={styles.composerRow}>
                  <TextInput
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    placeholder="Votre commentaire..."
                    placeholderTextColor={COLORS.textMuted}
                    style={[styles.inputPill, styles.inputFlex]}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, submittingReview && styles.sendBtnDisabled]}
                    onPress={submitReview}
                    disabled={submittingReview}
                    activeOpacity={0.85}
                  >
                    {submittingReview ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Ionicons name="paper-plane" size={18} color={COLORS.white} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.inlineRatingRow}>
                  <Text style={styles.inlineRatingLabel}>Note</Text>
                  <View style={styles.inlineRatingStars}>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <TouchableOpacity key={r} onPress={() => setReviewRating(r)} activeOpacity={0.7}>
                        <Ionicons name={r <= reviewRating ? 'star' : 'star-outline'} size={18} color="#FFB800" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {reviewsLoading ? (
                <View style={styles.emptyBox}>
                  <ActivityIndicator color={COLORS.accent} />
                </View>
              ) : reviews.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Aucun avis pour le moment</Text>
                </View>
              ) : (
                <View style={styles.commentList}>
                  {reviews.map((review) => (
                    <View key={review.id} style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>
                            {(review.user_name || '?').slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.commentAuthor} numberOfLines={1}>
                          {review.user_name}
                        </Text>
                        <Text style={styles.commentDate}>
                          {new Date(review.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={styles.commentText}>{review.comment}</Text>
                      <View style={styles.commentLike}>
                        <Ionicons name="heart-outline" size={16} color={COLORS.textMuted} />
                        <Text style={styles.commentLikeCount}>0</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </BlurView>
        </View>
      </Animated.ScrollView>

      {imageViewerVisible && productData.images.length > 0 && (
        <View style={styles.imageViewer}>
          <TouchableOpacity style={styles.closeViewer} onPress={() => setImageViewerVisible(false)}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={productData.images}
            keyExtractor={(_, index) => index.toString()}
            initialScrollIndex={Math.min(selectedImageIndex, productData.images.length - 1)}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setSelectedImageIndex(index);
            }}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
                <Image source={{ uri: item }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            )}
          />

          <View style={styles.viewerPagination}>
            {productData.images.map((_, index) => (
              <View key={index} style={[styles.paginationDot, index === selectedImageIndex && styles.paginationDotActive]} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  backCta: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCtaText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  pageCenter: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
    paddingTop: 110,
    alignItems: 'center',
  },
  productCard: {
    width: '100%',
    maxWidth: 1100,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: 'rgba(22, 25, 34, 0.72)',
    padding: SPACING.xl,
  },
  productGrid: {
    gap: SPACING.xl,
  },
  productGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageSection: {
    backgroundColor: 'transparent',
  },
  imageSectionDesktop: {
    flexBasis: '42%',
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: 560,
  },
  imageWrapper: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 32,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  mainImageTouchable: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  mainImage: {
    width: '100%',
    height: '100%',
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
    color: COLORS.white,
    fontWeight: '800',
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
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  thumb: {
    width: 65,
    height: 65,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 8,
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
  productInfo: {
    flex: 1,
    minWidth: 0,
    gap: SPACING.md,
  },
  shopBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'flex-start',
  },
  shopImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  shopImgPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  shopName: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
    maxWidth: 220,
  },
  productTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: 40,
  },
  productTitleDesktop: {
    fontSize: 42,
    lineHeight: 48,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingValue: {
    marginLeft: SPACING.sm,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  reviewsCount: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  priceCart: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  price: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.accent2,
  },
  currency: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  addToCartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  addToCartBtnDisabled: {
    opacity: 0.6,
  },
  addToCartText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  addToCartBtnAnimated: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    transform: [{ scale: 1.05 }],
  },
  buyNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  buyNowBtnDisabled: {
    opacity: 0.6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  buyNowText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  likeBtnLiked: {
    borderColor: 'rgba(244, 63, 94, 0.8)',
  },
  likeBtnText: {
    color: '#b91c1c',
    fontWeight: '900',
  },
  likeCountText: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  likeSection: {
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'flex-start',
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  chatBtnText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: FONT_SIZE.md,
  },
  descriptionSection: {
    gap: SPACING.sm,
  },
  descriptionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 28,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  descriptionText: {
    color: COLORS.textSoft,
    lineHeight: 22,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accent + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent + '33',
  },
  categoryText: {
    color: COLORS.accent,
    fontWeight: '800',
    fontSize: FONT_SIZE.xs,
  },
  quantitySection: {
    marginTop: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
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
  commentsSection: {
    marginTop: SPACING.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 32,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    flex: 1,
    color: COLORS.text,
    fontWeight: '900',
    fontSize: FONT_SIZE.lg,
  },
  sectionBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.16)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  sectionBadgeText: {
    color: COLORS.text,
    fontWeight: '900',
  },
  composer: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  inputPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
  inputFlex: {
    flex: 1,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  inlineRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  inlineRatingLabel: {
    color: COLORS.textMuted,
    fontWeight: '900',
  },
  inlineRatingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  emptyBox: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  commentList: {
    gap: SPACING.md,
  },
  commentItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    color: COLORS.white,
    fontWeight: '900',
  },
  commentAuthor: {
    flex: 1,
    color: COLORS.text,
    fontWeight: '900',
  },
  commentDate: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  commentText: {
    color: COLORS.textSoft,
    lineHeight: 20,
    fontWeight: '600',
  },
  commentLike: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  commentLikeCount: {
    color: COLORS.textMuted,
    fontWeight: '900',
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  animatedHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
  animatedHeaderTitle: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    marginHorizontal: SPACING.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cartIconContainer: {
    position: 'relative',
    width: 22,
    height: 22,
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.8)',
  },
  cartBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  imageViewer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    zIndex: 1000,
  },
  closeViewer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1001,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  viewerPagination: {
    position: 'absolute',
    bottom: 50,
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
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  paginationDotActive: {
    backgroundColor: COLORS.accent,
    width: 20,
  },
});

export default ProductDetailScreen;

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  errorHandler,
  ErrorCategory,
  ErrorSeverity,
} from "../utils/errorHandler";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "../config/theme";
import { useResponsive } from "../utils/responsive";
import { useCartStore } from "../store";
import { useAuthStore } from "../store";
import { useTheme } from "../hooks/useTheme";
import { LikeButton, SkeletonLoader, TabContent } from "../components";
import { type Product, type ProductReview, type Store } from '../lib/supabase';
import { productService } from '../services/productService';
import { reviewService } from '../services/reviewService';
import { cloudinaryService } from '../services/cloudinaryService';
import { storeService } from '../services/storeService';
import { productLikesService } from '../services/productLikesService';
import { authService } from '../services/authService';
import { contactStore } from '../services/contactService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const ProductDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, isDesktop } = useResponsive();
  const {
    theme,
    getColor: COLORS,
    spacing: SPACING,
    radius: RADIUS,
  } = useTheme();

  const isDarkTheme = Boolean((theme as any)?.isDark ?? false);
  const STAR_COLOR = (COLORS as any)?.star ?? '#f1c40f';
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
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const [activeTab, setActiveTab] = useState<'description' | 'characteristics' | 'reviews' | 'similar'>('description');

  const isWideScreen = width >= 1024;

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

        // Track analytics view
        if (p?.id) {
          void productService.incrementViews(p.id);
        }

        if (p?.store_id) {
          const s = (await storeService.getById(String(p.store_id))) as Store;
          if (!mounted) return;
          setStore(s);
        }
      } catch (e) {
        errorHandler.handle(
          e,
          "failed to load product",
          ErrorCategory.SYSTEM,
          ErrorSeverity.LOW,
        );
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
        errorHandler.handle(
          e,
          "failed to load reviews",
          ErrorCategory.SYSTEM,
          ErrorSeverity.LOW,
        );
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
    };
  }, [product, store]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return null;
    const avg =
      reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) /
      reviews.length;
    return Math.round(avg * 10) / 10;
  }, [reviews]);

  // Générateur d'HTML pour la version web (affichage statique proche du mock fourni)
  const buildWebHtml = (pd: any, qty: number) => {
    if (!pd) return '<div>Produit introuvable</div>';
    const title = pd.name || 'Produit';
    const price = pd.price ? `${pd.price.toLocaleString()} FCFA` : '';
    const oldPrice = pd.comparePrice ? `${pd.comparePrice.toLocaleString()} FCFA` : '';
    const img = pd.images && pd.images.length ? pd.images[0] : 'https://images.pexels.com/photos/2529157/pexels-photo-2529157.jpeg?auto=compress&cs=tinysrgb&w=800';
    const wa = (pd.store && (pd.store.whatsapp_number || pd.store.phone)) || '';
    const waNumber = String(wa).replace(/[^0-9+]/g, '').replace(/^\+/, '');
    const waMessage = `Bonjour, je suis intéressé(e) par ${title} (quantité: ${qty}).`;
    const waText = encodeURIComponent(waMessage);

    return `
      <!doctype html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title} | Boutique</title>
        <link rel="stylesheet" href="/product-detail.css" />
        <script>
          function openContact(phone, message){
            try{
              var txt = message || '';
              if (phone) {
                var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(txt);
                window.open(url, '_blank');
                return;
              }
              var url = 'https://wa.me/?text=' + encodeURIComponent(txt);
              window.open(url, '_blank');
            }catch(e){
              console.error(e);
              try{ alert('Impossible d ouvrir WhatsApp'); }catch(_){}
            }
          }
        </script>
      </head>
      <body>
        <div class="product-card">
            <div class="product-image">
            <img src="${img}" alt="${title}" />
            <div class="badge-new">✨ Nouveauté</div>
            <a class="magnifier" href="${img}" target="_blank" rel="noreferrer">🔍</a>
          </div>
          <div class="content-inner">
            <div class="brand">${(pd.store && pd.store.name) || 'Savelle • Paris'}</div>
            <h1 class="title">${title}</h1>
            <div class="subtitle"><span>Modèle Icone 2026</span><span class="limited-tag">Édition Limitée</span></div>
            <div class="rating"><div class="stars">★★★★★</div><span class="rating-text">4.9 <span class="rating-count">(128 avis vérifiés)</span></span></div>
            <div class="price-block"><span class="price">${price}</span>${oldPrice?`<span class="old-price">${oldPrice}</span>`:''}<span class="installment">${pd.comparePrice?`-${Math.round((1 - (pd.price||0)/(pd.comparePrice||1))*100)}%`:''}</span></div>
            <div class="color-option"><div class="color-dot"></div><span class="color-label"><strong>Noir Intemporel</strong> • Cuir grainé</span></div>
            <p class="description">${pd.description || "L'accessoire signature. Finitions soignées."}</p>
            <div class="actions"><div class="quantity">−&nbsp;<span id="qty">${qty}</span>&nbsp;+</div><button class="btn btn-buy" onclick="alert('Simulation: achat ${qty} × ${title}')">⚡ Acheter maintenant</button></div>
            <button class="btn btn-cart" onclick="alert('Ajouté au panier: ${qty} × ${title}')">🛒 Ajouter au panier</button>
            <a class="whatsapp-btn" href="#" onclick="openContact(${waNumber ? `'${waNumber}'` : 'null'}, ${JSON.stringify(waMessage)}); return false;">💬 Discuter sur WhatsApp</a>
            <div class="tabs"><div class="tab active">Description</div><div class="tab">Caractéristiques</div><div class="tab">Avis (128)</div></div>
            <div class="reviews"><div><strong>Ce que disent nos clientes</strong><br/><span class="muted-small">⭐ 98% recommandent</span></div><div class="review-avatars"></div></div>
            <div class="similar-title"><span>✨ Vous pourriez aimer</span></div>
            <div class="similar">
              <div class="similar-item"><img src="https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=400" alt="s"/><div class="similar-price">72 000 FCFA</div></div>
            </div>
          </div>
        </div>
        <div class="footer-note">Livraison offerte • Paiement sécurisé</div>
      </body>
      </html>
    `;
  };

  // Composant web réactif et connecté aux fonctions de l'app
  const WebProductView: React.FC = () => {
    if (!productData) return null;

    const waNumberRaw = (productData.store && ((productData.store as any).whatsapp_number || (productData.store as any).phone)) || '';
    const waNumber = String(waNumberRaw).replace(/[^0-9+]/g, '').replace(/^\+/, '');
    const waMessage = `Bonjour, je suis intéressé(e) par ${productData.name} (quantité: ${quantity}).`;
    const waText = encodeURIComponent(waMessage);

    const [similarProducts, setSimilarProducts] = React.useState<any[]>([]);

    React.useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          // getSimilarProducts expects a full Product object from the DB (with store_id, collection_id, etc.)
          if (!product) return;
          const sims = await productService.getSimilarProducts(product, 6);
          if (mounted && Array.isArray(sims)) setSimilarProducts(sims);
        } catch (e) {
          console.error('failed to load similar products', e);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [product]);

    const [webLightboxVisible, setWebLightboxVisible] = React.useState(false);
    const [webLikeAnim, setWebLikeAnim] = React.useState(false);

    const handleBack = () => {
      try {
        if (navigation && (navigation as any).canGoBack && (navigation as any).canGoBack()) {
          navigation.goBack();
          return;
        }
      } catch (e) {
        // ignore
      }
      if (typeof window !== 'undefined') window.history.back();
    };

    const goToCart = () => {
      try {
        navigation.navigate('Cart');
        return;
      } catch (e) {
        if (typeof window !== 'undefined') window.location.href = '/cart';
      }
    };
    const cartCount = useCartStore((s) => s.items.length);

    // Web like button state & handlers (moved here to keep hooks order)
    const [webLiked, setWebLiked] = React.useState<boolean>(false);
    const [webLikeCount, setWebLikeCount] = React.useState<number>(0);

    const loadWebLike = async () => {
      try {
        if (!productData?.id) return;
        const count = await productLikesService.getLikesCount(String(productData.id));
        let liked = false;
        if (user?.id) liked = await productLikesService.hasLiked(String(user.id), String(productData.id));
        setWebLikeCount(count || 0);
        setWebLiked(Boolean(liked));
      } catch (e) {
        console.error('failed to load web like', e);
      }
    };

    React.useEffect(() => {
      void loadWebLike();
    }, [productData, user?.id]);

    const toggleWebLike = async () => {
      try {
        // trigger local animation immediately
        setWebLikeAnim(true);
        setTimeout(() => setWebLikeAnim(false), 380);
        if (!productData?.id) return;
        let effectiveUserId = user?.id;
        if (!effectiveUserId) {
          // create anonymous session if needed
          const res: any = await authService.signInAnonymously();
          effectiveUserId = res?.data?.session?.user?.id;
        }
        if (!effectiveUserId) {
          Alert.alert('Erreur', 'Impossible d\'identifier l\'utilisateur pour le like');
          return;
        }
        const newLiked = await productLikesService.toggleLike(effectiveUserId, String(productData.id));
        const count = await productLikesService.getLikesCount(String(productData.id));
        setWebLiked(Boolean(newLiked));
        setWebLikeCount(count || 0);
      } catch (e) {
        console.error('toggle like failed', e);
        // If the DB rejected due to missing users row (23503), fallback to localStorage for web
        try {
          const err: any = e as any;
          if (err?.code === '23503' || (err?.message && String(err.message).includes('product_likes_user_id_fkey'))) {
            // store a local like so the UI feels responsive; sync when user signs in
            const key = 'libreshop_web_likes';
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
            const likes = raw ? JSON.parse(raw) : {};
            likes[String(productData.id)] = true;
            if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(likes));
            setWebLiked(true);
            setWebLikeCount((c) => (Number(c || 0) + 1));
            Alert.alert('Like local', 'Like enregistré localement. Connectez‑vous pour le synchroniser.');
            return;
          }
        } catch (inner) {
          // ignore
        }

        Alert.alert('Erreur', 'Impossible de mettre à jour le like');
      }
    };

    const handleAddToCartWeb = () => {
      if (!product) return;
      try {
        // DEBUG: log product shape to help debugging when button is clicked
        // useCartStore expects a full Product object and optional quantity
        // eslint-disable-next-line no-console

        // Ensure product has a numeric stock field so store.addItem doesn't silently ignore it
        const productToAdd = { ...product, stock: typeof (product as any)?.stock === 'number' ? (product as any).stock : 9999 } as any;

        addItem(productToAdd, quantity);

        // eslint-disable-next-line no-console

        setCartButtonAnimation(true);
        setTimeout(() => setCartButtonAnimation(false), 600);
      } catch (e) {
        console.error(e);
      }
    };

    const handleBuyNowWeb = async () => {
      try {
        if (!product) return;

        // Re-check latest product state (stock/price) before checkout
        let latest = product;
        try {
          const p = await productService.getById(String(product.id));
          if (p) latest = p as any;
        } catch (e) {
          // ignore fetch errors and proceed with local product info
        }

        const available = Number((latest as any)?.stock || 0);
        if (available < quantity) {
          Alert.alert('Rupture de stock', 'La quantité demandée dépasse le stock disponible.');
          return;
        }

        // Build checkout items payload (single-item checkout)
        const itemsForCheckout = [
          {
            product: {
              id: String((latest as any).id),
              name: String((latest as any).name || productData.name || ''),
              price: Number((latest as any).price || productData.price || 0),
              images: (latest as any).images || productData.images || [],
              store_id: (latest as any).store_id || (product as any)?.store_id || (productData.store && (productData.store as any).id) || null,
            },
            quantity: Number(quantity || 1),
          },
        ];

        try {
          navigation.navigate('Checkout', { items: itemsForCheckout, storeId: itemsForCheckout[0].product.store_id });
          return;
        } catch (e) {
          // Fallback for web if navigation fails
          if (typeof window !== 'undefined') {
            // encode items as JSON in query if small, else redirect to /checkout
            try {
              const itemsJson = encodeURIComponent(JSON.stringify(itemsForCheckout));
              window.location.href = `/checkout?itemsJson=${itemsJson}`;
              return;
            } catch (err) {
              window.location.href = '/checkout';
              return;
            }
          }
        }
      } catch (e) {
        console.error('buy now failed', e);
        Alert.alert('Erreur', "Impossible de lancer l'achat pour le moment.");
      }
    };

    const handleOpenProduct = (id: string) => {
      try {
        navigation.navigate('ProductDetail', { productId: String(id) });
      } catch (e) {
        if (typeof window !== 'undefined') window.location.href = `/product/${id}`;
      }
    };

    const webCss = `
      .web-container{width:100%;max-width:1200px;margin:0 auto;padding:12px}
      .web-card{display:flex;flex-direction:column;background:#fff;border-radius:20px;overflow:visible;box-shadow:0 12px 30px rgba(0,0,0,0.06);position:relative}
      .web-image-wrapper{display:flex;flex-direction:column;align-items:stretch}
      .web-image{width:100%;height:auto;object-fit:cover;display:block}
      .web-content{padding:20px}
      .web-title{font-size:26px;font-weight:800;margin:6px 0}
      .web-price{font-size:28px;color:#4c1d95;font-weight:800}
      .web-actions{display:flex;gap:12px;margin-top:12px}
      .web-qty{display:inline-flex;align-items:center;gap:12px;border-radius:12px;background:#f4f4f4;padding:8px 12px;font-weight:700}
      .web-btn{padding:12px 16px;border-radius:12px;border:none;cursor:pointer;font-weight:700}
      .web-buy{background:#6b21a8;color:#fff}
      .web-cart{background:#fff;border:1px solid #e6d9ff;color:#4c1d95}
      .web-tabs{display:flex;gap:8px;margin-top:18px;border-bottom:1px solid #eee}
      .web-tab{padding:10px 12px;cursor:pointer;color:#666}
      .web-tab.active{color:#111;border-bottom:3px solid #6b21a8;font-weight:700}
      .web-section{padding:14px 0}
      .web-top-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0}
      .web-top-actions .left{display:flex;align-items:center;gap:8px}
      .btn-back,.btn-visit{padding:8px 10px;border-radius:10px;border:none;cursor:pointer;font-weight:700}
      .btn-back{background:#f3f4f6;color:#111}
      .btn-visit{background:#6b21a8;color:white}
      .btn-cart{background:#fff;border:1px solid #eee;padding:8px 10px;border-radius:10px;cursor:pointer}
      .cart-badge{position:absolute;top:-6px;right:-6px;background:#e11d48;color:white;border-radius:999px;padding:2px 6px;font-size:11px;font-weight:700;min-width:18px;display:inline-flex;align-items:center;justify-content:center}
      .web-top-left{position:absolute;top:16px;left:16px;z-index:30;display:flex;gap:8px;align-items:center}
      /* Add to cart animation */
      .btn-pulse{animation:btnPulse 620ms cubic-bezier(.2,.9,.2,1)}
      @keyframes btnPulse{0%{transform:scale(1)}50%{transform:scale(1.06)}100%{transform:scale(1)}}

      /* Like pop animation */
      .like-anim{animation:likePop 380ms cubic-bezier(.2,.9,.2,1)}
      @keyframes likePop{0%{transform:scale(1)}40%{transform:scale(1.4)}100%{transform:scale(1)}}

      /* Discuss button styling */
      .web-discuss{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;background:transparent;border:1px dashed #c7b3ff;color:#4c1d95;text-decoration:none;font-weight:700}
      .web-discuss:hover{background:#f7f4ff;box-shadow:0 6px 18px rgba(76,29,149,0.06);transform:translateY(-1px)}
      .like-web-btn{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:#fff;border:1px solid #eee;cursor:pointer}
      .web-thumbs{display:flex;gap:8px;margin-top:10px;overflow:auto}
      /* On large screens place thumbnails as an overlay at bottom-left of image */
      @media(min-width:900px){
        .web-thumbs{position:absolute;left:12px;bottom:12px;gap:8px;margin-top:0;z-index:25;padding:8px;border-radius:10px;background:rgba(255,255,255,0.92)}
        .web-thumb{width:56px;height:56px;flex:0 0 56px}
      }
      .web-thumb{width:64px;height:64px;border-radius:8px;overflow:hidden;flex:0 0 64px;cursor:pointer;border:2px solid transparent}
      .web-thumb img{width:100%;height:100%;object-fit:cover}
      .web-thumb.active{border-color:#6b21a8}
      .web-lightbox{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);z-index:9999}
      .web-lightbox img{max-width:90%;max-height:90%;object-fit:contain}
      .web-lightbox .nav{position:absolute;top:50%;transform:translateY(-50%);font-size:28px;color:white;cursor:pointer;padding:12px}
      .web-lightbox .nav.left{left:12px}
      .web-lightbox .nav.right{right:12px}
      .web-lightbox .close{position:absolute;top:18px;right:18px;font-size:20px;color:white;cursor:pointer}
      .review{border-top:1px solid #f4f4f4;padding:12px 0;display:flex;gap:12px}
      .review-avatar{width:46px;height:46px;border-radius:50%;object-fit:cover}
      .review-body{flex:1}
      .review-name{font-weight:700}
      .review-rating{color:#f1c40f;margin-right:8px}
      .similar-title{font-weight:800;margin:18px 0 12px}
      .similar-grid{display:flex;gap:12px;flex-wrap:wrap}
      .similar-card{width:140px;border-radius:12px;overflow:hidden;background:#fff;border:1px solid #f4f4f4;padding:8px;text-align:center}
      .similar-img{width:100%;height:120px;object-fit:cover;border-radius:8px}
      .similar-name{font-size:13px;margin-top:8px;color:#333;height:36px;overflow:hidden}
      .similar-price{font-weight:800;color:#4c1d95;margin-top:6px}
      .promo-badge{display:inline-block;background:#e11d48;color:#fff;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:800;margin-left:8px}
      @media(min-width:900px){
        .similar-card{position:relative}
        .similar-card .promo-badge{position:absolute;left:8px;top:8px;z-index:20}
        .web-image-wrapper .promo-badge{position:absolute;left:12px;top:12px;z-index:30}
      }
      @media(min-width:900px){
        .web-card{flex-direction:row}
        .web-image-wrapper{width:55%;max-height:calc(100vh - 120px);overflow:visible;position:relative}
        .web-image{width:100%;height:auto;max-height:100%;object-fit:cover}
        .web-content{width:45%}
      }
    `;

    return (
      <div className="web-container">
        <style>{webCss}</style>
        <div className="web-card">
          <div className="web-top-left" role="toolbar" aria-label="Actions">
            <button className="btn-back" onClick={handleBack} aria-label="Retour" title="Retour">
              <Ionicons name="arrow-back" size={18} color="#111" />
            </button>
            <button className="btn-cart pos-relative" onClick={goToCart} aria-label="Panier" title="Panier">
              <Ionicons name="cart-outline" size={18} color="#111" />
              {cartCount > 0 && (
                <span className="cart-badge" aria-hidden>{cartCount}</span>
              )}
            </button>
          </div>
          <div className="web-image-wrapper">
            <img className="web-image cursor-pointer" onClick={() => setWebLightboxVisible(true)} src={(productData.images && productData.images[selectedImageIndex]) || (productData.images && productData.images[0]) || 'https://images.pexels.com/photos/2529157/pexels-photo-2529157.jpeg?auto=compress&cs=tinysrgb&w=800'} alt={productData.name} />
            {productData.images && productData.images.length > 1 && (
              <div className="web-thumbs">
                {productData.images.map((src: string, idx: number) => (
                  <div key={idx} className={`web-thumb ${selectedImageIndex === idx ? 'active' : ''}`} onClick={() => setSelectedImageIndex(idx)}>
                    <img src={cloudinaryService.getOptimizedUrl(src, 200)} alt={`thumb-${idx}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="web-content">
            <div className="store-name">{(productData.store && (productData.store as any).name) || 'Savelle • Paris'}</div>

            <div className="web-top-actions">
              <div className="left">
                <button className="btn-visit" onClick={() => { try { navigation.navigate('StoreDetail', { storeId: productData.store?.id }); } catch (e) { if (typeof window !== 'undefined') window.location.href = `/store/${productData.store?.id}`; } }}>Visiter la boutique</button>
              </div>
              <div>
                <button className={`like-web-btn ${webLikeAnim ? 'like-anim' : ''}`} onClick={() => void toggleWebLike()}>
                  <span className={`like-heart ${webLiked ? 'liked' : 'not-liked'}`}>{webLiked ? '❤' : '♡'}</span>
                  <span className="like-count">{webLikeCount}</span>
                </button>
              </div>
            </div>

            <div className="web-title">{productData.name}</div>
            <div className="flex-gap-center">
              <div className="web-price">{productData.price?.toLocaleString()} FCFA</div>
              {productData.comparePrice && productData.comparePrice > productData.price ? (
                <>
                  <div className="compare-line">{productData.comparePrice.toLocaleString()} FCFA</div>
                  <span className="promo-badge">Promo</span>
                </>
              ) : null}
            </div>
            <div className="description mt-12">{productData.description}</div>

            <div className="web-actions">
              <div className="web-qty">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
                <div>{quantity}</div>
                <button onClick={() => setQuantity((q) => Math.min(99, q + 1))}>+</button>
              </div>
              <button className="web-btn web-buy" onClick={handleBuyNowWeb}>⚡ Acheter maintenant</button>
            </div>

            <div className="mt-12 flex-gap-8">
              <button className={`web-btn web-cart ${cartButtonAnimation ? 'btn-pulse' : ''}`} onClick={handleAddToCartWeb}>🛒 Ajouter au panier</button>
              <a className={`web-btn web-discuss`} href="#" target="_blank" rel="noreferrer" onClick={(e:any) => { e.preventDefault(); void contactStore({ rawPhone: waNumberRaw, message: waMessage, fallback: 'tel-or-copy' }); }}>💬 Discuter</a>
            </div>
            <div className="mt-12">
              <div className="web-tabs">
                <div className={`web-tab ${activeTab === 'description' ? 'active' : ''}`} onClick={() => setActiveTab('description')}>Description</div>
                <div className={`web-tab ${activeTab === 'characteristics' ? 'active' : ''}`} onClick={() => setActiveTab('characteristics')}>Caractéristiques</div>
                <div className={`web-tab ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>Avis ({reviews.length})</div>
              </div>

              <div className="web-section">
                {activeTab === 'description' && (
                  <div>{productData.description || 'Aucune description fournie.'}</div>
                )}

                {activeTab === 'characteristics' && (
                  <div>
                    <div><strong>Catégorie :</strong> {productData.category || '—'}</div>
                    <div><strong>En stock :</strong> {productData.inStock ? 'Oui' : 'Non'}</div>
                    <div><strong>Magasin :</strong> {(productData.store && (productData.store as any).name) || '—'}</div>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div>
                    <div className="mb-12">
                      {reviews.length === 0 ? (
                        <div>Aucun avis pour le moment.</div>
                      ) : (
                        reviews.map((r) => (
                          <div key={r.id || Math.random()} className="review">
                            <img className="review-avatar" src={((r as any).avatar_url) || 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200'} alt={r.user_name || 'client'} />
                            <div className="review-body">
                              <div className="flex-gap-8">
                                <div className="review-name">{r.user_name || 'Anonyme'}</div>
                                <div className="review-rating">{'★'.repeat(Math.round(Number(r.rating) || 0))}</div>
                              </div>
                              <div className="review-comment">{r.comment}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="bt-top">
                      <div className="bold mb-8">Laissez un avis</div>
                      <input placeholder="Votre nom" value={reviewName} onChange={(e: any) => setReviewName(e.target.value)} className="input-full" />
                      <select value={String(reviewRating)} onChange={(e: any) => setReviewRating(Number(e.target.value))} className="select-style">
                        {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} étoiles</option>)}
                      </select>
                      <textarea placeholder="Votre commentaire" value={reviewComment} onChange={(e: any) => setReviewComment(e.target.value)} className="textarea-style" />
                      <div className="flex-gap-8-2">
                        <button className="web-btn web-buy" onClick={() => void submitReview()} disabled={submittingReview}>{submittingReview ? 'Envoi...' : 'Envoyer'}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {similarProducts.length > 0 && (
              <div className="similar-section">
                <div className="similar-title">Produits similaires</div>
                    <div className="similar-grid">
                  {similarProducts.map((sp) => (
                    <div key={sp.id} className="similar-card cursor-pointer" onClick={() => handleOpenProduct(sp.id)}>
                      {(sp.comparePrice && sp.comparePrice > sp.price) && (
                        <div className="promo-badge">Promo</div>
                      )}
                      <img className="similar-img" src={(sp.images && sp.images[0]) || 'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=400'} alt={sp.name} />
                      <div className="similar-name">{sp.name}</div>
                      <div className="similar-price">
                        {sp.price?.toLocaleString()} FCFA
                        {sp.comparePrice && sp.comparePrice > sp.price ? <div className="compare-line compare-small">{sp.comparePrice.toLocaleString()} FCFA</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {webLightboxVisible && productData.images && productData.images.length > 0 && (
          <div className="web-lightbox" onClick={() => setWebLightboxVisible(false)}>
            <div className="web-lightbox-inner wl-inner" onClick={(e) => e.stopPropagation()}>
              <div className="close" onClick={() => setWebLightboxVisible(false)}>✕</div>
              <div className="nav left" onClick={(e) => { e.stopPropagation(); setSelectedImageIndex((i) => (i - 1 + productData.images.length) % productData.images.length); }} onTouchStart={(e) => e.stopPropagation()}>&larr;</div>
              <img src={cloudinaryService.getOptimizedUrl(productData.images[selectedImageIndex], 1200)} alt="lightbox" onClick={(e) => e.stopPropagation()} />
              <div className="nav right" onClick={(e) => { e.stopPropagation(); setSelectedImageIndex((i) => (i + 1) % productData.images.length); }} onTouchStart={(e) => e.stopPropagation()}>&rarr;</div>
            </div>
          </div>
        )}

      </div>
    );
  };

  // NOTE: web render handled later after hooks to avoid Hooks ordering issues




  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [100, 70],
    extrapolate: "clamp",
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
    const cleaned = String(raw)
      .trim()
      .replace(/[^0-9+]/g, "");
    const waNumber = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
    return waNumber || null;
  };

  const handleDiscussWithSeller = async () => {
    const raw = String(
      (store as any)?.whatsapp_number ||
        (store as any)?.phone ||
        (store as any)?.phone_number ||
        "",
    ).trim();
    const text = `Bonjour, je suis intéressé par: ${productData?.name || "ce produit"}`;
    // Use central contact service with fallbacks
    await contactStore({ rawPhone: raw, message: text, fallback: 'tel-or-copy' });
  };

  const submitReview = async () => {
    try {
      if (!product) return;

      const name = reviewName.trim();
      const comment = reviewComment.trim();

      if (!name) {
        Alert.alert("Erreur", "Veuillez entrer votre nom");
        return;
      }
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

      setReviewName("");
      setReviewRating(5);
      setReviewComment("");

      const data = await reviewService.getByProduct(String(product.id));
      setReviews(data);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      errorHandler.handle(
        e,
        "failed to create review",
        ErrorCategory.SYSTEM,
        ErrorSeverity.LOW,
      );
      Alert.alert("Erreur", "Impossible d'envoyer votre avis");
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderImageGallery = () => (
    <View
      style={[styles.imageSection, isWideScreen && styles.imageSectionDesktop]}
    >
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
              source={{ uri: cloudinaryService.getOptimizedUrl(productData.images[selectedImageIndex], 800) }}
              style={styles.mainImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.mainImage, styles.imagePlaceholder]}>
              <Ionicons
                name="image-outline"
                size={48}
                color={COLORS.textMuted}
              />
              <Text style={styles.imagePlaceholderText}>Aucune image</Text>
            </View>
          )}

          {!!productData?.comparePrice &&
            productData.comparePrice > (productData.price || 0) && (
              <View
                style={[
                  styles.discountBadge,
                  { backgroundColor: COLORS.danger },
                ]}
              >
                <Text style={styles.discountText}>
                  -
                  {Math.round(
                    (1 - productData.price / productData.comparePrice) * 100,
                  )}
                  %
                </Text>
              </View>
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
            renderItem={({ item, index }) => {
              const thumbSize = isDesktop ? 65 : Math.max(48, Math.round(width * 0.18));
              return (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedImageIndex(index);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.thumb,
                    selectedImageIndex === index && styles.thumbActive,
                    { width: thumbSize, height: thumbSize, borderRadius: Math.round(thumbSize * 0.22) },
                  ]}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: cloudinaryService.getOptimizedUrl(item, 800) }}
                    style={[styles.thumbImage, { width: '100%', height: '100%' }]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              );
            }}
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
        onPress={() =>
            navigation.navigate("StoreDetail", { storeId: productData?.store?.id })
        }
        activeOpacity={0.85}
      >
          {productData?.store?.logoUrl ? (
            <Image
              source={{ uri: cloudinaryService.getOptimizedUrl(productData?.store?.logoUrl, 800) }}
              style={styles.shopImg}
            />
          ) : (
            <View style={styles.shopImgPlaceholder} />
          )}
          <Text style={styles.shopName} numberOfLines={1}>
            {productData?.store?.name}
          </Text>
          {productData?.store?.verified && (
            <Ionicons name="checkmark-circle" size={16} color={(COLORS as any).info} />
          )}
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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() =>
            navigation.navigate("ClientTabs", { screen: "ClientHome" })
          }
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.animatedHeaderTitle} numberOfLines={1}>
          {productData?.name || ""}
        </Text>
        <View style={styles.headerActions}>
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
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => Alert.alert("Partager", "Fonctionnalité à venir")}
          >
            <Ionicons name="share-outline" size={22} color="white" />
          </TouchableOpacity>
          <View style={styles.headerLikeContainer}>
            <LikeButton
              productId={String(productId || "")}
              userId={user?.id ? String(user.id) : undefined}
              showCount={false}
              size="medium"
              showLabel={false}
              variant="rounded"
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle={isDarkTheme ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bg }]}
        />
        <View style={styles.animatedHeaderContent}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={{ paddingTop: 60 }}>
          {/* Skeleton pour l'image */}
          <SkeletonLoader
            width={"100%"}
            height={SCREEN_WIDTH}
            borderRadius={0}
            style={{ marginBottom: SPACING.md }}
          />

          <View style={{ paddingHorizontal: SPACING.lg, gap: SPACING.md }}>
            {/* Skeleton pour la marque */}
            <SkeletonLoader width={120} height={32} borderRadius={16} />

            {/* Skeleton pour le titre */}
            <SkeletonLoader width={"80%"} height={40} borderRadius={8} />
            <SkeletonLoader width={"40%"} height={40} borderRadius={8} />

            {/* Skeleton pour le prix et les étoiles */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: SPACING.sm,
              }}
            >
              <SkeletonLoader width={100} height={24} borderRadius={4} />
              <SkeletonLoader width={80} height={24} borderRadius={4} />
            </View>

            {/* Skeleton pour la description */}
            <View style={{ marginTop: SPACING.lg, gap: SPACING.sm }}>
              <SkeletonLoader width={"100%"} height={16} borderRadius={4} />
              <SkeletonLoader width={"90%"} height={16} borderRadius={4} />
              <SkeletonLoader width={"95%"} height={16} borderRadius={4} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (!productData) {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle={isDarkTheme ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bg }]}
        />
        <View style={[styles.centerState, { padding: SPACING.lg }]}>
          <Text style={styles.notFoundTitle}>Produit introuvable</Text>
          <TouchableOpacity
            style={styles.backCta}
            onPress={() =>
              navigation.navigate("ClientTabs", { screen: "ClientHome" })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.backCtaText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (Platform.OS === 'web' && !loading && productData) {
    return (
      <View style={[styles.container, { backgroundColor: (theme && (theme as any).bg) || (COLORS as any).bg }] as any}>
        <WebProductView />
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <StatusBar
          barStyle={isDarkTheme ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bg }]} />

      <AnimatedHeader />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 150 + insets.bottom },
        ]}
      >
        <View style={[styles.pageCenter, { paddingTop: isDesktop ? 110 : 20 }] }>
          <View
            style={[
              styles.productGrid,
              isWideScreen && styles.productGridDesktop,
            ]}
          >{
            renderImageGallery()
          }<View style={[styles.productInfo, { paddingHorizontal: isDesktop ? SPACING.lg : SPACING.md, paddingTop: isDesktop ? SPACING.md : SPACING.sm }]}>{renderStorePill()}
              <Text
                style={[
                  styles.productTitle,
                  isDesktop && styles.productTitleDesktop,
                  !isDesktop && { fontSize: 22, lineHeight: 28 },
                ]}
                numberOfLines={2}
              >
                {productData.name}
              </Text>
              <View style={styles.ratingRow}>
                <View style={styles.starsRow}>
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
                        color={STAR_COLOR}
                      />
                    );
                  })}
                  <Text style={styles.ratingValue}>
                    {averageRating ? `(${averageRating})` : "(—)"}
                  </Text>
                </View>
                <Text style={styles.reviewsCount}>{reviews.length} avis</Text>
              </View><TouchableOpacity
                style={styles.chatBtn}
                onPress={handleDiscussWithSeller}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-whatsapp" size={18} color={COLORS.text} />
                <Text style={styles.chatBtnText}>Discuter avec le vendeur</Text>
              </TouchableOpacity>
              {/* LikeButton redundant in body removed here */}
              <View style={styles.descriptionSection}>
                <TabContent
                  activeTab={activeTab}
                  productDescription={productData.description}
                  productCategory={productData.category}
                  optionsList={[]}
                  reviewsList={reviews}
                  reviewsLoading={reviewsLoading}
                  reviewForm={{
                    name: reviewName,
                    comment: reviewComment,
                    rating: reviewRating,
                    onNameChange: setReviewName,
                    onCommentChange: setReviewComment,
                    onRatingChange: setReviewRating,
                    onSubmit: submitReview,
                    isSubmitting: submittingReview,
                  }}
                  similiarProducts={[]}
                  onProductPress={(id) => navigation.navigate('ProductDetail', { productId: id })}
                />
              </View>
              {!!productData.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>
                    {productData.category}
                  </Text>
                </View>
              )}
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
            </View>
          </View>

          <View style={styles.commentsSection}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="chatbubbles" size={18} color={COLORS.accent2} />
              <Text style={styles.sectionTitle}>
                Commentaires
                {productData?.store?.name ? ` · ${productData?.store?.name}` : ""}
              </Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>
                  ★ {averageRating ?? "—"}
                </Text>
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
                  multiline
                  numberOfLines={4}
                  style={[styles.inputPill, styles.inputFlex, styles.commentInput]}
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    submittingReview && styles.sendBtnDisabled,
                  ]}
                  onPress={submitReview}
                  disabled={submittingReview}
                  activeOpacity={0.85}
                >
                  {submittingReview ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <Ionicons
                      name="paper-plane"
                      size={18}
                      color={COLORS.text}
                    />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.inlineRatingRow}>
                <Text style={styles.inlineRatingLabel}>Note</Text>
                <View style={styles.inlineRatingStars}>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setReviewRating(r)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={r <= reviewRating ? "star" : "star-outline"}
                        size={18}
                        color={STAR_COLOR}
                      />
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
                          {(review.user_name || "?").slice(0, 1).toUpperCase()}
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
                      <Ionicons
                        name="heart-outline"
                        size={16}
                        color={COLORS.textMuted}
                      />
                      <Text style={styles.commentLikeCount}>0</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Sticky Bottom Bar */}
      <View
        style={[
          styles.stickyBottomBar,
          { paddingBottom: Math.max(insets.bottom, SPACING.md), paddingTop: isDesktop ? SPACING.md : SPACING.sm },
        ]}
      >
        <View style={styles.stickyPriceCol}>
          <Text style={styles.stickyPriceLabel}>Prix Total</Text>
          <Text style={styles.stickyPrice}>
            {(productData.price * quantity).toLocaleString()}{" "}
            <Text style={styles.stickyCurrency}>FCFA</Text>
          </Text>
        </View>
        <View style={styles.stickyButtonsRow}>
          <TouchableOpacity
            style={[
              styles.buyNowBtn,
              !productData.inStock && styles.buyNowBtnDisabled,
            ]}
            onPress={() => {
              if (!productData.inStock) return;
              if (!product) {
                Alert.alert("Erreur", "Produit indisponible");
                return;
              }
              addItem(product, quantity);
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              navigation.navigate('Cart');
            }}
            disabled={!productData.inStock}
            activeOpacity={0.85}
          >
            <Ionicons name="flash" size={18} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.addToCartBtn,
              !productData.inStock && styles.addToCartBtnDisabled,
              cartButtonAnimation && styles.addToCartBtnAnimated,
            ]}
            onPress={() => {
              if (!productData.inStock) return;
              if (!product) {
                Alert.alert("Erreur", "Produit indisponible");
                return;
              }
              addItem(product, quantity);
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert("Succès", "Produit ajouté au panier !");

              // Animation feedback
              setCartButtonAnimation(true);
              setTimeout(() => setCartButtonAnimation(false), 300);
            }}
            disabled={!productData.inStock}
            activeOpacity={0.85}
          >
            <Text style={styles.addToCartText}>Ajouter au panier</Text>
          </TouchableOpacity>
        </View>
      </View>

      {imageViewerVisible && productData.images.length > 0 && (
        <View style={styles.imageViewer}>
          <TouchableOpacity
            style={styles.closeViewer}
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
            initialScrollIndex={Math.min(
              selectedImageIndex,
              productData.images.length - 1,
            )}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
              );
              setSelectedImageIndex(index);
            }}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
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
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: "800",
    textAlign: "center",
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
    fontWeight: "700",
  },
  pageCenter: {
    width: "100%",
    paddingTop: 110,
    alignItems: "center",
  },
  productCard: {
    width: "100%",
    maxWidth: 1100,
    borderRadius: 40,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: "rgba(22, 25, 34, 0.72)",
    padding: SPACING.xl,
  },
  productGrid: {
    gap: SPACING.xl,
  },
  productGridDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  imageSection: {
    backgroundColor: "transparent",
  },
  imageSectionDesktop: {
    flexBasis: "42%",
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: 560,
  },
  imageWrapper: {
    width: "100%",
  },
  mainImageTouchable: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  loaderContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: SPACING.sm,
  },
  imagePlaceholderText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  discountBadge: {
    position: "absolute",
    top: SPACING.md,
    left: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  discountText: {
    color: COLORS.text,
    fontWeight: "800",
  },
  zoomButton: {
    position: "absolute",
    bottom: SPACING.md,
    right: SPACING.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailStrip: {
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  thumb: {
    width: 65,
    height: 65,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbActive: {
    borderColor: COLORS.accent,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  shopBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignSelf: "flex-start",
  },
  shopImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  shopImgPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  shopName: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: FONT_SIZE.md,
    maxWidth: 220,
  },
  productTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.text,
    lineHeight: 40,
  },
  productTitleDesktop: {
    fontSize: 42,
    lineHeight: 48,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingValue: {
    marginLeft: SPACING.sm,
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  reviewsCount: {
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  priceCart: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  buttonsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    width: "100%",
  },
  price: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.accent2,
  },
  currency: {
    fontSize: FONT_SIZE.md,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  addToCartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addToCartBtnDisabled: {
    opacity: 0.6,
  },
  addToCartText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: FONT_SIZE.md,
  },
  addToCartBtnAnimated: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    transform: [{ scale: 1.05 }],
  },
  buyNowBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.22)",
  },
  buyNowText: {
    color: "white",
    fontWeight: "800",
    fontSize: FONT_SIZE.md,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.35)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  likeBtnLiked: {
    borderColor: "rgba(244, 63, 94, 0.8)",
  },
  likeBtnText: {
    color: COLORS.danger,
    fontWeight: "900",
  },
  likeCountText: {
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  likeSection: {
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: "flex-start",
  },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chatBtnText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: FONT_SIZE.md,
  },
  stickyBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    boxShadow: "0px -4px 10px rgba(0, 0, 0, 0.1)",
    elevation: 8,
    zIndex: 100,
  },
  stickyPriceCol: {
    flexShrink: 0,
    marginRight: SPACING.lg,
  },
  stickyPriceLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  stickyPrice: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.accent,
  },
  stickyCurrency: {
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  stickyButtonsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: SPACING.sm,
  },
  descriptionSection: {
    gap: SPACING.sm,
  },
  descriptionCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 28,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  descriptionText: {
    color: COLORS.textSoft,
    lineHeight: 22,
    fontSize: FONT_SIZE.md,
    fontWeight: "500",
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.accent + "15",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent + "33",
  },
  categoryText: {
    color: COLORS.accent,
    fontWeight: "800",
    fontSize: FONT_SIZE.xs,
  },
  quantitySection: {
    marginTop: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: "900",
    color: COLORS.text,
    minWidth: 50,
    textAlign: "center",
  },
  commentsSection: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: FONT_SIZE.lg,
  },
  sectionBadge: {
    backgroundColor: "rgba(6, 182, 212, 0.16)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.25)",
  },
  sectionBadgeText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  composer: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  inputPill: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    color: COLORS.text,
    fontWeight: "700",
  },
  inputFlex: {
    flex: 1,
  },
  commentInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    borderRadius: RADIUS.md,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  inlineRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  inlineRatingLabel: {
    color: COLORS.textMuted,
    fontWeight: "900",
  },
  inlineRatingStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  emptyBox: {
    paddingVertical: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  commentList: {
    gap: SPACING.md,
  },
  commentItem: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  commentAuthor: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900",
  },
  commentDate: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
  },
  commentText: {
    color: COLORS.textSoft,
    lineHeight: 20,
    fontWeight: "600",
  },
  commentLike: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  commentLikeCount: {
    color: COLORS.textMuted,
    fontWeight: "900",
  },
  animatedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: "hidden",
  },
  animatedHeaderContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
  },
  animatedHeaderTitle: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
    marginHorizontal: SPACING.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  headerLikeContainer: {
    marginLeft: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIconContainer: {
    position: "relative",
    width: 22,
    height: 22,
  },
  cartBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.8)",
  },
  cartBadgeText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  imageViewer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 1000,
  },
  closeViewer: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 1001,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  viewerPagination: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  paginationDotActive: {
    backgroundColor: COLORS.accent,
    width: 20,
  },
});

export default ProductDetailScreen;

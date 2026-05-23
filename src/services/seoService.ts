/**
 * Service pour gérer les meta tags SEO dynamiquement
 * Permet de mettre à jour title, description, OG tags, etc. pour chaque page
 */

interface MetaTagConfig {
  title: string;
  description: string;
  url?: string;
  imageUrl?: string;
  type?: 'website' | 'article' | 'product';
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  author?: string;
  keywords?: string;
  canonicalUrl?: string;
  price?: number;
  currency?: string;
  availability?: string;
}

/**
 * Mettre à jour tous les meta tags SEO d'une page
 * À appeler dans useEffect lors du chargement de la page
 * 
 * @example
 * useEffect(() => {
 *   updateMetaTags({
 *     title: 'Produit Awesome - LibreShop',
 *     description: 'Découvrez ce produit incroyable...',
 *     imageUrl: 'https://...',
 *     url: 'https://libreshop.shop/product/awesome'
 *   });
 * }, [productId]);
 */
export function updateMetaTags(config: MetaTagConfig): void {
  // Vérifier que nous sommes en environnement navigateur
  if (typeof document === 'undefined') {
    console.warn('updateMetaTags: Non disponible en SSR');
    return;
  }

  const {
    title,
    description,
    url,
    imageUrl,
    type = 'website',
    twitterCard = 'summary_large_image',
    author,
    keywords,
    canonicalUrl,
    price,
    currency = 'XOF',
    availability = 'InStock',
  } = config;

  // 1. Mettre à jour le titre
  if (title) {
    document.title = title;
  }

  // 2. Mettre à jour meta description
  updateOrCreateMetaTag('meta[name="description"]', {
    name: 'description',
    content: description,
  });

  // 3. Mettre à jour keywords
  if (keywords) {
    updateOrCreateMetaTag('meta[name="keywords"]', {
      name: 'keywords',
      content: keywords,
    });
  }

  // 4. Mettre à jour author
  if (author) {
    updateOrCreateMetaTag('meta[name="author"]', {
      name: 'author',
      content: author,
    });
  }

  // 5. Mettre à jour canonical URL
  updateCanonicalUrl(canonicalUrl || url || window.location.href);

  // 6. Mettre à jour Open Graph tags
  updateOrCreateMetaTag('meta[property="og:title"]', {
    property: 'og:title',
    content: title,
  });

  updateOrCreateMetaTag('meta[property="og:description"]', {
    property: 'og:description',
    content: description,
  });

  updateOrCreateMetaTag('meta[property="og:type"]', {
    property: 'og:type',
    content: type,
  });

  if (url) {
    updateOrCreateMetaTag('meta[property="og:url"]', {
      property: 'og:url',
      content: url,
    });
  }

  if (imageUrl) {
    updateOrCreateMetaTag('meta[property="og:image"]', {
      property: 'og:image',
      content: imageUrl,
    });
    updateOrCreateMetaTag('meta[property="og:image:width"]', {
      property: 'og:image:width',
      content: '1200',
    });
    updateOrCreateMetaTag('meta[property="og:image:height"]', {
      property: 'og:image:height',
      content: '630',
    });
  }

  // 7. Mettre à jour Twitter Card
  updateOrCreateMetaTag('meta[name="twitter:card"]', {
    name: 'twitter:card',
    content: twitterCard,
  });

  updateOrCreateMetaTag('meta[name="twitter:title"]', {
    name: 'twitter:title',
    content: title,
  });

  updateOrCreateMetaTag('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: description,
  });

  if (imageUrl) {
    updateOrCreateMetaTag('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: imageUrl,
    });
  }

  // 8. Add product-specific meta tags if price is provided
  if (price && type === 'product') {
    updateOrCreateMetaTag('meta[property="product:price:amount"]', {
      property: 'product:price:amount',
      content: price.toString(),
    });
    updateOrCreateMetaTag('meta[property="product:price:currency"]', {
      property: 'product:price:currency',
      content: currency,
    });
    updateOrCreateMetaTag('meta[property="product:availability"]', {
      property: 'product:availability',
      content: availability,
    });
  }
}

/**
 * Créer ou mettre à jour un meta tag
 */
function updateOrCreateMetaTag(
  selector: string,
  attributes: Record<string, string>
): void {
  let element = document.querySelector(selector) as HTMLMetaElement;

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

/**
 * Mettre à jour ou créer la balise canonical
 */
function updateCanonicalUrl(url: string): void {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;

  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }

  canonical.href = url;
}

/**
 * Précommande utilité pour les pages produit
 */
export interface ProductPageMeta {
  productId: string;
  name: string;
  description: string;
  price: number;
  rating?: number;
  ratingCount?: number;
  imageUrl?: string;
  inStock?: boolean;
  currency?: string;
}

export function setProductPageMeta(product: ProductPageMeta): void {
  const baseUrl = 'https://libreshop.shop';
  const productUrl = `${baseUrl}/product/${product.productId}`;
  const description = product.description.substring(0, 160);

  updateMetaTags({
    title: `${product.name} - ${product.price.toLocaleString()} ${product.currency || 'XOF'} | LibreShop`,
    description: description + (description.length < product.description.length ? '...' : ''),
    url: productUrl,
    imageUrl: product.imageUrl,
    type: 'product',
    canonicalUrl: productUrl,
    keywords: `${product.name}, achat en ligne, marketplace africaine, LibreShop`,
    price: product.price,
    currency: product.currency || 'XOF',
    availability: product.inStock ? 'InStock' : 'OutOfStock',
  });
}

/**
 * Précommande utilité pour les pages store/boutique
 */
export interface StorePageMeta {
  storeId: string;
  storeName: string;
  description: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
  location?: string;
}

export function setStorePageMeta(store: StorePageMeta): void {
  const baseUrl = 'https://libreshop.shop';
  const storeUrl = `${baseUrl}/store/${store.storeId}`;
  const description = store.description.substring(0, 160);

  updateMetaTags({
    title: `${store.storeName} | Boutique en ligne | LibreShop`,
    description: description + (description.length < store.description.length ? '...' : ''),
    url: storeUrl,
    imageUrl: store.imageUrl,
    canonicalUrl: storeUrl,
    keywords: `${store.storeName}, boutique en ligne, ${store.location || 'Afrique'}, LibreShop`,
  });
}

/**
 * Réinitialiser les meta tags à leur valeur par défaut
 */
export function resetMetaTags(): void {
  updateMetaTags({
    title: 'LibreShop - Marketplace Africaine',
    description: 'LibreShop : La marketplace africaine pour acheter et vendre local. Découvrez 10 000+ produits, connectez-vous aux commerçants de votre région, paiement sécurisé en XOF/EUR.',
    url: 'https://libreshop.shop',
    imageUrl: 'https://libreshop.shop/icon-512.png',
  });
}

// ==========================================
// JSON-LD STRUCTURED DATA
// ==========================================

/**
 * Ajouter ou mettre à jour un script JSON-LD
 */
function updateJsonLd(id: string, data: Record<string, any>): void {
  if (typeof document === 'undefined') return;

  let script = document.getElementById(id) as HTMLScriptElement;

  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

/**
 * Supprimer un script JSON-LD
 */
function removeJsonLd(id: string): void {
  if (typeof document === 'undefined') return;

  const script = document.getElementById(id);
  if (script) {
    script.remove();
  }
}

/**
 * Ajouter JSON-LD pour un produit (Product Schema)
 */
export function setProductJsonLd(product: ProductPageMeta, storeName?: string, storeId?: string): void {
  const baseUrl = 'https://libreshop.shop';
  const productUrl = `${baseUrl}/product/${product.productId}`;

  const data: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.imageUrl,
    url: productUrl,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency || 'XOF',
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: storeName || 'LibreShop',
        url: storeId ? `${baseUrl}/store/${storeId}` : baseUrl,
      },
    },
  };

  if (product.rating && product.ratingCount) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  updateJsonLd('product-jsonld', data);
}

/**
 * Ajouter JSON-LD pour une boutique (Organization Schema)
 */
export function setStoreJsonLd(store: StorePageMeta): void {
  const baseUrl = 'https://libreshop.shop';
  const storeUrl = `${baseUrl}/store/${store.storeId}`;

  const data: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: store.storeName,
    description: store.description,
    url: storeUrl,
    logo: store.imageUrl,
    address: {
      '@type': 'PostalAddress',
      addressLocality: store.location || 'Afrique',
      addressCountry: 'SN',
    },
  };

  if (store.rating && store.ratingCount) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: store.rating,
      reviewCount: store.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  updateJsonLd('store-jsonld', data);
}

/**
 * Ajouter JSON-LD pour une liste de produits (ItemList Schema)
 */
export function setProductListJsonLd(products: Array<{ id: string; name: string; price: number; imageUrl?: string }>): void {
  const baseUrl = 'https://libreshop.shop';

  const data: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        url: `${baseUrl}/product/${product.id}`,
        image: product.imageUrl,
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'XOF',
        },
      },
    })),
  };

  updateJsonLd('product-list-jsonld', data);
}

/**
 * Ajouter JSON-LD pour le site Web (WebSite Schema)
 */
export function setWebsiteJsonLd(): void {
  const data: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'LibreShop',
    url: 'https://libreshop.shop',
    description: 'Marketplace africaine pour acheter et vendre local',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://libreshop.shop/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  updateJsonLd('website-jsonld', data);
}

/**
 * Nettoyer tous les JSON-LD
 */
export function clearJsonLd(): void {
  removeJsonLd('product-jsonld');
  removeJsonLd('store-jsonld');
  removeJsonLd('product-list-jsonld');
  removeJsonLd('website-jsonld');
  removeJsonLd('article-jsonld');
  removeJsonLd('breadcrumb-jsonld');
}

// ==========================================
// PAGES CATÉGORIE
// ==========================================

export interface CategoryPageMeta {
  categoryId: string;
  categoryName: string;
  description: string;
  imageUrl?: string;
  productCount?: number;
}

export function setCategoryPageMeta(category: CategoryPageMeta): void {
  const baseUrl = 'https://libreshop.shop';
  const categoryUrl = `${baseUrl}/category/${category.categoryId}`;
  const description = category.description.substring(0, 160);

  updateMetaTags({
    title: `${category.categoryName} | Catégorie | LibreShop`,
    description: description + (description.length < category.description.length ? '...' : ''),
    url: categoryUrl,
    imageUrl: category.imageUrl,
    canonicalUrl: categoryUrl,
    keywords: `${category.categoryName}, produits, achat en ligne, LibreShop, ${category.productCount ? `${category.productCount} produits` : ''}`,
  });
}

// ==========================================
// PAGES DE RECHERCHE
// ==========================================

export interface SearchPageMeta {
  query: string;
  resultCount?: number;
}

export function setSearchPageMeta(search: SearchPageMeta): void {
  const baseUrl = 'https://libreshop.shop';
  const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(search.query)}`;

  updateMetaTags({
    title: `Recherche: "${search.query}" | LibreShop`,
    description: `Résultats de recherche pour "${search.query}"${search.resultCount ? ` - ${search.resultCount} produits trouvés` : ''}`,
    url: searchUrl,
    canonicalUrl: searchUrl,
    keywords: `${search.query}, recherche, produits, LibreShop`,
  });

  // Empêcher l'indexation des pages de recherche
  updateOrCreateMetaTag('meta[name="robots"]', {
    name: 'robots',
    content: 'noindex, follow',
  });
}

// ==========================================
// PAGES PROFIL UTILISATEUR
// ==========================================

export interface UserProfileMeta {
  userId: string;
  userName: string;
  bio?: string;
  avatarUrl?: string;
  isSeller?: boolean;
}

export function setUserProfileMeta(user: UserProfileMeta): void {
  const baseUrl = 'https://libreshop.shop';
  const profileUrl = `${baseUrl}/profile/${user.userId}`;

  updateMetaTags({
    title: `${user.userName} | ${user.isSeller ? 'Vendeur' : 'Client'} | LibreShop`,
    description: user.bio || `Profil de ${user.userName} sur LibreShop${user.isSeller ? '. Découvrez ses produits et sa boutique.' : ''}`,
    url: profileUrl,
    imageUrl: user.avatarUrl,
    canonicalUrl: profileUrl,
    keywords: `${user.userName}, ${user.isSeller ? 'vendeur, boutique' : 'client'}, LibreShop`,
  });
}

// ==========================================
// PAGES PANIER / CHECKOUT
// ==========================================

export interface CartPageMeta {
  itemCount: number;
  totalAmount: number;
  currency?: string;
}

export function setCartPageMeta(cart: CartPageMeta): void {
  const baseUrl = 'https://libreshop.shop';
  const cartUrl = `${baseUrl}/cart`;

  updateMetaTags({
    title: `Panier (${cart.itemCount} articles) | LibreShop`,
    description: `Votre panier contient ${cart.itemCount} article${cart.itemCount > 1 ? 's' : ''} pour un total de ${cart.totalAmount.toLocaleString()} ${cart.currency || 'XOF'}`,
    url: cartUrl,
    canonicalUrl: cartUrl,
  });

  // Empêcher l'indexation des pages de panier
  updateOrCreateMetaTag('meta[name="robots"]', {
    name: 'robots',
    content: 'noindex, nofollow',
  });
}

// ==========================================
// META TAGS ARTICLES
// ==========================================

export interface ArticlePageMeta {
  articleId: string;
  title: string;
  description: string;
  imageUrl?: string;
  author: string;
  publishedAt: string;
  modifiedAt?: string;
  category?: string;
  tags?: string[];
}

export function setArticlePageMeta(article: ArticlePageMeta): void {
  const baseUrl = 'https://libreshop.shop';
  const articleUrl = `${baseUrl}/blog/${article.articleId}`;
  const description = article.description.substring(0, 160);

  updateMetaTags({
    title: `${article.title} | Blog | LibreShop`,
    description: description + (description.length < article.description.length ? '...' : ''),
    url: articleUrl,
    imageUrl: article.imageUrl,
    type: 'article',
    canonicalUrl: articleUrl,
    author: article.author,
    keywords: article.tags?.join(', ') || article.category || 'blog, LibreShop',
  });

  // Article-specific meta tags
  updateOrCreateMetaTag('meta[property="article:published_time"]', {
    property: 'article:published_time',
    content: article.publishedAt,
  });

  if (article.modifiedAt) {
    updateOrCreateMetaTag('meta[property="article:modified_time"]', {
      property: 'article:modified_time',
      content: article.modifiedAt,
    });
  }

  if (article.author) {
    updateOrCreateMetaTag('meta[property="article:author"]', {
      property: 'article:author',
      content: article.author,
    });
  }

  if (article.category) {
    updateOrCreateMetaTag('meta[property="article:section"]', {
      property: 'article:section',
      content: article.category,
    });
  }

  if (article.tags && article.tags.length > 0) {
    updateOrCreateMetaTag('meta[property="article:tag"]', {
      property: 'article:tag',
      content: article.tags.join(','),
    });
  }

  // JSON-LD pour l'article
  const articleData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: article.imageUrl,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt || article.publishedAt,
    url: articleUrl,
  };

  if (article.category) {
    articleData.articleSection = article.category;
  }

  if (article.tags) {
    articleData.keywords = article.tags.join(', ');
  }

  updateJsonLd('article-jsonld', articleData);
}

// ==========================================
// META TAGS DE LOCALISATION
// ==========================================

export interface LocationMeta {
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  region?: string;
  postalCode?: string;
}

export function setLocationMeta(location: LocationMeta): void {
  if (location.latitude && location.longitude) {
    updateOrCreateMetaTag('meta[name="geo.position"]', {
      name: 'geo.position',
      content: `${location.latitude};${location.longitude}`,
    });

    updateOrCreateMetaTag('meta[name="ICBM"]', {
      name: 'ICBM',
      content: `${location.latitude}, ${location.longitude}`,
    });
  }

  if (location.city || location.country) {
    const placeName = [location.city, location.region, location.country].filter(Boolean).join(', ');
    updateOrCreateMetaTag('meta[name="geo.placename"]', {
      name: 'geo.placename',
      content: placeName,
    });
  }

  if (location.region) {
    updateOrCreateMetaTag('meta[name="geo.region"]', {
      name: 'geo.region',
      content: location.region,
    });
  }
}

// ==========================================
// SUPPORT HREFLANG (MULTILINGUE)
// ==========================================

export interface HreflangLink {
  lang: string;
  url: string;
}

export function setHreflangLinks(links: HreflangLink[]): void {
  if (typeof document === 'undefined') return;

  // Supprimer les anciens liens hreflang
  const existingLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
  existingLinks.forEach(link => link.remove());

  // Ajouter les nouveaux liens
  links.forEach(({ lang, url }) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = lang;
    link.href = url;
    document.head.appendChild(link);
  });

  // Ajouter x-default
  const defaultLink = document.createElement('link');
  defaultLink.rel = 'alternate';
  defaultLink.hreflang = 'x-default';
  defaultLink.href = links[0]?.url || 'https://libreshop.shop';
  document.head.appendChild(defaultLink);
}

// ==========================================
// META TAGS VIDÉO
// ==========================================

export interface VideoMeta {
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  description: string;
  duration?: number; // en secondes
  uploadDate?: string;
  width?: number;
  height?: number;
}

export function setVideoMeta(video: VideoMeta): void {
  updateOrCreateMetaTag('meta[property="og:video"]', {
    property: 'og:video',
    content: video.videoUrl,
  });

  updateOrCreateMetaTag('meta[property="og:video:secure_url"]', {
    property: 'og:video:secure_url',
    content: video.videoUrl,
  });

  if (video.width && video.height) {
    updateOrCreateMetaTag('meta[property="og:video:width"]', {
      property: 'og:video:width',
      content: video.width.toString(),
    });

    updateOrCreateMetaTag('meta[property="og:video:height"]', {
      property: 'og:video:height',
      content: video.height.toString(),
    });
  }

  if (video.duration) {
    updateOrCreateMetaTag('meta[property="video:duration"]', {
      property: 'video:duration',
      content: video.duration.toString(),
    });
  }

  if (video.uploadDate) {
    updateOrCreateMetaTag('meta[property="video:release_date"]', {
      property: 'video:release_date',
      content: video.uploadDate,
    });
  }

  // JSON-LD pour la vidéo
  const videoData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    contentUrl: video.videoUrl,
    uploadDate: video.uploadDate || new Date().toISOString(),
  };

  if (video.duration) {
    videoData.duration = `PT${video.duration}S`;
  }

  if (video.width && video.height) {
    videoData.width = video.width;
    videoData.height = video.height;
  }

  updateJsonLd('video-jsonld', videoData);
}

// ==========================================
// BREADCRUMB JSON-LD
// ==========================================

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function setBreadcrumbJsonLd(items: BreadcrumbItem[]): void {
  const data: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  updateJsonLd('breadcrumb-jsonld', data);
}

// ==========================================
// INITIALISATION
// ==========================================

/**
 * Initialiser les meta tags par défaut au chargement de l'app
 */
export function initializeDefaultMetaTags(): void {
  resetMetaTags();
  setWebsiteJsonLd();
}

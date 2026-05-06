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

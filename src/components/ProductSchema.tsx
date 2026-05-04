import React from 'react';

interface ProductSchemaProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    rating?: number;
    ratingCount?: number;
    imageUrl?: string;
    inStock?: boolean;
    currency?: string;
    sku?: string;
    slug?: string;
  };
}

/**
 * Injecte un schema JSON-LD de produit dans le <head>
 * Permet aux moteurs de recherche de voir les détails du produit (prix, avis, stock, etc.)
 * 
 * Usage:
 * <ProductSchema product={{
 *   id: "123",
 *   name: "Produit XYZ",
 *   price: 49.99,
 *   rating: 4.5,
 *   ...
 * }} />
 */
export const ProductSchema: React.FC<ProductSchemaProps> = ({ product }) => {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description || "",
    "sku": product.sku || product.id,
    "brand": {
      "@type": "Brand",
      "name": "LibreShop"
    }
  };

  // Ajouter l'image si disponible
  if (product.imageUrl) {
    schema.image = product.imageUrl;
  }

  // Ajouter les offres/prix
  schema.offers = {
    "@type": "Offer",
    "price": product.price || 0,
    "priceCurrency": product.currency || "XOF",
    "availability": product.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    "url": `https://libreshop.shop/product/${product.slug || product.id}`
  };

  // Ajouter les évaluations si disponibles
  if (product.rating && product.ratingCount) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": product.rating,
      "ratingCount": product.ratingCount,
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  React.useEffect(() => {
    // Créer et ajouter le script JSON-LD au head
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    script.id = `product-schema-${product.id}`;
    document.head.appendChild(script);

    // Nettoyer à la désactivation du composant
    return () => {
      const existingScript = document.getElementById(`product-schema-${product.id}`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [product]);

  return null;
};

interface StoreSchemaProps {
  store: {
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
    rating?: number;
    ratingCount?: number;
    location?: string;
    slug?: string;
  };
}

/**
 * Injecte un schema JSON-LD de LocalBusiness (boutique)
 */
export const StoreSchema: React.FC<StoreSchemaProps> = ({ store }) => {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": store.name,
    "description": store.description || "",
    "url": `https://libreshop.shop/store/${store.slug || store.id}`
  };

  if (store.imageUrl) {
    schema.image = store.imageUrl;
  }

  if (store.location) {
    schema.address = {
      "@type": "PostalAddress",
      "addressRegion": store.location
    };
  }

  if (store.rating && store.ratingCount) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": store.rating,
      "ratingCount": store.ratingCount
    };
  }

  React.useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    script.id = `store-schema-${store.id}`;
    document.head.appendChild(script);

    return () => {
      const existingScript = document.getElementById(`store-schema-${store.id}`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [store]);

  return null;
};

interface PageHeadProps {
  title: string;
  description: string;
  imageUrl?: string;
  url?: string;
  type?: "website" | "article" | "product";
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
}

/**
 * Utility pour mettre à jour les meta tags dynamiques
 * Utile pour les pages de contenu statique ou dynamique
 * 
 * Usage:
 * useEffect(() => {
 *   updatePageHead({
 *     title: "Titre unique de la page",
 *     description: "Description unique...",
 *     imageUrl: "https://...",
 *   });
 * }, []);
 */
export const updatePageHead = (props: PageHeadProps) => {
  if (typeof document === "undefined") return;

  // Mettre à jour le title
  document.title = props.title;

  // Mettre à jour ou créer la meta description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', props.description);

  // Mettre à jour canonical
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', props.url || window.location.href);

  // Mettre à jour OG tags
  updateOGTag('og:title', props.title);
  updateOGTag('og:description', props.description);
  updateOGTag('og:type', props.type || 'website');
  updateOGTag('og:url', props.url || window.location.href);

  if (props.imageUrl) {
    updateOGTag('og:image', props.imageUrl);
    updateOGTag('twitter:image', props.imageUrl);
  }

  // Mettre à jour Twitter Card
  let twitterCard = document.querySelector('meta[name="twitter:card"]');
  if (!twitterCard) {
    twitterCard = document.createElement('meta');
    twitterCard.setAttribute('name', 'twitter:card');
    document.head.appendChild(twitterCard);
  }
  twitterCard.setAttribute('content', props.twitterCard || 'summary_large_image');

  updateOGTag('twitter:title', props.title);
  updateOGTag('twitter:description', props.description);
};

function updateOGTag(property: string, content: string) {
  if (!content) return;
  
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

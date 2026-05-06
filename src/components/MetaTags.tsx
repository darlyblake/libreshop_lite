import React, { useEffect } from 'react';
import { Platform } from 'react-native';

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  price?: number;
  currency?: string;
  siteName?: string;
  locale?: string;
  author?: string;
  keywords?: string;
}

export const MetaTags: React.FC<MetaTagsProps> = ({
  title = 'LibreShop - Marketplace Africaine',
  description = 'Achetez local, soutenez les commerçants de votre région. La marketplace pour l\'Afrique.',
  image = 'https://libreshop.shop/icon-512.png',
  url = 'https://libreshop.shop',
  type = 'website',
  price,
  currency = 'XOF',
  siteName = 'LibreShop',
  locale = 'fr_FR',
  author = 'LibreShop',
  keywords = 'marketplace africaine, commerce électronique, boutique en ligne, achat local, vendre en ligne, Afrique',
}) => {
  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web') return;

    // Helper function to update or create meta tag
    const updateMetaTag = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`) || 
                document.querySelector(`meta[name="${property}"]`);
      
      if (!tag) {
        tag = document.createElement('meta');
        if (property.startsWith('og:') || property.startsWith('product:')) {
          tag.setAttribute('property', property);
        } else {
          tag.setAttribute('name', property);
        }
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Update basic meta tags
    document.title = title;
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', author);

    // Update canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = url;

    // Update Open Graph tags
    updateMetaTag('og:title', title);
    updateMetaTag('og:description', description);
    updateMetaTag('og:image', image);
    updateMetaTag('og:url', url);
    updateMetaTag('og:type', type);
    updateMetaTag('og:site_name', siteName);
    updateMetaTag('og:locale', locale);

    // Update Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', image);

    // Update product-specific tags if price is provided
    if (price && type === 'product') {
      updateMetaTag('product:price:amount', price.toString());
      updateMetaTag('product:price:currency', currency);
    }

    // Update structured data for SEO
    const structuredData = type === 'product' ? {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description: description,
      image: image,
      url: url,
      offers: price ? {
        '@type': 'Offer',
        price: price,
        priceCurrency: currency,
        availability: 'https://schema.org/InStock'
      } : undefined
    } : type === 'store' ? {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: title,
      description: description,
      image: image,
      url: url
    } : {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: description,
      url: url
    };

    // Update structured data script
    let structuredDataScript = document.querySelector('script[type="application/ld+json"]');
    if (!structuredDataScript) {
      structuredDataScript = document.createElement('script');
      structuredDataScript.type = 'application/ld+json';
      document.head.appendChild(structuredDataScript);
    }
    structuredDataScript.textContent = JSON.stringify(structuredData, null, 2);

  }, [title, description, image, url, type, price, currency, siteName, locale, author, keywords]);

  // This component doesn't render anything on mobile
  return null;
};

// Hook for easy usage in functional components
export const useMetaTags = (props: MetaTagsProps) => {
  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web') return;

    // Update meta tags when props change
    const metaTagsComponent = <MetaTags {...props} />;
    // The useEffect in MetaTags component will handle the updates
  }, [props]);
};

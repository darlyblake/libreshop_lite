import { productService } from './productService';
import { storeService } from './storeService';
import { errorHandler } from '../utils/errorHandler';

interface GrocSearchHint {
  query: string;
  keywords: string[];
  category?: string;
}

interface GrocSearchResult {
  products: any[];
  keywords: string[];
  category?: string;
}

const normalizeText = (text: string): string => text.trim();

const DEFAULT_HINT = (query: string): GrocSearchHint => {
  const normalized = normalizeText(query).toLowerCase();
  const tokens = normalized.split(/\s+/).filter(t => t.length >= 3);
  
  // Basic extraction: original query + individual meaningful words
  const keywords = Array.from(new Set([normalized, ...tokens]));
  
  return {
    query: normalized,
    keywords: keywords.slice(0, 6),
  };
};

const LOCAL_SEARCH_SYNONYMS: Record<string, string[]> = {
  voiture: ['auto', 'automobile', 'véhicule', 'citadine', 'occasion'],
  auto: ['voiture', 'automobile', 'véhicule'],
  automobile: ['voiture', 'auto', 'véhicule'],
  téléphone: ['smartphone', 'mobile', 'cellulaire', 'iphone', 'android', 'huawei', 'samsung'],
  smartphone: ['téléphone', 'mobile', 'cellulaire', 'iphone', 'android'],
  ordinateur: ['pc', 'portable', 'laptop', 'macbook', 'ordinateur'],
  laptop: ['ordinateur', 'pc', 'portable'],
  sac: ['sac à main', 'sacoche', 'cartable', 'bagagerie'],
  cuisine: ['cuisine', 'cuisson', 'ustensiles', 'électroménager', 'four', 'frigo'],
  habit: ['vêtement', 'habits', 'mode', 'prêt-à-porter', 'tenue'],
  vêtement: ['habit', 'mode', 'prêt-à-porter', 'vêtements'],
  chaussure: ['chaussures', 'baskets', 'sneakers', 'soulier', 'souliers'],
  basket: ['chaussure', 'baskets', 'sneakers', 'sport'],
  maison: ['déco', 'ameublement', 'meuble', 'habitat', 'intérieur'],
  meuble: ['maison', 'déco', 'ameublement', 'canapé', 'table', 'chaise'],
  beauté: ['maquillage', 'soin', 'cosmétique', 'parfum'],
  cosmétique: ['beauté', 'maquillage', 'soin', 'parfum'],
  sport: ['fitness', 'musculation', 'entraînement', 'équipement sportif'],
  bébé: ['enfant', 'puériculture', 'nouveau-né', 'jouet'],
  enfant: ['bébé', 'junior', 'jouet', 'école'],
  montre: ['horlogerie', 'accessoire', 'bijou', 'watch'],
  bijou: ['bague', 'collier', 'bracelet', 'montre', 'or', 'argent'],
  ventilateur: ['ventilation', 'air', 'frais', 'climatiseur', 'ventilo'],
  tv: ['télévision', 'écran', 'télé', 'smart tv', 'vidéo'],
  télévision: ['tv', 'écran', 'télé', 'vidéo'],
  écouteur: ['casque', 'audio', 'musique', 'airpods', 'écouteurs'],
  santé: ['médicament', 'soin', 'bien-être', 'pharmacie', 'hygiène'],
  déco: ['décoration', 'maison', 'ornement', 'habitat', 'intérieur'],
};

const buildLocalSearchTerms = (query: string) => {
  const terms = new Set<string>();
  const normalized = normalizeText(query).toLowerCase();
  if (!normalized) return [];

  terms.add(normalized);
  normalized.split(/\s+/).forEach((token) => {
    const synonyms = LOCAL_SEARCH_SYNONYMS[token];
    if (synonyms) {
      synonyms.forEach((syn) => terms.add(syn.toLowerCase()));
    }
  });

  return Array.from(terms).filter((term) => term.length >= 2);
};

/**
 * Enhanced Search Hint Service (Local-only version)
 * This version uses the local synonym dictionary and keyword extraction 
 * to enhance search without calling external AI APIs (Grok/Gemini).
 */
const fetchGrocSearchHint = async (query: string): Promise<GrocSearchHint> => {
  // Directly return the enhanced local hint
  return DEFAULT_HINT(query);
};

const mergeUniqueProducts = (resultsA: any[] = [], resultsB: any[] = [], pageSize: number) => {
  const seen = new Map<string, any>();
  [...resultsA, ...resultsB].forEach((item) => {
    if (item?.id && !seen.has(item.id)) {
      seen.set(item.id, item);
    }
  });
  return Array.from(seen.values()).slice(0, pageSize);
};

const getSearchTerms = (hint: GrocSearchHint, query: string) => {
  const normalizedQuery = normalizeText(query);
  const terms = [normalizedQuery, hint.query, ...hint.keywords, hint.category || '']
    .map((term) => normalizeText(term || ''))
    .filter((term) => term.length >= 2);

  const localTerms = buildLocalSearchTerms(normalizedQuery);
  localTerms.forEach((term) => terms.push(term));

  return Array.from(new Set(terms));
};

const searchProductsForTerms = async (terms: string[], page: number, pageSize: number) => {
  const limitedTerms = terms.slice(0, 5);
  const searchPromises = limitedTerms.map((term) => productService.search(term, page, pageSize));
  const results = await Promise.all(searchPromises);
  return mergeUniqueProducts([], results.flat(), pageSize);
};

const searchStoresForTerms = async (terms: string[]) => {
  const limitedTerms = terms.slice(0, 5);
  const searchPromises = limitedTerms.map((term) => storeService.search(term));
  const results = await Promise.all(searchPromises);
  return Array.from(new Map(results.flat().map((store) => [store.id, store])).values());
};

const getProductIdentityKey = (product: any): string => {
  if (product?.sku) {
    return String(product.sku).trim().toLowerCase();
  }
  const name = String(product?.name || '').trim().toLowerCase();
  const category = String(product?.category || '').trim().toLowerCase();
  return `${name}::${category}`;
};

const annotatePriceComparison = (products: any[]) => {
  const groups = new Map<string, any[]>();

  products.forEach((product) => {
    const key = getProductIdentityKey(product);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(product);
  });

  return products.map((product) => {
    const key = getProductIdentityKey(product);
    const group = groups.get(key) || [];
    if (group.length < 2) return product;

    const prices = group
      .map((item) => Number(item.price) || 0)
      .filter((value) => value > 0);

    const maxPrice = Math.max(...prices);
    const currentPrice = Number(product.price) || 0;

    if (maxPrice > currentPrice) {
      return { ...product, comparePrice: maxPrice };
    }

    return product;
  });
};

export const grocService = {
  async searchProducts(query: string, page = 0, pageSize = 20): Promise<GrocSearchResult> {
    const normalizedQuery = normalizeText(query);
    const [baseResults, hint] = await Promise.all([
      productService.search(normalizedQuery, page, pageSize),
      fetchGrocSearchHint(normalizedQuery),
    ]);

    const results = baseResults || [];
    const searchTerms = getSearchTerms(hint, normalizedQuery);
    const extraTerms = searchTerms.filter((term) => term.toLowerCase() !== normalizedQuery.toLowerCase());

    if (extraTerms.length === 0) {
      return {
        products: annotatePriceComparison(results),
        keywords: searchTerms,
        category: hint.category,
      };
    }

    try {
      const expandedResults = await searchProductsForTerms(extraTerms, page, pageSize);
      const merged = mergeUniqueProducts(results, expandedResults, pageSize);
      return {
        products: annotatePriceComparison(merged),
        keywords: searchTerms,
        category: hint.category,
      };
    } catch (error) {
      errorHandler.handle(error, 'Groc produit fallback');
      return {
        products: annotatePriceComparison(results),
        keywords: searchTerms,
        category: hint.category,
      };
    }
  },

  async searchStores(query: string) {
    const normalizedQuery = normalizeText(query);
    const hint = await fetchGrocSearchHint(normalizedQuery);
    const searchTerms = getSearchTerms(hint, normalizedQuery);
    return searchStoresForTerms(searchTerms);
  },
};

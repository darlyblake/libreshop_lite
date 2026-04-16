import { agentConfig } from '../config/theme';
import { productService } from './productService';
import { storeService } from './storeService';
import { errorHandler } from '../utils/errorHandler';

const GROC_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent';

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

const DEFAULT_HINT = (query: string): GrocSearchHint => ({
  query,
  keywords: [query],
});

const normalizeText = (text: string): string => text.trim();

const extractFirstJsonObject = (text: string): string | null => {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
};

const parseGrocHint = (rawText: string, query: string): GrocSearchHint => {
  const text = rawText?.trim() || '';

  if (!text) return DEFAULT_HINT(query);

  const jsonText = extractFirstJsonObject(text) || text;

  try {
    const parsed = JSON.parse(jsonText);
    if (typeof parsed?.query === 'string' && Array.isArray(parsed?.keywords)) {
      return {
        query: normalizeText(parsed.query) || query,
        keywords: parsed.keywords.map((keyword: string) => normalizeText(keyword)).filter(Boolean),
        category: typeof parsed.category === 'string' ? normalizeText(parsed.category) : undefined,
      };
    }
  } catch (error) {
    // ignore parse errors; fallback below
  }

  // As a fallback, try to extract meaningful terms from the text.
  const fallbackKeywords = text
    .split(/[\n.,;:\-\/|]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 5);

  return {
    query,
    keywords: fallbackKeywords.length > 0 ? fallbackKeywords : [query],
  };
};

const buildGrocPrompt = (query: string): string => `Tu es Groc, le moteur de recherche intelligent de LibreShop.
Tu dois analyser la requête utilisateur, comprendre l'intention, l'occasion, le destinataire et le style, puis produire une recherche optimisée pour produits et boutiques.
Réponds uniquement avec un objet JSON valide contenant les champs suivants :
{
  "query": "<requête améliorée>",
  "keywords": ["mot1", "mot2", ...],
  "category": "<catégorie prioritaire facultative>"
}
Le champ "query" doit être une version simplifiée et claire de la recherche.
Le champ "keywords" doit contenir des synonymes, variantes et expressions proches qui aident à trouver des produits pertinents.
Par exemple, si la recherche est "je veux un beau cadeau tendance pour ma femme", retourne des mots-clés tels que "cadeau femme", "cadeau tendance", "idée cadeau femme", "bijou", "accessoire femme".
Ne renvoie jamais de texte hors du JSON.
Si tu ne dois pas modifier la requête, renvoie la requête originale dans le champ query.
Requête utilisateur : "${query}"
`;

const getGrocApiKey = (): string | null => {
  return agentConfig.grocApiKey || agentConfig.geminiApiKey || null;
};

const fetchGrocSearchHint = async (query: string): Promise<GrocSearchHint> => {
  const apiKey = getGrocApiKey();
  if (!apiKey || !query.trim()) {
    return DEFAULT_HINT(query);
  }

  try {
    const res = await fetch(`${GROC_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildGrocPrompt(query) }] }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Groc API HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return parseGrocHint(rawText, query);
  } catch (error: any) {
    errorHandler.handle(error, 'Erreur Groc');
    return DEFAULT_HINT(query);
  }
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
  const terms = [query, hint.query, ...hint.keywords]
    .map((term) => normalizeText(term || ''))
    .filter((term) => term.length >= 2);

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

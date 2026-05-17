import { productService } from './productService';
import { orderService } from './orderService';
import { wishlistService } from './wishlistService';
import { agentService } from './agentService';
import { genericStorage } from '../lib/storage';
import { Product } from '../lib/supabase';

export interface RecommendedProduct {
  product: Product;
  reason: string;
}

const CACHE_KEY_PREFIX = '@libreshop_ai_recommendations:';
const CACHE_EXPIRY_MS = 1000 * 60 * 60 * 2; // 2 heures

export const recommendationService = {
  /**
   * Obtient des recommandations personnalisées pour l'utilisateur
   */
  async getRecommendations(userId: string | null): Promise<RecommendedProduct[]> {
    if (!userId) {
      return this.getFallbackRecommendations();
    }

    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    try {
      // 1. Lire le cache
      const cached = await genericStorage.getItem<{
        items: RecommendedProduct[];
        timestamp: number;
      }>(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
        console.log(`[recommendationService] 🧠 Chargé depuis le cache IA pour l'utilisateur ${userId}`);
        return cached.items;
      }
    } catch (e) {
      console.warn('[recommendationService] Erreur lecture cache:', e);
    }

    try {
      // 2. Charger les données utilisateur (commandes & wishlist) & catalogue
      const [orders, wishlist, allProducts] = await Promise.all([
        orderService.getByUser(userId).catch(() => []),
        wishlistService.getByUser(userId).catch(() => []),
        productService.getAll(0, 30, 'popular').catch(() => [])
      ]);

      // Si l'utilisateur n'a aucun historique d'achat ni wishlist, on renvoie le fallback
      if (orders.length === 0 && wishlist.length === 0) {
        const fallbacks = await this.getFallbackRecommendations(allProducts);
        // Mettre en cache pour éviter les recalculs inutiles
        await genericStorage.setItem(cacheKey, { items: fallbacks, timestamp: Date.now() });
        return fallbacks;
      }

      // 3. Extraire le profil utilisateur pour le prompt
      const boughtProducts = orders.flatMap(order => 
        (order.order_items || []).map((item: any) => ({
          name: item.products?.name,
          category: item.products?.category,
          price: item.products?.price,
        }))
      ).filter(p => p.name);

      const wishlistedProducts = wishlist.map((item: any) => ({
        name: item.product?.name,
        category: item.product?.category,
        price: item.product?.price,
      })).filter(p => p.name);

      // Préparer la liste des produits disponibles à recommander
      const availableCatalog = allProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        description: p.description
      }));

      // 4. Construire le prompt Gemini
      const prompt = `
Tu es le moteur de recommandation IA de LibreShop, un marché e-commerce en Afrique de l'Ouest.
Analyse le profil de l'utilisateur suivant pour lui recommander exactement 4 produits parmi le catalogue disponible.

--- PROFIL D'ACHAT UTILISATEUR ---
Produits achetés précédemment :
${boughtProducts.length > 0 ? boughtProducts.map(p => `- ${p.name} (Catégorie: ${p.category || 'N/A'}, Prix: ${p.price} FCFA)`).join('\n') : 'Aucun'}

Produits dans la liste d'envies (wishlist) :
${wishlistedProducts.length > 0 ? wishlistedProducts.map(p => `- ${p.name} (Catégorie: ${p.category || 'N/A'}, Prix: ${p.price} FCFA)`).join('\n') : 'Aucun'}

--- CATALOGUE DE PRODUITS DISPONIBLES ---
${availableCatalog.map(p => `- ID: "${p.id}" | Nom: "${p.name}" | Catégorie: "${p.category || 'N/A'}" | Prix: ${p.price} FCFA | Desc: "${p.description || ''}"`).join('\n')}

--- INSTRUCTIONS ---
Sélectionne exactement les 4 produits du catalogue les plus pertinents pour cet utilisateur.
Pour chaque produit sélectionné, rédige une phrase d'explication courte, chaleureuse et personnalisée en français (max 10 mots) expliquant pourquoi ce produit lui est recommandé.
Exemples :
- "Assorti à votre style mode africaine."
- "Parce que vous aimez les cosmétiques naturels."
- "Un excellent ajout à vos récents achats."

Renvoie uniquement un tableau JSON valide au format exact suivant, sans texte introductif ni markdown de bloc de code (ne mets PAS de bloc de code markdown avec trois accents graves, juste la chaîne de caractères brute du tableau JSON) :
[
  {"id": "id-du-produit-1", "reason": "Phrase d'explication 1"},
  {"id": "id-du-produit-2", "reason": "Phrase d'explication 2"},
  {"id": "id-du-produit-3", "reason": "Phrase d'explication 3"},
  {"id": "id-du-produit-4", "reason": "Phrase d'explication 4"}
]
`;

      const responseText = await agentService.askAgent(prompt, "Tu es un algorithme de recommandation de produits e-commerce.");
      
      // Essayer d'extraire et de parser le JSON de manière robuste
      let jsonStr = responseText.trim();
      const firstBracket = jsonStr.indexOf('[');
      const lastBracket = jsonStr.lastIndexOf(']');
      
      if (firstBracket !== -1 && lastBracket !== -1) {
        jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
      }

      const recommendationsData: Array<{ id: string; reason: string }> = JSON.parse(jsonStr);
      
      // Mapper les IDs recommandés avec les objets produits réels du catalogue
      const recommendedProducts: RecommendedProduct[] = [];
      for (const item of recommendationsData) {
        const matchedProduct = allProducts.find(p => p.id === item.id);
        if (matchedProduct) {
          recommendedProducts.push({
            product: matchedProduct,
            reason: item.reason
          });
        }
      }

      if (recommendedProducts.length > 0) {
        await genericStorage.setItem(cacheKey, { items: recommendedProducts, timestamp: Date.now() });
        return recommendedProducts;
      }
      
      throw new Error("Aucune recommandation valide trouvée.");
    } catch (error) {
      console.warn("[recommendationService] Erreur Gemini, utilisation du fallback intelligent:", error);
      // Fallback en cas d'erreur de Gemini ou parsing
      return this.getFallbackRecommendations();
    }
  },

  /**
   * Algorithme de secours rapide et malin
   */
  async getFallbackRecommendations(preloadedProducts?: Product[]): Promise<RecommendedProduct[]> {
    try {
      const catalog = preloadedProducts && preloadedProducts.length > 0 
        ? preloadedProducts 
        : await productService.getAll(0, 20, 'popular');

      // Prendre les 4 premiers produits populaires
      const fallbackItems: RecommendedProduct[] = catalog.slice(0, 4).map((p, index) => {
        const fallbackReasons = [
          "Le produit star du moment sur LibreShop !",
          "Recommandé d'après les tendances locales.",
          "Coup de cœur de notre communauté d'acheteurs.",
          "Excellent rapport qualité-prix sélectionné pour vous."
        ];
        return {
          product: p,
          reason: fallbackReasons[index] || "Spécialement sélectionné pour vous."
        };
      });

      return fallbackItems;
    } catch (e) {
      console.error("[recommendationService] Erreur fallback:", e);
      return [];
    }
  }
};

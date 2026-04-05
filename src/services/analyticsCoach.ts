// src/services/analyticsCoach.ts
import { agentService } from './agentService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SellerStats {
  totalRevenue: number;           // CA total
  totalOrders: number;            // Nombre de commandes
  averageBasket: number;          // Panier moyen (FCFA)
  revenueLast30Days: number;
  revenuePrevious30Days: number;
  deliveryRate: number;           // Taux de livraison (%)
  topProducts: Array<{
    name: string;
    revenue: number;
    quantity: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  deadProducts: Array<{
    name: string;
    daysWithoutSale: number;
    stock: number;
  }>;
  loyaltyRate: number;            // % de clients récurrents
  marketAvgBasket?: number;       // Moyenne du marché pour comparaison
}

export interface CoachAdvice {
  text: string;
  icon: string;
  color: string;
  priority: number;
}

const getGrowth = (current: number, previous: number): number =>
  previous === 0 ? 0 : ((current - previous) / previous) * 100;

/**
 * 🤖 Génère des conseils stratégiques via Gemini avec Cache
 */
export const getGeminiStrategicAdvice = async (stats: SellerStats, storeId?: string, periodDays: number = 30): Promise<CoachAdvice[]> => {
  const growth = getGrowth(stats.revenueLast30Days, stats.revenuePrevious30Days);
  
  // --- GESTION DU CACHE ---
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const CACHE_KEY = `libreshop_coach_advice_${storeId || 'anon'}_${periodDays}_${today}`;
  
  if (storeId) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        console.log(`[analyticsCoach] 🧠 Utilisation du cache pour la période ${periodDays}j :`, CACHE_KEY);
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("[analyticsCoach] Erreur lecture cache:", e);
    }
  }
  
  console.log(`[analyticsCoach] 🌐 Appel Gemini API pour le vendeur ${storeId || 'inconnu'}...`);
  
  const statsPrompt = `
Voici les statistiques de performance d'un vendeur LibreShop :
- Revenu 30j: ${stats.revenueLast30Days.toLocaleString()} FCFA (Croissance: ${growth.toFixed(1)}%)
- Panier moyen: ${stats.averageBasket.toLocaleString()} FCFA (Marché: ${stats.marketAvgBasket?.toLocaleString() || 'N/A'})
- Taux de livraison: ${stats.deliveryRate}%
- Fidélité clients: ${stats.loyaltyRate}%
- Top Produit: ${stats.topProducts[0]?.name || 'Aucun'}
- Stock mort: ${stats.deadProducts.length} produits sans ventes.

Analyse ces données et donne 3 conseils stratégiques CRUCIAUX pour ce vendeur.
Chaque conseil doit être une seule phrase courte, impactante et concrète (ex: "Lancer une promo sur X", "Appeler les clients pour Y").
Réponds UNIQUEMENT sous forme de liste JSON comme ceci: 
[
  {"text": "Conseil 1", "icon": "rocket", "color": "#10B981"},
  {"text": "Conseil 2", "icon": "cart", "color": "#8B5CF6"},
  {"text": "Conseil 3", "icon": "alert-circle", "color": "#EF4444"}
]
Garde les icônes simples issues de Ionicons (rocket, cart, alert-circle, trending-up, people, flame, cash).
`;

  try {
    const response = await agentService.askAgent(statsPrompt, "Tu es un expert en e-commerce pour l'Afrique de l'Ouest.");
    // Tentative de parsing du JSON
    const jsonMatch = response.match(/\[.*\]/s);
    if (jsonMatch) {
      const advices = JSON.parse(jsonMatch[0]);
      const finalAdvices = advices.map((a: any, i: number) => ({ ...a, priority: i + 1 }));
      
      // Stockage en cache
      if (storeId) {
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(finalAdvices)).catch(e => console.warn("Erreur écriture cache:", e));
      }
      
      return finalAdvices;
    }
    throw new Error("Format JSON non détecté");
  } catch (error) {
    console.warn("[analyticsCoach] Gemini failed, falling back to rules:", error);
    return generateAICoachAdvice(stats).slice(0, 3);
  }
};

/**
 * 🧠 Génère des conseils basés sur des règles (Fallback rapide)
 */
export const generateAICoachAdvice = (stats: SellerStats): CoachAdvice[] => {
  const suggestions: CoachAdvice[] = [];
  const growth = getGrowth(stats.revenueLast30Days, stats.revenuePrevious30Days);

  if (growth > 25) {
    suggestions.push({ text: `🚀 Croissance de ${growth.toFixed(0)}% ! Réinvestis dans du stock.`, icon: 'rocket', color: '#10B981', priority: 1 });
  } else if (growth < -15) {
    suggestions.push({ text: `⚠️ Chute de ${Math.abs(growth).toFixed(0)}%. Lance une promo flash.`, icon: 'alert-circle', color: '#EF4444', priority: 1 });
  }

  if (stats.averageBasket < 4500) {
    suggestions.push({ text: "🛒 Panier moyen bas. Propose des 'Packs Duo'.", icon: 'cart', color: '#8B5CF6', priority: 2 });
  }

  if (stats.topProducts.length > 0) {
    suggestions.push({ text: `🔥 "${stats.topProducts[0].name}" est ta star. Ne sois jamais en rupture.`, icon: 'flame', color: '#F59E0B', priority: 1 });
  }

  if (stats.deadProducts.length > 0) {
    suggestions.push({ text: `📦 ${stats.deadProducts.length} produits dorment. Liquide-les à -20%.`, icon: 'archive', color: '#EF4444', priority: 1 });
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
};

/**
 * 💬 Répond aux questions via Gemini
 */
export const answerSellerQuestion = async (question: string, stats: SellerStats): Promise<string> => {
  const growth = getGrowth(stats.revenueLast30Days, stats.revenuePrevious30Days);
  
  const context = `
Statistiques Vendeur :
- Revenu 30j: ${stats.revenueLast30Days.toLocaleString()} FCFA
- Croissance: ${growth.toFixed(1)}%
- Panier moyen: ${stats.averageBasket.toLocaleString()} FCFA
- Taux livraison: ${stats.deliveryRate}%
- Produits stars: ${stats.topProducts.map(p => p.name).join(', ')}
- Produits sans ventes: ${stats.deadProducts.length}
`;

  const prompt = `L'utilisateur demande : "${question}". Réponds-lui en te basant sur ses chiffres et en étant très concret. Pas plus de 2-3 phrases.`;
  
  return await agentService.askAgent(prompt, context);
};

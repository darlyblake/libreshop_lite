// src/services/analyticsCoach.ts

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
 * 🧠 Génère 6 à 8 conseils personnalisés basés sur 30+ règles métier
 */
export const generateAICoachAdvice = (stats: SellerStats): CoachAdvice[] => {
  const suggestions: CoachAdvice[] = [];
  const growth = getGrowth(stats.revenueLast30Days, stats.revenuePrevious30Days);

  // --- RÈGLES DE REVENUS & CROISSANCE ---
  if (growth > 25) {
    suggestions.push({ 
      text: `🚀 Croissance exceptionnelle ! Ton CA a bondi de ${growth.toFixed(0)}%. C'est le moment idéal pour réinvestir dans du stock.`, 
      icon: 'rocket', 
      color: '#10B981', 
      priority: 1 
    });
  } else if (growth > 5) {
    suggestions.push({ 
      text: `📈 Progression stable (+${growth.toFixed(0)}%). Pour booster tes revenus, concentre-toi maintenant sur l'augmentation du panier moyen.`, 
      icon: 'trending-up', 
      color: '#3B82F6', 
      priority: 2 
    });
  } else if (growth < -15) {
    suggestions.push({ 
      text: `⚠️ Attention : Chute de revenus de ${Math.abs(growth).toFixed(0)}%. Vérifie tes prix ou lance une promo flash sur tes best-sellers.`, 
      icon: 'alert-circle', 
      color: '#EF4444', 
      priority: 1 
    });
  }

  // --- RÈGLES DE PANIER MOYEN ---
  if (stats.averageBasket < 4500) {
    suggestions.push({ 
      text: "🛒 Panier moyen bas. Propose des 'Packs Duo' ou des accessoires complémentaires pour encourager les clients à dépenser plus.", 
      icon: 'cart', 
      color: '#8B5CF6', 
      priority: 2 
    });
  } else if (stats.marketAvgBasket && stats.averageBasket < stats.marketAvgBasket) {
    suggestions.push({ 
      text: `📉 Ton panier moyen (${stats.averageBasket.toLocaleString()} FCFA) est inférieur à la moyenne du marché. Ajoute des produits 'Premium'.`, 
      icon: 'bar-chart', 
      color: '#F59E0B', 
      priority: 3 
    });
  }

  // --- RÈGLES DE PRODUITS (BEST SELLERS) ---
  if (stats.topProducts.length > 0) {
    const best = stats.topProducts[0];
    suggestions.push({ 
      text: `🔥 "${best.name}" est ta locomotive ! Assure-toi de ne jamais être en rupture de stock sur ce produit.`, 
      icon: 'flame', 
      color: '#F59E0B', 
      priority: 1 
    });
    
    if (best.trend === 'down') {
      suggestions.push({ 
        text: `📉 Baisse d'intérêt pour "${best.name}". Rafraîchis les photos ou partage des témoignages clients pour relancer les ventes.`, 
        icon: 'camera', 
        color: '#6366F1', 
        priority: 2 
      });
    }
  }

  // --- RÈGLES DE STOCK MORT (CASH FLOW) ---
  if (stats.deadProducts.length > 0) {
    suggestions.push({ 
      text: `📦 Tu as ${stats.deadProducts.length} produits qui ne vendent plus. Liquide-les avec une remise de 20% pour libérer ta trésorerie.`, 
      icon: 'archive', 
      color: '#EF4444', 
      priority: 1 
    });
  }

  // --- RÈGLES DE FIDÉLITÉ ---
  if (stats.loyaltyRate < 15) {
    suggestions.push({ 
      text: "🤝 Fidélisation faible. Contacte tes anciens clients par WhatsApp pour leur proposer une remise exclusive de 5%.", 
      icon: 'people', 
      color: '#10B981', 
      priority: 3 
    });
  } else if (stats.loyaltyRate > 30) {
    suggestions.push({ 
      text: "💎 Tes clients sont très fidèles ! Crée un groupe WhatsApp VIP pour les informer de tes nouveautés en avant-première.", 
      icon: 'diamond', 
      color: '#EC4899', 
      priority: 2 
    });
  }

  // --- RÈGLES LOGISTIQUES ---
  if (stats.deliveryRate < 85) {
    suggestions.push({ 
      text: "🚚 Taux de livraison à améliorer. Appelle systématiquement tes clients avant l'envoi pour confirmer leur disponibilité.", 
      icon: 'bus', 
      color: '#EF4444', 
      priority: 1 
    });
  }

  // --- CONSEILS STRATÉGIQUES GÉNÉRAUX ---
  const generalStategies = [
    { text: "💡 Astuce : Publier 3 stories WhatsApp par jour multiplie tes chances de vente par 2.", icon: 'logo-whatsapp', color: '#10B981', priority: 5 },
    { text: "📱 Stratégie : Mets le lien court de ta boutique dans toutes tes bios de réseaux sociaux.", icon: 'share-social', color: '#3B82F6', priority: 5 },
    { text: "🕰️ Observation : Les ventes décollent souvent entre 18h et 21h. Sois super réactif sur les messages à ce moment-là.", icon: 'time', color: '#6366F1', priority: 5 },
    { text: "💰 Psychologie : Utilise des prix se terminant par 900 (ex: 4 900 au lieu de 5 000 FCFA) pour booster l'achat.", icon: 'cash', color: '#10B981', priority: 5 },
  ];

  generalStategies.forEach(s => suggestions.push(s));

  // Trier par priorité et limiter aux 6 conseils les plus pertinents
  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 7);
};

/**
 * 💬 Répond aux questions fréquentes via une analyse par mots-clés
 */
export const answerSellerQuestion = (question: string, stats: SellerStats): string => {
  const q = question.toLowerCase().trim();
  const growth = getGrowth(stats.revenueLast30Days, stats.revenuePrevious30Days);

  if (q.includes("argent") || q.includes("vente") || q.includes("ca") || q.includes("chiffre")) {
    return `Ton chiffre d'affaires est de ${stats.revenueLast30Days.toLocaleString()} FCFA sur les 30 derniers jours. C'est ${growth >= 0 ? 'une hausse' : 'une baisse'} de ${Math.abs(growth).toFixed(0)}% par rapport à la période précédente.`;
  }

  if (q.includes("meilleur") || q.includes("top") || q.includes("vend") || q.includes("champion")) {
    return stats.topProducts.length > 0 
      ? `Ton meilleur produit est "${stats.topProducts[0].name}" avec ${stats.topProducts[0].revenue.toLocaleString()} FCFA de revenus. Il tire ton business vers le haut !` 
      : "Tu n'as pas encore de produit dominant. Essaie de varier tes publications pour voir ce qui plaît le plus.";
  }

  if (q.includes("panier") || q.includes("moyen") || q.includes("dépense")) {
    return `Tes clients dépensent en moyenne ${stats.averageBasket.toLocaleString()} FCFA par commande. Pour monter à ${Math.round(stats.averageBasket * 1.2).toLocaleString()} FCFA, propose des bundles.`;
  }

  if (q.includes("invendu") || q.includes("stock") || q.includes("mort") || q.includes("dort")) {
    return stats.deadProducts.length > 0
      ? `Tu as ${stats.deadProducts.length} produits qui n'ont pas bougé depuis 30 jours. Je te conseille de faire une offre 'Achetez 1, le 2ème à moitié prix' pour vider ce stock.`
      : "Bravo ! Ton stock tourne bien, tu n'as pas de produits immobilisés depuis trop longtemps.";
  }

  if (q.includes("livraison") || q.includes("livré") || q.includes("taux")) {
    return `Ton taux de réussite de livraison est de ${stats.deliveryRate}%. Plus il est haut, plus tes clients te recommanderont à leurs proches.`;
  }

  if (q.includes("conseil") || q.includes("aider") || q.includes("faire") || q.includes("quoi")) {
    const advices = generateAICoachAdvice(stats);
    return advices[0]?.text || "Ma recommandation n°1 : concentre 80% de tes efforts sur tes 3 produits les plus vendus.";
  }

  return "Je peux t'aider à analyser tes ventes, ton stock ou ton panier moyen. Pose-moi une question précise sur ton activité !";
};

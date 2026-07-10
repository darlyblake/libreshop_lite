/**
 * Service de Gestion des Fonctionnalités (Feature Gating)
 * Ce service gère l'accès aux fonctionnalités en fonction du plan d'abonnement
 */

import { Store, useSupabase } from '../lib/supabase';

// Types des fonctionnalités disponibles
export type FeatureKey =
  | 'dashboard_basic'
  | 'dashboard_advanced'
  | 'products_management'
  | 'orders_management'
  | 'pos_caisse'
  | 'analytics_basic'
  | 'analytics_advanced'
  | 'analytics_coach_ai'
  | 'analytics_benchmark'
  | 'clients_basic'
  | 'clients_advanced'
  | 'loyalty_program'
  | 'coupons_basic'
  | 'coupons_unlimited'
  | 'collections_basic'
  | 'collections_unlimited'
  | 'reports_basic'
  | 'reports_advanced'
  | 'reports_detailed'
  | 'export_data'
  | 'low_stock_alerts'
  | 'stock_history'
  | 'returns_management'
  | 'refunds_basic'
  | 'refunds_advanced'
  | 'finance_basic'
  | 'accounting_advanced'
  | 'api_access'
  | 'multi_store'
  | 'support_email'
  | 'support_phone'
  | 'support_24_7'
  | 'white_label'
  | 'custom_development';

// Interface pour les limites de plan
export interface PlanLimits {
  maxProducts: number;
  maxStores: number;
  maxCoupons?: number;
  maxCollections?: number;
  analyticsRetentionDays?: number; // Nombre de jours de données analytics conservées
  duration?: string; // '1_month', 'unlimited'
}

// Cache des fonctionnalités chargées depuis la base de données
let cachedPlanFeatures: Record<string, FeatureKey[]> | null = null;
let cacheLoaded = false;

// Configuration par défaut des fonctionnalités par plan (fallback si base non disponible)
const DEFAULT_PLAN_FEATURES: Record<string, FeatureKey[]> = {
  trial: [
    'dashboard_basic',
    'dashboard_advanced',
    'products_management',
    'orders_management',
    'pos_caisse',
    'analytics_basic',
    'analytics_advanced',
    'analytics_coach_ai',
    'analytics_benchmark',
    'clients_basic',
    'clients_advanced',
    'loyalty_program',
    'coupons_basic',
    'coupons_unlimited',
    'collections_basic',
    'collections_unlimited',
    'reports_basic',
    'reports_advanced',
    'reports_detailed',
    'export_data',
    'low_stock_alerts',
    'stock_history',
    'returns_management',
    'refunds_basic',
    'refunds_advanced',
    'finance_basic',
    'accounting_advanced',
    'support_email',
  ],
  standard: [
    'dashboard_basic',
    'products_management',
    'orders_management',
    'pos_caisse',
    'analytics_basic',
    'clients_basic',
    'coupons_basic',
    'collections_basic',
    'reports_basic',
    'low_stock_alerts',
    'returns_management',
    'refunds_basic',
    'finance_basic',
    'support_email',
  ],
  pro: [
    'dashboard_basic',
    'dashboard_advanced',
    'products_management',
    'orders_management',
    'pos_caisse',
    'analytics_basic',
    'analytics_advanced',
    'analytics_coach_ai',
    'analytics_benchmark',
    'clients_basic',
    'clients_advanced',
    'loyalty_program',
    'coupons_basic',
    'coupons_unlimited',
    'collections_basic',
    'collections_unlimited',
    'reports_basic',
    'reports_advanced',
    'reports_detailed',
    'export_data',
    'low_stock_alerts',
    'stock_history',
    'returns_management',
    'refunds_advanced',
    'finance_basic',
    'support_email',
  ],
  business: [
    'dashboard_basic',
    'dashboard_advanced',
    'products_management',
    'orders_management',
    'pos_caisse',
    'analytics_basic',
    'analytics_advanced',
    'analytics_coach_ai',
    'analytics_benchmark',
    'clients_basic',
    'clients_advanced',
    'loyalty_program',
    'coupons_basic',
    'coupons_unlimited',
    'collections_basic',
    'collections_unlimited',
    'reports_basic',
    'reports_advanced',
    'reports_detailed',
    'export_data',
    'low_stock_alerts',
    'stock_history',
    'returns_management',
    'refunds_advanced',
    'finance_basic',
    'accounting_advanced',
    'api_access',
    'multi_store',
    'support_email',
    'support_phone',
  ],
  enterprise: [
    'dashboard_basic',
    'dashboard_advanced',
    'products_management',
    'orders_management',
    'pos_caisse',
    'analytics_basic',
    'analytics_advanced',
    'analytics_coach_ai',
    'analytics_benchmark',
    'clients_basic',
    'clients_advanced',
    'loyalty_program',
    'coupons_basic',
    'coupons_unlimited',
    'collections_basic',
    'collections_unlimited',
    'reports_basic',
    'reports_advanced',
    'reports_detailed',
    'export_data',
    'low_stock_alerts',
    'stock_history',
    'returns_management',
    'refunds_advanced',
    'finance_basic',
    'accounting_advanced',
    'api_access',
    'multi_store',
    'support_email',
    'support_phone',
    'support_24_7',
    'white_label',
    'custom_development',
  ],
};

// Configuration des limites par plan
const PLAN_LIMITS: Record<string, PlanLimits> = {
  trial: {
    maxProducts: 20,
    maxStores: 1,
    maxCoupons: 3,
    maxCollections: 3,
    analyticsRetentionDays: 7, // 7 jours de données analytics
    duration: '1_month',
  },
  standard: {
    maxProducts: 50,
    maxStores: 1,
    maxCoupons: 5,
    maxCollections: 5,
    analyticsRetentionDays: 30, // 30 jours de données analytics
    duration: 'unlimited',
  },
  pro: {
    maxProducts: 200,
    maxStores: 1,
    maxCoupons: 10,
    maxCollections: 10,
    analyticsRetentionDays: 90, // 90 jours de données analytics
    duration: 'unlimited',
  },
  business: {
    maxProducts: Infinity,
    maxStores: 3,
    maxCoupons: 20,
    maxCollections: 20,
    analyticsRetentionDays: 365, // 1 an de données analytics
    duration: 'unlimited',
  },
  enterprise: {
    maxProducts: Infinity,
    maxStores: Infinity,
    maxCoupons: Infinity,
    maxCollections: Infinity,
    analyticsRetentionDays: Infinity, // Données analytics illimitées
    duration: 'unlimited',
  },
};

// Labels des fonctionnalités pour l'affichage
export const FEATURE_LABELS: Record<FeatureKey, { name: string; description: string; category: string }> = {
  dashboard_basic: {
    name: 'Tableau de bord basique',
    description: 'KPIs essentiels et statistiques de base',
    category: 'Dashboard',
  },
  dashboard_advanced: {
    name: 'Tableau de bord avancé',
    description: 'KPIs détaillés et analyses avancées',
    category: 'Dashboard',
  },
  products_management: {
    name: 'Gestion des produits',
    description: 'CRUD complet des produits',
    category: 'Produits',
  },
  orders_management: {
    name: 'Gestion des commandes',
    description: 'Gestion complète des commandes',
    category: 'Commandes',
  },
  pos_caisse: {
    name: 'Point de vente (Caisse)',
    description: 'Ventes physiques en magasin',
    category: 'Vente',
  },
  analytics_basic: {
    name: 'Analytics de base',
    description: 'Statistiques sur 7 et 30 jours',
    category: 'Analytics',
  },
  analytics_advanced: {
    name: 'Analytics avancés',
    description: 'Analyses sur 3 mois, 6 mois, 1 an',
    category: 'Analytics',
  },
  analytics_coach_ai: {
    name: 'Coach IA',
    description: 'Conseils stratégiques par IA',
    category: 'Analytics',
  },
  analytics_benchmark: {
    name: 'Benchmark marché',
    description: 'Comparaison avec autres boutiques',
    category: 'Analytics',
  },
  clients_basic: {
    name: 'Gestion clients basique',
    description: 'Liste et informations clients',
    category: 'Clients',
  },
  clients_advanced: {
    name: 'Gestion clients avancée',
    description: 'Segmentation et historique détaillé',
    category: 'Clients',
  },
  loyalty_program: {
    name: 'Programme de fidélité',
    description: 'Système de points et niveaux',
    category: 'Clients',
  },
  coupons_basic: {
    name: 'Codes promo basiques',
    description: 'Création de codes promo simples',
    category: 'Marketing',
  },
  coupons_unlimited: {
    name: 'Codes promo illimités',
    description: 'Création illimitée de codes promo',
    category: 'Marketing',
  },
  collections_basic: {
    name: 'Collections basiques',
    description: 'Organisation par collections',
    category: 'Produits',
  },
  collections_unlimited: {
    name: 'Collections illimitées',
    description: 'Organisation illimitée par collections',
    category: 'Produits',
  },
  reports_basic: {
    name: 'Rapports basiques',
    description: 'Ventes journalières et mensuelles',
    category: 'Rapports',
  },
  reports_advanced: {
    name: 'Rapports avancés',
    description: 'Rapports par collection et catégorie',
    category: 'Rapports',
  },
  reports_detailed: {
    name: 'Rapports détaillés',
    description: 'Marges, inventaire, clients, retours',
    category: 'Rapports',
  },
  export_data: {
    name: 'Export de données',
    description: 'Export CSV et PDF',
    category: 'Rapports',
  },
  low_stock_alerts: {
    name: 'Alertes stock faible',
    description: 'Notifications pour stock faible',
    category: 'Stock',
  },
  stock_history: {
    name: 'Historique des mouvements',
    description: 'Traçabilité des entrées/sorties',
    category: 'Stock',
  },
  returns_management: {
    name: 'Gestion des retours',
    description: 'Processus de retour produits',
    category: 'Commandes',
  },
  refunds_basic: {
    name: 'Remboursements basiques',
    description: 'Gestion simple des remboursements',
    category: 'Finance',
  },
  refunds_advanced: {
    name: 'Remboursements avancés',
    description: 'Workflow complet de remboursement',
    category: 'Finance',
  },
  finance_basic: {
    name: 'Finance de base',
    description: 'Portefeuille et retraits',
    category: 'Finance',
  },
  accounting_advanced: {
    name: 'Comptabilité avancée',
    description: 'Compte de résultat, bilan, dépenses',
    category: 'Finance',
  },
  api_access: {
    name: 'API d\'intégration',
    description: 'API REST et webhooks',
    category: 'Intégration',
  },
  multi_store: {
    name: 'Multi-boutiques',
    description: 'Gestion de plusieurs boutiques',
    category: 'Boutique',
  },
  support_email: {
    name: 'Support email',
    description: 'Support par email',
    category: 'Support',
  },
  support_phone: {
    name: 'Support téléphonique',
    description: 'Support par téléphone',
    category: 'Support',
  },
  support_24_7: {
    name: 'Support 24/7',
    description: 'Support disponible 24h/24 et 7j/7',
    category: 'Support',
  },
  white_label: {
    name: 'White-label',
    description: 'Marque personnalisée',
    category: 'Personnalisation',
  },
  custom_development: {
    name: 'Développement personnalisé',
    description: 'Fonctionnalités sur mesure',
    category: 'Personnalisation',
  },
};

// Messages d'upgrade pour les fonctionnalités
export const UPGRADE_MESSAGES: Record<FeatureKey, string> = {
  dashboard_advanced: 'Le tableau de bord avancé nécessite le plan Pro (10 000 FCFA/mois)',
  analytics_advanced: 'Les analytics avancés nécessitent le plan Pro (10 000 FCFA/mois)',
  analytics_coach_ai: 'Le coach IA nécessite le plan Pro (10 000 FCFA/mois)',
  analytics_benchmark: 'Le benchmark marché nécessite le plan Pro (10 000 FCFA/mois)',
  clients_advanced: 'La gestion clients avancée nécessite le plan Pro (10 000 FCFA/mois)',
  loyalty_program: 'Le programme de fidélité nécessite le plan Pro (10 000 FCFA/mois)',
  coupons_unlimited: 'Les codes promo illimités nécessitent le plan Pro (10 000 FCFA/mois)',
  collections_unlimited: 'Les collections illimitées nécessitent le plan Pro (10 000 FCFA/mois)',
  reports_advanced: 'Les rapports avancés nécessitent le plan Pro (10 000 FCFA/mois)',
  reports_detailed: 'Les rapports détaillés nécessitent le plan Pro (10 000 FCFA/mois)',
  export_data: 'L\'export de données nécessite le plan Pro (10 000 FCFA/mois)',
  stock_history: 'L\'historique des mouvements nécessite le plan Pro (10 000 FCFA/mois)',
  refunds_advanced: 'Les remboursements avancés nécessitent le plan Pro (10 000 FCFA/mois)',
  accounting_advanced: 'La comptabilité avancée nécessite le plan Business (25 000 FCFA/mois)',
  api_access: 'L\'API d\'intégration nécessite le plan Business (25 000 FCFA/mois)',
  multi_store: 'La gestion multi-boutiques nécessite le plan Business (25 000 FCFA/mois)',
  support_phone: 'Le support téléphonique nécessite le plan Business (25 000 FCFA/mois)',
  support_24_7: 'Le support 24/7 nécessite le plan Enterprise (sur devis)',
  white_label: 'Le white-label nécessite le plan Enterprise (sur devis)',
  custom_development: 'Le développement personnalisé nécessite le plan Enterprise (sur devis)',
  dashboard_basic: 'Fonctionnalité non disponible avec votre plan actuel',
  products_management: 'Fonctionnalité non disponible avec votre plan actuel',
  orders_management: 'Fonctionnalité non disponible avec votre plan actuel',
  pos_caisse: 'Fonctionnalité non disponible avec votre plan actuel',
  analytics_basic: 'Fonctionnalité non disponible avec votre plan actuel',
  clients_basic: 'Fonctionnalité non disponible avec votre plan actuel',
  coupons_basic: 'Fonctionnalité non disponible avec votre plan actuel',
  collections_basic: 'Fonctionnalité non disponible avec votre plan actuel',
  reports_basic: 'Fonctionnalité non disponible avec votre plan actuel',
  low_stock_alerts: 'Fonctionnalité non disponible avec votre plan actuel',
  returns_management: 'Fonctionnalité non disponible avec votre plan actuel',
  refunds_basic: 'Fonctionnalité non disponible avec votre plan actuel',
  finance_basic: 'Fonctionnalité non disponible avec votre plan actuel',
  support_email: 'Fonctionnalité non disponible avec votre plan actuel',
};

class FeatureGatingService {
  /**
   * Charge les fonctionnalités depuis la base de données
   */
  async loadFeaturesFromDatabase(): Promise<void> {
    try {
      const supabase = useSupabase();
      const { data, error } = await supabase
        .from('plan_features')
        .select('plan_name, feature_key, is_enabled');

      if (error) {
        console.error('Error loading plan features from database:', error);
        cachedPlanFeatures = DEFAULT_PLAN_FEATURES;
        cacheLoaded = true;
        return;
      }

      // Construire le cache depuis les données de la base
      const featuresFromDb: Record<string, FeatureKey[]> = {};
      
      if (data) {
        data.forEach((row: any) => {
          const plan = row.plan_name;
          const feature = row.feature_key as FeatureKey;
          
          if (!featuresFromDb[plan]) {
            featuresFromDb[plan] = [];
          }
          
          if (row.is_enabled) {
            featuresFromDb[plan].push(feature);
          }
        });
      }

      // Fusionner avec les valeurs par défaut pour les plans manquants
      cachedPlanFeatures = {
        ...DEFAULT_PLAN_FEATURES,
        ...featuresFromDb,
      };
      
      cacheLoaded = true;
      console.log('Plan features loaded from database successfully');
    } catch (error) {
      console.error('Error loading plan features:', error);
      cachedPlanFeatures = DEFAULT_PLAN_FEATURES;
      cacheLoaded = true;
    }
  }

  /**
   * Sauvegarde une fonctionnalité dans la base de données
   */
  async saveFeatureToDatabase(planName: string, featureKey: FeatureKey, isEnabled: boolean): Promise<boolean> {
    try {
      const supabase = useSupabase();
      
      const { error } = await supabase
        .from('plan_features')
        .upsert({
          plan_name: planName,
          feature_key: featureKey,
          is_enabled: isEnabled,
        }, {
          onConflict: 'plan_name,feature_key',
        });

      if (error) {
        console.error('Error saving plan feature to database:', error);
        return false;
      }

      // Mettre à jour le cache local
      if (!cachedPlanFeatures) {
        cachedPlanFeatures = { ...DEFAULT_PLAN_FEATURES };
      }
      
      if (!cachedPlanFeatures[planName]) {
        cachedPlanFeatures[planName] = [];
      }

      if (isEnabled) {
        if (!cachedPlanFeatures[planName].includes(featureKey)) {
          cachedPlanFeatures[planName].push(featureKey);
        }
      } else {
        cachedPlanFeatures[planName] = cachedPlanFeatures[planName].filter(f => f !== featureKey);
      }

      return true;
    } catch (error) {
      console.error('Error saving plan feature:', error);
      return false;
    }
  }

  /**
   * Obtient les fonctionnalités (avec chargement depuis la base si nécessaire)
   */
  private async ensureCacheLoaded(): Promise<void> {
    if (!cacheLoaded) {
      await this.loadFeaturesFromDatabase();
    }
  }

  /**
   * Vérifie si une boutique a accès à une fonctionnalité
   */
  hasFeatureAccess(store: Store, featureKey: FeatureKey): boolean {
    const plan = store.subscription_plan || 'trial';
    const planFeatures = cachedPlanFeatures?.[plan] || DEFAULT_PLAN_FEATURES[plan] || DEFAULT_PLAN_FEATURES.trial;
    return planFeatures.includes(featureKey);
  }

  /**
   * Vérifie si une boutique peut ajouter un produit (limite atteinte ?)
   */
  canAddProduct(store: Store, currentProductCount: number): boolean {
    const plan = store.subscription_plan || 'trial';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    return currentProductCount < limits.maxProducts;
  }

  /**
   * Vérifie si une boutique peut créer une nouvelle boutique (multi-store)
   */
  canAddStore(store: Store, currentStoreCount: number): boolean {
    const plan = store.subscription_plan || 'trial';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    return currentStoreCount < limits.maxStores;
  }

  /**
   * Vérifie si une boutique peut ajouter un coupon (limite atteinte ?)
   */
  canAddCoupon(store: Store, currentCouponCount: number): boolean {
    const plan = store.subscription_plan || 'trial';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    if (!limits.maxCoupons) return true; // Pas de limite
    return currentCouponCount < limits.maxCoupons;
  }

  /**
   * Vérifie si une boutique peut ajouter une collection (limite atteinte ?)
   */
  canAddCollection(store: Store, currentCollectionCount: number): boolean {
    const plan = store.subscription_plan || 'trial';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    if (!limits.maxCollections) return true; // Pas de limite
    return currentCollectionCount < limits.maxCollections;
  }

  /**
   * Obtient le nombre de jours de rétention des données analytics pour un plan
   */
  getAnalyticsRetentionDays(store: Store): number {
    const plan = store.subscription_plan || 'trial';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    return limits.analyticsRetentionDays || Infinity;
  }

  /**
   * Obtient les limites d'un plan
   */
  getPlanLimits(plan: string): PlanLimits {
    return PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
  }

  /**
   * Obtient toutes les fonctionnalités d'un plan
   */
  getPlanFeatures(plan: string): FeatureKey[] {
    return cachedPlanFeatures?.[plan] || DEFAULT_PLAN_FEATURES[plan] || DEFAULT_PLAN_FEATURES.trial;
  }

  /**
   * Obtient le message d'upgrade pour une fonctionnalité
   */
  getUpgradeMessage(featureKey: FeatureKey): string {
    return UPGRADE_MESSAGES[featureKey] || 'Fonctionnalité non disponible avec votre plan actuel';
  }

  /**
   * Obtient le plan minimum requis pour une fonctionnalité
   */
  getRequiredPlanForFeature(featureKey: FeatureKey): string {
    // Trouver le plan le plus bas qui a cette fonctionnalité
    const planHierarchy = ['trial', 'standard', 'pro', 'business', 'enterprise'];
    for (const plan of planHierarchy) {
      const planFeatures = cachedPlanFeatures?.[plan] || DEFAULT_PLAN_FEATURES[plan];
      if (planFeatures?.includes(featureKey)) {
        return plan;
      }
    }
    return 'enterprise'; // Par défaut
  }

  /**
   * Vérifie si un essai gratuit est disponible pour un plan
   */
  hasTrialAvailable(plan: string): boolean {
    return plan === 'trial';
  }

  /**
   * Obtient le prix d'un plan
   */
  getPlanPrice(plan: string): number {
    const prices: Record<string, number> = {
      trial: 0,
      standard: 2500,
      pro: 10000,
      business: 25000,
      enterprise: 0, // Sur devis
    };
    return prices[plan] || 0;
  }

  /**
   * Obtient toutes les fonctionnalités groupées par catégorie
   */
  getFeaturesByCategory(): Record<string, FeatureKey[]> {
    const categories: Record<string, FeatureKey[]> = {};
    
    Object.entries(FEATURE_LABELS).forEach(([key, value]) => {
      const category = value.category;
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(key as FeatureKey);
    });
    
    return categories;
  }

  /**
   * Vérifie si une fonctionnalité est disponible dans un plan spécifique
   */
  isFeatureInPlan(featureKey: FeatureKey, plan: string): boolean {
    const planFeatures = cachedPlanFeatures?.[plan] || DEFAULT_PLAN_FEATURES[plan] || DEFAULT_PLAN_FEATURES.trial;
    return planFeatures.includes(featureKey);
  }

  /**
   * Active une fonctionnalité pour un plan (pour admin)
   */
  async enableFeatureForPlan(featureKey: FeatureKey, plan: string): Promise<boolean> {
    return await this.saveFeatureToDatabase(plan, featureKey, true);
  }

  /**
   * Désactive une fonctionnalité pour un plan (pour admin)
   */
  async disableFeatureForPlan(featureKey: FeatureKey, plan: string): Promise<boolean> {
    return await this.saveFeatureToDatabase(plan, featureKey, false);
  }
}

export const featureGatingService = new FeatureGatingService();

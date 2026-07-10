import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { ADMIN_CONFIG } from '../config/admin';
import { Button } from '../components';
import { authService } from '../services/authService';
import { storeService } from '../services/storeService';
import { Plan, planService } from '../services/planService';
import { useSettingsStore } from '../store/settingsStore';
import { contactStore } from '../services/contactService';
import { pointsService } from '../services/pointsService';
import { FEATURE_LABELS } from '../services/featureGatingService';

type Props = NativeStackScreenProps<RootStackParamList, 'SubscriptionExpired'>;

interface Store {
  id: string;
  name: string;
  user_id: string;
}

export const SubscriptionExpiredScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [store, setStore] = React.useState<Store | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [freePlanUsed, setFreePlanUsed] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [userPoints, setUserPoints] = React.useState(0);
  const [payingWithPoints, setPayingWithPoints] = React.useState(false);
  const adminConfig = useSettingsStore(state => state.adminConfig);

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  // Récupérer les infos du vendeur et les plans
  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('🔍 SubscriptionExpired: Début chargement des données');

      // 1. Vérifier l'utilisateur
      const user = await authService.getCurrentUser();
      if (!user) {
        console.error('❌ SubscriptionExpired: Aucun utilisateur trouvé');
        (navigation as any).navigate('Landing');
        return;
      }
      setUserId(user.id);
      console.log('✅ SubscriptionExpired: Utilisateur trouvé', user.id);

      // 1.5 Fetch points
      try {
        const pointsInfo = await pointsService.getUserPointsInfo(user.id);
        setUserPoints(pointsInfo.points || 0);
      } catch (e) {
        console.warn('Failed to load points info:', e);
      }

      // 2. Récupérer la boutique de l'utilisateur
      const storeData = await storeService.getByUser(user.id);
      
      if (storeData) {
        if (storeService.isSubscriptionActive(storeData)) {
          console.log('✅ SubscriptionExpired: Boutique réactivée, redirection...');
          navigation.replace('SellerTabs', { screen: 'SellerDashboard' } as any);
          return;
        }
      }
      setStore(storeData);
      console.log('✅ SubscriptionExpired: Store trouvé', storeData);

      // 3. Récupérer les plans actifs
      const plansData = await planService.getAll();
      const activePlans = (plansData || []).filter(p => p.status === 'active');
      setPlans(activePlans as Plan[]);
      console.log('✅ SubscriptionExpired: Plans chargés', activePlans.length);

      // 4. Vérifier si le plan gratuit a été utilisé
      // Un store qui arrive ici avec status "expired" a forcément déjà consommé son essai gratuit.
      // On vérifie aussi la table subscriptions par sécurité (si un admin a manuellement réattribué un essai).
      if (storeData && activePlans.length > 0) {
        const freePlan = activePlans.find((p) => p.is_free);
        
        // Le store a déjà un abonnement expiré = il a déjà utilisé au moins un plan (y compris le gratuit)
        const storeAlreadyHadSubscription = (storeData as any).subscription_status === 'expired';
        
        if (freePlan && freePlan.id) {
          const usedInDb = await planService.checkFreePlanUsed(storeData.id, freePlan.id);
          const used = usedInDb || storeAlreadyHadSubscription;
          setFreePlanUsed(used);
          if (used) console.log('✅ SubscriptionExpired: Plan gratuit déjà utilisé (DB:', usedInDb, '| store expired:', storeAlreadyHadSubscription, ')');
        } else if (storeAlreadyHadSubscription) {
          // Pas de plan gratuit trouvé dans les plans actifs, mais le store a expiré
          setFreePlanUsed(true);
          console.log('✅ SubscriptionExpired: Plan gratuit désactivé (store déjà expiré)');
        }
      }
      
      console.log('✅ SubscriptionExpired: Données chargées avec succès');
    } catch (error: any) {
      console.error('❌ SubscriptionExpired: Erreur générale', error);
      errorHandler.handleDatabaseError(error, 'loadData');
      
      // Afficher un message plus utile
      Alert.alert(
        'Erreur de chargement',
        'Impossible de charger les données. Veuillez réessayer ou contacter le support.',
        [
          { text: 'Réessayer', onPress: () => loadData() },
          { text: 'Retour à l\'accueil', onPress: () => (navigation as any).navigate('Landing') }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await authService.signOut();
      (navigation as any).replace('Landing');
    } catch (error: any) {
      errorHandler.handleDatabaseError(error, 'Sign out error:');
      Alert.alert('Erreur', 'Impossible de se déconnecter');
    } finally {
      setSigningOut(false);
    }
  };

  const handlePayWithPoints = async (plan: Plan) => {
    const requiredPoints = plan.price;
    if (userPoints < requiredPoints) {
      Alert.alert(
        'Points XP insuffisants',
        `Vous avez ${userPoints.toLocaleString()} XP.\nIl en faut ${requiredPoints.toLocaleString()} XP pour ce plan (1 XP = 1 FCFA).`
      );
      return;
    }

    const doPayment = async () => {
      try {
        setPayingWithPoints(true);
        const { supabase: client } = await import('../lib/supabase');
        
        if (!client) {
          throw new Error('Supabase client not available');
        }

        await client.rpc('add_points_to_user', {
          p_user_id: userId!,
          p_amount: -requiredPoints,
          p_action_type: 'SUBSCRIPTION_PAYMENT',
          p_reference_id: plan.id
        });

        const newEnd = new Date();
        newEnd.setDate(newEnd.getDate() + (plan.duration_days || 30));
        
        if (store?.id) {
          await client
            .from('stores')
            .update({
              subscription_plan: plan.name,
              subscription_status: 'active',
              subscription_end: newEnd.toISOString(),
              subscription_price: plan.price,
            })
            .eq('id', store.id);
        }

        setUserPoints(prev => prev - requiredPoints);
        Alert.alert(
          'Succès 🎉',
          `Votre plan ${plan.name} est réactivé !\n${requiredPoints.toLocaleString()} XP débités.`,
          [{ text: 'OK', onPress: () => navigation.replace('SellerTabs', { screen: 'SellerDashboard' } as any) }]
        );
      } catch (err) {
        Alert.alert('Erreur', 'Impossible de traiter le paiement par points.');
        console.error('Pay with points error:', err);
      } finally {
        setPayingWithPoints(false);
      }
    };

    Alert.alert(
      'Payer avec vos points XP',
      `💱 Taux: 1 XP = 1 FCFA\n\nPlan: ${plan.name}\nCoût: ${requiredPoints.toLocaleString()} XP (= ${requiredPoints.toLocaleString()} FCFA)\n\n⭐ Solde actuel: ${userPoints.toLocaleString()} XP\n📉 Après paiement: ${(userPoints - requiredPoints).toLocaleString()} XP`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer le paiement', onPress: doPayment },
      ]
    );
  };

  const openWhatsApp = async (plan: Plan) => {
    if (!store || !userId) return;

    setSelectedPlan(plan.id);
    
    // Petit délai pour l'animation
    await new Promise(resolve => setTimeout(resolve, 300));

    const adminPhoneNumber = adminConfig.whatsappNumber;
    const message = `Bonjour 👋\n\nJe souhaite activer le plan "${plan.name}" pour ma boutique.\n\n📦 Infos:\n• Boutique: ${store.name}\n• Plan: ${plan.name}\n• Prix: ${plan.price} FCFA\n• Durée: ${plan.duration_days} jours\n\nMerci!`;

    try {
      await contactStore({ rawPhone: adminPhoneNumber, message });
    } catch (e) {
      // contactStore already handles alerts; log for debugging
      console.error('Erreur lors de l ouverture de WhatsApp', e);
      Alert.alert('Erreur', 'Impossible d ouvrir WhatsApp');
    }

    setSelectedPlan(null);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('fr-FR') + ' FCFA';
  };

  // Filtrer les fonctionnalités pour ne garder que les versions avancées quand les deux existent
  const filterFeatures = (features: string[]) => {
    const featureMap = new Map<string, string>();
    
    // Mapping des fonctionnalités basiques vers leurs versions avancées
    const basicToAdvanced: Record<string, string> = {
      'dashboard_basic': 'dashboard_advanced',
      'analytics_basic': 'analytics_advanced',
      'clients_basic': 'clients_advanced',
      'coupons_basic': 'coupons_unlimited',
      'collections_basic': 'collections_unlimited',
      'reports_basic': 'reports_advanced',
      'refunds_basic': 'refunds_advanced',
      'finance_basic': 'accounting_advanced',
    };

    features.forEach(feature => {
      const advancedVersion = basicToAdvanced[feature];
      if (advancedVersion && features.includes(advancedVersion)) {
        // Si la version avancée existe, on l'ajoutera plus tard, on ignore la basique
        return;
      }
      featureMap.set(feature, feature);
    });

    // Ajouter les versions avancées si elles existent
    features.forEach(feature => {
      if (feature.endsWith('_advanced') || feature.endsWith('_unlimited')) {
        featureMap.set(feature, feature);
      }
    });

    return Array.from(featureMap.keys());
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.bg, COLORS.card]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Chargement des plans...</Text>
        </View>
      </View>
    );
  }

  // Vérifier si les données sont valides
  if (!store) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.bg, COLORS.card]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="storefront-outline" size={48} color={COLORS.warning} />
          <Text style={styles.errorTitle}>Aucune boutique trouvée</Text>
          <Text style={styles.errorText}>
            Vous devez d'abord créer une boutique pour accéder aux plans d'abonnement.
          </Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={() => navigation.navigate('SellerAddStore')}
          >
            <Text style={styles.errorButtonText}>Créer ma boutique</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.errorButton, { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border }]}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <Text style={[styles.errorButtonText, { color: COLORS.text }]}>Se déconnecter</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.bg, COLORS.card]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="card-outline" size={48} color={COLORS.warning} />
          <Text style={styles.errorTitle}>Aucun plan disponible</Text>
          <Text style={styles.errorText}>
            Les plans d'abonnement ne sont pas disponibles actuellement.
          </Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={() => navigation.navigate('Landing')}
          >
            <Text style={styles.errorButtonText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.bg, COLORS.card]}
        style={StyleSheet.absoluteFill}
      />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[
          styles.headerContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="alert-circle" size={32} color={COLORS.accent} />
          </View>
          <Text style={styles.headerTitle}>Abonnement expiré</Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={() => loadData()}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color={COLORS.accent} />
            <Text style={styles.refreshText}>Vérifier l'activation</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Store Info Card */}
        {store && (
          <Animated.View 
            style={[
              styles.storeCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <BlurView intensity={20} tint="light" style={styles.storeBlur}>
              <View style={styles.storeContent}>
                <View style={styles.storeIconContainer}>
                  <Ionicons name="storefront" size={24} color={COLORS.accent} />
                </View>
                <View style={styles.storeInfo}>
                  <Text style={styles.storeLabel}>Votre boutique</Text>
                  <Text style={styles.storeName}>{store.name}</Text>
                </View>
              </View>
            </BlurView>
          </Animated.View>
        )}

        {/* Info Message */}
        <Animated.View 
          style={[
            styles.infoContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <Ionicons name="information-circle" size={24} color={COLORS.accent} />
          <Text style={styles.infoText}>
            Choisissez un plan pour réactiver votre boutique et continuer à vendre
          </Text>
        </Animated.View>

        {/* Plans Section */}
        <Animated.View style={[
          styles.plansSection,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Plans disponibles</Text>
            <Text style={styles.sectionSubtitle}>
              {plans.length} plan{plans.length > 1 ? 's' : ''} correspondant{plans.length > 1 ? 's' : ''} à vos besoins
            </Text>
          </View>

          <View style={styles.plansGrid}>
            {plans.map((plan, index) => {
              const isPlanDisabled = plan.is_free && freePlanUsed;
              const isSelected = selectedPlan === plan.id;
              const delay = index * 150;

              return (
                <Animated.View
                  key={plan.id}
                  style={[
                    styles.planWrapper,
                    {
                      opacity: fadeAnim,
                      transform: [{
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, delay]
                        })
                      }]
                    }
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => !isPlanDisabled && openWhatsApp(plan)}
                    disabled={isPlanDisabled}
                    style={[
                      styles.planCard,
                      isPlanDisabled && styles.planCardDisabled,
                      isSelected && styles.planCardSelected,
                    ]}
                  >
                    {plan.is_free && (
                      <View style={styles.freeBadge}>
                        <Text style={styles.freeBadgeText}>Essai gratuit</Text>
                      </View>
                    )}

                    <View style={styles.planHeader}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <View style={styles.priceContainer}>
                        <Text style={styles.planPrice}>
                          {plan.is_free ? 'Gratuit' : formatPrice(plan.price)}
                        </Text>
                        {!plan.is_free && (
                          <Text style={styles.planDuration}>
                            /{plan.duration_days} jours
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.featuresContainer}>
                      {Array.isArray(plan.features) && filterFeatures(plan.features).map((feature, idx) => (
                        <View key={idx} style={styles.featureRow}>
                          <View style={styles.featureIconContainer}>
                            <Ionicons 
                              name="checkmark" 
                              size={14} 
                              color={COLORS.accent} 
                            />
                          </View>
                          <Text style={styles.featureText}>{FEATURE_LABELS[feature as keyof typeof FEATURE_LABELS]?.name || feature}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Limits Section */}
                    {(plan.product_limit !== undefined || plan.max_coupons !== undefined || plan.max_collections !== undefined || plan.analytics_retention_days !== undefined) && (
                      <View style={styles.limitsSection}>
                        <Text style={styles.limitsTitle}>Limites</Text>
                        {plan.product_limit !== undefined && (
                          <View style={styles.limitItem}>
                            <Ionicons name="cube-outline" size={16} color={COLORS.textMuted} />
                            <Text style={styles.limitText}>Jusqu'à {plan.product_limit === -1 ? 'Illimité' : `${plan.product_limit} produits`}</Text>
                          </View>
                        )}
                        {plan.max_coupons !== undefined && (
                          <View style={styles.limitItem}>
                            <Ionicons name="pricetag-outline" size={16} color={COLORS.textMuted} />
                            <Text style={styles.limitText}>Jusqu'à {plan.max_coupons === -1 ? 'Illimité' : `${plan.max_coupons} codes promo`}</Text>
                          </View>
                        )}
                        {plan.max_collections !== undefined && (
                          <View style={styles.limitItem}>
                            <Ionicons name="layers-outline" size={16} color={COLORS.textMuted} />
                            <Text style={styles.limitText}>Jusqu'à {plan.max_collections === -1 ? 'Illimité' : `${plan.max_collections} collections`}</Text>
                          </View>
                        )}
                        {plan.analytics_retention_days !== undefined && (
                          <View style={styles.limitItem}>
                            <Ionicons name="analytics-outline" size={16} color={COLORS.textMuted} />
                            <Text style={styles.limitText}>Données analytics conservées {plan.analytics_retention_days} jours</Text>
                          </View>
                        )}
                      </View>
                    )}

                    <View style={[
                      styles.planAction,
                      isPlanDisabled && styles.planActionDisabled
                    ]}>
                      {isPlanDisabled ? (
                        <>
                          <Ionicons 
                            name="lock-closed" 
                            size={18} 
                            color={COLORS.textMuted} 
                          />
                          <Text style={styles.planActionTextDisabled}>
                            Déjà utilisé
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons 
                            name="logo-whatsapp" 
                            size={18} 
                            color={COLORS.whatsapp} 
                          />
                          <Text style={styles.planActionText}>
                            {plan.is_free ? 'Activer' : 'Contacter via WhatsApp'}
                          </Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>

                  {!plan.is_free && (
                    <TouchableOpacity
                      style={[styles.pointsPayButton, userPoints < plan.price && { opacity: 0.4 }]}
                      onPress={() => handlePayWithPoints(plan)}
                      disabled={payingWithPoints || userPoints < plan.price || isPlanDisabled}
                    >
                      {payingWithPoints ? (
                        <ActivityIndicator size="small" color={COLORS.warning} />
                      ) : (
                        <>
                          <Ionicons name="star" size={16} color={COLORS.warning} />
                          <Text style={styles.pointsPayText}>
                            Payer {plan.price.toLocaleString()} XP
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View style={[
          styles.actionButtonsContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <TouchableOpacity
            style={styles.backToHubButton}
            onPress={() => navigation.navigate('SellerHub')}
          >
            <Ionicons name="home-outline" size={20} color={COLORS.text} />
            <Text style={styles.backToHubText}>Retour au hub</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color={COLORS.textMuted} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color={COLORS.textMuted} />
                <Text style={styles.logoutText}>Se déconnecter</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Support Link */}
        <Animated.View style={[
          styles.supportContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <Text style={styles.supportText}>
            Besoin d'aide ?{' '}
            <Text 
              style={styles.supportLink}
              onPress={() => contactStore({ rawPhone: adminConfig.whatsappNumber })}
            >
              Contactez-nous
            </Text>
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl * 2,
    paddingBottom: SPACING.xxl,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  headerIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: `${COLORS.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 22,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: `${COLORS.accent}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    marginTop: SPACING.md,
  },
  refreshText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.accent,
  },
  storeCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: `${COLORS.accent}20`,
  },
  storeBlur: {
    overflow: 'hidden',
  },
  storeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
  },
  storeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  storeInfo: {
    flex: 1,
  },
  storeLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  storeName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.accent}08`,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: `${COLORS.accent}20`,
    gap: SPACING.md,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    lineHeight: 22,
  },
  plansSection: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  plansGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  planWrapper: {
    width: '48%',
  },
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.border,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  planCardSelected: {
    borderColor: COLORS.accent,
    transform: [{ scale: 1.02 }],
  },
  planCardDisabled: {
    opacity: 0.7,
    backgroundColor: COLORS.card,
  },
  freeBadge: {
    position: 'absolute',
    top: -1,
    right: SPACING.lg,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
  },
  freeBadgeText: {
    color: '#fff',
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planHeader: {
    marginBottom: SPACING.lg,
  },
  planName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.accent,
  },
  planDuration: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginLeft: SPACING.xs,
  },
  featuresContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureIconContainer: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    backgroundColor: `${COLORS.accent}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
  planAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.accent + '15',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
  },
  planActionDisabled: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
  },
  planActionText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.whatsapp,
  },
  planActionTextDisabled: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  actionButtonsContainer: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  backToHubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  backToHubText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: '#fff',
  },
  logoutContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  supportContainer: {
    alignItems: 'center',
  },
  supportText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  supportLink: {
    color: COLORS.accent,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  errorTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  errorButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  pointsPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning + '10',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
  },
  pointsPayText: {
    color: COLORS.warning,
    fontWeight: '600',
    marginLeft: 6,
    fontSize: FONT_SIZE.md,
  },
  limitsSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  limitsTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  limitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  limitText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
});
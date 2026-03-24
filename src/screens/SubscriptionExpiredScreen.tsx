import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
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
import { supabase, authService } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'SubscriptionExpired'>;

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  features: string[];
  is_free: boolean;
  status: string;
}

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
      const {
        data: { user },
      } = await supabase!.auth.getUser();
      if (!user) {
        console.error('❌ SubscriptionExpired: Aucun utilisateur trouvé');
        // Rediriger vers la page de connexion si pas d'utilisateur
        navigation.reset({
          index: 0,
          routes: [{ name: 'Landing' }],
        });
        return;
      }
      setUserId(user.id);
      console.log('✅ SubscriptionExpired: Utilisateur trouvé', user.id);

      // 2. Récupérer la boutique de l'utilisateur
      const { data: storeData, error: storeError } = await supabase!
        .from('stores')
        .select('id, name, user_id, subscription_status, subscription_end')
        .eq('user_id', user.id)
        .maybeSingle();

      if (storeError) {
        console.error('❌ SubscriptionExpired: Erreur chargement store', storeError);
        throw storeError;
      }

      if (storeData) {
        // Si la boutique est déjà réactivée (ex: par l'admin), on redirige vers le dashboard
        if (storeData.subscription_status !== 'expired' && storeData.subscription_status !== 'cancelled') {
          const isDateExpired = storeData.subscription_end && new Date(storeData.subscription_end) < new Date();
          if (!isDateExpired) {
            console.log('✅ SubscriptionExpired: Boutique réactivée, redirection...');
            navigation.replace('SellerTabs');
            return;
          }
        }
      }
      
      if (!storeData) {
        console.log('ℹ️ SubscriptionExpired: Aucune boutique trouvée');
        // Ne pas throw d'erreur, juste continuer sans store
      }
      setStore(storeData);
      console.log('✅ SubscriptionExpired: Store trouvé', storeData);

      // 3. Récupérer les plans actifs
      const { data: plansData, error: plansError } = await supabase!
        .from('plans')
        .select('id, name, price, duration_days, features, is_free, status')
        .eq('status', 'active')
        .order('price', { ascending: true });

      if (plansError) {
        console.error('❌ SubscriptionExpired: Erreur chargement plans', plansError);
        throw plansError;
      }
      setPlans(plansData || []);
      console.log('✅ SubscriptionExpired: Plans chargés', plansData?.length, 'plans');

      // 4. Vérifier si le plan gratuit a été utilisé
      if (storeData && plansData) {
        const freePlan = plansData.find((p) => p.is_free);
        if (freePlan) {
          const { data: subscriptionHistory } = await supabase!
            .from('subscriptions')
            .select('id')
            .eq('store_id', storeData.id)
            .eq('plan_id', freePlan.id)
            .limit(1);

          if (subscriptionHistory && subscriptionHistory.length > 0) {
            setFreePlanUsed(true);
            console.log('✅ SubscriptionExpired: Plan gratuit déjà utilisé');
          }
        }
      }
      
      console.log('✅ SubscriptionExpired: Données chargées avec succès');
    } catch (error) {
      console.error('❌ SubscriptionExpired: Erreur générale', error);
      errorHandler.handleDatabaseError(error as Error, 'Error loading data:');
      
      // Afficher un message plus utile
      Alert.alert(
        'Erreur de chargement',
        'Impossible de charger les données. Veuillez réessayer ou contacter le support.',
        [
          { text: 'Réessayer', onPress: () => loadData() },
          { text: 'Retour à l\'accueil', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Landing' }] }) }
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
      navigation.reset({
        index: 0,
        routes: [{ name: 'Landing' }],
      });
    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'Sign out error:');
      Alert.alert('Erreur', 'Impossible de se déconnecter');
    } finally {
      setSigningOut(false);
    }
  };

  const openWhatsApp = async (plan: Plan) => {
    if (!store || !userId) return;

    setSelectedPlan(plan.id);
    
    // Petit délai pour l'animation
    await new Promise(resolve => setTimeout(resolve, 300));

    const adminPhoneNumber = ADMIN_CONFIG.WHATSAPP_NUMBER;
    const message = `Bonjour 👋\n\nJe souhaite activer le plan "${plan.name}" pour ma boutique.\n\n📦 Infos:\n• Boutique: ${store.name}\n• Plan: ${plan.name}\n• Prix: ${plan.price}€\n• Durée: ${plan.duration_days} jours\n\nMerci!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = Platform.select({
      ios: `whatsapp://send?phone=${adminPhoneNumber}&text=${encodedMessage}`,
      android: `https://wa.me/${adminPhoneNumber}?text=${encodedMessage}`,
      web: `https://wa.me/${adminPhoneNumber}?text=${encodedMessage}`,
    });

    if (whatsappUrl) {
      Linking.openURL(whatsappUrl).catch(() => {
        Alert.alert(
          'WhatsApp non installé',
          'Veuillez installer WhatsApp ou contacter notre support'
        );
      });
    }
    
    setSelectedPlan(null);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(price);
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
                      {Array.isArray(plan.features) && plan.features.map((feature, idx) => (
                        <View key={idx} style={styles.featureRow}>
                          <View style={styles.featureIconContainer}>
                            <Ionicons 
                              name="checkmark" 
                              size={14} 
                              color={COLORS.accent} 
                            />
                          </View>
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>

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
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* Logout Button */}
        <Animated.View style={[
          styles.logoutContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
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
              onPress={() => Linking.openURL(`https://wa.me/${ADMIN_CONFIG.WHATSAPP_NUMBER}`)}
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    gap: SPACING.md,
  },
  planWrapper: {
    width: '100%',
  },
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 5,
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
    color: COLORS.text,
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
    backgroundColor: `${COLORS.accent}05`,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.accent}10`,
  },
  planActionDisabled: {
    backgroundColor: COLORS.card,
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
  logoutContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
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
    color: COLORS.textSoft,
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
    color: COLORS.textSoft,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  errorButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  errorButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});
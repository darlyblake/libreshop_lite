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
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Récupérer les infos du vendeur et les plans
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('No user found');
        }
        setUserId(user.id);

        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('id, name, user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (storeError) throw storeError;
        setStore(storeData);

        const { data: plansData, error: plansError } = await supabase
          .from('plans')
          .select('id, name, price, duration_days, features, is_free, status')
          .eq('status', 'active')
          .order('price', { ascending: true });

        if (plansError) throw plansError;
        setPlans(plansData || []);

        if (storeData && plansData) {
          const freePlan = plansData.find((p) => p.is_free);
          if (freePlan) {
            const { data: subscriptionHistory } = await supabase
              .from('subscriptions')
              .select('id')
              .eq('store_id', storeData.id)
              .eq('plan_id', freePlan.id)
              .limit(1);

            if (subscriptionHistory && subscriptionHistory.length > 0) {
              setFreePlanUsed(true);
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        Alert.alert('Erreur', 'Impossible de charger les plans');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await authService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
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
        <ActivityIndicator size="large" color={COLORS.accent} />
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
          <Text style={styles.headerSubtitle}>
            Votre période d'essai ou d'abonnement est terminée
          </Text>
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
                            color="#25D366" 
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
    fontSize: FONT_SIZE.base,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 22,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  planCardSelected: {
    borderColor: COLORS.accent,
    transform: [{ scale: 1.02 }],
  },
  planCardDisabled: {
    opacity: 0.7,
    backgroundColor: COLORS.inputBg,
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
    color: 'white',
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
    backgroundColor: COLORS.inputBg,
    borderColor: COLORS.border,
  },
  planActionText: {
    fontSize: FONT_SIZE.base,
    fontWeight: '700',
    color: '#25D366',
  },
  planActionTextDisabled: {
    fontSize: FONT_SIZE.base,
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
    fontSize: FONT_SIZE.base,
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
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
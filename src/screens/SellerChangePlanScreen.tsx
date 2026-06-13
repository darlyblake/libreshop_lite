import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { ADMIN_CONFIG } from '../config/admin';
import { type Plan } from '../lib/supabase';
import { planService } from '../services/planService';
import { storeService } from '../services/storeService';
import { useAuthStore } from '../store';
import { errorHandler } from '../utils/errorHandler';
import { useSettingsStore } from '../store/settingsStore';
import { contactStore } from '../services/contactService';
import { openURL } from '../utils/platformUtils';
import { pointsService } from '../services/pointsService';

export const SellerChangePlanScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [fullPlans, setFullPlans] = useState<Plan[]>([]);
  const [store, setStore] = useState<any>(null);
  const [userPoints, setUserPoints] = useState(0);
  // 1 XP = 1 FCFA — pointsCost is calculated dynamically per plan
  const [payingWithPoints, setPayingWithPoints] = useState(false);
  const adminConfig = useSettingsStore(state => state.adminConfig);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [allPlans, currentStore] = await Promise.all([
        planService.getAll(),
        storeService.getByUser(user.id),
      ]);
      setPlans(allPlans.filter(p => p.status === 'active' && p.price > 0));
      setFullPlans(allPlans);
      setStore(currentStore);
      if (__DEV__) {
        console.log('[SellerChangePlan] Loaded Store:', currentStore);
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'load pricing data');
    } finally {
      setLoading(false);
    }

    // Load user points
    try {
      const pointsInfo = await pointsService.getUserPointsInfo(user.id);
      setUserPoints(pointsInfo.points || 0);
    } catch (e) {
      console.warn('Failed to load points info:', e);
    }
  };

  const calculateProrata = (newPlanPrice: number) => {
    const currentStatus = String(store?.subscription_status || '').toLowerCase();
    const endValue = store?.subscription_end;
    let currentPrice = Number(store?.subscription_price || 0);
    const planName = String(store?.subscription_plan || '').toLowerCase();

    // If currentPrice is 0 (trial), find the standard price for this plan from our full list
    if (currentPrice <= 0 && planName) {
      const matchingPlan = fullPlans.find(p => 
        p.name.toLowerCase() === planName || 
        p.id === store?.subscription_plan
      );
      if (matchingPlan) {
        currentPrice = matchingPlan.price;
      }
    }

    // Debug log moved to loadData to avoid firing per-plan per-render

    // Allow both active and trial to get prorata
    if (!endValue || (currentStatus !== 'active' && currentStatus !== 'trial')) {
      return newPlanPrice;
    }

    if (currentPrice <= 0) {
      return newPlanPrice;
    }

    const now = new Date();
    const endDate = new Date(endValue);
    
    if (endDate <= now) return newPlanPrice;

    const remainingMs = endDate.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    
    const credit = Math.floor((currentPrice / 30) * remainingDays);
    
    return Math.max(0, newPlanPrice - credit);
  };

  const handleSelectPlan = (plan: Plan) => {
    const proratedPrice = calculateProrata(plan.price);
    contactAdmin(plan, proratedPrice);
  };

  const contactAdmin = (plan: Plan, price: number) => {
    const adminPhoneNumber = adminConfig.whatsappNumber;
    const message = `Bonjour Admin LibreShop 👋\n\nJe souhaite passer au plan *${plan.name}* pour ma boutique.\n\n📦 *Infos Boutique:*\n• Nom: ${store?.name || 'N/A'}\n• ID: ${store?.id || 'N/A'}\n\n💳 *Détails Offre:*\n• Nouvelle offre: ${plan.name}\n• Montant à régler: *${price.toLocaleString()} FCFA*\n\n📧 *Contact:*\n• Email: ${user?.email || 'N/A'}\n\nMerci!`;
    
    const encodedMessage = encodeURIComponent(message);
    const url = Platform.select({
      ios: `whatsapp://send?phone=${adminPhoneNumber}&text=${encodedMessage}`,
      android: `https://wa.me/${adminPhoneNumber}?text=${encodedMessage}`,
      default: `https://wa.me/${adminPhoneNumber}?text=${encodedMessage}`,
    });

    if (adminPhoneNumber) {
      contactStore({ rawPhone: adminPhoneNumber, message });
    } else if (url) {
      // fallback: try to open the url directly
      try { openURL(String(url)); } catch { /* ignore */ }
    }
  };

  const handlePayWithPoints = async (plan: Plan) => {
    // 1 XP = 1 FCFA — cost in points equals the prorated price
    const proratedPrice = calculateProrata(plan.price);
    const requiredPoints = proratedPrice;

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
        
        // Déduire les points (1 XP = 1 FCFA)
        await client.rpc('add_points_to_user', {
          p_user_id: user!.id,
          p_amount: -requiredPoints,
          p_action_type: 'SUBSCRIPTION_PAYMENT',
          p_reference_id: plan.id
        });

        // Activer l'abonnement
        const newEnd = new Date();
        newEnd.setDate(newEnd.getDate() + 30);
        
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
          `Votre plan ${plan.name} est actif pour 30 jours !\n${requiredPoints.toLocaleString()} XP débités.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.accent + '20', COLORS.bg]}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Changer d'offre</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.currentPlanCard}>
          <Text style={styles.currentPlanLabel}>Offre actuelle</Text>
          <Text style={styles.currentPlanName}>{store?.subscription_plan || 'Libre Trial'}</Text>
          <View style={styles.expiryRow}>
            <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.expiryText}>
              Expire le : {store?.subscription_end ? new Date(store.subscription_end).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Choisissez votre nouvelle offre</Text>
        <Text style={styles.sectionSubtitle}>Le montant sera automatiquement ajusté en fonction de vos jours restants.</Text>

        {plans.map((plan) => {
          const proratedPrice = calculateProrata(plan.price);
          const hasDiscount = proratedPrice < plan.price;
          const discountAmount = plan.price - proratedPrice;

          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, hasDiscount && styles.planCardDiscount]}
              onPress={() => handleSelectPlan(plan)}
            >
              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-{discountAmount.toLocaleString()} FCFA de réduction</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planLimit}>{plan.product_limit} produits max</Text>
                </View>
                <View style={styles.priceContainer}>
                  {hasDiscount && (
                    <Text style={styles.oldPrice}>{plan.price.toLocaleString()} FCFA</Text>
                  )}
                  <Text style={styles.newPrice}>{proratedPrice.toLocaleString()} FCFA</Text>
                </View>
              </View>
              
              <View style={styles.features}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  <Text style={styles.featureText}>Support prioritaire</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  <Text style={styles.featureText}>Boutique en ligne active</Text>
                </View>
              </View>

              <View style={styles.selectButton}>
                <Text style={styles.selectButtonText}>Sélectionner</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.accent} />
              </View>

              {/* Pay with Points button — 1 XP = 1 FCFA */}
              <TouchableOpacity
                style={[styles.pointsPayButton, userPoints < proratedPrice && { opacity: 0.4 }]}
                onPress={() => handlePayWithPoints(plan)}
                disabled={payingWithPoints || userPoints < proratedPrice}
              >
                {payingWithPoints ? (
                  <ActivityIndicator size="small" color={COLORS.warning} />
                ) : (
                  <>
                    <Ionicons name="star" size={16} color={COLORS.warning} />
                    <Text style={styles.pointsPayText}>
                      ⭐ Payer {proratedPrice.toLocaleString()} XP  •  Solde: {userPoints.toLocaleString()} XP
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  currentPlanCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currentPlanLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  currentPlanName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.accent,
    marginVertical: SPACING.xs,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  expiryText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planCardDiscount: {
    borderColor: COLORS.accent + '40',
    borderWidth: 2,
  },
  discountBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  planName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  planLimit: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  oldPrice: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  newPrice: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.accent,
  },
  features: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginLeft: 8,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent + '10',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  selectButtonText: {
    color: COLORS.accent,
    fontWeight: '600',
    marginRight: 4,
  },
  pointsPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning + '10',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
  },
  pointsPayText: {
    color: COLORS.warning,
    fontWeight: '600',
    marginLeft: 6,
    fontSize: FONT_SIZE.sm,
  },
});

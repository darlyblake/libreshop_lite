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
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { ADMIN_CONFIG } from '../config/admin';
import { planService, storeService, type Plan } from '../lib/supabase';
import { useAuthStore } from '../store';
import { errorHandler } from '../utils/errorHandler';

export const SellerChangePlanScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [fullPlans, setFullPlans] = useState<Plan[]>([]);
  const [store, setStore] = useState<any>(null);

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

    if (__DEV__) {
      console.log(`[SellerProrata] Status: ${currentStatus}, Plan: ${planName}, End: ${endValue}, Price: ${currentPrice}`);
    }

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

    Alert.alert(
      'Confirmer le choix',
      `Vous avez choisi le plan ${plan.name}.\n\nMontant à régler (avec prorata) : ${proratedPrice.toLocaleString()} FCFA\n\nVoulez-vous contacter l'administrateur pour l'activation ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Contacter Admin', 
          onPress: () => contactAdmin(plan, proratedPrice) 
        }
      ]
    );
  };

  const contactAdmin = (plan: Plan, price: number) => {
    const adminPhoneNumber = ADMIN_CONFIG.WHATSAPP_NUMBER;
    const message = `Bonjour Admin LibreShop, je souhaite passer au plan ${plan.name} pour ma boutique ${store?.name || ''}.\n\nMontant calculé : ${price.toLocaleString()} FCFA.\nMon email : ${user?.email}`;
    
    const encodedMessage = encodeURIComponent(message);
    const url = Platform.select({
      ios: `whatsapp://send?phone=${adminPhoneNumber}&text=${encodedMessage}`,
      android: `https://wa.me/${adminPhoneNumber}?text=${encodedMessage}`,
      default: `https://wa.me/${adminPhoneNumber}?text=${encodedMessage}`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp');
      });
    }
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
});

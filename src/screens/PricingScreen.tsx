import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { Button } from '../components';
import { planService, storeService } from '../lib/supabase';
import { useAuthStore } from '../store';

const { width } = Dimensions.get('window');

// pricing plans are fetched at runtime so that any plan the admin creates
// in the backend is displayed here. the UI layer still shapes the data for
// rendering, but the source of truth becomes the "plans" table.

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  icon: string;
  features: string[];
  highlighted?: boolean;
  cta?: string;
  disabled?: boolean;
  disabledReason?: string;
}

const FAQ = [
  {
    question: 'Comment puis-je passer du plan Gratuit au Professionnel ?',
    answer: 'Vous pouvez upgrader votre compte à tout moment depuis votre tableau de bord. L\'upgrade est immédiat et vous ne payerez que pour le prorata du mois.',
  },
  {
    question: 'Puis-je annuler mon abonnement à tout moment ?',
    answer: 'Oui, vous pouvez annuler votre abonnement à tout moment sans pénalité. Votre accès se termine à la fin du mois en cours.',
  },
  {
    question: 'Quels sont les frais de transaction ?',
    answer: 'Le plan Gratuit n\'a pas de frais. Le plan Professionnel prend 1% par transaction. Nous ne prenons jamais de frais sur les paiements mobile money.',
  },
  {
    question: 'Avez-vous des réductions pour les volumes importants ?',
    answer: 'Oui ! Contactez notre équipe pour negocier des tarifs spéciaux en fonction de votre volume de ventes.',
  },
  {
    question: 'Quel est le délai de paiement des revenus ?',
    answer: 'Les revenus sont versés chaque semaine sur votre compte bancaire ou portefeuille mobile money.',
  },
];

export const PricingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const [expiredMessage, setExpiredMessage] = useState<string>('');

  const loadPlans = async () => {
    try {
      const raw = await planService.getAll();
      
      // Charger les boutiques de l'utilisateur pour vérifier s'il a déjà utilisé un plan d'essai
      let hasTrialStore = false;
      if (user?.id) {
        try {
          const stores = await storeService.getByUser(user.id);
          if (stores) {
            // Vérifier si l'utilisateur a déjà une boutique avec un plan d'essai OU expirée
            hasTrialStore = stores.subscription_status === 'trial' || stores.subscription_status === 'expired';
          }
        } catch (e) {
          console.warn('could not load user stores', e);
        }
      }
      
      setHasUsedTrial(hasTrialStore);
      
      setPlans(raw.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price === 0 ? '0 FCFA' : `${(p.price / 100).toLocaleString()} FCFA`,
        period: p.months ? `${p.months} mois` : (p.duration || ''),
        description: '',
        icon: 'checkmark-circle-outline',
        features: p.features || [],
        highlighted: false,
        cta: p.price === 0 ? 'Commencer' : 'Souscrire',
        disabled: p.price === 0 && hasTrialStore,
        disabledReason: p.price === 0 && hasTrialStore ? 'Vous avez déjà utilisé le plan gratuit' : undefined,
      })));
    } catch (e) {
      console.error('load pricing plans', e);
      if (
        typeof e === 'object' &&
        (String(e).includes('Failed to fetch') || (e as any).message?.includes('Failed to fetch'))
      ) {
        Alert.alert(
          'Erreur réseau',
          'Impossible de charger les plans. Vérifiez la configuration Supabase et la connexion Internet.'
        );
      }
    }
  };

  React.useEffect(() => {
    loadPlans();
  }, [user?.id]);

  // refresh when screen is focused (e.g. admin may have modified plans)
  const { addListener } = useNavigation<any>();
  React.useEffect(() => {
    const unsubscribe = addListener('focus', () => {
      loadPlans();
    });
    return unsubscribe;
  }, [addListener]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadPlans().finally(() => setRefreshing(false));
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tarifs</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          {hasUsedTrial && (
            <View style={[styles.expiredBanner, { 
              backgroundColor: COLORS.info + '20',
              borderLeftColor: COLORS.info,
              borderLeftWidth: 4,
              padding: SPACING.lg,
              marginBottom: SPACING.lg,
              borderRadius: RADIUS.lg,
              marginHorizontal: SPACING.lg,
            }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
                <Ionicons name="alert-circle" size={24} color={COLORS.info} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.info, fontWeight: '600', marginBottom: SPACING.xs }}>
                    Votre abonnement a expiré
                  </Text>
                  <Text style={{ color: COLORS.textSoft, fontSize: FONT_SIZE.sm }}>
                    Le plan gratuit a déjà été utilisé. Choisissez un autre plan pour continuer.
                  </Text>
                </View>
              </View>
            </View>
          )}
          <Text style={styles.heroTitle}>Tarifs simples et transparents</Text>
          <Text style={styles.heroDescription}>
            Choisissez le plan qui correspond à vos besoins et commencez à vendre dès aujourd'hui.
          </Text>
        </View>

        {/* Pricing Cards */}
        <View style={styles.pricingContainer}>
          {plans.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Aucun plan disponible pour le moment.</Text>
            </View>
          ) : (
            plans.map((plan, index) => (
              <View
                key={plan.id}
                style={[styles.pricingCard, plan.highlighted && styles.pricingCardHighlighted]}
              >
              {plan.highlighted && (
                <View style={styles.badge}>
                  <Ionicons name={plan.icon as any} size={16} color={COLORS.accent} />
                  <Text style={styles.badgeText}>Populaire</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>

              <View style={styles.priceSection}>
                <Text style={styles.price}>{plan.price}</Text>
                <Text style={styles.period}>{plan.period}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.featuresList}>
                {plan.features.map((feature, featureIndex) => (
                  <View key={featureIndex} style={styles.featureItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={plan.highlighted ? COLORS.accent : COLORS.accent2}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {plan.disabled && (
                <View style={[styles.disabledBanner, {
                  backgroundColor: COLORS.textMuted + '20',
                  padding: SPACING.md,
                  borderRadius: RADIUS.md,
                  marginBottom: SPACING.md,
                  alignItems: 'center',
                }]}>
                  <Ionicons name="checkmark-done" size={20} color={COLORS.textMuted} />
                  <Text style={{
                    color: COLORS.textMuted,
                    fontWeight: '600',
                    fontSize: FONT_SIZE.sm,
                    marginTop: SPACING.xs,
                  }}>
                    {plan.disabledReason || 'Non disponible'}
                  </Text>
                </View>
              )}

              <Button
                title={plan.disabled ? '✓ Déjà utilisé' : (plan.cta || 'Choisir')}
                onPress={() => {
                  if (plan.disabled) {
                    Alert.alert(
                      'Plan gratuit utilisé',
                      'Vous avez déjà utilisé le plan gratuit. Veuillez choisir un plan payant pour continuer.'
                    );
                    return;
                  }
                  // navigation could pass the plan id to the auth/signup screen
                  navigation.navigate('SellerAuth', { planId: plan.id });
                }}
                variant={plan.highlighted ? 'primary' : 'outline'}
                size="large"
                disabled={plan.disabled}
              />
            </View>
          ))) }
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Tous les plans incluent</Text>
          <View style={styles.benefitsGrid}>
            {[
              { icon: 'lock-closed-outline', label: 'Sécurité garantie' },
              { icon: 'flash-outline', label: 'Performance optimale' },
              { icon: 'globe-outline', label: 'Disponible partout' },
              { icon: 'people-outline', label: 'Support communautaire' },
            ].map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <View style={styles.benefitIconContainer}>
                  <Ionicons name={benefit.icon as any} size={24} color={COLORS.accent} />
                </View>
                <Text style={styles.benefitLabel}>{benefit.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Questions fréquemment posées</Text>
          <View style={styles.faqContainer}>
            {FAQ.map((item, index) => (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity
                  onPress={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                  style={styles.faqQuestion}
                >
                  <Text style={styles.faqQuestionText}>{item.question}</Text>
                  <Ionicons
                    name={expandedFAQ === index ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={COLORS.accent}
                  />
                </TouchableOpacity>
                {expandedFAQ === index && (
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Des questions sur les tarifs ?</Text>
          <Text style={styles.ctaDescription}>
            Notre équipe est prête à vous aider et à trouver le meilleur plan pour votre activité.
          </Text>
          <Button
            title="Nous contacter"
            onPress={() => {
              // Action to contact support
            }}
            variant="primary"
            size="large"
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  heroSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxxl,
  },
  heroTitle: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md,
    lineHeight: 40,
  },
  heroDescription: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    lineHeight: 24,
  },
  pricingContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxxl,
    gap: SPACING.xl,
  },
  pricingCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pricingCardHighlighted: {
    borderColor: COLORS.accent,
    borderWidth: 2,
    backgroundColor: COLORS.accent + '08',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginBottom: SPACING.lg,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.accent,
  },
  planHeader: {
    marginBottom: SPACING.lg,
  },
  planName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  planDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
  },
  priceSection: {
    marginBottom: SPACING.lg,
  },
  price: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    color: COLORS.accent,
    marginBottom: SPACING.xs,
  },
  period: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  featuresList: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  featureText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    flex: 1,
  },
  benefitsSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxxl,
  },
  benefitsTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.lg,
  },
  benefitItem: {
    width: (width - SPACING.xl * 2 - SPACING.lg) / 2,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  benefitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  benefitLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
  },
  faqSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxxl,
  },
  faqTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  faqContainer: {
    gap: SPACING.md,
  },
  faqItem: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  faqQuestionText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.md,
  },
  faqAnswer: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    lineHeight: 20,
  },
  ctaSection: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
    backgroundColor: COLORS.accent + '10',
    marginHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xxxl,
    borderWidth: 1,
    borderColor: COLORS.accent + '20',
  },
  ctaTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  ctaDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginBottom: SPACING.xl,
    textAlign: 'center',
    lineHeight: 20,
  },
});

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { Button } from '../components';

const { width, height } = Dimensions.get('window');

const FEATURES = [
  {
    icon: 'phone-portrait' as any,
    title: 'Progressive Web App',
    description: 'Installable sur mobile comme une application native',
  },
  {
    icon: 'cloud' as any,
    title: 'Stockage cloud',
    description: 'Images et données hébergées en toute sécurité',
  },
  {
    icon: 'stats-chart' as any,
    title: 'Dashboard avancé',
    description: 'Statistiques et analyses en temps réel',
  },
  {
    icon: 'cart' as any,
    title: 'Vente physique',
    description: 'Interface caisse pour votre magasin',
  },
];

const PRICING = [
  {
    title: 'Essai',
    price: '7 jours',
    description: 'Accès complet pour tester LibreShop sans engagement',
  },
  {
    title: 'Basic',
    price: '3 000',
    description: '50 produits • QR code • support prioritaire',
    highlighted: false,
  },
  {
    title: 'Pro',
    price: '5 000',
    description: '300 produits • vente physique • stats avancées',
    highlighted: true,
  },
];

export const LandingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logoText}>libreshop</Text>
          <View style={styles.headerNav}>
            <TouchableOpacity onPress={() => navigation.navigate('Features')}>
              <Text style={styles.navText}>Fonctionnement</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Pricing')}>
              <Text style={styles.navText}>Tarifs</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('ClientTabs')}>
              <Text style={styles.navText}>Explorer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.tagContainer}>
            <Text style={styles.tag}>✨ Marketplace nouvelle génération</Text>
          </View>
          <Text style={styles.heroTitle}>
            Créez votre boutique en ligne.{'\n'}
            <Text style={styles.heroTitleAccent}>Vendez partout.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            La solution tout-en-un pour les commerciaux modernes. Vente en ligne
            et en physique, sans complication.
          </Text>
          <View style={styles.heroButtons}>
            <Button
              title="Explorer les boutiques"
              onPress={() => navigation.navigate('ClientTabs')}
              variant="primary"
              size="large"
            />
            <Button
              title="Créer ma boutique →"
              onPress={() => navigation.navigate('SellerAuth')}
              variant="outline"
              size="large"
            />
          </View>
        </View>

        {/* How it works Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comment ça marche</Text>
          <View style={styles.featuresGrid}>
            <View style={styles.featureCard}>
              <Ionicons name="bag-handle-outline" size={32} color={COLORS.accent} />
              <Text style={styles.featureTitle}>Pour les acheteurs</Text>
              <Text style={styles.featureDescription}>
                Parcourez les boutiques, ajoutez au panier et échangez directement
                via WhatsApp.
              </Text>
            </View>
            <View style={styles.featureCard}>
              <Ionicons name="storefront-outline" size={32} color={COLORS.accent} />
              <Text style={styles.featureTitle}>Pour les vendeurs</Text>
              <Text style={styles.featureDescription}>
                Créez votre boutique, gérez vos produits et vos commandes en ligne
                ou en magasin.
              </Text>
            </View>
            <View style={styles.featureCard}>
              <Ionicons name="people-outline" size={32} color={COLORS.accent} />
              <Text style={styles.featureTitle}>Une communauté</Text>
              <Text style={styles.featureDescription}>
                Rejoignez un écosystème de commerçants et développez votre activité.
              </Text>
            </View>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fonctionnalités clés</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <Ionicons name={feature.icon} size={32} color={COLORS.accent} />
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tarifs simples</Text>
          <View style={styles.pricingGrid}>
            {PRICING.map((plan, index) => (
              <View
                key={index}
                style={[
                  styles.pricingCard,
                  plan.highlighted && styles.pricingCardHighlighted,
                ]}
              >
                <Text style={styles.pricingTitle}>{plan.title}</Text>
                <Text style={styles.pricingPrice}>{plan.price} {'\n'}FCFA</Text>
                <Text style={styles.pricingDescription}>{plan.description}</Text>
                {plan.highlighted && (
                  <View style={styles.pricingBadge}>
                    <Text style={styles.pricingBadgeText}>Populaire</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>
            Prêt à développer votre commerce ?
          </Text>
          <Button
            title="Créer ma boutique maintenant"
            onPress={() => navigation.navigate('SellerAuth')}
            variant="primary"
            size="large"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 LibreShop — Marketplace nouvelle génération
          </Text>
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
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  logo: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  logoText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  headerNav: {
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  navText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.textSoft,
  },
  hero: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  tagContainer: {
    marginBottom: SPACING.lg,
  },
  tag: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.accent,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  heroTitle: {
    fontSize: width < 500 ? FONT_SIZE.xl : FONT_SIZE.title,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: width < 500 ? 32 : 48,
    marginBottom: SPACING.lg,
  },
  heroTitleAccent: {
    color: '#a5b4fc',
  },
  heroSubtitle: {
    fontSize: width < 500 ? FONT_SIZE.sm : FONT_SIZE.md,
    color: COLORS.textSoft,
    textAlign: 'center',
    maxWidth: 500,
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  sectionTitle: {
    fontSize: width < 500 ? FONT_SIZE.lg : FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  featureCard: {
    width: width < 500 ? '100%' : (width - SPACING.lg * 2 - SPACING.lg) / 2 - SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  featureTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  pricingGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    flexWrap: 'wrap',
  },
  pricingCard: {
    width: width < 500 ? '100%' : width < 900 ? (width - SPACING.lg * 2 - SPACING.lg) / 2 : (width - SPACING.lg * 2 - SPACING.lg * 2) / 3,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  pricingCardHighlighted: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  pricingTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  pricingPrice: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  pricingDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  pricingBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  pricingBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.white,
  },
  ctaSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
  },
  ctaTitle: {
    fontSize: width < 500 ? FONT_SIZE.lg : FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  footer: {
    padding: SPACING.xxxl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
});


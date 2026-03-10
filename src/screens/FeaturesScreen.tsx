import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { Button } from '../components';

const { width } = Dimensions.get('window');

const FEATURES_CLIENT = [
  {
    icon: 'search-outline',
    title: 'Découvrez les boutiques',
    description: 'Explorez un large choix de boutiques locales et trouvez ce que vous cherchez.',
  },
  {
    icon: 'bag-add-outline',
    title: 'Ajoutez au panier',
    description: 'Ajoutez vos articles préférés et consultez votre panier à tout moment.',
  },
  {
    icon: 'chatbubble-outline',
    title: 'Contactez le vendeur',
    description: 'Discutez directement via WhatsApp pour négocier ou poser vos questions.',
  },
  {
    icon: 'checkmark-done-outline',
    title: 'Commandez en ligne',
    description: 'Payez en ligne ou en personne pour plus de flexibilité.',
  },
  {
    icon: 'location-outline',
    title: 'Livraison rapide',
    description: 'Recevez vos commandes directement à votre adresse.',
  },
  {
    icon: 'heart-outline',
    title: 'Ma liste de souhaits',
    description: 'Sauvegardez vos articles favoris pour plus tard.',
  },
];

const FEATURES_VENDOR = [
  {
    icon: 'storefront-outline',
    title: 'Créez votre boutique',
    description: 'Mettez en place votre boutique en ligne en quelques minutes.',
  },
  {
    icon: 'images-outline',
    title: 'Ajoutez vos produits',
    description: 'Téléchargez des photos de qualité avec descriptions détaillées.',
  },
  {
    icon: 'list-outline',
    title: 'Gérez votre inventaire',
    description: 'Suivez vos stocks et mettez à jour vos prix facilement.',
  },
  {
    icon: 'notifications-outline',
    title: 'Recevez les commandes',
    description: 'Soyez notifié de chaque nouvelle commande instantanément.',
  },
  {
    icon: 'cash-outline',
    title: 'Module caisse',
    description: 'Gérez les ventes physiques et en ligne au même endroit.',
  },
  {
    icon: 'bar-chart-outline',
    title: 'Tableau de bord',
    description: 'Analysez vos ventes et suivez votre performance.',
  },
];

export const FeaturesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fonctionnement</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Comment ça marche ?</Text>
          <Text style={styles.heroDescription}>
            LibreShop est conçu pour connecter les vendeurs et les clients de manière simple et efficace.
          </Text>
        </View>

        {/* Client Features */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bag-handle-outline" size={24} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Pour les acheteurs</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Découvrez une expérience d'achat simple et sécurisée
          </Text>
          <View style={styles.featuresGrid}>
            {FEATURES_CLIENT.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name={feature.icon as any} size={28} color={COLORS.accent} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Vendor Features */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="storefront-outline" size={24} color={COLORS.accent2} />
            <Text style={styles.sectionTitle}>Pour les vendeurs</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Développez votre activité avec nos outils puissants
          </Text>
          <View style={styles.featuresGrid}>
            {FEATURES_VENDOR.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name={feature.icon as any} size={28} color={COLORS.accent2} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Prêt à commencer ?</Text>
          <Text style={styles.ctaDescription}>
            Rejoignez LibreShop et transformez votre expérience d'achat ou de vente.
          </Text>
          <View style={styles.ctaButtons}>
            <Button
              title="Explorer les boutiques"
              onPress={() => navigation.navigate('ClientTabs')}
              variant="primary"
              size="large"
            />
            <Button
              title="Créer ma boutique"
              onPress={() => navigation.navigate('SellerAuth')}
              variant="outline"
              size="large"
            />
          </View>
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
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginBottom: SPACING.xl,
  },
  featuresGrid: {
    gap: SPACING.lg,
  },
  featureCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  featureTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  featureDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
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
  ctaButtons: {
    width: '100%',
    gap: SPACING.md,
  },
});

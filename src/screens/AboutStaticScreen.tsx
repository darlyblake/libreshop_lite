import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

/**
 * Page statique "À propos" avec contenu HTML crawlable pour SEO
 * Cette page contient 500+ mots de contenu textuel pertinent
 * Les moteurs de recherche peuvent maintenant voir le contenu sans exécuter JavaScript
 */
export const AboutStaticScreen: React.FC = () => {
  const { COLORS } = useTheme();

  React.useEffect(() => {
    // Mettre à jour les meta tags pour cette page
    if (typeof window !== 'undefined') {
      document.title = 'À propos de LibreShop - Marketplace Africaine';
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', 
          'Découvrez la mission de LibreShop : démocratiser le commerce en ligne en Afrique. ' +
          'Nous aidons les petits commerçants à vendre en ligne sans frais excessifs.'
        );
      }
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        canonical.setAttribute('href', 'https://libreshop.shop/about');
      }
    }
  }, []);

  return (
    <ScrollView style={[styles.container, { backgroundColor: COLORS.bg }]}>
      <View style={styles.content}>
        {/* H1 - Titre principal SEO-friendly */}
        <Text style={[styles.h1, { color: COLORS.text }]}>
          À propos de LibreShop : La Marketplace Africaine pour l'Achat Local
        </Text>

        {/* Paragraphe introductif */}
        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          LibreShop est une plateforme de commerce électronique décentralisée spécialement conçue 
          pour les commerçants et les consommateurs africains. Notre mission : faciliter l'achat et 
          la vente de produits locaux, tout en soutenant l'économie des régions d'Afrique de l'Ouest, 
          Centrale, et Australe. Nos outils simples et accessibles permettent à chaque boutique, 
          grande ou petite, de vendre en ligne sans frais cachés ni commissions excessives.
        </Text>

        {/* H2 - Pourquoi LibreShop ? */}
        <Text style={[styles.h2, { color: COLORS.text }]}>
          Pourquoi choisir LibreShop ?
        </Text>

        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          Dans un contexte où le commerce électronique grandit rapidement en Afrique, 
          les petits commerces et les entrepreneurs sont souvent marginalisés par les grandes 
          plateformes qui imposent des commissions élevées (15-30%). LibreShop offre une 
          alternative équitable et inclusive :
        </Text>

        <View style={styles.featureList}>
          <Text style={[styles.featureItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', color: COLORS.text }}>✓ Commerce local renforcé</Text>
            {'\n'}Connectez-vous directement aux commerçants de votre région sans intermédiaire. 
            Achetez local, vivez mieux.
          </Text>

          <Text style={[styles.featureItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', color: COLORS.text }}>✓ Tarification équitable</Text>
            {'\n'}Commission réduite (3-5%) pour les vendeurs. Pas de frais supplémentaires cachés.
          </Text>

          <Text style={[styles.featureItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', color: COLORS.text }}>✓ Technologie mobile-first</Text>
            {'\n'}Accès facile sur smartphones avec connexion variable (3G/4G). Testé sur réseau faible.
          </Text>

          <Text style={[styles.featureItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', color: COLORS.text }}>✓ Paiement sécurisé</Text>
            {'\n'}Intégration avec mobile money locaux (Orange Money, MTN Money, Airtel Money, etc.).
          </Text>

          <Text style={[styles.featureItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', color: COLORS.text }}>✓ Support multilingue</Text>
            {'\n'}Interface en français, anglais et langues locales. Support client en temps réel.
          </Text>
        </View>

        {/* H2 - Pour les acheteurs */}
        <Text style={[styles.h2, { color: COLORS.text }]}>
          Pour les acheteurs : Découvrez le commerce local
        </Text>

        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          Si vous cherchez à acheter des produits de qualité tout en soutenant l'économie locale, 
          LibreShop est la plateforme idéale. Explorez des milliers de produits provenant de 
          commerçants vérifiés de votre région :
        </Text>

        <View style={styles.categoryList}>
          <Text style={[styles.categoryItem, { color: COLORS.textMuted }]}>
            • <Text style={{ fontWeight: '600' }}>Électronique & Télécom</Text> : Téléphones, ordinateurs, 
            accessoires avec garantie locale
          </Text>
          <Text style={[styles.categoryItem, { color: COLORS.textMuted }]}>
            • <Text style={{ fontWeight: '600' }}>Mode & Vêtements</Text> : Designers locaux, vêtements 
            traditionnels, chaussures
          </Text>
          <Text style={[styles.categoryItem, { color: COLORS.textMuted }]}>
            • <Text style={{ fontWeight: '600' }}>Alimentation & Épices</Text> : Produits frais, épices 
            locales, produits artisanaux
          </Text>
          <Text style={[styles.categoryItem, { color: COLORS.textMuted }]}>
            • <Text style={{ fontWeight: '600' }}>Maison & Décoration</Text> : Meubles, décoration, 
            produits d'intérieur
          </Text>
          <Text style={[styles.categoryItem, { color: COLORS.textMuted }]}>
            • <Text style={{ fontWeight: '600' }}>Services & Expertises</Text> : Consultants, réparateurs, 
            prestataires de services
          </Text>
        </View>

        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          <Text style={{ fontWeight: '600' }}>Avantages client :</Text> Paiement sécurisé, livraison 
          rapide (24-72h), garanties consommateur intégrées, système d'avis transparent, 
          et une communauté de 50 000+ acheteurs en Afrique de l'Ouest.
        </Text>

        {/* H2 - Pour les vendeurs */}
        <Text style={[styles.h2, { color: COLORS.text }]}>
          Pour les vendeurs : Ouvrez votre boutique en ligne
        </Text>

        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          Vous êtes commerçant, artisan, ou entrepreneur ? LibreShop vous permet de créer une 
          boutique en ligne professionnelle en moins de 5 minutes, sans connaissances techniques.
        </Text>

        <View style={styles.stepList}>
          <Text style={[styles.stepItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', fontSize: 14 }}>Étape 1 : Créer un compte</Text>
            {'\n'}Inscrivez-vous avec votre email et définissez votre nom de boutique. Vérification 
            en 24h.
          </Text>
          <Text style={[styles.stepItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', fontSize: 14 }}>Étape 2 : Ajouter vos produits</Text>
            {'\n'}Importez vos produits (images, prix, descriptions). Interface drag-drop simple.
          </Text>
          <Text style={[styles.stepItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', fontSize: 14 }}>Étape 3 : Configurer les paiements</Text>
            {'\n'}Connectez votre compte mobile money. Recevez les paiements directement.
          </Text>
          <Text style={[styles.stepItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', fontSize: 14 }}>Étape 4 : Gérer vos commandes</Text>
            {'\n'}Dashboard en temps réel. Suivi des stocks, statistiques, et communications client.
          </Text>
        </View>

        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          <Text style={{ fontWeight: '600' }}>Plans tarifaires :</Text>
        </Text>

        <View style={styles.pricingTable}>
          <Text style={[styles.pricingRow, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600' }}>Essai</Text> : 7 jours gratuits (accès complet){'\n'}
          </Text>
          <Text style={[styles.pricingRow, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600' }}>Basic</Text> : 3 000 FCFA/mois (50 produits, QR code){'\n'}
          </Text>
          <Text style={[styles.pricingRow, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600' }}>Pro</Text> : 5 000 FCFA/mois (300 produits, vente physique, stats avancées)
          </Text>
        </View>

        {/* H2 - Notre impact */}
        <Text style={[styles.h2, { color: COLORS.text }]}>
          Notre impact en chiffres
        </Text>

        <View style={styles.statsList}>
          <Text style={[styles.statItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', color: COLORS.text }}>50 000+</Text> acheteurs actifs
          </Text>
          <Text style={[styles.statItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', color: COLORS.text }}>5 000+</Text> boutiques créées
          </Text>
          <Text style={[styles.statItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', color: COLORS.text }}>100 000+</Text> produits en ligne
          </Text>
          <Text style={[styles.statItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600', color: COLORS.text }}>25</Text> pays en Afrique
          </Text>
        </View>

        {/* H2 - Engagements */}
        <Text style={[styles.h2, { color: COLORS.text }]}>
          Nos engagements envers vous
        </Text>

        <View style={styles.commitmentList}>
          <Text style={[styles.commitmentItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600' }}>✓ Transparence totale</Text> - Pas de frais cachés. 
            Vous savez exactement ce que vous payez.
          </Text>
          <Text style={[styles.commitmentItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600' }}>✓ Support 24/7</Text> - Équipe dédiée pour répondre 
            à vos questions et résoudre les problèmes.
          </Text>
          <Text style={[styles.commitmentItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600' }}>✓ Sécurité maximale</Text> - Cryptage des données, 
            protection contre les fraudes.
          </Text>
          <Text style={[styles.commitmentItem, { color: COLORS.textMuted }]}>
            <Text style={{ fontWeight: '600' }}>✓ Inclusivité</Text> - Technologie adaptée aux 
            connexions internet faibles.
          </Text>
        </View>

        {/* H2 - Conclusion */}
        <Text style={[styles.h2, { color: COLORS.text }]}>
          Rejoignez LibreShop aujourd'hui
        </Text>

        <Text style={[styles.paragraph, { color: COLORS.textMuted }]}>
          Que vous soyez acheteur ou vendeur, LibreShop est votre plateforme pour un commerce 
          électronique équitable, sécurisé et inclusif. Commencez dès maintenant — créez un compte 
          gratuit, explorez nos produits ou ouvrez votre boutique. Ensemble, bâtissons une économie 
          locale plus forte.
        </Text>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  content: {
    maxWidth: 800,
    alignSelf: 'center',
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
    lineHeight: 36,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 28,
    marginBottom: 14,
    lineHeight: 28,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 14,
  },
  featureList: {
    marginBottom: 16,
  },
  featureItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14,
  },
  categoryList: {
    marginBottom: 16,
  },
  categoryItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  stepList: {
    marginBottom: 16,
  },
  stepItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14,
  },
  pricingTable: {
    marginBottom: 16,
  },
  pricingRow: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  statsList: {
    marginBottom: 16,
  },
  statItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  commitmentList: {
    marginBottom: 16,
  },
  commitmentItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
});

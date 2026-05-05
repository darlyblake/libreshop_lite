import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store';
import { useTheme } from '../hooks/useTheme';
import { errorHandler } from '../utils/errorHandler';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    question: 'Comment passer une commande ?',
    answer: 'Pour passer une commande, naviguez vers les produits, ajoutez les articles souhaités au panier, puis procédez au paiement. Vous pourrez choisir votre mode de livraison et confirmer votre commande.',
    category: 'Commandes'
  },
  {
    question: 'Quels sont les modes de paiement disponibles ?',
    answer: 'Nous acceptons les paiements par carte bancaire, mobile money et espèces à la livraison. Les options peuvent varier selon votre localisation.',
    category: 'Paiement'
  },
  {
    question: 'Comment suivre ma commande ?',
    answer: 'Vous pouvez suivre l\'état de votre commande depuis la section "Mes commandes" dans votre profil. Vous recevrez également des notifications par email et SMS.',
    category: 'Commandes'
  },
  {
    question: 'Puis-je annuler ma commande ?',
    answer: 'Oui, vous pouvez annuler votre commande tant qu\'elle n\'a pas été expédiée. Allez dans "Mes commandes" et sélectionnez "Annuler" sur la commande concernée.',
    category: 'Commandes'
  },
  {
    question: 'Comment retourner un article ?',
    answer: 'Pour retourner un article, contactez notre support client dans les 7 jours suivant la réception. L\'article doit être en bon état et dans son emballage d\'origine.',
    category: 'Retours'
  },
  {
    question: 'Quels sont les délais de livraison ?',
    answer: 'Les délais de livraison varient selon votre localisation : 24-48h pour les grandes villes, 2-5 jours pour les autres zones.',
    category: 'Livraison'
  },
  {
    question: 'Comment devenir vendeur sur LibreShop ?',
    answer: 'Cliquez sur "Ouvrir ma boutique" dans votre profil et suivez les étapes de création. Vous devrez fournir vos informations professionnelles et les documents nécessaires.',
    category: 'Vendeur'
  },
];

const HELP_CATEGORIES = [
  { icon: 'shopping-cart-outline', title: 'Commandes', color: '#3B82F6' },
  { icon: 'card-outline', title: 'Paiement', color: '#10B981' },
  { icon: 'truck-outline', title: 'Livraison', color: '#F59E0B' },
  { icon: 'refresh-outline', title: 'Retours', color: '#EF4444' },
  { icon: 'storefront-outline', title: 'Vendeur', color: '#8B5CF6' },
  { icon: 'person-outline', title: 'Compte', color: '#6B7280' },
];

export const HelpScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { getColor, spacing, radius, fontSize } = useTheme();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: '',
    category: 'general',
  });
  const [sending, setSending] = useState(false);

  const filteredFAQ = selectedCategory
    ? FAQ_DATA.filter(item => item.category === selectedCategory)
    : FAQ_DATA;

  const toggleExpanded = (index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleContactSubmit = async () => {
    if (!contactForm.subject.trim() || !contactForm.message.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setSending(true);
    try {
      // Simuler l'envoi du message
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Message envoyé',
        'Nous avons bien reçu votre message et vous répondrons dans les plus brefs délais.',
        [{ text: 'OK', onPress: () => {
          setShowContactForm(false);
          setContactForm({ subject: '', message: '', category: 'general' });
        }}]
      );
    } catch (error) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Error sending contact form:');
      Alert.alert('Erreur', 'Impossible d\'envoyer votre message. Veuillez réessayer.');
    } finally {
      setSending(false);
    }
  };

  const handleCallSupport = () => {
    Alert.alert(
      'Contacter le support',
      'Choisissez une option pour nous contacter',
      [
        { text: 'Appeler', onPress: () => Linking.openURL('tel:+241XXXXXXXX') },
        { text: 'WhatsApp', onPress: () => Linking.openURL('https://wa.me/241XXXXXXXX') },
        { text: 'Email', onPress: () => Linking.openURL('mailto:support@libreshop.com') },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const renderFAQItem = (item: FAQItem, index: number) => (
    <View key={index} style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={() => toggleExpanded(index)}
      >
        <Text style={styles.faqQuestionText}>{item.question}</Text>
        <Ionicons
          name={expandedItems.has(index) ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={getColor.textMuted}
        />
      </TouchableOpacity>
      {expandedItems.has(index) && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{item.answer}</Text>
        </View>
      )}
    </View>
  );

  const renderCategory = (category: typeof HELP_CATEGORIES[0], index: number) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.categoryCard,
        selectedCategory === category.title && styles.categoryCardSelected
      ]}
      onPress={() => setSelectedCategory(
        selectedCategory === category.title ? null : category.title
      )}
    >
      <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
        <Ionicons name={category.icon as any} size={24} color={category.color} />
      </View>
      <Text style={styles.categoryTitle}>{category.title}</Text>
      <Text style={styles.categoryCount}>
        {FAQ_DATA.filter(item => item.category === category.title).length} articles
      </Text>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: getColor.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.lg,
      backgroundColor: getColor.card,
      borderBottomWidth: 1,
      borderBottomColor: getColor.border,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: getColor.text,
      marginLeft: spacing.md,
    },
    content: {
      flex: 1,
      padding: spacing.xl,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: getColor.text,
      marginBottom: spacing.md,
    },
    categoriesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    categoryCard: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      alignItems: 'center',
      width: '30%',
      borderWidth: 1,
      borderColor: getColor.border,
    },
    categoryCardSelected: {
      borderColor: getColor.accent,
      backgroundColor: getColor.accent + '10',
    },
    categoryIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    categoryTitle: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: getColor.text,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    categoryCount: {
      fontSize: fontSize.xs,
      color: getColor.textMuted,
      textAlign: 'center',
    },
    faqItem: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: getColor.border,
      overflow: 'hidden',
    },
    faqQuestion: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
    },
    faqQuestionText: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: '500',
      color: getColor.text,
      marginRight: spacing.md,
    },
    faqAnswer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: getColor.border,
      backgroundColor: getColor.bg + '50',
    },
    faqAnswerText: {
      fontSize: fontSize.sm,
      color: getColor.textSoft,
      lineHeight: 20,
    },
    contactButton: {
      backgroundColor: getColor.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    contactButtonText: {
      color: getColor.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    callButton: {
      backgroundColor: getColor.success + '15',
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: getColor.success + '30',
    },
    callButtonText: {
      color: getColor.success,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    formCard: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    inputGroup: {
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '500',
      color: getColor.text,
      marginBottom: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: getColor.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: getColor.text,
      backgroundColor: getColor.bg,
    },
    textArea: {
      height: 120,
      textAlignVertical: 'top',
    },
    picker: {
      borderWidth: 1,
      borderColor: getColor.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: getColor.text,
      backgroundColor: getColor.bg,
    },
    formActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: getColor.bg,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: getColor.border,
    },
    cancelButtonText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: getColor.text,
    },
    sendButton: {
      flex: 1,
      backgroundColor: getColor.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
    },
    sendButtonText: {
      color: getColor.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    quickLinks: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    quickLinkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: getColor.border,
    },
    quickLinkItemLast: {
      borderBottomWidth: 0,
    },
    quickLinkIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: getColor.accent + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    quickLinkText: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: '500',
      color: getColor.text,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={getColor.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aide et support</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catégories</Text>
          <View style={styles.categoriesContainer}>
            {HELP_CATEGORIES.map(renderCategory)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Questions fréquentes {selectedCategory && `- ${selectedCategory}`}
          </Text>
          {filteredFAQ.length > 0 ? (
            filteredFAQ.map(renderFAQItem)
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="help-circle-outline" size={64} color={getColor.textMuted} />
              <Text style={{ fontSize: fontSize.md, color: getColor.textMuted, marginTop: spacing.md }}>
                Aucune question dans cette catégorie
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contactez-nous</Text>
          
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => setShowContactForm(!showContactForm)}
          >
            <Ionicons name="mail-outline" size={20} color={getColor.text} />
            <Text style={styles.contactButtonText}>Envoyer un message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.callButton} onPress={handleCallSupport}>
            <Ionicons name="call-outline" size={20} color={getColor.success} />
            <Text style={styles.callButtonText}>Appeler le support</Text>
          </TouchableOpacity>

          {showContactForm && (
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sujet</Text>
                <TextInput
                  style={styles.input}
                  value={contactForm.subject}
                  onChangeText={(text) => setContactForm(prev => ({ ...prev, subject: text }))}
                  placeholder="Décrivez brièvement votre problème"
                  placeholderTextColor={getColor.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={contactForm.message}
                  onChangeText={(text) => setContactForm(prev => ({ ...prev, message: text }))}
                  placeholder="Décrivez votre problème en détail"
                  placeholderTextColor={getColor.textMuted}
                  multiline
                  numberOfLines={5}
                />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowContactForm(false);
                    setContactForm({ subject: '', message: '', category: 'general' });
                  }}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleContactSubmit}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator color={getColor.text} size="small" />
                  ) : (
                    <Text style={styles.sendButtonText}>Envoyer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liens rapides</Text>
          <View style={styles.quickLinks}>
            <TouchableOpacity style={styles.quickLinkItem}>
              <View style={styles.quickLinkIcon}>
                <Ionicons name="document-text-outline" size={20} color={getColor.accent} />
              </View>
              <Text style={styles.quickLinkText}>Conditions générales</Text>
              <Ionicons name="chevron-forward" size={20} color={getColor.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLinkItem}>
              <View style={styles.quickLinkIcon}>
                <Ionicons name="shield-outline" size={20} color={getColor.accent} />
              </View>
              <Text style={styles.quickLinkText}>Politique de confidentialité</Text>
              <Ionicons name="chevron-forward" size={20} color={getColor.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickLinkItem, styles.quickLinkItemLast]}>
              <View style={styles.quickLinkIcon}>
                <Ionicons name="refresh-outline" size={20} color={getColor.accent} />
              </View>
              <Text style={styles.quickLinkText}>Politique de retour</Text>
              <Ionicons name="chevron-forward" size={20} color={getColor.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

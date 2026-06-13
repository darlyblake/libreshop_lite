import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { disputeService } from '../services/disputeService';
import { useAuthStore } from '../store';
import { DisputeType } from '../types/dispute';

export default function DisputeScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId, storeId, storeName } = route.params as {
    orderId?: string;
    storeId: string;
    storeName: string;
  };
  const { user } = useAuthStore();

  const [type, setType] = useState<DisputeType>('order');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const disputeTypes: { value: DisputeType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'order', label: 'Problème de commande', icon: 'cart' },
    { value: 'return', label: 'Retour/Remboursement', icon: 'return-up-back' },
    { value: 'payment', label: 'Problème de paiement', icon: 'card' },
    { value: 'delivery', label: 'Problème de livraison', icon: 'cube' },
    { value: 'product_quality', label: 'Qualité du produit', icon: 'alert-circle' },
    { value: 'other', label: 'Autre', icon: 'help-circle' },
  ];

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour ouvrir un litige');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un titre pour le litige');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Erreur', 'Veuillez décrire le problème');
      return;
    }

    setLoading(true);
    try {
      await disputeService.create({
        order_id: orderId,
        user_id: user.id,
        store_id: storeId,
        type,
        title: title.trim(),
        description: description.trim(),
      });

      Alert.alert(
        'Litige créé',
        'Votre litige a été enregistré avec succès. Un administrateur examinera votre demande.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer le litige');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Ouvrir un litige</Text>
          <Text style={styles.subtitle}>{storeName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type de litige</Text>
          <View style={styles.typeGrid}>
            {disputeTypes.map((disputeType) => (
              <TouchableOpacity
                key={disputeType.value}
                style={[
                  styles.typeCard,
                  type === disputeType.value && styles.typeCardSelected,
                ]}
                onPress={() => setType(disputeType.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={disputeType.icon}
                  size={28}
                  color={type === disputeType.value ? COLORS.primary : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    type === disputeType.value && styles.typeLabelSelected,
                  ]}
                >
                  {disputeType.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Titre du litige</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Résumez le problème en quelques mots..."
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Text style={styles.charCount}>
            {title.length}/100
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description détaillée</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Décrivez le problème en détail. Incluez toutes les informations pertinentes (dates, numéros de commande, etc.)..."
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>
            {description.length}/1000
          </Text>
        </View>

        <View style={[styles.section, styles.infoSection]}>
          <View style={styles.infoItem}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} />
            <Text style={styles.infoText}>
              Les litiges sont examinés par notre équipe d'administration. Veuillez fournir des informations précises pour accélérer le traitement.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!title.trim() || !description.trim()) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !title.trim() || !description.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Envoyer le litige</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
  section: {
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  typeCard: {
    width: '48%',
    padding: SPACING.md,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  typeCardSelected: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  typeLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: COLORS.primary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    fontSize: FONT_SIZE.md,
  },
  textArea: {
    minHeight: 150,
  },
  charCount: {
    textAlign: 'right',
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  infoSection: {
    backgroundColor: `${COLORS.accent}10`,
    borderColor: COLORS.accent,
  },
  infoItem: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  footer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  submitButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#fff',
  },
});

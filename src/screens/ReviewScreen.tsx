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
import { orderReviewService } from '../services/orderReviewService';
import { useAuthStore } from '../store';

export default function ReviewScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId, storeId, storeName } = route.params as {
    orderId: string;
    storeId: string;
    storeName: string;
  };
  const { user } = useAuthStore();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleStarPress = (star: number) => {
    setRating(star);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Erreur', 'Veuillez sélectionner une note');
      return;
    }

    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour laisser un avis');
      return;
    }

    setLoading(true);
    try {
      await orderReviewService.create({
        order_id: orderId,
        user_id: user.id,
        store_id: storeId,
        rating,
        comment: comment.trim() || undefined,
      });

      Alert.alert(
        'Merci !',
        'Votre évaluation a été enregistrée avec succès',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer votre évaluation');
    } finally {
      setLoading(false);
    }
  };

  const renderStar = (star: number) => {
    const isFilled = star <= (hoveredRating || rating);
    return (
      <TouchableOpacity
        key={star}
        onPress={() => handleStarPress(star)}
        onPressIn={() => setHoveredRating(star)}
        onPressOut={() => setHoveredRating(0)}
        style={styles.starButton}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isFilled ? 'star' : 'star-outline'}
          size={40}
          color={isFilled ? COLORS.accent : COLORS.textMuted}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Évaluer la commande</Text>
          <Text style={styles.subtitle}>{storeName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note globale</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(renderStar)}
          </View>
          <Text style={styles.ratingText}>
            {rating > 0 ? `${rating}/5` : 'Sélectionnez une note'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commentaire (optionnel)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Partagez votre expérience avec cette commande..."
            placeholderTextColor={COLORS.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>
            {comment.length}/500
          </Text>
        </View>

        <View style={[styles.section, styles.infoSection]}>
          <View style={styles.infoItem}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} />
            <Text style={styles.infoText}>
              Votre évaluation aidera d'autres clients et permettra au vendeur d'améliorer son service.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || rating === 0}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Envoyer l'évaluation</Text>
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
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  starButton: {
    padding: SPACING.xs,
  },
  ratingText: {
    textAlign: 'center',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.accent,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    fontSize: FONT_SIZE.md,
    minHeight: 120,
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

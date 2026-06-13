import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { orderService } from '../services/orderService';
import * as ImagePicker from 'expo-image-picker';

export default function DeliveryProofScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId } = route.params as { orderId: string };

  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sélectionner une image');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de prendre une photo');
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    // Pour l'instant, on retourne l'URI locale
    // Dans une implémentation complète, il faudrait uploader vers un stockage (Supabase Storage, S3, etc.)
    return uri;
  };

  const handleSubmit = async () => {
    if (!photo && !signature) {
      Alert.alert('Erreur', 'Veuillez fournir au moins une preuve de livraison (photo ou signature)');
      return;
    }

    setLoading(true);
    try {
      let proofUrl = '';
      
      if (photo) {
        proofUrl = await uploadImage(photo);
      } else if (signature) {
        proofUrl = await uploadImage(signature);
      }

      await orderService.updateDeliveryProof(orderId, proofUrl);
      
      Alert.alert(
        'Succès',
        'La preuve de livraison a été enregistrée avec succès',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la preuve de livraison');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Preuve de livraison</Text>
          <Text style={styles.subtitle}>
            Fournissez une preuve que la commande a été livrée au client
          </Text>
        </View>

        {/* Photo section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo du colis livré</Text>
          
          {photo ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: photo }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setPhoto(null)}
              >
                <Ionicons name="close-circle" size={24} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="camera-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.placeholderText}>Aucune photo</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={pickImage}
              disabled={loading}
            >
              <Ionicons name="image-outline" size={20} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={takePhoto}
              disabled={loading}
            >
              <Ionicons name="camera" size={20} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Prendre photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Signature section (placeholder for future implementation) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signature du client</Text>
          <View style={[styles.placeholderContainer, { backgroundColor: COLORS.bg }]}>
            <Ionicons name="create-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.placeholderText}>Signature non disponible</Text>
            <Text style={styles.placeholderSubtext}>Fonctionnalité à venir</Text>
          </View>
        </View>

        {/* Info section */}
        <View style={[styles.section, styles.infoSection]}>
          <View style={styles.infoItem}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} />
            <Text style={styles.infoText}>
              La preuve de livraison sera visible par le client et servira de référence en cas de litige.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!photo && !signature) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || (!photo && !signature)}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Confirmer la livraison</Text>
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
    fontSize: FONT_SIZE.sm,
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
  imageContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.md,
  },
  removeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: 20,
  },
  placeholderContainer: {
    height: 150,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  placeholderText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  placeholderSubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  secondaryButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
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

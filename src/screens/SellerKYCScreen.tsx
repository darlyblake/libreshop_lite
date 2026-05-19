import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { financeService } from '../services/financeService';
import { errorHandler } from '../utils/errorHandler';

export const SellerKYCScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [storeId, setStoreId] = useState<string | null>(null);
  
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [idType, setIdType] = useState('cni');
  const [idNumber, setIdNumber] = useState('');
  
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  const [videoSelfieUri, setVideoSelfieUri] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const idTypes = [
    { id: 'cni', label: 'Carte Nationale d\'Identité' },
    { id: 'passport', label: 'Passeport' },
    { id: 'driving_license', label: 'Permis de conduire' },
  ];

  useEffect(() => {
    loadStore();
  }, [user]);

  const loadStore = async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (store?.id) {
        setStoreId(store.id);
      }
    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'Error loading store for KYC');
    }
  };

  const pickImage = async (setImage: React.Dispatch<React.SetStateAction<string | null>>) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Nous avons besoin d\'accéder à vos photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const recordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Nous avons besoin d\'accéder à votre caméra.');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 15,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setVideoSelfieUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la vidéo');
    }
  };

  const handleSubmit = async () => {
    if (!storeId) return;

    if (!fullName || !phone || !idNumber) {
      Alert.alert('Erreur', 'Veuillez remplir toutes les informations personnelles.');
      return;
    }

    if (!idFrontUri || !idBackUri || !videoSelfieUri) {
      Alert.alert('Erreur', 'Veuillez fournir toutes les pièces jointes (Recto, Verso, et Vidéo Selfie).');
      return;
    }

    try {
      setIsSubmitting(true);
      // In a real app, upload files to storage here and get URLs
      await financeService.submitKYC(storeId, {
        full_name: fullName,
        phone,
        id_type: idType,
        id_number: idNumber,
        id_front_url: idFrontUri,
        id_back_url: idBackUri,
        video_selfie_url: videoSelfieUri,
      });

      Alert.alert(
        'Demande envoyée',
        'Vos documents ont été soumis avec succès. Notre équipe va les examiner.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi de la demande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const FilePickerButton = ({ title, icon, uri, onPress, isVideo = false }: any) => (
    <TouchableOpacity 
      style={[styles.fileBtn, uri ? styles.fileBtnSuccess : null]}
      onPress={onPress}
    >
      <View style={styles.fileBtnHeader}>
        <Ionicons name={uri ? 'checkmark-circle' : icon} size={24} color={uri ? COLORS.success : COLORS.primary} />
        <Text style={[styles.fileBtnTitle, uri ? { color: COLORS.success } : null]}>
          {uri ? 'Fichier sélectionné' : title}
        </Text>
      </View>
      {!uri && <Text style={styles.fileBtnHelper}>Appuyez pour {isVideo ? 'enregistrer' : 'sélectionner'}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vérification de Compte (KYC)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={24} color={COLORS.success} />
          <Text style={styles.infoText}>
            Pour sécuriser vos retraits et respecter la réglementation, nous devons vérifier votre identité.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Informations Personnelles</Text>
          
          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Tel qu'il apparaît sur votre pièce"
          />

          <Text style={styles.label}>Numéro de téléphone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Numéro joignable"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Pièce d'Identité</Text>
          
          <Text style={styles.label}>Type de pièce</Text>
          <View style={styles.typeContainer}>
            {idTypes.map(type => (
              <TouchableOpacity
                key={type.id}
                style={[styles.typeBtn, idType === type.id && styles.typeBtnActive]}
                onPress={() => setIdType(type.id)}
              >
                <Text style={[styles.typeBtnText, idType === type.id && styles.typeBtnTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Numéro de la pièce</Text>
          <TextInput
            style={styles.input}
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="Numéro d'identification"
          />

          <View style={styles.filesRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Recto de la pièce</Text>
              <FilePickerButton 
                title="Ajouter Recto" 
                icon="image-outline" 
                uri={idFrontUri} 
                onPress={() => pickImage(setIdFrontUri)} 
              />
            </View>
            <View style={{ width: SPACING.md }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Verso de la pièce</Text>
              <FilePickerButton 
                title="Ajouter Verso" 
                icon="image-outline" 
                uri={idBackUri} 
                onPress={() => pickImage(setIdBackUri)} 
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Vérification Vidéo</Text>
          <Text style={styles.instructionText}>
            Enregistrez une courte vidéo de vous-même (selfie) où vous dites à voix haute :
            {"\n\n"}"Je m'appelle [Votre Nom] et je confirme être le propriétaire de ce compte LibreShop."
          </Text>

          <FilePickerButton 
            title="Enregistrer la vidéo" 
            icon="videocam-outline" 
            uri={videoSelfieUri} 
            onPress={recordVideo} 
            isVideo={true}
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Soumettre mes documents</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          Vos données sont chiffrées et stockées de manière sécurisée uniquement à des fins de vérification.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  scrollContent: { padding: SPACING.md },
  
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.success + '15',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  infoText: { flex: 1, marginLeft: SPACING.sm, color: COLORS.text, fontSize: 13, lineHeight: 18 },
  
  section: { backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: RADIUS.lg, marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6, marginTop: SPACING.xs },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  typeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  typeBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  typeBtnTextActive: { color: COLORS.primary },

  filesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm },
  fileBtn: {
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  fileBtnSuccess: {
    backgroundColor: COLORS.success + '10',
    borderColor: COLORS.success + '50',
    borderStyle: 'solid',
  },
  fileBtnHeader: { alignItems: 'center', marginBottom: 4 },
  fileBtnTitle: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginTop: 4, textAlign: 'center' },
  fileBtnHelper: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },
  
  instructionText: { fontSize: 14, color: COLORS.text, lineHeight: 22, marginBottom: SPACING.md, backgroundColor: COLORS.bg, padding: SPACING.md, borderRadius: RADIUS.md },

  submitBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  footerNote: { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, marginTop: SPACING.md, paddingHorizontal: SPACING.xl },
});

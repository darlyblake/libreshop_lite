import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { RootStackParamList } from '../navigation/types';
import { homeBannerService, HomeBanner, HomeBannerPlacement } from '../lib/supabase';
import { LoadingSpinner } from '../components/LoadingSpinner';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'AdminBannerForm'>;

interface BannerFormData {
  placement: HomeBannerPlacement;
  title: string;
  subtitle: string;
  image_url: string;
  color: string;
  link_screen: string;
  link_params: string;
  is_active: boolean;
  position: number;
}

const DEFAULT_FORM_DATA: BannerFormData = {
  placement: 'carousel',
  title: '',
  subtitle: '',
  image_url: '',
  color: '#FF6B6B',
  link_screen: '',
  link_params: '',
  is_active: true,
  position: 0,
};

const SCREEN_OPTIONS = [
  { value: 'ClientHome', label: 'Page d\'accueil' },
  { value: 'ClientAllStores', label: 'Toutes les boutiques' },
  { value: 'ClientAllProducts', label: 'Tous les produits' },
  { value: 'ClientSearch', label: 'Recherche' },
  { value: 'StoreDetail', label: 'Détail boutique' },
  { value: 'ProductDetail', label: 'Détail produit' },
];

export const AdminBannerFormScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { bannerId } = route.params || {};
  
  const [formData, setFormData] = useState<BannerFormData>(DEFAULT_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(!!bannerId);

  const loadBanner = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const banners = await homeBannerService.getAll();
      const banner = banners.find(b => b.id === id);
      
      if (banner) {
        setFormData({
          placement: banner.placement,
          title: banner.title,
          subtitle: banner.subtitle || '',
          image_url: banner.image_url || '',
          color: banner.color || '#FF6B6B',
          link_screen: banner.link_screen || '',
          link_params: banner.link_params ? JSON.stringify(banner.link_params) : '',
          is_active: banner.is_active,
          position: banner.position,
        });
        setIsEditing(true);
      } else {
        Alert.alert('Erreur', 'Bannière non trouvée');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading banner:', error);
      Alert.alert('Erreur', 'Impossible de charger la bannière');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  const validateForm = useCallback((): boolean => {
    if (!formData.title.trim()) {
      Alert.alert('Erreur', 'Le titre est obligatoire');
      return false;
    }
    
    if (formData.placement === 'promo' && !formData.color.trim()) {
      Alert.alert('Erreur', 'La couleur est obligatoire pour les bannières promo');
      return false;
    }
    
    if (formData.link_params.trim()) {
      try {
        JSON.parse(formData.link_params);
      } catch {
        Alert.alert('Erreur', 'Les paramètres de navigation doivent être au format JSON valide');
        return false;
      }
    }
    
    return true;
  }, [formData]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      
      const bannerData: Omit<HomeBanner, 'id' | 'created_at' | 'updated_at'> = {
        placement: formData.placement,
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim() || null,
        image_url: formData.image_url.trim() || null,
        color: formData.placement === 'promo' ? formData.color : null,
        link_screen: formData.link_screen.trim() || null,
        link_params: formData.link_params.trim() ? JSON.parse(formData.link_params) : null,
        is_active: formData.is_active,
        position: formData.position,
      };
      
      if (isEditing) {
        await homeBannerService.update(bannerId!, bannerData);
        Alert.alert('Succès', 'Bannière mise à jour avec succès');
      } else {
        await homeBannerService.create(bannerData);
        Alert.alert('Succès', 'Bannière créée avec succès');
      }
      
      navigation.goBack();
    } catch (error) {
      console.error('Error saving banner:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder la bannière');
    } finally {
      setSaving(false);
    }
  }, [formData, bannerId, isEditing, validateForm, navigation]);

  const updateField = useCallback((field: keyof BannerFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (bannerId) {
        loadBanner(bannerId);
      }
    }, [bannerId, loadBanner])
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? 'Modifier la bannière' : 'Nouvelle bannière'}
        </Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name="checkmark" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Placement Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type de bannière</Text>
          <View style={styles.placementRow}>
            {(['carousel', 'promo'] as HomeBannerPlacement[]).map(placement => (
              <TouchableOpacity
                key={placement}
                style={[
                  styles.placementOption,
                  formData.placement === placement && styles.placementOptionActive
                ]}
                onPress={() => updateField('placement', placement)}
              >
                <Ionicons 
                  name={placement === 'carousel' ? 'images' : 'pricetag'} 
                  size={20} 
                  color={formData.placement === placement ? 'white' : COLORS.textMuted} 
                />
                <Text style={[
                  styles.placementText,
                  formData.placement === placement && styles.placementTextActive
                ]}>
                  {placement === 'carousel' ? 'Carousel' : 'Promotion'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de base</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Titre *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => updateField('title', text)}
              placeholder="Titre de la bannière"
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Sous-titre</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.subtitle}
              onChangeText={(text) => updateField('subtitle', text)}
              placeholder="Sous-titre optionnel"
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Position</Text>
            <TextInput
              style={styles.input}
              value={String(formData.position)}
              onChangeText={(text) => updateField('position', parseInt(text) || 0)}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Visual Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apparence</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>URL de l'image</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.image_url}
              onChangeText={(text) => updateField('image_url', text)}
              placeholder="https://example.com/image.jpg"
              multiline
              numberOfLines={2}
            />
          </View>

          {formData.placement === 'promo' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Couleur de fond *</Text>
              <View style={styles.colorInputRow}>
                <TextInput
                  style={[styles.input, styles.colorInput]}
                  value={formData.color}
                  onChangeText={(text) => updateField('color', text)}
                  placeholder="#FF6B6B"
                  maxLength={7}
                />
                <View 
                  style={[styles.colorPreview, { backgroundColor: formData.color }]}
                />
              </View>
            </View>
          )}
        </View>

        {/* Navigation Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navigation</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Écran de destination</Text>
            <View style={styles.screenOptions}>
              {SCREEN_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.screenOption,
                    formData.link_screen === option.value && styles.screenOptionActive
                  ]}
                  onPress={() => updateField('link_screen', option.value)}
                >
                  <Text style={[
                    styles.screenOptionText,
                    formData.link_screen === option.value && styles.screenOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Paramètres de navigation (JSON)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.link_params}
              onChangeText={(text) => updateField('link_params', text)}
              placeholder='{"storeId": "123"}'
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statut</Text>
          
          <TouchableOpacity
            style={styles.statusToggle}
            onPress={() => updateField('is_active', !formData.is_active)}
          >
            <View style={[
              styles.statusToggleCircle,
              formData.is_active && styles.statusToggleCircleActive
            ]}>
              <Ionicons 
                name={formData.is_active ? 'checkmark' : 'close'} 
                size={16} 
                color="white" 
              />
            </View>
            <Text style={styles.statusToggleText}>
              {formData.is_active ? 'Actif' : 'Inactif'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: COLORS.card,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  placementRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  placementOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: SPACING.sm,
  },
  placementOptionActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  placementText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  placementTextActive: {
    color: 'white',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  colorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  colorInput: {
    flex: 1,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  screenOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  screenOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  screenOptionActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  screenOptionText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  screenOptionTextActive: {
    color: 'white',
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statusToggleCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusToggleCircleActive: {
    backgroundColor: COLORS.success,
  },
  statusToggleText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.text,
  },
});

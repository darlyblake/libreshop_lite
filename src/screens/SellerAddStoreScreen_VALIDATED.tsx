// Exemple d'intégration de la validation dans SellerAddStoreScreen
// Remplacer la validation manuelle par useFormValidation

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { planService, storeService } from '../lib/supabase';
import { categoryService } from '../lib/categoryService';
import { cloudinaryService } from '../lib/cloudinaryService';
import { countryService, type Country } from '../lib/countryService';
import { cityService, type City } from '../lib/cityService';
import { useAuthStore } from '../store';
import { storeCreationDraftStorage } from '../lib/storage';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ValidationMessage } from '../components/ValidationMessage';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useFormValidation } from '../hooks/useFormValidation';
import { VALIDATION_RULES } from '../utils/validation';

interface FormData {
  name: string;
  slug: string;
  description: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  country_id: string;
  city_id: string;
  city_name: string;
  website?: string;
  social?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  };
  logo_url?: string;
  banner_url?: string;
}

// Règles de validation pour le formulaire de boutique
const STORE_VALIDATION_RULES = {
  name: { 
    required: true, 
    minLength: 2, 
    maxLength: 100,
    custom: (value: string) => {
      if (!value || value.trim() === '') return 'Le nom de la boutique est requis';
      if (value.trim().length < 2) return 'Le nom doit contenir au moins 2 caractères';
      if (value.trim().length > 100) return 'Le nom ne peut pas dépasser 100 caractères';
      return null;
    }
  },
  slug: { 
    required: true, 
    minLength: 3, 
    maxLength: 50,
    pattern: /^[a-z0-9-]+$/,
    custom: (value: string) => {
      if (!value || value.trim() === '') return 'Le slug est requis';
      if (!/^[a-z0-9-]+$/.test(value)) return 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets';
      if (value.length < 3) return 'Le slug doit contenir au moins 3 caractères';
      if (value.length > 50) return 'Le slug ne peut pas dépasser 50 caractères';
      return null;
    }
  },
  category: { 
    required: true,
    custom: (value: string) => {
      if (!value || value.trim() === '') return 'La catégorie est requise';
      return null;
    }
  },
  email: { 
    required: true, 
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: (value: string) => {
      if (!value || value.trim() === '') return 'L\'email est requis';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Veuillez entrer une adresse email valide';
      return null;
    }
  },
  phone: { 
    required: true, 
    pattern: /^\+?[1-9]\d{1,14}$/,
    custom: (value: string) => {
      if (!value || value.trim() === '') return 'Le téléphone est requis';
      if (!/^\+?[1-9]\d{1,14}$/.test(value)) return 'Veuillez entrer un numéro de téléphone valide';
      return null;
    }
  },
  address: { 
    required: true, 
    minLength: 10,
    custom: (value: string) => {
      if (!value || value.trim() === '') return 'L\'adresse est requise';
      if (value.trim().length < 10) return 'L\'adresse doit contenir au moins 10 caractères';
      return null;
    }
  },
  country_id: { 
    required: true,
    custom: (value: string) => {
      if (!value || value.trim() === '') return 'Le pays est requis';
      return null;
    }
  },
  city_id: { 
    required: true,
    custom: (value: string) => {
      if (!value || value.trim() === '') return 'La ville est requise';
      return null;
    }
  },
  website: { 
    required: false,
    pattern: /^https?:\/\/.+/,
    custom: (value: string) => {
      if (value && value.trim() !== '') {
        if (!/^https?:\/\/.+/.test(value)) {
          return 'Veuillez entrer une URL valide (commençant par http:// ou https://)';
        }
      }
      return null;
    }
  },
};

export const SellerAddStoreScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  
  // Utiliser le hook de validation
  const {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    validateField,
    resetForm,
    setFieldValue,
  } = useFormValidation({
    rules: STORE_VALIDATION_RULES,
    initialValues: {
      name: '',
      slug: '',
      description: '',
      category: '',
      email: user?.email || '',
      phone: '',
      address: '',
      country_id: '',
      city_id: '',
      city_name: '',
      website: '',
      social: {
        facebook: '',
        instagram: '',
        twitter: '',
        whatsapp: '',
      },
      logo_url: '',
      banner_url: '',
    },
    onSubmit: async (formData) => {
      try {
        // Logique de soumission existante
        await submitStoreData(formData);
        Alert.alert('Succès', 'Boutique créée avec succès!');
        navigation.navigate('SellerTabs');
      } catch (error) {
        errorHandler.handleDatabaseError(error as Error, 'StoreCreation');
      }
    },
  });

  // Fonction de soumission (adapter avec la logique existante)
  const submitStoreData = async (formData: typeof values) => {
    // Implémenter la logique de création de boutique
    // Utiliser les services existants
  };

  // Génération automatique du slug à partir du nom
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

  // Mettre à jour le slug quand le nom change
  const handleNameChange = (value: string) => {
    handleChange('name', value);
    if (!touched.slug || values.slug === generateSlug(values.name)) {
      handleChange('slug', generateSlug(value));
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Créer votre boutique</Text>
            <Text style={styles.subtitle}>
              Remplissez les informations pour démarrer votre vente en ligne
            </Text>
          </View>

          {/* Formulaire avec validation */}
          <View style={styles.form}>
            {/* Nom de la boutique */}
            <View style={styles.field}>
              <Text style={styles.label}>Nom de la boutique *</Text>
              <Input
                placeholder="Ma boutique"
                value={values.name}
                onChangeText={handleNameChange}
                onBlur={() => handleBlur('name')}
                error={touched.name ? errors.name : undefined}
              />
              <ValidationMessage 
                error={touched.name ? errors.name : ''} 
                visible={!!(touched.name && errors.name)} 
              />
            </View>

            {/* Slug */}
            <View style={styles.field}>
              <Text style={styles.label}>URL de la boutique *</Text>
              <Input
                placeholder="ma-boutique"
                value={values.slug}
                onChangeText={(value) => handleChange('slug', value)}
                onBlur={() => handleBlur('slug')}
                error={touched.slug ? errors.slug : undefined}
              />
              <Text style={styles.helper}>
                {values.slug ? `votreboutique.com/${values.slug}` : 'votreboutique.com/votre-slug'}
              </Text>
              <ValidationMessage 
                error={touched.slug ? errors.slug : ''} 
                visible={!!(touched.slug && errors.slug)} 
              />
            </View>

            {/* Catégorie */}
            <View style={styles.field}>
              <Text style={styles.label}>Catégorie *</Text>
              {/* Implementer le sélecteur de catégorie */}
              <ValidationMessage 
                error={touched.category ? errors.category : ''} 
                visible={!!(touched.category && errors.category)} 
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email *</Text>
              <Input
                placeholder="contact@boutique.com"
                value={values.email}
                onChangeText={(value) => handleChange('email', value)}
                onBlur={() => handleBlur('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                error={touched.email ? errors.email : undefined}
              />
              <ValidationMessage 
                error={touched.email ? errors.email : ''} 
                visible={!!(touched.email && errors.email)} 
              />
            </View>

            {/* Téléphone */}
            <View style={styles.field}>
              <Text style={styles.label}>Téléphone *</Text>
              <Input
                placeholder="+225000000000"
                value={values.phone}
                onChangeText={(value) => handleChange('phone', value)}
                onBlur={() => handleBlur('phone')}
                keyboardType="phone-pad"
                error={touched.phone ? errors.phone : undefined}
              />
              <ValidationMessage 
                error={touched.phone ? errors.phone : ''} 
                visible={!!(touched.phone && errors.phone)} 
              />
            </View>

            {/* Adresse */}
            <View style={styles.field}>
              <Text style={styles.label}>Adresse complète *</Text>
              <Input
                placeholder="123 Rue principale, Abidjan, Côte d'Ivoire"
                value={values.address}
                onChangeText={(value) => handleChange('address', value)}
                onBlur={() => handleBlur('address')}
                multiline
                numberOfLines={3}
                error={touched.address ? errors.address : undefined}
              />
              <ValidationMessage 
                error={touched.address ? errors.address : ''} 
                visible={!!(touched.address && errors.address)} 
              />
            </View>

            {/* Website (optionnel) */}
            <View style={styles.field}>
              <Text style={styles.label}>Site web (optionnel)</Text>
              <Input
                placeholder="https://www.maboutique.com"
                value={values.website}
                onChangeText={(value) => handleChange('website', value)}
                onBlur={() => handleBlur('website')}
                keyboardType="url"
                error={touched.website ? errors.website : undefined}
              />
              <ValidationMessage 
                error={touched.website ? errors.website : ''} 
                visible={!!(touched.website && errors.website)} 
                type="warning"
              />
            </View>
          </View>

          {/* Bouton de soumission */}
          <View style={styles.actions}>
            <Button
              title="Créer ma boutique"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!isValid || isSubmitting}
              variant="primary"
              size="large"
            />
            
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    lineHeight: 22,
  },
  form: {
    gap: SPACING.lg,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  helper: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  actions: {
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  cancelText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
});

export default SellerAddStoreScreen;

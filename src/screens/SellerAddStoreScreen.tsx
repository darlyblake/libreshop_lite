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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme'; // Gardé pour compatibilité temporaire si besoin
import { useTheme } from '../hooks/useTheme';
import { errorHandler } from '../utils/errorHandler';
import { useFormValidation } from '../hooks/useFormValidation';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  subcategories?: Category[];
}

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
  social: Record<string, string>;
}

const STORE_VALIDATION_RULES = {
  name: { required: true, minLength: 2, maxLength: 50 },
  slug: { required: true, minLength: 3, pattern: /^[a-z0-9-]+$/ },
  category: { required: true },
  email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  phone: { required: true, minLength: 8 },
  address: { required: true },
  country_id: { required: true },
  city_id: { required: true },
};

export const SellerAddStoreScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<City[]>([]);
  
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [submissionStatus, setSubmissionStatus] = useState<{
    loading: boolean;
    step: string;
    progress: number;
    error: string | null;
  }>({ loading: false, step: '', progress: 0, error: null });

  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = getStyles(themeContext);

  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleSubmit: handleFormSubmit,
    setFieldValue,
    setError,
    validateField,
    handleBlur,
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
        tiktok: '',
      },
    },
    onSubmit: async (data) => {
      await performSubmit(data as FormData);
    },
  });

  // Slug Availability Check
  useEffect(() => {
    if (values.slug && values.slug.length >= 3) {
      const checkSlug = async () => {
        setSlugStatus('checking');
        try {
          const available = await storeService.isSlugAvailable(values.slug);
          setSlugStatus(available ? 'available' : 'taken');
          if (!available) {
            setError('slug', 'Cette adresse est déjà utilisée');
          }
        } catch (e: any) {
          console.error('Slug check failed', e);
          setSlugStatus('idle');
        }
      };
      
      const timer = setTimeout(checkSlug, 500);
      return () => clearTimeout(timer);
    } else {
      setSlugStatus('idle');
    }
  }, [values.slug]);

  useEffect(() => {
    loadCategories();
    void loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      const data = await countryService.getAll();
      setCountries(data);
    } catch (e: any) {
      errorHandler.handleDatabaseError(e, 'Error loading countries');
    }
  };

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const data = await categoryService.getAll();
      const CATEGORY_COLORS = [
        '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', 
        '#ec4899', '#6366f1', '#06b6d4', '#84cc16', '#f97316'
      ];
      const enrichedData = data.map((cat: any, index: number) => ({
        ...cat,
        icon: getCategoryIcon(cat.name),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        subcategories: (cat.subcategories || []).map((sub: any) => ({
          ...sub,
          name: sub.name || sub,
          slug: sub.slug || (sub.name || sub).toLowerCase().replace(/\s+/g, '-'),
        })),
      }));
      setCategories(enrichedData);
    } catch (error: any) {
      errorHandler.handleDatabaseError(error, 'Error loading categories');
    } finally {
      setLoadingCategories(false);
    }
  };

  const performSubmit = async (formData: FormData) => {
    if (!user) return;
    
    setSubmissionStatus({ loading: true, step: 'Préparation...', progress: 10, error: null });
    
    try {
      // 1. Upload Images
      let uploadedLogoUrl = null;
      let uploadedBannerUrl = null;
      
      if (logoUri) {
        setSubmissionStatus(s => ({ ...s, step: 'Upload du logo...', progress: 30 }));
        uploadedLogoUrl = await cloudinaryService.uploadImage(logoUri, { folder: 'libreshop/stores/logo' });
      }
      
      if (bannerUri) {
        setSubmissionStatus(s => ({ ...s, step: 'Upload de la bannière...', progress: 50 }));
        uploadedBannerUrl = await cloudinaryService.uploadImage(bannerUri, { folder: 'libreshop/stores/banner' });
      }

      // 2. Fetch Trial Plan
      setSubmissionStatus(s => ({ ...s, step: 'Configuration du plan...', progress: 70 }));
      const plans = await planService.getAll();
      const trial = plans.find((p: any) => p.price === 0 && p.trial_days && p.status === 'active');
      
      // 3. Create Store
      setSubmissionStatus(s => ({ ...s, step: 'Création de la boutique...', progress: 90 }));
      const whatsappPhone = String(formData.phone || '').replace(/[^\d+]/g, '');
      // Exclude UI-only fields like city_name to prevent Supabase 400 Bad Request
      const { city_name, ...databaseFields } = formData as any;
      const createArgs = {
        ...databaseFields,
        phone: whatsappPhone,
        logo_url: uploadedLogoUrl,
        banner_url: uploadedBannerUrl,
        subcategory: selectedSubcategory || undefined,
      };

      await storeService.createWithPlanSlugRetry(user.id, createArgs as any, trial?.id || 'trial');
      
      setSubmissionStatus(s => ({ ...s, step: 'Terminé !', progress: 100 }));
      
      // Success Handling
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await storeCreationDraftStorage.clear(user.id);
      
      setSubmissionStatus(s => ({ ...s, loading: false }));

      if (Platform.OS === 'web') {
        alert('Succès 🎉\nVotre boutique a été créée avec succès ! Un essai de 7 jours est activé.');
        navigation.replace('SellerTabs' as never);
      } else {
        Alert.alert(
          'Succès 🎉',
          'Votre boutique a été créée avec succès ! Un essai de 7 jours est activé.',
          [{ text: 'Accéder à mon tableau de bord', onPress: () => navigation.replace('SellerTabs' as never) }]
        );
      }
    } catch (error: any) {
      setSubmissionStatus(s => ({ ...s, loading: false, error: String(error) }));
      errorHandler.handleDatabaseError(error, 'StoreCreation');
      Alert.alert('Erreur', 'Une erreur est survenue lors de la création. Veuillez réessayer.');
    }
  };

  const getCategoryIcon = (categoryName: string): string => {
    const icons: Record<string, string> = {
      'Électronique': 'laptop-outline', 'Mode': 'shirt-outline', 'Maison': 'home-outline',
      'Beauté': 'heart-outline', 'Sport': 'basketball-outline', 'Alimentaire': 'restaurant-outline',
    };
    return icons[categoryName] || 'storefront-outline';
  };

  const pickImage = async (type: 'logo' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'logo' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      if (type === 'logo') setLogoUri(result.assets[0].uri);
      else setBannerUri(result.assets[0].uri);
    }
  };

  const updateSlug = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setFieldValue('slug', slug);
  };

  const nextStep = () => {
    let isValid = true;
    
    if (currentStep === 1) {
      const step1Fields = ['name', 'slug', 'category'];
      step1Fields.forEach(field => {
        const err = validateField(field);
        if (err) {
          isValid = false;
          handleBlur(field); // Forces the field to display the error
        }
      });
      
      if (!isValid) {
        Alert.alert('Champs requis', 'Veuillez remplir correctement les informations de base.');
        return;
      }
      if (slugStatus === 'taken') {
        Alert.alert('URL non disponible', 'Veuillez choisir une autre adresse pour votre boutique.');
        return;
      }
    }
    
    if (currentStep === 2) {
      const step2Fields = ['email', 'phone', 'address', 'country_id', 'city_id'];
      step2Fields.forEach(field => {
        const err = validateField(field);
        if (err) {
          isValid = false;
          handleBlur(field); // Forces the field to display the error
        }
      });
      
      if (!isValid) {
        Alert.alert('Champs requis', 'Veuillez remplir correctement vos coordonnées de contact.');
        return;
      }
    }
    
    if (isValid) {
      setCurrentStep(prev => prev + 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const renderProgressOverlay = () => (
    <Modal visible={submissionStatus.loading} transparent animationType="fade">
      <View style={styles.overlayContainer}>
        <BlurView intensity={90} tint="dark" style={styles.overlayContent}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.overlayStep}>{submissionStatus.step}</Text>
          <View style={styles.overlayProgressBar}>
            <View style={[styles.overlayProgressFill, { width: `${submissionStatus.progress}%` }]} />
          </View>
          <Text style={styles.overlayPercent}>{submissionStatus.progress}%</Text>
        </BlurView>
      </View>
    </Modal>
  );

  const renderStep1 = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📸 Médias</Text>
      <View style={styles.imagesContainer}>
        <TouchableOpacity style={styles.logoPicker} onPress={() => pickImage('logo')}>
          {logoUri ? <Image source={{ uri: logoUri }} style={styles.logoImage} /> : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="camera" size={32} color={COLORS.accent} />
              <Text style={styles.logoPickerText}>Logo</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.bannerPicker} onPress={() => pickImage('banner')}>
          {bannerUri ? <Image source={{ uri: bannerUri }} style={styles.bannerImage} /> : (
            <View style={styles.bannerPlaceholder}>
              <Ionicons name="image-outline" size={32} color={COLORS.accent} />
              <Text style={styles.bannerPickerText}>Bannière</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Informations</Text>
      <Input
        icon="storefront-outline"
        placeholder="Nom de la boutique"
        value={values.name}
        onChangeText={(v) => { handleChange('name', v); updateSlug(v); }}
        error={touched.name ? errors.name : undefined}
      />
      
      <View style={styles.slugInputContainer}>
        <Input
          icon="link-outline"
          placeholder="URL personnalisée (slug)"
          value={values.slug}
          onChangeText={(v) => handleChange('slug', v)}
          autoCapitalize="none"
          error={touched.slug ? errors.slug : undefined}
        />
        <View style={styles.slugBadge}>
          {slugStatus === 'checking' && <ActivityIndicator size="small" color={COLORS.accent} />}
          {slugStatus === 'available' && <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />}
          {slugStatus === 'taken' && <Ionicons name="close-circle" size={20} color={COLORS.danger} />}
        </View>
      </View>

      <TouchableOpacity style={styles.categorySelector} onPress={() => setPickerVisible(true)}>
        <Ionicons name="pricetag-outline" size={20} color={COLORS.textMuted} />
        <Text style={[styles.categorySelectorText, !values.category && styles.placeholderText]}>
          {values.category ? categories.find(c => c.slug === values.category)?.name : 'Sélectionnez une catégorie'}
        </Text>
        <Ionicons name="chevron-down" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
      
      <Input
        placeholder="Description courte (optionnel)"
        value={values.description}
        onChangeText={(v) => handleChange('description', v)}
        multiline
        numberOfLines={3}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📧 Contact & Localisation</Text>
      <Input
        icon="mail-outline"
        placeholder="Email professionnel"
        value={values.email}
        onChangeText={(v) => handleChange('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
        error={touched.email ? errors.email : undefined}
      />
      <Input
        icon="call-outline"
        placeholder="Numéro WhatsApp (ex: +225...)"
        value={values.phone}
        onChangeText={(v) => handleChange('phone', v)}
        keyboardType="phone-pad"
        error={touched.phone ? errors.phone : undefined}
      />
      
      <TouchableOpacity style={styles.categorySelector} onPress={() => setCountryPickerVisible(true)}>
        <Ionicons name="flag-outline" size={20} color={COLORS.textMuted} />
        <Text style={[styles.categorySelectorText, !values.country_id && styles.placeholderText]}>
          {values.country_id ? countries.find(c => c.id === values.country_id)?.name : 'Sélectionnez un pays'}
        </Text>
        <Ionicons name="chevron-down" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      <Input
        icon="business-outline"
        placeholder={values.country_id ? "Rechercher votre ville..." : "Choisissez d'abord un pays"}
        value={cityQuery || values.city_name}
        onChangeText={(v) => {
          setCityQuery(v);
          setFieldValue('city_name', v);
          if (values.country_id) {
            cityService.searchByCountry(values.country_id, v, 10).then(res => {
              setCityResults(res);
            });
          }
        }}
        editable={!!values.country_id}
      />
      
      {cityResults.length > 0 && !values.city_id && (
        <View style={styles.cityDropdown}>
          {cityResults.map(city => (
            <TouchableOpacity key={city.id} style={styles.cityItem} onPress={() => {
              setFieldValue('city_id', city.id);
              setFieldValue('city_name', city.name);
              setCityQuery('');
              setCityResults([]);
            }}>
              <Text style={styles.cityItemText}>{city.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Input
        icon="location-outline"
        placeholder="Adresse physique (ex: Plateau, Rue 12)"
        value={values.address}
        onChangeText={(v) => handleChange('address', v)}
        error={touched.address ? errors.address : undefined}
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🌐 Réseaux Sociaux</Text>
      <Input
        icon="logo-facebook"
        placeholder="Facebook URL"
        value={values.social.facebook}
        onChangeText={(v) => setFieldValue('social', { ...values.social, facebook: v })}
      />
      <Input
        icon="logo-instagram"
        placeholder="Instagram @"
        value={values.social.instagram}
        onChangeText={(v) => setFieldValue('social', { ...values.social, instagram: v })}
      />
      <Input
        icon="logo-whatsapp"
        placeholder="Lien WhatsApp direct"
        value={values.social.whatsapp}
        onChangeText={(v) => setFieldValue('social', { ...values.social, whatsapp: v })}
      />
      
      <View style={styles.previewCard}>
        <LinearGradient colors={[COLORS.accent + '20', COLORS.bg]} style={styles.previewGradient}>
          <Text style={styles.previewTitle}>Aperçu Final</Text>
          <View style={styles.previewContent}>
            {logoUri ? <Image source={{ uri: logoUri }} style={styles.previewLogo} /> : <View style={styles.previewLogoPlaceholder} />}
            <View style={styles.previewInfo}>
              <Text style={styles.previewName}>{values.name || 'Ma Boutique'}</Text>
              <Text style={styles.previewCategory}>
                {values.category ? categories.find(c => c.slug === values.category)?.name : 'Catégorie'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Créer ma boutique</Text>
            <Text style={styles.subtitle}>Étape {currentStep} sur 3</Text>
          </View>
        </View>

        <View style={styles.stepIndicator}>
          {[1, 2, 3].map(s => (
            <View key={s} style={[styles.stepDot, currentStep >= s && styles.stepDotActive]} />
          ))}
        </View>

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        
        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footerButtons}>
        {currentStep > 1 && (
          <Button title="Retour" onPress={() => setCurrentStep(s => s - 1)} variant="outline" style={styles.navButton} />
        )}
        <Button 
          title={currentStep === 3 ? "Lancer ma boutique 🚀" : "Continuer"} 
          onPress={currentStep === 3 ? handleFormSubmit : nextStep}
          variant="primary"
          style={styles.navButton}
          loading={isSubmitting}
          disabled={currentStep === 1 && slugStatus === 'taken'}
        />
      </View>

      {renderProgressOverlay()}
      
      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.categoryModalOverlay}>
          <View style={styles.categoryModal}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Choisir une catégorie</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {loadingCategories ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={COLORS.accent} />
                <Text style={{ marginTop: 10, color: COLORS.textSoft }}>Chargement...</Text>
              </View>
            ) : categories.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="alert-circle-outline" size={48} color={COLORS.textMuted} />
                <Text style={{ marginTop: 10, color: COLORS.textSoft, textAlign: 'center' }}>
                  Aucune catégorie trouvée.
                </Text>
                <TouchableOpacity 
                  style={{ marginTop: 20, padding: 10, backgroundColor: COLORS.accent, borderRadius: 8 }}
                  onPress={loadCategories}
                >
                  <Text style={{ color: '#FFF' }}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={categories}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.categoryItem} onPress={() => {
                    setFieldValue('category', item.slug);
                    setPickerVisible(false);
                  }}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                    <Text style={styles.categoryName}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={countryPickerVisible} transparent animationType="fade">
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalCard}>
            <Text style={styles.pickerModalTitle}>Choisir un pays</Text>
            <FlatList
              data={countries}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.categoryItem} onPress={() => {
                  setFieldValue('country_id', item.id);
                  setCountryPickerVisible(false);
                }}>
                  <Text style={styles.categoryName}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <Button title="Fermer" onPress={() => setCountryPickerVisible(false)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const getStyles = (themeContext: any) => {
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
  content: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingTop: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  imagesContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  logoPicker: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  logoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  logoPickerText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  bannerPicker: {
    flex: 1,
    height: 100,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  bannerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  bannerPickerText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  slugInputContainer: {
    position: 'relative',
    zIndex: 1,
  },
  slugBadge: {
    position: 'absolute',
    right: 16,
    top: 14,
    zIndex: 2,
    height: 24,
    justifyContent: 'center',
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  categorySelectorText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  placeholderText: {
    color: COLORS.textMuted,
  },
  cityDropdown: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: -SPACING.md,
    marginBottom: SPACING.md,
    maxHeight: 200,
    overflow: 'hidden',
    zIndex: 10,
  },
  cityItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cityItemText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  previewCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewGradient: {
    padding: SPACING.lg,
  },
  previewTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  previewLogo: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
  },
  previewLogoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.border,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.textMuted,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  previewCategory: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.xl,
  },
  stepDot: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  stepDotActive: {
    backgroundColor: COLORS.accent,
    width: 40,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  navButton: {
    flex: 1,
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  overlayContent: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  overlayStep: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  overlayProgressBar: {
    width: '100%',
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  overlayProgressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  overlayPercent: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  categoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  categoryModal: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '70%',
    padding: SPACING.lg,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  categoryModalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  categoryName: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  pickerModalCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  pickerModalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
});
};

export default SellerAddStoreScreen;
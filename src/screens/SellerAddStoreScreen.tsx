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
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';

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
    tiktok?: string;
  };
}

const MOCK_CATEGORIES: { id: string; name: string; slug?: string }[] = [
  { id: 'cat-general', name: 'Général', slug: 'general' },
  { id: 'cat-mode', name: 'Mode', slug: 'mode' },
  { id: 'cat-electronique', name: 'Électronique', slug: 'electronique' },
];

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  subcategories?: Category[];
}

export const SellerAddStoreScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const draftSaveTimerRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const defaultFormData: FormData = {
    name: '',
    slug: '',
    description: '',
    category: '',
    email: '',
    phone: '',
    address: '',
    country_id: '',
    city_id: '',
    city_name: '',
    website: '',
    social: {},
  };
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    description: '',
    category: '',
    email: '',
    phone: '',
    address: '',
    country_id: '',
    city_id: '',
    city_name: '',
    website: '',
    social: {},
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [formProgress, setFormProgress] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [showSubcategories, setShowSubcategories] = useState(false);

  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const citySearchTimerRef = useRef<any>(null);

  useEffect(() => {
    const loadDraft = async () => {
      if (!user?.id) return;
      const draft = await storeCreationDraftStorage.get(user.id);
      if (!draft) return;

      if (draft.formData) {
        const incoming = draft.formData as Partial<FormData>;
        setFormData({
          ...defaultFormData,
          ...incoming,
          social: {
            ...(incoming.social || {}),
          },
        });
      }
      if (typeof draft.currentStep === 'number') {
        setCurrentStep(draft.currentStep);
      }
      if (typeof draft.selectedSubcategory === 'string') {
        setSelectedSubcategory(draft.selectedSubcategory);
      }
      const nextLogoUri = draft.logoUri ?? null;
      const nextBannerUri = draft.bannerUri ?? null;
      setLogoUri(Platform.OS === 'web' && nextLogoUri?.startsWith('blob:') ? null : nextLogoUri);
      setBannerUri(Platform.OS === 'web' && nextBannerUri?.startsWith('blob:') ? null : nextBannerUri);
    };
    void loadDraft();
  }, [user?.id]);

  useEffect(() => {
    const saveDraft = async () => {
      if (!user?.id) return;
      await storeCreationDraftStorage.save(user.id, {
        currentStep,
        formData,
        logoUri,
        bannerUri,
        selectedSubcategory,
      });
    };

    if (!user?.id) return;
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = setTimeout(() => {
      void saveDraft();
    }, 250);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [user?.id, currentStep, formData, logoUri, bannerUri, selectedSubcategory]);

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  useEffect(() => {
    loadCategories();
    requestPermissions();
    void loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      setCountriesLoading(true);
      const data = await countryService.getAll();
      setCountries(data);
    } catch (e) {
      console.error('Error loading countries:', e);
      const message = (e as any)?.message || 'Impossible de charger les pays.';
      Alert.alert('Erreur', message);
     } finally {
      setCountriesLoading(false);
    }
  };

  // Calcul de la progression du formulaire
  useEffect(() => {
    let progress = 0;
    const totalFields = 9; // Nombre total de champs importants
    
    if (formData.name) progress += 1;
    if (formData.category) progress += 1;
    if (formData.description && formData.description.length > 20) progress += 1;
    if (formData.email) progress += 1;
    if (formData.phone) progress += 1;
    if (formData.address) progress += 1;
    if (formData.city_id) progress += 1;
    if (logoUri) progress += 1;
    if (bannerUri) progress += 1;
    
    setFormProgress((progress / totalFields) * 100);
  }, [formData, logoUri, bannerUri]);

  // Filtrage des catégories
  useEffect(() => {
    if (searchQuery) {
      const filtered = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.subcategories?.some(sub => sub.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories(categories);
    }
  }, [searchQuery, categories]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin d\'accéder à vos photos pour ajouter un logo.');
      }
    }
  };


  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const data = await categoryService.getAll();
      // Enrichir les catégories avec des couleurs et icônes
      const enrichedData = data.map((cat: any, index: number) => ({
        ...cat,
        icon: getCategoryIcon(cat.name),
        color: getCategoryColor(index),
        subcategories: generateSubcategories(cat.name),
      }));
      setCategories(enrichedData);
      setFilteredCategories(enrichedData);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Erreur', 'Impossible de charger les catégories');
      if (__DEV__) {
        // fallback to mock when offline or error
        const enrichedData = MOCK_CATEGORIES.map((cat: any, index: number) => ({
          ...cat,
          icon: getCategoryIcon(cat.name),
          color: getCategoryColor(index),
          subcategories: generateSubcategories(cat.name),
        }));
        setCategories(enrichedData);
        setFilteredCategories(enrichedData);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryIcon = (categoryName: string): string => {
    const icons: Record<string, string> = {
      'Électronique': 'laptop-outline',
      'Mode': 'shirt-outline',
      'Maison': 'home-outline',
      'Beauté': 'heart-outline',
      'Sport': 'basketball-outline',
      'Alimentaire': 'restaurant-outline',
      'Librairie': 'book-outline',
      'Jouets': 'game-controller-outline',
      'Auto': 'car-outline',
      'Santé': 'fitness-outline',
    };
    return icons[categoryName] || 'storefront-outline';
  };

  const getCategoryColor = (index: number): string => {
    const colors = [
      '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', 
      '#ef4444', '#6366f1', '#d946ef', '#14b8a6', '#f97316'
    ];
    return colors[index % colors.length];
  };

  const generateSubcategories = (category: string): Category[] => {
    const subMap: Record<string, string[]> = {
      'Électronique': ['Téléphones', 'Ordinateurs', 'Accessoires', 'Audio', 'TV & Home Cinéma'],
      'Mode': ['Vêtements femmes', 'Vêtements hommes', 'Chaussures', 'Accessoires', 'Montres'],
      'Maison': ['Mobilier', 'Décoration', 'Linge de maison', 'Cuisine', 'Jardin'],
      'Beauté': ['Maquillage', 'Soins visage', 'Parfums', 'Cheveux', 'Bien-être'],
      'Sport': ['Fitness', 'Sports d\'équipe', 'Running', 'Cyclisme', 'Natation'],
    };
    
    return (subMap[category] || ['Général', 'Premium', 'Standard']).map((name, idx) => ({
      id: `${category.toLowerCase()}-sub-${idx}`,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
    }));
  };

  const pickImage = async (type: 'logo' | 'banner') => {
    try {
      // Request image picker permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Nous avons besoin de l\'accès à votre galerie photo pour ajouter des images.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        if (type === 'logo') {
          setLogoUri(result.assets[0].uri);
        } else {
          setBannerUri(result.assets[0].uri);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image. Veuillez réessayer.');
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-generate slug from name
      if (field === 'name') {
        updated.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }
      
      return updated;
    });
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const updateSocial = (platform: 'facebook' | 'instagram' | 'twitter' | 'tiktok', value: string) => {
    setFormData(prev => ({
      ...prev,
      social: {
        ...prev.social,
        [platform]: value,
      },
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          Alert.alert('Erreur', 'Le nom de la boutique est requis');
          return false;
        }
        if (!formData.category.trim()) {
          Alert.alert('Erreur', 'La catégorie est requise');
          return false;
        }
        return true;
      
      case 2:
        if (!formData.email.trim()) {
          Alert.alert('Erreur', 'L\'email est requis');
          return false;
        }
        if (!formData.phone.trim()) {
          Alert.alert('Erreur', 'Le numéro WhatsApp est requis');
          return false;
        }
        if (!formData.address.trim()) {
          Alert.alert('Erreur', 'L\'adresse est requise');
          return false;
        }
        if (!formData.country_id) {
          Alert.alert('Erreur', 'Le pays est requis');
          return false;
        }
        if (!formData.city_id) {
          Alert.alert('Erreur', 'La ville est requise');
          return false;
        }
        return true;
      
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }

    if (!validateStep(1) || !validateStep(2)) {
      return;
    }

    setIsSubmitting(true);
    try {
      // look for a free/trial plan defined by the admin
      let trialPlanId: string | null = null;
      try {
        const plans = await planService.getAll();
        const trial = plans.find((p: any) => p.price === 0 && p.trial_days && p.status === 'active');
        if (trial) trialPlanId = trial.id;
      } catch (e) {
        console.warn('could not fetch plans, falling back to hardcoded trial', e);
      }

      let uploadedLogoUrl: string | null = null;
      let uploadedBannerUrl: string | null = null;
      try {
        if (logoUri) {
          uploadedLogoUrl = await cloudinaryService.uploadImage(logoUri, { folder: 'libreshop/stores/logo' });
        }
        if (bannerUri) {
          uploadedBannerUrl = await cloudinaryService.uploadImage(bannerUri, { folder: 'libreshop/stores/banner' });
        }
      } catch (e) {
        console.error('cloudinary upload failed', e);
        Alert.alert('Erreur', "Impossible d'uploader les images. Vérifiez Cloudinary.");
        return;
      }

      const whatsappPhone = String(formData.phone || '').replace(/[^\d+]/g, '');
      const createArgs = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        category: formData.category,
        subcategory: selectedSubcategory || undefined,
        email: formData.email,
        phone: whatsappPhone,
        address: formData.address,
        country_id: formData.country_id,
        city_id: formData.city_id,
        website: formData.website,
        social: formData.social,
        logo_url: uploadedLogoUrl,
        banner_url: uploadedBannerUrl,
      };

      let createdStore: any;
      if (trialPlanId) {
        createdStore = await storeService.createWithPlanSlugRetry(user.id, createArgs as any, trialPlanId);
      } else {
        createdStore = await storeService.createWithTrialSlugRetry(user.id, createArgs as any);
      }

      const finalSlug = String(createdStore?.slug || createArgs.slug || '');
      const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
      const storeUrl = finalSlug
        ? webBaseUrl
          ? `${webBaseUrl}/store/${finalSlug}`
          : Linking.createURL(`/store/${finalSlug}`)
        : '';

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Succès 🎉',
        storeUrl
          ? `Votre boutique a été créée et un essai de 7 jours a démarré.\n\nURL: ${storeUrl}`
          : 'Votre boutique a été créée et un essai de 7 jours a démarré. Profitez-en !',
        [
          {
            text: 'Voir mon tableau de bord',
            onPress: () => navigation.replace('SellerTabs' as never),
          },
        ]
      );

      await storeCreationDraftStorage.clear(user.id);
    } catch (error) {
      console.error('Error creating store:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        (error as any)?.message ||
        (typeof error === 'string' ? error : '') ||
        'Impossible de créer la boutique. Veuillez réessayer.';
      const code = (error as any)?.code ? `\nCode: ${(error as any).code}` : '';
      Alert.alert('Erreur', `${message}${code}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepItem}>
          <View style={[
            styles.stepCircle,
            currentStep >= step && styles.stepCircleActive,
            currentStep > step && styles.stepCircleCompleted,
          ]}>
            {currentStep > step ? (
              <Ionicons name="checkmark" size={16} color="white" />
            ) : (
              <Text style={[
                styles.stepNumber,
                currentStep >= step && styles.stepNumberActive,
              ]}>{step}</Text>
            )}
          </View>
          {step < 3 && (
            <View style={[
              styles.stepLine,
              currentStep > step && styles.stepLineActive,
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Logo et bannière</Text>
        <View style={styles.imagesContainer}>
          <TouchableOpacity
            style={styles.logoPicker}
            onPress={() => pickImage('logo')}
          >
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="camera" size={32} color={COLORS.accent} />
                <Text style={styles.logoPickerText}>Logo</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bannerPicker}
            onPress={() => pickImage('banner')}
          >
            {bannerUri ? (
              <Image source={{ uri: bannerUri }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerPlaceholder}>
                <Ionicons name="image-outline" size={32} color={COLORS.accent} />
                <Text style={styles.bannerPickerText}>Bannière</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations générales</Text>
        
        <View style={styles.inputContainer}>
          <Ionicons name="storefront-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nom de la boutique"
            placeholderTextColor={COLORS.textMuted}
            value={formData.name}
            onChangeText={(value) => updateField('name', value)}
          />
          {formData.name.length > 0 && (
            <Text style={styles.charCount}>{formData.name.length}/50</Text>
          )}
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="link-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Slug (URL)"
            value={formData.slug}
            onChangeText={(value) => updateField('slug', value)}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.categoryContainer}>
          <TouchableOpacity
            style={styles.categorySelector}
            onPress={() => setPickerVisible(!pickerVisible)}
          >
            <Ionicons name="pricetag-outline" size={20} color={COLORS.textMuted} />
            <Text style={[
              styles.categorySelectorText,
              !formData.category && styles.placeholderText
            ]}>
              {formData.category
                ? categories.find(c => c.slug === formData.category)?.name || 'Choisir une catégorie'
                : 'Sélectionnez une catégorie'}
            </Text>
            <Ionicons 
              name={pickerVisible ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={COLORS.textMuted} 
            />
          </TouchableOpacity>
        </View>

        {/* Category Modal */}
        <Modal
          visible={pickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={styles.categoryModalOverlay}>
            <View style={styles.categoryModal}>
              {/* Header */}
              <View style={styles.categoryModalHeader}>
                <Text style={styles.categoryModalTitle}>Sélectionnez une catégorie</Text>
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher une catégorie..."
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Categories List */}
              <FlatList
                data={filteredCategories}
                keyExtractor={(item) => item.id}
                renderItem={({ item: cat }) => (
                  <View>
                    <TouchableOpacity
                      style={[
                        styles.categoryItem,
                        formData.category === cat.slug && styles.categoryItemSelected,
                      ]}
                      onPress={() => {
                        updateField('category', cat.slug);
                        setShowSubcategories(true);
                      }}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                        <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                      </View>
                      <Text style={styles.categoryName}>{cat.name}</Text>
                      {cat.subcategories && cat.subcategories.length > 0 && (
                        <Ionicons 
                          name="chevron-forward" 
                          size={18} 
                          color={COLORS.textMuted} 
                        />
                      )}
                    </TouchableOpacity>

                    {showSubcategories && formData.category === cat.slug && cat.subcategories && (
                      <View style={styles.subcategoryList}>
                        {cat.subcategories.map((sub) => (
                          <TouchableOpacity
                            key={sub.id}
                            style={[
                              styles.subcategoryItem,
                              selectedSubcategory === sub.slug && styles.subcategoryItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedSubcategory(sub.slug);
                              setPickerVisible(false);
                              setShowSubcategories(false);
                            }}
                          >
                            <Text style={styles.subcategoryName}>{sub.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
                ListEmptyComponent={
                  isLoading ? (
                    <ActivityIndicator size="large" color={COLORS.accent} style={styles.loader} />
                  ) : (
                    <Text style={styles.emptyText}>Aucune catégorie trouvée</Text>
                  )
                }
              />
            </View>
          </View>
        </Modal>

        <View style={[styles.inputContainer, styles.textAreaContainer]}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description de votre boutique..."
            placeholderTextColor={COLORS.textMuted}
            value={formData.description}
            onChangeText={(value) => updateField('description', value)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coordonnées</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email de contact"
            placeholderTextColor={COLORS.textMuted}
            value={formData.email}
            onChangeText={(value) => updateField('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Numéro WhatsApp (ex: +22501020304)"
            placeholderTextColor={COLORS.textMuted}
            value={formData.phone}
            onChangeText={(value) => updateField('phone', value)}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="location-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Adresse"
            placeholderTextColor={COLORS.textMuted}
            value={formData.address}
            onChangeText={(value) => updateField('address', value)}
          />
        </View>

        <View style={styles.fieldGroup}>
          <TouchableOpacity
            style={[styles.categorySelector, styles.countrySelector]}
            onPress={() => setCountryPickerVisible(!countryPickerVisible)}
          >
            <Ionicons name="flag-outline" size={20} color={COLORS.textMuted} />
            <Text
              style={[
                styles.categorySelectorText,
                !formData.country_id && styles.placeholderText,
              ]}
            >
              {formData.country_id
                ? countries.find((c) => c.id === formData.country_id)?.name || 'Choisir un pays'
                : 'Sélectionnez un pays'}
            </Text>
            <Ionicons
              name={countryPickerVisible ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <Modal
            visible={countryPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setCountryPickerVisible(false)}
          >
            <TouchableOpacity
              style={styles.pickerModalOverlay}
              activeOpacity={1}
              onPress={() => setCountryPickerVisible(false)}
            >
              <TouchableOpacity style={styles.pickerModalCard} activeOpacity={1}>
                <View style={styles.pickerModalHeader}>
                  <Text style={styles.pickerModalTitle}>Choisir un pays</Text>
                  <TouchableOpacity onPress={() => setCountryPickerVisible(false)}>
                    <Ionicons name="close" size={22} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
                  {countriesLoading ? (
                    <View style={styles.loader}>
                      <ActivityIndicator size="large" color={COLORS.accent} />
                    </View>
                  ) : countries.length === 0 ? (
                    <View style={styles.loader}>
                      <Text style={styles.emptyCountriesText}>Aucun pays disponible</Text>
                    </View>
                  ) : (
                    countries.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.categoryItem,
                          formData.country_id === c.id && styles.categoryItemSelected,
                        ]}
                        onPress={() => {
                          updateField('country_id', c.id);
                          updateField('city_id', '');
                          updateField('city_name', '');
                          setCityQuery('');
                          setCityResults([]);
                          setCountryPickerVisible(false);
                        }}
                      >
                        <View style={[styles.categoryIcon, { backgroundColor: COLORS.accent + '20' }]}>
                          <Ionicons name="flag" size={20} color={COLORS.accent} />
                        </View>
                        <Text style={styles.categoryName}>{c.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.inputContainer}>
            <Ionicons name="business-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={formData.country_id ? 'Ville (rechercher...)' : 'Choisissez un pays d\'abord'}
              placeholderTextColor={COLORS.textMuted}
              value={cityQuery || formData.city_name}
              onChangeText={(value) => {
                const v = String(value);
                setCityQuery(v);
                updateField('city_name', v);
                updateField('city_id', '');

                if (citySearchTimerRef.current) {
                  clearTimeout(citySearchTimerRef.current);
                }

                if (!formData.country_id) {
                  setCityResults([]);
                  return;
                }

                citySearchTimerRef.current = setTimeout(async () => {
                  try {
                    setCityLoading(true);
                    const res = await cityService.searchByCountry(formData.country_id, v, 20);
                    setCityResults(res);
                  } catch (e) {
                    console.error('city search failed', e);
                    setCityResults([]);
                  } finally {
                    setCityLoading(false);
                  }
                }, 250);
              }}
              editable={Boolean(formData.country_id)}
            />
            {cityLoading && (
              <ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 12 }} />
            )}
          </View>

          {!!formData.country_id && cityResults.length > 0 && !formData.city_id && (
            <View style={styles.cityDropdown}>
              <ScrollView style={styles.cityList} nestedScrollEnabled>
                {cityResults.map((city) => (
                  <TouchableOpacity
                    key={city.id}
                    style={styles.cityItem}
                    onPress={() => {
                      updateField('city_id', city.id);
                      updateField('city_name', city.name);
                      setCityQuery('');
                      setCityResults([]);
                    }}
                  >
                    <Text style={styles.cityItemText}>{city.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="globe-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Site web (optionnel)"
            placeholderTextColor={COLORS.textMuted}
            value={formData.website}
            onChangeText={(value) => updateField('website', value)}
            autoCapitalize="none"
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Réseaux sociaux (optionnel)</Text>
        <View style={styles.socialInput}>
          <View style={[styles.socialIcon, { backgroundColor: '#1877f2' }]}>
            <Ionicons name="logo-facebook" size={20} color="white" />
          </View>
          <TextInput
            style={styles.socialTextField}
            placeholder="Facebook"
            placeholderTextColor={COLORS.textMuted}
            value={formData.social?.facebook || ''}
            onChangeText={(value) => updateSocial('facebook', value)}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.socialInput}>
          <View style={[styles.socialIcon, { backgroundColor: '#e4405f' }]}>
            <Ionicons name="logo-instagram" size={20} color="white" />
          </View>
          <TextInput
            style={styles.socialTextField}
            placeholder="Instagram"
            placeholderTextColor={COLORS.textMuted}
            value={formData.social?.instagram || ''}
            onChangeText={(value) => updateSocial('instagram', value)}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.socialInput}>
          <View style={[styles.socialIcon, { backgroundColor: '#1da1f2' }]}>{/* Twitter blue */}
            <Ionicons name="logo-twitter" size={20} color="white" />
          </View>
          <TextInput
            style={styles.socialTextField}
            placeholder="Twitter"
            placeholderTextColor={COLORS.textMuted}
            value={formData.social?.twitter || ''}
            onChangeText={(value) => updateSocial('twitter', value)}
            autoCapitalize="none"
          />
        </View>
        {/* TikTok input */}
        <View style={styles.socialInput}>
          <View style={[styles.socialIcon, { backgroundColor: '#000' }]}>{/* TikTok black */}
            <Ionicons name="logo-tiktok" size={20} color="white" />
          </View>
          <TextInput
            style={styles.socialTextField}
            placeholder="TikTok"
            placeholderTextColor={COLORS.textMuted}
            value={formData.social?.tiktok || ''}
            onChangeText={(value) => updateSocial('tiktok', value)}
            autoCapitalize="none"
          />
        </View>
      </View>
      <View style={styles.previewCard}>
        <LinearGradient
          colors={[COLORS.accent + '20', COLORS.bg]}
          style={styles.previewGradient}
        >
          <Text style={styles.previewTitle}>Aperçu de votre boutique</Text>
          {bannerUri && (
            <Image source={{ uri: bannerUri }} style={styles.previewBanner} />
          )}
          <View style={styles.previewContent}>
            {logoUri && (
              <Image source={{ uri: logoUri }} style={styles.previewLogo} />
            )}
            <View style={styles.previewInfo}>
              <Text style={styles.previewName}>{formData.name || 'Nom de la boutique'}</Text>
              <Text style={styles.previewCategory}>
                {categories.find(c => c.slug === formData.category)?.name || 'Catégorie'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 20}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header avec progression */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Créer ma boutique</Text>
            <Text style={styles.subtitle}>Étape {currentStep} sur 3</Text>
          </View>
        </View>

        {/* Barre de progression */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${formProgress}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(formProgress)}% complété</Text>
        </View>

        {renderStepIndicator()}

        {/* Contenu selon l'étape */}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}

      </ScrollView>

      {/* boutons de navigation fixes en bas */}
      <View style={styles.footerButtons}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={[styles.navButton, styles.prevButton]}
            onPress={prevStep}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            <Text style={styles.prevButtonText}>Précédent</Text>
          </TouchableOpacity>
        )}

        {currentStep < 3 ? (
          <TouchableOpacity
            style={[styles.navButton, styles.nextButton]}
            onPress={nextStep}
          >
            <Text style={styles.nextButtonText}>Suivant</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={styles.submitButtonText}>Créer la boutique</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Message d'information */}
      <BlurView intensity={80} tint="light" style={styles.infoBox}>
        <Ionicons name="information-circle" size={24} color={COLORS.accent} />
        <Text style={styles.infoText}>
          Votre boutique sera soumise à validation par notre équipe. 
          Vous recevrez une notification dès qu'elle sera approuvée.
        </Text>
      </BlurView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl + SPACING.xl, // extra space for footer
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
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
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  progressContainer: {
    marginBottom: SPACING.lg,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
  },
  progressText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: 'right',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  stepCircleCompleted: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  stepNumber: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  stepNumberActive: {
    color: COLORS.white,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.xs,
  },
  stepLineActive: {
    backgroundColor: COLORS.success,
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
    gap: SPACING.xs,
  },
  logoPickerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
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
    gap: SPACING.xs,
  },
  bannerPickerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  charCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    minHeight: 100,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    marginBottom: SPACING.md,
    position: 'relative',
    zIndex: 1000,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  categorySelectorText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  fieldGroup: {
    marginBottom: SPACING.md,
    position: 'relative',
    zIndex: 999,
  },
  countrySelector: {
    marginBottom: 0,
  },
  cityDropdown: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.xs,
    maxHeight: 240,
    overflow: 'hidden',
  },
  cityList: {
    maxHeight: 240,
  },
  cityItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cityItemText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  placeholderText: {
    color: COLORS.textMuted,
  },
  emptyCountriesText: {
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  pickerModalCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerModalTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  categoryDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.xs,
    maxHeight: 400,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(0,0,0,0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
    zIndex: 1001,
  },
  categoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingTop: SPACING.xl,
    justifyContent: 'flex-end',
  },
  categoryModal: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    height: '85%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryModalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  categoryList: {
    maxHeight: 320,
    overflow: 'scroll',
  },
  loader: {
    padding: SPACING.lg,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    padding: SPACING.lg,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  categoryItemSelected: {
    backgroundColor: COLORS.accent + '10',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  subcategoryList: {
    backgroundColor: COLORS.bg,
    paddingLeft: SPACING.xl,
  },
  subcategoryItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  subcategoryItemSelected: {
    backgroundColor: COLORS.accent + '20',
  },
  subcategoryName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  socialInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  socialIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialTextField: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  previewCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginTop: SPACING.md,
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
  previewBanner: {
    width: '100%',
    height: 100,
    borderRadius: RADIUS.md,
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
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  previewCategory: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginVertical: SPACING.xl,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  prevButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  prevButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  nextButton: {
    backgroundColor: COLORS.accent,
  },
  nextButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  submitButton: {
    backgroundColor: COLORS.success,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent + '10',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    overflow: 'hidden',
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    lineHeight: 20,
  },
});

export default SellerAddStoreScreen;
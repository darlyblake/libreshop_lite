import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';

const { width, height } = Dimensions.get('window');

// Catégories avec couleurs et icônes
const CATEGORIES = [
  { id: '1', name: 'Électronique', icon: 'laptop-outline', color: '#3b82f6', count: 24 },
  { id: '2', name: 'Mode', icon: 'shirt-outline', color: '#ec4899', count: 18 },
  { id: '3', name: 'Maison', icon: 'home-outline', color: '#10b981', count: 15 },
  { id: '4', name: 'Beauté', icon: 'heart-outline', color: '#f43f5e', count: 12 },
  { id: '5', name: 'Sport', icon: 'basketball-outline', color: '#f97316', count: 9 },
  { id: '6', name: 'Livres', icon: 'book-outline', color: '#8b5cf6', count: 7 },
];

// Icônes organisées par catégories
const ICON_CATEGORIES = [
  {
    name: 'Commerce',
    icons: ['storefront-outline', 'cart-outline', 'bag-outline', 'cash-outline', 'card-outline', 'pricetag-outline', 'pricetags-outline'],
  },
  {
    name: 'Technologie',
    icons: ['phone-portrait-outline', 'laptop-outline', 'tablet-portrait-outline', 'watch-outline', 'camera-outline', 'headset-outline', 'game-controller-outline'],
  },
  {
    name: 'Mode & Beauté',
    icons: ['shirt-outline', 'heart-outline', 'flower-outline', 'diamond-outline', 'eyedrop-outline', 'brush-outline'],
  },
  {
    name: 'Maison & Jardin',
    icons: ['home-outline', 'leaf-outline', 'flower-outline', 'water-outline', 'bonfire-outline'],
  },
  {
    name: 'Alimentation',
    icons: ['restaurant-outline', 'pizza-outline', 'fast-food-outline', 'cafe-outline', 'wine-outline', 'basket-outline'],
  },
  {
    name: 'Divers',
    icons: ['apps-outline', 'archive-outline', 'folder-outline', 'layers-outline', 'albums-outline', 'copy-outline'],
  },
];

export interface NewCollectionData {
  parentCategoryId?: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  coverColor?: string;
  isActive?: boolean;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
}

interface AddCollectionModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: NewCollectionData) => void;
  editData?: NewCollectionData; // Pour le mode édition
  categories?: { id: string; name: string; icon?: keyof typeof Ionicons.glyphMap; color?: string; count?: number }[];
}

const AddCollectionModal: React.FC<AddCollectionModalProps> = ({
  visible,
  onClose,
  onAdd,
  editData,
  categories,
}) => {
  const { component, isDesktop } = useResponsive();
  const [form, setForm] = useState<NewCollectionData>({
    parentCategoryId: '',
    name: '',
    description: '',
    icon: 'folder-outline' as any,
    coverColor: COLORS.accent,
    isActive: true,
    priority: 'medium',
    tags: [],
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [searchIcon, setSearchIcon] = useState('');
  const [selectedIconCategory, setSelectedIconCategory] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animation d'entrée
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: false,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
      
      if (editData) {
        setForm(editData);
      }
    } else {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const resetForm = () => {
    setForm({
      parentCategoryId: '',
      name: '',
      description: '',
      icon: 'folder-outline' as any,
      coverColor: COLORS.accent,
      isActive: true,
      priority: 'medium',
      tags: [],
    });
    setCurrentStep(1);
    setSearchIcon('');
    setTagInput('');
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    // Validation étape par étape
    if (currentStep === 1) {
      if (!form.parentCategoryId) {
        Alert.alert('Erreur', 'Veuillez sélectionner une catégorie parente');
        return;
      }
      setCurrentStep(2);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (currentStep === 2) {
      if (!form.name.trim()) {
        Alert.alert('Erreur', 'Le nom de la collection est requis');
        return;
      }
      if (form.name.length < 3) {
        Alert.alert('Erreur', 'Le nom doit contenir au moins 3 caractères');
        return;
      }
      setCurrentStep(3);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    // Soumission finale
    if (!form.parentCategoryId || !form.name.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdd(form);
    resetForm();
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags?.includes(tagInput.trim())) {
      setForm({
        ...form,
        tags: [...(form.tags || []), tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setForm({
      ...form,
      tags: form.tags?.filter(tag => tag !== tagToRemove),
    });
  };

  const getStepIcon = (step: number) => {
    if (step < currentStep) return 'checkmark-circle';
    if (step === currentStep) return 'ellipse';
    return 'ellipse-outline';
  };

  const getStepColor = (step: number) => {
    if (step < currentStep) return COLORS.success;
    if (step === currentStep) return COLORS.accent;
    return COLORS.textMuted;
  };

  // Filtrage des icônes
  const filteredIcons = ICON_CATEGORIES.flatMap(cat => cat.icons)
    .filter(icon => icon.toLowerCase().includes(searchIcon.toLowerCase()));

  const availableCategories = (categories && categories.length > 0 ? categories : CATEGORIES) as typeof CATEGORIES;

  // libellé de sous-titre suivant l'étape (évite plusieurs enfants Text)
  const subtitle = currentStep === 1
    ? 'Choisissez une catégorie parente'
    : currentStep === 2
    ? 'Informations générales'
    : 'Personnalisation';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <BlurView 
        intensity={Platform.OS === 'ios' ? 80 : 100} 
        tint="dark"
        style={styles.modalOverlay}
      >
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [
                {
                  scale: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[COLORS.card, COLORS.bg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.modalContent, { maxWidth: isDesktop ? 700 : 450 }]}
          >
            {/* Header avec progression */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editData ? 'Modifier la collection' : 'Nouvelle collection'}
                </Text>
                <Text style={styles.modalSubtitle}>{subtitle}</Text>
              </View>
              
              <View style={styles.stepIndicator}>
                {[1, 2, 3].map(step => (
                  <View key={step} style={styles.stepItem}>
                    <Ionicons
                      name={getStepIcon(step)}
                      size={20}
                      color={getStepColor(step)}
                    />
                    {step < 3 && (
                      <View style={[
                        styles.stepLine,
                        { backgroundColor: step < currentStep ? COLORS.success : COLORS.border }
                      ]} />
                    )}
                  </View>
                ))}
              </View>
            </View>

            <ScrollView 
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {/* Étape 1: Catégorie parente */}
              {currentStep === 1 && (
                <Animated.View entering={fadeAnim}>
                  <Text style={styles.sectionTitle}>Sélectionnez une catégorie</Text>
                  
                  <View style={styles.categoriesGrid}>
                    {availableCategories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryCard,
                          form.parentCategoryId === cat.id && styles.categoryCardSelected,
                          (() => {
                            const catColor = (cat as any).color || COLORS.accent;
                            return {
                              backgroundColor: catColor + '15',
                              borderColor: form.parentCategoryId === cat.id ? catColor : COLORS.border,
                            };
                          })(),
                        ]}
                        onPress={() => {
                          setForm({ ...form, parentCategoryId: cat.id });
                          Haptics.selectionAsync();
                        }}
                      >
                      <View
                        style={[
                          styles.categoryIcon,
                          { backgroundColor: (cat as any).color || COLORS.accent },
                        ]}
                      >
                        <Ionicons name={(cat as any).icon || ('folder-outline' as any)} size={24} color={COLORS.white} />
                      </View>
                      <Text style={styles.categoryName}>{cat.name}</Text>
                      {(cat as any).count !== undefined ? (
                        <Text style={styles.categoryCount}>{(cat as any).count} collections</Text>
                      ) : null}
                      {form.parentCategoryId === cat.id && (
                        <View style={[styles.categoryCheck, { backgroundColor: (cat as any).color || COLORS.accent }]}> 
                          <Ionicons name="checkmark" size={12} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                  </View>
                </Animated.View>
              )}

              {/* Étape 2: Informations générales */}
              {currentStep === 2 && (
                <Animated.View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Nom de la collection <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="folder-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Ex: Nouveautés Été 2024"
                        placeholderTextColor={COLORS.textMuted}
                        value={form.name}
                        onChangeText={(text) => setForm({ ...form, name: text })}
                        maxLength={50}
                      />
                      {form.name.length > 0 && (
                        <Text style={styles.charCount}>{form.name.length}/50</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description</Text>
                    <View style={[styles.inputContainer, styles.textAreaContainer]}>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Décrivez le contenu de cette collection..."
                        placeholderTextColor={COLORS.textMuted}
                        value={form.description}
                        onChangeText={(text) => setForm({ ...form, description: text })}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Priorité</Text>
                    <View style={styles.priorityContainer}>
                      {['low', 'medium', 'high'].map((priority) => (
                        <TouchableOpacity
                          key={priority}
                          style={[
                            styles.priorityOption,
                            form.priority === priority && styles.priorityOptionSelected,
                            { borderColor: priority === 'high' ? COLORS.danger : 
                                         priority === 'medium' ? COLORS.warning : COLORS.info }
                          ]}
                          onPress={() => setForm({ ...form, priority: priority as any })}
                        >
                          <Ionicons 
                            name={priority === 'high' ? 'alert-circle' : 
                                 priority === 'medium' ? 'time' : 'arrow-down'} 
                            size={16} 
                            color={form.priority === priority ? 'white' : 
                                   priority === 'high' ? COLORS.danger : 
                                   priority === 'medium' ? COLORS.warning : COLORS.info} 
                          />
                          <Text style={[
                            styles.priorityText,
                            form.priority === priority && styles.priorityTextSelected
                          ]}>
                            {priority === 'high' ? 'Haute' : 
                             priority === 'medium' ? 'Moyenne' : 'Basse'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Étape 3: Personnalisation */}
              {currentStep === 3 && (
                <Animated.View>
                  {/* Tags */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Tags (optionnel)</Text>
                    <View style={styles.tagInputContainer}>
                      <TextInput
                        style={styles.tagInput}
                        placeholder="Ajouter un tag..."
                        placeholderTextColor={COLORS.textMuted}
                        value={tagInput}
                        onChangeText={setTagInput}
                        onSubmitEditing={addTag}
                      />
                      <TouchableOpacity 
                        style={styles.addTagButton}
                        onPress={addTag}
                      >
                        <Ionicons name="add" size={20} color="white" />
                      </TouchableOpacity>
                    </View>
                    
                    {form.tags && form.tags.length > 0 && (
                      <View style={styles.tagsContainer}>
                        {form.tags.map((tag, index) => (
                          <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                            <TouchableOpacity onPress={() => removeTag(tag)}>
                              <Ionicons name="close" size={14} color={COLORS.textMuted} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Sélecteur d'icônes avec recherche */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Icône</Text>
                    
                    {/* Barre de recherche d'icônes */}
                    <View style={styles.searchContainer}>
                      <Ionicons name="search" size={18} color={COLORS.textMuted} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher une icône..."
                        placeholderTextColor={COLORS.textMuted}
                        value={searchIcon}
                        onChangeText={setSearchIcon}
                      />
                    </View>

                    {/* Catégories d'icônes */}
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.iconCategories}
                    >
                      {ICON_CATEGORIES.map((cat, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.iconCategoryChip,
                            selectedIconCategory === index && styles.iconCategoryChipSelected
                          ]}
                          onPress={() => setSelectedIconCategory(index)}
                        >
                          <Text style={[
                            styles.iconCategoryText,
                            selectedIconCategory === index && styles.iconCategoryTextSelected
                          ]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Grille d'icônes */}
                    <ScrollView 
                      style={styles.iconSelector}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={true}
                    >
                      <View style={styles.iconGrid}>
                        {(searchIcon ? filteredIcons : ICON_CATEGORIES[selectedIconCategory].icons).map((icon) => (
                          <TouchableOpacity
                            key={icon}
                            style={[
                              styles.iconOption,
                              form.icon === icon && styles.iconOptionSelected,
                            ]}
                            onPress={() => {
                              setForm({ ...form, icon: icon as any });
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                          >
                            <Ionicons
                              name={icon as any}
                              size={24}
                              color={form.icon === icon ? COLORS.white : COLORS.text}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Couleur de couverture */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Couleur de couverture</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {[COLORS.accent, '#3b82f6', '#ec4899', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#f59e0b'].map(color => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.colorOption,
                            { backgroundColor: color },
                            form.coverColor === color && styles.colorOptionSelected
                          ]}
                          onPress={() => setForm({ ...form, coverColor: color })}
                        >
                          {form.coverColor === color && (
                            <Ionicons name="checkmark" size={16} color="white" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Statut actif */}
                  <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>Collection active</Text>
                    <TouchableOpacity
                      style={[
                        styles.switch,
                        form.isActive ? styles.switchActive : styles.switchInactive
                      ]}
                      onPress={() => setForm({ ...form, isActive: !form.isActive })}
                    >
                      <Animated.View style={[
                        styles.switchThumb,
                        { transform: [{ translateX: form.isActive ? 20 : 0 }] }
                      ]} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              {currentStep > 1 && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.backButton]}
                  onPress={() => {
                    setCurrentStep(currentStep - 1);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons name="arrow-back" size={18} color={COLORS.text} />
                  <Text style={styles.backButtonText}>Retour</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  currentStep === 3 ? styles.confirmButton : styles.nextButton,
                  currentStep === 1 && { flex: 2 }
                ]}
                onPress={handleSubmit}
              >
                <Text style={currentStep === 3 ? styles.confirmButtonText : styles.nextButtonText}>
                  {currentStep === 3 ? (editData ? 'Mettre à jour' : 'Créer') : 'Suivant'}
                </Text>
                {currentStep < 3 && (
                  <Ionicons name="arrow-forward" size={18} color="white" />
                )}
              </TouchableOpacity>
            </View>

            {/* Bouton fermer */}
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalContainer: {
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    elevation: 10,           // keep for Android
    boxShadow: '0 10px 20px rgba(0,0,0,0.3)', // use cross-platform web-friendly shadow
    // deprecated shadow* props removed; boxShadow handles layout on web
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepLine: {
    width: 30,
    height: 2,
    marginHorizontal: 4,
  },
  modalBody: {
    padding: SPACING.lg,
    maxHeight: height * 0.6,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  categoryCardSelected: {
    backgroundColor: COLORS.card,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  categoryCheck: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  required: {
    color: COLORS.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    paddingVertical: 0,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  priorityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.xs,
    backgroundColor: COLORS.bg,
  },
  priorityOptionSelected: {
    backgroundColor: COLORS.accent,
  },
  priorityText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
  },
  priorityTextSelected: {
    color: COLORS.white,
  },
  tagInputContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  tagInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addTagButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  tagText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  iconCategories: {
    flexGrow: 0,
    marginBottom: SPACING.sm,
  },
  iconCategoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconCategoryChipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  iconCategoryText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  iconCategoryTextSelected: {
    color: COLORS.white,
  },
  iconSelector: {
    maxHeight: 200,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconOptionSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderColor: COLORS.white,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  switchLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  switchActive: {
    backgroundColor: COLORS.success,
  },
  switchInactive: {
    backgroundColor: COLORS.border,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  backButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonText: {
    color: COLORS.text,
    fontWeight: '500',
    fontSize: FONT_SIZE.sm,
  },
  nextButton: {
    backgroundColor: COLORS.accent,
  },
  nextButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.sm,
  },
  confirmButton: {
    backgroundColor: COLORS.success,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.sm,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    zIndex: 10,
  },
});

export default AddCollectionModal;
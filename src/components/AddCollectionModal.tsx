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
import { useThemeContext } from '../context/ThemeContext';
import { useResponsive } from '../utils/useResponsive';
import { type Category } from '../lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Icônes de collection par défaut
const ICON_CATEGORIES = [
  {
    name: 'Commerce',
    icons: ['storefront-outline', 'cart-outline', 'bag-outline', 'cash-outline', 'card-outline', 'pricetag-outline', 'pricetags-outline'],
  },
  {
    name: 'Technologie',
    icons: ['phone-portrait-outline', 'laptop-outline', 'watch-outline', 'camera-outline', 'headset-outline', 'game-controller-outline'],
  },
  {
    name: 'Mode & Beauté',
    icons: ['shirt-outline', 'heart-outline', 'flower-outline', 'diamond-outline', 'eyedrop-outline', 'brush-outline'],
  },
  {
    name: 'Alimentation',
    icons: ['restaurant-outline', 'pizza-outline', 'fast-food-outline', 'cafe-outline', 'wine-outline', 'basket-outline'],
  },
  {
    name: 'Divers',
    icons: ['apps-outline', 'archive-outline', 'folder-outline', 'layers-outline', 'albums-outline'],
  },
];

export interface NewCollectionData {
  parentCategoryId?: string;
  subCategoryId?: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  coverColor?: string;
  isActive?: boolean;
  customAttributes?: any[];
}

interface AddCollectionModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: NewCollectionData) => void;
  onEdit?: (data: NewCollectionData) => void;
  editData?: NewCollectionData;
  categories?: Category[];
  storeType?: string;
}

export const AddCollectionModal: React.FC<AddCollectionModalProps> = ({
  visible,
  onClose,
  onAdd,
  categories = [],
  storeType = 'general',
}) => {
  const theme = useThemeContext();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { isTablet, isDesktop, spacing, fontSize } = useResponsive();

  const [form, setForm] = useState<NewCollectionData>({
    parentCategoryId: '',
    subCategoryId: '',
    name: '',
    description: '',
    icon: 'folder-outline' as any,
    coverColor: theme.getColor.primary,
    isActive: true,
    customAttributes: [],
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [searchIcon, setSearchIcon] = useState('');
  const [selectedIconCategory, setSelectedIconCategory] = useState(0);

  // États pour le générateur d'attributs personnalisés
  const [showAddCustomAttr, setShowAddCustomAttr] = useState(false);
  const [newAttrLabel, setNewAttrLabel] = useState('');
  const [newAttrType, setNewAttrType] = useState<'text' | 'number' | 'select' | 'switch'>('text');
  const [newAttrOptions, setNewAttrOptions] = useState('');
  const [newAttrRequired, setNewAttrRequired] = useState(false);

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
    } else {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const resetForm = () => {
    setForm({
      parentCategoryId: '',
      subCategoryId: '',
      name: '',
      description: '',
      icon: 'folder-outline' as any,
      coverColor: theme.getColor.primary,
      isActive: true,
      customAttributes: [],
    });
    setCurrentStep(1);
    setSearchIcon('');
    setShowAddCustomAttr(false);
    setNewAttrLabel('');
    setNewAttrType('text');
    setNewAttrOptions('');
    setNewAttrRequired(false);
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetForm();
    onClose();
  };

  // Filtrage des catégories principales par storeType
  const filteredMainCategories = categories.filter(
    (c) => !c.parent_id && (c.store_type === storeType || (!c.store_type && storeType === 'general'))
  );

  // Filtrage des sous-catégories
  const filteredSubCategories = categories.filter(
    (c) => c.parent_id === form.parentCategoryId
  );

  // Récupération de la sous-catégorie sélectionnée
  const selectedSubCategory = categories.find((c) => c.id === form.subCategoryId);
  const defaultAttributes = React.useMemo(() => {
    if (!selectedSubCategory) return [];

    // Attributs de la catégorie parente (hérités)
    let parentAttrs: any[] = [];
    if (selectedSubCategory.parent_id) {
      const parentCategory = categories.find((c) => c.id === selectedSubCategory.parent_id);
      if (parentCategory?.attribute_schema) {
        parentAttrs = (parentCategory.attribute_schema || []).map((attr: any) => ({
          ...attr,
          isInherited: true,
          parentName: parentCategory.name,
        }));
      }
    }

    // Attributs de la sous-catégorie
    const subAttrs = (selectedSubCategory.attribute_schema || []).map((attr: any) => ({
      ...attr,
      isInherited: false,
    }));

    return [...parentAttrs, ...subAttrs];
  }, [selectedSubCategory, categories]);

  const handleNext = () => {
    if (currentStep === 1) {
      if (!form.parentCategoryId) {
        Alert.alert('Champs requis', 'Veuillez sélectionner une catégorie principale.');
        return;
      }
      setCurrentStep(2);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (currentStep === 2) {
      if (!form.subCategoryId) {
        Alert.alert('Champs requis', 'Veuillez sélectionner une sous-catégorie.');
        return;
      }
      setCurrentStep(3);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      Alert.alert('Champs requis', 'Le nom de la collection est obligatoire.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // On transmet le subCategoryId comme parentCategoryId pour que la collection pointe vers la sous-catégorie en base de données
    onAdd({
      ...form,
      parentCategoryId: form.subCategoryId,
    });
    resetForm();
    onClose();
  };

  // Ajouter un attribut personnalisé
  const handleAddCustomAttribute = () => {
    if (!newAttrLabel.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un libellé pour ce champ.');
      return;
    }

    const optionsArray = newAttrOptions
      ? newAttrOptions.split(',').map((o) => o.trim()).filter((o) => o.length > 0)
      : undefined;

    const newAttr = {
      name: newAttrLabel.toLowerCase().trim().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      label: newAttrLabel.trim(),
      type: newAttrType,
      options: optionsArray,
      required: newAttrRequired,
      isCustom: true, // Tag pour le différencier
    };

    setForm({
      ...form,
      customAttributes: [...(form.customAttributes || []), newAttr],
    });

    // Reset inputs
    setNewAttrLabel('');
    setNewAttrType('text');
    setNewAttrOptions('');
    setNewAttrRequired(false);
    setShowAddCustomAttr(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Supprimer un attribut personnalisé
  const handleRemoveCustomAttribute = (index: number) => {
    const updated = (form.customAttributes || []).filter((_, i) => i !== index);
    setForm({ ...form, customAttributes: updated });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const getStepIcon = (step: number) => {
    if (step < currentStep) return 'checkmark-circle';
    if (step === currentStep) return 'ellipse';
    return 'ellipse-outline';
  };

  const getStepColor = (step: number) => {
    if (step < currentStep) return theme.getColor.success;
    if (step === currentStep) return theme.getColor.accent;
    return theme.getColor.textTertiary;
  };

  const filteredIcons = Array.from(new Set(ICON_CATEGORIES.flatMap((cat) => cat.icons))).filter(
    (icon) => icon.toLowerCase().includes(searchIcon.toLowerCase())
  );

  const getStepSubtitle = () => {
    switch (currentStep) {
      case 1:
        return 'Sélectionnez le type de produit principal';
      case 2:
        return 'Spécifiez la sous-catégorie et découvrez les paramètres';
      case 3:
        return 'Personnalisez le nom et créez des options sur mesure';
      default:
        return '';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="dark" style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [
                {
                  scale: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[theme.getColor.card, theme.getColor.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.modalContent, { maxWidth: isDesktop ? 650 : 450 }]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.modalTitle}>Nouvelle collection</Text>
                <Text style={styles.modalSubtitle}>{getStepSubtitle()}</Text>
              </View>

              <View style={styles.stepIndicator}>
                {[1, 2, 3].map((step) => (
                  <View key={step} style={styles.stepItem}>
                    <Ionicons name={getStepIcon(step)} size={18} color={getStepColor(step)} />
                    {step < 3 && (
                      <View
                        style={[
                          styles.stepLine,
                          {
                            backgroundColor:
                              step < currentStep ? theme.getColor.success : theme.getColor.border,
                          },
                        ]}
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {/* Étape 1: Catégorie Parente */}
              {currentStep === 1 && (
                <View>
                  <Text style={styles.sectionTitle}>
                    Catégories ({storeType === 'general' ? 'Mode / Commerce' : storeType})
                  </Text>
                  {filteredMainCategories.length === 0 ? (
                    <Text style={styles.emptyText}>Aucune catégorie configurée pour ce type de boutique.</Text>
                  ) : (
                    <View style={styles.categoriesGrid}>
                      {filteredMainCategories.map((cat) => {
                        const isSelected = form.parentCategoryId === cat.id;
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[
                              styles.categoryCard,
                              isSelected && styles.categoryCardSelected,
                              {
                                borderColor: isSelected ? theme.getColor.accent : theme.getColor.border,
                                backgroundColor: isSelected
                                  ? theme.getColor.accent + '10'
                                  : theme.getColor.bg,
                              },
                            ]}
                            onPress={() => {
                              setForm({ ...form, parentCategoryId: cat.id, subCategoryId: '' });
                              Haptics.selectionAsync();
                            }}
                          >
                            <View
                              style={[
                                styles.categoryIcon,
                                { backgroundColor: isSelected ? theme.getColor.accent : theme.getColor.bg },
                              ]}
                            >
                              <Ionicons
                                name={(cat.icon as any) || 'folder-outline'}
                                size={22}
                                color={isSelected ? '#fff' : theme.getColor.text}
                              />
                            </View>
                            <Text style={styles.categoryName} numberOfLines={2}>
                              {cat.name}
                            </Text>
                            {isSelected && (
                              <View
                                style={[
                                  styles.categoryCheck,
                                  { backgroundColor: theme.getColor.success },
                                ]}
                              >
                                <Ionicons name="checkmark" size={10} color="white" />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Étape 2: Sous-catégorie et Aperçu */}
              {currentStep === 2 && (
                <View>
                  <Text style={styles.sectionTitle}>Sélectionnez une sous-catégorie</Text>
                  {filteredSubCategories.length === 0 ? (
                    <Text style={styles.emptyText}>Aucune sous-catégorie disponible.</Text>
                  ) : (
                    <View style={[styles.categoriesGrid, { marginBottom: spacing.lg }]}>
                      {filteredSubCategories.map((sub) => {
                        const isSelected = form.subCategoryId === sub.id;
                        return (
                          <TouchableOpacity
                            key={sub.id}
                            style={[
                              styles.categoryCard,
                              isSelected && styles.categoryCardSelected,
                              {
                                borderColor: isSelected ? theme.getColor.accent : theme.getColor.border,
                                backgroundColor: isSelected
                                  ? theme.getColor.accent + '10'
                                  : theme.getColor.bg,
                              },
                            ]}
                            onPress={() => {
                              setForm({ ...form, subCategoryId: sub.id });
                              Haptics.selectionAsync();
                            }}
                          >
                            <View
                              style={[
                                styles.categoryIcon,
                                { backgroundColor: isSelected ? theme.getColor.accent : theme.getColor.bg },
                              ]}
                            >
                              <Ionicons
                                name={(sub.icon as any) || 'pricetag-outline'}
                                size={22}
                                color={isSelected ? '#fff' : theme.getColor.text}
                              />
                            </View>
                            <Text style={styles.categoryName} numberOfLines={2}>
                              {sub.name}
                            </Text>
                            {isSelected && (
                              <View
                                style={[
                                  styles.categoryCheck,
                                  { backgroundColor: theme.getColor.success },
                                ]}
                              >
                                <Ionicons name="checkmark" size={10} color="white" />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Panneau d'explications et liste des paramètres automatiques */}
                  {form.subCategoryId ? (
                    <View style={styles.attributesPanel}>
                      <View style={styles.panelHeader}>
                        <Ionicons name="sparkles" size={18} color={theme.getColor.accent} />
                        <Text style={styles.panelTitle}>Champs automatiques pour vos produits</Text>
                      </View>
                      <Text style={styles.panelSubtitle}>
                        Tous les produits ajoutés à cette collection comporteront automatiquement les paramètres requis suivants :
                      </Text>

                      {defaultAttributes.length === 0 ? (
                        <View style={styles.emptyAttributes}>
                          <Ionicons name="information-circle-outline" size={24} color={theme.getColor.textMuted} />
                          <Text style={styles.emptyAttributesText}>
                            Cette sous-catégorie ne comporte aucun paramètre par défaut. Vous pourrez en créer sur mesure à l'étape suivante !
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.attributesList}>
                          {defaultAttributes.map((attr: any, idx: number) => (
                            <View key={idx} style={styles.attributeItem}>
                              <View style={styles.attributeInfo}>
                                <Text style={styles.attributeLabel}>{attr.label || attr.name}</Text>
                                <Text style={styles.attributeType}>
                                  Type : {attr.type === 'multiselect' ? 'Choix multiple' : attr.type}
                                </Text>
                              </View>
                              <View style={styles.attributeBadges}>
                                {attr.required && (
                                  <View style={[styles.badge, { backgroundColor: theme.getColor.error + '15' }]}>
                                    <Text style={[styles.badgeText, { color: theme.getColor.error }]}>Requis</Text>
                                  </View>
                                )}
                                {attr.isInherited ? (
                                  <View style={[styles.badge, { backgroundColor: theme.getColor.warning + '15' }]}>
                                    <Text style={[styles.badgeText, { color: theme.getColor.warning }]} numberOfLines={1}>
                                      Hérité ({attr.parentName})
                                    </Text>
                                  </View>
                                ) : (
                                  <View style={[styles.badge, { backgroundColor: theme.getColor.info + '15' }]}>
                                    <Text style={[styles.badgeText, { color: theme.getColor.info }]}>Sous-catégorie</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              )}

              {/* Étape 3: Création et attributs personnalisés */}
              {currentStep === 3 && (
                <View>
                  {/* Nom de la collection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Nom de la collection <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="folder-outline" size={18} color={theme.getColor.textTertiary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Ex: Nouveautés Été"
                        placeholderTextColor={theme.getColor.textTertiary}
                        value={form.name}
                        onChangeText={(text) => setForm({ ...form, name: text })}
                        maxLength={40}
                      />
                    </View>
                  </View>

                  {/* Description */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description</Text>
                    <View style={[styles.inputContainer, styles.textAreaContainer]}>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Décrivez cette collection..."
                        placeholderTextColor={theme.getColor.textTertiary}
                        value={form.description}
                        onChangeText={(text) => setForm({ ...form, description: text })}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                  </View>

                  {/* Sélecteur d'icônes */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Icône</Text>
                    <View style={styles.searchContainer}>
                      <Ionicons name="search" size={16} color={theme.getColor.textTertiary} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher une icône..."
                        placeholderTextColor={theme.getColor.textTertiary}
                        value={searchIcon}
                        onChangeText={setSearchIcon}
                      />
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconCategories}>
                      {ICON_CATEGORIES.map((cat, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.iconCategoryChip,
                            selectedIconCategory === index && styles.iconCategoryChipSelected,
                          ]}
                          onPress={() => setSelectedIconCategory(index)}
                        >
                          <Text
                            style={[
                              styles.iconCategoryText,
                              selectedIconCategory === index && styles.iconCategoryTextSelected,
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <ScrollView style={styles.iconSelector} nestedScrollEnabled showsVerticalScrollIndicator>
                      <View style={styles.iconGrid}>
                        {(searchIcon ? filteredIcons : ICON_CATEGORIES[selectedIconCategory].icons).map((icon) => (
                          <TouchableOpacity
                            key={icon}
                            style={[styles.iconOption, form.icon === icon && styles.iconOptionSelected]}
                            onPress={() => {
                              setForm({ ...form, icon: icon as any });
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                          >
                            <Ionicons
                              name={icon as any}
                              size={20}
                              color={form.icon === icon ? theme.getColor.accent : theme.getColor.text}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>


                  {/* SECTION ATTRIBUTS PERSONNALISÉS */}
                  <View style={styles.customAttributesSection}>
                    <View style={styles.customAttrHeader}>
                      <Ionicons name="construct" size={18} color={theme.getColor.accent} />
                      <Text style={styles.customAttrTitle}>Champs personnalisés (Optionnel)</Text>
                    </View>

                    {/* Explications et Guide pédagogique */}
                    <View style={styles.guideBox}>
                      <Ionicons name="bulb-outline" size={18} color={theme.getColor.warning} />
                      <Text style={styles.guideText}>
                        💡 <Text style={{ fontWeight: '700' }}>Besoin de spécifications uniques ?</Text> Créez des champs sur mesure pour cette collection (ex: Gravure, Options de broderie, Tissu). Ils seront automatiquement demandés lors de la création d'un produit !
                      </Text>
                    </View>

                    {/* Liste des champs personnalisés existants */}
                    {(form.customAttributes || []).length > 0 && (
                      <View style={styles.customAttrList}>
                        {(form.customAttributes || []).map((attr, idx) => (
                          <View key={idx} style={styles.customAttrItem}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.customAttrItemLabel}>{attr.label}</Text>
                              <Text style={styles.customAttrItemDetails}>
                                Type : {attr.type} {attr.options ? `(${attr.options.join(', ')})` : ''}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.customAttrDeleteBtn}
                              onPress={() => handleRemoveCustomAttribute(idx)}
                            >
                              <Ionicons name="trash-outline" size={18} color={theme.getColor.error} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Formulaire d'ajout d'attribut */}
                    {showAddCustomAttr ? (
                      <View style={styles.addAttrForm}>
                        <Text style={styles.addAttrFormTitle}>Créer un champ</Text>

                        <View style={styles.inputGroup}>
                          <Text style={styles.addAttrLabelText}>Libellé du champ</Text>
                          <TextInput
                            style={styles.addAttrInput}
                            placeholder="Ex: Choix de la gravure, Finition"
                            placeholderTextColor={theme.getColor.textTertiary}
                            value={newAttrLabel}
                            onChangeText={setNewAttrLabel}
                          />
                        </View>

                        <View style={styles.inputGroup}>
                          <Text style={styles.addAttrLabelText}>Type de champ</Text>
                          <View style={styles.typeSelectorRow}>
                            {[
                              { key: 'text', label: 'Texte' },
                              { key: 'number', label: 'Nombre' },
                              { key: 'select', label: 'Liste' },
                              { key: 'switch', label: 'Oui/Non' },
                            ].map((type) => (
                              <TouchableOpacity
                                key={type.key}
                                style={[
                                  styles.typeOptionChip,
                                  newAttrType === type.key && styles.typeOptionChipActive,
                                ]}
                                onPress={() => setNewAttrType(type.key as any)}
                              >
                                <Text
                                  style={[
                                    styles.typeOptionText,
                                    newAttrType === type.key && styles.typeOptionTextActive,
                                  ]}
                                >
                                  {type.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {newAttrType === 'select' && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.addAttrLabelText}>
                              Options de la liste (séparées par des virgules)
                            </Text>
                            <TextInput
                              style={styles.addAttrInput}
                              placeholder="Ex: Option A, Option B, Option C"
                              placeholderTextColor={theme.getColor.textTertiary}
                              value={newAttrOptions}
                              onChangeText={setNewAttrOptions}
                            />
                          </View>
                        )}

                        <View style={styles.requiredRow}>
                          <Text style={styles.addAttrLabelText}>Ce champ est obligatoire ?</Text>
                          <TouchableOpacity
                            style={[styles.switchSmall, newAttrRequired ? styles.switchActive : styles.switchInactive]}
                            onPress={() => setNewAttrRequired(!newAttrRequired)}
                          >
                            <View style={[styles.switchThumbSmall, { transform: [{ translateX: newAttrRequired ? 14 : 0 }] }]} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.addAttrFormActions}>
                          <TouchableOpacity
                            style={[styles.miniButton, styles.miniCancelButton]}
                            onPress={() => setShowAddCustomAttr(false)}
                          >
                            <Text style={styles.miniButtonTextCancel}>Annuler</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.miniButton, styles.miniConfirmButton]}
                            onPress={handleAddCustomAttribute}
                          >
                            <Text style={styles.miniButtonTextConfirm}>Enregistrer</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addCustomAttrBtn}
                        onPress={() => {
                          setShowAddCustomAttr(true);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={20} color={theme.getColor.accent} />
                        <Text style={styles.addCustomAttrBtnText}>Ajouter un champ personnalisé</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
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
                  <Ionicons name="arrow-back" size={18} color={theme.getColor.text} />
                  <Text style={styles.backButtonText}>Retour</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  currentStep === 3 ? styles.confirmButton : styles.nextButton,
                  currentStep === 1 && { flex: 2 },
                ]}
                onPress={currentStep === 3 ? handleSubmit : handleNext}
              >
                <Text style={currentStep === 3 ? styles.confirmButtonText : styles.nextButtonText}>
                  {currentStep === 3 ? 'Créer la collection' : 'Suivant'}
                </Text>
                {currentStep < 3 && <Ionicons name="arrow-forward" size={16} color="white" />}
              </TouchableOpacity>
            </View>

            {/* Bouton fermer */}
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.getColor.textTertiary} />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    modalContainer: {
      width: '100%',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.getColor.card,
      borderRadius: theme.radius.xl,
      width: '100%',
      overflow: 'hidden',
      position: 'relative',
      elevation: 10,
      boxShadow: '0 10px 24px rgba(0,0,0,0.3)',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.getColor.border,
    },
    modalTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: '800',
      color: theme.getColor.text,
      marginBottom: 2,
    },
    modalSubtitle: {
      fontSize: 11,
      color: theme.getColor.textMuted,
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
      width: 15,
      height: 2,
      marginHorizontal: 4,
    },
    modalBody: {
      padding: theme.spacing.lg,
      maxHeight: SCREEN_HEIGHT * 0.6,
    },
    sectionTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: '700',
      color: theme.getColor.text,
      marginBottom: theme.spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.getColor.textMuted,
      textAlign: 'center',
      marginVertical: theme.spacing.xl,
    },
    categoriesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    categoryCard: {
      width: '48%',
      backgroundColor: theme.getColor.bg,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      borderWidth: 2,
      position: 'relative',
      marginBottom: theme.spacing.xs,
      alignItems: 'center',
      minHeight: 110,
      justifyContent: 'center',
    },
    categoryCardSelected: {
      borderWidth: 2,
    },
    categoryIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    categoryName: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.getColor.text,
      textAlign: 'center',
      marginTop: 4,
    },
    categoryCheck: {
      position: 'absolute',
      top: theme.spacing.xs,
      right: theme.spacing.xs,
      width: 16,
      height: 16,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    attributesPanel: {
      backgroundColor: theme.getColor.bg,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.getColor.border,
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: theme.spacing.xs,
    },
    panelTitle: {
      fontSize: theme.fontSize.sm,
      fontWeight: '700',
      color: theme.getColor.text,
    },
    panelSubtitle: {
      fontSize: 11,
      color: theme.getColor.textSoft,
      marginBottom: theme.spacing.md,
      lineHeight: 15,
    },
    emptyAttributes: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
      gap: 4,
    },
    emptyAttributesText: {
      fontSize: 11,
      color: theme.getColor.textMuted,
      textAlign: 'center',
      lineHeight: 15,
    },
    attributesList: {
      gap: theme.spacing.sm,
    },
    attributeItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.getColor.card,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.getColor.border,
    },
    attributeInfo: {
      flex: 1,
    },
    attributeLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: '600',
      color: theme.getColor.text,
    },
    attributeType: {
      fontSize: 10,
      color: theme.getColor.textMuted,
      marginTop: 2,
    },
    attributeBadges: {
      flexDirection: 'row',
      gap: 4,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: '700',
    },
    inputGroup: {
      marginBottom: theme.spacing.md,
    },
    inputLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: '600',
      color: theme.getColor.text,
      marginBottom: theme.spacing.xs,
    },
    required: {
      color: theme.getColor.danger,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.getColor.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.getColor.border,
      paddingHorizontal: theme.spacing.md,
    },
    inputIcon: {
      marginRight: theme.spacing.sm,
    },
    input: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.fontSize.md,
      color: theme.getColor.text,
    },
    textAreaContainer: {
      alignItems: 'flex-start',
      paddingVertical: 0,
    },
    textArea: {
      minHeight: 60,
      textAlignVertical: 'top',
      paddingTop: theme.spacing.sm,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.getColor.background,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.getColor.border,
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
      fontSize: theme.fontSize.sm,
      color: theme.getColor.text,
    },
    iconCategories: {
      flexGrow: 0,
      marginBottom: theme.spacing.sm,
    },
    iconCategoryChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.getColor.background,
      marginRight: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.getColor.border,
    },
    iconCategoryChipSelected: {
      backgroundColor: theme.getColor.accent,
      borderColor: theme.getColor.accent,
    },
    iconCategoryText: {
      fontSize: 11,
      color: theme.getColor.textTertiary,
    },
    iconCategoryTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    iconSelector: {
      maxHeight: 120,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    iconOption: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: theme.getColor.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.getColor.border,
    },
    iconOptionSelected: {
      backgroundColor: theme.getColor.accent + '20',
      borderColor: theme.getColor.accent,
    },
    colorOption: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: theme.spacing.sm,
      borderWidth: 2,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorOptionSelected: {
      borderColor: theme.getColor.text,
    },
    customAttributesSection: {
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.getColor.border,
    },
    customAttrHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: theme.spacing.sm,
    },
    customAttrTitle: {
      fontSize: theme.fontSize.sm,
      fontWeight: '700',
      color: theme.getColor.text,
    },
    guideBox: {
      flexDirection: 'row',
      backgroundColor: theme.getColor.warning + '10',
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.getColor.warning + '30',
      marginBottom: theme.spacing.md,
      gap: 8,
    },
    guideText: {
      flex: 1,
      fontSize: 11,
      color: theme.getColor.textSoft,
      lineHeight: 16,
    },
    customAttrList: {
      marginBottom: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    customAttrItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.getColor.bg,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.getColor.border,
    },
    customAttrItemLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: '600',
      color: theme.getColor.text,
    },
    customAttrItemDetails: {
      fontSize: 10,
      color: theme.getColor.textMuted,
      marginTop: 2,
    },
    customAttrDeleteBtn: {
      padding: 4,
    },
    addCustomAttrBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.getColor.accent,
      backgroundColor: theme.getColor.accent + '05',
    },
    addCustomAttrBtnText: {
      fontSize: theme.fontSize.sm,
      fontWeight: '600',
      color: theme.getColor.accent,
    },
    addAttrForm: {
      backgroundColor: theme.getColor.bg,
      borderWidth: 1,
      borderColor: theme.getColor.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    addAttrFormTitle: {
      fontSize: theme.fontSize.sm,
      fontWeight: '700',
      color: theme.getColor.text,
      marginBottom: theme.spacing.md,
    },
    addAttrLabelText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.getColor.text,
      marginBottom: 4,
    },
    addAttrInput: {
      backgroundColor: theme.getColor.card,
      borderWidth: 1,
      borderColor: theme.getColor.border,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.sm,
      color: theme.getColor.text,
      fontSize: theme.fontSize.sm,
    },
    typeSelectorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 2,
    },
    typeOptionChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.radius.full,
      backgroundColor: theme.getColor.card,
      borderWidth: 1,
      borderColor: theme.getColor.border,
    },
    typeOptionChipActive: {
      backgroundColor: theme.getColor.accent,
      borderColor: theme.getColor.accent,
    },
    typeOptionText: {
      fontSize: 11,
      color: theme.getColor.textSoft,
    },
    typeOptionTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    requiredRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: theme.spacing.sm,
    },
    switchSmall: {
      width: 36,
      height: 20,
      borderRadius: 10,
      padding: 2,
    },
    switchThumbSmall: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.getColor.card,
    },
    switchActive: {
      backgroundColor: theme.getColor.success,
    },
    switchInactive: {
      backgroundColor: theme.getColor.border,
    },
    addAttrFormActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    miniButton: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniCancelButton: {
      backgroundColor: theme.getColor.card,
      borderWidth: 1,
      borderColor: theme.getColor.border,
    },
    miniConfirmButton: {
      backgroundColor: theme.getColor.accent,
    },
    miniButtonTextCancel: {
      fontSize: 12,
      color: theme.getColor.text,
      fontWeight: '600',
    },
    miniButtonTextConfirm: {
      fontSize: 12,
      color: '#fff',
      fontWeight: '600',
    },
    modalActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.getColor.border,
    },
    modalButton: {
      flex: 1,
      flexDirection: 'row',
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
    },
    backButton: {
      backgroundColor: theme.getColor.background,
      borderWidth: 1,
      borderColor: theme.getColor.border,
    },
    backButtonText: {
      color: theme.getColor.text,
      fontWeight: '500',
      fontSize: theme.fontSize.sm,
    },
    nextButton: {
      backgroundColor: theme.getColor.accent,
    },
    nextButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: theme.fontSize.sm,
    },
    confirmButton: {
      backgroundColor: theme.getColor.success,
    },
    confirmButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: theme.fontSize.sm,
    },
    closeButton: {
      position: 'absolute',
      top: theme.spacing.lg,
      right: theme.spacing.lg,
      zIndex: 10,
    },
  });

export default AddCollectionModal;
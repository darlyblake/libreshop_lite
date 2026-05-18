import React, { useCallback, useEffect, useState } from 'react';
import { errorHandler } from '../utils/errorHandler';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { collectionService } from '../services/collectionService';
import { categoryService } from '../services/categoryService';
import { storeService } from '../services/storeService';
import { type Category } from '../lib/supabase';

export const SellerEditCollectionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { collectionId } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeType, setStoreType] = useState<string>('general');

  // Form states
  const [collection, setCollection] = useState({
    name: '',
    description: '',
    isActive: true,
    parentCategoryId: '',
    subCategoryId: '',
    customAttributes: [] as any[],
  });

  // Picker states
  const [showParentPicker, setShowParentPicker] = useState(false);
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [subSearch, setSubSearch] = useState('');

  // Custom attributes builder states
  const [showAddCustomAttr, setShowAddCustomAttr] = useState(false);
  const [newAttrLabel, setNewAttrLabel] = useState('');
  const [newAttrType, setNewAttrType] = useState<'text' | 'number' | 'select' | 'switch'>('text');
  const [newAttrOptions, setNewAttrOptions] = useState('');
  const [newAttrRequired, setNewAttrRequired] = useState(false);

  const loadData = useCallback(async () => {
    if (!collectionId) {
      Alert.alert('Erreur', 'Collection introuvable');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);

      // Load collection
      const col = await collectionService.getById(String(collectionId));

      // Load store to get store_type
      if (col.store_id) {
        try {
          const store = await storeService.getById(col.store_id);
          setStoreType(store?.store_type || 'general');
        } catch (err) {
          console.warn('Failed to load store for store_type:', err);
        }
      }

      // Load categories
      const cats = await categoryService.getAll();
      setCategories(cats || []);

      // Find selected subcategory & its parent category
      const subCat = (cats || []).find((c) => c.id === col.category_id);
      const parentCatId = subCat?.parent_id || '';

      setCollection({
        name: col.name || '',
        description: col.description || '',
        isActive: !!col.is_active,
        parentCategoryId: parentCatId,
        subCategoryId: col.category_id || '',
        customAttributes: (col as any).custom_attributes || [],
      });
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'load collection');
      Alert.alert('Erreur', 'Impossible de charger la collection');
    } finally {
      setLoading(false);
    }
  }, [collectionId, navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!collection.name.trim()) {
      Alert.alert('Erreur', 'Le nom de la collection est requis');
      return;
    }

    if (!collection.subCategoryId) {
      Alert.alert('Erreur', 'La sous-catégorie est obligatoire');
      return;
    }

    if (!collectionId) {
      Alert.alert('Erreur', 'Collection introuvable');
      return;
    }

    try {
      setLoading(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      await collectionService.update(String(collectionId), {
        name: collection.name.trim(),
        description: collection.description || null,
        is_active: collection.isActive,
        category_id: collection.subCategoryId,
        custom_attributes: collection.customAttributes,
      } as any);

      Alert.alert('Succès', 'Collection mise à jour avec succès');
      navigation.goBack();
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'update collection');
      Alert.alert('Erreur', "Impossible d'enregistrer");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer la collection',
      'Êtes-vous sûr de vouloir supprimer cette collection ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!collectionId) {
              Alert.alert('Erreur', 'Collection introuvable');
              return;
            }
            try {
              setLoading(true);
              await collectionService.delete(String(collectionId));
              Alert.alert('Succès', 'Collection supprimée avec succès');
              navigation.goBack();
            } catch (e) {
              errorHandler.handleDatabaseError(e, 'delete collection');
              Alert.alert('Erreur', 'Impossible de supprimer la collection');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Add custom attribute
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
      isCustom: true,
    };

    setCollection((prev) => ({
      ...prev,
      customAttributes: [...(prev.customAttributes || []), newAttr],
    }));

    // Reset fields
    setNewAttrLabel('');
    setNewAttrType('text');
    setNewAttrOptions('');
    setNewAttrRequired(false);
    setShowAddCustomAttr(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Remove custom attribute
  const handleRemoveCustomAttribute = (index: number) => {
    const updated = (collection.customAttributes || []).filter((_, i) => i !== index);
    setCollection((prev) => ({ ...prev, customAttributes: updated }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Filtered lists for parent & sub categories
  const filteredMainCategories = categories
    .filter((c) => !c.parent_id && (c.store_type === storeType || (!c.store_type && storeType === 'general')))
    .filter((c) => String(c.name || '').toLowerCase().includes(parentSearch.toLowerCase()));

  const filteredSubCategories = categories
    .filter((c) => c.parent_id === collection.parentCategoryId)
    .filter((c) => String(c.name || '').toLowerCase().includes(subSearch.toLowerCase()));

  const selectedParent = categories.find((c) => c.id === collection.parentCategoryId);
  const selectedSub = categories.find((c) => c.id === collection.subCategoryId);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier la collection</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
          <Ionicons name="checkmark" size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {loading && !collection.name ? (
        <View style={styles.centeredLoading}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Chargement de la collection...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Info Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations générales</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom de la collection *</Text>
                <TextInput
                  style={styles.input}
                  value={collection.name}
                  onChangeText={(text) => setCollection({ ...collection, name: text })}
                  placeholder="Ex: Nouveautés"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={collection.description}
                  onChangeText={(text) => setCollection({ ...collection, description: text })}
                  placeholder="Description..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.switchGroup}>
                <Text style={styles.inputLabel}>Statut actif</Text>
                <TouchableOpacity
                  style={[styles.switch, collection.isActive ? styles.switchActive : styles.switchInactive]}
                  onPress={() => setCollection({ ...collection, isActive: !collection.isActive })}
                >
                  <Ionicons name={collection.isActive ? 'checkmark' : 'close'} size={16} color="white" />
                  <Text style={styles.switchText}>{collection.isActive ? 'Active' : 'Inactive'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category / Parents Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Catégorie de rattachement</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Catégorie principale *</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => {
                    setParentSearch('');
                    setShowParentPicker(true);
                  }}
                >
                  <Text style={{ color: selectedParent ? COLORS.text : COLORS.textMuted }}>
                    {selectedParent?.name || 'Sélectionner une catégorie'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Sous-catégorie *</Text>
                <TouchableOpacity
                  style={[styles.selectInput, !collection.parentCategoryId && { opacity: 0.5 }]}
                  disabled={!collection.parentCategoryId}
                  onPress={() => {
                    setSubSearch('');
                    setShowSubPicker(true);
                  }}
                >
                  <Text style={{ color: selectedSub ? COLORS.text : COLORS.textMuted }}>
                    {selectedSub?.name || 'Sélectionner une sous-catégorie'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Custom Attributes Section */}
            <View style={styles.section}>
              <View style={styles.customAttrHeader}>
                <Ionicons name="construct" size={18} color={COLORS.accent} />
                <Text style={styles.sectionTitle}>Champs personnalisés de la collection</Text>
              </View>

              {/* Guide Box */}
              <View style={styles.guideBox}>
                <Ionicons name="bulb-outline" size={18} color={COLORS.warning} />
                <Text style={styles.guideText}>
                  💡 Ajoutez des champs sur mesure spécifiques à cette collection (ex: Tissu, Finition). Ils apparaîtront automatiquement sur tous ses produits !
                </Text>
              </View>

              {/* Custom fields list */}
              {(collection.customAttributes || []).length > 0 && (
                <View style={styles.customAttrList}>
                  {(collection.customAttributes || []).map((attr, idx) => (
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
                        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add Custom Attribute Builder Form */}
              {showAddCustomAttr ? (
                <View style={styles.addAttrForm}>
                  <Text style={styles.addAttrFormTitle}>Nouveau champ personnalisé</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.addAttrLabelText}>Libellé du champ</Text>
                    <TextInput
                      style={styles.addAttrInput}
                      placeholder="Ex: Broderie, Option Cadeau"
                      placeholderTextColor={COLORS.textMuted}
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
                      <Text style={styles.addAttrLabelText}>Options de la liste (séparées par des virgules)</Text>
                      <TextInput
                        style={styles.addAttrInput}
                        placeholder="Ex: Or, Argent, Bronze"
                        placeholderTextColor={COLORS.textMuted}
                        value={newAttrOptions}
                        onChangeText={setNewAttrOptions}
                      />
                    </View>
                  )}

                  <View style={styles.requiredRow}>
                    <Text style={styles.addAttrLabelText}>Ce champ est obligatoire ?</Text>
                    <TouchableOpacity
                      style={[styles.switchSmall, newAttrRequired ? styles.switchActiveSmall : styles.switchInactiveSmall]}
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
                      <Text style={styles.miniButtonTextConfirm}>Ajouter</Text>
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
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.accent} />
                  <Text style={styles.addCustomAttrBtnText}>Ajouter un champ personnalisé</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Danger Zone */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Zone de danger</Text>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                <Text style={styles.deleteButtonText}>Supprimer la collection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* MODAL PICKER : CATEGORIE PRINCIPALE */}
      <Modal visible={showParentPicker} animationType="slide" transparent onRequestClose={() => setShowParentPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisir la catégorie principale</Text>
              <TouchableOpacity onPress={() => setShowParentPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchRow}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Rechercher une catégorie..."
                placeholderTextColor={COLORS.textMuted}
                value={parentSearch}
                onChangeText={setParentSearch}
              />
            </View>

            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {filteredMainCategories.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>Aucune catégorie trouvée</Text>
                </View>
              ) : (
                filteredMainCategories.map((c) => {
                  const isSelected = c.id === collection.parentCategoryId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => {
                        setCollection((prev) => ({
                          ...prev,
                          parentCategoryId: c.id,
                          subCategoryId: '', // Reset subcategory when parent changes
                        }));
                        setShowParentPicker(false);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text style={styles.pickerItemText}>{c.name}</Text>
                      {isSelected && <Ionicons name="checkmark" size={20} color={COLORS.accent} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL PICKER : SOUS-CATEGORIE */}
      <Modal visible={showSubPicker} animationType="slide" transparent onRequestClose={() => setShowSubPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisir la sous-catégorie</Text>
              <TouchableOpacity onPress={() => setShowSubPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchRow}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Rechercher une sous-catégorie..."
                placeholderTextColor={COLORS.textMuted}
                value={subSearch}
                onChangeText={setSubSearch}
              />
            </View>

            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {filteredSubCategories.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>Aucune sous-catégorie trouvée</Text>
                </View>
              ) : (
                filteredSubCategories.map((c) => {
                  const isSelected = c.id === collection.subCategoryId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => {
                        setCollection((prev) => ({
                          ...prev,
                          subCategoryId: c.id,
                        }));
                        setShowSubPicker(false);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text style={styles.pickerItemText}>{c.name}</Text>
                      {isSelected && <Ionicons name="checkmark" size={20} color={COLORS.accent} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSoft,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
  },
  switchActive: {
    backgroundColor: COLORS.success,
  },
  switchInactive: {
    backgroundColor: COLORS.textMuted,
  },
  switchText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: 'white',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.danger + '10',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.danger,
  },
  centeredLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  // Picker modal styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%',
    padding: SPACING.lg,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  pickerTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerSearchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    marginLeft: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  pickerList: {
    marginBottom: SPACING.xl,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerItemSelected: {
    backgroundColor: COLORS.accent + '08',
  },
  pickerItemText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  pickerEmpty: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  pickerEmptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
  },

  // Custom attributes builder styles
  customAttrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  guideBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.warning + '10',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  guideText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSoft,
    lineHeight: 16,
  },
  customAttrList: {
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  customAttrItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customAttrItemLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  customAttrItemDetails: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  customAttrDeleteBtn: {
    padding: 4,
  },
  addCustomAttrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '05',
  },
  addCustomAttrBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.accent,
  },
  addAttrForm: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  addAttrFormTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  addAttrLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  addAttrInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
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
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeOptionChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  typeOptionText: {
    fontSize: 11,
    color: COLORS.textSoft,
  },
  typeOptionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  requiredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: SPACING.sm,
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
    backgroundColor: COLORS.card,
  },
  switchActiveSmall: {
    backgroundColor: COLORS.success,
  },
  switchInactiveSmall: {
    backgroundColor: COLORS.border,
  },
  addAttrFormActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  miniButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCancelButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniConfirmButton: {
    backgroundColor: COLORS.accent,
  },
  miniButtonTextCancel: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  miniButtonTextConfirm: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
});

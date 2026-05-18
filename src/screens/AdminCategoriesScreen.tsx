import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { Card } from '../components/Card';
import { BackToDashboard } from '../components/BackToDashboard';
import { categoryService } from '../services/categoryService';

interface Category {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: 'active' | 'inactive';
  store_type: 'general' | 'restaurant' | 'bar' | 'hotel' | 'logement';
  parent_id?: string | null;
  attribute_schema?: any[];
  createdAt: string;
}

const STORE_TYPES = [
  { id: 'general', title: 'Boutique', icon: 'storefront-outline' },
  { id: 'restaurant', title: 'Restaurant', icon: 'restaurant-outline' },
  { id: 'bar', title: 'Bar / Lounge', icon: 'beer-outline' },
  { id: 'hotel', title: 'Hôtel', icon: 'bed-outline' },
  { id: 'logement', title: 'Logement', icon: 'home-outline' },
] as const;

export const AdminCategoriesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'general' | 'restaurant' | 'bar' | 'hotel' | 'logement'>('all');

  const [categories, setCategories] = useState<Category[]>([]);

  const loadCategories = async () => {
    try {
      const data = await categoryService.getAll();
      setCategories(
        data.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '-',
          icon: (c.icon as keyof typeof Ionicons.glyphMap) || 'grid-outline',
          status: c.status || 'active',
          store_type: c.store_type || 'general',
          parent_id: c.parent_id || null,
          attribute_schema: Array.isArray(c.attribute_schema) ? c.attribute_schema : [],
          createdAt: c.created_at || new Date().toISOString(),
        }))
      );
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de charger les catégories.');
    }
  };

  React.useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    return categories.filter(category => {
      const matchesSearch = category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedTypeFilter === 'all' || category.store_type === selectedTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [categories, searchQuery, selectedTypeFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  interface AttributeField {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'multiselect';
    options?: string[];
    required: boolean;
  }

  // Add category modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState<string>('grid-outline');
  const [newStoreType, setNewStoreType] = useState<'general' | 'restaurant' | 'bar' | 'hotel' | 'logement'>('general');
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [attributesList, setAttributesList] = useState<AttributeField[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Accordion / Collapsible categories state
  const [expandedParents, setExpandedParents] = useState<string[]>([]);
  const toggleParentExpand = (parentId: string) => {
    if (expandedParents.includes(parentId)) {
      setExpandedParents(expandedParents.filter(id => id !== parentId));
    } else {
      setExpandedParents([...expandedParents, parentId]);
    }
  };

  // Single attribute creation form state
  const [attrName, setAttrName] = useState('');
  const [attrLabel, setAttrLabel] = useState('');
  const [attrType, setAttrType] = useState<'text' | 'number' | 'select' | 'multiselect'>('text');
  const [attrOptionsRaw, setAttrOptionsRaw] = useState('');
  const [attrRequired, setAttrRequired] = useState(false);

  // when a category is selected for editing, populate the inputs
  React.useEffect(() => {
    if (editingCategory) {
      setNewName(editingCategory.name);
      setNewDesc(editingCategory.description === '-' ? '' : editingCategory.description);
      setNewIcon(editingCategory.icon as string);
      setNewStoreType(editingCategory.store_type || 'general');
      setNewParentId(editingCategory.parent_id || null);
      setAttributesList(editingCategory.attribute_schema || []);
    }
  }, [editingCategory]);

  // Liste étendue d'icônes couvrant de nombreuses catégories
  const ICON_OPTIONS: string[] = [
    'grid-outline',
    'shirt-outline',
    'phone-portrait',
    'restaurant-outline',
    'home-outline',
    'basket-outline',
    'pricetag-outline',
    'car-outline',
    'book-outline',
    'cart-outline',
    'bag-handle-outline',
    'bicycle-outline',
    'paw-outline',
    'construct-outline',
    'musical-notes-outline',
    'game-controller-outline',
    'leaf-outline',
    'flower-outline',
    'camera-outline',
    'hardware-chip-outline',
    'person-outline',
    'hammer-outline',
    'golf-outline',
    'cafe-outline',
    'beaker-outline',
    'gift-outline',
    'beer-outline',
    'laptop-outline',
    'document-text-outline',
  ];

  const openAddModal = () => {
    setEditingCategory(null);
    setAddModalVisible(true);
  };
  const openEditModal = (cat: Category) => {
    // openEditModal: cat;
    setEditingCategory(cat);
    setAddModalVisible(true);
  };
  const closeAddModal = () => {
    setAddModalVisible(false);
    setNewName('');
    setNewDesc('');
    setNewIcon('grid-outline');
    setNewStoreType('general');
    setNewParentId(null);
    setAttributesList([]);
    setEditingCategory(null);

    // Reset single attribute creator inputs
    setAttrName('');
    setAttrLabel('');
    setAttrType('text');
    setAttrOptionsRaw('');
    setAttrRequired(false);
  };

  const addAttributeToSchema = () => {
    if (!attrName.trim() || !attrLabel.trim()) {
      Alert.alert('Erreur', 'La clé technique et le libellé sont requis.');
      return;
    }
    const cleanKey = attrName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
    if (attributesList.some(a => a.name === cleanKey)) {
      Alert.alert('Erreur', 'Un attribut avec cette clé technique existe déjà.');
      return;
    }

    const options = (attrType === 'select' || attrType === 'multiselect')
      ? attrOptionsRaw.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

    if ((attrType === 'select' || attrType === 'multiselect') && (!options || options.length === 0)) {
      Alert.alert('Erreur', 'Veuillez saisir au moins une option pour ce type de champ.');
      return;
    }

    const newField: AttributeField = {
      name: cleanKey,
      label: attrLabel.trim(),
      type: attrType,
      options,
      required: attrRequired,
    };

    setAttributesList([...attributesList, newField]);
    
    // Clear form inputs
    setAttrName('');
    setAttrLabel('');
    setAttrType('text');
    setAttrOptionsRaw('');
    setAttrRequired(false);
  };

  const removeAttributeFromSchema = (name: string) => {
    setAttributesList(attributesList.filter(a => a.name !== name));
  };

  const submitNewCategory = async () => {
    if (!newName.trim()) {
      Alert.alert('Erreur', 'Le nom de la catégorie est requis.');
      return;
    }
    try {
      if (editingCategory) {
        const updatedRecord = await categoryService.update(editingCategory.id, {
          name: newName.trim(),
          description: newDesc.trim() || '-',
          icon: newIcon as any,
          store_type: newStoreType,
          parent_id: newParentId,
          attribute_schema: attributesList,
        });
        setCategories(categories.map(c =>
          c.id === updatedRecord.id ? { 
            ...c, 
            name: updatedRecord.name, 
            description: updatedRecord.description || '-', 
            icon: (updatedRecord.icon as any),
            store_type: updatedRecord.store_type || 'general',
            parent_id: updatedRecord.parent_id || null,
            attribute_schema: Array.isArray(updatedRecord.attribute_schema) ? updatedRecord.attribute_schema : [],
          } : c
        ));
        Alert.alert('Catégorie modifiée', `${updatedRecord.name} a été mise à jour.`);
      } else {
        const created = await categoryService.create({
          name: newName.trim(),
          description: newDesc.trim() || '-',
          icon: newIcon as any,
          status: 'active',
          store_type: newStoreType,
          parent_id: newParentId,
          attribute_schema: attributesList,
        });
        const toAdd: Category = {
          id: created.id,
          name: created.name,
          description: created.description || '-',
          icon: (created.icon as any) || 'grid-outline',
          status: created.status || 'active',
          store_type: created.store_type || 'general',
          parent_id: created.parent_id || null,
          attribute_schema: Array.isArray(created.attribute_schema) ? created.attribute_schema : [],
          createdAt: created.created_at || new Date().toISOString(),
        };
        setCategories([toAdd, ...categories]);
        Alert.alert('Catégorie ajoutée', `${toAdd.name} a été ajoutée.`);
      }
      closeAddModal();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Échec de l’enregistrement.');
    }
  };

  const handleCategoryAction = async (category: Category, action: 'edit' | 'toggle' | 'delete') => {
    switch (action) {
      case 'edit':
        openEditModal(category);
        break;
      case 'toggle':
        try {
          const newStatus = category.status === 'active' ? 'inactive' : 'active';
          await categoryService.update(category.id, { status: newStatus });
          setCategories(categories.map(c =>
            c.id === category.id ? { ...c, status: newStatus } : c
          ));
        } catch (err: any) {
          Alert.alert('Erreur', err.message || 'Impossible de changer le statut.');
        }
        break;
      case 'delete':
        Alert.alert(
          'Supprimer la catégorie',
          `Voulez‑vous vraiment supprimer ${category.name} ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Oui',
              style: 'destructive',
              onPress: async () => {
                try {
                  await categoryService.delete(category.id);
                  setCategories(categories.filter(c => c.id !== category.id));
                } catch (err: any) {
                  Alert.alert('Erreur', err.message || 'Impossible de supprimer.');
                }
              },
            },
          ]
        );
        break;
    }
  };

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des catégories</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une catégorie..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Types Filters */}
      <View style={styles.filterSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.filterCapsule,
              selectedTypeFilter === 'all' && styles.filterCapsuleActive
            ]}
            onPress={() => setSelectedTypeFilter('all')}
          >
            <Ionicons 
              name="apps-outline" 
              size={14} 
              color={selectedTypeFilter === 'all' ? COLORS.accent : COLORS.textMuted} 
            />
            <Text style={[
              styles.filterCapsuleText,
              selectedTypeFilter === 'all' && styles.filterCapsuleTextActive
            ]}>
              Tous
            </Text>
          </TouchableOpacity>
          {STORE_TYPES.map(type => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.filterCapsule,
                selectedTypeFilter === type.id && styles.filterCapsuleActive
              ]}
              onPress={() => setSelectedTypeFilter(type.id)}
            >
              <Ionicons 
                name={type.icon as any} 
                size={14} 
                color={selectedTypeFilter === type.id ? COLORS.accent : COLORS.textMuted} 
              />
              <Text style={[
                styles.filterCapsuleText,
                selectedTypeFilter === type.id && styles.filterCapsuleTextActive
              ]}>
                {type.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Categories List */}
      {/* Add Category Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addModalContainer}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>{editingCategory ? 'Modifier catégorie' : 'Nouvelle catégorie'}</Text>
              <TouchableOpacity onPress={closeAddModal} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.addModalBody} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {/* Category name */}
              <TextInput
                placeholder="Nom de la catégorie"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
              />

              <TextInput
                placeholder="Description (optionnelle)"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { height: 70 }]}
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
              />

              {/* Store type selector */}
              <Text style={styles.modalLabel}>Type de commerce</Text>
              <View style={styles.modalStoreTypeContainer}>
                {STORE_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.modalStoreTypeCard, newStoreType === type.id && styles.modalStoreTypeCardActive]}
                    onPress={() => { setNewStoreType(type.id); setNewParentId(null); }}
                  >
                    <Ionicons name={type.icon as any} size={12} color={newStoreType === type.id ? COLORS.accent : COLORS.textMuted} />
                    <Text style={[styles.modalStoreTypeCardText, newStoreType === type.id && styles.modalStoreTypeCardTextActive]}>
                      {type.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Parent category selector */}
              <Text style={styles.modalLabel}>Catégorie parente (optionnel)</Text>
              <View style={styles.parentSelectorContainer}>
                <TouchableOpacity
                  style={[styles.parentOption, newParentId === null && styles.parentOptionActive]}
                  onPress={() => setNewParentId(null)}
                >
                  <Ionicons name="apps-outline" size={13} color={newParentId === null ? COLORS.accent : COLORS.textMuted} />
                  <Text style={[styles.parentOptionText, newParentId === null && styles.parentOptionTextActive]}>
                    Aucune (catégorie principale)
                  </Text>
                </TouchableOpacity>
                {categories
                  .filter(c => !c.parent_id && c.store_type === newStoreType)
                  .map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.parentOption, newParentId === c.id && styles.parentOptionActive]}
                      onPress={() => setNewParentId(c.id)}
                    >
                      <Ionicons name={c.icon} size={13} color={newParentId === c.id ? COLORS.accent : COLORS.textMuted} />
                      <Text style={[styles.parentOptionText, newParentId === c.id && styles.parentOptionTextActive]} numberOfLines={1}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                }
              </View>

              {/* Icon chooser */}
              <Text style={styles.modalLabel}>Icône</Text>
              <FlatList
                data={ICON_OPTIONS}
                keyExtractor={(i) => i}
                numColumns={5}
                style={styles.iconGrid}
                contentContainerStyle={{ paddingBottom: SPACING.sm }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.iconOption, item === newIcon && styles.iconSelected]}
                    onPress={() => setNewIcon(item)}
                  >
                    <Ionicons name={item as any} size={20} color={COLORS.text} />
                  </TouchableOpacity>
                )}
              />

              {/* ── Attribute Schema Builder ── */}
              <View style={styles.attrBuilderSection}>
                <View style={styles.attrBuilderHeader}>
                  <Ionicons name="options-outline" size={16} color={COLORS.accent} />
                  <Text style={styles.attrBuilderTitle}>Paramètres du formulaire produit</Text>
                </View>
                <Text style={styles.attrBuilderSubtitle}>
                  Définissez les champs qui seront demandés lors de l'ajout d'un produit dans cette catégorie.
                </Text>

                {/* Existing attributes list */}
                {attributesList.length > 0 && (
                  <View style={styles.attrList}>
                    {attributesList.map((attr, idx) => (
                      <View key={idx} style={styles.attrRow}>
                        <View style={styles.attrRowLeft}>
                          <Ionicons
                            name={attr.type === 'text' ? 'text-outline' : attr.type === 'number' ? 'calculator-outline' : 'list-outline'}
                            size={14}
                            color={COLORS.accent}
                          />
                          <View>
                            <Text style={styles.attrRowLabel}>{attr.label}</Text>
                            <Text style={styles.attrRowMeta}>
                              clé: <Text style={{ color: COLORS.accent }}>{attr.name}</Text>
                              {'  '}type: {attr.type}
                              {attr.required ? '  ⚠ requis' : ''}
                            </Text>
                            {attr.options && (
                              <View style={styles.optionChips}>
                                {attr.options.map((opt, oi) => (
                                  <View key={oi} style={styles.optionChip}>
                                    <Text style={styles.optionChipText}>{opt}</Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => removeAttributeFromSchema(attr.name)} style={styles.attrDeleteBtn}>
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* New attribute mini form */}
                <View style={styles.attrForm}>
                  <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
                    <TextInput
                      placeholder="Clé (ex: size)"
                      placeholderTextColor={COLORS.textMuted}
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      value={attrName}
                      onChangeText={setAttrName}
                      autoCapitalize="none"
                    />
                    <TextInput
                      placeholder="Libellé (ex: Taille)"
                      placeholderTextColor={COLORS.textMuted}
                      style={[styles.input, { flex: 1.5, marginBottom: 0 }]}
                      value={attrLabel}
                      onChangeText={setAttrLabel}
                    />
                  </View>

                  {/* Type selector */}
                  <View style={styles.attrTypeRow}>
                    {(['text', 'number', 'select', 'multiselect'] as const).map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.attrTypeBtn, attrType === t && styles.attrTypeBtnActive]}
                        onPress={() => setAttrType(t)}
                      >
                        <Text style={[styles.attrTypeBtnText, attrType === t && styles.attrTypeBtnTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {(attrType === 'select' || attrType === 'multiselect') && (
                    <TextInput
                      placeholder="Options séparées par des virgules (ex: S, M, L, XL)"
                      placeholderTextColor={COLORS.textMuted}
                      style={styles.input}
                      value={attrOptionsRaw}
                      onChangeText={setAttrOptionsRaw}
                    />
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xs }}>
                    <TouchableOpacity
                      style={[styles.requiredToggle, attrRequired && styles.requiredToggleActive]}
                      onPress={() => setAttrRequired(!attrRequired)}
                    >
                      <Ionicons name={attrRequired ? 'checkbox' : 'square-outline'} size={16} color={attrRequired ? COLORS.accent : COLORS.textMuted} />
                      <Text style={[styles.requiredToggleText, attrRequired && { color: COLORS.accent }]}>Champ obligatoire</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.addAttrButton} onPress={addAttributeToSchema}>
                      <Ionicons name="add" size={16} color={COLORS.text} />
                      <Text style={styles.addAttrButtonText}>Ajouter</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Submit row */}
              <View style={[styles.modalActions, { marginTop: SPACING.lg }]}>
                <TouchableOpacity style={styles.modalActionButton} onPress={closeAddModal}>
                  <Text style={styles.modalActionText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalActionButton, { backgroundColor: COLORS.accent, flex: 1 }]} onPress={submitNewCategory}>
                  <Text style={[styles.modalActionText, { color: COLORS.text, textAlign: 'center' }]}>
                    {editingCategory ? '✓ Mettre à jour' : '+ Créer la catégorie'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ScrollView
        style={styles.categoriesList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
      >
        {/* ── Grouped Hierarchical List: Parents then Children ── */}
        {filteredCategories
          .filter(cat => !cat.parent_id)
          .map(parent => {
            const children = filteredCategories.filter(c => c.parent_id === parent.id);
            return (
              <View key={parent.id} style={styles.parentGroup}>
                {/* ── Parent Card ── */}
                <Card style={styles.parentCard}>
                  <View style={styles.categoryHeader}>
                    <TouchableOpacity 
                      style={styles.categoryInfo} 
                      onPress={() => toggleParentExpand(parent.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: COLORS.accent + '20' }]}>
                        <Ionicons name={parent.icon} size={22} color={COLORS.accent} />
                      </View>
                      <View style={styles.categoryDetails}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.categoryName}>{parent.name}</Text>
                          <Ionicons 
                            name={expandedParents.includes(parent.id) ? "chevron-down" : "chevron-forward"} 
                            size={14} 
                            color={COLORS.textMuted} 
                          />
                          <View style={styles.parentBadge}>
                            <Text style={styles.parentBadgeText}>Principale</Text>
                          </View>
                        </View>
                        {parent.description !== '-' && (
                          <Text style={styles.categoryDescription} numberOfLines={1}>{parent.description}</Text>
                        )}
                        {/* General attribute chips */}
                        {parent.attribute_schema && parent.attribute_schema.length > 0 && (
                          <View style={styles.attrChipsRow}>
                            <Ionicons name="layers-outline" size={10} color={COLORS.textMuted} />
                            {parent.attribute_schema.map((attr: any, i: number) => (
                              <View key={i} style={styles.attrChip}>
                                <Text style={styles.attrChipText}>{attr.label}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <View style={styles.categoryMeta}>
                          <View style={[styles.statusBadge, { backgroundColor: parent.status === 'active' ? COLORS.success + '20' : COLORS.textMuted + '20' }]}>
                            <Text style={[styles.statusText, { color: parent.status === 'active' ? COLORS.success : COLORS.textMuted }]}>
                              {parent.status === 'active' ? 'Actif' : 'Inactif'}
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: COLORS.accent + '15', flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
                            <Ionicons name={STORE_TYPES.find(t => t.id === parent.store_type)?.icon as any || 'storefront-outline'} size={10} color={COLORS.accent} />
                            <Text style={[styles.statusText, { color: COLORS.accent }]}>
                              {STORE_TYPES.find(t => t.id === parent.store_type)?.title || 'Boutique'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.categoryActions}>
                      <TouchableOpacity style={styles.actionButton} onPress={() => handleCategoryAction(parent, 'edit')}>
                        <Ionicons name="create-outline" size={16} color={COLORS.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, parent.status === 'active' ? styles.deactivateButton : styles.activateButton]}
                        onPress={() => handleCategoryAction(parent, 'toggle')}
                      >
                        <Ionicons name={parent.status === 'active' ? 'pause' : 'play'} size={16} color={COLORS.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* ── Collapsible Content: Subcategories & Create Subcategory Button ── */}
                  {expandedParents.includes(parent.id) && (
                    <>
                      {/* ── Subcategory Rows ── */}
                      {children.length > 0 && (
                        <View style={styles.childrenContainer}>
                          {children.map((child, ci) => (
                            <View key={child.id} style={[styles.childRow, ci < children.length - 1 && styles.childRowBorder]}>
                              <View style={styles.childConnector}>
                                <View style={styles.childConnectorLine} />
                                <Ionicons name={child.icon} size={15} color={COLORS.textMuted} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.childName}>{child.name}</Text>
                                {/* Specific attributes */}
                                {child.attribute_schema && child.attribute_schema.length > 0 && (
                                  <View style={styles.attrChipsRow}>
                                    {child.attribute_schema.map((attr: any, ai: number) => (
                                      <View key={ai} style={[styles.attrChip, { backgroundColor: COLORS.accent + '10' }]}>
                                        <Text style={[styles.attrChipText, { color: COLORS.accent }]}>{attr.label}</Text>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                              <View style={{ flexDirection: 'row', gap: 4 }}>
                                <TouchableOpacity style={styles.childActionBtn} onPress={() => openEditModal(child)}>
                                  <Ionicons name="create-outline" size={14} color={COLORS.accent} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.childActionBtn} onPress={() => handleCategoryAction(child, 'delete')}>
                                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* + Add subcategory button */}
                      <TouchableOpacity
                        style={styles.addSubcatButton}
                        onPress={() => {
                          setEditingCategory(null);
                          setNewParentId(parent.id);
                          setNewStoreType(parent.store_type);
                          setAttributesList([]);
                          setAddModalVisible(true);
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={14} color={COLORS.accent} />
                        <Text style={styles.addSubcatButtonText}>Ajouter une sous-catégorie</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Card>
              </View>
            );
          })
        }

        {filteredCategories.filter(c => !c.parent_id).length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="grid-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucune catégorie trouvée</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  filterScrollContent: {
    gap: SPACING.xs,
    paddingRight: SPACING.lg,
  },
  filterCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    gap: 6,
  },
  filterCapsuleActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '15',
  },
  filterCapsuleText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  filterCapsuleTextActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  modalLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalStoreTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  modalStoreTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    gap: 4,
  },
  modalStoreTypeCardActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '15',
  },
  modalStoreTypeCardText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  modalStoreTypeCardTextActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  categoriesList: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  categoryCard: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  categoryDetails: {
    flex: 1,
  },
  categoryName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  productCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateButton: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  deactivateButton: {
    backgroundColor: COLORS.warning,
    borderColor: COLORS.warning,
  },
  categoryFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  createdAt: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  addModalContainer: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '90%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  addModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addModalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  addModalBody: {
    padding: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  iconGrid: {
    marginBottom: SPACING.md,
    maxHeight: 220,
  },
  iconOption: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    margin: SPACING.sm / 2,
  },
  iconSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  modalActionButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
  },
  modalActionText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  // ── Hierarchy ──
  parentGroup: {
    marginBottom: SPACING.md,
  },
  parentCard: {
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent + '60',
  },
  parentBadge: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  parentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  childrenContainer: {
    marginTop: SPACING.md,
    marginLeft: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
    paddingLeft: SPACING.sm,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  childRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  childConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  childConnectorLine: {
    width: 8,
    height: 1,
    backgroundColor: COLORS.border,
  },
  childName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  childActionBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSubcatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addSubcatButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.accent,
  },
  // ── Attribute Chips ──
  attrChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    alignItems: 'center',
  },
  attrChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  attrChipText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  // ── Parent selector ──
  parentSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  parentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  parentOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '15',
  },
  parentOptionText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  parentOptionTextActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  // ── Attribute Builder ──
  attrBuilderSection: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  attrBuilderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  attrBuilderTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  attrBuilderSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
    marginBottom: SPACING.md,
  },
  attrList: {
    gap: 2,
    marginBottom: SPACING.md,
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  attrRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  attrRowLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  attrRowMeta: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  attrDeleteBtn: {
    padding: 4,
  },
  attrForm: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  attrTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: SPACING.xs,
  },
  attrTypeBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  attrTypeBtnActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '15',
  },
  attrTypeBtnText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  attrTypeBtnTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  requiredToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requiredToggleActive: {},
  requiredToggleText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  addAttrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  addAttrButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  optionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 3,
  },
  optionChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  optionChipText: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
});

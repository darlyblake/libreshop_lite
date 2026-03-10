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
import { Card } from '../components/Card';
import { BackToDashboard } from '../components/BackToDashboard';
import { categoryService } from '../lib/categoryService';

interface Category {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: 'active' | 'inactive';
  createdAt: string;
}

export const AdminCategoriesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);

  const loadCategories = async () => {
    try {
      const data = await categoryService.getAll();
      // adapt response shape if necessary
      setCategories(
        data.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '-',
          icon: (c.icon as keyof typeof Ionicons.glyphMap) || 'grid-outline',
          status: c.status || 'active',
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
    return categories.filter(category =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [categories, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  // Add category modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState<string>('grid-outline');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // when a category is selected for editing, populate the inputs
  React.useEffect(() => {
    if (editingCategory) {
      setNewName(editingCategory.name);
      setNewDesc(editingCategory.description === '-' ? '' : editingCategory.description);
      setNewIcon(editingCategory.icon as string);
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
    console.log('openEditModal', cat);
    setEditingCategory(cat);
    setAddModalVisible(true);
  };
  const closeAddModal = () => {
    setAddModalVisible(false);
    setNewName('');
    setNewDesc('');
    setNewIcon('grid-outline');
    setEditingCategory(null);
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
        });
        setCategories(categories.map(c =>
          c.id === updatedRecord.id ? { ...c, name: updatedRecord.name, description: updatedRecord.description || '-', icon: (updatedRecord.icon as any) } : c
        ));
        Alert.alert('Catégorie modifiée', `${updatedRecord.name} a été mise à jour.`);
      } else {
        const created = await categoryService.create({
          name: newName.trim(),
          description: newDesc.trim() || '-',
          icon: newIcon as any,
          status: 'active',
        });
        const toAdd: Category = {
          id: created.id,
          name: created.name,
          description: created.description || '-',
          icon: (created.icon as any) || 'grid-outline',
          status: created.status || 'active',
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
          <Ionicons name="add" size={20} color={COLORS.white} />
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

            <View style={styles.addModalBody}>
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
                style={[styles.input, { height: 80 }]}
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
              />

              <Text style={{ color: COLORS.textMuted, marginBottom: 8 }}>Choisir une icône</Text>
              <FlatList
                data={ICON_OPTIONS}
                keyExtractor={(i) => i}
                numColumns={4}
                style={styles.iconGrid}
                contentContainerStyle={{ paddingBottom: SPACING.md }}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.iconOption,
                      item === newIcon ? styles.iconSelected : null,
                    ]}
                    onPress={() => setNewIcon(item)}
                  >
                    <Ionicons name={item as any} size={22} color={item === newIcon ? COLORS.white : COLORS.text} />
                  </TouchableOpacity>
                )}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalActionButton} onPress={closeAddModal}>
                  <Text style={styles.modalActionText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalActionButton, { backgroundColor: COLORS.accent }]} onPress={submitNewCategory}>
                  <Text style={[styles.modalActionText, { color: COLORS.white }]}>{editingCategory ? 'Mettre à jour' : 'Créer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
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
        {filteredCategories.map((category) => (
          <Card key={category.id} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryInfo}>
                <View style={styles.categoryIcon}>
                  <Ionicons 
                    name={category.icon} 
                    size={24} 
                    color={category.status === 'active' ? COLORS.accent : COLORS.textMuted} 
                  />
                </View>
                <View style={styles.categoryDetails}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryDescription}>{category.description}</Text>
                  <View style={styles.categoryMeta}>
                    <Text style={styles.productCount}>
                      Catégorie active
                    </Text>
                    <View style={[
                      styles.statusBadge,
                      { 
                        backgroundColor: category.status === 'active' 
                          ? COLORS.success + '20' 
                          : COLORS.textMuted + '20' 
                      }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { 
                          color: category.status === 'active' 
                            ? COLORS.success 
                            : COLORS.textMuted 
                        }
                      ]}>
                        {category.status === 'active' ? 'Actif' : 'Inactif'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              
              <View style={styles.categoryActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleCategoryAction(category, 'edit')}
                >
                  <Ionicons name="create-outline" size={18} color={COLORS.accent} />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    category.status === 'active' ? styles.deactivateButton : styles.activateButton
                  ]}
                  onPress={() => handleCategoryAction(category, 'toggle')}
                >
                  <Ionicons 
                    name={category.status === 'active' ? 'pause' : 'play'} 
                    size={18} 
                    color={COLORS.white} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.categoryFooter}>
              <Text style={styles.createdAt}>
                Créée le {new Date(category.createdAt).toLocaleDateString('fr-FR')}
              </Text>
            </View>
          </Card>
        ))}

        {filteredCategories.length === 0 && (
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
});

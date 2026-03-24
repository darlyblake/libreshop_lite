import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useResponsive } from '../utils/useResponsive';
import AddCollectionModal, { NewCollectionData } from '../components/AddCollectionModal';
import { useAuthStore } from '../store';
import { categoryService } from '../lib/categoryService';
import {
  collectionService,
  productService,
  storeService,
  type Category,
} from '../lib/supabase';

type UiCollection = {
  id: string;
  name: string;
  description: string;
  productCount: number;
  isActive: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  createdAt: string;
  updatedAt: string;
  parentCategoryId?: string;
  coverColor?: string;
};

// Couleurs pour les icônes
const ICON_COLORS = [
  COLORS.accent,
  COLORS.accent2,
  COLORS.success,
  COLORS.warning,
  COLORS.info,
  COLORS.danger,
];

export const SellerCollectionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { 
    spacing, 
    fontSize, 
    component, 
    isMobile, 
    isTablet, 
    isDesktop,
    width 
  } = useResponsive();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'productCount' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showInactive, setShowInactive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<UiCollection[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const store = await storeService.getByUser(user.id);
      if (!store?.id) {
        setStoreId(null);
        setCollections([]);
        return;
      }
      setStoreId(store.id);

      const [cats, cols, prods] = await Promise.all([
        categoryService.getAll(),
        collectionService.getByStore(store.id),
        productService.getByStoreAll(store.id),
      ]);
      setCategories(cats);

      const counts = new Map<string, number>();
      prods.forEach((p) => {
        const cid = String(p.collection_id || '').trim();
        if (!cid) return;
        counts.set(cid, (counts.get(cid) || 0) + 1);
      });

      const uiCols: UiCollection[] = cols.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        productCount: counts.get(c.id) || 0,
        isActive: !!c.is_active,
        icon: c.icon || 'folder-outline',
        createdAt: c.created_at ? String(c.created_at).slice(0, 10) : '',
        updatedAt: c.updated_at ? String(c.updated_at).slice(0, 10) : '',
        parentCategoryId: c.category_id || undefined,
        coverColor: c.cover_color || undefined,
      }));

      setCollections(uiCols);
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'load collections');
      Alert.alert('Erreur', 'Impossible de charger les collections');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }, [loadData]);

  const filteredCollections = useMemo(() => {
    let filtered = (collections || []).filter((collection) =>
      (showInactive ? true : collection.isActive) &&
      (collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       collection.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Tri
    filtered.sort((a: UiCollection, b: UiCollection) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sortBy === 'productCount') {
        return sortOrder === 'asc' 
          ? a.productCount - b.productCount
          : b.productCount - a.productCount;
      } else {
        return sortOrder === 'asc'
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [collections, searchQuery, showInactive, sortBy, sortOrder]);

  const stats = useMemo(() => ({
    total: (collections || []).length,
    active: (collections || []).filter((c: UiCollection) => c.isActive).length,
    totalProducts: (collections || []).reduce((sum: number, c: UiCollection) => sum + c.productCount, 0),
  }), [collections]);

  const handleAddCollection = async (data: NewCollectionData) => {
    if (!storeId) {
      Alert.alert('Erreur', 'Aucune boutique trouvée pour ce compte');
      return;
    }
    if (!data.parentCategoryId) {
      Alert.alert('Erreur', 'La catégorie parente est requise');
      return;
    }
    if (!data.name.trim()) {
      Alert.alert('Erreur', 'Le nom de la collection est requis');
      return;
    }

    try {
      const created = await collectionService.create({
        store_id: storeId,
        category_id: data.parentCategoryId,
        name: data.name.trim(),
        description: data.description || null,
        icon: data.icon,
        cover_color: data.coverColor || null,
        is_active: data.isActive ?? true,
      } as any);

      const uiCreated: UiCollection = {
        id: created.id,
        name: created.name,
        description: created.description || '',
        productCount: 0,
        isActive: !!created.is_active,
        icon: ((created as any).icon as any) || ('folder-outline' as any),
        createdAt: (created as any).created_at ? String((created as any).created_at).slice(0, 10) : '',
        updatedAt: (created as any).updated_at ? String((created as any).updated_at).slice(0, 10) : '',
        parentCategoryId: (created as any).category_id || undefined,
        coverColor: (created as any).cover_color || undefined,
      };

      setCollections((prev) => [uiCreated, ...prev]);
      setShowAddModal(false);
      Alert.alert('Succès', `Collection "${data.name}" ajoutée avec succès`);
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'create collection');
      Alert.alert('Erreur', "Impossible d'ajouter la collection");
    }
  };

  const handleDeleteCollection = (id: string, name: string) => {
    Alert.alert(
      'Supprimer la collection',
      `Êtes-vous sûr de vouloir supprimer la collection "${name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await collectionService.delete(id);
              setCollections((prev) => prev.filter((c) => c.id !== id));
              Alert.alert('Succès', 'Collection supprimée');
            } catch (e) {
              errorHandler.handleDatabaseError(e, 'delete collection');
              Alert.alert('Erreur', 'Impossible de supprimer la collection');
            }
          },
        }
      ]
    );
  };

  const toggleCollectionStatus = (id: string, currentStatus: boolean) => {
    Alert.alert(
      currentStatus ? 'Désactiver' : 'Activer',
      `Voulez-vous ${currentStatus ? 'désactiver' : 'activer'} cette collection ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await collectionService.update(id, { is_active: !currentStatus } as any);
              setCollections((prev) =>
                prev.map((c) => (c.id === id ? { ...c, isActive: !currentStatus } : c))
              );
              Alert.alert('Succès', `Collection ${currentStatus ? 'désactivée' : 'activée'}`);
            } catch (e) {
              errorHandler.handleDatabaseError(e, 'toggle collection status');
              Alert.alert('Erreur', "Impossible de modifier l'état");
            }
          },
        }
      ]
    );
  };

  const renderCollection = (collection: UiCollection, index: number) => {
    const iconColor = ICON_COLORS[index % ICON_COLORS.length];
    const isGridView = viewMode === 'grid' && (isTablet || isDesktop);

    if (isGridView) {
      return (
        <TouchableOpacity
          key={collection.id}
          style={[
            styles.gridCard,
            {
              width: isDesktop ? '33.33%' : '50%',
              padding: spacing.lg,
              marginBottom: spacing.md,
              backgroundColor: COLORS.card,
              borderRadius: component.cardBorderRadius,
            }
          ]}
          onPress={() => navigation.navigate('SellerEditCollection', { collectionId: collection.id })}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[iconColor + '20', 'transparent']}
            style={styles.gridGradient}
          />
          
          <View style={[styles.gridIcon, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={collection.icon} size={fontSize.xxxl} color={iconColor} />
          </View>
          
          <Text style={[styles.gridName, { fontSize: fontSize.lg }]} numberOfLines={1}>
            {collection.name}
          </Text>
          
          <Text style={[styles.gridDescription, { fontSize: fontSize.sm }]} numberOfLines={2}>
            {collection.description}
          </Text>
          
          <View style={styles.gridFooter}>
            <View style={styles.gridStats}>
              <Ionicons name="cube-outline" size={fontSize.sm} color={COLORS.textMuted} />
              <Text style={[styles.gridCount, { fontSize: fontSize.sm }]}>
                {collection.productCount} produits
              </Text>
            </View>
            
            <View style={[
              styles.gridStatus,
              { backgroundColor: collection.isActive ? COLORS.success + '20' : COLORS.textMuted + '20' }
            ]}>
              <Ionicons 
                name={collection.isActive ? 'checkmark-circle' : 'close-circle'} 
                size={fontSize.sm} 
                color={collection.isActive ? COLORS.success : COLORS.textMuted} 
              />
            </View>
          </View>
          
          {null}
        </TouchableOpacity>
      );
    }

    return (
      <View 
        key={collection.id} 
        style={[
          styles.collectionCard,
          {
            padding: spacing.lg,
            marginBottom: spacing.md,
            backgroundColor: COLORS.card,
            borderRadius: component.cardBorderRadius,
          }
        ]}
      >
        <LinearGradient
          colors={[iconColor + '10', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardGradient}
        />

        <View style={styles.collectionHeader}>
          <View style={styles.collectionInfo}>
            <View style={[styles.collectionIcon, { backgroundColor: iconColor }]}>
              <Ionicons name={collection.icon} size={fontSize.xl} color={COLORS.text} />
            </View>
            
            <View style={styles.collectionDetails}>
              <View style={styles.collectionTitleRow}>
                <Text style={[styles.collectionName, { fontSize: fontSize.lg }]}>
                  {collection.name}
                </Text>
                {null}
              </View>
              
              <Text style={[styles.collectionDescription, { fontSize: fontSize.sm }]} numberOfLines={2}>
                {collection.description}
              </Text>
              
              <View style={styles.collectionMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="cube-outline" size={fontSize.xs} color={COLORS.textMuted} />
                  <Text style={[styles.metaText, { fontSize: fontSize.xs }]}>
                    {collection.productCount} produits
                  </Text>
                </View>
                
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={fontSize.xs} color={COLORS.textMuted} />
                  <Text style={[styles.metaText, { fontSize: fontSize.xs }]}>
                    {collection.updatedAt}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.statusToggle,
              { backgroundColor: collection.isActive ? COLORS.success : COLORS.textMuted }
            ]}
            onPress={() => toggleCollectionStatus(collection.id, collection.isActive)}
          >
            <Ionicons 
              name={collection.isActive ? 'checkmark' : 'close'} 
              size={fontSize.sm} 
              color={COLORS.text} 
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.collectionActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]}
            onPress={() => navigation.navigate('SellerEditCollection', { collectionId: collection.id })}
          >
            <Ionicons name="create-outline" size={fontSize.md} color={COLORS.accent} />
            <Text style={[styles.actionText, { fontSize: fontSize.sm }]}>Modifier</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.productsButton]}
            onPress={() => navigation.navigate('SellerCollectionProducts', { collectionId: collection.id })}
          >
            <Ionicons name="cube-outline" size={fontSize.md} color={COLORS.accent2} />
            <Text style={[styles.actionText, { fontSize: fontSize.sm, color: COLORS.accent2 }]}>
              Produits
            </Text>
          </TouchableOpacity>
          
          {null}
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteCollection(collection.id, collection.name)}
          >
            <Ionicons name="trash-outline" size={fontSize.md} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    headerTitle: {
      fontSize: fontSize.heading,
      fontWeight: '700',
      color: COLORS.text,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    backButton: {
      marginRight: spacing.md,
    },
    headerButton: {
      width: component.buttonHeight,
      height: component.buttonHeight,
      borderRadius: component.buttonHeight / 2,
      backgroundColor: COLORS.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerButtonOutline: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    statItem: {
      flex: 1,
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    statLabel: {
      color: COLORS.textSoft,
      marginBottom: spacing.xs,
    },
    statValue: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: COLORS.text,
    },
    statSub: {
      fontSize: fontSize.xs,
      color: COLORS.textMuted,
      marginTop: 2,
    },
    searchContainer: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.card,
      borderRadius: component.inputBorderRadius,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: spacing.sm,
    },
    searchInput: {
      flex: 1,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: COLORS.text,
    },
    filterBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    filterTabs: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    filterTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    filterTabActive: {
      backgroundColor: COLORS.accent,
      borderColor: COLORS.accent,
    },
    filterTabText: {
      fontSize: fontSize.sm,
      color: COLORS.text,
    },
    filterTabTextActive: {
      color: COLORS.text,
    },
    viewToggle: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    viewButton: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: COLORS.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    viewButtonActive: {
      backgroundColor: COLORS.accent,
      borderColor: COLORS.accent,
    },
    collectionsContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    gridCard: {
      borderWidth: 1,
      borderColor: COLORS.border,
      position: 'relative',
      overflow: 'hidden',
    },
    gridGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 100,
    },
    gridIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    gridName: {
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: spacing.xs,
    },
    gridDescription: {
      color: COLORS.textSoft,
      marginBottom: spacing.md,
      lineHeight: fontSize.sm * 1.4,
    },
    gridFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    gridStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    gridCount: {
      color: COLORS.textMuted,
    },
    gridStatus: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    collectionCard: {
      borderWidth: 1,
      borderColor: COLORS.border,
      position: 'relative',
      overflow: 'hidden',
    },
    cardGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
    },
    collectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    collectionInfo: {
      flex: 1,
      flexDirection: 'row',
      gap: spacing.md,
    },
    collectionIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    collectionDetails: {
      flex: 1,
    },
    collectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: 2,
    },
    collectionName: {
      fontWeight: '600',
      color: COLORS.text,
    },
    collectionDescription: {
      color: COLORS.textSoft,
      marginBottom: spacing.xs,
      lineHeight: fontSize.sm * 1.4,
    },
    collectionMeta: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      color: COLORS.textMuted,
    },
    statusToggle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    collectionActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: RADIUS.md,
    },
    editButton: {
      backgroundColor: COLORS.accent + '10',
    },
    productsButton: {
      backgroundColor: COLORS.accent2 + '10',
    },
    deleteButton: {
      flex: 0.2,
      backgroundColor: COLORS.danger + '10',
    },
    actionText: {
      color: COLORS.accent,
      fontWeight: '500',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxxl,
    },
    emptyStateIcon: {
      marginBottom: spacing.lg,
    },
    emptyStateTitle: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: spacing.sm,
    },
    emptyStateText: {
      fontSize: fontSize.md,
      color: COLORS.textSoft,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    emptyStateButton: {
      backgroundColor: COLORS.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: RADIUS.lg,
    },
    emptyStateButtonText: {
      color: COLORS.text,
      fontWeight: '600',
      fontSize: fontSize.md,
    },
    loadingContainer: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    loadingText: {
      color: COLORS.textMuted,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    modalContent: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.xl,
      width: '100%',
      maxWidth: isDesktop ? 600 : 400,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    modalTitle: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: COLORS.text,
    },
    modalBody: {
      padding: spacing.lg,
    },
    inputGroup: {
      marginBottom: spacing.lg,
    },
    inputLabel: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: spacing.xs,
    },
    required: {
      color: COLORS.danger,
    },
    input: {
      backgroundColor: COLORS.bg,
      borderRadius: RADIUS.md,
      padding: spacing.md,
      fontSize: fontSize.md,
      color: COLORS.text,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    iconSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    iconOption: {
      width: 50,
      height: 50,
      borderRadius: 25,
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
    categoryOption: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginRight: SPACING.sm,
      backgroundColor: COLORS.card,
    },
    categoryOptionSelected: {
      backgroundColor: COLORS.accent,
      borderColor: COLORS.accent,
    },
    categoryOptionText: {
      color: COLORS.text,
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    modalButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: RADIUS.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    cancelButtonText: {
      color: COLORS.text,
      fontWeight: '500',
    },
    confirmButton: {
      backgroundColor: COLORS.accent,
    },
    confirmButtonText: {
      color: COLORS.text,
      fontWeight: '600',
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      {/* Header avec stats */}
      <LinearGradient
        colors={[COLORS.accent + '10', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            {/* back arrow to seller dashboard */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.headerButtonOutline, styles.backButton]}
                onPress={() => navigation.navigate('SellerDashboard')}
              >
                <Ionicons name="arrow-back" size={fontSize.lg} color={COLORS.text} />
              </TouchableOpacity>

              <Text style={styles.headerTitle}>Collections</Text>
            </View>

            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={[styles.headerButton, styles.headerButtonOutline]}
                onPress={() => setShowInactive(!showInactive)}
              >
                <Ionicons 
                  name={showInactive ? 'eye' : 'eye-off'} 
                  size={fontSize.lg} 
                  color={showInactive ? COLORS.accent : COLORS.textMuted} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => {
                  if (!storeId) {
                    Alert.alert('Erreur', 'Aucune boutique trouvée pour ce compte');
                    return;
                  }
                  setShowAddModal(true);
                }}
              >
                <Ionicons name="add" size={fontSize.lg} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { fontSize: fontSize.xs }]}>Total</Text>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statSub}>collections</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { fontSize: fontSize.xs }]}>Actives</Text>
              <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.active}</Text>
              <Text style={styles.statSub}>collections</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { fontSize: fontSize.xs }]}>Produits</Text>
              <Text style={[styles.statValue, { color: COLORS.accent }]}>{stats.totalProducts}</Text>
              <Text style={styles.statSub}>au total</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={fontSize.md} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une collection..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={fontSize.md} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Barre de filtres */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterTabs}>
            <TouchableOpacity 
              style={[
                styles.filterTab,
                sortBy === 'name' && styles.filterTabActive
              ]}
              onPress={() => {
                if (sortBy === 'name') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('name');
                  setSortOrder('asc');
                }
              }}
            >
              <Ionicons 
                name="text" 
                size={fontSize.sm} 
                color={sortBy === 'name' ? COLORS.text : COLORS.textMuted} 
              />
              <Text style={[
                styles.filterTabText,
                sortBy === 'name' && styles.filterTabTextActive
              ]}>
                Nom
              </Text>
              {sortBy === 'name' && (
                <Ionicons 
                  name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} 
                  size={fontSize.xs} 
                  color={COLORS.text} 
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.filterTab,
                sortBy === 'productCount' && styles.filterTabActive
              ]}
              onPress={() => {
                if (sortBy === 'productCount') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('productCount');
                  setSortOrder('desc');
                }
              }}
            >
              <Ionicons 
                name="cube" 
                size={fontSize.sm} 
                color={sortBy === 'productCount' ? COLORS.text : COLORS.textMuted} 
              />
              <Text style={[
                styles.filterTabText,
                sortBy === 'productCount' && styles.filterTabTextActive
              ]}>
                Produits
              </Text>
              {sortBy === 'productCount' && (
                <Ionicons 
                  name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} 
                  size={fontSize.xs} 
                  color={COLORS.text} 
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.filterTab,
                sortBy === 'date' && styles.filterTabActive
              ]}
              onPress={() => {
                if (sortBy === 'date') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('date');
                  setSortOrder('desc');
                }
              }}
            >
              <Ionicons 
                name="calendar" 
                size={fontSize.sm} 
                color={sortBy === 'date' ? COLORS.text : COLORS.textMuted} 
              />
              <Text style={[
                styles.filterTabText,
                sortBy === 'date' && styles.filterTabTextActive
              ]}>
                Date
              </Text>
              {sortBy === 'date' && (
                <Ionicons 
                  name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} 
                  size={fontSize.xs} 
                  color={COLORS.text} 
                />
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Toggle vue grille/liste pour tablette/desktop */}
        {(isTablet || isDesktop) && (
          <View style={styles.viewToggle}>
            <TouchableOpacity 
              style={[
                styles.viewButton,
                viewMode === 'list' && styles.viewButtonActive
              ]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons 
                name="list" 
                size={fontSize.md} 
                color={viewMode === 'list' ? COLORS.text : COLORS.textMuted} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.viewButton,
                viewMode === 'grid' && styles.viewButtonActive
              ]}
              onPress={() => setViewMode('grid')}
            >
              <Ionicons 
                name="grid" 
                size={fontSize.md} 
                color={viewMode === 'grid' ? COLORS.text : COLORS.textMuted} 
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Liste des collections */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[
          styles.collectionsContainer,
          viewMode === 'grid' && styles.gridContainer
        ]}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.accent} />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : filteredCollections.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={80} color={COLORS.textMuted} style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateTitle}>Aucune collection</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery 
                  ? "Aucune collection ne correspond à votre recherche"
                  : "Commencez par créer votre première collection"}
              </Text>
              <TouchableOpacity 
                style={styles.emptyStateButton}
                onPress={() => {
                  if (!storeId) {
                    Alert.alert('Erreur', 'Aucune boutique trouvée pour ce compte');
                    return;
                  }
                  setShowAddModal(true);
                }}
              >
                <Text style={styles.emptyStateButtonText}>Créer une collection</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredCollections.map((collection, index) => renderCollection(collection, index))
          )}
        </View>
      </ScrollView>

      {/* modal d'ajout encapsulé dans un composant réutilisable */}
      <AddCollectionModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddCollection}
        categories={(categories || []).map((c) => ({
          id: c.id,
          name: c.name,
          icon: (c as any).icon,
        }))}
      />
    </View>
  );
};

export default SellerCollectionScreen;

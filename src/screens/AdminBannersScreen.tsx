import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { RootStackParamList } from '../navigation/types';
import { homeBannerService, HomeBanner } from '../lib/supabase';
import { LoadingSpinner } from '../components/LoadingSpinner';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FilterType = 'all' | 'carousel' | 'promo';

export const AdminBannersScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [filteredBanners, setFilteredBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [deleteModal, setDeleteModal] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState<HomeBanner | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadBanners = useCallback(async () => {
    try {
      setLoading(true);
      const data = await homeBannerService.getAll();
      setBanners(data || []);
    } catch (error) {
      console.error('Error loading banners:', error);
      Alert.alert('Erreur', 'Impossible de charger les bannières');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBanners();
    setRefreshing(false);
  }, [loadBanners]);

  const handleDelete = useCallback(async () => {
    if (!bannerToDelete) return;
    
    try {
      setDeleting(true);
      await homeBannerService.delete(bannerToDelete.id);
      setBanners(prev => prev.filter(b => b.id !== bannerToDelete.id));
      setDeleteModal(false);
      setBannerToDelete(null);
      Alert.alert('Succès', 'Bannière supprimée avec succès');
    } catch (error) {
      console.error('Error deleting banner:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la bannière');
    } finally {
      setDeleting(false);
    }
  }, [bannerToDelete]);

  const toggleBannerStatus = useCallback(async (banner: HomeBanner) => {
    try {
      await homeBannerService.update(banner.id, { 
        is_active: !banner.is_active 
      });
      setBanners(prev => prev.map(b => 
        b.id === banner.id ? { ...b, is_active: !b.is_active } : b
      ));
    } catch (error) {
      console.error('Error toggling banner status:', error);
      Alert.alert('Erreur', 'Impossible de modifier le statut de la bannière');
    }
  }, []);

  const confirmDelete = useCallback((banner: HomeBanner) => {
    setBannerToDelete(banner);
    setDeleteModal(true);
  }, []);

  // Filter banners based on selected filter
  useEffect(() => {
    if (filter === 'all') {
      setFilteredBanners(banners);
    } else {
      setFilteredBanners(banners.filter(b => b.placement === filter));
    }
  }, [banners, filter]);

  useFocusEffect(
    useCallback(() => {
      loadBanners();
    }, [loadBanners])
  );

  const renderBannerItem = useCallback(({ item, index }: { item: HomeBanner; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50)}
      layout={Layout.springify()}
      style={styles.bannerItem}
    >
      <View style={styles.bannerHeader}>
        <View style={styles.bannerInfo}>
          <View style={[styles.placementBadge, { 
            backgroundColor: item.placement === 'carousel' ? COLORS.accent : COLORS.success 
          }]}>
            <Text style={styles.placementText}>
              {item.placement === 'carousel' ? 'CAROUSEL' : 'PROMO'}
            </Text>
          </View>
          <Text style={styles.bannerTitle}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.bannerSubtitle} numberOfLines={2}>
              {item.subtitle}
            </Text>
          )}
        </View>
        <View style={styles.bannerActions}>
          <TouchableOpacity
            style={[styles.statusButton, { 
              backgroundColor: item.is_active ? COLORS.success : COLORS.textMuted 
            }]}
            onPress={() => toggleBannerStatus(item)}
          >
            <Ionicons 
              name={item.is_active ? 'checkmark-circle' : 'close-circle'} 
              size={20} 
              color="white" 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('AdminBannerForm', { bannerId: item.id })}
          >
            <Ionicons name="create-outline" size={20} color={COLORS.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => confirmDelete(item)}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.bannerDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Position:</Text>
          <Text style={styles.detailValue}>{item.position}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Navigation:</Text>
          <Text style={styles.detailValue}>{item.link_screen || 'Aucune'}</Text>
        </View>
        {item.image_url && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Image:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {item.image_url.substring(0, 50)}...
            </Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Créé le:</Text>
          <Text style={styles.detailValue}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </Animated.View>
  ), [navigation, toggleBannerStatus, confirmDelete]);

  const renderFilterChip = useCallback((filterType: FilterType) => {
    const isActive = filter === filterType;
    const count = filterType === 'all' 
      ? banners.length 
      : banners.filter(b => b.placement === filterType).length;
    
    return (
      <TouchableOpacity
        key={filterType}
        style={[styles.filterChip, isActive && styles.filterChipActive]}
        onPress={() => setFilter(filterType)}
      >
        <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
          {filterType === 'all' ? 'Tous' : filterType.toUpperCase()} ({count})
        </Text>
      </TouchableOpacity>
    );
  }, [filter, banners]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Gestion des Bannières</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AdminBannerForm')}
        >
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {(['all', 'carousel', 'promo'] as FilterType[]).map(renderFilterChip)}
      </View>

      {/* Banners List */}
      <FlatList
        data={filteredBanners}
        renderItem={renderBannerItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="image-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'Aucune bannière' : `Aucune bannière ${filter}`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all' 
                ? 'Ajoutez votre première bannière pour commencer' 
                : `Essayez de changer le filtre ou ajoutez une bannière ${filter}`
              }
            </Text>
          </View>
        }
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="warning" size={48} color={COLORS.danger} />
            <Text style={styles.modalTitle}>Confirmer la suppression</Text>
            <Text style={styles.modalMessage}>
              Êtes-vous sûr de vouloir supprimer la bannière "{bannerToDelete?.title}" ?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Supprimer</Text>
                )}
              </TouchableOpacity>
            </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  addButtonText: {
    color: 'white',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterChipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  filterChipTextActive: {
    color: 'white',
  },
  listContainer: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  bannerItem: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  bannerInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  placementBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  placementText: {
    color: 'white',
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  bannerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  bannerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDetails: {
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  modalMessage: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  confirmButton: {
    backgroundColor: COLORS.danger,
  },
  cancelButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: 'white',
  },
});

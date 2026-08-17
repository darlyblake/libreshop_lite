import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { barService, BarPhoto } from '../services/barService';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - SPACING.md * 3) / 2; // 2 columns

type TabType = 'pending' | 'approved' | 'rejected';

export const BarPhotosScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fontSize } = useResponsive();
  const isFocused = useIsFocused();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<BarPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  const loadData = async (showLoading = true) => {
    if (!user?.id) return;
    try {
      if (showLoading) setLoading(true);
      const s = await storeService.getByUser(user.id);
      if (s) {
        setStoreId(s.id);
        const storePhotos = await barService.getPhotosByStore(s.id, activeTab);
        setPhotos(storePhotos);
      }
    } catch (e) {
      console.error('Error loading photos:', e);
      Alert.alert('Erreur', 'Impossible de charger les photos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [user?.id, isFocused, activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleUpdateStatus = async (photoId: string, status: TabType) => {
    try {
      await barService.updatePhotoStatus(photoId, status);
      // Retirer la photo de la liste actuelle
      setPhotos(photos.filter(p => p.id !== photoId));
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo.');
    }
  };

  const handleFeatureToggle = async (photoId: string, isFeatured: boolean) => {
    try {
      await barService.setPhotoFeatured(photoId, !isFeatured);
      setPhotos(photos.map(p => 
        p.id === photoId 
          ? { ...p, featured_at: !isFeatured ? new Date().toISOString() : null } 
          : p
      ));
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre en vedette la photo.');
    }
  };

  const renderTab = (tab: TabType, label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: fontSize.xl }]}>
          Modération Photos
        </Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={styles.tabsContainer}>
        {renderTab('pending', 'En attente')}
        {renderTab('approved', 'Publiées')}
        {renderTab('rejected', 'Refusées')}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xxl }} />
        ) : photos.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={64} color={COLORS.border} />
            <Text style={[styles.emptyStateText, { fontSize: fontSize.md }]}>
              Aucune photo dans cette catégorie
            </Text>
          </View>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoCard}>
                <Image source={{ uri: photo.photo_url }} style={styles.photoImage} />
                
                {/* Overlay actions depending on tab */}
                <View style={styles.actionOverlay}>
                  {activeTab === 'pending' && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: COLORS.danger }]}
                        onPress={() => handleUpdateStatus(photo.id, 'rejected')}
                      >
                        <Ionicons name="close" size={24} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
                        onPress={() => handleUpdateStatus(photo.id, 'approved')}
                      >
                        <Ionicons name="checkmark" size={24} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {activeTab === 'approved' && (
                    <View style={styles.actionRowTop}>
                      <TouchableOpacity 
                        style={[styles.featureBtn, photo.featured_at ? styles.featureBtnActive : null]}
                        onPress={() => handleFeatureToggle(photo.id, !!photo.featured_at)}
                      >
                        <Ionicons name={photo.featured_at ? "star" : "star-outline"} size={20} color={photo.featured_at ? COLORS.warning : "#FFF"} />
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.actionBtnSmall, { backgroundColor: COLORS.danger }]}
                        onPress={() => handleUpdateStatus(photo.id, 'rejected')}
                      >
                        <Ionicons name="trash" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {activeTab === 'rejected' && (
                    <View style={styles.actionRowTop}>
                      <TouchableOpacity 
                        style={[styles.actionBtnSmall, { backgroundColor: COLORS.success }]}
                        onPress={() => handleUpdateStatus(photo.id, 'approved')}
                      >
                        <Ionicons name="refresh" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {photo.likes_count !== undefined && photo.likes_count > 0 && (
                  <View style={styles.likesBadge}>
                    <Ionicons name="heart" size={12} color={COLORS.danger} />
                    <Text style={styles.likesText}>{photo.likes_count}</Text>
                  </View>
                )}
              </View>
            ))}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: COLORS.primary,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    marginTop: SPACING.xxl,
  },
  emptyStateText: {
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  photoCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.2,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: SPACING.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  actionRowTop: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  featureBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  featureBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: COLORS.warning,
  },
  likesBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  likesText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
export default BarPhotosScreen;

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
  Dimensions,
  Switch
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
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { cloudinaryService } from '../services/cloudinaryService';

// Fixed size so it doesn't get huge on desktop web browsers
const PHOTO_SIZE = 150; 

type TabType = 'pending' | 'approved' | 'rejected';

export const BarPhotosScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fontSize } = useResponsive();
  const isFocused = useIsFocused();

  const [store, setStore] = useState<any>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<BarPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [isAutoValidate, setIsAutoValidate] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDecoration, setSelectedDecoration] = useState<string>('none');
  const [selectedTheme, setSelectedTheme] = useState<string>('default');
  const [customPrimaryColor, setCustomPrimaryColor] = useState<string>('#000000');
  const [showThemePanel, setShowThemePanel] = useState(false);

  const handleUploadPhoto = async () => {
    if (!storeId || !user) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const photoUrl = await cloudinaryService.uploadImage(result.assets[0].uri);
        if (!photoUrl) throw new Error("Upload failed");

        await barService.uploadClientPhoto({
          store_id: storeId,
          user_id: user.id,
          image_url: photoUrl,
          decoration_type: selectedDecoration
        });

        Alert.alert('Succès', 'Photo ajoutée au mur avec succès !');
        loadData(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter la photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!storeId) return;
    try {
      await barService.updateStoreTheme(storeId, {
        tv_wall_theme: selectedTheme,
        tv_primary_color: selectedTheme === 'custom' ? customPrimaryColor : undefined,
      });
      Alert.alert('Thème mis à jour', 'Le thème de la TV a été changé !');
      setShowThemePanel(false);
    } catch (error) {
      console.error('Theme update error:', error);
      Alert.alert('Erreur', 'Impossible de changer le thème.');
    }
  };

  const loadData = async (showLoading = true) => {
    if (!user?.id) return;
    try {
      if (showLoading) setLoading(true);
      const s = await storeService.getByUser(user.id);
      if (s) {
        setStore(s);
        setStoreId(s.id);
        setIsAutoValidate(!!s.is_photo_auto_validate);
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

  // ── Realtime subscription : detect new/updated photos live ──
  useEffect(() => {
    if (!storeId) return;
    const channel = barService.subscribeToPhotos(storeId, () => {
      // Reload without spinner to avoid flicker
      loadData(false);
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

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

  const handleToggleAutoValidate = async (value: boolean) => {
    if (!storeId) return;
    setIsAutoValidate(value);
    try {
      await barService.updateStoreAutoValidate(storeId, value);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de modifier ce réglage');
      setIsAutoValidate(!value);
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleUploadPhoto}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="camera" size={24} color="#FFF" />
          )}
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.tabsContainer}>
        {renderTab('pending', 'En attente')}
        {renderTab('approved', 'Publiées')}
        {renderTab('rejected', 'Refusées')}
      </View>

      <View style={styles.autoValidateContainer}>
        <View>
          <Text style={styles.autoValidateTitle}>Auto-validation</Text>
          <Text style={styles.autoValidateSubtitle}>Publier les photos sans modération</Text>
        </View>
        <Switch
          value={isAutoValidate}
          onValueChange={handleToggleAutoValidate}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
        />
      </View>

      {/* Theme Selector Button */}
      <TouchableOpacity style={styles.themeSelectorBtn} onPress={() => setShowThemePanel(p => !p)}>
        <Ionicons name="color-palette" size={20} color="#FFF" />
        <Text style={styles.addPhotoBtnText}>Thème de la TV</Text>
        <Ionicons name={showThemePanel ? 'chevron-up' : 'chevron-down'} size={18} color="#FFF" />
      </TouchableOpacity>

      {/* Theme Panel (collapsible) */}
      {showThemePanel && (
        <View style={styles.themePanel}>
          <Text style={styles.themePanelTitle}>🎨 Choisir le thème</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
            {[
              { id: 'default', label: 'Défaut', icon: '🌑' },
              { id: 'christmas', label: 'Noël', icon: '🎄' },
              { id: 'halloween', label: 'Halloween', icon: '🎃' },
              { id: 'valentine', label: 'St-Valentin', icon: '❤️' },
              { id: 'newyear', label: 'Nouvel An', icon: '🎆' },
            ].map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.themeChip, selectedTheme === t.id && styles.themeChipActive]}
                onPress={() => setSelectedTheme(t.id)}
              >
                <Text style={styles.themeChipIcon}>{t.icon}</Text>
                <Text style={[styles.themeChipLabel, selectedTheme === t.id && styles.themeChipLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.themeApplyBtn} onPress={handleSaveTheme}>
            <Text style={styles.themeApplyBtnText}>✅ Appliquer ce thème</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Decoration Picker for manager uploads */}
      <View style={styles.decorationBar}>
        <Text style={styles.decorationBarLabel}>Occasion :</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { id: 'none', icon: '📷', label: 'Aucune' },
            { id: 'birthday', icon: '🎂', label: 'Anniversaire' },
            { id: 'wedding', icon: '💍', label: 'Mariage' },
            { id: 'graduation', icon: '🎓', label: 'Diplôme' },
            { id: 'party', icon: '🎉', label: 'Fête' },
          ].map(dec => (
            <TouchableOpacity
              key={dec.id}
              style={[styles.decorationChip, selectedDecoration === dec.id && styles.decorationChipActive]}
              onPress={() => setSelectedDecoration(dec.id)}
            >
              <Text style={styles.decorationChipText}>{dec.icon} {dec.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={styles.addPhotoBtn}
        onPress={handleUploadPhoto}
        disabled={isUploading}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Ionicons name="camera" size={20} color="#FFF" />
        )}
        <Text style={styles.addPhotoBtnText}>
          {isUploading ? 'Envoi...' : 'Ajouter une photo sur le mur'}
        </Text>
      </TouchableOpacity>
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
                <Image source={{ uri: (photo as any).image_url || (photo as any).photo_url }} style={styles.photoImage} />
                
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
  autoValidateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  autoValidateTitle: {
    fontWeight: 'bold',
    color: COLORS.text,
    fontSize: 16,
  },
  autoValidateSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  addPhotoBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
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
  themeSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  themePanel: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  themePanelTitle: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: SPACING.md,
  },
  themeChip: {
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    minWidth: 70,
  },
  themeChipActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99,102,241,0.3)',
  },
  themeChipIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  themeChipLabel: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  themeChipLabelActive: {
    color: '#FFF',
  },
  themeApplyBtn: {
    backgroundColor: '#6366f1',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  themeApplyBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  decorationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  decorationBarLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
  decorationChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  decorationChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '30',
  },
  decorationChipText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
});
export default BarPhotosScreen;

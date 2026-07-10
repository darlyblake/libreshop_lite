import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuthStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { storeService } from '../services/storeService';
import { cloudinaryService } from '../services/cloudinaryService';
import * as ImagePicker from 'expo-image-picker';
import { useSupabase } from '../lib/supabase';
import { errorHandler } from '../utils/errorHandler';

type RootStackParamList = {
  SellerPromoBanners: { storeId?: string } | undefined;
};

type SellerPromoBannersRouteProp = RouteProp<RootStackParamList, 'SellerPromoBanners'>;

interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  targetType: 'collection' | 'product' | 'url';
  targetId?: string;
  targetUrl?: string;
  enabled: boolean;
}

export const SellerPromoBannersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuthStore();
  const { getColor, spacing, radius, fontSize } = useTheme();
  const COLORS = getColor;
  const SPACING = spacing;
  const RADIUS = radius;
  const FONT_SIZE = fontSize;

  const routeStoreId = route.params?.storeId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<any>(null);
  const [allStores, setAllStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(routeStoreId || null);
  const [promoData, setPromoData] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    targetType: 'collection' as 'collection' | 'product' | 'url',
    targetId: '',
    targetUrl: '',
  });
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    loadStore();
  }, [selectedStoreId]);

  const loadStore = async () => {
    try {
      if (!user?.id) return;
      const client = useSupabase();

      // Charger toutes les boutiques du vendeur (pour le sélecteur multi-boutique)
      const { data: stores, error: storesError } = await client
        .from('stores')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (storesError) throw storesError;
      setAllStores(stores || []);

      // Déterminer quelle boutique afficher
      // Priorité : storeId passé en param de route > storeId sélectionné > première boutique
      const targetId = selectedStoreId || (stores && stores.length > 0 ? stores[0].id : null);

      if (!targetId || !stores || stores.length === 0) {
        setLoading(false);
        return;
      }

      // Si pas encore de store sélectionné, on fixe la sélection sur la première boutique
      if (!selectedStoreId && stores.length > 0) {
        setSelectedStoreId(stores[0].id);
      }

      const s = stores.find((st: any) => st.id === targetId) || stores[0];
      console.log('Store loaded:', s?.id, s?.name);

      if (s) {
        setStore(s);
        setPromoData({
          title: String(s.promo_title || ''),
          subtitle: String(s.promo_subtitle || ''),
          imageUrl: String(s.promo_image_url || ''),
          targetType: (s.promo_target_type as any) || 'collection',
          targetId: String(s.promo_target_id || ''),
          targetUrl: String(s.promo_target_url || ''),
        });
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'load store');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la galerie');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) {
      setPromoData(prev => ({ ...prev, imageUrl: result.assets[0].uri }));
    }
  };

  const savePromo = async () => {
    try {
      if (!store?.id) {
        Alert.alert('Erreur', 'Aucune boutique trouvée');
        return;
      }

      // Validation
      if (!promoData.title.trim()) {
        Alert.alert('Erreur', 'Le titre est requis');
        return;
      }
      if (!promoData.imageUrl) {
        Alert.alert('Erreur', 'Une image est requise');
        return;
      }

      setSaving(true);

      let promoImageUrl = promoData.imageUrl;
      if (promoImageUrl && !promoImageUrl.startsWith('http')) {
        try {
          promoImageUrl = await cloudinaryService.uploadImage(promoImageUrl, { folder: `stores/${store.id}/promos` });
        } catch (uploadError) {
          Alert.alert('Erreur', 'Impossible d\'uploader l\'image. Vérifiez votre connexion.');
          return;
        }
      }

      const updatePayload: any = {
        promo_enabled: true,
        promo_title: promoData.title || null,
        promo_subtitle: promoData.subtitle || null,
        promo_image_url: promoImageUrl || null,
        promo_target_type: promoData.targetType || null,
        promo_target_id: promoData.targetId || null,
        promo_target_url: promoData.targetUrl || null,
      };

      await storeService.update(store.id, updatePayload);
      
      Alert.alert('Succès', 'Bannière enregistrée avec succès');
      setEditModalVisible(false);
      loadStore();
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'save promo');
      Alert.alert('Erreur', 'Impossible d\'enregistrer la bannière: ' + (e as any)?.message || 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const deletePromo = async () => {
    Alert.alert(
      'Supprimer la bannière',
      'Êtes-vous sûr de vouloir supprimer cette bannière publicitaire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting promo for store:', store?.id);
              if (!store?.id) {
                console.log('No store id');
                return;
              }
              // ✅ FIX: utiliser null (pas undefined) pour effacer les champs en BDD
              // undefined est ignoré par JSON.stringify donc Supabase ne reçoit jamais la valeur
              const updatePayload = {
                promo_enabled: false,
                promo_title: null,
                promo_subtitle: null,
                promo_image_url: null,
                promo_target_type: null,
                promo_target_id: null,
                promo_target_url: null,
              };
              console.log('Delete payload:', updatePayload);
              await storeService.update(store.id, updatePayload as any);
              console.log('Delete successful');
              // Reset local state immédiatement pour feedback instantané
              setPromoData({
                title: '',
                subtitle: '',
                imageUrl: '',
                targetType: 'collection',
                targetId: '',
                targetUrl: '',
              });
              Alert.alert('Succès', 'Bannière supprimée');
              loadStore();
            } catch (e) {
              console.error('Error deleting promo:', e);
              errorHandler.handleDatabaseError(e as any, 'delete promo');
              Alert.alert('Erreur', 'Impossible de supprimer la bannière');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const hasPromo = promoData.imageUrl;

  return (
    <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLORS.card, borderBottomColor: COLORS.border }]}>
        <TouchableOpacity 
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('SellerTabs', { screen: 'SellerDashboard' } as never);
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text, fontSize: fontSize.lg }]}>
          Bannières Publicitaires
        </Text>
        <TouchableOpacity onPress={() => setEditModalVisible(true)}>
          <Ionicons name="add" size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Sélecteur de boutique — visible uniquement si le vendeur a plusieurs boutiques */}
      {allStores.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.storePicker, { borderBottomColor: COLORS.border }]}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        >
          {allStores.map((s: any) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.storePickerItem,
                {
                  backgroundColor: selectedStoreId === s.id ? COLORS.accent : COLORS.bg,
                  borderColor: selectedStoreId === s.id ? COLORS.accent : COLORS.border,
                }
              ]}
              onPress={() => {
                setSelectedStoreId(s.id);
                setStore(null);
                setLoading(true);
              }}
            >
              <Text
                style={[
                  styles.storePickerText,
                  {
                    color: selectedStoreId === s.id ? '#fff' : COLORS.text,
                    fontSize: FONT_SIZE.sm,
                  }
                ]}
              >
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.content}>
        {hasPromo ? (
          <View style={[styles.bannerCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <Image
              source={{ uri: promoData.imageUrl.startsWith('http') ? promoData.imageUrl : promoData.imageUrl }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <View style={styles.bannerInfo}>
              <Text style={[styles.bannerTitle, { color: COLORS.text, fontSize: fontSize.md }]}>
                {promoData.title}
              </Text>
              <Text style={[styles.bannerSubtitle, { color: COLORS.textMuted, fontSize: fontSize.sm }]}>
                {promoData.subtitle}
              </Text>
              <View style={styles.bannerMeta}>
                <View style={[styles.badge, { backgroundColor: COLORS.accent + '15' }]}>
                  <Text style={[styles.badgeText, { color: COLORS.accent, fontSize: fontSize.xs }]}>
                    {promoData.targetType === 'collection' ? 'Collection' : 
                     promoData.targetType === 'product' ? 'Produit' : 'URL externe'}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: COLORS.success + '15' }]}>
                  <Text style={[styles.badgeText, { color: COLORS.success, fontSize: fontSize.xs }]}>
                    Active
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.actions, { borderTopColor: COLORS.border }]}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.bg }]}
                onPress={() => setEditModalVisible(true)}
              >
                <Ionicons name="create-outline" size={20} color={COLORS.text} />
                <Text style={[styles.actionButtonText, { color: COLORS.text, fontSize: fontSize.sm }]}>
                  Modifier
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton, { backgroundColor: COLORS.danger + '15' }]}
                onPress={deletePromo}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                <Text style={[styles.actionButtonText, { color: COLORS.danger, fontSize: fontSize.sm }]}>
                  Supprimer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <Ionicons name="megaphone-outline" size={64} color={COLORS.textMuted} />
            <Text style={[styles.emptyTitle, { color: COLORS.text, fontSize: fontSize.lg }]}>
              Aucune bannière
            </Text>
            <Text style={[styles.emptyText, { color: COLORS.textMuted, fontSize: fontSize.md }]}>
              Créez votre première bannière publicitaire pour promouvoir votre boutique
            </Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: COLORS.accent }]}
              onPress={() => setEditModalVisible(true)}
            >
              <Text style={[styles.createButtonText, { color: '#fff', fontSize: fontSize.md }]}>
                Créer une bannière
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Edit/Create Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text, fontSize: fontSize.lg }]}>
                {hasPromo ? 'Modifier la bannière' : 'Créer une bannière'}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, { color: COLORS.text, fontSize: fontSize.md, marginBottom: SPACING.sm }]}>Titre</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: COLORS.bg, borderColor: COLORS.border, color: COLORS.text }]}
                value={promoData.title}
                onChangeText={text => setPromoData(prev => ({ ...prev, title: text }))}
                placeholder="Ex: Soldes d'été -50%"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={[styles.label, { color: COLORS.text, fontSize: fontSize.md, marginBottom: SPACING.sm, marginTop: SPACING.lg }]}>Sous-titre</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: COLORS.bg, borderColor: COLORS.border, color: COLORS.text }]}
                value={promoData.subtitle}
                onChangeText={text => setPromoData(prev => ({ ...prev, subtitle: text }))}
                placeholder="Ex: Offre valable jusqu'au 31 août"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={[styles.label, { color: COLORS.text, fontSize: fontSize.md, marginBottom: SPACING.sm, marginTop: SPACING.lg }]}>Image</Text>
              {promoData.imageUrl && (
                <Image 
                  source={{ uri: promoData.imageUrl.startsWith('http') ? promoData.imageUrl : promoData.imageUrl }}
                  style={{ width: '100%', height: 150, borderRadius: RADIUS.md, marginBottom: SPACING.md }}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity 
                style={[styles.imageButton, { backgroundColor: COLORS.bg, borderColor: COLORS.border }]}
                onPress={pickImage}
              >
                <Ionicons name="image-outline" size={20} color={COLORS.text} />
                <Text style={[styles.imageButtonText, { color: COLORS.text, fontSize: fontSize.sm }]}>
                  {promoData.imageUrl ? 'Changer l\'image' : 'Ajouter une image'}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.label, { color: COLORS.text, fontSize: fontSize.md, marginBottom: SPACING.sm, marginTop: SPACING.lg }]}>Type de cible</Text>
              <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg }}>
                {[
                  { id: 'collection', label: 'Collection' },
                  { id: 'product', label: 'Produit' },
                  { id: 'url', label: 'URL externe' }
                ].map(type => (
                  <TouchableOpacity 
                    key={type.id}
                    style={[
                      { 
                        flex: 1, 
                        padding: SPACING.sm, 
                        borderRadius: RADIUS.md, 
                        borderWidth: 1,
                        borderColor: promoData.targetType === type.id ? COLORS.accent : COLORS.border,
                        backgroundColor: promoData.targetType === type.id ? COLORS.accent + '15' : COLORS.bg,
                        alignItems: 'center'
                      }
                    ]}
                    onPress={() => setPromoData(prev => ({ ...prev, targetType: type.id as any }))}
                  >
                    <Text style={{ color: promoData.targetType === type.id ? COLORS.accent : COLORS.text, fontSize: fontSize.sm }}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {promoData.targetType === 'collection' && (
                <View>
                  <Text style={[styles.label, { color: COLORS.text, fontSize: fontSize.md, marginBottom: SPACING.sm }]}>ID de la collection</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: COLORS.bg, borderColor: COLORS.border, color: COLORS.text }]}
                    value={promoData.targetId}
                    onChangeText={text => setPromoData(prev => ({ ...prev, targetId: text }))}
                    placeholder="Ex: 123"
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              )}

              {promoData.targetType === 'product' && (
                <View>
                  <Text style={[styles.label, { color: COLORS.text, fontSize: fontSize.md, marginBottom: SPACING.sm }]}>ID du produit</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: COLORS.bg, borderColor: COLORS.border, color: COLORS.text }]}
                    value={promoData.targetId}
                    onChangeText={text => setPromoData(prev => ({ ...prev, targetId: text }))}
                    placeholder="Ex: 456"
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              )}

              {promoData.targetType === 'url' && (
                <View>
                  <Text style={[styles.label, { color: COLORS.text, fontSize: fontSize.md, marginBottom: SPACING.sm }]}>URL externe</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: COLORS.bg, borderColor: COLORS.border, color: COLORS.text }]}
                    value={promoData.targetUrl}
                    onChangeText={text => setPromoData(prev => ({ ...prev, targetUrl: text }))}
                    placeholder="Ex: https://example.com/promo"
                    keyboardType="url"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: COLORS.border }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: COLORS.text, fontSize: fontSize.md }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: COLORS.accent }]}
                onPress={savePromo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
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
  },
  storePicker: {
    borderBottomWidth: 1,
    maxHeight: 56,
  },
  storePickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  storePickerText: {
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  bannerCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: 200,
  },
  bannerInfo: {
    padding: 16,
  },
  bannerTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  bannerSubtitle: {
    marginBottom: 12,
  },
  bannerMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    fontWeight: '500',
  },
  deleteButton: {
    // backgroundColor handled inline
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    borderRadius: 16,
    maxHeight: '80%',
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  imageButtonText: {
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontWeight: '500',
  },
  saveButton: {
    // backgroundColor handled inline
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

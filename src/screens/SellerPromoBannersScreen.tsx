import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, Modal, TextInput,
  Share, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { storeService } from '../services/storeService';
import { cloudinaryService } from '../services/cloudinaryService';
import * as ImagePicker from 'expo-image-picker';
import { useSupabase } from '../lib/supabase';
import { errorHandler } from '../utils/errorHandler';
import * as ExpoLinking from 'expo-linking';

interface PromoBanner {
  id: string;
  store_id: string;
  title: string;
  subtitle: string;
  image_url: string;
  target_type: 'collection' | 'product' | 'url';
  target_id?: string | null;
  target_url?: string | null;
  enabled: boolean;
  sort_order: number;
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

  const routeStoreId: string | undefined = route.params?.storeId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<any>(null);
  const [myStores, setMyStores] = useState<any[]>([]);
  const [promos, setPromos] = useState<PromoBanner[]>([]);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [storeCollections, setStoreCollections] = useState<any[]>([]);
  const [editingPromo, setEditingPromo] = useState<PromoBanner | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [promoData, setPromoData] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    target_type: 'collection' as 'collection' | 'product' | 'url',
    target_id: '',
    target_url: '',
  });

  const loadData = useCallback(async (forcedStoreId?: string) => {
    try {
      if (!user?.id) return;
      setLoading(true);
      const client = useSupabase();

      // 1. Charger TOUTES les boutiques du vendeur
      const { data: stores, error: storeErr } = await client
        .from('stores')
        .select('id, name, slug, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (storeErr) throw storeErr;
      if (!stores || stores.length === 0) { setLoading(false); return; }
      setMyStores(stores);

      // Déterminer la boutique à afficher (celle forcée, ou celle de l'URL, ou la première par défaut)
      const targetStoreId = forcedStoreId || routeStoreId || stores[0].id;
      const s = stores.find(st => st.id === targetStoreId) || stores[0];
      setStore(s);

      // 2. Charger les bannières de CETTE boutique uniquement
      const { data: promosData, error: promosErr } = await client
        .from('store_promos')
        .select('*')
        .eq('store_id', s.id)
        .order('sort_order', { ascending: true });

      if (promosErr) console.warn('[SellerPromoBanners] promos error:', promosErr);
      setPromos(promosData || []);

      // 3. Charger produits et collections de CETTE boutique
      const [prodRes, colRes] = await Promise.all([
        client.from('products').select('id, name').eq('store_id', s.id).is('deleted_at', null).order('name'),
        client.from('collections').select('id, name').eq('store_id', s.id).order('name'),
      ]);
      setStoreProducts(prodRes.data || []);
      setStoreCollections(colRes.data || []);
      console.log('[SellerPromoBanners] Store:', s.name, '| Banners:', promosData?.length, '| Products:', prodRes.data?.length, '| Collections:', colRes.data?.length);
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'load store promos');
    } finally {
      setLoading(false);
    }
  }, [user?.id, routeStoreId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreateModal = () => {
    if (promos.length >= 5) {
      Alert.alert('Limite atteinte', 'Maximum 5 bannières par boutique.');
      return;
    }
    setEditingPromo(null);
    setPromoData({ title: '', subtitle: '', image_url: '', target_type: 'collection', target_id: '', target_url: '' });
    setEditModalVisible(true);
  };

  const openEditModal = (promo: PromoBanner) => {
    setEditingPromo(promo);
    setPromoData({
      title: promo.title || '',
      subtitle: promo.subtitle || '',
      image_url: promo.image_url || '',
      target_type: promo.target_type || 'collection',
      target_id: promo.target_id || '',
      target_url: promo.target_url || '',
    });
    setEditModalVisible(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) {
      setPromoData(prev => ({ ...prev, image_url: result.assets[0].uri }));
    }
  };

  const savePromo = async () => {
    if (!store?.id) { Alert.alert('Erreur', 'Boutique introuvable'); return; }
    if (!promoData.title.trim()) { Alert.alert('Erreur', 'Le titre est requis'); return; }
    if (!promoData.image_url) { Alert.alert('Erreur', 'Une image est requise'); return; }

    setSaving(true);
    try {
      const client = useSupabase();
      let imageUrl = promoData.image_url;
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = await cloudinaryService.uploadImage(imageUrl, { folder: `stores/${store.id}/promos` });
      }

      const payload: any = {
        store_id: store.id,
        title: promoData.title || null,
        subtitle: promoData.subtitle || null,
        image_url: imageUrl,
        target_type: promoData.target_type || null,
        target_id: (promoData.target_type === 'collection' || promoData.target_type === 'product')
          ? (promoData.target_id || null) : null,
        target_url: promoData.target_type === 'url' ? (promoData.target_url || null) : null,
        enabled: true,
        sort_order: editingPromo?.sort_order ?? promos.length,
      };

      if (editingPromo) {
        const { error } = await client.from('store_promos').update(payload).eq('id', editingPromo.id).eq('store_id', store.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('store_promos').insert(payload);
        if (error) throw error;
      }

      Alert.alert('Succès', 'Bannière enregistrée !');
      setEditModalVisible(false);
      loadData(store.id);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d\'enregistrer la bannière');
    } finally {
      setSaving(false);
    }
  };

  const deletePromo = (promoId: string) => {
    Alert.alert('Supprimer', 'Êtes-vous sûr ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            const client = useSupabase();
            const { error } = await client.from('store_promos').delete().eq('id', promoId).eq('store_id', store.id);
            if (error) throw error;
            Alert.alert('Succès', 'Bannière supprimée');
            loadData(store.id);
          } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  const sharePromo = async (promo: PromoBanner) => {
    try {
      if (!store) return;
      const storeSlug = store.slug || store.id;
      let url = ExpoLinking.createURL(`/store/${storeSlug}`);
      if (promo.target_type === 'product' && promo.target_id) {
        url = ExpoLinking.createURL(`/product/${promo.target_id}`);
      } else if (promo.target_type === 'collection' && promo.target_id) {
        url = ExpoLinking.createURL(`/store/${storeSlug}`, { queryParams: { collectionId: promo.target_id } });
      } else if (promo.target_type === 'url' && promo.target_url) {
        url = promo.target_url;
      }
      const message = `🔥 ${promo.title}\n${promo.subtitle || ''}\n\nDécouvrir : ${url}`;
      if (Platform.OS === 'web') {
        const nav: any = typeof navigator !== 'undefined' ? navigator : null;
        if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(message);
          Alert.alert('Copié !', 'Texte copié, collez-le sur Facebook, TikTok ou WhatsApp.');
          return;
        }
      }
      await Share.share({ message, title: promo.title });
    } catch (e: any) { console.warn(e); }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLORS.card, borderBottomColor: COLORS.border }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('SellerTabs')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: COLORS.text, fontSize: FONT_SIZE.lg }]}>Bannières Publicitaires</Text>
          {myStores.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 4 }}>
              {myStores.map(st => (
                <TouchableOpacity 
                  key={st.id} 
                  onPress={() => loadData(st.id)}
                  style={{ 
                    paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm,
                    backgroundColor: store?.id === st.id ? COLORS.accent : COLORS.bg,
                    borderWidth: 1, borderColor: store?.id === st.id ? COLORS.accent : COLORS.border
                  }}
                >
                  <Text style={{ color: store?.id === st.id ? '#fff' : COLORS.text, fontSize: FONT_SIZE.xs }}>
                    {st.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            store && <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' }}>{store.name}</Text>
          )}
        </View>
        <TouchableOpacity onPress={openCreateModal}>
          <Ionicons name="add" size={28} color={promos.length >= 5 ? COLORS.textMuted : COLORS.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Counter */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
          <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600' }}>
            Bannières ({promos.length}/5)
          </Text>
          {promos.length < 5 && (
            <TouchableOpacity onPress={openCreateModal}>
              <Text style={{ color: COLORS.accent, fontSize: FONT_SIZE.sm, fontWeight: '500' }}>+ Ajouter</Text>
            </TouchableOpacity>
          )}
        </View>

        {promos.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <Ionicons name="megaphone-outline" size={64} color={COLORS.textMuted} />
            <Text style={[styles.emptyTitle, { color: COLORS.text, fontSize: FONT_SIZE.lg }]}>Aucune bannière</Text>
            <Text style={[styles.emptyText, { color: COLORS.textMuted, fontSize: FONT_SIZE.md }]}>
              Créez une bannière pour promouvoir vos produits ou collections
            </Text>
            <TouchableOpacity style={[styles.createButton, { backgroundColor: COLORS.accent }]} onPress={openCreateModal}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: FONT_SIZE.md }}>Créer une bannière</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: SPACING.md }}>
            {promos.map((promo) => (
              <View key={promo.id} style={[styles.bannerCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <Image source={{ uri: promo.image_url }} style={styles.bannerImage} resizeMode="cover" />
                <View style={styles.bannerInfo}>
                  <Text style={[styles.bannerTitle, { color: COLORS.text, fontSize: FONT_SIZE.md }]}>{promo.title}</Text>
                  {!!promo.subtitle && (
                    <Text style={[{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 8 }]}>{promo.subtitle}</Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={[styles.badge, { backgroundColor: COLORS.accent + '15' }]}>
                      <Text style={[styles.badgeText, { color: COLORS.accent, fontSize: FONT_SIZE.xs }]}>
                        {promo.target_type === 'collection' ? '📁 Collection' : promo.target_type === 'product' ? '📦 Produit' : '🔗 URL'}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: (promo.enabled ? COLORS.success : COLORS.textMuted) + '20' }]}>
                      <Text style={[styles.badgeText, { color: promo.enabled ? COLORS.success : COLORS.textMuted, fontSize: FONT_SIZE.xs }]}>
                        {promo.enabled ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Actions */}
                <View style={[styles.actions, { borderTopColor: COLORS.border }]}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success + '15' }]} onPress={() => sharePromo(promo)}>
                    <Ionicons name="share-social" size={18} color={COLORS.success} />
                    <Text style={{ color: COLORS.success, fontSize: FONT_SIZE.xs, fontWeight: '500' }}>Partager</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.bg }]} onPress={() => openEditModal(promo)}>
                    <Ionicons name="create-outline" size={18} color={COLORS.text} />
                    <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.xs, fontWeight: '500' }}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger + '15' }]} onPress={() => deletePromo(promo.id)}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.xs, fontWeight: '500' }}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal Création/Édition */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: COLORS.border }]}>
              <Text style={[styles.modalTitle, { color: COLORS.text, fontSize: FONT_SIZE.lg }]}>
                {editingPromo ? 'Modifier la bannière' : 'Créer une bannière'}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Titre */}
              <Text style={[styles.label, { color: COLORS.text, marginBottom: 6 }]}>Titre *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: COLORS.bg, borderColor: COLORS.border, color: COLORS.text }]}
                value={promoData.title}
                onChangeText={t => setPromoData(p => ({ ...p, title: t }))}
                placeholder="Ex: Soldes d'été -50%"
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Sous-titre */}
              <Text style={[styles.label, { color: COLORS.text, marginBottom: 6, marginTop: 12 }]}>Sous-titre</Text>
              <TextInput
                style={[styles.input, { backgroundColor: COLORS.bg, borderColor: COLORS.border, color: COLORS.text }]}
                value={promoData.subtitle}
                onChangeText={t => setPromoData(p => ({ ...p, subtitle: t }))}
                placeholder="Ex: Offre valable jusqu'au 31 août"
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Image */}
              <Text style={[styles.label, { color: COLORS.text, marginBottom: 6, marginTop: 12 }]}>Image *</Text>
              {!!promoData.image_url && (
                <Image source={{ uri: promoData.image_url }} style={{ width: '100%', height: 140, borderRadius: RADIUS.md, marginBottom: 8 }} resizeMode="cover" />
              )}
              <TouchableOpacity style={[styles.imageButton, { backgroundColor: COLORS.bg, borderColor: COLORS.border }]} onPress={pickImage}>
                <Ionicons name="image-outline" size={20} color={COLORS.text} />
                <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.sm }}>
                  {promoData.image_url ? "Changer l'image" : 'Choisir une image'}
                </Text>
              </TouchableOpacity>

              {/* Type de cible */}
              <Text style={[styles.label, { color: COLORS.text, marginBottom: 6, marginTop: 16 }]}>Cible au clic</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(['collection', 'product', 'url'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={{
                      flex: 1, padding: 10, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center',
                      borderColor: promoData.target_type === type ? COLORS.accent : COLORS.border,
                      backgroundColor: promoData.target_type === type ? COLORS.accent + '20' : COLORS.bg,
                    }}
                    onPress={() => setPromoData(p => ({ ...p, target_type: type, target_id: '', target_url: '' }))}
                  >
                    <Text style={{ color: promoData.target_type === type ? COLORS.accent : COLORS.text, fontSize: FONT_SIZE.xs, fontWeight: '600' }}>
                      {type === 'collection' ? '📁 Collection' : type === 'product' ? '📦 Produit' : '🔗 URL'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sélecteur de collection */}
              {promoData.target_type === 'collection' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.label, { color: COLORS.text, marginBottom: 6 }]}>
                    Choisir une collection ({storeCollections.length} disponibles)
                  </Text>
                  {storeCollections.length === 0 ? (
                    <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontStyle: 'italic' }}>
                      Aucune collection dans cette boutique
                    </Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 180, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md }}>
                      {storeCollections.map(col => (
                        <TouchableOpacity
                          key={col.id}
                          style={{
                            padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
                            backgroundColor: promoData.target_id === col.id ? COLORS.accent + '20' : COLORS.bg,
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                          }}
                          onPress={() => setPromoData(p => ({ ...p, target_id: col.id }))}
                        >
                          {promoData.target_id === col.id && <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} />}
                          <Text style={{ color: promoData.target_id === col.id ? COLORS.accent : COLORS.text, fontWeight: promoData.target_id === col.id ? '700' : '400' }}>
                            {col.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Sélecteur de produit */}
              {promoData.target_type === 'product' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.label, { color: COLORS.text, marginBottom: 6 }]}>
                    Choisir un produit ({storeProducts.length} disponibles)
                  </Text>
                  {storeProducts.length === 0 ? (
                    <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontStyle: 'italic' }}>
                      Aucun produit dans cette boutique
                    </Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 180, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md }}>
                      {storeProducts.map(prod => (
                        <TouchableOpacity
                          key={prod.id}
                          style={{
                            padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
                            backgroundColor: promoData.target_id === prod.id ? COLORS.accent + '20' : COLORS.bg,
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                          }}
                          onPress={() => setPromoData(p => ({ ...p, target_id: prod.id }))}
                        >
                          {promoData.target_id === prod.id && <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} />}
                          <Text style={{ color: promoData.target_id === prod.id ? COLORS.accent : COLORS.text, fontWeight: promoData.target_id === prod.id ? '700' : '400' }}>
                            {prod.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* URL externe */}
              {promoData.target_type === 'url' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.label, { color: COLORS.text, marginBottom: 6 }]}>URL externe</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: COLORS.bg, borderColor: COLORS.border, color: COLORS.text }]}
                    value={promoData.target_url}
                    onChangeText={t => setPromoData(p => ({ ...p, target_url: t }))}
                    placeholder="https://exemple.com/promo"
                    keyboardType="url"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                  />
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: COLORS.border }]}>
              <TouchableOpacity style={[styles.modalBtn, { borderWidth: 1, borderColor: COLORS.border }]} onPress={() => setEditModalVisible(false)}>
                <Text style={{ color: COLORS.text, fontWeight: '500' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.accent }]} onPress={savePromo} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontWeight: '700', textAlign: 'center' },
  content: { flex: 1, padding: 16 },
  bannerCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  bannerImage: { width: '100%', height: 180 },
  bannerInfo: { padding: 14 },
  bannerTitle: { fontWeight: '700', marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontWeight: '600' },
  actions: { flexDirection: 'row', borderTopWidth: 1, padding: 10, gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 4 },
  emptyState: { borderRadius: 12, borderWidth: 1, padding: 48, alignItems: 'center' },
  emptyTitle: { fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', marginBottom: 24 },
  createButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontWeight: '700' },
  modalBody: { padding: 16 },
  label: { fontWeight: '600', fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 4, fontSize: 14 },
  imageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, borderWidth: 1, gap: 8, marginBottom: 4 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

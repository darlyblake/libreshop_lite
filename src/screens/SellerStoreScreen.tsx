import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { cloudinaryService } from '../lib/cloudinaryService';
import { orderService, productService, storeService, type Store, authService } from '../lib/supabase';
import { useAuthStore } from '../store';
import { useCategoryStore } from '../store/categoryStore';

/* =========================
   TYPES
========================= */

type StoreData = {
  name?: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  bannerUrl?: string;
  promoEnabled?: boolean;
  promoTitle?: string;
  promoSubtitle?: string;
  promoImageUrl?: string;
  promoTargetType?: 'collection' | 'product' | 'url';
  promoTargetId?: string;
  promoTargetUrl?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  rating?: number;
  products?: number;
  orders?: number;
  taxRate?: number;
  shippingPrice?: number;
};

/* =========================
   MOCK DATA
========================= */

const STORE_DATA: StoreData = {};

/* =========================
   COMPONENT
========================= */

export const SellerStoreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'info' | 'settings' | 'analytics'>(
    'info'
  );

  // store data state (editable)
  const [storeData, setStoreData] = useState<StoreData>(STORE_DATA);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const tabs = useMemo(
    () => [
      { id: 'info', label: 'Informations' },
      { id: 'settings', label: 'Paramètres' },
      { id: 'analytics', label: 'Statistiques' },
    ],
    []
  );

  const storePublicUrl = useMemo(() => {
    if (!store?.slug) return null;
    return `http://localhost:8082/store/${store.slug}`;
  }, [store?.slug]);

  const loadStore = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const s = (await storeService.getByUser(user.id)) as Store | null;
      if (!s?.id) {
        setStore(null);
        setStoreData({});
        return;
      }

      const [products, orders] = await Promise.all([
        productService.getByStoreAll(s.id).catch(() => []),
        orderService.getByStore(s.id).catch(() => []),
      ]);

      setStore(s);
      setStoreData({
        name: s.name,
        description: s.description,
        category: s.category,
        logoUrl: s.logo_url,
        bannerUrl: s.banner_url,
        promoEnabled: Boolean((s as any).promo_enabled),
        promoTitle: String((s as any).promo_title || ''),
        promoSubtitle: String((s as any).promo_subtitle || ''),
        promoImageUrl: String((s as any).promo_image_url || ''),
        promoTargetType: (s as any).promo_target_type || undefined,
        promoTargetId: (s as any).promo_target_id ? String((s as any).promo_target_id) : undefined,
        promoTargetUrl: (s as any).promo_target_url ? String((s as any).promo_target_url) : undefined,
        products: Array.isArray(products) ? products.length : 0,
        orders: Array.isArray(orders) ? orders.length : 0,
        rating: undefined,
        phone: (s as any).phone,
        whatsapp: (s as any).whatsapp,
        email: (s as any).email,
        address: (s as any).address,
        taxRate: Number((s as any).tax_rate) || 0,
        shippingPrice: Number((s as any).shipping_price) || 0,
      });
    } catch (e: any) {
      console.warn('load store failed', e);
      Alert.alert('Erreur', e?.message || 'Impossible de charger la boutique');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const handleSaveStore = async (next: StoreData) => {
    if (!store?.id) {
      Alert.alert('Erreur', 'Aucune boutique à mettre à jour');
      return;
    }

    try {
      setSaving(true);

      let logoUrl = next.logoUrl;
      let bannerUrl = next.bannerUrl;
      let promoImageUrl = next.promoImageUrl;

      if (logoUrl && !logoUrl.startsWith('http')) {
        logoUrl = await cloudinaryService.uploadImage(logoUrl, { folder: `stores/${store.id}` });
      }
      if (bannerUrl && !bannerUrl.startsWith('http')) {
        bannerUrl = await cloudinaryService.uploadImage(bannerUrl, { folder: `stores/${store.id}` });
      }
      if (promoImageUrl && !promoImageUrl.startsWith('http')) {
        promoImageUrl = await cloudinaryService.uploadImage(promoImageUrl, { folder: `stores/${store.id}/promos` });
      }

      await storeService.update(store.id, {
        name: next.name,
        description: next.description,
        category: next.category,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        promo_enabled: Boolean(next.promoEnabled),
        promo_title: next.promoTitle || null,
        promo_subtitle: next.promoSubtitle || null,
        promo_image_url: promoImageUrl || null,
        promo_target_type: next.promoTargetType || null,
        promo_target_id: next.promoTargetId || null,
        promo_target_url: next.promoTargetUrl || null,
        tax_rate: next.taxRate || null,
        shipping_price: next.shippingPrice || null,
      });

      setShowEditModal(false);
      await loadStore();
      Alert.alert('Succès', 'Boutique mise à jour');
    } catch (e: any) {
      console.warn('save store failed', e);
      Alert.alert('Erreur', e?.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePause = async () => {
    if (!store?.id) return;
    try {
      setSaving(true);
      const nextVisible = !Boolean((store as any).visible);
      await storeService.update(store.id, { visible: nextVisible });
      await loadStore();
      Alert.alert('Succès', nextVisible ? 'Boutique réactivée' : 'Boutique mise en pause');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de changer le statut');
    } finally {
      setSaving(false);
    }
  };

  const handleShareStore = async () => {
    if (!storePublicUrl) {
      Alert.alert('Partager', 'Lien boutique indisponible');
      return;
    }

    try {
      await Share.share({ message: storePublicUrl });
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de partager');
    }
  };

  const handleShowQrLink = () => {
    if (!storePublicUrl) {
      Alert.alert('QR Code', 'Lien boutique indisponible');
      return;
    }
    Alert.alert('Lien boutique', storePublicUrl, [
      { text: 'Fermer', style: 'cancel' },
      { text: 'Partager', onPress: handleShareStore },
    ]);
  };

  const handleSignOut = () => {
    console.log('handleSignOut called');
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    console.log('Sign out confirmed');
    try {
      setSigningOut(true);
      setShowSignOutModal(false);
      console.log('Starting sign out process...');
      await signOut();
      console.log('Sign out successful, navigating...');
      navigation.reset({
        index: 0,
        routes: [{ name: 'SellerAuth' }],
      });
    } catch (error) {
      console.error('Error during sign out:', error);
      Alert.alert('Erreur', 'Impossible de se déconnecter. Veuillez réessayer.');
    } finally {
      setSigningOut(false);
    }
  };

  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setChangingPassword(true);
      
      // Vérifier l'ancien mot de passe en essayant de se connecter
      if (user?.email) {
        await authService.signIn(user.email, passwordData.currentPassword);
      }
      
      // Mettre à jour le mot de passe
      await authService.updatePassword(passwordData.newPassword);
      
      Alert.alert('Succès', 'Mot de passe mis à jour avec succès', [
        {
          text: 'OK',
          onPress: () => {
            setShowPasswordModal(false);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
          },
        },
      ]);
    } catch (e: any) {
      console.error('update password error', e);
      if (e?.message?.includes('Invalid login')) {
        Alert.alert('Erreur', 'L\'ancien mot de passe est incorrect');
      } else {
        Alert.alert('Erreur', e?.message || 'Impossible de mettre à jour le mot de passe');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Ma boutique</Text>

        <TouchableOpacity style={styles.editButton} onPress={() => setShowEditModal(true)}>
          <Ionicons name="pencil" size={18} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      <EditStoreModal
        visible={showEditModal}
        data={storeData}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveStore}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {loading ? (
          <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : !store ? (
          <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
            <Text style={{ color: COLORS.textSoft, textAlign: 'center' }}>Aucune boutique trouvée pour ce compte.</Text>
          </View>
        ) : (
          <>
            {/* BANNER */}
            <View style={styles.bannerContainer}>
              <Image
                source={{
                  uri: storeData.bannerUrl ?? 'https://picsum.photos/800',
                }}
                style={styles.banner}
              />
              <View style={styles.bannerOverlay} />

              <View style={styles.logoContainer}>
                <Image
                  source={{
                    uri: storeData.logoUrl ?? 'https://picsum.photos/200',
                  }}
                  style={styles.logo}
                />
              </View>
            </View>

            {/* STORE INFO */}
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{storeData.name ?? 'Ma boutique'}</Text>

              {storeData.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{storeData.category}</Text>
                </View>
              )}

              {storeData.description && <Text style={styles.storeDescription}>{storeData.description}</Text>}

              {/* STATS */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{(storeData.rating ?? 0).toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Note</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.stat}>
                  <Text style={styles.statValue}>{(storeData.products ?? 0).toLocaleString('fr-FR')}</Text>
                  <Text style={styles.statLabel}>Produits</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.stat}>
                  <Text style={styles.statValue}>{(storeData.orders ?? 0).toLocaleString('fr-FR')}</Text>
                  <Text style={styles.statLabel}>Commandes</Text>
                </View>
              </View>
            </View>

            {/* TABS */}
            <View style={styles.tabsContainer}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                  onPress={() => setActiveTab(tab.id as any)}
                >
                  <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* CONTENT */}
            <View style={styles.tabContent}>
              {activeTab === 'info' && (
                <View style={styles.card}>
                  {renderInfoItem('phone-portrait-outline', 'Téléphone', storeData.phone)}
                  {renderInfoItem('logo-whatsapp', 'WhatsApp', storeData.whatsapp)}
                  {renderInfoItem('mail-outline', 'Email', storeData.email)}
                  {renderInfoItem('location-outline', 'Adresse', storeData.address)}
                </View>
              )}

              {activeTab === 'settings' && (
                <View style={styles.card}>
                  {renderSettingItem('storefront-outline', 'Modifier la boutique', false, () => setShowEditModal(true))}
                  {renderSettingItem('qr-code-outline', 'QR Code de la boutique', false, handleShowQrLink)}
                  {renderSettingItem('share-social-outline', 'Partager la boutique', false, handleShareStore)}
                  {renderSettingItem('notifications-outline', 'Notifications', false, () => navigation.navigate('Notifications'))}
                  {renderSettingItem('key-outline', 'Changer le mot de passe', false, handleChangePassword)}
                  {renderSettingItem('log-out-outline', signingOut ? 'Déconnexion...' : 'Se déconnecter', true, signingOut ? undefined : handleSignOut)}
                  {renderSettingItem('pause-circle-outline', 'Mettre en pause', true, () => {
                    if (saving) return;
                    Alert.alert(
                      'Confirmation',
                      Boolean((store as any)?.visible) ? 'Mettre la boutique en pause ?' : 'Réactiver la boutique ?',
                      [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Confirmer', onPress: handleTogglePause },
                      ]
                    );
                  })}
                </View>
              )}

              {activeTab === 'analytics' && (
                <View style={styles.card}>
                  <Text style={styles.analyticsTitle}>Performances</Text>
                  {renderAnalyticsRow('Produits actifs', `${(storeData.products ?? 0).toLocaleString('fr-FR')}`)}
                  {renderAnalyticsRow('Commandes totales', `${(storeData.orders ?? 0).toLocaleString('fr-FR')}`)}
                  {renderAnalyticsRow('TVA appliquée', `${(storeData.taxRate ?? 0) > 0 ? `${storeData.taxRate}%` : 'Non'}`)}
                  {renderAnalyticsRow('Frais de port', `${(storeData.shippingPrice ?? 0) > 0 ? `${(storeData.shippingPrice ?? 0).toLocaleString('fr-FR')} FCA` : 'Gratuit'}`)}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* CHANGE PASSWORD MODAL */}
      {showPasswordModal && (
        <Modal
          animationType="slide"
          transparent
          visible={showPasswordModal}
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.passwordModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Changer le mot de passe</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.passwordForm}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Mot de passe actuel</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Entrez votre mot de passe actuel"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    value={passwordData.currentPassword}
                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nouveau mot de passe</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Minimum 6 caractères"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    value={passwordData.newPassword}
                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Confirmer le mot de passe</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Retapez le nouveau mot de passe"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    value={passwordData.confirmPassword}
                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleUpdatePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.confirmButtonText}>Mettre à jour</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* SIGN OUT CONFIRMATION MODAL */}
      {showSignOutModal && (
        <Modal
          animationType="fade"
          transparent
          visible={showSignOutModal}
          onRequestClose={() => setShowSignOutModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.signOutModalContent}>
              <View style={styles.signOutModalHeader}>
                <Ionicons name="warning" size={32} color={COLORS.danger} />
                <Text style={styles.signOutModalTitle}>Déconnexion</Text>
              </View>
              
              <View style={styles.signOutModalBody}>
                <Text style={styles.signOutModalMessage}>
                  Êtes-vous sûr de vouloir vous déconnecter ?
                </Text>
              </View>
              
              <View style={styles.signOutModalActions}>
                <TouchableOpacity
                  style={[styles.signOutModalButton, styles.signOutModalCancelButton]}
                  onPress={() => setShowSignOutModal(false)}
                  disabled={signingOut}
                >
                  <Text style={styles.signOutModalCancelText}>Annuler</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.signOutModalButton, styles.signOutModalConfirmButton]}
                  onPress={confirmSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <Text style={styles.signOutModalConfirmText}>Se déconnecter</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

/* =========================
   REUSABLE RENDERERS
========================= */

const renderInfoItem = (
  icon: any,
  label: string,
  value?: string
) => {
  if (!value) return null;

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={COLORS.accent} />
      <View style={{ marginLeft: SPACING.md }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
};

const renderSettingItem = (
  icon: any,
  label: string,
  danger?: boolean,
  onPress?: () => void
) => (
  <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress}>
    <Ionicons
      name={icon}
      size={22}
      color={danger ? COLORS.danger : COLORS.accent}
    />
    <Text
      style={[
        styles.settingLabel,
        danger && { color: COLORS.danger },
      ]}
    >
      {label}
    </Text>
    <Ionicons
      name="chevron-forward"
      size={20}
      color={COLORS.textMuted}
    />
  </TouchableOpacity>
);

const renderAnalyticsRow = (
  label: string,
  value: string
) => (
  <View style={styles.analyticsRow}>
    <Text style={styles.analyticsLabel}>{label}</Text>
    <Text style={styles.analyticsValue}>{value}</Text>
  </View>
);


/* =========================
   EDIT MODAL
========================= */

const EditStoreModal: React.FC<{
  visible: boolean;
  data: StoreData;
  onSave: (d: StoreData) => void;
  onClose: () => void;
}> = ({ visible, data, onSave, onClose }) => {
  const [form, setForm] = useState<StoreData>({ ...data });
  const { categories, loadCategories, isLoading: categoriesLoading } = useCategoryStore();

  useEffect(() => {
    if (!visible) return;
    setForm({ ...data });
    void loadCategories();
  }, [visible, data, loadCategories]);

  const handleChange = (key: keyof StoreData, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const pickImage = async (field: 'logoUrl' | 'bannerUrl' | 'promoImageUrl') => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', "Nous avons besoin de l'accès aux images.");
        return;
      }
    }

    const mediaTypesModern = (ImagePicker as any)?.MediaType?.Images;
    const mediaTypesLegacy = (ImagePicker as any)?.MediaTypeOptions?.Images;
    const mediaTypes = mediaTypesModern ? [mediaTypesModern] : mediaTypesLegacy;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      handleChange(field, result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    if (!form.name || !form.description) {
      Alert.alert('Erreur', 'Le nom et la description sont requis.');
      return;
    }
    onSave(form);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Modifier le profil</Text>
          <ScrollView>
            <Text style={styles.modalLabel}>Nom</Text>
            <TextInput
              style={styles.modalInput}
              value={form.name ?? ''}
              onChangeText={t => handleChange('name', t)}
            />

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              value={form.description ?? ''}
              onChangeText={t => handleChange('description', t)}
              multiline
            />

            <Text style={styles.modalLabel}>Catégorie</Text>
            <TextInput
              style={styles.modalInput}
              value={form.category ?? ''}
              onChangeText={t => handleChange('category', t)}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryPickerRow}
            >
              {categoriesLoading ? (
                <View style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>Chargement...</Text>
                </View>
              ) : (
                categories.map((c) => {
                  const isActive = form.category === c.name;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                      onPress={() => handleChange('category', c.name)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* images */}
            <Text style={styles.modalLabel}>Logo</Text>
            {form.logoUrl ? (
              <Image source={{ uri: form.logoUrl }} style={styles.modalPreview} />
            ) : null}
            <TouchableOpacity
              style={styles.modalImageButton}
              onPress={() => pickImage('logoUrl')}
            >
              <Text style={styles.modalImageButtonText}>Changer le logo</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Bannière</Text>
            {form.bannerUrl ? (
              <Image source={{ uri: form.bannerUrl }} style={[styles.modalPreview, { height: 80 }]} />
            ) : null}
            <TouchableOpacity
              style={styles.modalImageButton}
              onPress={() => pickImage('bannerUrl')}
            >
              <Text style={styles.modalImageButtonText}>Changer la bannière</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Bannière promo</Text>
            <TouchableOpacity
              style={[styles.modalImageButton, form.promoEnabled ? { borderColor: COLORS.accent } : null]}
              onPress={() => setForm(prev => ({ ...prev, promoEnabled: !Boolean(prev.promoEnabled) }))}
            >
              <Text style={styles.modalImageButtonText}>
                {form.promoEnabled ? 'Promo activée' : 'Promo désactivée'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Titre promo</Text>
            <TextInput
              style={styles.modalInput}
              value={form.promoTitle ?? ''}
              onChangeText={t => handleChange('promoTitle', t)}
            />

            <Text style={styles.modalLabel}>Sous-titre promo</Text>
            <TextInput
              style={styles.modalInput}
              value={form.promoSubtitle ?? ''}
              onChangeText={t => handleChange('promoSubtitle', t)}
            />

            <Text style={styles.modalLabel}>Image promo</Text>
            {form.promoImageUrl ? (
              <Image source={{ uri: form.promoImageUrl }} style={[styles.modalPreview, { width: 140, height: 80 }]} />
            ) : null}
            <TouchableOpacity
              style={styles.modalImageButton}
              onPress={() => pickImage('promoImageUrl')}
            >
              <Text style={styles.modalImageButtonText}>Changer l'image promo</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Cible promo (type)</Text>
            <TextInput
              style={styles.modalInput}
              value={form.promoTargetType ?? ''}
              onChangeText={t => handleChange('promoTargetType', t)}
              placeholder="collection | product | url"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.modalLabel}>Cible promo (ID)</Text>
            <TextInput
              style={styles.modalInput}
              value={form.promoTargetId ?? ''}
              onChangeText={t => handleChange('promoTargetId', t)}
              placeholder="UUID collection/produit"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.modalLabel}>Cible promo (URL)</Text>
            <TextInput
              style={styles.modalInput}
              value={form.promoTargetUrl ?? ''}
              onChangeText={t => handleChange('promoTargetUrl', t)}
              placeholder="https://..."
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />

            <Text style={styles.modalLabel}>TVA (%)</Text>
            <TextInput
              style={styles.modalInput}
              value={form.taxRate ? String(form.taxRate) : ''}
              onChangeText={t => handleChange('taxRate', parseFloat(t) || 0)}
              placeholder="18"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />

            <Text style={styles.modalLabel}>Prix de livraison (FCFA)</Text>
            <TextInput
              style={styles.modalInput}
              value={form.shippingPrice ? String(form.shippingPrice) : ''}
              onChangeText={t => handleChange('shippingPrice', parseFloat(t) || 0)}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.submitButton]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxHeight: '80%', backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md, textAlign: 'center' },
  modalLabel: { color: COLORS.textMuted, marginTop: SPACING.md, marginBottom: 4 },
  modalInput: { backgroundColor: COLORS.bg, color: COLORS.text, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  modalPreview: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.border,
  },
  modalImageButton: {
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalImageButtonText: { color: COLORS.text },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.lg },
  button: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, minWidth: 90, alignItems: 'center' },
  cancelButton: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  submitButton: { backgroundColor: COLORS.accent },
  cancelText: { color: COLORS.text },
  submitText: { color: COLORS.white },

  categoryPickerRow: {
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  categoryChipText: {
    color: COLORS.textSoft,
    fontWeight: '600',
    fontSize: FONT_SIZE.sm,
  },
  categoryChipTextActive: {
    color: COLORS.accent,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },

  backButton: {
    padding: 10,
  },

  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },

  editButton: {
    padding: 10,
  },

  bannerContainer: {
    height: 140,
    marginHorizontal: SPACING.xl,
  },

  banner: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.lg,
  },

  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: RADIUS.lg,
  },

  logoContainer: {
    position: 'absolute',
    bottom: -35,
    left: SPACING.lg,
  },

  logo: {
    width: 75,
    height: 75,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.accent,
  },

  storeInfo: {
    paddingTop: 50,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },

  storeName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },

  categoryBadge: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },

  categoryText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
  },

  storeDescription: {
    marginTop: SPACING.md,
    textAlign: 'center',
    color: COLORS.textSoft,
  },

  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  stat: { flex: 1, alignItems: 'center' },

  statValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },

  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },

  tabsContainer: {
    flexDirection: 'row',
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },

  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },

  tabActive: {
    backgroundColor: COLORS.accent,
  },

  tabText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
  },

  tabTextActive: {
    color: COLORS.white,
  },

  tabContent: {
    padding: SPACING.xl,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },

  infoLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  infoValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },

  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },

  settingLabel: {
    flex: 1,
    marginLeft: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },

  analyticsTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    marginBottom: SPACING.md,
    color: COLORS.text,
  },

  analyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },

  analyticsLabel: {
    color: COLORS.textSoft,
  },

  analyticsValue: {
    fontWeight: '600',
    color: COLORS.text,
  },

  // Password Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  passwordModal: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordForm: {
    padding: SPACING.lg,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginBottom: SPACING.sm,
  },
  formInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  modalActions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: COLORS.accent,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  // Sign Out Modal Styles
  signOutModalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  signOutModalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  signOutModalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  signOutModalBody: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  signOutModalMessage: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
  signOutModalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  signOutModalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  signOutModalCancelButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  signOutModalCancelText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  signOutModalConfirmButton: {
    backgroundColor: COLORS.danger,
  },
  signOutModalConfirmText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.white,
  },
});
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
import OptimizedImage from '../components/OptimizedImage';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { copyToClipboard } from '../services/contactService';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cloudinaryService } from '../services/cloudinaryService';
import { type Store } from '../lib/supabase';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { storeService } from '../services/storeService';
import { authService } from '../services/authService';
import { useAuthStore } from '../store';
import { useCategoryStore } from '../store/categoryStore';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';
import { shareContent } from '../components';
import { qrCodeService } from '../services/qrCodeService';
import { LocationPicker } from '../components/LocationPicker';

/* =========================
   TYPES & MOCK DATA
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
  deliveryMode?: 'fixed' | 'km' | 'city';
  deliveryPriceKm?: number;
  deliveryCityFees?: Record<string, number>;
  businessHours?: Record<string, { isOpen: boolean; open: string; close: string }>;
  isPaused?: boolean;
  announcementBanner?: string;
  announcementBannerEnabled?: boolean;
  announcementPopup?: string;
  announcementPopupEnabled?: boolean;
};

const STORE_DATA: StoreData = {};

/* =========================
   COMPONENT
========================= */

export const SellerStoreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();
  const { getColor, spacing, radius, fontSize, isDark } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'info' | 'settings' | 'analytics'>(
    'info'
  );

  // store data state (editable)
  const [storeData, setStoreData] = useState<StoreData>(STORE_DATA);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);

  const tabs = useMemo(
    () => [
      { id: 'info', label: 'Informations' },
      { id: 'settings', label: 'Paramètres' },
    ],
    []
  );

  const storePublicUrl = useMemo(() => {
    if (!store?.slug) return null;
    
    let webBaseUrl = '';
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location && window.location.origin) {
      webBaseUrl = window.location.origin.replace(/\/+$/, '');
    } else {
      webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    }
    
    return webBaseUrl
      ? `${webBaseUrl}/store/${store.slug}`
      : Linking.createURL(`/store/${store.slug}`);
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

      if (!storeService.isSubscriptionActive(s)) {
        Alert.alert(
          'Abonnement expiré',
          `Votre abonnement pour "${s.name}" a expiré. Vous devez le renouveler pour accéder au tableau de bord.`,
          [
            {
              text: 'Renouveler',
              onPress: () => navigation.replace('SubscriptionExpired'),
            },
          ]
        );
        setLoading(false);
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
        promoEnabled: Boolean(s.promo_enabled),
        promoTitle: String(s.promo_title || ''),
        promoSubtitle: String(s.promo_subtitle || ''),
        promoImageUrl: String(s.promo_image_url || ''),
        promoTargetType: s.promo_target_type || undefined,
        promoTargetId: s.promo_target_id ? String(s.promo_target_id) : undefined,
        promoTargetUrl: s.promo_target_url ? String(s.promo_target_url) : undefined,
        products: Array.isArray(products) ? products.length : 0,
        orders: Array.isArray(orders) ? orders.length : 0,
        phone: s.phone,
        whatsapp: s.whatsapp_number,
        email: s.email,
        address: s.address,
        taxRate: Number(s.tax_rate) || 0,
        shippingPrice: Number(s.shipping_price) || 0,
        deliveryMode: s.delivery_mode || 'fixed',
        deliveryPriceKm: Number(s.delivery_price_km) || 0,
        deliveryCityFees: s.delivery_city_fees || {},
        businessHours: s.business_hours || {
          monday: { isOpen: true, open: "08:00", close: "18:00" },
          tuesday: { isOpen: true, open: "08:00", close: "18:00" },
          wednesday: { isOpen: true, open: "08:00", close: "18:00" },
          thursday: { isOpen: true, open: "08:00", close: "18:00" },
          friday: { isOpen: true, open: "08:00", close: "18:00" },
          saturday: { isOpen: true, open: "09:00", close: "15:00" },
          sunday: { isOpen: false, open: "00:00", close: "00:00" },
        },
        isPaused: Boolean(s.is_paused),
        announcementBanner: s.announcement_banner || '',
        announcementBannerEnabled: Boolean(s.announcement_banner_enabled),
        announcementPopup: s.announcement_popup || '',
        announcementPopupEnabled: Boolean(s.announcement_popup_enabled),
      });
    } catch (e: any) {
      errorHandler.handleDatabaseError(e, 'LoadStore');
      Alert.alert('Erreur', e?.message || 'Impossible de charger la boutique');
    } finally {
      setLoading(false);
    }
  }, [user?.id, navigation]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const handleSaveStore = async (next: StoreData) => {
    if (!store?.id) return;
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

      const updatePayload: any = {
        name: String(next.name || '').trim(),
        description: next.description ? String(next.description).trim() : null,
        category: next.category || null,
        promo_enabled: Boolean(next.promoEnabled),
        tax_rate: next.taxRate ? Number(next.taxRate) : 0,
        shipping_price: next.shippingPrice ? Number(next.shippingPrice) : 0,
        delivery_mode: next.deliveryMode || 'fixed',
        delivery_price_km: next.deliveryPriceKm ? Number(next.deliveryPriceKm) : 0,
        delivery_city_fees: next.deliveryCityFees || {},
        business_hours: next.businessHours,
        is_paused: Boolean(next.isPaused),
      };

      // Ajouter les champs image seulement s'ils ont changé
      if (logoUrl !== store?.logo_url) updatePayload.logo_url = logoUrl || null;
      if (bannerUrl !== store?.banner_url) updatePayload.banner_url = bannerUrl || null;

      // Ajouter les champs promo seulement s'ils sont définis ET ont changé
      if (next.promoTitle !== undefined && next.promoTitle !== store?.promo_title) {
        updatePayload.promo_title = next.promoTitle ? String(next.promoTitle).trim() : null;
      }
      if (next.promoSubtitle !== undefined && next.promoSubtitle !== store?.promo_subtitle) {
        updatePayload.promo_subtitle = next.promoSubtitle ? String(next.promoSubtitle).trim() : null;
      }
      if (promoImageUrl !== undefined && promoImageUrl !== store?.promo_image_url) {
        updatePayload.promo_image_url = promoImageUrl || null;
      }
      if (next.promoTargetType !== undefined && next.promoTargetType !== store?.promo_target_type) {
        updatePayload.promo_target_type = next.promoTargetType || null;
      }
      if (next.promoTargetId !== undefined && next.promoTargetId !== store?.promo_target_id) {
        updatePayload.promo_target_id = next.promoTargetId ? String(next.promoTargetId).trim() : null;
      }
      if (next.promoTargetUrl !== undefined && next.promoTargetUrl !== store?.promo_target_url) {
        updatePayload.promo_target_url = next.promoTargetUrl ? String(next.promoTargetUrl).trim() : null;
      }

      await storeService.update(store.id, updatePayload);

      setShowEditModal(false);
      setShowHoursModal(false);
      await loadStore();
      if (Platform.OS === 'web') {
        window.alert('Boutique mise à jour');
      } else {
        Alert.alert('Succès', 'Boutique mise à jour');
      }
    } catch (e: any) {
      errorHandler.handleDatabaseError(e, 'SaveStore');
      Alert.alert('Erreur', e?.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAnnouncements = async (banner: string, bannerEnabled: boolean, popup: string, popupEnabled: boolean) => {
    if (!store?.id) return;
    try {
      setSaving(true);
      await storeService.update(store.id, {
        announcement_banner: banner.trim(),
        announcement_banner_enabled: bannerEnabled,
        announcement_popup: popup.trim(),
        announcement_popup_enabled: popupEnabled,
      });
      setShowAnnouncementsModal(false);
      await loadStore();
      if (Platform.OS === 'web') {
        window.alert('Annonces mises à jour');
      } else {
        Alert.alert('Succès', 'Annonces mises à jour');
      }
    } catch (e: any) {
      errorHandler.handleDatabaseError(e, 'SaveAnnouncements');
      Alert.alert('Erreur', e?.message || 'Impossible de sauvegarder les annonces');
    } finally {
      setSaving(false);
    }
  };



  const handleShareStore = async () => {
    if (!store?.id || !storePublicUrl) {
      Alert.alert('Partager', 'Lien boutique indisponible.');
      return;
    }
    try {
      await shareContent({
        title: store?.name || 'Boutique',
        description: store?.description || '',
        url: storePublicUrl,
        imageUrl: (store as any)?.logo_url || (store as any)?.banner_url || undefined,
        type: 'store',
      });
    } catch (e: any) {
      Alert.alert('Partager', storePublicUrl);
    }
  };

  const handleLocationUpdate = async (location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  }) => {
    if (!store?.id) return;

    setUpdatingLocation(true);
    try {
      await storeService.updateStoreLocation(store.id, location);
      Alert.alert('Succès', 'Localisation de la boutique mise à jour avec succès');
      setShowLocationPicker(false);
      
      // Recharger les données de la boutique
      const updatedStore = await storeService.getByUser(user?.id || '');
      if (updatedStore) {
        setStore(updatedStore);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la localisation:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la localisation');
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleDownloadQr = async () => {
    if (!store?.slug || !storePublicUrl) return;
    
    if (Platform.OS === 'web') {
      try {
        const base64Url = await qrCodeService.getQrImageBase64(storePublicUrl, 600);
        const a = document.createElement('a');
        a.href = base64Url;
        a.download = `qr-${store.slug}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e: any) {
        Alert.alert('Erreur', 'Impossible de télécharger le QR code');
      }
      return;
    }

    const qrImageUrl = qrCodeService.getQrImageUrl(storePublicUrl, 600);

    await handleSaveQrToGallery();
  };

  const handleShowQrLink = () => {
    if (!storePublicUrl) return;
    setShowQrModal(true);
  };

  const handleSaveQrToGallery = async () => {
    if (!store?.slug) return;

    try {
      if (Platform.OS === 'web') {
        Alert.alert('QR Code', 'Enregistrer dans la galerie n\u2019est pas support\u00e9 sur le web.');
        return;
      }

      const qrImageUrl = qrCodeService.getQrImageUrl(storePublicUrl || '', 600);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Galerie', 'Autorisation d\u2019acc\u00e8s \u00e0 la galerie refus\u00e9e.');
        return;
      }

      const fileExt = 'png';
      const baseDir = (FileSystem as any)['cacheDirectory'];
      if (!baseDir) throw new Error("Répertoire cache indisponible");
      const localUri = `${baseDir}qr-boutique-${store.slug}-${Date.now()}.${fileExt}`;

      const downloaded = await (FileSystem as any).downloadAsync(qrImageUrl, localUri);
      const savedUri = downloaded?.uri || downloaded;
      if (!savedUri) throw new Error('Download du QR code impossible');


      await MediaLibrary.saveToLibraryAsync(savedUri);
      Alert.alert('Succ\u00e8s', 'QR Code enregistr\u00e9 dans votre galerie.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d\u2019enregistrer le QR code');
    }
  };

  const handleQuickImageUpdate = async (type: 'logoUrl' | 'bannerUrl') => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: type === 'logoUrl' ? [1, 1] : [16, 9],
    });

    if (!result.canceled && result.assets?.[0]) {
      const uri = result.assets[0].uri;
      setStoreData(prev => ({ ...prev, [type]: uri }));
      await handleSaveStore({ ...storeData, [type]: uri });
    }
  };

  const confirmSignOut = async () => {
    try {
      setSigningOut(true);
      setShowSignOutModal(false);
      await signOut();
      navigation.reset({ index: 0, routes: [{ name: 'SellerAuth' }] });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de se déconnecter.');
    } finally {
      setSigningOut(false);
    }
  };

  const handleTogglePause = async () => {
    if (!store?.id) return;
    const newPausedState = !storeData.isPaused;
    
    const title = newPausedState ? "Mettre en pause" : "Réactiver la boutique";
    const message = newPausedState 
      ? "En mettant votre boutique en pause, les clients ne pourront plus passer de commande. Voulez-vous continuer ?"
      : "Votre boutique sera à nouveau ouverte aux commandes. Continuer ?";

    const performToggle = async () => {
      try {
        setLoading(true);
        await storeService.update(store.id, { is_paused: newPausedState });
        setStoreData(prev => ({ ...prev, isPaused: newPausedState }));
        if (Platform.OS === 'web') {
          window.alert(newPausedState ? 'Boutique en pause.' : 'Boutique réactivée.');
        } else {
          Alert.alert('Succès', newPausedState ? 'Boutique en pause.' : 'Boutique réactivée.');
        }
      } catch (e: any) {
        if (Platform.OS === 'web') {
          window.alert('Erreur: Impossible de modifier le statut.');
        } else {
          Alert.alert('Erreur', 'Impossible de modifier le statut.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok) performToggle();
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: "Annuler", style: "cancel" },
          { 
            text: "Confirmer", 
            style: newPausedState ? "destructive" : "default",
            onPress: performToggle
          }
        ]
      );
    }
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
      if (user?.email) await authService.signIn(user.email, passwordData.currentPassword);
      await authService.updatePassword(passwordData.currentPassword, passwordData.newPassword);
      Alert.alert('Succès', 'Mot de passe mis à jour avec succès', [
        { text: 'OK', onPress: () => {
          setShowPasswordModal(false);
          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        }}
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de mettre à jour le mot de passe');
    } finally {
      setChangingPassword(false);
    }
  };

  // Styles dynamiques
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: getColor.bg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
    backButton: { padding: 10 },
    headerTitle: { fontSize: fontSize.lg, fontWeight: '600', color: getColor.text },
    editButton: { padding: 10 },
    bannerContainer: { height: 140, marginHorizontal: spacing.xl },
    banner: { width: '100%', height: '100%', borderRadius: radius.lg },
    bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.lg },
    logoContainer: { position: 'absolute', bottom: -35, left: spacing.lg },
    logo: { width: 75, height: 75, borderRadius: 40, borderWidth: 3, borderColor: getColor.accent },
    storeInfo: { paddingTop: 50, alignItems: 'center', paddingHorizontal: spacing.xl },
    storeName: { fontSize: fontSize.xxl, fontWeight: '700', color: getColor.text },
    categoryBadge: { marginTop: spacing.sm, backgroundColor: getColor.accent + '20', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
    categoryText: { fontSize: fontSize.xs, color: getColor.accent },
    storeDescription: { marginTop: spacing.md, textAlign: 'center', color: getColor.textSoft },
    statsRow: { flexDirection: 'row', marginTop: spacing.xl, backgroundColor: getColor.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: getColor.border },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: fontSize.xxl, fontWeight: '700', color: getColor.text },
    statLabel: { fontSize: fontSize.xs, color: getColor.textMuted },
    statDivider: { width: 1, backgroundColor: getColor.border },
    tabsContainer: { flexDirection: 'row', marginTop: spacing.xl, paddingHorizontal: spacing.xl, gap: spacing.sm },
    tab: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', backgroundColor: getColor.card },
    tabActive: { backgroundColor: getColor.accent },
    tabText: { fontSize: fontSize.sm, color: getColor.textSoft },
    tabTextActive: { color: isDark ? getColor.text : '#ffffff' },
    tabContent: { padding: spacing.xl },
    card: { backgroundColor: getColor.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: getColor.border },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
    infoLabel: { fontSize: fontSize.xs, color: getColor.textMuted },
    infoValue: { fontSize: fontSize.md, color: getColor.text, fontWeight: '500' },
    settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
    settingLabel: { flex: 1, marginLeft: spacing.md, fontSize: fontSize.md, color: getColor.text },
    analyticsTitle: { fontSize: fontSize.lg, fontWeight: '600', marginBottom: spacing.md, color: getColor.text },
    analyticsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
    analyticsLabel: { color: getColor.textSoft },
    analyticsValue: { fontWeight: '600', color: getColor.text },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
    modalContent: { backgroundColor: getColor.card, borderRadius: radius.lg, width: '100%', maxWidth: 500, maxHeight: '90%', padding: spacing.lg },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: getColor.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: '600', color: getColor.text },
    closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: getColor.bg, alignItems: 'center', justifyContent: 'center' },
    modalLabel: { fontSize: fontSize.sm, color: getColor.textSoft, marginTop: spacing.md, marginBottom: 4 },
    modalInput: { backgroundColor: getColor.bg, borderWidth: 1, borderColor: getColor.border, borderRadius: radius.md, padding: spacing.md, color: getColor.text, fontSize: fontSize.md },
    modalPreview: { width: 80, height: 80, borderRadius: radius.sm, marginBottom: spacing.sm, backgroundColor: getColor.bg },
    modalImageButton: { backgroundColor: getColor.bg, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: getColor.border, alignItems: 'center', marginBottom: spacing.md },
    modalImageButtonText: { color: getColor.text },
    modalButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.xl },
    button: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md, minWidth: 100, alignItems: 'center' },
    submitButton: { backgroundColor: getColor.accent },
    cancelButton: { backgroundColor: getColor.bg, borderWidth: 1, borderColor: getColor.border },
    submitText: { color: isDark ? getColor.text : '#ffffff', fontWeight: '600' },
    cancelText: { color: getColor.text, fontWeight: '600' },
    categoryPickerRow: { paddingVertical: spacing.sm, gap: spacing.sm },
    categoryChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: getColor.bg, borderWidth: 1, borderColor: getColor.border },
    categoryChipActive: { backgroundColor: getColor.accent + '20', borderColor: getColor.accent + '40' },
    categoryChipText: { color: getColor.textSoft, fontWeight: '600', fontSize: fontSize.sm },
    categoryChipTextActive: { color: getColor.accent },
    signOutModalContent: { backgroundColor: getColor.card, borderRadius: radius.xl, padding: spacing.xl, width: '90%', maxWidth: 400 },
    signOutModalTitle: { fontSize: fontSize.xxl, fontWeight: '700', color: getColor.text, marginTop: spacing.md },
    signOutModalMessage: { fontSize: fontSize.md, color: getColor.textSoft, textAlign: 'center', lineHeight: 22 },
    signOutConfirmButton: { backgroundColor: getColor.error },
    fullScreenModal: { flex: 1, backgroundColor: getColor.bg },
    locationModalContent: { flex: 1 },
    loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    loadingText: { color: getColor.textInverse, fontSize: fontSize.md, fontWeight: '600' },
  }), [getColor, spacing, radius, fontSize, isDark]);

  // Helpers
  const renderInfoItem = (icon: any, label: string, value?: string) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        <Ionicons name={icon as any} size={20} color={getColor.accent} />
        <View style={{ marginLeft: spacing.md }}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      </View>
    );
  };

  const renderSettingItem = (icon: any, label: string, danger?: boolean, onPress?: () => void) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon as any} size={22} color={danger ? getColor.danger : getColor.accent} />
      <Text style={[styles.settingLabel, danger && { color: getColor.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={getColor.textMuted} />
    </TouchableOpacity>
  );

  const renderAnalyticsRow = (label: string, value: string) => (
    <View style={styles.analyticsRow}>
      <Text style={styles.analyticsLabel}>{label}</Text>
      <Text style={styles.analyticsValue}>{value}</Text>
    </View>
  );

  // Edit Modal Component (Internal)
  const EditStoreModal: React.FC<{ visible: boolean; data: StoreData; onSave: (d: StoreData) => void; onClose: () => void; }> = ({ visible, data, onSave, onClose }) => {
    const [form, setForm] = useState<StoreData>({ ...data });
    const [newCityName, setNewCityName] = useState('');
    const [showAddCity, setShowAddCity] = useState(false);
    const { categories, loadCategories, isLoading: categoriesLoading } = useCategoryStore();

    useEffect(() => {
      if (visible) {
        setForm({ ...data });
        void loadCategories();
      }
    }, [visible, data, loadCategories]);

    const handleChange = (key: keyof StoreData, value: any) => setForm(prev => ({ ...prev, [key]: value }));

    const pickImage = async (field: 'logoUrl' | 'bannerUrl' | 'promoImageUrl') => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets?.[0]) handleChange(field, result.assets[0].uri);
    };

    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le profil</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={getColor.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Nom</Text>
              <TextInput style={styles.modalInput} value={form.name} onChangeText={t => handleChange('name', t)} />
              
              <Text style={styles.modalLabel}>Description</Text>
              <TextInput style={[styles.modalInput, { height: 80 }]} value={form.description} onChangeText={t => handleChange('description', t)} multiline />
              
              <Text style={styles.modalLabel}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPickerRow}>
                {categoriesLoading ? <ActivityIndicator size="small" color={getColor.accent} /> : 
                  categories.map(c => (
                    <TouchableOpacity key={c.id} style={[styles.categoryChip, form.category === c.name && styles.categoryChipActive]} onPress={() => handleChange('category', c.name)}>
                      <Text style={[styles.categoryChipText, form.category === c.name && styles.categoryChipTextActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))
                }
              </ScrollView>

              <View style={{ marginTop: spacing.xl }}>
                <Text style={[styles.modalTitle, { fontSize: fontSize.md, marginBottom: spacing.md }]}>Frais de livraison</Text>
                
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                  {[
                    { id: 'fixed', label: 'Prix Fixe', icon: 'pin' },
                    { id: 'km', label: 'Au KM', icon: 'map' },
                    { id: 'city', label: 'Par Ville', icon: 'business' }
                  ].map(mode => (
                    <TouchableOpacity 
                      key={mode.id}
                      style={[
                        styles.categoryChip, 
                        { flex: 1, alignItems: 'center' },
                        form.deliveryMode === mode.id && styles.categoryChipActive
                      ]}
                      onPress={() => handleChange('deliveryMode', mode.id)}
                    >
                      <Ionicons name={mode.icon as any} size={16} color={form.deliveryMode === mode.id ? getColor.accent : getColor.textMuted} />
                      <Text style={[styles.categoryChipText, form.deliveryMode === mode.id && styles.categoryChipTextActive, { fontSize: 11, marginTop: 4 }]}>
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {form.deliveryMode === 'fixed' && (
                  <View>
                    <Text style={styles.modalLabel}>Frais de livraison par défaut (FCFA)</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      value={form.shippingPrice?.toString() || ''} 
                      onChangeText={t => handleChange('shippingPrice', parseFloat(t) || 0)} 
                      keyboardType="numeric"
                      placeholder="Ex: 1000"
                    />
                  </View>
                )}

                {form.deliveryMode === 'km' && (
                  <View>
                    <Text style={styles.modalLabel}>Prix par Kilomètre (FCFA / KM)</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      value={form.deliveryPriceKm?.toString() || ''} 
                      onChangeText={t => handleChange('deliveryPriceKm', parseFloat(t) || 0)} 
                      keyboardType="numeric"
                      placeholder="Ex: 250"
                    />
                    <Text style={{ fontSize: 12, color: getColor.textMuted, marginTop: 6 }}>
                      Le client sera facturé selon sa distance réelle par rapport à votre boutique.
                    </Text>
                  </View>
                )}

                {form.deliveryMode === 'city' && (
                  <View>
                    <Text style={styles.modalLabel}>Tarifs par Ville</Text>
                    {Object.entries(form.deliveryCityFees || {}).map(([city, fee], idx) => (
                      <View key={idx} style={{ marginBottom: spacing.md, backgroundColor: getColor.bg, borderRadius: 8, padding: spacing.sm }}>
                        {/* Nom de la ville */}
                        <Text style={{ fontSize: 13, color: getColor.textMuted, marginBottom: 4 }}>Ville</Text>
                        <TextInput 
                          style={[styles.modalInput, { marginBottom: spacing.sm }]} 
                          value={city} 
                          editable={false}
                        />
                        {/* Tarif + Supprimer */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: getColor.textMuted, marginBottom: 4 }}>Tarif (FCFA)</Text>
                            <TextInput 
                              style={styles.modalInput}
                              value={fee.toString()} 
                              onChangeText={t => {
                                const next = { ...form.deliveryCityFees };
                                next[city] = parseFloat(t) || 0;
                                handleChange('deliveryCityFees', next);
                              }}
                              keyboardType="numeric"
                              placeholder="0"
                            />
                          </View>
                          <TouchableOpacity 
                            style={{ padding: spacing.sm, marginTop: 20 }}
                            onPress={() => {
                              const next = { ...form.deliveryCityFees };
                              delete next[city];
                              handleChange('deliveryCityFees', next);
                            }}
                          >
                            <Ionicons name="trash-outline" size={22} color={getColor.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    
                    {showAddCity ? (
                      <View style={{ marginTop: spacing.sm }}>
                        <TextInput
                          style={[styles.modalInput, { width: '100%' }]}
                          placeholder="Nom de la ville"
                          value={newCityName}
                          onChangeText={setNewCityName}
                          autoFocus
                        />
                        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                          <TouchableOpacity
                            style={[styles.button, styles.submitButton, { flex: 1 }]}
                            onPress={() => {
                              if (newCityName.trim()) {
                                const next = { ...form.deliveryCityFees };
                                next[newCityName.trim()] = 1000;
                                handleChange('deliveryCityFees', next);
                                setNewCityName('');
                                setShowAddCity(false);
                              }
                            }}
                          >
                            <Text style={styles.submitText}>Confirmer</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.button, styles.cancelButton, { flex: 1 }]}
                            onPress={() => { setNewCityName(''); setShowAddCity(false); }}
                          >
                            <Text style={styles.cancelText}>Annuler</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={[styles.modalImageButton, { marginTop: spacing.sm, borderStyle: 'dashed' }]}
                        onPress={() => setShowAddCity(true)}
                      >
                        <Text style={styles.modalImageButtonText}>+ Ajouter une ville</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <View style={{ marginTop: spacing.xl }}>
                <Text style={styles.modalLabel}>TVA sur les produits (%)</Text>
                <TextInput 
                  style={styles.modalInput} 
                  value={form.taxRate?.toString() || ''} 
                  onChangeText={t => handleChange('taxRate', parseFloat(t) || 0)} 
                  keyboardType="numeric"
                  placeholder="Ex: 18"
                />
              </View>

              <View style={{ marginTop: spacing.xl }}>
                <Text style={styles.modalLabel}>Logo</Text>
                {form.logoUrl && (
                  <OptimizedImage 
                    source={{ uri: cloudinaryService.getOptimizedUrl(form.logoUrl, 800) }} 
                    style={styles.modalPreview} 
                  />
                )}
                <TouchableOpacity style={styles.modalImageButton} onPress={() => pickImage('logoUrl')}>
                  <Text style={styles.modalImageButtonText}>Changer le logo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalImageButton} onPress={() => pickImage('bannerUrl')}>
                  <Text style={styles.modalImageButtonText}>Changer la bannière</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={() => onSave(form)}>
                  <Text style={styles.submitText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Announcements Modal Component (Internal)
  const AnnouncementsModalInner: React.FC<{
    visible: boolean;
    data: StoreData;
    onSave: (banner: string, bannerEnabled: boolean, popup: string, popupEnabled: boolean) => void;
    onClose: () => void;
  }> = ({ visible, data, onSave, onClose }) => {
    const [banner, setBanner] = useState(data.announcementBanner || '');
    const [bannerEnabled, setBannerEnabled] = useState(Boolean(data.announcementBannerEnabled));
    const [popup, setPopup] = useState(data.announcementPopup || '');
    const [popupEnabled, setPopupEnabled] = useState(Boolean(data.announcementPopupEnabled));

    useEffect(() => {
      if (visible) {
        setBanner(data.announcementBanner || '');
        setBannerEnabled(Boolean(data.announcementBannerEnabled));
        setPopup(data.announcementPopup || '');
        setPopupEnabled(Boolean(data.announcementPopupEnabled));
      }
    }, [visible, data]);

    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bannières & Annonces</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={getColor.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              
              {/* Section Bandeau Déroulant */}
              <View style={{ marginBottom: spacing.xl, borderBottomWidth: 1, borderBottomColor: getColor.border, paddingBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text style={[styles.modalTitle, { fontSize: fontSize.md }]}>Bandeau d'annonce boutique</Text>
                  <TouchableOpacity 
                    onPress={() => setBannerEnabled(!bannerEnabled)}
                    style={{
                      width: 48,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: bannerEnabled ? getColor.accent : getColor.border,
                      padding: 2,
                      justifyContent: 'center',
                      alignItems: bannerEnabled ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'white', elevation: 2 }} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 13, color: getColor.textMuted, marginBottom: spacing.md }}>
                  Affiche un bandeau déroulant coloré tout en haut de votre page boutique (ex: promotions, horaires exceptionnels).
                </Text>
                {bannerEnabled && (
                  <TextInput 
                    style={styles.modalInput} 
                    value={banner} 
                    onChangeText={setBanner} 
                    placeholder="Ex: -20% sur toute la collection avec le code PRINTEMPS !" 
                    placeholderTextColor={getColor.textMuted}
                  />
                )}
              </View>

              {/* Section Pop-up d'Annonce */}
              <View style={{ marginBottom: spacing.xl }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text style={[styles.modalTitle, { fontSize: fontSize.md }]}>Pop-up d'annonce boutique</Text>
                  <TouchableOpacity 
                    onPress={() => setPopupEnabled(!popupEnabled)}
                    style={{
                      width: 48,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: popupEnabled ? getColor.accent : getColor.border,
                      padding: 2,
                      justifyContent: 'center',
                      alignItems: popupEnabled ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'white', elevation: 2 }} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 13, color: getColor.textMuted, marginBottom: spacing.md }}>
                  Affiche une boîte de dialogue d'annonce au client dès qu'il ouvre la page de votre boutique (idéal pour les annonces importantes).
                </Text>
                {popupEnabled && (
                  <TextInput 
                    style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]} 
                    value={popup} 
                    onChangeText={setPopup} 
                    multiline
                    placeholder="Ex: Chers clients, nous sommes fermés exceptionnellement ce vendredi pour inventaire. Réouverture samedi !" 
                    placeholderTextColor={getColor.textMuted}
                  />
                )}
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={() => onSave(banner, bannerEnabled, popup, popupEnabled)}>
                  <Text style={styles.submitText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };
  // Edit Hours Modal Component
  const EditHoursModal: React.FC<{ visible: boolean; data: StoreData; onSave: (d: StoreData) => void; onClose: () => void; }> = ({ visible, data, onSave, onClose }) => {
    const [formHours, setFormHours] = useState<any>(data.businessHours || {});

    useEffect(() => {
      if (visible) setFormHours(data.businessHours || {});
    }, [visible, data]);

    const days = [
      { key: 'monday', label: 'Lundi' },
      { key: 'tuesday', label: 'Mardi' },
      { key: 'wednesday', label: 'Mercredi' },
      { key: 'thursday', label: 'Jeudi' },
      { key: 'friday', label: 'Vendredi' },
      { key: 'saturday', label: 'Samedi' },
      { key: 'sunday', label: 'Dimanche' },
    ];

    const updateDay = (day: string, field: 'isOpen' | 'open' | 'close', value: any) => {
      setFormHours((prev: any) => ({
        ...prev,
        [day]: { ...(prev[day] || { isOpen: true, open: '08:00', close: '18:00' }), [field]: value }
      }));
    };

    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Horaires d'ouverture</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={getColor.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.md }}>
              {days.map(d => {
                const dayData = formHours[d.key] || { isOpen: true, open: '08:00', close: '18:00' };
                return (
                  <View key={d.key} style={{ marginBottom: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: getColor.border + '20' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                      <Text style={{ fontWeight: '700', color: getColor.text, fontSize: fontSize.md }}>{d.label}</Text>
                      <TouchableOpacity
                        onPress={() => updateDay(d.key, 'isOpen', !dayData.isOpen)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      >
                        <Text style={{ color: dayData.isOpen ? getColor.accent : getColor.textSoft, fontSize: fontSize.xs, fontWeight: '600' }}>
                          {dayData.isOpen ? 'OUVERT' : 'FERMÉ'}
                        </Text>
                        <Ionicons 
                          name={dayData.isOpen ? "checkmark-circle" : "ellipse-outline"} 
                          size={24} 
                          color={dayData.isOpen ? getColor.accent : getColor.border} 
                        />
                      </TouchableOpacity>
                    </View>
                    
                    {dayData.isOpen ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, color: getColor.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Ouverture</Text>
                          <TextInput
                            style={[styles.modalInput, { paddingVertical: 8, textAlign: 'center' }]}
                            value={dayData.open}
                            onChangeText={(t) => updateDay(d.key, 'open', t)}
                            placeholder="08:00"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                        <Ionicons name="arrow-forward" size={16} color={getColor.border} style={{ marginTop: 20 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, color: getColor.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>Fermeture</Text>
                          <TextInput
                            style={[styles.modalInput, { paddingVertical: 8, textAlign: 'center' }]}
                            value={dayData.close}
                            onChangeText={(t) => updateDay(d.key, 'close', t)}
                            placeholder="18:00"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={{ paddingVertical: 4 }}>
                        <Text style={{ color: getColor.textSoft, fontStyle: 'italic', fontSize: fontSize.sm }}>La boutique est fermée toute la journée.</Text>
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={() => onSave({ ...data, businessHours: formHours })}>
                  <Text style={styles.submitText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={getColor.bg} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={getColor.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ma boutique</Text>
        <TouchableOpacity style={styles.editButton} onPress={() => setShowEditModal(true)}>
          <Ionicons name="pencil" size={18} color={getColor.accent} />
        </TouchableOpacity>
      </View>

      <EditStoreModal visible={showEditModal} data={storeData} onClose={() => setShowEditModal(false)} onSave={handleSaveStore} />
      <EditHoursModal visible={showHoursModal} data={storeData} onClose={() => setShowHoursModal(false)} onSave={handleSaveStore} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={getColor.accent} />
        ) : !store ? (
          <Text style={{ textAlign: 'center', marginTop: 40, color: getColor.textSoft }}>Boutique non trouvée.</Text>
        ) : (
          <>
            <View style={[styles.bannerContainer, { backgroundColor: getColor.card, overflow: 'hidden' }]}>
              <TouchableOpacity onPress={() => handleQuickImageUpdate('bannerUrl')} activeOpacity={0.8} style={{ width: '100%', height: '100%' }}>
                <OptimizedImage 
                  key={storeData.bannerUrl || 'default'} 
                  source={{ uri: cloudinaryService.getOptimizedUrl(storeData.bannerUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926', 800) }} 
                  style={styles.banner} 
                />
                <View style={styles.bannerOverlay} />
                <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 6 }}>
                  <Ionicons name="camera" size={16} color="white" />
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.logoContainer} onPress={() => handleQuickImageUpdate('logoUrl')} activeOpacity={0.8}>
                <OptimizedImage source={{ uri: cloudinaryService.getOptimizedUrl(storeData.logoUrl || 'https://picsum.photos/200', 800) }} style={styles.logo} />
                <View style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: getColor.accent, borderRadius: 15, padding: 4, borderWidth: 2, borderColor: getColor.bg }}>
                  <Ionicons name="camera" size={14} color="white" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{storeData.name}</Text>
              {storeData.category && <View style={styles.categoryBadge}><Text style={styles.categoryText}>{storeData.category}</Text></View>}
              {storeData.description && <Text style={styles.storeDescription}>{storeData.description}</Text>}

              <View style={styles.statsRow}>
                <View style={styles.stat}><Text style={styles.statValue}>{(storeData.products ?? 0)}</Text><Text style={styles.statLabel}>Produits</Text></View>
                <View style={styles.statDivider} />
                <View style={styles.stat}><Text style={styles.statValue}>{(storeData.orders ?? 0)}</Text><Text style={styles.statLabel}>Commandes</Text></View>
              </View>
            </View>

            <View style={styles.tabsContainer}>
              {tabs.map(t => (
                <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.tabActive]} onPress={() => setActiveTab(t.id as any)}>
                  <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.tabContent}>
              {activeTab === 'info' && (
                <View style={styles.card}>
                  {renderInfoItem('call-outline', 'Téléphone', storeData.phone)}
                  {renderInfoItem('logo-whatsapp', 'WhatsApp', storeData.whatsapp)}
                  {renderInfoItem('mail-outline', 'Email', storeData.email)}
                  {renderInfoItem('location-outline', 'Adresse', storeData.address)}
                </View>
              )}

              {activeTab === 'settings' && (
                <View style={styles.card}>
                  {renderSettingItem('qr-code-outline', 'QR Code boutique', false, handleShowQrLink)}
                  {renderSettingItem('share-social-outline', 'Partager la boutique', false, handleShareStore)}
                  {renderSettingItem('time-outline', 'Horaires d\'ouverture', false, () => setShowHoursModal(true))}
                  {renderSettingItem('megaphone-outline', 'Bannières & Annonces Boutique', false, () => setShowAnnouncementsModal(true))}
                  {renderSettingItem(storeData.isPaused ? 'play-circle-outline' : 'pause-circle-outline', storeData.isPaused ? 'Réactiver la boutique' : 'Mettre en pause (Fermeture)', storeData.isPaused === false, handleTogglePause)}
                  {renderSettingItem('location-outline', 'Localisation de la boutique', false, () => setShowLocationPicker(true))}
                  
                  <View style={styles.settingItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="color-palette-outline" size={22} color={getColor.accent} />
                      <Text style={styles.settingLabel}>Thème de l'application</Text>
                    </View>
                    <ThemeToggle />
                  </View>

                  {renderSettingItem('cash-outline', `TVA: ${storeData.taxRate || 0}%`, false, () => setShowEditModal(true))}
                  {storeData.deliveryMode === 'km' ? (
                    renderSettingItem('map-outline', `Livraison: ${storeData.deliveryPriceKm || 0} FCFA/KM`, false, () => setShowEditModal(true))
                  ) : storeData.deliveryMode === 'city' ? (
                    renderSettingItem('business-outline', `Livraison: Par Ville (${Object.keys(storeData.deliveryCityFees || {}).length})`, false, () => setShowEditModal(true))
                  ) : (
                    renderSettingItem('pin-outline', `Livraison: ${storeData.shippingPrice || 0} FCFA`, false, () => setShowEditModal(true))
                  )}

                  {renderSettingItem('key-outline', 'Changer le mot de passe', false, () => setShowPasswordModal(true))}
                  {renderSettingItem('log-out-outline', 'Se déconnecter', true, () => setShowSignOutModal(true))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Reusable Modals */}
      <Modal visible={showPasswordModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Changer le mot de passe</Text>
             <TextInput style={[styles.modalInput, { marginTop: 20 }]} placeholder="Mot de passe actuel" secureTextEntry onChangeText={t => setPasswordData(p => ({...p, currentPassword: t}))} />
             <TextInput style={[styles.modalInput, { marginTop: 10 }]} placeholder="Nouveau mot de passe" secureTextEntry onChangeText={t => setPasswordData(p => ({...p, newPassword: t}))} />
             <TextInput style={[styles.modalInput, { marginTop: 10 }]} placeholder="Confirmer" secureTextEntry onChangeText={t => setPasswordData(p => ({...p, confirmPassword: t}))} />
             <View style={styles.modalButtonRow}>
               <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setShowPasswordModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
               <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={handleUpdatePassword}><Text style={styles.submitText}>Mettre à jour</Text></TouchableOpacity>
             </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSignOutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.signOutModalContent}>
             <Text style={styles.signOutModalTitle}>Déconnexion</Text>
             <Text style={styles.signOutModalMessage}>Voulez-vous vraiment vous déconnecter ?</Text>
             <View style={styles.modalButtonRow}>
               <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setShowSignOutModal(false)}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
               <TouchableOpacity style={[styles.button, styles.signOutConfirmButton]} onPress={confirmSignOut}><Text style={styles.submitText}>Quitter</Text></TouchableOpacity>
             </View>
          </View>
        </View>
      </Modal>

      {/* QR Code boutique */}
      <Modal visible={showQrModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 30 }]}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 15, right: 15 }}
              onPress={() => setShowQrModal(false)}
            >
              <Ionicons name="close" size={24} color={getColor.textMuted} />
            </TouchableOpacity>

            <Ionicons name="qr-code-outline" size={32} color={getColor.accent} style={{ marginBottom: 12 }} />
            <Text style={[styles.modalTitle, { marginBottom: 20 }]}>QR Code de votre boutique</Text>

            {store?.slug && storePublicUrl ? (
              <Image
                source={{ uri: qrCodeService.getQrImageUrl(storePublicUrl, 200) }}
                style={{ width: 200, height: 200, marginBottom: 20 }}
              />
            ) : null}

            <Text style={{ color: getColor.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
              {storePublicUrl}
            </Text>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { width: '100%', marginBottom: 10 }]}
              onPress={handleDownloadQr}
            >
              <Text style={[styles.submitText, { color: getColor.text }]}>Télécharger le QR code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton, { width: '100%' }]}
              onPress={() => { setShowQrModal(false); handleShareStore(); }}
            >
              <Text style={styles.submitText}>Partager le lien</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View style={styles.fullScreenModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Modifier la localisation</Text>
            <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
              <Ionicons name="close" size={24} color={getColor.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.locationModalContent}>
            <LocationPicker
              initialLocation={
                store?.latitude && store?.longitude
                  ? { latitude: store.latitude, longitude: store.longitude }
                  : undefined
              }
              onLocationSelect={handleLocationUpdate}
            />
          </ScrollView>

          {updatingLocation && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={getColor.textInverse} />
              <Text style={styles.loadingText}>Mise à jour en cours...</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Announcements Modal */}
      <AnnouncementsModalInner 
        visible={showAnnouncementsModal}
        data={storeData}
        onSave={handleSaveAnnouncements}
        onClose={() => setShowAnnouncementsModal(false)}
      />
    </View>
  );
};
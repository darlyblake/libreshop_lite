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
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cloudinaryService } from '../lib/cloudinaryService';
import { orderService, productService, storeService, type Store, authService } from '../lib/supabase';
import { useAuthStore } from '../store';
import { useCategoryStore } from '../store/categoryStore';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';

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
    
    let webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    
    if (!webBaseUrl && Platform.OS === 'web' && typeof window !== 'undefined') {
      webBaseUrl = window.location.origin.replace(/\/+$/, '');
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
              onPress: () => navigation.replace('Pricing', { fromExpiredStore: true, storeName: s.name }),
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
        promoEnabled: Boolean((s as any).promo_enabled),
        promoTitle: String((s as any).promo_title || ''),
        promoSubtitle: String((s as any).promo_subtitle || ''),
        promoImageUrl: String((s as any).promo_image_url || ''),
        promoTargetType: (s as any).promo_target_type || undefined,
        promoTargetId: (s as any).promo_target_id ? String((s as any).promo_target_id) : undefined,
        promoTargetUrl: (s as any).promo_target_url ? String((s as any).promo_target_url) : undefined,
        products: Array.isArray(products) ? products.length : 0,
        orders: Array.isArray(orders) ? orders.length : 0,
        phone: (s as any).phone,
        whatsapp: (s as any).whatsapp,
        email: (s as any).email,
        address: (s as any).address,
        taxRate: Number((s as any).tax_rate) || 0,
        shippingPrice: Number((s as any).shipping_price) || 0,
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
      errorHandler.handleDatabaseError(e, 'SaveStore');
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
      Alert.alert('Partager', 'Lien boutique indisponible.');
      return;
    }
    try {
      if (Platform.OS === 'web' || !Share?.share) {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(storePublicUrl);
          Alert.alert('Succès', `Lien copié:\n${storePublicUrl}`);
        } else {
          Alert.alert('Lien boutique', storePublicUrl);
        }
      } else {
        await Share.share({ message: storePublicUrl });
      }
    } catch (e: any) {
      Alert.alert('Lien boutique', storePublicUrl);
    }
  };

  const handleShowQrLink = () => {
    if (!storePublicUrl) return;
    Alert.alert('Lien boutique', storePublicUrl, [
      { text: 'Fermer', style: 'cancel' },
      { text: 'Partager', onPress: handleShareStore },
    ]);
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
      await authService.updatePassword(passwordData.newPassword);
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
    signOutModalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: getColor.text, marginTop: spacing.md },
    signOutModalMessage: { fontSize: fontSize.md, color: getColor.textSoft, textAlign: 'center', lineHeight: 22 },
    signOutConfirmButton: { backgroundColor: getColor.error },
  }), [getColor, spacing, radius, fontSize, isDark]);

  // Helpers
  const renderInfoItem = (icon: any, label: string, value?: string) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        <Ionicons name={icon} size={20} color={getColor.accent} />
        <View style={{ marginLeft: spacing.md }}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      </View>
    );
  };

  const renderSettingItem = (icon: any, label: string, danger?: boolean, onPress?: () => void) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon} size={22} color={danger ? getColor.danger : getColor.accent} />
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

              <Text style={styles.modalLabel}>Logo</Text>
              {form.logoUrl && <Image source={{ uri: form.logoUrl }} style={styles.modalPreview} />}
              <TouchableOpacity style={styles.modalImageButton} onPress={() => pickImage('logoUrl')}><Text style={styles.modalImageButtonText}>Changer le logo</Text></TouchableOpacity>

              <TouchableOpacity style={styles.modalImageButton} onPress={() => pickImage('bannerUrl')}><Text style={styles.modalImageButtonText}>Changer la bannière</Text></TouchableOpacity>
              
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>TVA (%)</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    value={form.taxRate?.toString() || ''} 
                    onChangeText={t => handleChange('taxRate', parseFloat(t) || 0)} 
                    keyboardType="numeric"
                    placeholder="Ex: 18"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Frais livraison (FCFA)</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    value={form.shippingPrice?.toString() || ''} 
                    onChangeText={t => handleChange('shippingPrice', parseFloat(t) || 0)} 
                    keyboardType="numeric"
                    placeholder="Ex: 1500"
                  />
                </View>
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={() => onSave(form)}><Text style={styles.submitText}>Enregistrer</Text></TouchableOpacity>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={getColor.accent} />
        ) : !store ? (
          <Text style={{ textAlign: 'center', marginTop: 40, color: getColor.textSoft }}>Boutique non trouvée.</Text>
        ) : (
          <>
            <View style={styles.bannerContainer}>
              <TouchableOpacity onPress={() => handleQuickImageUpdate('bannerUrl')} activeOpacity={0.8}>
                <Image source={{ uri: storeData.bannerUrl || 'https://picsum.photos/800' }} style={styles.banner} />
                <View style={styles.bannerOverlay} />
                <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 6 }}>
                  <Ionicons name="camera" size={16} color="white" />
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.logoContainer} onPress={() => handleQuickImageUpdate('logoUrl')} activeOpacity={0.8}>
                <Image source={{ uri: storeData.logoUrl || 'https://picsum.photos/200' }} style={styles.logo} />
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
                  
                  <View style={styles.settingItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="color-palette-outline" size={22} color={getColor.accent} />
                      <Text style={styles.settingLabel}>Thème de l'application</Text>
                    </View>
                    <ThemeToggle />
                  </View>

                  {renderSettingItem('cash-outline', `TVA: ${storeData.taxRate || 0}%`, false, () => setShowEditModal(true))}
                  {renderSettingItem('car-outline', `Livraison: ${storeData.shippingPrice || 0} FCFA`, false, () => setShowEditModal(true))}

                  {renderSettingItem('key-outline', 'Changer le mot de passe', false, () => setShowPasswordModal(true))}
                  {renderSettingItem('log-out-outline', 'Se déconnecter', true, () => setShowSignOutModal(true))}
                </View>
              )}

              {activeTab === 'analytics' && (
                <View>
                  <Text style={[styles.analyticsTitle, { marginBottom: 16 }]}>Aperçu des performances</Text>
                  <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                    <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: 24 }]}>
                      <Ionicons name="cube" size={32} color={getColor.accent} style={{ marginBottom: 8 }} />
                      <Text style={{ fontSize: 24, fontWeight: '700', color: getColor.text }}>{storeData.products || 0}</Text>
                      <Text style={{ fontSize: 13, color: getColor.textMuted }}>Produits Actifs</Text>
                    </View>
                    <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: 24 }]}>
                      <Ionicons name="cart" size={32} color="#10b981" style={{ marginBottom: 8 }} />
                      <Text style={{ fontSize: 24, fontWeight: '700', color: getColor.text }}>{storeData.orders || 0}</Text>
                      <Text style={{ fontSize: 13, color: getColor.textMuted }}>Commandes Totales</Text>
                    </View>
                  </View>
                  <View style={styles.card}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: getColor.text, marginBottom: 16 }}>Détails livraison</Text>
                    {renderAnalyticsRow('Frais de livraison', storeData.shippingPrice ? `${storeData.shippingPrice} FCFA` : 'Livraison Gratuite')}
                  </View>
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
    </View>
  );
};
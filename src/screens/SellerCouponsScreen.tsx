import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { couponService, Coupon } from '../services/couponService';

export const SellerCouponsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fontSize, isMobile } = useResponsive();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'free_shipping'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [isActive, setIsActive] = useState(true);

  const loadData = async (showLoading = true) => {
    if (!user?.id) return;
    try {
      if (showLoading) setLoading(true);
      const store = await storeService.getByUser(user.id);
      if (store) {
        if (!storeService.isSubscriptionActive(store)) {
          Alert.alert(
            'Abonnement expiré',
            `Votre abonnement pour "${store.name}" a expiré. Veuillez le renouveler pour accéder aux coupons.`,
            [
              {
                text: 'Renouveler',
                onPress: () => navigation.replace('SubscriptionExpired'),
              },
            ]
          );
          return;
        }
        setStoreId(store.id);
        const storeCoupons = await couponService.getByStore(store.id);
        setCoupons(storeCoupons);
      }
    } catch (e) {
      console.error('Error loading coupons:', e);
      Alert.alert('Erreur', 'Impossible de charger les codes promo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleOpenModal = (coupon?: Coupon) => {
    if (coupon) {
      setEditingId(coupon.id);
      setCode(coupon.code);
      setDiscountType(coupon.discount_type);
      setDiscountValue(coupon.discount_value.toString());
      setMinOrderAmount(coupon.min_order_amount ? coupon.min_order_amount.toString() : '');
      setUsageLimit(coupon.usage_limit ? coupon.usage_limit.toString() : '');
      setIsActive(coupon.is_active);
    } else {
      setEditingId(null);
      setCode('');
      setDiscountType('percentage');
      setDiscountValue('');
      setMinOrderAmount('');
      setUsageLimit('');
      setIsActive(true);
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!storeId) return;
    if (!code.trim()) {
      Alert.alert('Erreur', 'Le code promo est requis.');
      return;
    }
    if (discountType !== 'free_shipping' && !discountValue.trim()) {
      Alert.alert('Erreur', 'La valeur de la réduction est requise.');
      return;
    }

    try {
      setLoading(true);
      const couponData = {
        store_id: storeId,
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: discountType === 'free_shipping' ? 0 : parseFloat(discountValue) || 0,
        min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : undefined,
        usage_limit: usageLimit ? parseInt(usageLimit, 10) : undefined,
        is_active: isActive,
        start_date: new Date().toISOString(),
      };

      if (editingId) {
        await couponService.update(editingId, couponData);
        Alert.alert('Succès', 'Code promo mis à jour.');
      } else {
        await couponService.create(couponData);
        Alert.alert('Succès', 'Nouveau code promo créé !');
      }
      setModalVisible(false);
      loadData(false);
    } catch (e: any) {
      console.error('Save error:', e);
      Alert.alert('Erreur', e.message || 'Impossible de sauvegarder le code promo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Confirmer', 'Voulez-vous supprimer ce code promo ?', [
      { text: 'Annuler', style: 'cancel' },
      { 
        text: 'Supprimer', 
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await couponService.delete(id);
            loadData(false);
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer.');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const toggleStatus = async (coupon: Coupon) => {
    try {
      setLoading(true);
      await couponService.update(coupon.id, { is_active: !coupon.is_active });
      loadData(false);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de changer le statut.');
    } finally {
      setLoading(false);
    }
  };

  const renderCouponCard = (coupon: Coupon) => {
    return (
      <View key={coupon.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.codeContainer}>
            <Ionicons name="ticket" size={fontSize.md} color={COLORS.primary} style={{ marginRight: SPACING.xs }} />
            <Text style={[styles.codeText, { fontSize: fontSize.lg }]}>{coupon.code}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.statusBadge, { backgroundColor: coupon.is_active ? COLORS.success + '20' : COLORS.textMuted + '20' }]}
            onPress={() => toggleStatus(coupon)}
          >
            <Text style={[styles.statusText, { color: coupon.is_active ? COLORS.success : COLORS.textMuted }]}>
              {coupon.is_active ? 'Actif' : 'Inactif'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.discountText, { fontSize: fontSize.md }]}>
            {coupon.discount_type === 'percentage' && `-${coupon.discount_value}% de réduction`}
            {coupon.discount_type === 'fixed' && `-${coupon.discount_value} FCFA de réduction`}
            {coupon.discount_type === 'free_shipping' && `Livraison gratuite`}
          </Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="cart-outline" size={fontSize.sm} color={COLORS.textMuted} />
              <Text style={styles.statText}>
                {coupon.min_order_amount ? `Min. ${coupon.min_order_amount}F` : 'Sans minimum'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={fontSize.sm} color={COLORS.textMuted} />
              <Text style={styles.statText}>
                {coupon.usage_count} {coupon.usage_limit ? `/ ${coupon.usage_limit}` : 'utilisations'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenModal(coupon)}>
            <Ionicons name="pencil-outline" size={fontSize.md} color={COLORS.text} />
            <Text style={styles.actionText}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderLeftWidth: 1, borderColor: COLORS.border }]} onPress={() => handleDelete(coupon.id)}>
            <Ionicons name="trash-outline" size={fontSize.md} color={COLORS.danger} />
            <Text style={[styles.actionText, { color: COLORS.danger }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={[COLORS.primary, COLORS.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: fontSize.xl }]}>Codes Promo</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => handleOpenModal()}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : coupons.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="ticket-outline" size={80} color={COLORS.border} />
          <Text style={[styles.emptyText, { fontSize: fontSize.md }]}>Aucun code promo créé.</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => handleOpenModal()}>
            <Text style={styles.createBtnText}>Créer un code promo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {coupons.map(renderCouponCard)}
        </ScrollView>
      )}

      {/* Modal de création/édition */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { marginTop: insets.top + SPACING.xl }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: fontSize.xl }]}>
                {editingId ? 'Modifier le code' : 'Nouveau code promo'}
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Code promo (ex : SOLDES20)</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Entrez le code"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
              />

              <Text style={styles.label}>Type de réduction</Text>
              <View style={styles.typeSelector}>
                {[
                  { id: 'percentage', label: 'Pourcentage (%)' },
                  { id: 'fixed', label: 'Montant fixe (F)' },
                  { id: 'free_shipping', label: 'Livraison gratuite' }
                ].map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeBtn, discountType === type.id && styles.typeBtnActive]}
                    onPress={() => setDiscountType(type.id as any)}
                  >
                    <Text style={[styles.typeBtnText, discountType === type.id && styles.typeBtnTextActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {discountType !== 'free_shipping' && (
                <>
                  <Text style={styles.label}>Valeur de la réduction</Text>
                  <TextInput
                    style={styles.input}
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    placeholder={discountType === 'percentage' ? "Ex : 10" : "Ex : 2000"}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={styles.label}>Montant minimum d'achat (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={minOrderAmount}
                onChangeText={setMinOrderAmount}
                placeholder="Ex : 10000"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Limite d'utilisations (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={usageLimit}
                onChangeText={setUsageLimit}
                placeholder="Ex : 50"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />

              <TouchableOpacity 
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Sauvegarder</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backButton: { padding: SPACING.xs },
  addButton: { padding: SPACING.xs },
  headerTitle: { color: '#fff', fontWeight: 'bold' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  emptyText: { color: COLORS.textMuted, marginTop: SPACING.md, marginBottom: SPACING.xl },
  createBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.lg },
  createBtnText: { color: '#fff', fontWeight: '600' },
  scrollContent: { padding: SPACING.md },
  
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  codeContainer: { flexDirection: 'row', alignItems: 'center' },
  codeText: { fontWeight: 'bold', color: COLORS.primary },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardBody: { padding: SPACING.md },
  discountText: { fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: COLORS.textMuted },
  cardFooter: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border },
  actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.sm },
  actionText: { fontWeight: '500', color: COLORS.text },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: COLORS.card, 
    borderTopLeftRadius: RADIUS.xl, 
    borderTopRightRadius: RADIUS.xl, 
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0px -4px 10px rgba(0,0,0,0.1)',
      }
    }),
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: SPACING.md,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: SPACING.lg, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  modalTitle: { fontWeight: '800', color: COLORS.text },
  closeButton: {
    padding: SPACING.xs,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalScroll: { padding: SPACING.lg },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.md },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  typeBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  typeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  typeBtnText: { color: COLORS.textMuted, fontWeight: '600' },
  typeBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  saveBtn: { 
    backgroundColor: COLORS.primary, 
    padding: SPACING.lg, 
    borderRadius: RADIUS.lg, 
    alignItems: 'center', 
    marginTop: SPACING.xxl, 
    marginBottom: SPACING.xxxl, 
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 4px 8px rgba(139, 92, 246, 0.2)',
      }
    })
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default SellerCouponsScreen;

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList, Alert, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { refundService, Refund } from '../services/refundService';
import { errorHandler } from '../utils/errorHandler';

export const SellerRefundsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [stats, setStats] = useState({ totalRefunds: 0, totalAmount: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0, processedCount: 0 });

  useEffect(() => { loadStore(); }, [user?.id]);
  useEffect(() => { if (storeId) { loadRefunds(); loadStats(); } }, [storeId, selectedStatus]);

  const loadStore = async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (store?.id) {
        if (!storeService.isSubscriptionActive(store)) {
          Alert.alert(
            'Abonnement expiré',
            `Votre abonnement pour "${store.name}" a expiré. Veuillez le renouveler pour accéder aux remboursements.`,
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
      }
    } catch (e) { errorHandler.handleDatabaseError(e as Error, 'Error loading store'); }
  };

  const loadRefunds = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const status = selectedStatus === 'all' ? undefined : selectedStatus;
      const data = await refundService.getRefundsByStore(storeId, status);
      setRefunds(data);
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error loading refunds');
      Alert.alert('Erreur', 'Impossible de charger les remboursements');
    } finally { setLoading(false); }
  };

  const loadStats = async () => {
    if (!storeId) return;
    try {
      const data = await refundService.getRefundStats(storeId);
      setStats(data);
    } catch (e) { errorHandler.handleDatabaseError(e as Error, 'Error loading stats'); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRefunds(), loadStats()]);
    setRefreshing(false);
  };

  const handleApprove = async (id: string) => {
    try {
      Alert.alert('Confirmer', 'Approuver ce remboursement ?', [
        { text: 'Annuler' },
        { text: 'Approuver', onPress: async () => { await refundService.approveRefund(id, user?.id || 'seller'); await loadRefunds(); await loadStats(); } }
      ]);
    } catch (e) { Alert.alert('Erreur', 'Impossible d\'approuver'); }
  };

  const handleReject = async (id: string) => {
    try {
      Alert.alert('Confirmer', 'Rejeter ce remboursement ?', [
        { text: 'Annuler' },
        { text: 'Rejeter', onPress: async () => { await refundService.rejectRefund(id, user?.id || 'seller'); await loadRefunds(); await loadStats(); } }
      ]);
    } catch (e) { Alert.alert('Erreur', 'Impossible de rejeter'); }
  };

  const handleProcessed = async (id: string) => {
    try {
      await refundService.markAsProcessed(id, user?.id || 'seller');
      await loadRefunds();
      await loadStats();
    } catch (e) { Alert.alert('Erreur', 'Impossible de marquer'); }
  };

  const handleAutoApprove = async () => {
    try {
      Alert.alert('Auto-approbation', 'Approuver les remboursements sous 5000 FCFA ?', [
        { text: 'Annuler' },
        { text: 'Confirmer', onPress: async () => { await refundService.autoApproveRefunds(storeId!, 5000); await loadRefunds(); await loadStats(); } }
      ]);
    } catch (e) { Alert.alert('Erreur', 'Impossible'); }
  };

  const formatAmount = (a: number) => a.toLocaleString('fr-FR') + ' FCFA';

  const getStatusColor = (s: string) => s === 'pending' ? COLORS.warning : s === 'approved' ? COLORS.info : s === 'rejected' ? COLORS.danger : COLORS.success;
  const getStatusLabel = (s: string) => s === 'pending' ? 'En attente' : s === 'approved' ? 'Approuvé' : s === 'rejected' ? 'Rejeté' : 'Traité';

  const renderRefund = ({ item }: { item: Refund }) => (
    <View style={styles.refundItem}>
      <View style={styles.refundHeader}>
        <Text style={styles.refundOrderId}>CMD: {item.orderId.slice(0, 8)}</Text>
        <Text style={[styles.refundStatus, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
      </View>
      <Text style={styles.refundAmount}>{formatAmount(item.amount)}</Text>
      <Text style={styles.refundReason}>{item.reason}</Text>
      {item.status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => handleApprove(item.id)}>
            <Text style={styles.btnText}>Approuver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => handleReject(item.id)}>
            <Text style={styles.btnText}>Rejeter</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.status === 'approved' && (
        <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primary }]} onPress={() => handleProcessed(item.id)}>
          <Text style={styles.btnText}>Marquer traité</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></TouchableOpacity>
        <Text style={styles.title}>Remboursements</Text>
        <TouchableOpacity onPress={handleAutoApprove}><Ionicons name="flash" size={24} color={COLORS.warning} /></TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statVal}>{stats.totalRefunds}</Text><Text style={styles.statLbl}>Total</Text></View>
          <View style={styles.stat}><Text style={[styles.statVal, { color: COLORS.warning }]}>{stats.pendingCount}</Text><Text style={styles.statLbl}>En attente</Text></View>
          <View style={styles.stat}><Text style={[styles.statVal, { color: COLORS.success }]}>{stats.processedCount}</Text><Text style={styles.statLbl}>Traités</Text></View>
        </View>

        <View style={styles.total}><Text style={styles.totalLbl}>Total remboursé: {formatAmount(stats.totalAmount)}</Text></View>

        <ScrollView horizontal style={styles.filter}>
          {['all', 'pending', 'approved', 'rejected', 'processed'].map(s => (
            <TouchableOpacity key={s} style={[styles.filterBtn, selectedStatus === s && styles.filterBtnActive]} onPress={() => setSelectedStatus(s)}>
              <Text style={[styles.filterBtnTxt, selectedStatus === s && styles.filterBtnTxtActive]}>{s === 'all' ? 'Tous' : getStatusLabel(s)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator size="large" color={COLORS.primary} /> : (
          <FlatList data={refunds} keyExtractor={i => i.id} renderItem={renderRefund} ListEmptyComponent={<Text style={styles.empty}>Aucun remboursement</Text>} scrollEnabled={false} />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.card },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  stats: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.md },
  stat: { flex: 1, alignItems: 'center', backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: RADIUS.md },
  statVal: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.primary },
  statLbl: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  total: { padding: SPACING.md, backgroundColor: COLORS.card, margin: SPACING.md, borderRadius: RADIUS.md },
  totalLbl: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  filter: { flexDirection: 'row', paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  filterBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginRight: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.sm },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterBtnTxt: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  filterBtnTxtActive: { color: COLORS.white },
  refundItem: { backgroundColor: COLORS.card, margin: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md },
  refundHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  refundOrderId: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  refundStatus: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  refundAmount: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.xs },
  refundReason: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.sm },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  btn: { flex: 1, padding: SPACING.sm, borderRadius: RADIUS.sm, alignItems: 'center' },
  btnText: { color: COLORS.white, fontWeight: '600' },
  empty: { textAlign: 'center', padding: SPACING.xxl, color: COLORS.textMuted },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { financeService, WalletStats, Transaction } from '../services/financeService';
import { WithdrawalRequest, KYCStatus } from '../lib/supabase';
import { errorHandler } from '../utils/errorHandler';

export const SellerFinanceScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [showBalance, setShowBalance] = useState(true);
  
  const [walletStats, setWalletStats] = useState<WalletStats>({ availableBalance: 0, pendingBalance: 0, totalWithdrawn: 0 });
  const [kycStatus, setKycStatus] = useState<KYCStatus>('unverified');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  // Withdraw Modal State
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('Orange Money');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  const withdrawMethods = ['Orange Money', 'MTN MoMo', 'Wave', 'Virement Bancaire'];

  useEffect(() => {
    loadStore();
  }, [user]);

  useEffect(() => {
    if (storeId) {
      loadFinanceData();
    }
  }, [storeId]);

  const loadStore = async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (store?.id) {
        if (!storeService.isSubscriptionActive(store)) {
          Alert.alert(
            'Abonnement expiré',
            `Votre abonnement pour "${store.name}" a expiré. Veuillez le renouveler pour accéder à la finance.`,
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
    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'Error loading store for finance');
    }
  };

  const loadFinanceData = async () => {
    if (!storeId) return;
    try {
      const [stats, kyc, txs, wds] = await Promise.all([
        financeService.getWalletStats(storeId),
        financeService.getKYCStatus(storeId),
        financeService.getRecentTransactions(storeId),
        financeService.getWithdrawals(storeId),
      ]);
      setWalletStats(stats);
      setKycStatus(kyc);
      setTransactions(txs);
      setWithdrawals(wds);
    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'Error loading finance data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFinanceData();
    setRefreshing(false);
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('fr-FR') + ' FCFA';
  };

  const handleWithdrawRequest = async () => {
    if (kycStatus !== 'verified') {
      Alert.alert(
        'Vérification requise',
        'Vous devez faire vérifier votre compte (KYC) avant de pouvoir effectuer un retrait.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Vérifier mon compte', onPress: () => navigation.navigate('SellerKYC') }
        ]
      );
      return;
    }

    const amountNum = parseInt(withdrawAmount.replace(/\s/g, ''), 10);
    
    if (!amountNum || amountNum < 5000) {
      Alert.alert('Erreur', 'Le montant minimum de retrait est de 5000 FCFA.');
      return;
    }
    
    if (amountNum > walletStats.availableBalance) {
      Alert.alert('Erreur', 'Solde insuffisant pour ce montant.');
      return;
    }

    if (!withdrawPhone || withdrawPhone.length < 8) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide pour la réception.');
      return;
    }

    try {
      setIsSubmittingWithdraw(true);
      await financeService.requestWithdrawal(storeId!, amountNum, withdrawMethod, { phone: withdrawPhone });
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      Alert.alert('Succès', 'Votre demande de retrait a été soumise avec succès.');
      loadFinanceData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de soumettre la demande de retrait.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const getKycBanner = () => {
    if (kycStatus === 'verified') return null;
    
    const isPending = kycStatus === 'pending';
    const color = isPending ? COLORS.warning : COLORS.danger;
    
    return (
      <View style={[styles.kycBanner, { backgroundColor: color + '15', borderColor: color }]}>
        <Ionicons name={isPending ? 'time' : 'alert-circle'} size={24} color={color} />
        <View style={styles.kycTextContainer}>
          <Text style={[styles.kycTitle, { color }]}>
            {isPending ? 'Vérification en cours' : 'Compte non vérifié'}
          </Text>
          <Text style={styles.kycDescription}>
            {isPending 
              ? 'Vos documents sont en cours de vérification par notre équipe.' 
              : 'Vérifiez votre identité pour débloquer les retraits.'}
          </Text>
        </View>
        {!isPending && (
          <TouchableOpacity 
            style={[styles.kycBtn, { backgroundColor: color }]}
            onPress={() => navigation.navigate('SellerKYC')}
          >
            <Text style={styles.kycBtnText}>Vérifier</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LibrePay</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* SOLDE CARD */}
        <LinearGradient
          colors={['#1e293b', '#0f172a']}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Solde Disponible</Text>
            <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
              <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.balanceAmount}>
            {showBalance ? formatAmount(walletStats.availableBalance) : '•••••••• FCFA'}
          </Text>

          <View style={styles.pendingRow}>
            <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.pendingText}>
              En attente : {showBalance ? formatAmount(walletStats.pendingBalance) : '••••'}
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.withdrawMainBtn}
            onPress={() => setWithdrawModalVisible(true)}
          >
            <Ionicons name="cash-outline" size={20} color="#0f172a" />
            <Text style={styles.withdrawMainBtnText}>Retirer maintenant</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* KYC BANNER */}
        {getKycBanner()}

        {/* RECENT TRANSACTIONS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dernières Transactions</Text>
          </View>
          
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>Aucune transaction récente.</Text>
          ) : (
            transactions.map(tx => (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: tx.type === 'withdrawal' ? COLORS.danger + '20' : COLORS.success + '20' }]}>
                  <Ionicons 
                    name={tx.type === 'withdrawal' ? 'arrow-up' : 'arrow-down'} 
                    size={20} 
                    color={tx.type === 'withdrawal' ? COLORS.danger : COLORS.success} 
                  />
                </View>
                <View style={styles.txDetails}>
                  <Text style={styles.txDesc}>{tx.description}</Text>
                  <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString('fr-FR')} • {tx.status}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.type === 'withdrawal' ? COLORS.danger : COLORS.success }]}>
                  {tx.type === 'withdrawal' ? '-' : '+'}{formatAmount(Math.abs(tx.amount))}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* WITHDRAWAL HISTORY */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Historique des Retraits</Text>
          </View>
          
          {withdrawals.length === 0 ? (
            <Text style={styles.emptyText}>Aucun retrait effectué.</Text>
          ) : (
            withdrawals.slice(0, 5).map(w => {
              let statusColor = COLORS.textMuted;
              let statusText = 'En cours';
              if (w.status === 'completed') { statusColor = COLORS.success; statusText = 'Effectué'; }
              else if (w.status === 'rejected') { statusColor = COLORS.danger; statusText = 'Rejeté'; }
              
              return (
                <View key={w.id} style={styles.wdRow}>
                  <View style={styles.wdInfo}>
                    <Text style={styles.wdMethod}>{w.method}</Text>
                    <Text style={styles.wdDate}>{new Date(w.created_at).toLocaleDateString('fr-FR')}</Text>
                  </View>
                  <View style={styles.wdStatusContainer}>
                    <Text style={styles.wdAmount}>{formatAmount(w.amount)}</Text>
                    <Text style={[styles.wdStatus, { color: statusColor }]}>{statusText}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* WITHDRAW MODAL */}
      <Modal
        visible={withdrawModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Demande de retrait</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Méthode de retrait</Text>
              <View style={styles.methodContainer}>
                {withdrawMethods.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodBtn, withdrawMethod === m && styles.methodBtnActive]}
                    onPress={() => setWithdrawMethod(m)}
                  >
                    <Text style={[styles.methodBtnText, withdrawMethod === m && styles.methodBtnTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Numéro de réception</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 0700000000"
                keyboardType="phone-pad"
                value={withdrawPhone}
                onChangeText={setWithdrawPhone}
              />

              <Text style={styles.modalLabel}>Montant (FCFA)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 15000"
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
              
              <Text style={styles.modalHelper}>
                Solde disponible : {formatAmount(walletStats.availableBalance)}
              </Text>

              <TouchableOpacity 
                style={[styles.submitBtn, isSubmittingWithdraw && styles.submitBtnDisabled]}
                onPress={handleWithdrawRequest}
                disabled={isSubmittingWithdraw}
              >
                {isSubmittingWithdraw ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirmer le retrait</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  scrollContent: { padding: SPACING.md },
  
  balanceCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...Platform.select({
      web: { boxShadow: '0 10px 25px rgba(0,0,0,0.15)' },
      default: { elevation: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.15, shadowRadius: 15 }
    })
  },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: FONT_SIZE.md, fontWeight: '600' },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginBottom: SPACING.md },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.lg },
  pendingText: { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZE.sm, fontWeight: '500' },
  withdrawMainBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  withdrawMainBtnText: { color: '#0f172a', fontSize: FONT_SIZE.md, fontWeight: '700' },

  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  kycTextContainer: { flex: 1, marginLeft: SPACING.sm },
  kycTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 2 },
  kycDescription: { fontSize: 12, color: COLORS.textMuted },
  kycBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm },
  kycBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  section: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg },
  sectionHeader: { marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, padding: SPACING.md },

  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  txDetails: { flex: 1 },
  txDesc: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  txDate: { fontSize: 12, color: COLORS.textMuted },
  txAmount: { fontSize: FONT_SIZE.md, fontWeight: '700' },

  wdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  wdInfo: { flex: 1 },
  wdMethod: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  wdDate: { fontSize: 12, color: COLORS.textMuted },
  wdStatusContainer: { alignItems: 'flex-end' },
  wdAmount: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  wdStatus: { fontSize: 12, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalBody: {},
  modalLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textMuted, marginBottom: SPACING.xs, marginTop: SPACING.md },
  methodContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  methodBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  methodBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  methodBtnText: { color: COLORS.text, fontWeight: '600', fontSize: FONT_SIZE.sm },
  methodBtnTextActive: { color: COLORS.primary },
  modalInput: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text, marginTop: SPACING.xs },
  modalHelper: { fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.xs, textAlign: 'right' },
  submitBtn: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.lg },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
});

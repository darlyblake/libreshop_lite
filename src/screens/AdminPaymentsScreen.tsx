import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  FlatList,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { Card } from '../components/Card';
import { BackToDashboard } from '../components/BackToDashboard';
import { supabase } from '../lib/supabase';

interface StorePayment {
  id: string;
  storeName: string;
  ownerName: string;
  currentSubscription: string;
  subscriptionPrice: number;
  paymentStatus: 'paid' | 'pending' | 'overdue';
  paymentDate: string;
  nextBillingDate: string;
  subscriptionActive: boolean;
  cashierActive: boolean;
  onlineStoreActive: boolean;
  productsLimit: number;
  revenue: number;
}

export const AdminPaymentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [selectedStore, setSelectedStore] = useState<StorePayment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [stores, setStores] = useState<StorePayment[]>([]);

  const loadStores = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stores')
        .select(
          'id,name,product_limit,subscription_plan,subscription_price,subscription_status,cashier_active,online_store_active,billing_status,last_payment_date,next_billing_date,users:users!stores_user_id_fkey(full_name)'
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStores(
        (data || []).map((s: any) => ({
          id: String(s.id),
          storeName: String(s.name || ''),
          ownerName: String(s.users?.full_name || ''),
          currentSubscription: String(s.subscription_plan || '-'),
          subscriptionPrice: Number(s.subscription_price || 0),
          paymentStatus: (s.billing_status || 'pending') as any,
          paymentDate: s.last_payment_date ? String(s.last_payment_date) : '-',
          nextBillingDate: s.next_billing_date ? String(s.next_billing_date) : '-',
          subscriptionActive: String(s.subscription_status || '') === 'active' || String(s.subscription_status || '') === 'trial',
          cashierActive: Boolean(s.cashier_active ?? true),
          onlineStoreActive: Boolean(s.online_store_active ?? true),
          productsLimit: Number(s.product_limit || 0),
          revenue: 0,
        }))
      );
    } catch (e) {
      console.error('load payments stores', e);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('❌ Impossible de charger les paiements');
      } else {
        Alert.alert('Erreur', 'Impossible de charger les paiements');
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadStores();
  }, []);

  const filteredStores = useMemo(() => {
    return stores.filter(store => {
      const matchesSearch =
        store.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || store.paymentStatus === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [stores, searchQuery, filterStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadStores();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return COLORS.success;
      case 'pending': return COLORS.warning;
      case 'overdue': return COLORS.danger;
      default: return COLORS.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Payé';
      case 'pending': return 'En attente';
      case 'overdue': return 'En retard';
      default: return status;
    }
  };

  const toggleFeature = async (storeId: string, feature: 'cashier' | 'online' | 'subscription') => {
    if (!supabase) return;

    const store = stores.find(s => s.id === storeId);
    if (!store) return;

    try {
      let updates: any = {};
      if (feature === 'cashier') {
        updates.cashier_active = !store.cashierActive;
      } else if (feature === 'online') {
        updates.online_store_active = !store.onlineStoreActive;
      } else {
        // subscription flag is stored as subscription_status
        updates.subscription_status = store.subscriptionActive ? 'expired' : 'active';
      }

      const { data, error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', storeId)
        .select('id,cashier_active,online_store_active,subscription_status')
        .single();

      if (error) throw error;

      setStores(prev =>
        prev.map(s =>
          s.id === storeId
            ? {
                ...s,
                cashierActive: (data as any)?.cashier_active ?? s.cashierActive,
                onlineStoreActive: (data as any)?.online_store_active ?? s.onlineStoreActive,
                subscriptionActive:
                  String((data as any)?.subscription_status || '').toLowerCase() === 'active' ||
                  String((data as any)?.subscription_status || '').toLowerCase() === 'trial',
              }
            : s
        )
      );
    } catch (e) {
      console.error('toggle feature', e);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('❌ Impossible de modifier la fonctionnalité');
      } else {
        Alert.alert('Erreur', 'Impossible de modifier la fonctionnalité');
      }
    }
  };

  const upgradeSubscription = async (storeId: string, newSub: string, newPrice: number, productsLimit: number) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('stores')
        .update({
          subscription_plan: newSub,
          subscription_price: newPrice,
          product_limit: productsLimit,
          billing_status: 'pending',
        })
        .eq('id', storeId)
        .select('id,subscription_plan,subscription_price,product_limit,billing_status')
        .single();

      if (error) throw error;

      setStores(prev =>
        prev.map(s =>
          s.id === storeId
            ? {
                ...s,
                currentSubscription: (data as any)?.subscription_plan || newSub,
                subscriptionPrice: Number((data as any)?.subscription_price || newPrice),
                productsLimit: Number((data as any)?.product_limit || productsLimit),
                paymentStatus: ((data as any)?.billing_status || 'pending') as any,
              }
            : s
        )
      );

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`✅ Offre changée en ${newSub}`);
      } else {
        Alert.alert('Upgrade effectué', `Offre changée en ${newSub}`);
      }
      setShowUpgradeModal(false);
    } catch (e) {
      console.error('upgrade subscription', e);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('❌ Impossible de changer l\'offre');
      } else {
        Alert.alert('Erreur', "Impossible de changer l'offre");
      }
    }
  };

  const handlePayment = async (storeId: string) => {
    if (!supabase) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('stores')
        .update({ billing_status: 'paid', last_payment_date: today })
        .eq('id', storeId)
        .select('id,billing_status,last_payment_date')
        .single();
      if (error) throw error;
      setStores(prev =>
        prev.map(s =>
          s.id === storeId
            ? {
                ...s,
                paymentStatus: ((data as any)?.billing_status || 'paid') as any,
                paymentDate: (data as any)?.last_payment_date ? String((data as any).last_payment_date) : s.paymentDate,
              }
            : s
        )
      );
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('✅ Paiement marqué comme reçu');
      } else {
        Alert.alert('Paiement validé', 'Le paiement a été marqué comme reçu');
      }
    } catch (e) {
      console.error('mark payment paid', e);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('❌ Impossible de valider le paiement');
      } else {
        Alert.alert('Erreur', 'Impossible de valider le paiement');
      }
    }
  };

  const subscriptionOptions = [
    { name: 'Starter', price: 9990, productsLimit: 50 },
    { name: 'Professional', price: 19990, productsLimit: 200 },
    { name: 'Enterprise', price: 49990, productsLimit: 9999 },
  ];

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des Paiements</Text>
        <TouchableOpacity style={styles.exportButton}>
          <Ionicons name="download-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une boutique..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['all', 'paid', 'pending', 'overdue'].map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                filterStatus === status && styles.filterChipActive,
              ]}
              onPress={() => setFilterStatus(status as any)}
            >
              <Text
                style={[
                  styles.filterText,
                  filterStatus === status && styles.filterTextActive,
                ]}
              >
                {status === 'all' ? 'Tous' : status === 'paid' ? 'Payés' : status === 'pending' ? 'Attente' : 'Retard'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: COLORS.success + '20' }]}>
          <Text style={styles.statValue}>{stores.filter(s => s.paymentStatus === 'paid').length}</Text>
          <Text style={styles.statLabel}>Payés</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: COLORS.warning + '20' }]}>
          <Text style={styles.statValue}>{stores.filter(s => s.paymentStatus === 'pending').length}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: COLORS.danger + '20' }]}>
          <Text style={styles.statValue}>{stores.filter(s => s.paymentStatus === 'overdue').length}</Text>
          <Text style={styles.statLabel}>En retard</Text>
        </View>
      </View>

      {/* Stores List */}
      <ScrollView
        style={styles.storesList}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {filteredStores.map(store => (
          <Card key={store.id} style={styles.storeCard}>
            <View style={styles.storeHeader}>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{store.storeName}</Text>
                <Text style={styles.ownerName}>{store.ownerName}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(store.paymentStatus) + '20' },
                ]}
              >
                <Text style={[styles.statusText, { color: getStatusColor(store.paymentStatus) }]}>
                  {getStatusText(store.paymentStatus)}
                </Text>
              </View>
            </View>

            {/* Subscription Info */}
            <View style={styles.subscriptionRow}>
              <View>
                <Text style={styles.subscriptionLabel}>Offre actuelle</Text>
                <Text style={styles.subscriptionName}>{store.currentSubscription}</Text>
              </View>
              <View>
                <Text style={styles.subscriptionLabel}>Prix/mois</Text>
                <Text style={styles.subscriptionPrice}>{store.subscriptionPrice.toLocaleString()} FCFA</Text>
              </View>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => {
                  setSelectedStore(store);
                  setShowUpgradeModal(true);
                }}
              >
                <Ionicons name="arrow-up-circle-outline" size={20} color={COLORS.accent} />
                <Text style={styles.upgradeText}>Upgrade</Text>
              </TouchableOpacity>
            </View>

            {/* Features Toggle */}
            <View style={styles.featuresSection}>
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name="calculator-outline" size={20} color={COLORS.accent} />
                  <Text style={styles.featureLabel}>Caisse physique</Text>
                </View>
                <Switch
                  value={store.cashierActive}
                  onValueChange={() => toggleFeature(store.id, 'cashier')}
                  trackColor={{ false: COLORS.border, true: COLORS.success + '40' }}
                  thumbColor={store.cashierActive ? COLORS.success : COLORS.textMuted}
                />
              </View>
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name="globe-outline" size={20} color={COLORS.accent} />
                  <Text style={styles.featureLabel}>Boutique en ligne</Text>
                </View>
                <Switch
                  value={store.onlineStoreActive}
                  onValueChange={() => toggleFeature(store.id, 'online')}
                  trackColor={{ false: COLORS.border, true: COLORS.success + '40' }}
                  thumbColor={store.onlineStoreActive ? COLORS.success : COLORS.textMuted}
                />
              </View>
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name="card" size={20} color={store.subscriptionActive ? COLORS.success : COLORS.danger} />
                  <Text style={styles.featureLabel}>Abonnement</Text>
                </View>
                <Switch
                  value={store.subscriptionActive}
                  onValueChange={() => toggleFeature(store.id, 'subscription')}
                  trackColor={{ false: COLORS.border, true: COLORS.success + '40' }}
                  thumbColor={store.subscriptionActive ? COLORS.success : COLORS.danger}
                />
              </View>
            </View>

            {/* Payment and Revenue Info */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Prochain paiement</Text>
                <Text style={styles.infoValue}>{store.nextBillingDate}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Revenu généré</Text>
                <Text style={styles.infoValue}>{(store.revenue / 1000000).toFixed(1)}M FCFA</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, store.paymentStatus !== 'paid' && styles.actionButtonPrimary]}
                onPress={() => {
                  if (store.paymentStatus !== 'paid') {
                    handlePayment(store.id);
                  }
                }}
                disabled={store.paymentStatus === 'paid'}
              >
                <Ionicons
                  name={store.paymentStatus === 'paid' ? 'checkmark-circle' : 'cash-outline'}
                  size={18}
                  color={store.paymentStatus === 'paid' ? COLORS.success : COLORS.accent}
                />
                <Text style={styles.actionButtonText}>
                  {store.paymentStatus === 'paid' ? 'Payé' : 'Valider'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setSelectedStore(store);
                  setShowDetailModal(true);
                }}
              >
                <Ionicons name="eye-outline" size={18} color={COLORS.info} />
                <Text style={styles.actionButtonText}>Détails</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {filteredStores.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucune boutique trouvée</Text>
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      {selectedStore && (
        <Modal visible={showDetailModal} animationType="slide" transparent onRequestClose={() => setShowDetailModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Détails de la boutique</Text>
                <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Nom de la boutique</Text>
                  <Text style={styles.detailValue}>{selectedStore.storeName}</Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Propriétaire</Text>
                  <Text style={styles.detailValue}>{selectedStore.ownerName}</Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Offre actuelle</Text>
                  <Text style={styles.detailValue}>{selectedStore.currentSubscription}</Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Prix d'abonnement</Text>
                  <Text style={styles.detailValue}>{selectedStore.subscriptionPrice.toLocaleString()} FCFA/mois</Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Statut de paiement</Text>
                  <Text style={[styles.detailValue, { color: getStatusColor(selectedStore.paymentStatus) }]}>
                    {getStatusText(selectedStore.paymentStatus)}
                  </Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Statut de l'abonnement</Text>
                  <Text style={[styles.detailValue, { color: selectedStore.subscriptionActive ? COLORS.success : COLORS.danger }]}>
                    {selectedStore.subscriptionActive ? '✓ Actif' : '✗ Désactivé'}
                  </Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Produits utilisés</Text>
                  <Text style={styles.detailValue}>
                    Illimité / {selectedStore.productsLimit}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Upgrade Modal */}
      {selectedStore && (
        <Modal visible={showUpgradeModal} animationType="slide" transparent onRequestClose={() => setShowUpgradeModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Changer l'offre</Text>
                <TouchableOpacity onPress={() => setShowUpgradeModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {subscriptionOptions.map(sub => (
                  <TouchableOpacity
                    key={sub.name}
                    style={[
                      styles.subscriptionOption,
                      selectedStore.currentSubscription === sub.name && styles.subscriptionOptionSelected,
                    ]}
                    onPress={() => upgradeSubscription(selectedStore.id, sub.name, sub.price, sub.productsLimit)}
                  >
                    <View>
                      <Text style={styles.optionName}>{sub.name}</Text>
                      <Text style={styles.optionDetails}>{sub.productsLimit} produits max</Text>
                    </View>
                    <Text style={styles.optionPrice}>{sub.price.toLocaleString()} FCFA</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  exportButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  filterScroll: {
    marginBottom: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.white,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  storesList: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  storeCard: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  ownerName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBlockColor: COLORS.border,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: SPACING.md,
  },
  subscriptionLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  subscriptionName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.accent,
  },
  subscriptionPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  upgradeButton: {
    alignItems: 'center',
    gap: 2,
  },
  upgradeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    fontWeight: '600',
  },
  featuresSection: {
    marginBottom: SPACING.md,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  infoRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.accent + '20',
    borderColor: COLORS.accent,
  },
  actionButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    marginTop: SPACING.xxl,
    flex: 1,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalBody: {
    flex: 1,
    padding: SPACING.lg,
  },
  detailSection: {
    marginBottom: SPACING.lg,
  },
  detailLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  subscriptionOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bg,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  subscriptionOptionSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '10',
  },
  optionName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  optionDetails: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  optionPrice: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.accent,
  },
});

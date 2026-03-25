import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
  ListRenderItem,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/responsive';
import AddUserModal, { UserData } from '../components/AddUserModal';
import { orderService, storeService } from '../lib/supabase';
import { useAuthStore } from '../store';

/* =========================
   TYPES
========================= */

type Client = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  ordersCount?: number;
  totalSpent?: number;
  lastOrder?: string;
  isActive: boolean;
};

/* =========================
   COMPONENT
========================= */

export const SellerClientsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'clients' | 'orders'>('clients');
  // (optional) keep reference for initial values if needed later
  const [newClient, setNewClient] = useState<UserData>({
    name: '',
    phone: '',
    email: '',
  });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  // 🚀 États pour le scroll infini
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCursor, setLastCursor] = useState<string | null>(null);

  const loadClients = useCallback(async (reset = true, cursor?: string) => {
    if (!user?.id) return;
    try {
      if (reset) {
        setLoading(true);
        setClients([]);
        setHasMore(true);
        setLastCursor(null);
      } else {
        setLoadingMore(true);
      }
      
      console.log(`🔍 ${reset ? 'Chargement initial' : 'Chargement supplémentaire'} des clients pour le vendeur:`, user.id);
      
      const store = await storeService.getByUser(user.id);
      if (!store?.id) {
        console.log('❌ Aucune boutique trouvée pour le vendeur');
        setStoreId(null);
        setClients([]);
        setHasMore(false);
        return;
      }
      setStoreId(store.id);
      console.log('🏪 Boutique trouvée:', store.id);

      // 🚀 Appel avec pagination cursor
      const orders = await orderService.getByStore(store.id, { 
        includeUser: true, 
        limit: 50,
        cursor: reset ? undefined : cursor
      });
      
      console.log('📦 Commandes brutes reçues:', orders);
      
      // Gérer les deux formats de réponse
      const ordersData = (orders as any)?.orders || orders;
      const hasMoreData = (orders as any)?.hasMore !== undefined ? (orders as any).hasMore : true;
      const nextCursor = (orders as any)?.nextCursor || null;
      
      console.log('📋 Commandes traitées:', ordersData);
      console.log('📊 Nombre de commandes:', Array.isArray(ordersData) ? ordersData.length : 'N/A');
      console.log('🔄 hasMore:', hasMoreData, 'nextCursor:', nextCursor);
      
      const map = new Map<string, Client>();

      // Extraire les clients des commandes
      (ordersData as any[]).forEach((o: any) => {
        const customerPhone = String(o?.customer_phone || '').trim();
        const customerName = String(o?.customer_name || '').trim();
        const userId = String(o?.user_id || '').trim();
        const id = String(customerPhone || customerName || userId || o?.id || '');
        if (!id) return;

        const name = String(customerName || o?.users?.full_name || 'Client').trim() || 'Client';
        const phone = String(customerPhone || o?.users?.phone || '').trim();
        const email = String(o?.users?.email || '').trim() || undefined;
        const total = Number(o?.total_amount || 0);
        const createdAt = String(o?.created_at || '').trim();

        const existing = map.get(id);
        const nextOrdersCount = (existing?.ordersCount || 0) + 1;
        const nextTotalSpent = (existing?.totalSpent || 0) + total;
        const lastOrder = (() => {
          if (!createdAt) return existing?.lastOrder;
          if (!existing?.lastOrder) return createdAt;
          return new Date(createdAt) > new Date(existing.lastOrder) ? createdAt : existing.lastOrder;
        })();

        map.set(id, {
          id,
          name,
          phone,
          email,
          ordersCount: nextOrdersCount,
          totalSpent: nextTotalSpent,
          lastOrder,
          isActive: true,
        });
      });

      const newClients = Array.from(map.values());
      console.log('👥 Clients générés:', newClients.length);
      
      // 🚀 Mettre à jour les états de pagination
      if (!reset) {
        setClients(prev => [...prev, ...newClients]);
      } else {
        setClients(newClients);
      }
      setHasMore(hasMoreData);
      setLastCursor(nextCursor);
      
    } catch (e: any) {
      console.error('❌ Erreur lors du chargement des clients:', e);
      errorHandler.handle(e, 'load clients failed', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      const rawMsg = String(e?.message || '');
      const isRls =
        rawMsg.toLowerCase().includes('permission denied') ||
        rawMsg.toLowerCase().includes('row level security') ||
        e?.code === '42501';

      Alert.alert(
        'Erreur',
        isRls
          ? "Accès refusé (RLS). Vérifie que tu es connecté avec le compte vendeur propriétaire de la boutique et que les policies Supabase pour 'orders' sont appliquées (Store owners can view store orders)."
          : rawMsg || 'Impossible de charger les clients'
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.id]);

  // 🚀 Fonction pour charger plus de clients (scroll infini)
  const loadMoreClients = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    console.log('🔄 Chargement de plus de clients...');
    await loadClients(false, lastCursor);
  }, [hasMore, loadingMore, loading, lastCursor, loadClients]);

  useEffect(() => {
    console.log('🚀 Chargement initial des clients');
    loadClients();
  }, [loadClients]);

  const onRefresh = useCallback(() => {
    const run = async () => {
      setRefreshing(true);
      await loadClients(true);
      setRefreshing(false);
    };
    run();
  }, [loadClients]);

  /* =========================
     HANDLERS
  ========================= */

  // called when the reusable modal submits data
  const handleAddClient = (data: UserData) => {
    if (!data.name.trim() || !data.phone.trim()) {
      Alert.alert('Erreur', 'Le nom et le téléphone sont requis');
      return;
    }

    Alert.alert('Succès', `Client "${data.name}" ajouté avec succès`);
    // clear initial values so form resets when reopened
    setNewClient({ name: '', phone: '', email: '' });
    setShowAddModal(false);
  };

  const toggleClientStatus = (id: string) => {
    Alert.alert(
      'Changer le statut',
      'Voulez-vous activer/désactiver ce client ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => {
            // Toggle client status
          }}
      ]
    );
  };

  /* =========================
     FILTERED CLIENTS
  ========================= */

  const filteredClients = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return clients.filter((client) => {
      return (
        client.name?.toLowerCase().includes(query) ||
        client.phone?.includes(query)
      );
    });
  }, [clients, searchQuery]);

  /* =========================
     RENDER ITEM
  ========================= */

  const renderClient: ListRenderItem<Client> = useCallback(
    ({ item }) => {
      const initials = item.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase();

      return (
        <View style={styles.clientCard}>
          {/* HEADER */}
          <View style={styles.clientHeader}>
            <View style={styles.clientInfo}>
              <View style={styles.clientAvatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.clientDetails}>
                <Text style={styles.clientName}>{item.name}</Text>
                <Text style={styles.clientPhone}>{item.phone}</Text>
                {item.email && (
                  <Text style={styles.clientEmail}>{item.email}</Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.statusToggle,
                {
                  backgroundColor: item.isActive
                    ? COLORS.success
                    : COLORS.textMuted,
                },
              ]}
              onPress={() => toggleClientStatus(item.id)}
            >
              <Ionicons
                name={item.isActive ? 'checkmark' : 'close'}
                size={16}
                color={COLORS.text}
              />
            </TouchableOpacity>
          </View>

          {/* STATS */}
          <View style={styles.clientStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {item.ordersCount ?? 0}
              </Text>
              <Text style={styles.statLabel}>Commandes</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {(item.totalSpent ?? 0).toLocaleString('fr-FR')} F
              </Text>
              <Text style={styles.statLabel}>Total dépensé</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {item.lastOrder
                  ? new Date(item.lastOrder).toLocaleDateString('fr-FR')
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>Dernière commande</Text>
            </View>
          </View>

          {/* ACTIONS */}
          <View style={styles.clientActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate('ClientDetail', {
                  clientId: item.id,
                })
              }
            >
              <Ionicons name="eye-outline" size={20} color={COLORS.accent} />
              <Text style={styles.actionText}>Voir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate('ClientOrders', {
                  clientId: item.id,
                })
              }
            >
              <Ionicons
                name="receipt-outline"
                size={20}
                color={COLORS.accent}
              />
              <Text style={styles.actionText}>Commandes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate('ClientEdit', {
                  clientId: item.id,
                })
              }
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={COLORS.accent}
              />
              <Text style={styles.actionText}>Modifier</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [navigation]
  );

  /* =========================
     UI
  ========================= */

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clients</Text>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* add-client modal */}
      <AddUserModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddClient}
        initialData={newClient}
      />

      {/* TABS */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'clients' && styles.tabActive,
          ]}
          onPress={() => setSelectedTab('clients')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'clients' && styles.tabTextActive,
            ]}
          >
            Tous les clients
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'orders' && styles.tabActive,
          ]}
          onPress={() => setSelectedTab('orders')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'orders' && styles.tabTextActive,
            ]}
          >
            Commandes récentes
          </Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un client..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* CONTENT */}
      {selectedTab === 'clients' ? (
        <FlatList
          data={filteredClients}
          renderItem={renderClient}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.clientsContainer,
            isDesktop && styles.clientsContainerDesktop,
          ]}
          showsVerticalScrollIndicator={false}
          
          // 🚀 Props pour le scroll infini
          onEndReached={loadMoreClients}
          onEndReachedThreshold={0.3}
          
          // Props optimisées existantes
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          
          ListFooterComponent={
            <View style={styles.footerContainer}>
              {loadingMore && (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.loadingMoreText}>Chargement de plus de clients...</Text>
                </View>
              )}
              {!hasMore && clients.length > 0 && (
                <View style={styles.endOfListContainer}>
                  <Text style={styles.endOfListText}>
                    📋 Tous les clients chargés ({clients.length})
                  </Text>
                </View>
              )}
            </View>
          }
          
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              {loading ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : (
                <Text style={{ color: COLORS.textSoft }}>
                  {storeId ? 'Aucun client trouvé' : 'Aucune boutique trouvée pour ce compte'}
                </Text>
              )}
            </View>
          }
        />
      ) : (
        <View style={styles.ordersContainer}>
          <Text style={styles.emptyText}>
            Fonctionnalité des commandes récentes bientôt disponible
          </Text>
        </View>
      )}
    </View>
  );
};

/* =========================
   STYLES
========================= */

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
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },

  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },

  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  tabActive: {
    borderBottomColor: COLORS.accent,
  },

  tabText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    fontWeight: '500',
  },

  tabTextActive: {
    color: COLORS.accent,
  },

  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },

  clientsContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },

  clientsContainerDesktop: {
    paddingHorizontal: SPACING.xxl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  clientCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  clientHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },

  clientInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },

  avatarText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },

  clientDetails: {
    flex: 1,
  },

  clientName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },

  clientPhone: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
  },

  clientEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },

  statusToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  clientStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },

  statItem: {
    alignItems: 'center',
  },

  statValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },

  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  clientActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  footerContainer: {
    paddingVertical: SPACING.lg,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  loadingMoreText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  endOfListContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  endOfListText: {
    color: COLORS.textSoft,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
  },

  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent + '10',
  },

  actionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    fontWeight: '500',
  },

  ordersContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    textAlign: 'center',
  },
});
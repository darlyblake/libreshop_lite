import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  FlatList,
  ListRenderItem,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/responsive';
import AddUserModal, { UserData } from '../components/AddUserModal';
import { SearchBar } from '../components/SearchBar';
import { DatePickerInput } from '../components/DatePickerInput';
import { useSearch } from '../hooks/useSearch';
import { orderService } from '../services/orderService';
import { storeService } from '../services/storeService';
import { cacheService } from '../services/cacheService';
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
  totalSpentInPeriod?: number; // Total spent within current loyalty period
  lastOrder?: string;
  isActive: boolean;
  loyaltyPoints?: number;
  loyaltyTier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
};

// Configuration par défaut du programme de fidélité
const DEFAULT_LOYALTY_CONFIG = {
  isActive: false,
  startDate: null as string | null,
  endDate: null as string | null,
  pointsPerXOF: 100, // 100 points pour chaque 1000 F dépensés
  tiers: {
    Bronze: { minPoints: 0, color: '#CD7F32', icon: 'medal-outline' },
    Silver: { minPoints: 1000, color: '#C0C0C0', icon: 'medal-outline' },
    Gold: { minPoints: 5000, color: '#FFD700', icon: 'trophy-outline' },
    Platinum: { minPoints: 10000, color: '#E5E4E2', icon: 'ribbon-outline' },
  },
};

// Calculer les points de fidélité
const calculateLoyaltyPoints = (totalSpent: number, pointsPerXOF: number): number => {
  return Math.floor(totalSpent / pointsPerXOF) * 100;
};

// Calculer le niveau de fidélité
const calculateLoyaltyTier = (points: number, tiers: typeof DEFAULT_LOYALTY_CONFIG.tiers): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' => {
  if (points >= tiers.Platinum.minPoints) return 'Platinum';
  if (points >= tiers.Gold.minPoints) return 'Gold';
  if (points >= tiers.Silver.minPoints) return 'Silver';
  return 'Bronze';
};

/* =========================
   COMPONENT
========================= */

export const SellerClientsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { user } = useAuthStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showLoyaltySettings, setShowLoyaltySettings] = useState(false);
  const [loyaltyConfig, setLoyaltyConfig] = useState(DEFAULT_LOYALTY_CONFIG);
  const [editingLoyaltyConfig, setEditingLoyaltyConfig] = useState(DEFAULT_LOYALTY_CONFIG);
  const { query, setQuery, isLoading: searchLoading } = useSearch({ debounceDelay: 300 });
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
      const cacheKey = `seller_clients_${user.id}`;
      
      if (reset && !cursor) {
        const cached = await cacheService.get<Client[]>(cacheKey);
        if (cached) {
          setClients(cached);
          setLoading(false);
          // Background fetch still happens for fresh data
        }
      }

      if (reset) {
        setLoading(true);
        setHasMore(true);
        setLastCursor(null);
      } else {
        setLoadingMore(true);
      }
      
      const store = await storeService.getByUser(user.id);
      if (!store?.id) {
        setStoreId(null);
        setClients([]);
        setHasMore(false);
        return;
      }
      setStoreId(store.id);

      // 🚀 Appel avec pagination cursor
      const orders = await orderService.getByStore(store.id, { 
        includeUser: true, 
        limit: 50,
        cursor: reset ? undefined : cursor
      });
      
      // Gérer les deux formats de réponse
      const ordersData = (orders as any)?.orders || orders;
      const hasMoreData = (orders as any)?.hasMore !== undefined ? (orders as any).hasMore : true;
      const nextCursor = (orders as any)?.nextCursor || null;
      
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

        // Filtrer les commandes par période du programme de fidélité pour les points
        let totalSpentInPeriod = existing?.totalSpentInPeriod || 0;
        if (loyaltyConfig.isActive && loyaltyConfig.startDate && loyaltyConfig.endDate) {
          const orderDate = new Date(o?.created_at);
          const startDate = new Date(loyaltyConfig.startDate);
          const endDate = new Date(loyaltyConfig.endDate);
          if (orderDate >= startDate && orderDate <= endDate) {
            totalSpentInPeriod += total; // Compter uniquement les commandes dans la période
          }
        }

        map.set(id, {
          id,
          name,
          phone,
          email,
          ordersCount: nextOrdersCount,
          totalSpent: nextTotalSpent,
          totalSpentInPeriod,
          lastOrder,
          isActive: true,
          loyaltyPoints: loyaltyConfig.isActive ? calculateLoyaltyPoints(totalSpentInPeriod, loyaltyConfig.pointsPerXOF) : 0,
          loyaltyTier: loyaltyConfig.isActive ? calculateLoyaltyTier(calculateLoyaltyPoints(totalSpentInPeriod, loyaltyConfig.pointsPerXOF), loyaltyConfig.tiers) : undefined,
        });
      });

      const newClients = Array.from(map.values());
      
      // 🚀 Mettre à jour les états de pagination
      if (!reset) {
        setClients(prev => [...prev, ...newClients]);
      } else {
        setClients(newClients);
        // Cache first page / initial list (30 minutes)
        cacheService.set(cacheKey, newClients, 30);
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

  const loadMoreClients = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    await loadClients(false, lastCursor || undefined);
  }, [hasMore, loadingMore, loading, lastCursor, loadClients]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Load loyalty config from store or localStorage
  useEffect(() => {
    if (!user?.id) return;
    try {
      const savedConfig = localStorage.getItem(`loyalty_config_${user.id}`);
      if (savedConfig) {
        setLoyaltyConfig(JSON.parse(savedConfig));
        setEditingLoyaltyConfig(JSON.parse(savedConfig));
      }
    } catch (e) {
      console.error('Failed to load loyalty config:', e);
    }
  }, [user?.id]);

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

  const handleOpenLoyaltySettings = () => {
    setEditingLoyaltyConfig(loyaltyConfig);
    setShowLoyaltySettings(true);
  };

  const handleSaveLoyaltyConfig = () => {
    if (!user?.id) return;
    try {
      localStorage.setItem(`loyalty_config_${user.id}`, JSON.stringify(editingLoyaltyConfig));
      setLoyaltyConfig(editingLoyaltyConfig);
      setShowLoyaltySettings(false);
      Alert.alert('Succès', 'Configuration du programme de fidélité enregistrée');
      // Reload clients with reset=true to recalculate points based on new period
      loadClients(true);
      checkTierAchievements();
    } catch (e) {
      console.error('Failed to save loyalty config:', e);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la configuration');
    }
  };

  const checkTierAchievements = () => {
    if (!loyaltyConfig.isActive) return;
    
    const notifications: string[] = [];
    clients.forEach(client => {
      if (client.loyaltyPoints && client.loyaltyTier) {
        const tierConfig = loyaltyConfig.tiers[client.loyaltyTier];
        if (client.loyaltyPoints >= tierConfig.minPoints) {
          notifications.push(`${client.name} a atteint le niveau ${client.loyaltyTier}!`);
        }
      }
    });

    if (notifications.length > 0) {
      Alert.alert(
        'Niveaux atteints',
        notifications.slice(0, 5).join('\n') + (notifications.length > 5 ? `\n...et ${notifications.length - 5} autres` : ''),
        [{ text: 'OK' }]
      );
    }
  };

  const handleCancelLoyaltyConfig = () => {
    setEditingLoyaltyConfig(loyaltyConfig);
    setShowLoyaltySettings(false);
  };

  /* =========================
     FILTERED CLIENTS
  ========================= */

  const filteredClients = useMemo(() => {
    const searchTerm = query.toLowerCase().trim();

    return clients.filter((client) => {
      return (
        client.name?.toLowerCase().includes(searchTerm) ||
        client.phone?.includes(searchTerm)
      );
    });
  }, [clients, query]);

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
                {item.loyaltyPoints ?? 0}
              </Text>
              <Text style={styles.statLabel}>Points fidélité</Text>
            </View>
          </View>

          {/* LOYALTY TIER BADGE */}
          {item.loyaltyTier && (
            <View style={[styles.loyaltyBadge, { backgroundColor: loyaltyConfig.tiers[item.loyaltyTier].color + '20' }]}>
              <Ionicons
                name={loyaltyConfig.tiers[item.loyaltyTier].icon as any}
                size={16}
                color={loyaltyConfig.tiers[item.loyaltyTier].color}
              />
              <Text style={[styles.loyaltyBadgeText, { color: loyaltyConfig.tiers[item.loyaltyTier].color }]}>
                {item.loyaltyTier}
              </Text>
            </View>
          )}

          <View style={styles.clientStats}>
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
              style={[styles.actionButton, { backgroundColor: COLORS.info + '20' }]}
              onPress={() =>
                navigation.navigate('SellerCaisse', {
                  initialClientName: item.name,
                  initialClientPhone: item.phone,
                })
              }
            >
              <Ionicons name="cart-outline" size={20} color={COLORS.info} />
              <Text style={[styles.actionText, { color: COLORS.info }]}>Vendre</Text>
            </TouchableOpacity>

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

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: COLORS.info + '20' }]}
            onPress={handleOpenLoyaltySettings}
          >
            <Ionicons name="trophy-outline" size={20} color={COLORS.info} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* add-client modal */}
      <AddUserModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddClient}
        initialData={newClient}
      />

      {/* loyalty settings modal */}
      <Modal
        visible={showLoyaltySettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLoyaltySettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Programme de fidélité</Text>
              <TouchableOpacity onPress={() => setShowLoyaltySettings(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.infoSection}>
                <Ionicons name="information-circle" size={24} color={COLORS.info} />
                <Text style={styles.infoText}>
                  Personnalisez votre programme de fidélité selon vos besoins.
                </Text>
              </View>

              <View style={styles.configSection}>
                <Text style={styles.sectionTitle}>Statut du programme</Text>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>Programme actif</Text>
                  <TouchableOpacity
                    style={[styles.switch, editingLoyaltyConfig.isActive ? styles.switchActive : styles.switchInactive]}
                    onPress={() => setEditingLoyaltyConfig({ ...editingLoyaltyConfig, isActive: !editingLoyaltyConfig.isActive })}
                  >
                    <View style={[styles.switchThumb, { transform: [{ translateX: editingLoyaltyConfig.isActive ? 20 : 0 }] }]} />
                  </TouchableOpacity>
                </View>
              </View>

              {editingLoyaltyConfig.isActive && (
                <View style={styles.configSection}>
                  <Text style={styles.sectionTitle}>Période du programme</Text>
                  <DatePickerInput
                    label="Date de début"
                    value={editingLoyaltyConfig.startDate || ''}
                    onChange={(date) => setEditingLoyaltyConfig({ ...editingLoyaltyConfig, startDate: date })}
                    placeholder="Sélectionner la date de début"
                  />
                  <DatePickerInput
                    label="Date de fin"
                    value={editingLoyaltyConfig.endDate || ''}
                    onChange={(date) => setEditingLoyaltyConfig({ ...editingLoyaltyConfig, endDate: date })}
                    placeholder="Sélectionner la date de fin"
                  />
                </View>
              )}

              <View style={styles.configSection}>
                <Text style={styles.sectionTitle}>Configuration des points</Text>
                <View style={styles.configItem}>
                  <Text style={styles.configLabel}>Points pour chaque 1000 F dépensés</Text>
                  <TextInput
                    style={styles.configInput}
                    value={String(editingLoyaltyConfig.pointsPerXOF)}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 100;
                      setEditingLoyaltyConfig({ ...editingLoyaltyConfig, pointsPerXOF: value });
                    }}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.tierSection}>
                <Text style={styles.sectionTitle}>Seuils des niveaux de fidélité</Text>
                
                {Object.entries(editingLoyaltyConfig.tiers).map(([tier, config]) => (
                  <View key={tier} style={styles.tierCard}>
                    <View style={[styles.tierIcon, { backgroundColor: config.color + '20' }]}>
                      <Ionicons name={config.icon as any} size={24} color={config.color} />
                    </View>
                    <View style={styles.tierInfo}>
                      <Text style={styles.tierName}>{tier}</Text>
                      <TextInput
                        style={styles.tierInput}
                        value={String(config.minPoints)}
                        onChangeText={(text) => {
                          const value = parseInt(text) || 0;
                          setEditingLoyaltyConfig({
                            ...editingLoyaltyConfig,
                            tiers: {
                              ...editingLoyaltyConfig.tiers,
                              [tier]: { ...config, minPoints: value }
                            }
                          });
                        }}
                        keyboardType="numeric"
                        placeholder="Points minimum"
                      />
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.tipSection}>
                <Text style={styles.tipTitle}>💡 Astuces</Text>
                <Text style={styles.tipText}>
                  • Des seuils plus bas encouragent plus rapidement la fidélité{'\n'}
                  • Ajustez les points selon votre marge bénéficiaire{'\n'}
                  • Les clients avec un niveau élevé sont vos meilleurs clients
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelLoyaltyConfig}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleSaveLoyaltyConfig}
              >
                <Text style={styles.modalButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un client..."
          isLoading={searchLoading}
          onClear={() => setQuery('')}
        />
      </View>

      {/* CONTENT */}
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

  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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

  loyaltyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },

  loyaltyBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },

  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
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
    fontWeight: '700',
    color: COLORS.text,
  },

  modalBody: {
    padding: SPACING.lg,
  },

  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.info + '10',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },

  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    flexShrink: 1,
  },

  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },

  tierSection: {
    marginBottom: SPACING.lg,
  },

  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },

  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },

  tierInfo: {
    flex: 1,
  },

  tierName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },

  tierMinPoints: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },

  configSection: {
    marginBottom: SPACING.lg,
  },

  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  configLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },

  configValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },

  tipSection: {
    backgroundColor: COLORS.accent + '10',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },

  tipTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },

  tipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },

  modalButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    margin: SPACING.lg,
    borderRadius: RADIUS.md,
    flex: 1,
    marginHorizontal: SPACING.xs,
  },

  cancelButton: {
    backgroundColor: COLORS.textMuted,
  },

  cancelButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },

  modalButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },

  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },

  configInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    minWidth: 80,
    textAlign: 'center',
  },

  tierInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    minWidth: 100,
  },

  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },

  switchLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },

  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
  },

  switchActive: {
    backgroundColor: COLORS.success,
  },

  switchInactive: {
    backgroundColor: COLORS.textMuted,
  },

  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
});
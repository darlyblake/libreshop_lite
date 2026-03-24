import React, { useState, useEffect, useRef, useMemo } from 'react';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  Animated as RNAnimated,
  FlatList,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../config/theme';
import { supabase } from '../lib/supabase';

export const AdminStoresScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // general, subscription, products, orders, statistics
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<any[]>([]);

  const loadStores = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Join with users to display owner info
      const { data, error } = await supabase
        .from('stores')
        .select('id,user_id,name,slug,description,category,status,subscription_plan,subscription_start,subscription_end,subscription_status,product_limit,visible,created_at,users:users!stores_user_id_fkey(id,email,full_name,phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStores(
        (data || []).map((s: any) => ({
          id: String(s.id),
          user_id: String(s.user_id),
          name: String(s.name || ''),
          slug: String(s.slug || ''),
          description: s.description || '',
          category: String(s.category || ''),
          status: String(s.status || 'active'),
          address: '-',
          plan: s.subscription_plan || '-',
          subStart: s.subscription_start ? String(s.subscription_start) : '-',
          subEnd: s.subscription_end ? String(s.subscription_end) : '-',
          subStatus: s.subscription_status || '-',
          productLimit: s.product_limit ?? undefined,
          visible: s.visible ?? true,
          joinDate: s.created_at ? String(s.created_at) : '-',
          owner: s.users?.full_name || '-',
          email: s.users?.email || '-',
          phone: s.users?.phone || '-',
          // placeholders (can be wired later to real orders/products)
          revenue: 0,
          orders: 0,
          rating: 0,
          products: 0,
          productList: [],
          orderList: [],
        }))
      );
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'load stores');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('❌ Impossible de charger les boutiques');
      } else {
        Alert.alert('Erreur', 'Impossible de charger les boutiques');
      }
    } finally {
      setLoading(false);
    }
  };

  // Responsive utilities
  const getResponsiveValue = (mobile: number, tablet: number, desktop: number) => {
    const { width } = dimensions;
    if (width < 768) return mobile;
    if (width < 1024) return tablet;
    return desktop;
  };

  const getModalWidth = () => {
    return getResponsiveValue(
      dimensions.width * 0.95,
      dimensions.width * 0.8,
      Math.min(800, dimensions.width * 0.6)
    );
  };

  const getModalHeight = () => {
    return getResponsiveValue(
      dimensions.height * 0.8,
      dimensions.height * 0.7,
      dimensions.height * 0.6
    );
  };

  const isSmallScreen = dimensions.width < 768;
  const isTablet = dimensions.width >= 768 && dimensions.width < 1024;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    void loadStores();
  }, []);

  // Filter stores based on search query
  const filteredStores = useMemo(() => {
    return stores.filter(store =>
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stores, searchQuery]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return COLORS.success;
      case 'suspended':
        return COLORS.danger;
      case 'pending':
        return COLORS.warning;
      default:
        return COLORS.textMuted;
    }
  };

  const confirm = (title: string, message: string): Promise<boolean> => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return Promise.resolve(window.confirm(message));
    }
    return new Promise(resolve => {
      Alert.alert(title, message, [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Confirmer', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  };

  const updateStoreStatus = async (storeId: string, nextStatus: 'active' | 'suspended' | 'pending') => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('stores')
        .update({ status: nextStatus })
        .eq('id', storeId)
        .select('id,status')
        .single();
      if (error) throw error;
      setStores(prev => prev.map(s => (s.id === storeId ? { ...s, status: (data as any)?.status || nextStatus } : s)));
      if (selectedStore?.id === storeId) {
        setSelectedStore((prev: any) => ({ ...prev, status: (data as any)?.status || nextStatus }));
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'update store status');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('❌ Impossible de modifier le statut de la boutique');
      } else {
        Alert.alert('Erreur', 'Impossible de modifier le statut de la boutique');
      }
    }
  };

  const deleteStore = async (storeId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('stores').delete().eq('id', storeId);
      if (error) throw error;
      setStores(prev => prev.filter(s => s.id !== storeId));
      if (selectedStore?.id === storeId) {
        setIsModalVisible(false);
        setSelectedStore(null);
        setActiveTab('general');
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'delete store');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('❌ Impossible de supprimer la boutique');
      } else {
        Alert.alert('Erreur', 'Impossible de supprimer la boutique');
      }
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    header: {
      backgroundColor: COLORS.primary,
      paddingTop: getResponsiveValue(40, 50, 60),
      paddingBottom: getResponsiveValue(20, 25, 30),
      paddingHorizontal: getResponsiveValue(16, 24, 32),
    },
    headerTitle: {
      fontSize: getResponsiveValue(24, 28, 32),
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: getResponsiveValue(14, 16, 18),
      color: COLORS.text,
      opacity: 0.9,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.bg,
      margin: getResponsiveValue(16, 20, 24),
      paddingHorizontal: getResponsiveValue(16, 20, 24),
      paddingVertical: getResponsiveValue(12, 14, 16),
      borderRadius: getResponsiveValue(12, 14, 16),
      ...SHADOWS.small,
    },
    searchInput: {
      flex: 1,
      fontSize: getResponsiveValue(14, 16, 18),
      color: COLORS.text,
      marginLeft: 12,
    },
    statsContainer: {
      flexDirection: isSmallScreen ? 'column' : 'row',
      marginHorizontal: getResponsiveValue(16, 20, 24),
      marginBottom: getResponsiveValue(16, 20, 24),
      gap: getResponsiveValue(12, 16, 20),
    },
    statCard: {
      flex: 1,
      backgroundColor: COLORS.bg,
      padding: getResponsiveValue(16, 20, 24),
      borderRadius: getResponsiveValue(12, 14, 16),
      alignItems: 'center',
      ...SHADOWS.small,
    },
    statValue: {
      fontSize: getResponsiveValue(20, 24, 28),
      fontWeight: '700',
      color: COLORS.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: getResponsiveValue(12, 14, 16),
      color: COLORS.textMuted,
      textAlign: 'center',
    },
    listContainer: {
      flex: 1,
      paddingHorizontal: getResponsiveValue(16, 20, 24),
    },
    storeCard: {
      backgroundColor: COLORS.bg,
      marginBottom: getResponsiveValue(12, 16, 20),
      borderRadius: getResponsiveValue(12, 14, 16),
      padding: getResponsiveValue(16, 20, 24),
      ...SHADOWS.small,
    },
    storeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: getResponsiveValue(12, 16, 20),
    },
    storeName: {
      fontSize: getResponsiveValue(16, 18, 20),
      fontWeight: '600',
      color: COLORS.text,
      flex: 1,
    },
    storeOwner: {
      fontSize: getResponsiveValue(12, 14, 16),
      color: COLORS.textMuted,
      marginTop: 4,
    },
    statusBadge: {
      paddingHorizontal: getResponsiveValue(8, 10, 12),
      paddingVertical: getResponsiveValue(4, 6, 8),
      borderRadius: getResponsiveValue(6, 8, 10),
    },
    statusText: {
      fontSize: getResponsiveValue(10, 12, 14),
      fontWeight: '500',
      color: COLORS.text,
    },
    storeInfo: {
      marginBottom: getResponsiveValue(12, 16, 20),
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: getResponsiveValue(6, 8, 10),
    },
    infoText: {
      fontSize: getResponsiveValue(12, 14, 16),
      color: COLORS.textMuted,
      marginLeft: 8,
      flex: 1,
    },
    storeStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: getResponsiveValue(12, 16, 20),
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    storeStat: {
      alignItems: 'center',
      flex: 1,
    },
    storeStatValue: {
      fontSize: getResponsiveValue(14, 16, 18),
      fontWeight: '600',
      color: COLORS.text,
    },
    storeStatLabel: {
      fontSize: getResponsiveValue(10, 12, 14),
      color: COLORS.textMuted,
      marginTop: 2,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: getResponsiveValue(8, 10, 12),
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: getResponsiveValue(8, 10, 12),
      borderRadius: getResponsiveValue(8, 10, 12),
    },
    actionButtonText: {
      fontSize: getResponsiveValue(12, 14, 16),
      fontWeight: '500',
      marginLeft: 6,
    },
    editButton: {
      backgroundColor: COLORS.primary,
    },
    dangerButton: {
      backgroundColor: COLORS.danger,
    },
    deleteButton: {
      backgroundColor: COLORS.danger,
    },
    viewButton: {
      backgroundColor: COLORS.secondary,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000, // ensure on top
    },
    modalContainer: {
      width: '90%',
      height: '90%',
      maxWidth: 800,
      maxHeight: 800,
      backgroundColor: COLORS.bg,
      borderRadius: getResponsiveValue(16, 20, 24),
      overflow: 'hidden',
      ...SHADOWS.large,
    },
    modalHeader: {
      padding: getResponsiveValue(20, 24, 28),
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    modalTitle: {
      fontSize: getResponsiveValue(18, 20, 24),
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: getResponsiveValue(14, 16, 18),
      color: COLORS.textMuted,
    },
    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    tabButton: {
      flex: 1,
      paddingVertical: getResponsiveValue(12, 14, 16),
      alignItems: 'center',
    },
    tabButtonText: {
      fontSize: getResponsiveValue(12, 14, 16),
      fontWeight: '500',
      color: COLORS.textMuted,
    },
    activeTabButton: {
      borderBottomWidth: 2,
      borderBottomColor: COLORS.primary,
    },
    activeTabText: {
      color: COLORS.primary,
    },
    modalContent: {
      flex: 1,
      padding: getResponsiveValue(20, 24, 28),
    },
    detailSection: {
      marginBottom: getResponsiveValue(20, 24, 28),
    },
    detailTitle: {
      fontSize: getResponsiveValue(14, 16, 18),
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: getResponsiveValue(12, 16, 20),
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: getResponsiveValue(8, 10, 12),
    },
    detailLabel: {
      fontSize: getResponsiveValue(12, 14, 16),
      color: COLORS.text, // blanc
      flex: 1,
    },
    detailValue: {
      fontSize: getResponsiveValue(12, 14, 16),
      fontWeight: '500',
      color: COLORS.text, // blanc
      flex: 2,
      textAlign: 'right',
    },
    closeButton: {
      backgroundColor: COLORS.primary,
      paddingVertical: getResponsiveValue(12, 14, 16),
      borderRadius: getResponsiveValue(8, 10, 12),
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: getResponsiveValue(14, 16, 18),
      fontWeight: '600',
      color: COLORS.text,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: getResponsiveValue(40, 50, 60),
    },
    emptyIcon: {
      fontSize: getResponsiveValue(48, 56, 64),
      color: COLORS.textMuted,
      marginBottom: getResponsiveValue(16, 20, 24),
    },
    emptyText: {
      fontSize: getResponsiveValue(16, 18, 20),
      color: COLORS.textMuted,
      textAlign: 'center',
    },
  });

// Header, search and stats rendered as list header so everything scrolls together
  const ListHeader = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Magasins</Text>
        <Text style={styles.headerSubtitle}>Gérez tous les magasins de la plateforme</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un magasin..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stores.length}</Text>
          <Text style={styles.statLabel}>Total magasins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stores.filter(s => s.status === 'active').length}</Text>
          <Text style={styles.statLabel}>Magasins actifs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatCurrency(stores.reduce((sum, store) => sum + store.revenue, 0))}
          </Text>
          <Text style={styles.statLabel}>Revenus totaux</Text>
        </View>
      </View>
    </>
  );

  const renderStoreList = () => {
    return (
      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={48} color={COLORS.textMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>{loading ? 'Chargement...' : 'Aucun magasin trouvé'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.storeCard}
            activeOpacity={0.8}
            onPress={() => {
              setSelectedStore(item);
              setIsModalVisible(true);
            }}
          >
            <View style={styles.storeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{item.name}</Text>
                <Text style={styles.storeOwner}>{item.owner}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>
                  {item.status === 'active' ? 'Actif' : item.status === 'pending' ? 'En attente' : 'Suspendu'}
                </Text>
              </View>
            </View>

            <View style={styles.storeInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.infoText}>{item.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.infoText}>{item.phone}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.infoText}>{item.address}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="basket-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.infoText}>{item.category}</Text>
              </View>
            </View>

            <View style={styles.storeStats}>
              <View style={styles.storeStat}>
                <Text style={styles.storeStatValue}>{formatCurrency(item.revenue)}</Text>
                <Text style={styles.storeStatLabel}>Revenus</Text>
              </View>
              <View style={styles.storeStat}>
                <Text style={styles.storeStatValue}>{item.orders}</Text>
                <Text style={styles.storeStatLabel}>Commandes</Text>
              </View>
              <View style={styles.storeStat}>
                <Text style={styles.storeStatValue}>{item.rating}</Text>
                <Text style={styles.storeStatLabel}>Note</Text>
              </View>
              <View style={styles.storeStat}>
                <Text style={styles.storeStatValue}>{item.products}</Text>
                <Text style={styles.storeStatLabel}>Produits</Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.viewButton]}
                onPress={() => {
                  navigation.navigate('StoreDetail', { storeId: item.id });
                }}
              >
                <Ionicons name="eye-outline" size={16} color={COLORS.text} />
                <Text style={[styles.actionButtonText, { color: COLORS.text }]}>Voir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.editButton]}>
                <Ionicons name="create-outline" size={16} color={COLORS.text} />
                <Text style={[styles.actionButtonText, { color: COLORS.text }]}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => {
                  void (async () => {
                    const ok = await confirm('Supprimer le magasin', `Êtes-vous sûr de vouloir supprimer ${item.name} ?`);
                    if (ok) await deleteStore(item.id);
                  })();
                }}
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.text} />
                <Text style={[styles.actionButtonText, { color: COLORS.text }]}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    );
  };

  const renderTabContent = () => {
    if (!selectedStore) return null;

    switch (activeTab) {
      case 'general':
        return (
          <ScrollView>
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Informations générales</Text>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Nom</Text><Text style={styles.detailValue}>{selectedStore.name}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Logo</Text><Text style={styles.detailValue}>[logo]</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Bannière</Text><Text style={styles.detailValue}>[logo]</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Description</Text><Text style={styles.detailValue}>{selectedStore.description || '-'}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Téléphone</Text><Text style={styles.detailValue}>{selectedStore.phone}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Localisation</Text><Text style={styles.detailValue}>{selectedStore.address}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Date inscription</Text><Text style={styles.detailValue}>{selectedStore.joinDate}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Statut boutique</Text><Text style={[styles.detailValue, { color: getStatusColor(selectedStore.status) }]}>{selectedStore.status}</Text></View>
            </View>
            <View style={styles.actionButtons}> 
              {selectedStore.status === 'pending' ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => void updateStoreStatus(selectedStore.id, 'active')}
                >
                  <Text style={[styles.actionButtonText, {color:COLORS.text}]}>Valider</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionButton, styles.editButton]}>
                  <Text style={[styles.actionButtonText, {color:COLORS.text}]}>Modifier</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                onPress={() => {
                  const next = selectedStore.status === 'active' ? 'suspended' : 'active';
                  void (async () => {
                    const ok = await confirm(
                      next === 'suspended' ? 'Suspendre la boutique' : 'Réactiver la boutique',
                      `Confirmer l'action sur ${selectedStore.name} ?`
                    );
                    if (ok) await updateStoreStatus(selectedStore.id, next);
                  })();
                }}
              >
                <Text style={[styles.actionButtonText, {color:COLORS.text}]}>
                  {selectedStore.status === 'active' ? 'Suspendre' : 'Réactiver'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => void (async () => {
                  const ok = await confirm('Supprimer la boutique', `Êtes-vous sûr de vouloir supprimer ${selectedStore.name} ?`);
                  if (ok) await deleteStore(selectedStore.id);
                })()}
              >
                <Text style={[styles.actionButtonText, {color:COLORS.text}]}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );

      case 'subscription':
        return (
          <ScrollView>
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Abonnement</Text>
              {/* placeholder fields */}
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Plan actuel</Text><Text style={styles.detailValue}>{selectedStore.plan||'-'}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Date début</Text><Text style={styles.detailValue}>{selectedStore.subStart||'-'}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Date fin</Text><Text style={styles.detailValue}>{selectedStore.subEnd||'-'}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Durée (mois)</Text><Text style={styles.detailValue}>{selectedStore.subDuration||'-'}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Statut abonnement</Text><Text style={styles.detailValue}>{selectedStore.subStatus||'-'}</Text></View>
            </View>
            {/* ...rest of subscription actions/ history ... */}
          </ScrollView>
        );

      case 'products':
        return (
          <FlatList
            data={selectedStore.productList || []}
            keyExtractor={p => p.id}
            style={{flex:1}}
            renderItem={({item}) => (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{item.name}</Text>
                <Text style={styles.detailValue}>{item.status} / {item.stock} / {item.price} Fcfa</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.detailValue}>Aucun produit</Text>}
          />
        );

      case 'orders':
        return (
          <FlatList
            data={selectedStore.orderList || []}
            keyExtractor={o => o.id}
            style={{flex:1}}
            renderItem={({item}) => (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{item.id}</Text>
                <Text style={styles.detailValue}>{item.status} / {item.amount} Fcfa / {item.date}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.detailValue}>Aucune commande</Text>}
          />
        );

      case 'statistics':
        return (
          <View style={{flex:1}}><Text>Statistiques (TODO)</Text></View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* everything scrolled by flatlist via ListHeaderComponent */}
      <View style={styles.listContainer}>
        {renderStoreList()}
      </View>

      {isModalVisible && selectedStore && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedStore.name}</Text>
              <Text style={styles.modalSubtitle}>{selectedStore.owner}</Text>
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'general' && styles.activeTabButton]}
                onPress={() => setActiveTab('general')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'general' && styles.activeTabText]}>
                  Informations générales
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'subscription' && styles.activeTabButton]}
                onPress={() => setActiveTab('subscription')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'subscription' && styles.activeTabText]}>
                  Abonnement
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'products' && styles.activeTabButton]}
                onPress={() => setActiveTab('products')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'products' && styles.activeTabText]}>
                  Produits
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'orders' && styles.activeTabButton]}
                onPress={() => setActiveTab('orders')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'orders' && styles.activeTabText]}>
                  Commandes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'statistics' && styles.activeTabButton]}
                onPress={() => setActiveTab('statistics')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'statistics' && styles.activeTabText]}>
                  Statistiques
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {renderTabContent()}
            </View>

            <View style={{ padding: getResponsiveValue(20, 24, 28) }}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setIsModalVisible(false);
                  setSelectedStore(null);
                  setActiveTab('general');
                }}
              >
                <Text style={styles.closeButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};


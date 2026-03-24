import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { Order, OrderItem, Product, Store, User, orderService } from '../lib/supabase';
import { useAuthStore } from '../store';
import * as Linking from 'expo-linking';

// Types étendus
interface OrderWithDetails extends Order {
  store?: Store;
  seller?: User;
  order_items: (OrderItem & { product?: Product })[];
}

interface OrderFilters {
  status?: string;
  dateRange?: 'week' | 'month' | 'year' | 'all';
  storeId?: string;
}



const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return COLORS.warning;
    case 'paid': return COLORS.accent;
    case 'shipped': return COLORS.accent2;
    case 'delivered': return COLORS.success;
    case 'cancelled': return COLORS.danger;
    default: return COLORS.textMuted;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return 'En attente';
    case 'paid': return 'Payée';
    case 'shipped': return 'Expédiée';
    case 'delivered': return 'Livrée';
    case 'cancelled': return 'Annulée';
    default: return status;
  }
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const generateWhatsAppMessage = (order: OrderWithDetails): string => {
  const products = order.order_items.map(item => 
    `${item.quantity}x ${item.product?.name || 'Produit'} - ${item.price} FCA`
  ).join('\n');
  
  return `Bonjour ! Je vous contacte concernant ma commande #${order.id} du ${formatDate(order.created_at)}:\n\n${products}\n\nTotal: ${order.total_amount} FCA\n\nStatut: ${getStatusLabel(order.status)}\n\nPourriez-vous me donner plus d'informations ?`;
};

const generateWhatsAppUrl = (order: OrderWithDetails): string | null => {
  // Use the store's phone (already loaded via the order join)
  const rawPhone = order.store?.phone || (order.store as any)?.whatsapp_number;
  if (!rawPhone) return null;
  // Normalise: keep only digits (wa.me expects international digits, no '+')
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return null;
  const message = generateWhatsAppMessage(order);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

export const ClientOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  
  // États principaux
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<OrderFilters>({});
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [markingAsReceived, setMarkingAsReceived] = useState<string | null>(null);

  // Charger les commandes avec détails
  const loadOrders = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const data = await orderService.getByUser(String(user.id));
      
      const ordersWithDetails = Array.isArray(data) ? data.map((order: any) => ({
        ...order,
        order_items: ((order?.order_items || []) as any[]).map((item: any) => ({
          ...item,
          product: item.product || item.products,
        })),
      })) : [];
      
      setOrders(ordersWithDetails);
    } catch (e: any) {
      errorHandler.handle(e, 'load orders failed', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      Alert.alert('Erreur', e?.message ? String(e.message) : 'Impossible de charger vos commandes');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Filtrer les commandes
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    // Filtre par recherche
    if (searchQuery.trim()) {
      filtered = filtered.filter(order => 
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.store?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.order_items.some(item => 
          item.product?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
    
    // Filtre par statut
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(order => order.status === filters.status);
    }
    
    // Filtre par boutique
    if (filters.storeId) {
      filtered = filtered.filter(order => order.store_id === filters.storeId);
    }
    
    // Filtre par date
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filters.dateRange) {
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(order => 
        new Date(order.created_at) >= filterDate
      );
    }
    
    return filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [orders, searchQuery, filters]);

  // Marquer comme reçu
  const markAsReceived = async (orderId: string) => {
    try {
      setMarkingAsReceived(orderId);
      await orderService.updateStatus(orderId, 'delivered');
      
      // Mettre à jour localement
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: 'delivered', delivered_at: new Date().toISOString() }
          : order
      ));
      
      Alert.alert('Succès', 'La commande a été marquée comme reçue');
    } catch (e: any) {
      errorHandler.handleDatabaseError(e, 'mark as received failed');
      Alert.alert('Erreur', 'Impossible de marquer la commande comme reçue');
    } finally {
      setMarkingAsReceived(null);
    }
  };

  // Contacter le vendeur
  const contactSeller = (order: OrderWithDetails) => {
    const whatsappUrl = generateWhatsAppUrl(order);
    if (!whatsappUrl) {
      Alert.alert(
        'Numéro introuvable',
        'Cette boutique n\'a pas encore renseigné un numéro WhatsApp de contact.'
      );
      return;
    }

    // On web, prefer opening in a new tab to avoid app routing collisions
    if (typeof window !== 'undefined' && window && window.location && window.open) {
      try {
        window.open(whatsappUrl, '_blank');
        return;
      } catch (e) {
        // fallthrough to Linking
      }
    }

    Linking.openURL(whatsappUrl).catch(() => {
      Alert.alert(
        'Impossible d\'ouvrir WhatsApp',
        'Vérifiez que WhatsApp est installé sur votre appareil, ou copiez le numéro manuellement.'
      );
    });
  };

  // Voir les détails
  const viewOrderDetails = (order: OrderWithDetails) => {
    setSelectedOrder(order);
  };

  // Rafraîchir
  const onRefresh = useCallback(() => {
    const run = async () => {
      setRefreshing(true);
      await loadOrders();
      setRefreshing(false);
    };
    run();
  }, [loadOrders]);

  // Effets
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Obtenir les boutiques uniques pour les filtres
  const uniqueStores = useMemo(() => {
    const stores = orders.map(order => order.store).filter(Boolean);
    return Array.from(new Map(stores.map(store => [store?.id, store])).values());
  }, [orders]);

  // Rendu d’une commande
  const renderOrder = (order: OrderWithDetails) => (
    <View key={order.id} style={styles.orderCard}>
      {/* Header avec statut */}
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>Commande #{order.id}</Text>
          <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
        </View>
      </View>

      {/* Boutique */}
      {order.store && (
        <View style={styles.storeInfo}>
          <Ionicons name="storefront-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.storeName}>{order.store.name}</Text>
        </View>
      )}

      {/* Produits */}
      <View style={styles.productsList}>
        {order.order_items.slice(0, 3).map((item, index) => (
          <View key={index} style={styles.productItem}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.product?.name || 'Produit'}
            </Text>
            <Text style={styles.productQuantity}>
              {item.quantity}x {item.price} FCA
            </Text>
          </View>
        ))}
        {order.order_items.length > 3 && (
          <Text style={styles.moreProducts}>
            +{order.order_items.length - 3} autres produits...
          </Text>
        )}
      </View>

      {/* Total */}
      <View style={styles.orderTotal}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{order.total_amount} FCA</Text>
      </View>

      {/* Actions */}
      <View style={styles.orderActions}>
        {order.status === 'shipped' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.receivedButton]}
            onPress={() => markAsReceived(order.id)}
            disabled={markingAsReceived === order.id}
          >
            {markingAsReceived === order.id ? (
              <ActivityIndicator color={COLORS.text} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.text} />
                <Text style={styles.actionButtonText}>Comme reçu</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.contactButton]}
          onPress={() => contactSeller(order)}
        >
          <Ionicons name="logo-whatsapp" size={18} color={COLORS.text} />
          <Text style={styles.actionButtonText}>Contacter</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.detailsButton]}
          onPress={() => viewOrderDetails(order)}
        >
          <Ionicons name="eye-outline" size={18} color={COLORS.accent} />
          <Text style={[styles.actionButtonText, { color: COLORS.accent }]}>Détails</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Commandes</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter-outline" size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une commande..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      {/* Filtres actifs */}
      {(filters.status || filters.storeId || filters.dateRange) && (
        <View style={styles.activeFilters}>
          <Text style={styles.filterLabel}>Filtres actifs:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filters.status && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>
                  Statut: {getStatusLabel(filters.status)}
                </Text>
                <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, status: undefined }))}>
                  <Ionicons name="close-circle" size={16} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            )}
            {filters.storeId && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>
                  Boutique: {uniqueStores.find(s => s.id === filters.storeId)?.name}
                </Text>
                <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, storeId: undefined }))}>
                  <Ionicons name="close-circle" size={16} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Liste des commandes */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.accent} size="large" />
          <Text style={styles.loadingText}>Chargement de vos commandes...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Aucune commande trouvée</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Essayez une autre recherche' : 'Commencez vos achats pour voir vos commandes ici'}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.ordersList}
        >
          {filteredOrders.map(renderOrder)}
        </ScrollView>
      )}

      {/* Modal des filtres */}
      <Modal
        animationType="slide"
        transparent
        visible={showFilters}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrer les commandes</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {/* Filtre par statut */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Statut</Text>
                <View style={styles.filterOptions}>
                  {['all', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'].map(status => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterOption,
                        filters.status === status && styles.filterOptionSelected
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, status }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.status === status && styles.filterOptionTextSelected
                      ]}>
                        {status === 'all' ? 'Tous' : getStatusLabel(status)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Filtre par boutique */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Boutique</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      !filters.storeId && styles.filterOptionSelected
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, storeId: undefined }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      !filters.storeId && styles.filterOptionTextSelected
                    ]}>
                      Toutes
                    </Text>
                  </TouchableOpacity>
                  {uniqueStores.map(store => (
                    <TouchableOpacity
                      key={store.id}
                      style={[
                        styles.filterOption,
                        filters.storeId === store.id && styles.filterOptionSelected
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, storeId: store.id }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.storeId === store.id && styles.filterOptionTextSelected
                      ]}>
                        {store.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Filtre par date */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Période</Text>
                <View style={styles.filterOptions}>
                  {[
                    { value: 'all', label: 'Toutes' },
                    { value: 'week', label: 'Cette semaine' },
                    { value: 'month', label: 'Ce mois' },
                    { value: 'year', label: 'Cette année' }
                  ].map(range => (
                    <TouchableOpacity
                      key={range.value}
                      style={[
                        styles.filterOption,
                        filters.dateRange === range.value && styles.filterOptionSelected
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, dateRange: range.value as any }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.dateRange === range.value && styles.filterOptionTextSelected
                      ]}>
                        {range.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal détails commande */}
      {selectedOrder && (
        <Modal
          animationType="slide"
          transparent
          visible={!!selectedOrder}
          onRequestClose={() => setSelectedOrder(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.detailsModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Détails de la commande #{selectedOrder.id}</Text>
                <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalContent}>
                {/* Infos boutique */}
                {selectedOrder.store && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Boutique</Text>
                    <Text style={styles.detailText}>{selectedOrder.store.name}</Text>
                    {selectedOrder.store.phone && (
                      <Text style={styles.detailText}>{selectedOrder.store.phone}</Text>
                    )}
                  </View>
                )}

                {/* Produits */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Produits ({selectedOrder.order_items.length})</Text>
                  {selectedOrder.order_items.map((item, index) => (
                    <View key={index} style={styles.detailItem}>
                      <Text style={styles.detailProductName}>
                        {item.quantity}x {item.product?.name || 'Produit'}
                      </Text>
                      <Text style={styles.detailProductPrice}>
                        {item.price} FCA
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Total */}
                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Sous-total:</Text>
                    <Text style={styles.detailValue}>
                      {(selectedOrder.total_amount - (selectedOrder.delivery_fee || 0))} FCA
                    </Text>
                  </View>
                  {selectedOrder.delivery_fee && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Livraison:</Text>
                      <Text style={styles.detailValue}>
                        {selectedOrder.delivery_fee} FCA
                      </Text>
                    </View>
                  )}
                  <View style={[styles.detailRow, styles.totalRow]}>
                    <Text style={styles.detailTotalLabel}>Total:</Text>
                    <Text style={styles.detailTotalValue}>
                      {selectedOrder.total_amount} FCA
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

// Styles
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
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  filterButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent + '10',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    paddingVertical: 0,
  },
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  filterLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginRight: SPACING.sm,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent + '10',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
  },
  activeFilterText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    marginRight: SPACING.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  ordersList: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  orderDate: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  storeName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginLeft: SPACING.sm,
  },
  productsList: {
    marginBottom: SPACING.md,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  productName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  productQuantity: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  moreProducts: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontStyle: 'italic',
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  totalAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.accent,
  },
  orderActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    minHeight: 44,
  },
  receivedButton: {
    backgroundColor: COLORS.success,
  },
  contactButton: {
    backgroundColor: 'COLORS.whatsapp',
  },
  detailsButton: {
    backgroundColor: COLORS.accent + '10',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  actionButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModal: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  detailsModal: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    width: '95%',
    maxWidth: 500,
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
  modalContent: {
    padding: SPACING.lg,
  },
  filterSection: {
    marginBottom: SPACING.lg,
  },
  filterSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterOptionSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterOptionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  filterOptionTextSelected: {
    color: COLORS.text,
  },
  detailSection: {
    marginBottom: SPACING.lg,
  },
  detailSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  detailText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailProductName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  detailProductPrice: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  detailLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  detailValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: COLORS.accent,
    paddingTop: SPACING.md,
    marginTop: SPACING.sm,
  },
  detailTotalLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailTotalValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.accent,
  },
});


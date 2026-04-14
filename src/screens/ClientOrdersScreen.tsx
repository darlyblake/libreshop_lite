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
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useLegacyPalette, type LegacyPalette } from '../hooks/useLegacyPalette';
import { useTheme } from '../hooks/useTheme';
import { Order, OrderItem, Product, Store, User } from '../lib/supabase';
import { orderService } from '../services/orderService';
import { contactStore } from '../services/contactService';
import { useAuthStore } from '../store';

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



const getStatusColor = (status: string, p: LegacyPalette) => {
  switch (status) {
    case 'pending': return p.warning;
    case 'paid': return p.accent;
    case 'shipped': return p.accent2;
    case 'delivered': return p.success;
    case 'cancelled': return p.danger;
    default: return p.textMuted;
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

const formatAmount = (value: number | string | undefined) => {
  try {
    const n = Number(value || 0);
    return n.toLocaleString('fr-FR');
  } catch {
    return String(value ?? '0');
  }
};

const generateWhatsAppMessage = (order: OrderWithDetails): string => {
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const products = order.order_items.map(item => {
    const name = item.product?.name || 'Produit';
    const qty = item.quantity ?? 1;
    const price = formatAmount(item.price);
    return `${qty}× ${name} — ${price} FCA`;
  }).join('\n');

  const total = formatAmount(order.total_amount as any);

  return [
    `Bonjour, je vous contacte au sujet de ma commande #${shortId} du ${formatDate(order.created_at)}.`,
    '',
    products,
    '',
    `Total : ${total} FCA`,
    `Statut : ${getStatusLabel(order.status)}`,
    '',
    `Pouvez-vous me donner plus d'informations, s'il vous plaît ?`,
  ].join('\n');
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
  const [cancelingOrder, setCancelingOrder] = useState<string | null>(null);

  const palette = useLegacyPalette();
  const { spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE } = useTheme();
  const styles = useMemo(
    () => createClientOrdersStyles(palette, SPACING, RADIUS, FONT_SIZE),
    [palette, SPACING, RADIUS, FONT_SIZE]
  );

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

  // Accepter / confirmer le paiement (action vendeur/admin)
  const acceptPayment = async (orderId: string) => {
    try {
      // call RPC to confirm payment
      await orderService.confirmOrderPayment(orderId);

      // update local state optimistically
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'paid', paid_at: new Date().toISOString(), payment_status: 'paid' } : o));
      setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: 'paid', paid_at: new Date().toISOString(), payment_status: 'paid' } : prev);

      Alert.alert('Succès', 'Paiement accepté');
    } catch (e: any) {
      errorHandler.handleDatabaseError?.(e, 'accept payment failed');
      Alert.alert('Erreur', 'Impossible d\'accepter le paiement pour le moment');
    }
  };

  // Annuler une commande (client)
  const cancelOrder = async (orderId: string) => {
    // Optimistic UI: mark cancelled locally immediately, revert on failure
    const prevOrders = [...orders];
    const prevSelected = selectedOrder ? { ...selectedOrder } : null;
    try {
      setCancelingOrder(orderId);

      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? { ...order, status: 'cancelled', cancelled_at: new Date().toISOString() }
          : order
      ));
      setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: 'cancelled', cancelled_at: new Date().toISOString() } : prev);

      await orderService.cancelOrderRobust(orderId);

      // success
      if (typeof window !== 'undefined') {
        try { window.alert('La commande a été annulée'); } catch {}
      } else {
        Alert.alert('Succès', 'La commande a été annulée');
      }
    } catch (e: any) {
      // revert optimistic update
      setOrders(prevOrders);
      setSelectedOrder(prevSelected);
      errorHandler.handleDatabaseError?.(e, 'cancel order failed');
      if (typeof window !== 'undefined') {
        try { window.alert('Erreur: Impossible d\'annuler la commande pour le moment'); } catch {};
      } else {
        Alert.alert('Erreur', 'Impossible d\'annuler la commande pour le moment');
      }
    } finally {
      setCancelingOrder(null);
    }
  };

  // Confirmer avant annulation
  const confirmCancel = (order: OrderWithDetails) => {
    if (!order) return;
    if (!(order.status === 'pending' || order.status === 'paid')) {
      Alert.alert('Annulation impossible', 'Cette commande ne peut pas être annulée.');
      return;
    }

    // Web: use native window.confirm for reliable dialog
    if (typeof window !== 'undefined' && Platform.OS === 'web') {
      try {
        const ok = window.confirm(`Souhaitez‑vous vraiment annuler la commande #${order.id} ?`);
        if (ok) void cancelOrder(order.id);
      } catch (e) {
        // fallback to Alert
        Alert.alert(
          'Annuler la commande',
          `Souhaitez‑vous vraiment annuler la commande #${order.id} ?`,
          [
            { text: 'Non', style: 'cancel' },
            { text: 'Oui, annuler', style: 'destructive', onPress: () => void cancelOrder(order.id) },
          ],
        );
      }
      return;
    }

    Alert.alert(
      'Annuler la commande',
      `Souhaitez‑vous vraiment annuler la commande #${order.id} ?`,
      [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui, annuler', style: 'destructive', onPress: () => void cancelOrder(order.id) },
      ],
    );
  };

  // Contacter le vendeur
  const contactSeller = (order: OrderWithDetails) => {
    const rawPhone = order.store?.phone || (order.store as any)?.whatsapp_number || (order as any).stores?.phone;
    const message = generateWhatsAppMessage(order);
    // Use central contact service with fallbacks
    void contactStore({ rawPhone, message, fallback: 'tel-or-copy' });
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
  // Calculate amounts helper (subtotal, delivery, tax, total)
  const computeAmounts = (order: OrderWithDetails | null) => {
    if (!order) return { subtotal: 0, delivery: 0, tax: 0, total: 0 };
    const subtotal = (order.order_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
    const delivery = order.delivery_fee != null ? Number(order.delivery_fee) : Number((order.store as any)?.shipping_price || 0);
    const tax = order.tax_amount != null ? Number(order.tax_amount) : Math.round(subtotal * (Number((order.store as any)?.tax_rate || 0) / 100));
    const total = Number(order.total_amount != null ? order.total_amount : subtotal + delivery + tax);
    return { subtotal, delivery, tax, total };
  };

  // Compute order steps/timeline from timestamps/status
  const computeOrderSteps = (order: OrderWithDetails | null) => {
    if (!order) return [] as { key: string; label: string; date?: string; done: boolean }[];
    const steps: { key: string; label: string; date?: string; done: boolean }[] = [];

    // Created
    steps.push({ key: 'created', label: 'Commande créée', date: order.created_at, done: true });

    // Paid
    const paid = (order as any).paid_at || order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered';
    steps.push({ key: 'paid', label: 'Commande acceptée', date: (order as any).paid_at, done: !!paid });

    // Shipped
    const shipped = (order as any).shipped_at || order.status === 'shipped' || order.status === 'delivered';
    steps.push({ key: 'shipped', label: 'Expédiée', date: (order as any).shipped_at, done: !!shipped });

    // Delivered
    const delivered = (order as any).delivered_at || order.status === 'delivered';
    steps.push({ key: 'delivered', label: 'Livrée', date: (order as any).delivered_at, done: !!delivered });

    // Cancelled (if cancelled show at end)
    const cancelled = (order as any).cancelled_at || order.status === 'cancelled';
    if (cancelled) {
      steps.push({ key: 'cancelled', label: 'Annulée', date: (order as any).cancelled_at, done: true });
    }

    return steps;
  };

  const renderOrder = (order: OrderWithDetails) => (
    <View key={order.id} style={styles.orderCard}>
      {/* Header avec statut */}
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>Commande #{String(order.id).split('-')[0].toUpperCase()}</Text>
          <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          {order.store?.name ? (
            <Text style={styles.storeInline} numberOfLines={1}>{order.store.name}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status, palette) }]}>
          <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
        </View>
      </View>

      {/* Boutique */}
      {order.store && (
        <View style={styles.storeInfo}>
          <Ionicons name="storefront-outline" size={16} color={palette.textMuted} />
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
        {(() => {
          const amt = computeAmounts(order);
          return (
            <>
              <View style={{flex: 1}}>
                <Text style={styles.subtotalLabel}>Sous-total</Text>
                <Text style={styles.subtotalValue}>{amt.subtotal.toLocaleString()} FCA</Text>
                {amt.delivery ? <Text style={styles.detailSmall}>Livraison: {amt.delivery.toLocaleString()} FCA</Text> : null}
                {amt.tax ? <Text style={styles.detailSmall}>TVA: {amt.tax.toLocaleString()} FCA</Text> : null}
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>{amt.total.toLocaleString()} FCA</Text>
              </View>
            </>
          );
        })()}
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
              <ActivityIndicator color={palette.text} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={palette.text} />
                <Text style={styles.actionButtonText}>Comme reçu</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.contactButton]}
          onPress={() => contactSeller(order)}
        >
          <Ionicons name="logo-whatsapp" size={18} color={palette.text} />
          <Text style={styles.actionButtonText}>Contacter</Text>
        </TouchableOpacity>

        {(order.status === 'pending' || order.status === 'paid') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => confirmCancel(order)}
            disabled={cancelingOrder === order.id}
          >
            {cancelingOrder === order.id ? (
              <ActivityIndicator color={palette.text} size="small" />
            ) : (
              <>
                <Ionicons name="close-circle" size={18} color={palette.text} />
                <Text style={styles.actionButtonText}>Annuler</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.detailsButton]}
          onPress={() => viewOrderDetails(order)}
        >
          <Ionicons name="eye-outline" size={18} color={palette.accent} />
          <Text style={[styles.actionButtonText, { color: palette.accent }]}>Détails</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Commandes</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter-outline" size={20} color={palette.accent} />
        </TouchableOpacity>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={palette.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une commande..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={palette.textMuted}
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
                  <Ionicons name="close-circle" size={16} color={palette.danger} />
                </TouchableOpacity>
              </View>
            )}
            {filters.storeId && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>
                  Boutique: {uniqueStores.find(s => s.id === filters.storeId)?.name}
                </Text>
                <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, storeId: undefined }))}>
                  <Ionicons name="close-circle" size={16} color={palette.danger} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Liste des commandes */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={styles.loadingText}>Chargement de vos commandes...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={palette.textMuted} />
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
                <Ionicons name="close" size={24} color={palette.text} />
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
                <Text style={styles.modalTitle}>Détails de la commande</Text>
                <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                  <Ionicons name="close" size={24} color={palette.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                <View style={styles.detailTotals}>
                  {(() => {
                    const amt = computeAmounts(selectedOrder as OrderWithDetails | null);
                    return (
                      <>
                        <View style={{flex: 1}}>
                          <Text style={styles.subtotalLabel}>Sous-total</Text>
                          <Text style={styles.subtotalValue}>{amt.subtotal.toLocaleString()} FCA</Text>
                          {amt.delivery ? <Text style={styles.detailSmall}>Livraison: {amt.delivery.toLocaleString()} FCA</Text> : null}
                          {amt.tax ? <Text style={styles.detailSmall}>TVA: {amt.tax.toLocaleString()} FCA</Text> : null}
                        </View>
                        <View style={{alignItems: 'flex-end'}}>
                          <Text style={styles.totalLabel}>Total</Text>
                          <Text style={styles.totalAmount}>{amt.total.toLocaleString()} FCA</Text>
                        </View>
                      </>
                    );
                  })()}
                </View>

                {/* Timeline / étapes */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Étapes de la commande</Text>
                  {computeOrderSteps(selectedOrder).map(step => (
                    <View key={step.key} style={styles.stepRow}>
                      <View style={[styles.stepBullet, step.done && { backgroundColor: palette.accent }]} />
                      <View style={styles.stepTextWrap}>
                        <Text style={[styles.stepLabel, step.done ? { color: palette.text } : { color: palette.textMuted }]}>{step.label}</Text>
                        {step.date ? <Text style={styles.stepDate}>{formatDate(step.date)}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Boutique</Text>
                  <Text style={styles.detailText}>{selectedOrder.store?.name}</Text>
                  {selectedOrder.store?.phone && (
                    <Text style={styles.detailText}>{selectedOrder.store.phone}</Text>
                  )}
                </View>

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

                {/* Total détail */}
                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Sous-total:</Text>
                    <Text style={styles.detailValue}>{computeAmounts(selectedOrder).subtotal.toLocaleString()} FCA</Text>
                  </View>
                  {computeAmounts(selectedOrder).delivery ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Livraison:</Text>
                      <Text style={styles.detailValue}>{computeAmounts(selectedOrder).delivery.toLocaleString()} FCA</Text>
                    </View>
                  ) : null}
                  {computeAmounts(selectedOrder).tax ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>TVA:</Text>
                      <Text style={styles.detailValue}>{computeAmounts(selectedOrder).tax.toLocaleString()} FCA</Text>
                    </View>
                  ) : null}
                  <View style={[styles.detailRow, styles.totalRow]}>
                    <Text style={styles.detailTotalLabel}>Total:</Text>
                    <Text style={styles.detailTotalValue}>{computeAmounts(selectedOrder).total.toLocaleString()} FCA</Text>
                  </View>
                </View>
              </ScrollView>

              <View style={{padding: SPACING.lg, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: 'row', gap: SPACING.sm}}>
                {/* Seller/admin: accept payment button */}
                {(user && (user.role === 'seller' || user.role === 'admin') && selectedOrder && selectedOrder.payment_status !== 'paid' && (user.role === 'admin' || selectedOrder.store?.user_id === user.id)) && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.receivedButton]}
                    onPress={() => {
                      setSelectedOrder(null);
                      acceptPayment(selectedOrder.id);
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={palette.text} />
                    <Text style={styles.actionButtonText}>Accepter la commande</Text>
                  </TouchableOpacity>
                )}

                {selectedOrder && (selectedOrder.status === 'pending' || selectedOrder.status === 'paid') && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => {
                      setSelectedOrder(null);
                      confirmCancel(selectedOrder);
                    }}
                  >
                    <Ionicons name="close-circle" size={18} color={palette.text} />
                    <Text style={styles.actionButtonText}>Annuler la commande</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionButton, styles.detailsButton]} onPress={() => setSelectedOrder(null)}>
                  <Ionicons name="arrow-back" size={18} color={palette.accent} />
                  <Text style={[styles.actionButtonText, { color: palette.accent }]}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

// Styles
function createClientOrdersStyles(palette: LegacyPalette, SPACING: any, RADIUS: any, FONT_SIZE: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: palette.text,
  },
  filterButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: palette.accent + '10',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.lg,
    backgroundColor: palette.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchIcon: {
    marginRight: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: palette.text,
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
    color: palette.textMuted,
    marginRight: SPACING.sm,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.accent + '10',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
  },
  activeFilterText: {
    fontSize: FONT_SIZE.sm,
    color: palette.accent,
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
    color: palette.textMuted,
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
    color: palette.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  ordersList: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  orderCard: {
    backgroundColor: palette.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: palette.border,
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
    color: palette.text,
    marginBottom: SPACING.xs,
  },
  orderDate: {
    fontSize: FONT_SIZE.sm,
    color: palette.textMuted,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: palette.text,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  storeName: {
    fontSize: FONT_SIZE.sm,
    color: palette.textMuted,
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
    color: palette.text,
    marginRight: SPACING.sm,
  },
  productQuantity: {
    fontSize: FONT_SIZE.sm,
    color: palette.textMuted,
    fontWeight: '500',
  },
  moreProducts: {
    fontSize: FONT_SIZE.sm,
    color: palette.accent,
    fontStyle: 'italic',
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  totalLabel: {
    fontSize: FONT_SIZE.sm,
    color: palette.textMuted,
  },
  totalAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: palette.accent,
  },
  storeInline: {
    fontSize: FONT_SIZE.sm,
    color: palette.textMuted,
    marginTop: SPACING.xs,
    maxWidth: 220,
  },
  subtotalLabel: {
    fontSize: FONT_SIZE.sm,
    color: palette.textMuted,
  },
  subtotalValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: palette.text,
  },
  detailSmall: {
    fontSize: FONT_SIZE.sm,
    color: palette.textMuted,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  stepBullet: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: palette.border,
    marginRight: SPACING.md,
  },
  stepTextWrap: {
    flex: 1,
  },
  stepLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  stepDate: {
    fontSize: FONT_SIZE.xs,
    color: palette.textMuted,
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
    backgroundColor: palette.success,
  },
  contactButton: {
    backgroundColor: 'palette.whatsapp',
  },
  detailsButton: {
    backgroundColor: palette.accent + '10',
    borderWidth: 1,
    borderColor: palette.accent,
  },
  cancelButton: {
    backgroundColor: palette.danger,
    borderWidth: 1,
    borderColor: palette.danger,
  },
  actionButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: palette.text,
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
    backgroundColor: palette.card,
    borderRadius: RADIUS.xl,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  detailsModal: {
    backgroundColor: palette.card,
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
    borderBottomColor: palette.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: palette.text,
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
    color: palette.text,
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
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterOptionSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  filterOptionText: {
    fontSize: FONT_SIZE.sm,
    color: palette.text,
  },
  filterOptionTextSelected: {
    color: palette.text,
  },
  detailSection: {
    marginBottom: SPACING.lg,
  },
  detailSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: palette.text,
    marginBottom: SPACING.md,
  },
  detailText: {
    fontSize: FONT_SIZE.md,
    color: palette.text,
    marginBottom: SPACING.sm,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  detailProductName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: palette.text,
  },
  detailProductPrice: {
    fontSize: FONT_SIZE.sm,
    color: palette.textMuted,
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
    color: palette.textMuted,
  },
  detailValue: {
    fontSize: FONT_SIZE.sm,
    color: palette.text,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: palette.accent,
    paddingTop: SPACING.md,
    marginTop: SPACING.sm,
  },
  detailTotalLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: palette.text,
  },
  detailTotalValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: palette.accent,
  },
});
}


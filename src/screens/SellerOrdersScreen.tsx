import React, { useState, useMemo } from 'react';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { orderService, storeService } from '../lib/supabase';
import { exportOrdersToPDF, exportOrderToPDF } from '../utils/pdfExport';
import { OrderCardSkeleton } from '../components/SkeletonLoader';

// Types
interface OrderItem {
  name: string;
  quantity?: number;
  price?: number;
}

interface Order {
  id: string;
  customer: string;
  phone: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  date: string;
  paymentMethod: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  deliveryAddress?: string;
}

const formatTimeAgo = (isoDate?: string) => {
  if (!isoDate) return '';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hier';
  return `Il y a ${diffDays}j`;
};

const FILTERS = [
  { id: 'all', label: 'Tous', icon: 'apps-outline' },
  { id: 'pending', label: 'En attente', icon: 'time-outline' },
  { id: 'paid', label: 'Payées', icon: 'checkmark-circle-outline' },
  { id: 'shipped', label: 'Expédiées', icon: 'cube-outline' },
  { id: 'delivered', label: 'Livrées', icon: 'checkmark-done-outline' },
  { id: 'cancelled', label: 'Annulées', icon: 'close-circle-outline' },
];

const getStatusColor = (status: Order['status']) => {
  switch (status) {
    case 'pending': return COLORS.warning;
    case 'paid': return COLORS.accent;
    case 'shipped': return COLORS.accent2;
    case 'delivered': return COLORS.success;
    case 'cancelled': return COLORS.danger;
    default: return COLORS.textMuted;
  }
};

const getStatusLabel = (status: Order['status']) => {
  switch (status) {
    case 'pending': return 'En attente';
    case 'paid': return 'Payée';
    case 'shipped': return 'Expédiée';
    case 'delivered': return 'Livrée';
    case 'cancelled': return 'Annulée';
    default: return status;
  }
};

const getPaymentStatusColor = (status?: Order['paymentStatus']) => {
  switch (status) {
    case 'paid': return COLORS.success;
    case 'pending': return COLORS.warning;
    case 'failed': return COLORS.danger;
    default: return COLORS.textMuted;
  }
};

const getPaymentStatusLabel = (status?: Order['paymentStatus']) => {
  switch (status) {
    case 'paid': return 'Payée';
    case 'pending': return 'En attente';
    case 'failed': return 'Échouée';
    default: return 'N/A';
  }
};

export const SellerOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { 
    spacing, 
    fontSize, 
    component, 
    isMobile, 
    isTablet, 
    isDesktop,
    width 
  } = useResponsive();
  
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedFilter, setSelectedFilter] = React.useState('all');
  const [sortBy, setSortBy] = React.useState<'date' | 'total'>('date');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [storeId, setStoreId] = React.useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);
  
  // 🚀 États pour la pagination optimisée
  const [hasMore, setHasMore] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);

  const filtersWithCounts = useMemo(() => {
    return FILTERS.map((filter) => {
      const count =
        filter.id === 'all'
          ? orders.length
          : orders.filter((o) => o.status === filter.id).length;
      return { ...filter, count };
    });
  }, [orders]);

  // 🚀 Fonction de chargement optimisée avec cursor pagination
  const loadOrders = React.useCallback(async (reset = true) => {
    if (!user?.id) {
      console.log('❌ Aucun utilisateur connecté');
      return;
    }
    
    try {
      console.log('🔄 Début du chargement optimisé...');
      
      if (reset) {
        setLoading(true);
        setOrders([]);
        setHasMore(true);
        setNextCursor(null);
        setIsInitialLoad(true);
      } else {
        setLoadingMore(true);
      }
      
      const store = await storeService.getByUser(user.id);
      if (!store?.id) {
        console.log('❌ Aucune boutique trouvée pour l\'utilisateur:', user.id);
        setStoreId(null);
        setOrders([]);
        setHasMore(false);
        return;
      }
      
      console.log('🏪 Boutique trouvée:', store.id);
      setStoreId(store.id);

      // 🎯 Requête optimisée avec cursor et filtres
      const result = await orderService.getByStore(store.id, {
        limit: 20,
        cursor: reset ? undefined : nextCursor,
        status: selectedFilter !== 'all' ? selectedFilter : undefined,
        search: searchQuery || undefined,
      });

      console.log(`📦 Données reçues: ${result.count} commandes, hasMore: ${result.hasMore}`);
      
      if (!result.orders || result.orders.length === 0) {
        console.log('📭 Plus de commandes disponibles');
        setHasMore(false);
        return;
      }

      // 🔄 Mapping optimisé
      const mapped: Order[] = result.orders.map((o: any) => {
        const items = Array.isArray(o.order_items)
          ? o.order_items.map((it: any) => ({
              name: String(it?.products?.name || 'Article'),
              quantity: Number(it?.quantity || 0),
              price: Number(it?.price || 0),
            }))
          : [];

        const customerName = String(o?.customer_name || o?.users?.full_name || '').trim();
        const customerPhone = String(o?.customer_phone || o?.users?.phone || '').trim();

        return {
          id: String(o.id),
          customer: customerName || (customerPhone ? customerPhone : 'Client'),
          phone: customerPhone,
          items,
          total: Number(o.total_amount || 0),
          status: o.status,
          date: formatTimeAgo(o.created_at),
          paymentMethod: String(o.payment_method || ''),
          paymentStatus: o.payment_status,
          deliveryAddress: o.shipping_address,
        };
      });

      console.log('📊 Commandes mappées:', mapped.length);

      // 🚀 Mise à jour optimisée de l'état
      if (reset) {
        setOrders(mapped);
      } else {
        setOrders(prev => [...prev, ...mapped]);
      }

      // 🔄 Mise à jour du curseur et hasMore
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
      setIsInitialLoad(false);
      
      if (!result.hasMore) {
        console.log('📭 Toutes les commandes ont été chargées');
      }
      
    } catch (e: any) {
      console.error('❌ Erreur lors du chargement des commandes:', e);
      errorHandler.handleDatabaseError(e, 'Error loading orders:');
      setOrders([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      console.log('🏁 Fin du chargement optimisé');
    }
  }, [user?.id, nextCursor, selectedFilter, searchQuery]);

  // 🚀 Chargement infini optimisé
  const loadMoreOrders = async () => {
    if (!hasMore || loadingMore || loading || isInitialLoad) return;
    console.log('🔄 Chargement infini de plus de commandes...');
    await loadOrders(false);
  };

  // 🔄 Refresh manuel optimisé
  const onRefresh = React.useCallback(() => {
    console.log('🔄 Refresh manuel déclenché');
    setRefreshing(true);
    loadOrders(true);
  }, [loadOrders]);

  // 🎯 Recherche optimisée avec debounce
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.log('🔍 Recherche optimisée pour:', searchQuery);
      loadOrders(true);
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // 🎯 Filtre optimisé
  React.useEffect(() => {
    console.log('🎯 Filtre changé vers:', selectedFilter);
    loadOrders(true);
  }, [selectedFilter]);

  // 🚀 Chargement initial
  React.useEffect(() => {
    console.log('🚀 Chargement initial de la page');
    loadOrders();
  }, []);

  // 🚀 Plus besoin de filtrage local - tout est géré par le backend optimisé !
  const filteredOrders = orders;

  const stats = useMemo(() => ({
    total: orders.reduce((sum, order) => sum + order.total, 0),
    pending: orders.filter((o) => o.status === 'pending').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  }), [orders]);

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    console.log('=== DÉBUT DEBUG ===');
    console.log('handleStatusChange appelé avec:', { orderId, newStatus });
    
    const actionText = newStatus === 'cancelled' ? 'annuler' : 
                     newStatus === 'paid' ? 'accepter' : 
                     newStatus === 'shipped' ? 'marquer comme expédiée' : 
                     newStatus === 'delivered' ? 'marquer comme livrée' : 'mettre à jour';
    
    console.log('actionText:', actionText);
    console.log('🔥 EXÉCUTION DIRECTE SANS CONFIRMATION');
    
    try {
      console.log('1️⃣ setUpdatingOrderId...');
      setUpdatingOrderId(orderId);
      
      // 🚀 Mise à jour optimisée après changement de statut
      if (newStatus === 'cancelled') {
        // Suppression optimiste
        setOrders(prev => prev.filter(order => order.id !== orderId));
      } else {
        // Mise à jour optimiste
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        ));
      }
      
      await orderService.updateStatus(orderId, newStatus);
      Alert.alert('Succès', `Commande ${actionText} avec succès`);
      
      // 🚀 Pas de rechargement complet - juste une mise à jour locale optimisée
      console.log('✅ Mise à jour locale effectuée, pas de rechargement réseau');
      
    } catch (e: any) {
      console.error('❌ ERREUR CAPTURÉE:', e);
      // En cas d'erreur, on recharge juste les données nécessaires
      await loadOrders(true);
      Alert.alert('Erreur', `Impossible de ${actionText} la commande: ${e?.message || 'Erreur inconnue'}`);
    } finally {
      setUpdatingOrderId(null);
      console.log('=== FIN ACTION ===');
    }
    
    console.log('=== FIN DEBUG ===');
  };

  const handleContactCustomer = (phone: string, customer: string, total: number) => {
    const formattedPhone = phone.replace(/[^0-9+]/g, '');
    const message = `Bonjour ${customer}, concernant votre commande de ${total.toLocaleString()} FCFA sur LibreShop.`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Alert.alert('Contacter', `Appeler le ${phone}`);
    }).catch(() => {
      Alert.alert('Contacter', `Appeler le ${phone}`);
    });
  };

  // Export toutes les commandes en PDF
  const handleExportAllOrders = async () => {
    if (orders.length === 0) {
      Alert.alert('Info', 'Aucune commande à exporter');
      return;
    }
    
    const ordersData = orders.map(o => ({
      id: o.id,
      customerName: o.customer,
      customerPhone: o.phone,
      shippingAddress: o.deliveryAddress,
      items: o.items.map(it => ({ name: it.name, quantity: it.quantity || 1, price: it.price || 0 })),
      totalAmount: o.total,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus || 'pending',
      status: o.status,
      createdAt: o.date,
    }));
    
    await exportOrdersToPDF(ordersData, 'Liste des commandes - LibreShop');
  };

  // Export une commande en PDF
  const handleExportOrder = async (order: Order) => {
    const orderData = {
      id: order.id,
      customerName: order.customer,
      customerPhone: order.phone,
      shippingAddress: order.deliveryAddress,
      items: order.items.map(it => ({ name: it.name, quantity: it.quantity || 1, price: it.price || 0 })),
      totalAmount: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus || 'pending',
      status: order.status,
      createdAt: order.date,
    };
    
    await exportOrderToPDF(orderData);
  };

  const renderOrder = (order: Order) => {
    const statusColor = getStatusColor(order.status);
    const paymentStatusColor = getPaymentStatusColor(order.paymentStatus);

    return (
      <TouchableOpacity 
        key={order.id} 
        style={[
          styles.orderCard,
          {
            padding: spacing.lg,
            marginBottom: spacing.md,
            backgroundColor: COLORS.card,
            borderRadius: component.cardBorderRadius,
          }
        ]}
        onPress={() => navigation.navigate('SellerOrderDetail', { orderId: order.id })}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={[statusColor + '10', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.orderGradient}
        />

        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={[styles.orderId, { fontSize: fontSize.sm }]}>
              {order.id}
            </Text>
            <View style={styles.orderDate}>
              <Ionicons name="time-outline" size={fontSize.xs} color={COLORS.textMuted} />
              <Text style={[styles.dateText, { fontSize: fontSize.xs }]}>
                {order.date}
              </Text>
            </View>
          </View>
          
          <View style={[
            styles.statusBadge,
            { backgroundColor: statusColor + '20' }
          ]}>
            <Ionicons 
              name={
                order.status === 'pending' ? 'time' :
                order.status === 'paid' ? 'checkmark-circle' :
                order.status === 'shipped' ? 'cube' :
                order.status === 'delivered' ? 'checkmark-done' : 'close-circle'
              } 
              size={fontSize.xs} 
              color={statusColor} 
            />
            <Text style={[
              styles.statusText,
              { fontSize: fontSize.xs, color: statusColor }
            ]}>
              {getStatusLabel(order.status)}
            </Text>
          </View>
        </View>

        <View style={styles.customerSection}>
          <View style={styles.customerInfo}>
            <View style={[
              styles.customerAvatar,
              { backgroundColor: statusColor + '30' }
            ]}>
              <Text style={[styles.avatarText, { fontSize: fontSize.md }]}>
                {order.customer.split(' ').map((n: string) => n[0]).join('')}
              </Text>
            </View>
            
            <View style={styles.customerDetails}>
              <Text style={[styles.customerName, { fontSize: fontSize.md }]}>
                {order.customer}
              </Text>
              <TouchableOpacity 
                style={styles.phoneRow}
                onPress={() => handleContactCustomer(order.phone, order.customer, order.total)}
              >
                <Ionicons name="logo-whatsapp" size={fontSize.sm} color={COLORS.success} />
                <Text style={[styles.phoneText, { fontSize: fontSize.sm }]}>
                  {order.phone}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[
            styles.paymentBadge,
            { backgroundColor: paymentStatusColor + '20' }
          ]}>
            <Ionicons 
              name={order.paymentStatus === 'paid' ? 'cash' : 'alert-circle'} 
              size={fontSize.xs} 
              color={paymentStatusColor} 
            />
            <Text style={[
              styles.paymentText,
              { fontSize: fontSize.xs, color: paymentStatusColor }
            ]}>
              {getPaymentStatusLabel(order.paymentStatus)}
            </Text>
          </View>
        </View>

        <View style={styles.itemsSection}>
          <Text style={[styles.itemsTitle, { fontSize: fontSize.sm }]}>
            Articles ({order.items.length})
          </Text>
          <View style={styles.itemsList}>
            {order.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={[styles.itemName, { fontSize: fontSize.sm }]}>
                  • {item.name}
                </Text>
                {item.quantity && item.quantity > 1 && (
                  <Text style={[styles.itemQuantity, { fontSize: fontSize.xs }]}>
                    x{item.quantity}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.paymentMethod}>
            <Ionicons 
              name={order.paymentMethod === 'Mobile Money' ? 'phone-portrait' : 'cash'} 
              size={fontSize.sm} 
              color={COLORS.textMuted} 
            />
            <Text style={[styles.paymentMethodText, { fontSize: fontSize.xs }]}>
              {order.paymentMethod}
            </Text>
          </View>
          
          <Text style={[styles.totalValue, { fontSize: fontSize.lg }]}>
            {order.total?.toLocaleString() || '0'} FCA
          </Text>
        </View>

        {/* Actions pour les commandes en attente */}
        {order.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => {
                console.log('🔥 BOUTON SUPPRIMER CLIQUÉ');
                console.log('🔥 order.id:', order.id);
                handleStatusChange(order.id, 'cancelled');
              }}
              disabled={updatingOrderId === order.id}
            >
              {updatingOrderId === order.id ? (
                <Text style={[styles.rejectButtonText, { fontSize: fontSize.sm }]}>
                  Traitement...
                </Text>
              ) : (
                <>
                  <Ionicons name="trash" size={fontSize.md} color={COLORS.danger} />
                  <Text style={[styles.rejectButtonText, { fontSize: fontSize.sm }]}>
                    Supprimer
                  </Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => {
                console.log('🔥 BOUTON ACCEPTER CLIQUÉ');
                console.log('🔥 order.id:', order.id);
                handleStatusChange(order.id, 'paid');
              }}
              disabled={updatingOrderId === order.id}
            >
              {updatingOrderId === order.id ? (
                <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>
                  Traitement...
                </Text>
              ) : (
                <>
                  <LinearGradient
                    colors={[COLORS.accent, COLORS.accent2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.confirmGradient}
                  />
                  <Ionicons name="checkmark-circle" size={fontSize.md} color={COLORS.text} />
                  <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>
                    Accepter
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Actions pour les commandes expédiées */}
        {order.status === 'paid' && (
          <TouchableOpacity 
            style={[styles.shippedButton]}
            onPress={() => handleStatusChange(order.id, 'shipped')}
          >
            <Ionicons name="cube" size={fontSize.md} color={COLORS.accent} />
            <Text style={[styles.shippedButtonText, { fontSize: fontSize.sm }]}>
              Marquer comme expédiée
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
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
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: fontSize.titleLarge,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: spacing.xs,
    },
    headerStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    statBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: COLORS.card,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    statText: {
      color: COLORS.textSoft,
    },
    statValue: {
      fontWeight: '600',
      color: COLORS.accent,
    },
    headerRight: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    headerButton: {
      width: component.buttonHeight,
      height: component.buttonHeight,
      borderRadius: component.buttonHeight / 2,
      backgroundColor: COLORS.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchContainer: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.card,
      borderRadius: component.inputBorderRadius,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: spacing.sm,
    },
    searchInput: {
      flex: 1,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: COLORS.text,
    },
    filtersWrapper: {
      marginBottom: spacing.lg,
    },
    filtersContainer: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    filterChipActive: {
      backgroundColor: COLORS.accent,
      borderColor: COLORS.accent,
    },
    filterText: {
      fontSize: fontSize.sm,
      color: COLORS.text,
      fontWeight: '500',
    },
    filterTextActive: {
      color: COLORS.text,
    },
    filterCount: {
      fontSize: fontSize.xs,
      color: COLORS.textMuted,
      marginLeft: 4,
    },
    filterCountActive: {
      color: COLORS.text + 'CC',
    },
    sortBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    sortButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    sortButtonActive: {
      backgroundColor: COLORS.accent + '10',
      borderColor: COLORS.accent,
    },
    sortButtonText: {
      fontSize: fontSize.xs,
      color: COLORS.text,
    },
    sortButtonTextActive: {
      color: COLORS.accent,
      fontWeight: '500',
    },
    ordersContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    loadingMoreContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    loadingMoreText: {
      color: COLORS.textMuted,
      fontSize: fontSize.sm,
    },
    orderCard: {
      borderWidth: 1,
      borderColor: COLORS.border,
      position: 'relative',
      overflow: 'hidden',
    },
    orderGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    orderHeaderLeft: {
      flex: 1,
    },
    orderId: {
      color: COLORS.textSoft,
      fontWeight: '500',
      marginBottom: 2,
    },
    orderDate: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    dateText: {
      color: COLORS.textMuted,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: RADIUS.full,
      gap: 4,
    },
    statusText: {
      fontWeight: '600',
    },
    customerSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    customerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    customerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontWeight: '600',
      color: COLORS.text,
    },
    customerDetails: {
      flex: 1,
    },
    customerName: {
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: 2,
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    phoneText: {
      color: COLORS.textMuted,
    },
    paymentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.full,
      gap: 4,
    },
    paymentText: {
      fontWeight: '500',
    },
    itemsSection: {
      marginBottom: spacing.md,
    },
    itemsTitle: {
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: spacing.xs,
    },
    itemsList: {
      gap: 2,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    itemName: {
      color: COLORS.textSoft,
      flex: 1,
    },
    itemQuantity: {
      color: COLORS.textMuted,
      marginLeft: spacing.sm,
    },
    orderFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    paymentMethod: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    paymentMethodText: {
      color: COLORS.textMuted,
    },
    totalValue: {
      fontWeight: '700',
      color: COLORS.accent2,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: RADIUS.md,
      position: 'relative',
      overflow: 'hidden',
    },
    rejectButton: {
      backgroundColor: COLORS.danger + '10',
      borderWidth: 1,
      borderColor: COLORS.danger,
    },
    rejectButtonText: {
      color: COLORS.danger,
      fontWeight: '500',
    },
    confirmButton: {
      backgroundColor: COLORS.accent,
    },
    confirmGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    confirmButtonText: {
      color: COLORS.text,
      fontWeight: '500',
    },
    shippedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: RADIUS.md,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      backgroundColor: COLORS.accent + '10',
    },
    shippedButtonText: {
      color: COLORS.accent,
      fontWeight: '500',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxxl,
    },
    emptyStateIcon: {
      marginBottom: spacing.lg,
    },
    emptyStateTitle: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: spacing.sm,
    },
    emptyStateText: {
      fontSize: fontSize.md,
      color: COLORS.textSoft,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    emptyStateButton: {
      backgroundColor: COLORS.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: RADIUS.lg,
    },
    emptyStateButtonText: {
      color: COLORS.text,
      fontWeight: '600',
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      {/* Header avec stats */}
      <LinearGradient
        colors={[COLORS.accent + '10', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Commandes</Text>
            <View style={styles.headerStats}>
              <View style={styles.statBadge}>
                <Ionicons name="cart" size={fontSize.xs} color={COLORS.accent} />
                <Text style={[styles.statText, { fontSize: fontSize.xs }]}>
                  Total: <Text style={styles.statValue}>{stats.total?.toLocaleString() || '0'} F</Text>
                </Text>
              </View>
              {stats.pending > 0 && (
                <View style={[styles.statBadge, { backgroundColor: COLORS.warning + '10' }]}>
                  <Ionicons name="time" size={fontSize.xs} color={COLORS.warning} />
                  <Text style={[styles.statText, { fontSize: fontSize.xs }]}>
                    <Text style={{ color: COLORS.warning }}>{stats.pending}</Text> en attente
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: COLORS.card }]}
              onPress={handleExportAllOrders}
            >
              <Ionicons name="document-text-outline" size={fontSize.lg} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: COLORS.card }]}
              onPress={() => {/* Ouvrir filtres avancés */}}
            >
              <Ionicons name="options-outline" size={fontSize.lg} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.navigate('SellerCaisse')}
            >
              <Ionicons name="add" size={fontSize.lg} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={fontSize.md} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher commande, client..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={fontSize.md} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filtres horizontaux */}
      <View style={styles.filtersWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {filtersWithCounts.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                selectedFilter === filter.id && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFilter(filter.id)}
            >
              <Ionicons 
                name={filter.icon as any} 
                size={fontSize.sm} 
                color={selectedFilter === filter.id ? COLORS.text : COLORS.textMuted} 
              />
              <Text style={[
                styles.filterText,
                selectedFilter === filter.id && styles.filterTextActive,
              ]}>
                {filter.label}
              </Text>
              {filter.count > 0 && (
                <Text style={[
                  styles.filterCount,
                  selectedFilter === filter.id && styles.filterCountActive,
                ]}>
                  ({filter.count})
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Barre de tri */}
      <View style={styles.sortBar}>
        <Text style={[styles.filterText, { color: COLORS.textSoft }]}>
          {filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''}
        </Text>
        
        <View style={styles.sortButtons}>
          <TouchableOpacity 
            style={[
              styles.sortButton,
              sortBy === 'date' && styles.sortButtonActive
            ]}
            onPress={() => {
              if (sortBy === 'date') {
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              } else {
                setSortBy('date');
                setSortOrder('desc');
              }
            }}
          >
            <Ionicons 
              name="calendar" 
              size={fontSize.xs} 
              color={sortBy === 'date' ? COLORS.accent : COLORS.textMuted} 
            />
            <Text style={[
              styles.sortButtonText,
              sortBy === 'date' && styles.sortButtonTextActive
            ]}>
              Date
            </Text>
            {sortBy === 'date' && (
              <Ionicons 
                name={sortOrder === 'desc' ? 'chevron-down' : 'chevron-up'} 
                size={fontSize.xs} 
                color={COLORS.accent} 
              />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.sortButton,
              sortBy === 'total' && styles.sortButtonActive
            ]}
            onPress={() => {
              if (sortBy === 'total') {
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              } else {
                setSortBy('total');
                setSortOrder('desc');
              }
            }}
          >
            <Ionicons 
              name="cash" 
              size={fontSize.xs} 
              color={sortBy === 'total' ? COLORS.accent : COLORS.textMuted} 
            />
            <Text style={[
              styles.sortButtonText,
              sortBy === 'total' && styles.sortButtonTextActive
            ]}>
              Montant
            </Text>
            {sortBy === 'total' && (
              <Ionicons 
                name={sortOrder === 'desc' ? 'chevron-down' : 'chevron-up'} 
                size={fontSize.xs} 
                color={COLORS.accent} 
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={({ item }) => renderOrder(item)}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={loadMoreOrders}
        onEndReachedThreshold={0.3}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        ListFooterComponent={
          <View>
            {loadingMore && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingMoreText}>Chargement...</Text>
              </View>
            )}
            {!loadingMore && hasMore && (
              <View style={styles.loadingMoreContainer}>
                <Text style={styles.loadingMoreText}>Tirez pour charger plus</Text>
              </View>
            )}
            {!hasMore && orders.length > 0 && (
              <View style={styles.loadingMoreContainer}>
                <Text style={styles.loadingMoreText}>
                  📭 Toutes les commandes sont chargées ({orders.length})
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.ordersContainer}>
              {[1, 2, 3].map((i) => (
                <OrderCardSkeleton key={i} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={80} color={COLORS.textMuted} style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateTitle}>Aucune commande</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery 
                  ? "Aucune commande ne correspond à votre recherche"
                  : "Vous n'avez pas encore de commandes dans cette catégorie"}
              </Text>
              <TouchableOpacity 
                style={styles.emptyStateButton}
                onPress={() => navigation.navigate('SellerCaisse')}
              >
                <Text style={styles.emptyStateButtonText}>Nouvelle commande</Text>
              </TouchableOpacity>
            </View>
          )
        }
        contentContainerStyle={[
          styles.ordersContainer,
          orders.length === 0 && { flex: 1 }
        ]}
      />
    </View>
  );
};
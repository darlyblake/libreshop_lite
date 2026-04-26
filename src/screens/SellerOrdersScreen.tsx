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
import { orderService } from '../services/orderService';
import { storeService } from '../services/storeService';
import { contactStore } from '../services/contactService';
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
  status: 'pending' | 'accepted' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  date: string;
  paymentMethod: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  deliveryAddress?: string;
  isoDate?: string;
}

const formatTimeAgo = (isoDate?: string) => {
  if (!isoDate) return '';
  const dateObj = new Date(isoDate);
  const diffMs = Date.now() - dateObj.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hier';
  if (diffDays >= 5) {
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }
  return `Il y a ${diffDays}j`;
};

const FILTERS = [
  { id: 'all', label: 'Tous', icon: 'apps-outline' },
  { id: 'pending', label: 'En attente', icon: 'time-outline' },
  { id: 'accepted', label: 'Acceptées', icon: 'checkbox-outline' },
  { id: 'paid', label: 'Payées', icon: 'checkmark-circle-outline' },
  { id: 'shipped', label: 'Expédiées', icon: 'cube-outline' },
  { id: 'delivered', label: 'Livrées', icon: 'checkmark-done-outline' },
  { id: 'cancelled', label: 'Annulées', icon: 'close-circle-outline' },
];

const getStatusColor = (status: Order['status']) => {
  switch (status) {
    case 'pending': return COLORS.warning;
    case 'accepted': return COLORS.accent;
    case 'paid': return COLORS.accent2;
    case 'shipped': return COLORS.primary;
    case 'delivered': return COLORS.success;
    case 'cancelled': return COLORS.danger;
    case 'refunded': return COLORS.textMuted;
    default: return COLORS.textMuted;
  }
};

const getStatusLabel = (status: Order['status']) => {
  switch (status) {
    case 'pending': return 'En attente';
    case 'accepted': return 'Acceptée';
    case 'paid': return 'Payée';
    case 'shipped': return 'Expédiée';
    case 'delivered': return 'Livrée';
    case 'cancelled': return 'Annulée';
    case 'refunded': return 'Remboursée';
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
  const [storeName, setStoreName] = React.useState<string | null>(null);
  const [summaryCounts, setSummaryCounts] = React.useState<{ total: number; pending: number }>({ total: 0, pending: 0 });
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

      return;
    }
    
    try {

      
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

        setStoreId(null);
        setOrders([]);
        setHasMore(false);
        return;
      }
      

      setStoreId(store.id);
      setStoreName(store.name || null);

      // Charger les comptes agrégés (total commandes, en attente)
      orderService.getCountsByStore(store.id).then(cnt => {
        if (cnt) setSummaryCounts({ total: cnt.total || 0, pending: cnt.pending || 0 });
      }).catch(() => {
        setSummaryCounts({ total: 0, pending: 0 });
      });

      // 🎯 Requête optimisée avec cursor et filtres
      const result = await orderService.getByStore(store.id, {
        limit: 20,
        cursor: (reset ? undefined : nextCursor) || undefined,
        status: selectedFilter !== 'all' ? selectedFilter : undefined,
        search: searchQuery || undefined,
      });


      
      if (!result.orders || result.orders.length === 0) {

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
          isoDate: o.created_at,
        };
      });



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

    }
  }, [user?.id, nextCursor, selectedFilter, searchQuery]);

  // 🚀 Chargement infini optimisé
  const loadMoreOrders = async () => {
    if (!hasMore || loadingMore || loading || isInitialLoad) return;

    await loadOrders(false);
  };

  // 🔄 Refresh manuel optimisé
  const onRefresh = React.useCallback(() => {

    setRefreshing(true);
    loadOrders(true);
  }, [loadOrders]);

  // 🎯 Recherche optimisée avec debounce
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {

      loadOrders(true);
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // 🎯 Filtre optimisé
  React.useEffect(() => {

    loadOrders(true);
  }, [selectedFilter]);

  // 🚀 Chargement initial
  React.useEffect(() => {

    loadOrders();
  }, []);

  // 🚀 Plus besoin de filtrage local - tout est géré par le backend optimisé !
  const filteredOrders = orders;

  const stats = useMemo(() => ({
    total: orders.reduce((sum, order) => sum + order.total, 0),
    pending: orders.filter((o) => o.status === 'pending').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  }), [orders]);

  const delayedOrdersCount = useMemo(() => {
    return orders.filter(o => {
      if (!o.isoDate) return false;
      if (['delivered', 'cancelled', 'refunded', 'pending'].includes(o.status)) return false;
      const daysOld = (Date.now() - new Date(o.isoDate).getTime()) / (1000 * 60 * 60 * 24);
      return daysOld >= 2;
    }).length;
  }, [orders]);

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    
    const actionText = newStatus === 'cancelled' ? 'annuler' : 
                     newStatus === 'paid' ? 'accepter' : 
                     newStatus === 'shipped' ? 'marquer comme expédiée' : 
                     newStatus === 'delivered' ? 'marquer comme livrée' : 'mettre à jour';
    
    try {
      setUpdatingOrderId(orderId);
      
      let res;
      if (newStatus === 'cancelled') {
        res = await orderService.cancelOrderRobust(orderId);
        setOrders(prev => prev.filter(order => order.id !== orderId));
      } else if (newStatus === 'accepted') {
        res = await orderService.acceptOrder(orderId, false);
        setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: 'accepted' } : order));
      } else if (newStatus === 'paid') {
        res = await orderService.confirmOrderPayment(orderId);
        setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: 'paid', paymentStatus: 'paid' } : order));
      } else {
        res = await orderService.updateStatus(orderId, newStatus);
        setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
      }
      
      // 🚀 Pas de rechargement complet - juste une mise à jour locale optimisée
      
    } catch (e: any) {
      console.error('❌ ERREUR CAPTURÉE:', e);
      // En cas d'erreur, on recharge juste les données nécessaires
      await loadOrders(true);
      Alert.alert('Erreur', `Impossible de ${actionText} la commande: ${e?.message || 'Erreur inconnue'}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleContactCustomer = (order: Order) => {
    const formattedPhone = order.phone.replace(/[^0-9+]/g, '');
    const itemsList = order.items.map(item => `- ${item.name} (x${item.quantity || 1})`).join('\n');
    const storeText = storeName ? `la boutique ${storeName} sur Libreshop` : `Libreshop`;
    
    const message = `Bonjour, je suis le vendeur de ${storeText}.
Je vous contacte concernant votre commande #${order.id.slice(0, 8).toUpperCase()}.

Produits :
${itemsList}

Pouvez-vous me confirmer votre disponibilité pour la livraison ?
Merci.`;
    
    contactStore({ rawPhone: formattedPhone, message }).catch(() => {
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
      <View 
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
      >
        <TouchableOpacity 
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
                #{order.id.slice(0, 8).toUpperCase()}
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
                  order.status === 'accepted' ? 'checkbox' :
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
                  {order.customer.charAt(0)}
                </Text>
              </View>
              
              <View style={styles.customerDetails}>
                <Text style={[styles.customerName, { fontSize: fontSize.md }]}>
                  {order.customer}
                </Text>
                <TouchableOpacity 
                  style={styles.phoneRow}
                  onPress={() => handleContactCustomer(order)}
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
              {order.items.slice(0, 2).map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={[styles.itemName, { fontSize: fontSize.sm }]} numberOfLines={1}>
                    • {item.name}
                  </Text>
                  {item.quantity && item.quantity > 1 && (
                    <Text style={[styles.itemQuantity, { fontSize: fontSize.xs }]}>
                      x{item.quantity}
                    </Text>
                  )}
                </View>
              ))}
              {order.items.length > 2 && (
                <Text style={[styles.itemQuantity, { fontSize: fontSize.xs, marginTop: 2 }]}>
                  + {order.items.length - 2} autres articles
                </Text>
              )}
            </View>
          </View>

          {/* === PROGRESS BAR (ZEIGARNIK EFFECT) === */}
          {!['cancelled', 'refunded'].includes(order.status) && (
            <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {['pending', 'accepted', 'shipped', 'delivered'].map((step, idx, arr) => {
                  let currentIndex = ['pending', 'accepted', 'shipped', 'delivered'].indexOf(
                    order.status === 'paid' ? 'accepted' : order.status
                  );
                  if (currentIndex < 0) currentIndex = 0;
                  const isCompleted = idx <= currentIndex;
                  const isLast = idx === arr.length - 1;
                  const stepColor = isCompleted ? COLORS.accent : COLORS.border;
                  
                  return (
                    <React.Fragment key={step}>
                      {/* Cercle étape */}
                      <View style={{ alignItems: 'center', zIndex: 2 }}>
                        <View style={{ 
                          width: 20, height: 20, borderRadius: 10, 
                          backgroundColor: isCompleted ? stepColor : COLORS.card,
                          borderWidth: isCompleted ? 0 : 2,
                          borderColor: stepColor,
                          justifyContent: 'center', alignItems: 'center'
                        }}>
                          {isCompleted && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <Text style={{ fontSize: fontSize.xs - 2, color: isCompleted ? COLORS.text : COLORS.textMuted, marginTop: 4, position: 'absolute', top: 22, width: 60, textAlign: 'center', left: -20 }}>
                          {step === 'pending' ? 'Attente' : step === 'accepted' ? 'Acceptée' : step === 'shipped' ? 'Expédiée' : 'Livrée'}
                        </Text>
                      </View>
                      
                      {/* Ligne connectrice */}
                      {!isLast && (
                        <View style={{ 
                          flex: 1, height: 3, 
                          backgroundColor: idx < currentIndex ? COLORS.accent : COLORS.border,
                          marginHorizontal: -4, zIndex: 1
                        }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
              <View style={{ height: 24 }} />
            </View>
          )}

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
              {order.total?.toLocaleString() || '0'} F
            </Text>
          </View>
        </TouchableOpacity>

        {/* Actions dynamiques selon le statut */}
        <View style={styles.actionButtons}>
          {/* TOUJOURS possible d'annuler si pas livré */}
          {['pending', 'accepted', 'paid', 'shipped'].includes(order.status) && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton, { flex: 0.4 }]}
              onPress={() => handleStatusChange(order.id, 'cancelled')}
              disabled={updatingOrderId === order.id}
            >
              <Ionicons name="close-circle" size={fontSize.md} color={COLORS.danger} />
              <Text style={[styles.rejectButtonText, { fontSize: fontSize.sm }]}>Annuler</Text>
            </TouchableOpacity>
          )}

          {/* Boutons Spécifiques */}
          {order.status === 'pending' && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => handleStatusChange(order.id, 'accepted')}
              disabled={updatingOrderId === order.id}
            >
              <LinearGradient
                colors={[COLORS.accent, COLORS.accent2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmGradient}
              />
              <Ionicons name="checkmark-circle" size={fontSize.md} color={COLORS.text} />
              <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Accepter</Text>
            </TouchableOpacity>
          )}

          {order.status === 'accepted' && (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                onPress={() => handleStatusChange(order.id, 'paid')}
                disabled={updatingOrderId === order.id}
              >
                <Ionicons name="cash" size={fontSize.md} color={COLORS.text} />
                <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Payée</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                onPress={() => handleStatusChange(order.id, 'shipped')}
                disabled={updatingOrderId === order.id}
              >
                <Ionicons name="cube" size={fontSize.md} color={COLORS.text} />
                <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Expédier</Text>
              </TouchableOpacity>
            </>
          )}

          {(order.status === 'paid') && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
              onPress={() => handleStatusChange(order.id, 'shipped')}
              disabled={updatingOrderId === order.id}
            >
              <Ionicons name="cube" size={fontSize.md} color={COLORS.text} />
              <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Expédier</Text>
            </TouchableOpacity>
          )}

          {order.status === 'shipped' && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: COLORS.success }]}
              onPress={() => handleStatusChange(order.id, 'delivered')}
              disabled={updatingOrderId === order.id}
            >
              <Ionicons name="checkmark-done" size={fontSize.md} color={COLORS.text} />
              <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Livrée</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
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
  }), [spacing, fontSize, component]);

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
              {summaryCounts.pending > 0 && (
                <View style={[styles.statBadge, { backgroundColor: COLORS.warning + '10' }]}>
                  <Ionicons name="time" size={fontSize.xs} color={COLORS.warning} />
                  <Text style={[styles.statText, { fontSize: fontSize.xs }]}>
                    <Text style={{ color: COLORS.warning }}>{summaryCounts.pending}</Text> en attente
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
                selectedFilter === filter.id && styles.filterChipActive
              ]}
              onPress={() => setSelectedFilter(filter.id)}
            >
              <Ionicons 
                name={filter.icon as any} 
                size={fontSize.sm} 
                color={selectedFilter === filter.id ? COLORS.card : COLORS.text} 
              />
              <Text style={[
                styles.filterText,
                selectedFilter === filter.id && styles.filterTextActive,
                { color: selectedFilter === filter.id ? COLORS.card : COLORS.text }
              ]}>
                {filter.label}
              </Text>
              <Text style={[
                styles.filterCount,
                selectedFilter === filter.id && styles.filterCountActive,
                { color: selectedFilter === filter.id ? COLORS.card + 'CC' : COLORS.textMuted }
              ]}>
                ({filter.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* BANNIÈRE DE RAPPEL DYNAMIQUES */}
      {delayedOrdersCount > 0 && selectedFilter === 'all' && (
        <View style={{
          backgroundColor: '#eff6ff',
          marginHorizontal: spacing.lg,
          marginBottom: spacing.md,
          padding: spacing.md,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          flexDirection: 'row',
          alignItems: 'center'
        }}>
          <Ionicons name="alert-circle" size={24} color="#3b82f6" style={{ marginRight: spacing.sm }} />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: '#1e3a8a', fontWeight: '500' }}>
            ⚠️ Vous avez <Text style={{fontWeight: '800'}}>{delayedOrdersCount}</Text> commande{delayedOrdersCount > 1 ? 's' : ''} en attente depuis plusieurs jours. N'oubliez pas d'actualiser leurs statuts (Expédiée ou Livrée) pour de meilleures statistiques.
          </Text>
        </View>
      )}

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
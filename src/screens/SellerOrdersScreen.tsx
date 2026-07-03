import React, { useState, useMemo, useCallback } from 'react';
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
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { orderService } from '../services/orderService';
import { storeService } from '../services/storeService';
import { useSupabase } from '../lib/supabase';
import { contactStore } from '../services/contactService';
import { notificationService } from '../services/notificationService';
import type { Order, OrderStatus } from '../types/order';
import { exportOrdersToPDF, exportOrderToPDF, exportBatchOrdersToPDF, exportPickingListPDF } from '../utils/pdfExport';
import { OrderCardSkeleton } from '../components/SkeletonLoader';

// Local types (renamed to avoid conflict with imported Order from types/order.ts)
interface OrderItemDisplay {
  name: string;
  quantity: number;
  price?: number;
  image?: string;
}

// Display order with transformed property names for UI rendering
interface OrderDisplay {
  id: string;
  customer: string;
  phone: string;
  itemCount: number;
  total: number;
  status: Order['status'];
  date: string;
  paymentMethod: string;
  paymentStatus: Order['payment_status'];
  deliveryAddress: string | null;
  isoDate: string;
  status_changed_at?: string;
  isStuck: boolean;
  daysInStatus: number;
  hoursInStatus: number;
  issueType?: string | null;
  items?: OrderItemDisplay[];
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

const FILTERS: Array<{ id: 'all' | OrderStatus; label: string; icon: string }> = [
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

const getPaymentStatusColor = (status?: Order['payment_status']) => {
  switch (status) {
    case 'paid': return COLORS.success;
    case 'pending': return COLORS.warning;
    case 'failed': return COLORS.danger;
    default: return COLORS.textMuted;
  }
};

const getPaymentStatusLabel = (status?: Order['payment_status']) => {
  switch (status) {
    case 'paid': return 'Payée';
    case 'pending': return 'En attente';
    default: return 'Non défini';
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

  const [orders, setOrders] = React.useState<OrderDisplay[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedFilter, setSelectedFilter] = React.useState<'all' | OrderStatus>('all');
  const [sortBy, setSortBy] = React.useState<'date' | 'total'>('date');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [storeId, setStoreId] = React.useState<string | null>(null);
  const [storeName, setStoreName] = React.useState<string | null>(null);
  const [summaryCounts, setSummaryCounts] = React.useState<{ total: number; pending: number }>({ total: 0, pending: 0 });
  const [statusCounts, setStatusCounts] = React.useState<Record<string, number>>({});
  const [deliveredRevenue, setDeliveredRevenue] = React.useState<number>(0);
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);
  const [thresholds, setThresholds] = React.useState<any[]>([]);
  const [stuckOrderCount, setStuckOrderCount] = React.useState<number>(0);
  const [showStuckOnly, setShowStuckOnly] = React.useState(false);

  // 🚀 États pour la pagination optimisée
  const [hasMore, setHasMore] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);

  // 🖨️ Sélection multiple pour impression en masse
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = React.useState<Set<string>>(new Set());
  const [guideModalVisible, setGuideModalVisible] = React.useState(false);

  React.useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const hasShown = await AsyncStorage.getItem('@libreshop:orders_guide_shown');
        if (!hasShown) {
          setGuideModalVisible(true);
          await AsyncStorage.setItem('@libreshop:orders_guide_shown', 'true');
        }
      } catch (error) {
        console.warn('Error reading orders guide flag:', error);
      }
    };
    const timer = setTimeout(() => {
      checkFirstTime();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleBatchPrint = async () => {
    const selected = filteredOrders.filter(o => selectedOrderIds.has(o.id));
    if (selected.length === 0) {
      Alert.alert('Info', 'Sélectionnez au moins une commande');
      return;
    }
    const ordersData = selected.map((o: OrderDisplay) => ({
      id: o.id,
      customerName: o.customer,
      customerPhone: o.phone,
      shippingAddress: o.deliveryAddress || '',
      items: o.items.map((it: any) => ({ name: it.name, quantity: it.quantity || 1, price: it.price || 0 })),
      totalAmount: o.total,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus || 'pending',
      status: o.status,
      createdAt: o.isoDate,
      storeName: storeName || undefined,
    }));
    await exportBatchOrdersToPDF(ordersData, storeName || 'Ma Boutique');
  };

  const handleBatchPickingList = async () => {
    const selected = filteredOrders.filter(o => selectedOrderIds.has(o.id));
    if (selected.length === 0) {
      Alert.alert('Info', 'Sélectionnez au moins une commande');
      return;
    }
    const ordersData = selected.map((o: OrderDisplay) => ({
      id: o.id,
      customerName: o.customer,
      customerPhone: o.phone,
      shippingAddress: o.deliveryAddress || '',
      items: o.items.map((it: any) => ({ name: it.name, quantity: it.quantity || 1, price: it.price || 0 })),
      totalAmount: o.total,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus || 'pending',
      status: o.status,
      createdAt: o.isoDate,
      storeName: storeName || undefined,
    }));
    await exportPickingListPDF(ordersData, storeName || 'Ma Boutique');
  };

  const handleBatchAccept = async () => {
    if (selectedOrderIds.size === 0) {
      Alert.alert('Info', 'Sélectionnez au moins une commande');
      return;
    }

    const pendingSelectedIds = Array.from(selectedOrderIds).filter(id => {
      const order = orders.find(o => o.id === id);
      return order && order.status === 'pending';
    });

    if (pendingSelectedIds.length === 0) {
      Alert.alert('Info', "Aucune des commandes sélectionnées n'est en attente (statut 'En attente')");
      return;
    }

    Alert.alert(
      'Accepter en masse',
      `Accepter les ${pendingSelectedIds.length} commande(s) en attente sélectionnée(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, accepter',
          onPress: async () => {
            setLoading(true);
            try {
              let successCount = 0;
              const stockErrors: string[] = [];
              for (const orderId of pendingSelectedIds) {
                try {
                  await orderService.acceptOrder(orderId);
                  successCount++;
                } catch (err: any) {
                  if (err?.message === 'INSUFFICIENT_STOCK') {
                    stockErrors.push(`#${orderId.slice(0, 8).toUpperCase()}`);
                  } else {
                    throw err; // re-throw non-stock errors
                  }
                }
              }
              if (stockErrors.length > 0) {
                Alert.alert(
                  'Résultat partiel',
                  `${successCount} commande(s) acceptée(s).\n\n${stockErrors.length} commande(s) en rupture de stock :\n${stockErrors.join(', ')}\n\nOuvrez ces commandes pour gérer le stock.`
                );
              } else {
                Alert.alert('Succès', `${successCount} commande(s) acceptée(s) avec succès.`);
              }
              setSelectionMode(false);
              setSelectedOrderIds(new Set());
              loadOrders();
            } catch (e) {
              errorHandler.handleDatabaseError(e, 'Error in batch accept');
              Alert.alert('Erreur', 'Un problème est survenu lors de la validation.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleBatchPay = async () => {
    if (selectedOrderIds.size === 0) {
      Alert.alert('Info', 'Sélectionnez au moins une commande');
      return;
    }

    const payableSelectedIds = Array.from(selectedOrderIds).filter(id => {
      const order = orders.find(o => o.id === id);
      return order && !['paid', 'delivered', 'cancelled'].includes(order.status);
    });

    if (payableSelectedIds.length === 0) {
      Alert.alert('Info', "Aucune des commandes sélectionnées n'est éligible au paiement.");
      return;
    }

    Alert.alert(
      'Confirmer les paiements',
      `Confirmer le paiement de ces ${payableSelectedIds.length} commande(s) sélectionnée(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, valider',
          onPress: async () => {
            setLoading(true);
            try {
              let successCount = 0;
              for (const orderId of payableSelectedIds) {
                await orderService.confirmOrderPayment(orderId);
                successCount++;
              }
              Alert.alert('Succès', `Le paiement de ${successCount} commande(s) a été enregistré.`);
              setSelectionMode(false);
              setSelectedOrderIds(new Set());
              loadOrders();
            } catch (e) {
              errorHandler.handleDatabaseError(e, 'Error in batch payment');
              Alert.alert('Erreur', 'Un problème est survenu lors de l\'enregistrement des paiements.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };


  const filtersWithCounts = useMemo(() => {
    return FILTERS.map((filter) => {
      // Use server-provided summary counts for global/important filters to avoid
      // showing only the current page's items (which can be limited by cursor)
      if (filter.id === 'all') {
        const total = (statusCounts && typeof statusCounts.total === 'number') ? statusCounts.total : (summaryCounts.total || orders.length);
        return { ...filter, count: total };
      }
      if (filter.id === 'pending') {
        const pending = (statusCounts && typeof statusCounts.pending === 'number') ? statusCounts.pending : (summaryCounts.pending || orders.filter((o) => o.status === 'pending').length);
        return { ...filter, count: pending };
      }
      const count = orders.filter((o) => o.status === filter.id).length;
      return { ...filter, count };
    });
  }, [orders, summaryCounts, statusCounts]);

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

      if (!storeService.isSubscriptionActive(store)) {
        Alert.alert(
          'Abonnement expiré',
          `Votre abonnement pour "${store.name}" a expiré. Veuillez le renouveler pour accéder à vos commandes.`,
          [
            {
              text: 'Renouveler',
              onPress: () => navigation.replace('SubscriptionExpired'),
            },
          ]
        );
        setLoading(false);
        return;
      }

      setStoreId(store.id);
      setStoreName(store.name || null);

      // 🚀 OPTIMISATION: Charger les données en 2 waves
      // Wave 1 (critique): Requête principale + métadonnées consolidées
      // Wave 2 (déféré): Seuils et statuts bloqués

      // Wave 1: Paralléliser requête principale + RPC consolidée de métadonnées
        const [orderResult, metadata] = await Promise.all([
          orderService.getByStore(store.id, {
            limit: 20,
            cursor: (reset ? undefined : nextCursor) || undefined,
            status: selectedFilter !== 'all' ? selectedFilter : undefined,
            search: searchQuery || undefined,
          }),
          orderService.getStoreOrdersMetadata(store.id),
        ]);

        // Traiter résultat métadonnées
        if (metadata) {
          setSummaryCounts({
            total: metadata.total_orders || 0,
            pending: metadata.pending_orders || 0,
          });

          setStatusCounts({
            total: metadata.total_orders || 0,
            pending: metadata.pending_orders || 0,
            accepted: metadata.accepted_orders || 0,
            paid: metadata.paid_orders || 0,
            shipped: metadata.shipped_orders || 0,
            delivered: metadata.delivered_orders || 0,
            cancelled: metadata.cancelled_orders || 0,
            refunded: metadata.refunded_orders || 0,
            ...(metadata.status_counts || {}),
          });

          setDeliveredRevenue(Number(metadata.delivered_revenue || 0));
        }

        const result = orderResult;

        if (!result.orders || result.orders.length === 0) {
          setHasMore(false);
          if (reset) setOrders([]);
          return;
        }

        // 🔄 Mapping optimisé
        const mapped: OrderDisplay[] = result.orders.map((o: any) => {
          const itemCount = Array.isArray(o.order_items) ? o.order_items.length : 0;

          const customerName = String(o?.customer_name || o?.users?.full_name || '').trim();
          const customerPhone = String(o?.customer_phone || o?.users?.phone || '').trim();

          // Calculate stuck order info
          const daysInStatus = orderService.calculateDaysInStatus(o);
          const hoursInStatus = orderService.calculateHoursInStatus(o);
          const stuckInfo = orderService.isOrderStuck(o, thresholds);

          return {
            id: String(o.id),
            customer: customerName || (customerPhone ? customerPhone : 'Client'),
            phone: customerPhone,
            itemCount,
            total: Number(o.total_amount || 0),
            status: o.status,
            date: formatTimeAgo(o.created_at),
            paymentMethod: String(o.payment_method || ''),
            paymentStatus: o.payment_status,
            deliveryAddress: o.shipping_address,
            isoDate: o.created_at,
            status_changed_at: o.status_changed_at,
            isStuck: stuckInfo.isStuck,
            daysInStatus,
            hoursInStatus,
            issueType: o.issue_type || null,
          };
        });

        // 🚀 Mise à jour optimisée de l'état
        if (reset) {
          setOrders(mapped);
        } else {
          setOrders(prev => [...prev, ...mapped]);
        }

        // Count stuck orders
        const stuckCount = mapped.filter(o => o.isStuck).length;
        setStuckOrderCount(stuckCount);

        // 🔄 Mise à jour du curseur et hasMore
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);
        setIsInitialLoad(false);


        // 🚀 Wave 2 (LAZY): Charger seuils EN ARRIÈRE-PLAN après Wave 1
        // Pas bloquant pour le UI, se termine en parallèle
        if (reset) {
          setTimeout(() => {
            void (async () => {
              try {
                const thresh = await orderService.getStatusThresholds();
                if (thresh) {
                  setThresholds(thresh);
                }
              } catch (e) {
                console.warn('Wave 2 error loading thresholds:', e);
              }
            })();
          }, 300); // Délai court (300ms) pour que le UI se rendre d'abord
        }
      }
      catch (e: any) {
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

    // 🚀 Real-time subscription for new/updated orders
    React.useEffect(() => {
      if (!storeId) return;

      const client = useSupabase();
      const channel = client
        .channel(`orders:${storeId}`)
        .on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `store_id=eq.${storeId}`
          },
          (payload: any) => {
            console.log('📦 Order changed in real-time:', payload.eventType);
            // Simple approach: reload the first page to get updates
            loadOrders(true);
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    }, [storeId, loadOrders]);

    // 🚀 Chargement initial
    React.useEffect(() => {

      loadOrders();
    }, []);

    // 🔔 Notifier vendeur des commandes bloquées (une seule fois au chargement)
    const stuckNotifiedRef = React.useRef(false);
    React.useEffect(() => {
      if (!storeId || orders.length === 0 || !user?.id || stuckNotifiedRef.current) return;

      const notifyStuckOrders = async () => {
        try {
          const stuckOrders = orders.filter(o => o.isStuck && !['delivered', 'cancelled'].includes(o.status));
          if (stuckOrders.length === 0) return;

          stuckNotifiedRef.current = true;

          // Créer UNE seule notification résumée
          try {
            await notificationService.create({
              user_id: user.id,
              type: 'order',
              title: `${stuckOrders.length} commande(s) bloquée(s)`,
              body: `Vous avez ${stuckOrders.length} commande(s) en attente d'action.`,
              data: { store_id: storeId, count: stuckOrders.length },
            });
          } catch (e) {
            console.warn('Failed to notify stuck orders', e);
          }
        } catch (e) {
          console.warn('Stuck orders notification error:', e);
        }
      };

      // Délai pour laisser les données se charger
      const timeout = setTimeout(notifyStuckOrders, 5000);
      return () => clearTimeout(timeout);
    }, [storeId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // 🚀 Plus besoin de filtrage local - tout est géré par le backend optimisé !
    // Mais on filtre les commandes bloquées côté client si demandé
    const filteredOrders = showStuckOnly ? orders.filter(o => o.isStuck) : orders;

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
        if (e?.message === 'INSUFFICIENT_STOCK') {
          const missingNames = (e.missing_items || []).map((i: any) => `• ${i.name} (demandé: ${i.requested}, dispo: ${i.available})`).join('\n');
          Alert.alert(
            'Rupture de stock',
            `Impossible d'accepter la commande. Produits en rupture :\n\n${missingNames}\n\nVoulez-vous ajuster le stock ou notifier le client ?`,
            [
              { 
                text: 'Ajuster le stock', 
                onPress: () => {
                  const p = e.missing_items?.[0];
                  if (p) navigation.navigate('SellerStockHistory', { productId: p.product_id, openRestockModal: true });
                }
              },
              { 
                text: 'Notifier le client', 
                onPress: () => navigation.navigate('SellerOrderDetail', { 
                  orderId,
                  openRestockModal: true,
                  missingItems: e.missing_items || [],
                })
              },
              { text: 'Annuler', style: 'cancel' }
            ]
          );
        } else {
          await loadOrders(true);
          Alert.alert('Erreur', `Impossible de ${actionText} la commande: ${e?.message || 'Erreur inconnue'}`);
        }
      } finally {
        setUpdatingOrderId(null);
      }
    };

    const handleContactCustomer = (order: OrderDisplay) => {
      const formattedPhone = order.phone.replace(/[^0-9+]/g, '');
      const itemsList = (order.items || []).map((item: OrderItemDisplay) => `- ${item.name} (x${item.quantity || 1})`).join('\n');
      const storeText = storeName ? `la boutique ${storeName} sur Libreshop` : `Libreshop`;

      const message = `Bonjour, je suis le vendeur de ${storeText}.
Je vous contacte concernant votre commande #${order.id.slice(0, 8).toUpperCase()}.

Produits :
${itemsList}

Pouvez-vous me confirmer votre disponibilité pour la livraison ?
Merci.`;

      contactStore({ rawPhone: formattedPhone, message }).catch(() => {
        Alert.alert('Contacter', `Appeler le ${order.phone}`);
      });
    };

    // Export toutes les commandes en PDF
    const handleExportAllOrders = async () => {
      if (orders.length === 0) {
        Alert.alert('Info', 'Aucune commande à exporter');
        return;
      }

      const ordersData = orders.map((o: OrderDisplay) => ({
        id: o.id,
        customerName: o.customer,
        customerPhone: o.phone,
        shippingAddress: o.deliveryAddress || undefined,
        items: o.items.map((it: any) => ({ ...it, quantity: it.quantity || 1 })),
        totalAmount: o.total,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        status: o.status,
        createdAt: o.isoDate,
      }));

      await exportOrdersToPDF(ordersData, 'Liste des commandes - LibreShop');
    };

    // Export une commande en PDF
    const handleExportOrder = async (order: OrderDisplay) => {
      const orderData = {
        id: order.id,
        customerName: order.customer,
        customerPhone: order.phone,
        shippingAddress: order.deliveryAddress || undefined,
        items: order.items.map((it: any) => ({ ...it, quantity: it.quantity || 1 })),
        totalAmount: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.isoDate,
      };

      await exportOrderToPDF(orderData);
    };

    const renderOrder = useCallback((order: OrderDisplay) => {
      const statusColor = getStatusColor(order.status);
      const paymentStatusColor = getPaymentStatusColor(order.paymentStatus);
      const isSelected = selectedOrderIds.has(order.id);

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
              borderWidth: isSelected ? 2 : order.isStuck ? 2 : 0,
              borderColor: isSelected ? COLORS.accent : order.isStuck ? COLORS.danger : 'transparent',
            }
          ]}
        >
          {/* Checkbox en mode sélection */}
          {selectionMode && (
            <TouchableOpacity
              onPress={() => toggleOrderSelection(order.id)}
              style={{
                position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 10,
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: isSelected ? COLORS.accent : COLORS.card,
                borderWidth: 2, borderColor: isSelected ? COLORS.accent : COLORS.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              if (selectionMode) { toggleOrderSelection(order.id); return; }
              navigation.navigate('SellerOrderDetail', { orderId: order.id });
            }}
            onLongPress={() => { setSelectionMode(true); toggleOrderSelection(order.id); }}
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

              {/* Stock issue badge */}
              {order.issueType && (
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: order.issueType === 'out_of_stock' ? COLORS.danger + '20' : order.issueType === 'waiting_restock' ? COLORS.warning + '20' : order.issueType === 'resolved_partial' ? COLORS.accent + '20' : COLORS.textMuted + '20', marginLeft: 4 }
                ]}>
                  <Ionicons
                    name={order.issueType === 'out_of_stock' ? 'alert-circle' : order.issueType === 'waiting_restock' ? 'time' : order.issueType === 'resolved_partial' ? 'swap-horizontal' : 'help-circle'}
                    size={fontSize.xs}
                    color={order.issueType === 'out_of_stock' ? COLORS.danger : order.issueType === 'waiting_restock' ? COLORS.warning : COLORS.accent}
                  />
                  <Text style={[
                    styles.statusText,
                    { fontSize: fontSize.xs, color: order.issueType === 'out_of_stock' ? COLORS.danger : order.issueType === 'waiting_restock' ? COLORS.warning : COLORS.accent }
                  ]}>
                    {order.issueType === 'out_of_stock' ? 'Rupture' : order.issueType === 'waiting_restock' ? 'Attente stock' : order.issueType === 'resolved_partial' ? 'Partiel' : order.issueType}
                  </Text>
                </View>
              )}
            </View>

            {/* Alert for stuck orders */}
            {order.isStuck && (
              <View style={{
                backgroundColor: COLORS.danger + '10',
                borderLeftWidth: 3,
                borderLeftColor: COLORS.danger,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderRadius: 4,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons name="alert-circle" size={fontSize.lg} color={COLORS.danger} style={{ marginRight: spacing.sm }} />
                    <View>
                      <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: COLORS.danger }}>
                        ⏱️ Bloquée depuis {order.daysInStatus || 0} {(order.daysInStatus || 0) > 1 ? 'jours' : 'jour'}
                      </Text>
                      <Text style={{ fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 }}>
                        Action requise pour avancer
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

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

            <View style={[styles.itemsSection, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={[styles.itemsTitle, { fontSize: fontSize.sm, marginBottom: 0 }]}>
                {order.itemCount} article{order.itemCount > 1 ? 's' : ''}
              </Text>
              
              <TouchableOpacity
                style={{
                  backgroundColor: COLORS.accent + '20',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                onPress={() => navigation.navigate('SellerOrderDetail', { orderId: order.id })}
              >
                <Text style={{ color: COLORS.accent, fontWeight: '600', fontSize: fontSize.sm, marginRight: 4 }}>Détails</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.accent} />
              </TouchableOpacity>
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
                {updatingOrderId === order.id ? (
                  <ActivityIndicator color={COLORS.danger} size="small" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={fontSize.md} color={COLORS.danger} />
                    <Text style={[styles.rejectButtonText, { fontSize: fontSize.sm }]}>Annuler</Text>
                  </>
                )}
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
                {updatingOrderId === order.id ? (
                  <ActivityIndicator color={COLORS.text} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={fontSize.md} color={COLORS.text} />
                    <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Accepter</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {order.status === 'accepted' && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                  onPress={() => handleStatusChange(order.id, 'paid')}
                  disabled={updatingOrderId === order.id}
                >
                  {updatingOrderId === order.id ? (
                    <ActivityIndicator color={COLORS.text} size="small" />
                  ) : (
                    <>
                      <Ionicons name="cash" size={fontSize.md} color={COLORS.text} />
                      <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Payée</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                  onPress={() => handleStatusChange(order.id, 'shipped')}
                  disabled={updatingOrderId === order.id}
                >
                  {updatingOrderId === order.id ? (
                    <ActivityIndicator color={COLORS.text} size="small" />
                  ) : (
                    <>
                      <Ionicons name="cube" size={fontSize.md} color={COLORS.text} />
                      <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Expédier</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {(order.status === 'paid') && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                onPress={() => handleStatusChange(order.id, 'shipped')}
                disabled={updatingOrderId === order.id}
              >
                {updatingOrderId === order.id ? (
                  <ActivityIndicator color={COLORS.text} size="small" />
                ) : (
                  <>
                    <Ionicons name="cube" size={fontSize.md} color={COLORS.text} />
                    <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Expédier</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {order.status === 'shipped' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                onPress={() => handleStatusChange(order.id, 'delivered')}
                disabled={updatingOrderId === order.id}
              >
                {updatingOrderId === order.id ? (
                  <ActivityIndicator color={COLORS.text} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={fontSize.md} color={COLORS.text} />
                    <Text style={[styles.confirmButtonText, { fontSize: fontSize.sm }]}>Livrée</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }, [
      selectedOrderIds,
      selectionMode,
      updatingOrderId,
      spacing,
      fontSize,
      component,
      navigation,
      handleContactCustomer,
      handleStatusChange,
    ]);

    const renderOrderItem = useCallback(({ item }: { item: OrderDisplay }) => renderOrder(item), [renderOrder]);

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
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
      },
      modalContent: {
        backgroundColor: COLORS.bg,
        borderTopLeftRadius: RADIUS.lg,
        borderTopRightRadius: RADIUS.lg,
        maxHeight: '85%',
        paddingBottom: spacing.xl,
      },
      modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      },
      modalTitle: {
        fontSize: fontSize.md || 16,
        fontWeight: '700',
        color: COLORS.text,
      },
      modalForm: {
        padding: spacing.md,
      },
      guideCard: {
        marginBottom: spacing.md,
        borderRadius: RADIUS.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
      },
      guideCardGradient: {
        padding: spacing.md,
      },
      guideCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.sm,
      },
      guideIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
      },
      guideCardTitle: {
        fontSize: fontSize.sm || 14,
        fontWeight: '700',
      },
      guideCardBody: {
        fontSize: fontSize.xs || 12,
        color: COLORS.textSoft,
        lineHeight: 18,
        marginBottom: spacing.sm,
      },
      bulletList: {
        gap: spacing.xs,
      },
      bulletItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.xs,
      },
      bulletText: {
        fontSize: fontSize.xs || 12,
        color: COLORS.textSoft,
        flex: 1,
        lineHeight: 18,
      },
      stepContainer: {
        gap: spacing.md,
        marginTop: spacing.xs,
      },
      stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
      },
      stepNumberBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
      },
      stepNumberText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
      },
      stepTitle: {
        fontSize: fontSize.xs || 12,
        fontWeight: '700',
        color: COLORS.text,
      },
      stepDesc: {
        fontSize: fontSize.xs || 12,
        color: COLORS.textMuted,
        lineHeight: 16,
        marginTop: 2,
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
                    Revenu total: <Text style={styles.statValue}>{deliveredRevenue?.toLocaleString() || '0'} F</Text>
                  </Text>
                </View>
                {((statusCounts && typeof statusCounts.pending === 'number') ? statusCounts.pending : summaryCounts.pending) > 0 && (
                  <View style={[styles.statBadge, { backgroundColor: COLORS.warning + '10' }]}>
                    <Ionicons name="time" size={fontSize.xs} color={COLORS.warning} />
                    <Text style={[styles.statText, { fontSize: fontSize.xs }]}>
                      <Text style={{ color: COLORS.warning }}>{(statusCounts && typeof statusCounts.pending === 'number') ? statusCounts.pending : summaryCounts.pending}</Text> en attente
                    </Text>
                  </View>
                )}
                {stuckOrderCount > 0 && (
                  <TouchableOpacity
                    style={[styles.statBadge, { backgroundColor: COLORS.danger + '20' }]}
                    onPress={() => setShowStuckOnly(!showStuckOnly)}
                  >
                    <Ionicons name="alert-circle" size={fontSize.xs} color={COLORS.danger} />
                    <Text style={[styles.statText, { fontSize: fontSize.xs }]}>
                      <Text style={{ color: COLORS.danger, fontWeight: '600' }}>{stuckOrderCount}</Text> bloquée{stuckOrderCount > 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: COLORS.accent + '20' }]}
                onPress={() => setGuideModalVisible(true)}
              >
                <Ionicons name="help-circle-outline" size={fontSize.lg} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: COLORS.card }]}
                onPress={handleExportAllOrders}
              >
                <Ionicons name="document-text-outline" size={fontSize.lg} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: COLORS.card }]}
                onPress={() => {/* Ouvrir filtres avancés */ }}
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

        {/* Barre de sélection multiple */}
        {selectionMode && (
          <View style={{
            backgroundColor: COLORS.accent,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
          }}>
            {/* Ligne 1: Infos et Sélection Globale */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyBetween: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', paddingBottom: 6, justifyContent: 'space-between' } as any}>
              <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedOrderIds(new Set()); }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: fontSize.xs }}>✕ Quitter Sélection ({selectedOrderIds.size})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSelectAll}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: fontSize.xs }}>
                  {selectedOrderIds.size === filteredOrders.length ? '☑ Tout désélectionner' : '☐ Tout sélectionner'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ligne 2: Actions de Masse */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 2 } as any}>
              <TouchableOpacity
                onPress={handleBatchAccept}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>Accepter ({Array.from(selectedOrderIds).filter(id => orders.find(o => o.id === id)?.status === 'pending').length})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBatchPay}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
              >
                <Ionicons name="cash-outline" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>Payer ({Array.from(selectedOrderIds).filter(id => !['paid', 'delivered', 'cancelled'].includes(orders.find(o => o.id === id)?.status || '')).length})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBatchPickingList}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
              >
                <Ionicons name="cube-outline" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>Picking List (Préparation)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBatchPrint}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
              >
                <Ionicons name="print-outline" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>Imprimer Factures ({selectedOrderIds.size})</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

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
              ⚠️ Vous avez <Text style={{ fontWeight: '800' }}>{delayedOrdersCount}</Text> commande{delayedOrdersCount > 1 ? 's' : ''} en attente depuis plusieurs jours. N'oubliez pas d'actualiser leurs statuts (Expédiée ou Livrée) pour de meilleures statistiques.
            </Text>
          </View>
        )}

        {/* Barre de tri */}
        <View style={styles.sortBar}>
          <Text style={[styles.filterText, { color: COLORS.textSoft }]}>
            {filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''}
          </Text>

          <View style={styles.sortButtons}>
            {/* Bouton activer mode sélection */}
            <TouchableOpacity
              style={[styles.sortButton, selectionMode && styles.sortButtonActive]}
              onPress={() => { setSelectionMode(s => !s); setSelectedOrderIds(new Set()); }}
            >
              <Ionicons name="print-outline" size={fontSize.xs} color={selectionMode ? COLORS.accent : COLORS.textMuted} />
              <Text style={[styles.sortButtonText, selectionMode && styles.sortButtonTextActive]}>Sélection</Text>
            </TouchableOpacity>
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
          renderItem={renderOrderItem}
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
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          updateCellsBatchingPeriod={50}
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

        {/* Guide Modal */}
        <Modal
          visible={guideModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setGuideModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="book-outline" size={22} color={COLORS.accent} />
                  <Text style={styles.modalTitle}>Guide : Comptabilité & Commandes</Text>
                </View>
                <TouchableOpacity onPress={() => setGuideModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>

                {/* Section 1: Comptabilisation & Trésorerie */}
                <View style={styles.guideCard}>
                  <LinearGradient
                    colors={['rgba(76, 175, 80, 0.1)', 'rgba(76, 175, 80, 0.02)']}
                    style={styles.guideCardGradient}
                  >
                    <View style={styles.guideCardHeader}>
                      <View style={[styles.guideIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
                        <Ionicons name="cash-outline" size={20} color={COLORS.success} />
                      </View>
                      <Text style={[styles.guideCardTitle, { color: COLORS.success }]}>1. Entrées Comptables (Trésorerie)</Text>
                    </View>
                    <Text style={styles.guideCardBody}>
                      Vos revenus et statistiques financières sont calculés en temps réel. Une vente s'enregistre officiellement dans vos rapports dès que :
                    </Text>
                    <View style={styles.bulletList}>
                      <View style={styles.bulletItem}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        <Text style={styles.bulletText}>La commande est marquée comme <Text style={{ fontWeight: '700' }}>Payée</Text> (Caisse ou paiement validé).</Text>
                      </View>
                      <View style={styles.bulletItem}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        <Text style={styles.bulletText}>La commande atteint le statut final <Text style={{ fontWeight: '700' }}>Livrée</Text> (comptabilisation à la livraison).</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                {/* Section 2: Mouvements de stock */}
                <View style={styles.guideCard}>
                  <LinearGradient
                    colors={['rgba(33, 150, 243, 0.1)', 'rgba(33, 150, 243, 0.02)']}
                    style={styles.guideCardGradient}
                  >
                    <View style={styles.guideCardHeader}>
                      <View style={[styles.guideIconContainer, { backgroundColor: 'rgba(33, 150, 243, 0.15)' }]}>
                        <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
                      </View>
                      <Text style={[styles.guideCardTitle, { color: COLORS.primary }]}>2. Mouvements de Stock (Cycle)</Text>
                    </View>
                    <Text style={styles.guideCardBody}>
                      Pour garantir que vous ne vendiez jamais deux fois le même article en ligne et en caisse (survente) :
                    </Text>
                    <View style={styles.stepContainer}>
                      <View style={styles.stepRow}>
                        <View style={[styles.stepNumberBadge, { backgroundColor: COLORS.primary }]}>
                          <Text style={styles.stepNumberText}>1</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stepTitle}>Dépréciation à l'Acceptation</Text>
                          <Text style={styles.stepDesc}>Dès que vous acceptez une commande, l'article est "réservé" (déduit du stock physique) pour le client.</Text>
                        </View>
                      </View>
                      <View style={styles.stepRow}>
                        <View style={[styles.stepNumberBadge, { backgroundColor: COLORS.warning }]}>
                          <Text style={styles.stepNumberText}>2</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stepTitle}>Restauration automatique à l'Annulation</Text>
                          <Text style={styles.stepDesc}>Si une commande en cours de préparation est annulée, le stock est réinjecté automatiquement et un log "Retour" est tracé.</Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                {/* Section 3: Bonnes pratiques */}
                <View style={styles.guideCard}>
                  <LinearGradient
                    colors={['rgba(255, 152, 0, 0.1)', 'rgba(255, 152, 0, 0.02)']}
                    style={styles.guideCardGradient}
                  >
                    <View style={styles.guideCardHeader}>
                      <View style={[styles.guideIconContainer, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}>
                        <Ionicons name="bulb-outline" size={20} color={COLORS.warning} />
                      </View>
                      <Text style={[styles.guideCardTitle, { color: COLORS.warning }]}>3. Conseils de Gestion</Text>
                    </View>
                    <View style={styles.bulletList}>
                      <View style={styles.bulletItem}>
                        <Ionicons name="radio-button-on" size={12} color={COLORS.warning} style={{ marginTop: 2 }} />
                        <Text style={styles.bulletText}>
                          <Text style={{ fontWeight: '700' }}>Pertes & Vols :</Text> Utilisez le bouton d'audit dans l'historique de stock pour déclarer les pertes, vols ou anomalies manuellement.
                        </Text>
                      </View>
                      <View style={styles.bulletItem}>
                        <Ionicons name="radio-button-on" size={12} color={COLORS.warning} style={{ marginTop: 2 }} />
                        <Text style={styles.bulletText}>
                          <Text style={{ fontWeight: '700' }}>Validation de paiement :</Text> Confirmez toujours les paiements dès réception des fonds pour avoir des rapports mensuels impeccables.
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                {/* Section 4: Navigation & Traitements en Masse */}
                <View style={styles.guideCard}>
                  <LinearGradient
                    colors={['rgba(139, 92, 246, 0.1)', 'rgba(139, 92, 246, 0.02)']}
                    style={styles.guideCardGradient}
                  >
                    <View style={styles.guideCardHeader}>
                      <View style={[styles.guideIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                        <Ionicons name="flash-outline" size={20} color={COLORS.accent} />
                      </View>
                      <Text style={[styles.guideCardTitle, { color: COLORS.accent }]}>4. Raccourcis & Traitement en Masse</Text>
                    </View>
                    <Text style={styles.guideCardBody}>
                      Pour traiter efficacement un grand volume de commandes (100+) sans clics répétitifs :
                    </Text>
                    <View style={styles.bulletList}>
                      <View style={styles.bulletItem}>
                        <Ionicons name="arrow-forward" size={14} color={COLORS.accent} style={{ marginTop: 2 }} />
                        <Text style={styles.bulletText}>
                          <Text style={{ fontWeight: '700' }}>Activer la Sélection :</Text> Faites un **appui long** sur n'importe quelle commande pour activer le mode sélection multiple.
                        </Text>
                      </View>
                      <View style={styles.bulletItem}>
                        <Ionicons name="arrow-forward" size={14} color={COLORS.accent} style={{ marginTop: 2 }} />
                        <Text style={styles.bulletText}>
                          <Text style={{ fontWeight: '700' }}>Sélection Multiple :</Text> Cochez plusieurs commandes en appuyant simplement dessus. Vous pouvez aussi cliquer sur **"Tout sélectionner"** en haut à droite du bandeau.
                        </Text>
                      </View>
                      <View style={styles.bulletItem}>
                        <Ionicons name="arrow-forward" size={14} color={COLORS.accent} style={{ marginTop: 2 }} />
                        <Text style={styles.bulletText}>
                          <Text style={{ fontWeight: '700' }}>Bandeau d'Actions (en bas) :</Text> Faites glisser horizontalement le bandeau violet pour choisir votre action :
                          {"\n"}• <Text style={{ fontWeight: '600' }}>Accepter ()</Text> en masse les commandes en attente.
                          {"\n"}• <Text style={{ fontWeight: '600' }}>Payer ()</Text> en masse les paiements en attente.
                          {"\n"}• <Text style={{ fontWeight: '600' }}>Picking List</Text> pour générer le bordereau consolidé des articles à préparer.
                          {"\n"}• <Text style={{ fontWeight: '600' }}>Imprimer Factures</Text> pour générer tous les PDFs individuels en un seul fichier.
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                <TouchableOpacity
                  onPress={() => setGuideModalVisible(false)}
                  style={{
                    marginTop: spacing.md,
                    backgroundColor: COLORS.accent,
                    paddingVertical: spacing.md,
                    borderRadius: RADIUS.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: fontSize.md }}>J'ai compris</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  };
import React, { useEffect, useState } from 'react';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { contactStore } from '../services/contactService';
import { Order, OrderItem, Product } from '../lib/supabase';
import { orderService } from '../services/orderService';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { RootStackParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { cloudinaryService } from '../services/cloudinaryService';
import { locationService } from '../services/locationService';

type RouteProps = RouteProp<RootStackParamList, 'SellerOrderDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OrderWithItems extends Order {
  order_items: (OrderItem & { product?: Product })[];
  users?: { full_name?: string | null } | null;
}

export const SellerOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();

  // On web, opening via URL can come without stack params. Support ?orderId=
  const orderIdFromParams = (route as any)?.params?.orderId as string | undefined;
  const orderIdFromQuery =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('orderId') || undefined
      : undefined;
  const orderId = orderIdFromParams || orderIdFromQuery;
  // Params passés depuis SellerOrdersScreen quand INSUFFICIENT_STOCK
  const openRestockModalParam = (route as any)?.params?.openRestockModal as boolean | undefined;
  const missingItemsParam = (route as any)?.params?.missingItems as any[] | undefined;
  
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [packMode, setPackMode] = useState(false);

  // 📦 Notification client et dates de réapprovisionnement
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [missingItemsToRestock, setMissingItemsToRestock] = useState<any[]>([]);
  const [restockDates, setRestockDates] = useState<{[key: string]: string}>({});
  const [restockStatusChoice, setRestockStatusChoice] = useState<'expected' | 'no_restock'>('expected');

  // 📦 Tracking livraison
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingProvider, setShippingProvider] = useState('');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');

  const toggleItem = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allChecked = order ? checkedItems.size === order.order_items.length : false;
  const progress = order && order.order_items.length > 0
    ? checkedItems.size / order.order_items.length
    : 0;

  useEffect(() => {
    void loadOrder();
  }, [orderId]);

  // Ouvrir le modal automatiquement si on vient de SellerOrdersScreen avec openRestockModal=true
  useEffect(() => {
    if (openRestockModalParam && missingItemsParam) {
      let items = missingItemsParam;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) {}
      }
      const safeItems = Array.isArray(items) ? items : [items];
      if (safeItems.length > 0 && safeItems[0]) {
        setMissingItemsToRestock(safeItems);
        setRestockDates({});
        setRestockStatusChoice('expected');
        setRestockModalVisible(true);
      }
    }
  }, [openRestockModalParam, missingItemsParam]);

  const loadOrder = async () => {
    try {
      if (!orderId) {
        setOrder(null);
        return;
      }

      const data: any = await orderService.getById(orderId, { includeUser: true, includeStore: true });

      const normalized: OrderWithItems = {
        ...(data as Order),
        order_items: ((data?.order_items || []) as any[]).map((it: any) => ({
          ...(it as OrderItem),
          // orderService returns products(*) relation, normalize it to product
          product: it.product || it.products,
        })),
      };

      setOrder(normalized);
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error loading order:');
      Alert.alert('Erreur', 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: Order['status']) => {
    setUpdating(true);
    try {
      if (!orderId) throw new Error('orderId manquant');
      if (newStatus === 'accepted') {
        await orderService.acceptOrder(orderId);
      } else if (newStatus === 'paid') {
        await orderService.confirmOrderPayment(orderId);
      } else {
        await orderService.updateStatus(orderId, newStatus);
      }
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (error: any) {
      if (error.message === 'INSUFFICIENT_STOCK') {
        Alert.alert(
          'Rupture de stock',
          'Certains produits de cette commande sont en rupture de stock. Vous ne pouvez pas accepter la commande.\n\nVoulez-vous notifier le client ou ajuster votre stock ?',
          [
            { 
              text: 'Ajuster le stock', 
              onPress: () => {
                const missingProduct = error.missing_items?.[0];
                if (missingProduct) {
                  navigation.navigate('SellerStockHistory', { 
                    productId: missingProduct.product_id, 
                    openRestockModal: true 
                  });
                }
              } 
            },
            { 
              text: 'Notifier le client', 
              onPress: () => {
                setMissingItemsToRestock(error.missing_items);
                setRestockDates({});
                setRestockStatusChoice('expected');
                setRestockModalVisible(true);
              } 
            },
            { text: 'Annuler', style: 'cancel' }
          ]
        );
      } else {
        errorHandler.handleDatabaseError(error, 'Error updating order:');
        Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmNotifyClient = async () => {
    if (!orderId || !order) return;
    setUpdating(true);
    try {
      const missingWithDates = (missingItemsToRestock || []).map(item => ({
        ...item,
        restock_date: restockStatusChoice === 'no_restock' ? 'Aucun réappro prévu' : (restockDates[item.product_id] || 'Date non définie')
      }));
      
      await orderService.notifyClientStockIssue(orderId, missingWithDates, restockStatusChoice);

      const msg = restockStatusChoice === 'no_restock'
        ? 'Le client a été informé qu\'aucun réapprovisionnement n\'est prévu. Il devra annuler ou modifier sa commande.'
        : 'Le client a été notifié de la rupture de stock avec les dates prévues.';
      Alert.alert('Succès', msg);
      setRestockModalVisible(false);
      loadOrder();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de notifier le client.');
    } finally {
      setUpdating(false);
    }
  };

  // Notifier les clients en attente quand le stock arrive
  const handleNotifyRestockedClients = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const storeId = order.store_id;
      // Récupérer les produits concernés depuis issue_details
      const items = (order as any).issue_details || [];
      let count = 0;
      for (const item of items) {
        count += await orderService.notifyRestockedClients(storeId, item.product_id, item.name);
      }
      Alert.alert('✅ Clients notifiés', `${count} client(s) en attente ont été notifiés que le stock est disponible. Leurs commandes ont été remises en attente.`);
      loadOrder();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de notifier les clients.');
    } finally {
      setUpdating(false);
    }
  };

  // Confirmer "pas de réappro" pour les commandes en attente
  const handleNotifyNoRestock = async () => {
    if (!order) return;
    Alert.alert(
      'Confirmer l\'absence de réapprovisionnement',
      'Vous êtes sur le point de notifier les clients en attente qu\'aucun réapprovisionnement n\'est prévu. Ils devront annuler ou modifier leurs commandes.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              const items = (order as any).issue_details || [];
              let count = 0;
              for (const item of items) {
                count += await orderService.notifyNoRestock(order.store_id, item.product_id, item.name);
              }
              Alert.alert('🚨 Clients informés', `${count} client(s) ont été informés qu\'aucun réapprovisionnement n\'est prévu.`);
              loadOrder();
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de notifier les clients.');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveTracking = async () => {
    if (!orderId) return;
    setUpdating(true);
    try {
      await orderService.updateTrackingInfo(orderId, {
        tracking_number: trackingNumber || undefined,
        shipping_provider: shippingProvider || undefined,
        estimated_delivery_date: estimatedDeliveryDate || undefined,
      });
      Alert.alert('Succès', 'Les informations de tracking ont été enregistrées.');
      setTrackingModalVisible(false);
      loadOrder();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer les informations de tracking.');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: Order['status']): string => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'accepted': return COLORS.primary;
      case 'processing': return COLORS.info || '#2196F3';
      case 'paid': return COLORS.accent;
      case 'shipped': return COLORS.accent2;
      case 'delivered': return COLORS.success;
      case 'cancelled': return COLORS.danger;
      default: return COLORS.textMuted;
    }
  };

  const getStatusLabel = (status: Order['status']): string => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'accepted': return 'Acceptée';
      case 'processing': return 'En préparation';
      case 'paid': return 'Payée';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  const getPaymentMethodLabel = (method: string): string => {
    switch (method) {
      case 'mobile_money': return 'Mobile Money';
      case 'card': return 'Carte bancaire';
      case 'cash_on_delivery': return 'Paiement à la livraison';
      default: return method;
    }
  };

  const handleWhatsApp = () => {
    const phone = order?.customer_phone;
    if (!phone) {
      Alert.alert('Erreur', 'Numéro de téléphone non disponible');
      return;
    }
    
    // Format phone number for WhatsApp (remove spaces, special chars, and +)
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    
    const storeName = (order as any).stores?.name || (order as any).store?.name;
    const storeText = storeName ? `la boutique ${storeName} sur Libreshop` : `Libreshop`;
    const itemsList = order.order_items.map(item => `- ${item.product?.name || 'Produit'} (x${item.quantity || 1})`).join('\n');
    
    const message = `Bonjour, je suis le vendeur de ${storeText}.
Je vous contacte concernant votre commande #${order.id.slice(0, 8).toUpperCase()}.

Produits :
${itemsList}

Pouvez-vous me confirmer votre disponibilité pour la livraison ?
Merci.`;

    contactStore({ rawPhone: cleanPhone, message });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Commande non trouvée</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('SellerOrders' as any)}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commande #{order.id.slice(0, 8)}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Status Badge */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {getStatusLabel(order.status)}
          </Text>
        </View>
      </View>

      {/* Customer Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Informations client</Text>
        {!!(order.customer_name || order.users?.full_name) && (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{order.customer_name || order.users?.full_name}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.infoText}>{order.customer_phone}</Text>
        </View>
        {order.shipping_address && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{order.shipping_address}</Text>
          </View>
        )}
        {order.city && (
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>Ville: {order.city}</Text>
          </View>
        )}
        {(order as any).latitude && (order as any).longitude && (
          <TouchableOpacity 
            style={[styles.infoRow, { marginTop: SPACING.xs }]}
            onPress={() => locationService.openInMaps((order as any).latitude, (order as any).longitude, order.customer_name || 'Client')}
          >
            <Ionicons name="map-outline" size={18} color={COLORS.accent} />
            <Text style={[styles.infoText, { color: COLORS.accent, fontWeight: '600' }]}>Voir sur la carte</Text>
          </TouchableOpacity>
        )}
        {order.notes && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{order.notes}</Text>
          </View>
        )}
        {/* WhatsApp Button */}
        <TouchableOpacity 
          style={styles.whatsappButton}
          onPress={handleWhatsApp}
        >
          <Ionicons name="logo-whatsapp" size={20} color={COLORS.text} />
          <Text style={styles.whatsappButtonText}>Discuter sur WhatsApp</Text>
        </TouchableOpacity>
      </Card>

      {/* Order Items + Pick & Pack */}
      <Card style={styles.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
          <Text style={styles.sectionTitle}>Produits ({order.order_items.length})</Text>
          {['paid', 'accepted'].includes(order.status) && (
            <TouchableOpacity
              onPress={() => { setPackMode(p => !p); setCheckedItems(new Set()); }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: packMode ? COLORS.accent + '20' : COLORS.card,
                borderWidth: 1, borderColor: packMode ? COLORS.accent : COLORS.border,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
              }}
            >
              <Ionicons name={packMode ? 'checkmark-done' : 'cube-outline'} size={14} color={packMode ? COLORS.accent : COLORS.textMuted} />
              <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: '700', color: packMode ? COLORS.accent : COLORS.textMuted }}>
                {packMode ? 'Mode actif' : 'Pick & Pack'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Barre de progression */}
        {packMode && (
          <View style={{ marginBottom: SPACING.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
                {checkedItems.size}/{order.order_items.length} article{order.order_items.length > 1 ? 's' : ''} vérifiés
              </Text>
              <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: '700', color: allChecked ? COLORS.success : COLORS.warning }}>
                {allChecked ? '✅ Prêt !' : `${Math.round(progress * 100)}%`}
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{
                height: 6, borderRadius: 3,
                width: `${Math.round(progress * 100)}%` as any,
                backgroundColor: allChecked ? COLORS.success : COLORS.warning,
              }} />
            </View>
          </View>
        )}

        {order.order_items.map((item) => {
          const isChecked = checkedItems.has(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => packMode && toggleItem(item.id)}
              activeOpacity={packMode ? 0.7 : 1}
              style={[
                styles.itemContainer,
                packMode && {
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: isChecked ? COLORS.success : COLORS.border,
                  backgroundColor: isChecked ? COLORS.success + '10' : COLORS.bg,
                  marginBottom: SPACING.sm,
                  paddingHorizontal: SPACING.sm,
                }
              ]}
            >
              {packMode ? (
                <View style={{
                  width: 28, height: 28, borderRadius: 14, marginRight: SPACING.sm,
                  backgroundColor: isChecked ? COLORS.success : COLORS.card,
                  borderWidth: 2, borderColor: isChecked ? COLORS.success : COLORS.border,
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {isChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              ) : (
                <Image 
                  source={{ uri: cloudinaryService.getOptimizedUrl(item.product?.images && item.product.images.length > 0 ? item.product.images[0] : 'https://picsum.photos/200', 300) }} 
                  style={styles.itemImage}
                />
              )}
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, packMode && isChecked && { textDecorationLine: 'line-through', color: COLORS.textMuted }]}>
                  {item.product?.name || 'Produit'}
                </Text>
                {item.product?.reference ? (
                  <Text style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 }}>
                    Réf: {item.product.reference}
                  </Text>
                ) : null}
                <Text style={styles.itemPrice}>
                  {item.price.toLocaleString()} FCFAs × {item.quantity}
                </Text>
                {packMode && !isChecked && (
                  <Text style={{ fontSize: FONT_SIZE.xs, color: COLORS.warning, marginTop: 2 }}>⚠️ À vérifier</Text>
                )}
              </View>
              <Text style={[styles.itemTotal, packMode && isChecked && { color: COLORS.success }]}>
                {(item.price * item.quantity).toLocaleString()} FCFAs
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Bouton Prêt à expédier */}
        {packMode && (
          <TouchableOpacity
            onPress={() => {
              if (!allChecked) {
                Alert.alert('Articles manquants', `Cochez tous les articles avant de continuer.\n\nRestant : ${order.order_items.length - checkedItems.size} article(s) non vérifié(s).`);
                return;
              }
              Alert.alert(
                '📦 Prêt à expédier',
                'Tous les articles ont été vérifiés. Marquer cette commande comme expédiée ?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Confirmer', onPress: () => handleUpdateStatus('shipped') },
                ]
              );
            }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: SPACING.md, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
              backgroundColor: allChecked ? COLORS.success : COLORS.border,
              opacity: allChecked ? 1 : 0.6,
            }}
          >
            <Ionicons name={allChecked ? 'checkmark-circle' : 'lock-closed-outline'} size={20} color={allChecked ? '#fff' : COLORS.textMuted} />
            <Text style={{ fontWeight: '800', fontSize: FONT_SIZE.md, color: allChecked ? '#fff' : COLORS.textMuted }}>
              {allChecked ? 'Prêt à expédier ✓' : `Cochez tous les articles (${order.order_items.length - checkedItems.size} restant)`}
            </Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* Payment Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Paiement</Text>
        <View style={styles.infoRow}>
          <Ionicons name="card-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.infoText}>{getPaymentMethodLabel(order.payment_method)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons 
            name={order.payment_status === 'paid' ? 'checkmark-circle' : 'time-outline'} 
            size={18} 
            color={order.payment_status === 'paid' ? COLORS.success : COLORS.warning} 
          />
          <Text style={[
            styles.infoText,
            { color: order.payment_status === 'paid' ? COLORS.success : COLORS.warning }
          ]}>
            {order.payment_status === 'paid' ? 'Payé' : 'En attente'}
          </Text>
        </View>
      </Card>

      {/* Tracking Info */}
      <Card style={styles.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
          <Text style={styles.sectionTitle}>Tracking livraison</Text>
          <TouchableOpacity
            onPress={() => setTrackingModalVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.accent} />
            <Text style={{ fontSize: FONT_SIZE.xs, color: COLORS.accent, fontWeight: '600' }}>
              {order.tracking_number ? 'Modifier' : 'Ajouter'}
            </Text>
          </TouchableOpacity>
        </View>

        {order.tracking_number ? (
          <>
            <View style={styles.infoRow}>
              <Ionicons name="barcode-outline" size={18} color={COLORS.textMuted} />
              <Text style={styles.infoText}>{order.tracking_number}</Text>
            </View>
            {order.shipping_provider && (
              <View style={styles.infoRow}>
                <Ionicons name="cube-outline" size={18} color={COLORS.textMuted} />
                <Text style={styles.infoText}>{order.shipping_provider}</Text>
              </View>
            )}
            {order.estimated_delivery_date && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.textMuted} />
                <Text style={styles.infoText}>
                  Livraison estimée: {new Date(order.estimated_delivery_date).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontStyle: 'italic' }}>
            Aucune information de tracking
          </Text>
        )}
      </Card>

      {/* Total */}
      <Card style={styles.section}>
        <View style={{ gap: SPACING.xs }}>
          <View style={[styles.infoRow, { justifyContent: 'space-between', marginBottom: 0 }]}>
            <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.md }}>Sous-total</Text>
            <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.md }}>
              {order.subtotal?.toLocaleString() || (order.total_amount - (order.delivery_fee || 0) - (order.tax_amount || 0)).toLocaleString()} FCFAs
            </Text>
          </View>

          {(order.delivery_fee > 0) && (
            <View style={[styles.infoRow, { justifyContent: 'space-between', marginBottom: 0 }]}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.md }}>Frais de livraison</Text>
              <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.md }}>
                {order.delivery_fee.toLocaleString()} FCFAs
              </Text>
            </View>
          )}

          {(order.tax_amount > 0) && (
            <View style={[styles.infoRow, { justifyContent: 'space-between', marginBottom: 0 }]}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.md }}>TVA</Text>
              <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.md }}>
                {order.tax_amount.toLocaleString()} FCFAs
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md }} />

        <View style={[styles.totalRow, { marginTop: 0 }]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {order.total_amount.toLocaleString()} FCFAs
          </Text>
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        {/* Bouton pour contacter le client */}
        <TouchableOpacity 
          style={styles.contactButton}
          onPress={handleWhatsApp}
        >
          <Ionicons name="chatbubble-outline" size={20} color={COLORS.accent} />
          <Text style={styles.contactText}>Contacter le client</Text>
        </TouchableOpacity>

        {order.status === 'pending' && (
          <>
            <Button
              title="Accepter la commande"
              onPress={() => handleUpdateStatus('accepted')}
              loading={updating}
              style={{ marginBottom: SPACING.md }}
            />
            <Button
              title="Annuler la commande"
              onPress={() => handleUpdateStatus('cancelled')}
              variant="danger"
            />
          </>
        )}
        {order.status === 'accepted' && (
          <Button
            title="Confirmer le paiement"
            onPress={() => handleUpdateStatus('paid')}
            loading={updating}
            style={{ marginBottom: SPACING.md }}
          />
        )}
        {order.status === 'paid' && (
          <Button
            title="Marquer comme expédiée"
            onPress={() => handleUpdateStatus('shipped')}
            loading={updating}
          />
        )}
        {order.status === 'shipped' && (
          <View style={{
            backgroundColor: COLORS.accent + '15',
            borderColor: COLORS.accent,
            borderWidth: 1,
            borderRadius: RADIUS.md,
            padding: SPACING.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.sm,
            marginBottom: SPACING.md,
          }}>
            <Ionicons name="time-outline" size={20} color={COLORS.accent} />
            <Text style={{ color: COLORS.accent, fontSize: FONT_SIZE.sm, flex: 1, fontWeight: '500' }}>
              En attente de confirmation du client. Le statut passera à "Livrée" automatiquement dès que le client confirmera la réception.
            </Text>
          </View>
        )}
      </View>

      {/* Waiting restock panel \u2014 client is waiting for stock */}
      {(order as any).issue_type === 'waiting_restock' && (
        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
          <View style={{
            backgroundColor: COLORS.warning + '15', borderColor: COLORS.warning, borderWidth: 1,
            borderRadius: RADIUS.md, padding: SPACING.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
              <Ionicons name="time" size={18} color={COLORS.warning} />
              <Text style={{ color: COLORS.warning, fontWeight: '700', marginLeft: 6, fontSize: FONT_SIZE.sm }}>
                Client en attente de réapprovisionnement
              </Text>
            </View>
            <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: SPACING.md }}>
              Ce client a choisi d'attendre. Notifiez-le dès que le stock est disponible, ou informez-le si aucun réappro n'est prévu.
            </Text>
            <TouchableOpacity
              onPress={handleNotifyRestockedClients}
              disabled={updating}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: COLORS.success, borderRadius: RADIUS.md, paddingVertical: SPACING.md,
                marginBottom: SPACING.sm, opacity: updating ? 0.6 : 1,
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm }}>
                ✅ Stock arrivé, notifier le client
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleNotifyNoRestock}
              disabled={updating}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: COLORS.danger + '15', borderColor: COLORS.danger, borderWidth: 1,
                borderRadius: RADIUS.md, paddingVertical: SPACING.md, opacity: updating ? 0.6 : 1,
              }}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.danger} />
              <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: FONT_SIZE.sm }}>
                🚨 Aucun réappro prévu
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Restock Dates Modal */}
      <Modal
        visible={restockModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRestockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>Rupture de stock — Notifier le client</Text>
              <TouchableOpacity onPress={() => setRestockModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Choice: restock expected or not */}
            <Text style={[styles.modalSubtitle, { color: COLORS.textMuted, marginBottom: SPACING.sm }]}>
              Le vendeur prévoit-il un réapprovisionnement ?
            </Text>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
              <TouchableOpacity
                style={{
                  flex: 1, padding: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center',
                  borderWidth: 2,
                  borderColor: restockStatusChoice === 'expected' ? COLORS.success : COLORS.border,
                  backgroundColor: restockStatusChoice === 'expected' ? COLORS.success + '15' : COLORS.bg,
                }}
                onPress={() => setRestockStatusChoice('expected')}
              >
                <Ionicons name="checkmark-circle" size={20} color={restockStatusChoice === 'expected' ? COLORS.success : COLORS.textMuted} />
                <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: '600', marginTop: 4, color: restockStatusChoice === 'expected' ? COLORS.success : COLORS.textMuted }}>
                  Oui, réappro prévu
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1, padding: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center',
                  borderWidth: 2,
                  borderColor: restockStatusChoice === 'no_restock' ? COLORS.danger : COLORS.border,
                  backgroundColor: restockStatusChoice === 'no_restock' ? COLORS.danger + '15' : COLORS.bg,
                }}
                onPress={() => setRestockStatusChoice('no_restock')}
              >
                <Ionicons name="close-circle" size={20} color={restockStatusChoice === 'no_restock' ? COLORS.danger : COLORS.textMuted} />
                <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: '600', marginTop: 4, color: restockStatusChoice === 'no_restock' ? COLORS.danger : COLORS.textMuted }}>
                  Non, pas de réappro
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date inputs — only if restock is expected */}
            {restockStatusChoice === 'expected' && (
              <>
                <Text style={[styles.modalSubtitle, { color: COLORS.textMuted }]}>
                  Indiquez une date prévue pour chaque produit :
                </Text>
                <ScrollView style={{ maxHeight: 220 }}>
                  {(missingItemsToRestock || []).map(item => (
                    <View key={item.product_id} style={{ marginBottom: SPACING.md }}>
                      <Text style={{ fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs }}>{item.name}</Text>
                      <TextInput
                        style={[styles.modalInput, { marginBottom: 0 }]}
                        value={restockDates[item.product_id] || ''}
                        onChangeText={(text) => setRestockDates(prev => ({ ...prev, [item.product_id]: text }))}
                        placeholder="Ex: Le 15 Octobre, Demain, Dans 3 jours..."
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {restockStatusChoice === 'no_restock' && (
              <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.sm, marginBottom: SPACING.md, lineHeight: 20 }}>
                ⚠️ Le client sera informé qu'aucun réapprovisionnement n'est prévu. Il pourra annuler ou continuer sans ce produit.
              </Text>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRestockModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: restockStatusChoice === 'no_restock' ? COLORS.danger : COLORS.accent }]}
                onPress={handleConfirmNotifyClient}
              >
                <Text style={styles.modalConfirmText}>Notifier</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tracking Modal */}
      <Modal
        visible={trackingModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTrackingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>Informations de tracking</Text>
              <TouchableOpacity onPress={() => setTrackingModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: COLORS.textMuted }]}>
              Saisissez les informations de suivi de livraison. Le client sera notifié automatiquement.
            </Text>

            <View style={{ marginBottom: SPACING.md }}>
              <Text style={{ fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs }}>Numéro de suivi</Text>
              <TextInput
                style={styles.modalInput}
                value={trackingNumber}
                onChangeText={setTrackingNumber}
                placeholder="Ex: 1Z999AA10123456784"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={{ marginBottom: SPACING.md }}>
              <Text style={{ fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs }}>Transporteur</Text>
              <TextInput
                style={styles.modalInput}
                value={shippingProvider}
                onChangeText={setShippingProvider}
                placeholder="Ex: DHL, FedEx, Colissimo, Chronopost..."
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={{ marginBottom: SPACING.md }}>
              <Text style={{ fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs }}>Date de livraison estimée</Text>
              <TextInput
                style={styles.modalInput}
                value={estimatedDeliveryDate}
                onChangeText={setEstimatedDeliveryDate}
                placeholder="Ex: 2024-12-25"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setTrackingModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleSaveTracking}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginLeft: SPACING.sm,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  itemPrice: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.accent,
  },
  actions: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '10',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  contactText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.accent,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.danger,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.whatsapp,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  whatsappButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    marginBottom: SPACING.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
  },
  modalCancelText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  modalConfirmText: {
    color: '#FFF',
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  secondaryButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
});


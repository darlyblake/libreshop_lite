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
  
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // 📦 Pick & Pack — checklist des articles
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [packMode, setPackMode] = useState(false);

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
      await orderService.updateStatus(orderId, newStatus);
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error updating order:');
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: Order['status']): string => {
    switch (status) {
      case 'pending': return COLORS.warning;
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
          onPress={() => navigation.goBack()}
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

      {/* Total */}
      <Card style={styles.section}>
        <View style={styles.totalRow}>
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
              onPress={() => handleUpdateStatus('paid')}
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
        {order.status === 'paid' && (
          <Button
            title="Marquer comme expédiée"
            onPress={() => handleUpdateStatus('shipped')}
            loading={updating}
          />
        )}
        {order.status === 'shipped' && (
          <Button
            title="Confirmer la livraison"
            onPress={() => handleUpdateStatus('delivered')}
            loading={updating}
          />
        )}
      </View>

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
});


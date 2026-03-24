import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Order, OrderItem, Product, Store, orderService } from '../lib/supabase';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { RootStackParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';

type RouteProps = RouteProp<RootStackParamList, 'ClientOrderDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OrderWithDetails extends Order {
  store?: Store;
  users?: any;
  order_items: (OrderItem & { product?: Product })[];
}

export const ClientOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { orderId } = route.params;
  
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      // Charger les vraies données de la commande avec infos utilisateur et boutique
      const orderData = await orderService.getById(orderId, { includeUser: true, includeStore: true });
      
      if (!orderData) {
        setOrder(null);
        return;
      }
      
      // Normaliser: Supabase peut retourner `products` ou `product`, normaliser vers `product`
      const normalized = {
        ...orderData,
        order_items: ((orderData.order_items || []) as any[]).map((item: any) => ({
          ...item,
          product: item.product || item.products, // Normaliser le nom de la clé
        })),
      };
      
      setOrder(normalized as OrderWithDetails);
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error loading order:');
      Alert.alert('Erreur', 'Impossible de charger la commande');
    } finally {
      setLoading(false);
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <Text style={styles.headerTitle}>Détails de la commande</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Order ID & Status */}
      <View style={styles.orderInfo}>
        <Text style={styles.orderId}>Commande #{order.id.slice(0, 8)}</Text>
        <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
      </View>

      {/* Status Badge */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
          <Ionicons 
            name={order.status === 'delivered' ? 'checkmark-circle' : 
                 order.status === 'cancelled' ? 'close-circle' :
                 order.status === 'shipped' ? 'airplane' : 'time-outline'} 
            size={16} 
            color={getStatusColor(order.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {getStatusLabel(order.status)}
          </Text>
        </View>
      </View>

      {/* Store Info */}
      {order.store && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Boutique</Text>
          <TouchableOpacity style={styles.storeInfo}>
            <View style={styles.storeIcon}>
              <Ionicons name="storefront-outline" size={20} color={COLORS.accent} />
            </View>
            <View style={styles.storeDetails}>
              <Text style={styles.storeName}>{order.store.name}</Text>
              <Text style={styles.storeCategory}>{order.store.category}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </Card>
      )}

      {/* Client Info */}
      {order.users && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{order.users.full_name || 'N/A'}</Text>
          </View>
          {order.users.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
              <Text style={styles.infoText}>{order.users.email}</Text>
            </View>
          )}
          {order.users.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={COLORS.textMuted} />
              <Text style={styles.infoText}>{order.users.phone}</Text>
            </View>
          )}
        </Card>
      )}

      {/* Delivery Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Livraison</Text>
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
        {order.notes && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{order.notes}</Text>
          </View>
        )}
      </Card>

      {/* Products */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Produits ({order.order_items.length})</Text>
        {order.order_items.map((item) => {
          const productImage = item.product?.images && item.product.images.length > 0 
            ? item.product.images[0] 
            : null;
          
          return (
            <View key={item.id} style={styles.itemContainer}>
              <View style={styles.itemImage}>
                {productImage ? (
                  <Image
                    source={{ uri: productImage }}
                    style={{ width: '100%', height: '100%', borderRadius: 8 }}
                  />
                ) : (
                  <View style={{ width: '100%', height: '100%', borderRadius: 8, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="cube-outline" size={24} color={COLORS.textMuted} />
                  </View>
                )}
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product?.name || 'Produit inconnu'}</Text>
                <Text style={styles.itemPrice}>
                  {item.price.toLocaleString()} FCFAs × {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                {(item.price * item.quantity).toLocaleString()} FCFAs
              </Text>
            </View>
          );
        })}
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
      {order.users && (
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => {
              const phone = order.users?.phone || order.customer_phone;
              if (!phone) {
                Alert.alert('Erreur', 'Numéro de téléphone non disponible');
                return;
              }
              // Essayer WhatsApp d'abord
              const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=Bonjour, je vous contacte concernant la commande #${orderId.slice(0, 8)}`;
              Linking.openURL(whatsappUrl).catch(() => {
                // Fallback: SMS
                const smsUrl = `sms:${phone}?body=Bonjour, je vous contacte concernant la commande #${orderId.slice(0, 8)}`;
                Linking.openURL(smsUrl).catch(() => {
                  Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp ou SMS');
                });
              });
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.accent} />
            <Text style={styles.helpText}>Contacter le client</Text>
          </TouchableOpacity>
        </View>
      )}

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
  orderInfo: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  orderId: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  orderDate: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  statusContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
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
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  storeDetails: {
    flex: 1,
  },
  storeName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  storeCategory: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
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
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
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
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent,
    gap: SPACING.sm,
  },
  helpText: {
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
});


import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { contactStore } from '../services/contactService';
import { Order, OrderItem, Product, Store } from '../lib/supabase';
import { orderService } from '../services/orderService';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { RootStackParamList } from '../navigation/types';
import { Card, LoadingSpinner, OrderTimeline } from '../components';
import { cloudinaryService } from '../services/cloudinaryService';
import { refundService } from '../services/refundService';

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
  const [refunds, setRefunds] = useState<any[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

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

      // Charger les remboursements de cette commande
      try {
        const refundList = await refundService.getRefundsByOrder(orderId);
        setRefunds(refundList || []);
      } catch (err) {
        console.warn('Error loading refunds:', err);
      }
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error loading order:');
      Alert.alert('Erreur', 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateReturn = async () => {
    if (!returnReason.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un motif pour votre retour');
      return;
    }

    setSubmittingReturn(true);
    try {
      await refundService.createRefund({
        orderId: order!.id,
        amount: order!.total_amount,
        reason: returnReason,
        type: 'full',
        status: 'pending',
        items: order!.order_items.map(item => ({
          productId: item.product_id,
          productName: item.product?.name || 'Produit',
          quantity: item.quantity,
          price: item.price,
          refundAmount: item.price * item.quantity,
        }))
      });

      Alert.alert('Succès ✓', 'Votre demande de retour a été soumise avec succès.');
      setShowReturnModal(false);
      setReturnReason('');
      loadOrder();
    } catch (err) {
      errorHandler.handle(err, 'Create refund error', ErrorCategory.USER_INPUT, ErrorSeverity.MEDIUM);
      Alert.alert('Erreur', 'Impossible d’initier le retour de commande.');
    } finally {
      setSubmittingReturn(false);
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

      {/* Order Timeline */}
      <OrderTimeline status={order.status} />

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
                    source={{ uri: cloudinaryService.getOptimizedUrl(productImage, 300) }}
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

      {/* Return Requests Status */}
      {refunds.length > 0 && (
        <Card style={[styles.section, { borderColor: COLORS.accent, borderWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.accent }]}>Demande de retour active</Text>
          {refunds.map((ref) => (
            <View key={ref.id} style={{ marginTop: SPACING.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '600', color: COLORS.text, flex: 1, marginRight: SPACING.sm }}>Motif: {ref.reason}</Text>
                <View style={{
                  backgroundColor: ref.status === 'approved' || ref.status === 'processed' ? COLORS.success + '20' : ref.status === 'rejected' ? COLORS.danger + '20' : COLORS.warning + '20',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4
                }}>
                  <Text style={{
                    color: ref.status === 'approved' || ref.status === 'processed' ? COLORS.success : ref.status === 'rejected' ? COLORS.danger : COLORS.warning,
                    fontSize: FONT_SIZE.xs,
                    fontWeight: '600'
                  }}>
                    {ref.status === 'pending' ? 'En attente' : ref.status === 'approved' || ref.status === 'processed' ? 'Accepté' : 'Refusé'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 4 }}>
                Créé le {new Date(ref.orderDate).toLocaleDateString('fr-FR')} — Montant: {ref.amount.toLocaleString()} FCFAs
              </Text>
            </View>
          ))}
        </Card>
      )}

      <View style={[styles.actions, { flexDirection: 'column', gap: SPACING.md }]}>
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => {
            const phone = order.store?.whatsapp_number || order.store?.phone || order.customer_phone;
            if (!phone) {
              Alert.alert('Erreur', 'Numéro de téléphone de la boutique non disponible');
              return;
            }
            contactStore({ rawPhone: phone, message: `Bonjour, je vous contacte concernant ma commande #${orderId.slice(0, 8)}` });
          }}
        >
          <Ionicons name="chatbubble-outline" size={20} color={COLORS.accent} />
          <Text style={styles.helpText}>Contacter la boutique</Text>
        </TouchableOpacity>

        {order.status === 'delivered' && refunds.length === 0 && (
          <TouchableOpacity
            style={[styles.helpButton, { borderColor: COLORS.danger, backgroundColor: COLORS.danger + '10' }]}
            onPress={() => setShowReturnModal(true)}
          >
            <Ionicons name="return-up-back" size={20} color={COLORS.danger} />
            <Text style={[styles.helpText, { color: COLORS.danger }]}>Demander un retour / remboursement</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Return Request Modal */}
      <Modal
        visible={showReturnModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReturnModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>Demander un retour</Text>
              <TouchableOpacity onPress={() => setShowReturnModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: COLORS.textMuted }]}>
              Veuillez expliquer en détail la raison de votre retour. Notre équipe et le vendeur l'analyseront dans les plus brefs délais.
            </Text>

            <TextInput
              style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
              value={returnReason}
              onChangeText={setReturnReason}
              placeholder="Raison du retour (ex: Produit défectueux, mauvaise taille...)"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowReturnModal(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleInitiateReturn}
                disabled={submittingReturn}
              >
                {submittingReturn ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Soumettre</Text>
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
    backgroundColor: COLORS.danger,
  },
  modalCancelText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  modalConfirmText: {
    color: '#FFF',
    fontWeight: '600',
  },
});


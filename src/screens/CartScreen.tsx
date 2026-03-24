import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useCartStore, useAuthStore } from '../store';
import { storeService, orderService, supabase } from '../lib/supabase';
import { userService } from '../lib/userService';
import { notificationService } from '../lib/notificationService';

export const CartScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [store, setStore] = useState<any>(null);
  const [loadingStore, setLoadingStore] = useState(false);
  const [storesData, setStoresData] = useState<any[]>([]);

  const { items, removeItem, updateQuantity, getTotal, storeId } = useCartStore();
  const subtotal = getTotal();
  const user = useAuthStore((s) => s.user);
  const clearCart = useCartStore((s) => s.clearCart);
  const [processingBulk, setProcessingBulk] = useState(false);

  // prepare grouping and aggregated totals
  const groups = Object.entries(items.reduce((acc: Record<string, any[]>, it) => {
    const sid = (it.product as any)?.store_id || 'unknown';
    acc[sid] = acc[sid] || [];
    acc[sid].push(it);
    return acc;
  }, {}));

  let aggregatedTax = 0;
  let aggregatedShipping = 0;
  groups.forEach(([sid, group]) => {
    const storeInfo = storesData.find(s => s?.id === sid) || (sid === 'unknown' ? { id: 'unknown', name: 'Divers' } : null);
    const subtotalByStore = group.reduce((s: number, i: any) => s + (i.product.price || 0) * (i.quantity || 0), 0);
    if (storeInfo?.tax_rate) aggregatedTax += Math.round(subtotalByStore * (storeInfo.tax_rate / 100));
    aggregatedShipping += storeInfo?.shipping_price || 0;
  });

  const grandTotal = subtotal + aggregatedTax + aggregatedShipping;

  // Load store data for tax and shipping (support multiple stores)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingStore(true);
        // gather unique store ids from items
        const ids = Array.from(new Set(items.map(i => (i.product as any)?.store_id).filter(Boolean)));
        if (ids.length === 1 && storeId) {
          const s = await storeService.getById(storeId);
          if (!mounted) return;
          setStore(s);
          setStoresData(s ? [s] : []);
        } else if (ids.length > 0) {
          const stores = await Promise.all(ids.map(id => storeService.getById(id)));
          if (!mounted) return;
          setStore(null);
          setStoresData(stores.filter(Boolean));
        } else {
          setStore(null);
          setStoresData([]);
        }
      } catch (e) {
        errorHandler.handle(e, 'load store for cart', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      } finally {
        if (mounted) setLoadingStore(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [storeId, items]);

  const taxRate = store?.tax_rate || 0; // legacy single-store rate for label
  const shippingPrice = store?.shipping_price || 0; // legacy single-store shipping
  // For display and totals we compute aggregated values in-place when rendering
  const total = subtotal; // will add taxes/shipping in UI per-store or aggregated

  const renderCartItem = (item: (typeof items)[number]) => (
    <View key={item.product.id} style={styles.cartItem}>
      {item.product.images?.[0] ? (
        <Image source={{ uri: item.product.images[0] }} style={styles.itemImage} />
      ) : (
        <View style={styles.itemImagePlaceholder}>
          <Ionicons name="image-outline" size={28} color={COLORS.textMuted} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
        <Text style={styles.itemStore}>{((item.product as any)?.store_name) || ''}</Text>
        <View style={styles.itemBottom}>
          <Text style={styles.itemPrice}>{item.product.price.toLocaleString()} FCA</Text>
          <View style={styles.quantityControls}>
            <Pressable
              style={[styles.quantityBadge, { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }]}
              onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
              hitSlop={10}
            >
              <Text style={[styles.quantityText, { color: COLORS.text }]}>-</Text>
            </Pressable>
            <View style={[styles.quantityBadge, styles.quantityMiddle]}>
              <Text style={styles.quantityText}>×{item.quantity}</Text>
            </View>
            <Pressable
              style={styles.quantityBadge}
              onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
              hitSlop={10}
            >
              <Text style={styles.quantityText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <Pressable style={styles.removeButton} onPress={() => removeItem(item.product.id)} hitSlop={10}>
        <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            const canGoBack = typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : false;
            if (canGoBack) navigation.goBack();
            else navigation.navigate('ClientHome');
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Panier</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cart Items grouped by store */}
        <View style={styles.cartSection}>
          {items.length === 0 ? (
            <View style={{ paddingVertical: SPACING.xxxl, alignItems: 'center' }}>
              <Ionicons name="cart-outline" size={64} color={COLORS.textMuted} />
              <Text style={{ marginTop: SPACING.md, color: COLORS.textMuted, fontSize: FONT_SIZE.md }}>
                Ton panier est vide
              </Text>
            </View>
          ) : (
            // group items by store_id (or 'unknown')
            Object.entries(items.reduce((acc: Record<string, any[]>, it) => {
              const sid = (it.product as any)?.store_id || 'unknown';
              acc[sid] = acc[sid] || [];
              acc[sid].push(it);
              return acc;
            }, {})).map(([sid, group]) => {
              const storeInfo = storesData.find(s => s?.id === sid) || (sid === 'unknown' ? { id: 'unknown', name: 'Divers' } : null);
              const subtotalByStore = group.reduce((s: number, i: any) => s + (i.product.price || 0) * (i.quantity || 0), 0);
              const tax = storeInfo?.tax_rate ? Math.round(subtotalByStore * (storeInfo.tax_rate / 100)) : 0;
              const shipping = storeInfo?.shipping_price || 0;

              return (
                <View key={`group-${sid}`} style={{ marginBottom: SPACING.lg }}>
                  <View style={[styles.summarySection, { paddingBottom: SPACING.md }]}>
                    <Text style={[styles.sectionTitle, { fontSize: FONT_SIZE.md }]}>{storeInfo?.name || 'Boutique'}</Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Sous-total</Text>
                      <Text style={styles.summaryValue}>{subtotalByStore.toLocaleString()} FCA</Text>
                    </View>
                    {tax > 0 && (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>TVA</Text>
                        <Text style={styles.summaryValue}>{tax.toLocaleString()} FCA</Text>
                      </View>
                    )}
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Livraison</Text>
                      <Text style={styles.summaryValue}>{shipping > 0 ? `${shipping.toLocaleString()} FCA` : 'Gratuite'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>{(subtotalByStore + tax + shipping).toLocaleString()} FCA</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md }}>
                      <TouchableOpacity
                        style={[styles.checkoutButton, { flex: 1, backgroundColor: COLORS.accent }]}
                        onPress={() => navigation.navigate('Checkout', { storeId: sid === 'unknown' ? null : sid, itemsJson: JSON.stringify(group) })}
                      >
                        <Text style={[styles.checkoutButtonText, { color: COLORS.text }]}>Passer la commande (cette boutique)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Items of the group */}
                  {group.map((it: any) => renderCartItem(it))}
                </View>
              );
            })
          )}
        </View>

        {/* Order Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Résumé de la commande</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>{subtotal.toLocaleString()} FCA</Text>
          </View>
          
          {taxRate > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>TVA ({taxRate}%)</Text>
              <Text style={styles.summaryValue}>{taxAmount.toLocaleString()} FCA</Text>
            </View>
          )}
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Livraison</Text>
            <Text style={styles.summaryValue}>
              {loadingStore ? '...' : shippingPrice > 0 ? `${shippingPrice.toLocaleString()} FCA` : 'Gratuite'}
            </Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total TTC</Text>
            <Text style={styles.totalValue}>{total.toLocaleString()} FCA</Text>
          </View>
        </View>

        {/* Delivery Info */}
        <View style={styles.deliverySection}>
          <View style={styles.deliveryHeader}>
            <Ionicons name="location-outline" size={20} color={COLORS.accent} />
            <Text style={styles.deliveryTitle}>Livraison</Text>
          </View>
          <Text style={styles.deliveryText}>
            La livraison sera effectuée par le vendeur. Vous recevrez les coordonnées WhatsApp pour le suivi.
          </Text>
        </View>

        {/* Payment Methods */}
        <View style={styles.paymentSection}>
          <View style={styles.paymentHeader}>
            <Ionicons name="card-outline" size={20} color={COLORS.accent} />
            <Text style={styles.paymentTitle}>Moyens de paiement</Text>
          </View>
          <View style={styles.paymentOptions}>
            <TouchableOpacity style={styles.paymentOption}>
              <Ionicons name="phone-portrait-outline" size={24} color={COLORS.accent2} />
              <Text style={styles.paymentOptionText}>Mobile Money</Text>
            </TouchableOpacity>
            <View style={styles.paymentOptionSpacer} />
            <TouchableOpacity style={styles.paymentOption}>
              <Ionicons name="cash-outline" size={24} color={COLORS.success} />
              <Text style={styles.paymentOptionText}>Paiement à la livraison</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.totalContainer}>
          <Text style={styles.bottomTotalLabel}>Total TTC</Text>
          <Text style={styles.bottomTotalValue}>{grandTotal.toLocaleString()} FCA</Text>
        </View>
        <TouchableOpacity 
          style={styles.checkoutButton}
          onPress={async () => {
            // Create separate orders per store
            if (items.length === 0) return;
            try {
              setProcessingBulk(true);
              // Ensure user profile
              if (!user?.id) {
                setProcessingBulk(false);
                // ask to login
                navigation.navigate('SellerAuth');
                return;
              }
              await userService.upsertProfile(String(user.id), {
                full_name: user.full_name || 'Client',
                phone: user.whatsapp_number || user.phone || '',
              });

              // group items by store id
              const groups: Record<string, any[]> = {};
              for (const it of items) {
                const sid = (it.product as any)?.store_id || 'unknown';
                groups[sid] = groups[sid] || [];
                groups[sid].push(it);
              }

              const createdOrders: any[] = [];
              for (const [sid, group] of Object.entries(groups)) {
                const storeIdForOrder = sid === 'unknown' ? null : sid;
                const subtotalByStore = group.reduce((s: number, i: any) => s + (i.product.price || 0) * (i.quantity || 0), 0);
                const tax = storeInfo?.tax_rate ? Math.round(subtotalByStore * (storeInfo.tax_rate / 100)) : 0;
                const shipping = storeInfo?.shipping_price || 0;
                const totalForOrder = subtotalByStore + tax + shipping;

                const baseOrderPayload: any = {
                  user_id: String(user.id),
                  store_id: storeIdForOrder,
                  total_amount: Number(totalForOrder),
                  status: 'pending',
                  payment_method: 'cash_on_delivery',
                  payment_status: 'pending',
                  shipping_address: user?.address || null,
                  customer_phone: user?.whatsapp_number || user?.phone || null,
                  notes: null,
                  // include breakdown for server/UI convenience
                  delivery_fee: shipping,
                  tax_amount: tax,
                };

                let created: any;
                try {
                  created = await orderService.create({ ...baseOrderPayload, customer_name: user?.full_name });
                } catch (e: any) {
                  const msg = String(e?.message || '').toLowerCase();
                  const isSchemaCacheIssue = msg.includes('schema') && msg.includes('cache') && msg.includes('customer_name');
                  const isMissingColumnIssue = msg.includes('column') && msg.includes('customer_name');
                  if (isSchemaCacheIssue || isMissingColumnIssue) {
                    created = await orderService.create(baseOrderPayload);
                  } else {
                    throw e;
                  }
                }

                // insert order_items
                try {
                  if (supabase && created?.id) {
                    const rows = group.map((it: any) => ({
                      order_id: created.id,
                      product_id: it.product.id,
                      quantity: it.quantity,
                      price: it.product.price,
                    }));
                    const { error } = await supabase.from('order_items').insert(rows);
                    if (error) errorHandler.handle(error, 'failed to insert order items', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
                  }
                } catch (e) {
                  errorHandler.handle(e, 'order_items insert skipped', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
                }

                // keep order in pending state and do NOT run post-processing here.
                // Payment will trigger the RPC and notifications per-order.
                createdOrders.push(created);
              }

              // navigate to the bulk payment flow so the user can pay each order separately
              navigation.navigate('BulkPayment', {
                createdOrders,
                groups,
              });
            } catch (e) {
              errorHandler.handle(e, 'bulk create orders failed', ErrorCategory.SYSTEM, ErrorSeverity.HIGH);
              Alert.alert('Erreur', 'La création des commandes a échoué. Réessayez.');
            } finally {
              setProcessingBulk(false);
            }
          }}
          disabled={items.length === 0 || processingBulk}
        >
          {processingBulk ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <>
              <Text style={styles.checkoutButtonText}>Passer toutes les commandes</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.text} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
    paddingHorizontal: SPACING.xl,
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
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerRight: {
    width: 40,
  },
  cartSection: {
    paddingHorizontal: SPACING.xl,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
  },
  itemImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemStore: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.accent2,
  },
  quantityBadge: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityMiddle: {
    marginHorizontal: SPACING.sm,
  },
  quantityText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  removeButton: {
    padding: SPACING.xs,
  },
  summarySection: {
    padding: SPACING.xl,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
  },
  summaryValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
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
  deliverySection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  deliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  deliveryTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  deliveryText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    lineHeight: 22,
  },
  paymentSection: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 120,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  paymentTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  paymentOptions: {
    flexDirection: 'row',
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paymentOptionSpacer: {
    width: SPACING.md,
  },
  paymentOptionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    fontWeight: '500',
    marginLeft: SPACING.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.xl,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalContainer: {
    flex: 1,
  },
  bottomTotalLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
  },
  bottomTotalValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
  },
  checkoutButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
    marginRight: SPACING.sm,
  },
});


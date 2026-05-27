import React, { useState, useEffect, useMemo } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useLegacyPalette, type LegacyPalette } from '../hooks/useLegacyPalette';
import { useTheme } from '../hooks/useTheme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useCartStore, useAuthStore } from '../store';
import { RequireAuthPlaceholder } from '../components';
import { storeService } from '../services/storeService';
import { orderService } from '../services/orderService';
import { userService } from '../services/userService';
import { notificationService } from '../services/notificationService';
import { cloudinaryService } from '../services/cloudinaryService';
import { useAlertModal } from '../components/AlertModal';
import OptimizedImage from '../components/OptimizedImage';

const EmptyCartAnimation = ({ color }: { color: string }) => {
  const translateY = useSharedValue(0);
  
  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 1000 }),
        withTiming(0, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name="cart-outline" size={80} color={color} />
    </Animated.View>
  );
};

export const CartScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<any>(null);
  const [loadingStore, setLoadingStore] = useState(false);
  const [storesData, setStoresData] = useState<any[]>([]);

  const { items, removeItem, updateQuantity, getTotal, storeId } = useCartStore();
  const subtotal = getTotal();
  const user = useAuthStore((s) => s.user);
  const clearCart = useCartStore((s) => s.clearCart);
  const [processingBulk, setProcessingBulk] = useState(false);
  const { show: showAlert, AlertModalComponent } = useAlertModal();

  const palette = useLegacyPalette();
  const { spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE } = useTheme();
  const styles = useMemo(
    () => createCartStyles(palette, SPACING, RADIUS, FONT_SIZE),
    [palette, SPACING, RADIUS, FONT_SIZE]
  );

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
  const multiStore = groups.length > 1;

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
      } catch (e: any) {
        errorHandler.handle(e, 'load store for cart', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      } finally {
        if (mounted) setLoadingStore(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [storeId, items]);

  const stockCheckKey = useMemo(
    () => items.map((i) => `${i.product.id}:${i.product.stock ?? 0}:${i.quantity}`).join('|'),
    [items]
  );

  /** Retirer/ajuster les articles dont le stock est insuffisant (données embarquées). */
  useEffect(() => {
    // 1. Articles en rupture totale → retirer
    const outOfStock = items.filter((it) => (it.product.stock ?? 0) <= 0);
    outOfStock.forEach((it) => removeItem(it.product.id));

    // 2. Articles dont la quantité dépasse le stock → ajuster la quantité
    const overStock = items.filter(
      (it) => (it.product.stock ?? 0) > 0 && it.quantity > (it.product.stock ?? 0),
    );
    overStock.forEach((it) => updateQuantity(it.product.id, it.product.stock ?? 1));

    if (outOfStock.length > 0 || overStock.length > 0) {
      const messages: string[] = [];
      if (outOfStock.length > 0) {
        messages.push(`❌ ${outOfStock.length} article(s) en rupture totale ${outOfStock.length > 1 ? 'ont été retirés' : 'a été retiré'} du panier.`);
      }
      if (overStock.length > 0) {
        messages.push(`⚠️ La quantité de ${overStock.length} article(s) a été limitée au stock disponible.`);
      }
      showAlert({
        type: 'warning',
        title: 'Mise à jour du panier',
        message: messages.join('\n'),
      });
    }
  }, [stockCheckKey]);

  if (!user) {
    return (
      <RequireAuthPlaceholder
        title="Mon Panier"
        description="Connectez-vous avec Google pour synchroniser votre panier sur tous vos appareils, commander en toute sécurité et suivre vos livraisons."
        icon="cart-outline"
      />
    );
  }

  const taxRate = store?.tax_rate || 0; // legacy single-store rate for label
  const shippingPrice = store?.shipping_price || 0; // legacy single-store shipping
  // For display and totals we compute aggregated values in-place when rendering
  const total = subtotal; // will add taxes/shipping in UI per-store or aggregated

  const renderCartItem = (item: (typeof items)[number]) => {
    const availableStock = item.product.stock ?? 9999;
    const isAtMaxStock = item.quantity >= availableStock;
    const isLowStock = availableStock > 0 && availableStock <= 3;

    const handleIncrease = () => {
      if (isAtMaxStock) {
        showAlert({
          type: 'warning',
          title: 'Stock maximum atteint',
          message: `Il ne reste que ${availableStock} exemplaire(s) de "${item.product.name}" en stock.`,
        });
        return;
      }
      updateQuantity(item.product.id, item.quantity + 1);
    };

    return (
      <View key={item.product.id} style={styles.cartItem}>
        {item.product.images?.[0] ? (
          <OptimizedImage source={{ uri: cloudinaryService.getOptimizedUrl(item.product.images[0], 300) }} style={styles.itemImage} />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <Ionicons name="image-outline" size={28} color={palette.textMuted} />
          </View>
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
          <Text style={styles.itemStore}>{((item.product as any)?.store_name) || ''}</Text>

          {/* Low stock warning badge */}
          {isLowStock && (
            <View style={styles.lowStockBadge}>
              <Ionicons name="warning-outline" size={12} color="#ea580c" />
              <Text style={styles.lowStockText}>
                Plus que {availableStock} en stock
              </Text>
            </View>
          )}

          <View style={styles.itemBottom}>
            <Text style={styles.itemPrice}>{item.product.price.toLocaleString()} FCA</Text>
            <View style={styles.quantityControls}>
              <Pressable
                style={[styles.quantityBadge, { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border }]}
                onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                hitSlop={10}
              >
                <Text style={[styles.quantityText, { color: palette.text }]}>-</Text>
              </Pressable>
              <View style={[styles.quantityBadge, styles.quantityMiddle]}>
                <Text style={styles.quantityText}>×{item.quantity}</Text>
              </View>
              <Pressable
                style={[styles.quantityBadge, isAtMaxStock && { opacity: 0.4 }]}
                onPress={handleIncrease}
                hitSlop={10}
              >
                <Text style={styles.quantityText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <Pressable style={styles.removeButton} onPress={() => removeItem(item.product.id)} hitSlop={10}>
          <Ionicons name="trash-outline" size={20} color={palette.danger} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            const canGoBack = typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : false;
            if (canGoBack) navigation.goBack();
            else navigation.navigate('ClientTabs', { screen: 'ClientHome' });
          }}
        >
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Panier</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.xxxl + 120 + insets.bottom }}
      >
        <View style={styles.cartSection}>
          {items.length === 0 ? (
            <View style={{ paddingVertical: SPACING.xxxl, alignItems: 'center', marginTop: 40 }}>
              <EmptyCartAnimation color={palette.textMuted} />
              <Text style={{ marginTop: SPACING.xl, color: palette.textMuted, fontSize: FONT_SIZE.md, fontWeight: '600' }}>
                Ton panier est vide
              </Text>
            </View>
          ) : (
            groups.map(([sid, group]) => {
              const storeInfo = storesData.find((s) => s?.id === sid) || (sid === 'unknown' ? { id: 'unknown', name: 'Boutique' } : null);
              const subtotalByStore = group.reduce((s: number, i: any) => s + (i.product.price || 0) * (i.quantity || 0), 0);
              const tax = storeInfo?.tax_rate ? Math.round(subtotalByStore * (storeInfo.tax_rate / 100)) : 0;
              const shipping = storeInfo?.shipping_price || 0;
              const lineTotal = subtotalByStore + tax + shipping;
              const canCheckoutStore = sid !== 'unknown' && !!storeInfo?.id;

              return (
                <View key={`group-${sid}`} style={{ marginBottom: SPACING.xl }}>
                  <View style={[styles.storeBlockHeader, { borderColor: palette.border, backgroundColor: palette.card }]}>
                    <Ionicons name="storefront-outline" size={20} color={palette.accent} />
                    <Text style={[styles.storeBlockTitle, { color: palette.text, fontSize: FONT_SIZE.md }]}>
                      {storeInfo?.name || 'Boutique'}
                    </Text>
                  </View>

                  {group.map((it: any) => renderCartItem(it))}

                  <View style={[styles.storeRecap, { borderColor: palette.border, backgroundColor: palette.card }]}>
                    <Text style={[styles.recapHint, { color: palette.textMuted, fontSize: FONT_SIZE.xs }]}>
                      Total pour cette boutique (TVA et livraison vendeur incluses si configurés)
                    </Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Sous-total</Text>
                      <Text style={styles.summaryValue}>{subtotalByStore.toLocaleString()} FCA</Text>
                    </View>
                    {tax > 0 && (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>TVA {storeInfo?.tax_rate ? `(${storeInfo.tax_rate}%)` : ''}</Text>
                        <Text style={styles.summaryValue}>{tax.toLocaleString()} FCA</Text>
                      </View>
                    )}
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Livraison</Text>
                      <Text style={styles.summaryValue}>{shipping > 0 ? `${shipping.toLocaleString()} FCA` : 'Gratuite'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.totalLabel}>Total TTC boutique</Text>
                      <Text style={styles.totalValue}>{lineTotal.toLocaleString()} FCA</Text>
                    </View>
                    {multiStore && canCheckoutStore && (
                      <TouchableOpacity
                        style={[styles.checkoutButtonOutline, { borderColor: palette.accent, marginTop: SPACING.md }]}
                        onPress={() =>
                          navigation.navigate('Checkout', {
                            storeId: sid,
                            itemsJson: JSON.stringify(group),
                          })
                        }
                      >
                        <Ionicons name="bag-check-outline" size={20} color={palette.accent} />
                        <Text style={[styles.checkoutButtonOutlineText, { color: palette.accent }]}>
                          Commander uniquement cette boutique
                        </Text>
                      </TouchableOpacity>
                    )}
                    {multiStore && !canCheckoutStore && (
                      <Text style={{ marginTop: SPACING.sm, fontSize: FONT_SIZE.xs, color: palette.warning }}>
                        Impossible de commander sans boutique associée à ces articles.
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {items.length > 0 && multiStore && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Synthèse multi-boutiques</Text>
            <Text style={{ fontSize: FONT_SIZE.sm, color: palette.textMuted, marginBottom: SPACING.md }}>
              Chaque boutique appliquera ses propres frais (TVA, livraison). Le bouton ci-dessous crée une commande séparée chez chaque vendeur, puis vous pourrez payer chaque commande.
            </Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sous-total global</Text>
              <Text style={styles.summaryValue}>{subtotal.toLocaleString()} FCA</Text>
            </View>
            {aggregatedTax > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>TVA (toutes boutiques)</Text>
                <Text style={styles.summaryValue}>{aggregatedTax.toLocaleString()} FCA</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Livraison (toutes boutiques)</Text>
              <Text style={styles.summaryValue}>
                {loadingStore ? '...' : aggregatedShipping > 0 ? `${aggregatedShipping.toLocaleString()} FCA` : 'Gratuite'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total estimé TTC</Text>
              <Text style={styles.totalValue}>{grandTotal.toLocaleString()} FCA</Text>
            </View>
          </View>
        )}

        {items.length > 0 && (
          <View style={styles.deliverySection}>
            <View style={styles.deliveryHeader}>
              <Ionicons name="location-outline" size={20} color={palette.accent} />
              <Text style={styles.deliveryTitle}>Livraison</Text>
            </View>
            <Text style={styles.deliveryText}>
              La livraison est organisée par chaque vendeur. Après commande, suivi habituellement par WhatsApp.
            </Text>
          </View>
        )}
      </ScrollView>

      {items.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(SPACING.md, insets.bottom) }]}>
          <View style={styles.totalContainer}>
            <Text style={styles.bottomTotalLabel}>Total TTC {multiStore ? '(estimé)' : ''}</Text>
            <Text style={styles.bottomTotalValue}>{grandTotal.toLocaleString()} FCA</Text>
            {multiStore && (
              <Text style={{ fontSize: FONT_SIZE.xs, color: palette.textMuted, marginTop: 4 }}>
                {groups.length} boutiques · {groups.length} commandes créées
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={async () => {
              if (items.length === 0) return;
              if (!multiStore) {
                const [sid, group] = groups[0];
                if (sid === 'unknown') {
                  showAlert({
                    type: 'error',
                    title: 'Panier',
                    message: 'Impossible de finaliser : boutique inconnue pour certains articles.',
                  });
                  return;
                }
                navigation.navigate('Checkout', {
                  storeId: sid,
                  itemsJson: JSON.stringify(group),
                });
                return;
              }
              try {
                setProcessingBulk(true);
                if (!user?.id) {
                  setProcessingBulk(false);
                  navigation.navigate('SellerAuth');
                  return;
                }
                await userService.upsertProfile(String(user.id), {
                  full_name: user.full_name || 'Client',
                  phone: user.whatsapp_number || user.phone || '',
                });
                const userMetadata = {
                  full_name: user.full_name || 'Client',
                  phone: user.whatsapp_number || user.phone || '',
                  address: (user as any)?.address || null,
                };
                const groupsForService: Record<string, any[]> = {};
                for (const [gsid, grp] of groups) {
                  const storeInfo = storesData.find((s) => s?.id === gsid);
                  const subtotalByStore = grp.reduce((s: number, i: any) => s + (i.product.price || 0) * (i.quantity || 0), 0);
                  const tax = storeInfo?.tax_rate ? Math.round(subtotalByStore * (storeInfo.tax_rate / 100)) : 0;
                  const shipping = storeInfo?.shipping_price || 0;
                  groupsForService[gsid] = grp.map((it: any) => ({
                    ...it,
                    tax_amount: tax,
                    delivery_fee: shipping,
                  }));
                }
                const createdOrders = await orderService.createBulkOrders(String(user.id), groupsForService, userMetadata);
                clearCart();
                navigation.navigate('BulkPayment', {
                  createdOrders,
                  groups: groupsForService,
                });
              } catch (e: any) {
                errorHandler.handle(e, 'bulk create orders failed', ErrorCategory.SYSTEM, ErrorSeverity.HIGH);
                showAlert({
                  type: 'error',
                  title: 'Erreur',
                  message: 'La création des commandes a échoué. Réessayez.',
                });
              } finally {
                setProcessingBulk(false);
              }
            }}
            disabled={items.length === 0 || processingBulk}
          >
            {processingBulk ? (
              <ActivityIndicator color={palette.text} />
            ) : (
              <>
                <Text style={styles.checkoutButtonText}>
                  {multiStore ? `Commander toutes les boutiques (${groups.length})` : 'Passer la commande'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={palette.text} />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
      {AlertModalComponent}
    </View>
  );
};

function createCartStyles(palette: LegacyPalette, SPACING: any, RADIUS: any, FONT_SIZE: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
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
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: palette.text,
  },
  headerRight: {
    width: 40,
  },
  cartSection: {
    paddingHorizontal: SPACING.xl,
  },
  storeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  storeBlockTitle: {
    fontWeight: '700',
    flex: 1,
  },
  storeRecap: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
  recapHint: {
    marginBottom: SPACING.sm,
  },
  checkoutButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  checkoutButtonOutlineText: {
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: palette.border,
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
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: palette.text,
    flexWrap: 'wrap',
    marginBottom: SPACING.xs,
  },
  itemStore: {
    fontSize: FONT_SIZE.sm,
    color: palette.textMuted,
  },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  itemPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: palette.accent2,
  },
  quantityBadge: {
    backgroundColor: palette.accent + '20',
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
    color: palette.accent,
    fontWeight: '600',
  },
  removeButton: {
    padding: SPACING.xs,
    flexShrink: 0,
  },
  summarySection: {
    padding: SPACING.xl,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: palette.text,
    marginBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.md,
    color: palette.textSoft,
    flex: 1,
    flexWrap: 'wrap',
  },
  summaryValue: {
    fontSize: FONT_SIZE.md,
    color: palette.text,
    fontWeight: '600',
    flexShrink: 0,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: SPACING.md,
  },
  totalLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: palette.text,
  },
  totalValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: palette.accent,
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
    color: palette.text,
    marginLeft: SPACING.sm,
  },
  deliveryText: {
    fontSize: FONT_SIZE.sm,
    color: palette.textSoft,
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
    color: palette.text,
    marginLeft: SPACING.sm,
  },
  paymentOptions: {
    flexDirection: 'row',
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  paymentOptionSpacer: {
    width: SPACING.md,
  },
  paymentOptionText: {
    fontSize: FONT_SIZE.sm,
    color: palette.textSoft,
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
    backgroundColor: palette.bg,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  totalContainer: {
    flex: 1,
    minWidth: 0,
    flexBasis: '60%',
  },
  bottomTotalLabel: {
    fontSize: FONT_SIZE.sm,
    color: palette.textSoft,
  },
  bottomTotalValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: palette.text,
    flexWrap: 'wrap',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.accent,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    flexShrink: 0,
    alignSelf: 'flex-end',
    minWidth: 140,
  },
  checkoutButtonText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
    marginRight: SPACING.sm,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7ed',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#ffedd5',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  lowStockText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
  },
});
}


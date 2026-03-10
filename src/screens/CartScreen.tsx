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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useCartStore } from '../store';
import { storeService } from '../lib/supabase';

export const CartScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [store, setStore] = useState<any>(null);
  const [loadingStore, setLoadingStore] = useState(false);

  const { items, removeItem, updateQuantity, getTotal, storeId } = useCartStore();
  const subtotal = getTotal();

  // Load store data for tax and shipping
  useEffect(() => {
    if (!storeId) return;
    const loadStore = async () => {
      try {
        setLoadingStore(true);
        const storeData = await storeService.getById(storeId);
        setStore(storeData);
      } catch (e) {
        console.warn('load store for cart', e);
      } finally {
        setLoadingStore(false);
      }
    };
    loadStore();
  }, [storeId]);

  const taxRate = store?.tax_rate || 0; // %
  const shippingPrice = store?.shipping_price || 0; // FCFA
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount + shippingPrice;

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
        <Text style={styles.itemStore}>{storeId || ''}</Text>
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
        {/* Cart Items */}
        <View style={styles.cartSection}>
          {items.length > 0 ? items.map(renderCartItem) : (
            <View style={{ paddingVertical: SPACING.xxxl, alignItems: 'center' }}>
              <Ionicons name="cart-outline" size={64} color={COLORS.textMuted} />
              <Text style={{ marginTop: SPACING.md, color: COLORS.textMuted, fontSize: FONT_SIZE.md }}>
                Ton panier est vide
              </Text>
            </View>
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
          <Text style={styles.bottomTotalValue}>{total.toLocaleString()} FCA</Text>
        </View>
        <TouchableOpacity 
          style={styles.checkoutButton}
          onPress={() => navigation.navigate('Checkout')}
          disabled={items.length === 0}
        >
          <Text style={styles.checkoutButtonText}>Passer la commande</Text>
          <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
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
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
    marginRight: SPACING.sm,
  },
});


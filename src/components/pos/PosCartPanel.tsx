/**
 * PosCartPanel.tsx
 * Composant partagé : Panneau panier latéral pour les interfaces POS
 * Utilisé par : SellerCaisseScreen, RestaurantCaisseScreen, BarCaisseScreen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../config/theme';
import { type PosCartItem } from './PosMenuGrid';

type Props = {
  cart: PosCartItem[];
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  discount: string;
  onDiscountChange: (val: string) => void;
  accentColor?: string;
  /** Numéro/nom de table optionnel (restaurant/bar) */
  tableLabel?: string;
  /** Label du bouton de validation */
  checkoutLabel?: string;
  /** Afficher le bouton bon de commande cuisine */
  onSendToKitchen?: () => void;
};

const format = (v: number) => v.toLocaleString('fr-FR') + ' FCFA';

export const PosCartPanel = ({
  cart,
  onIncrease,
  onDecrease,
  onRemove,
  onClear,
  onCheckout,
  discount,
  onDiscountChange,
  accentColor = COLORS.info,
  tableLabel,
  checkoutLabel = 'Procéder au paiement',
  onSendToKitchen,
}: Props) => {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = Math.min(parseFloat(discount || '0') || 0, subtotal);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxRate = 18;
  const tax = Math.round(subtotalAfterDiscount * (taxRate / 100));
  const total = subtotalAfterDiscount + tax;
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const renderCartItem = ({ item }: { item: PosCartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.cartItemPrice, { color: accentColor }]}>
          {format(item.price)} / u
        </Text>
        {item.notes ? (
          <Text style={styles.cartItemNotes} numberOfLines={1}>📝 {item.notes}</Text>
        ) : null}
      </View>
      <View style={styles.cartItemActions}>
        <TouchableOpacity
          style={[styles.qtyBtn, { borderColor: accentColor }]}
          onPress={() => onDecrease(item.id)}
        >
          <Ionicons name="remove" size={16} color={accentColor} />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity
          style={[styles.qtyBtn, { backgroundColor: accentColor, borderColor: accentColor }]}
          onPress={() => onIncrease(item.id)}
        >
          <Ionicons name="add" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(item.id)}>
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
      <Text style={styles.cartItemTotal}>{format(item.price * item.quantity)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="cart" size={22} color={accentColor} />
          <Text style={styles.headerTitle}>
            {tableLabel ? `Table ${tableLabel}` : 'Panier'}
          </Text>
          {itemCount > 0 && (
            <View style={[styles.badge, { backgroundColor: accentColor }]}>
              <Text style={styles.badgeText}>{itemCount}</Text>
            </View>
          )}
        </View>
        {cart.length > 0 && (
          <TouchableOpacity onPress={onClear}>
            <Text style={styles.clearText}>Vider</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Liste */}
      {cart.length > 0 ? (
        <FlatList
          data={cart}
          renderItem={renderCartItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          style={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyCart}>
          <Ionicons name="basket-outline" size={48} color="#334155" />
          <Text style={styles.emptyCartText}>Panier vide</Text>
        </View>
      )}

      {/* Footer résumé */}
      {cart.length > 0 && (
        <View style={styles.footer}>
          {/* Réduction */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Réduction (FCFA)</Text>
            <TextInput
              style={[styles.discountInput, { borderColor: accentColor + '60' }]}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              value={discount}
              onChangeText={onDiscountChange}
            />
          </View>

          {/* Sous-total */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>{format(subtotal)}</Text>
          </View>

          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: COLORS.success }]}>Remise</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                - {format(discountAmount)}
              </Text>
            </View>
          )}

          {/* TVA */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>TVA ({taxRate}%)</Text>
            <Text style={styles.summaryValue}>{format(tax)}</Text>
          </View>

          {/* Total */}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total TTC</Text>
            <Text style={[styles.totalValue, { color: accentColor }]}>{format(total)}</Text>
          </View>

          {/* Bouton bon de commande cuisine (restaurant) */}
          {onSendToKitchen && (
            <TouchableOpacity
              style={[styles.kitchenBtn, { borderColor: accentColor }]}
              onPress={onSendToKitchen}
            >
              <Ionicons name="restaurant-outline" size={18} color={accentColor} />
              <Text style={[styles.kitchenBtnText, { color: accentColor }]}>
                Envoyer en cuisine
              </Text>
            </TouchableOpacity>
          )}

          {/* Bouton paiement */}
          <TouchableOpacity style={styles.checkoutBtn} onPress={onCheckout}>
            <LinearGradient
              colors={[accentColor, accentColor + 'CC']}
              style={styles.checkoutGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.checkoutText}>{checkoutLabel}</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  clearText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 0,
  },
  cartItem: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartItemInfo: {
    marginBottom: SPACING.sm,
  },
  cartItemName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  cartItemPrice: {
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  cartItemNotes: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  removeBtn: {
    marginLeft: 'auto' as any,
    padding: 4,
  },
  cartItemTotal: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  emptyCartText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  discountInput: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    width: 100,
    textAlign: 'right',
    backgroundColor: COLORS.card,
  },
  totalRow: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
  },
  kitchenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  kitchenBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  checkoutBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginTop: SPACING.xs,
  },
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  checkoutText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});

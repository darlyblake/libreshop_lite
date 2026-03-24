import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { type Product } from '../lib/supabase';

// Mock order data
const ORDER_DATA = {
  id: 'CMD-2026-001',
  date: '13 Février 2026',
  total: 1220000,
  items: [
    { name: 'iPhone 15 Pro', quantity: 1, price: 850000 },
    { name: 'AirPods Pro 2', quantity: 2, price: 185000 },
  ],
  store: 'Tech Store',
  paymentMethod: 'Mobile Money',
};

export const ConfirmationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    orderId: routeOrderId,
    amount: routeAmount,
    items: routeItems,
    itemsJson,
    customerJson,
    paymentMethod: routePaymentMethod,
  } = route.params || {};

  const parseJsonParam = <T,>(value: any, fallback: T): T => {
    if (!value || typeof value !== 'string') return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };

  const items = Array.isArray(routeItems)
    ? routeItems
    : parseJsonParam<Array<{ product: Product; quantity: number }>>(itemsJson, []);

  const orderId = routeOrderId || ORDER_DATA.id;
  const total = typeof routeAmount === 'number' ? routeAmount : ORDER_DATA.total;

  const paymentMethodLabel =
    routePaymentMethod === 'cash'
      ? 'Paiement à la livraison'
      : routePaymentMethod === 'card'
        ? 'Carte Bancaire'
        : routePaymentMethod === 'mobile_money'
          ? 'Mobile Money'
          : ORDER_DATA.paymentMethod;

  const orderItems = items.length
    ? items.map((it) => ({
        name: it.product.name,
        quantity: it.quantity,
        price: it.product.price,
      }))
    : ORDER_DATA.items;

  const dateLabel = new Date().toLocaleDateString('fr-FR');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={48} color={COLORS.text} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Commande confirmée !</Text>
        <Text style={styles.subtitle}>
          Votre commande a été enregistrée avec succès
        </Text>

        {/* Order ID */}
        <View style={styles.orderIdContainer}>
          <Text style={styles.orderIdLabel}>Numéro de commande</Text>
          <Text style={styles.orderId}>{orderId}</Text>
        </View>

        {/* Order Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt-outline" size={20} color={COLORS.accent} />
            <Text style={styles.cardTitle}>Détails de la commande</Text>
          </View>
          
          {orderItems.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQty}>×{item.quantity}</Text>
              <Text style={styles.itemPrice}>{item.price.toLocaleString()} FCA</Text>
            </View>
          ))}
          
          <View style={styles.divider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{total.toLocaleString()} FCA</Text>
          </View>
        </View>

        {/* Store Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="storefront-outline" size={18} color={COLORS.accent} />
            <Text style={styles.infoLabel}>Boutique</Text>
            <Text style={styles.infoValue}>{ORDER_DATA.store}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="phone-portrait-outline" size={18} color={COLORS.accent} />
            <Text style={styles.infoLabel}>Paiement</Text>
            <Text style={styles.infoValue}>{paymentMethodLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.accent} />
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{dateLabel}</Text>
          </View>
        </View>

        {/* WhatsApp Info */}
        <View style={styles.whatsappCard}>
          <View style={styles.whatsappHeader}>
            <Ionicons name="logo-whatsapp" size={24} color={COLORS.success} />
            <Text style={styles.whatsappTitle}>Prochaine étape</Text>
          </View>
          <Text style={styles.whatsappText}>
            Un message WhatsApp sera envoyé à votre numéro pour :
          </Text>
          <View style={styles.whatsappList}>
            <View style={styles.whatsappItem}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.whatsappItemText}>Confirmer la disponibilité des produits</Text>
            </View>
            <View style={styles.whatsappItem}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.whatsappItemText}>Finaliser le paiement</Text>
            </View>
            <View style={styles.whatsappItem}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.whatsappItemText}>Coordonnées du livreur</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('ClientTabs')}
        >
          <Text style={styles.secondaryButtonText}>Retour à l'accueil</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => navigation.navigate('ClientTabs')}
        >
          <Ionicons name="home" size={20} color={COLORS.text} />
          <Text style={styles.primaryButtonText}>Accueil</Text>
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
  scrollContent: {
    padding: SPACING.xl,
    paddingTop: SPACING.xxxl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  orderIdContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  orderIdLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  orderId: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  itemName: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
  },
  itemQty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginRight: SPACING.md,
  },
  itemPrice: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
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
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  infoLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    marginLeft: SPACING.sm,
  },
  infoValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  whatsappCard: {
    backgroundColor: COLORS.success + '15',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.success + '30',
  },
  whatsappHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  whatsappTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.success,
  },
  whatsappText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginBottom: SPACING.md,
  },
  whatsappList: {
    gap: SPACING.sm,
  },
  whatsappItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  whatsappItemText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.xl,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.textSoft,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.full,
  },
  primaryButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
});


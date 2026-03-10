import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order, OrderStatus } from '../lib/supabase';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';

interface OrderCardProps {
  order: Order;
  storeName?: string;
  itemCount?: number;
  onPress: () => void;
  style?: ViewStyle;
}

const getStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case 'pending':
      return COLORS.warning;
    case 'paid':
      return COLORS.accent;
    case 'shipped':
      return COLORS.accent2;
    case 'delivered':
      return COLORS.success;
    case 'cancelled':
      return COLORS.danger;
    default:
      return COLORS.textMuted;
  }
};

const getStatusLabel = (status: OrderStatus): string => {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'paid':
      return 'Payé';
    case 'shipped':
      return 'Expédié';
    case 'delivered':
      return 'Livré';
    case 'cancelled':
      return 'Annulé';
    default:
      return status;
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  storeName,
  itemCount,
  onPress,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.orderId}>Commande #{order.id.slice(0, 8)}</Text>
          {storeName && <Text style={styles.storeName}>{storeName}</Text>}
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(order.status) + '20' },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {getStatusLabel(order.status)}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.detailText}>{formatDate(order.created_at)}</Text>
        </View>
        {itemCount !== undefined && (
          <View style={styles.detailRow}>
            <Ionicons name="cube-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.detailText}>
              {itemCount} article{itemCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="wallet-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.detailText}>
            {order.total_amount.toLocaleString()} FCFA
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.viewDetails}>Voir les détails</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  orderId: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  storeName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  details: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  detailText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.xs,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewDetails: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
});


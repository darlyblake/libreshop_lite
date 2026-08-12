/**
 * PosCheckoutModal.tsx
 * Composant partagé : Modal de paiement pour les interfaces POS
 * Utilisé par : SellerCaisseScreen, RestaurantCaisseScreen, BarCaisseScreen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../config/theme';

export type PaymentMethod = 'cash' | 'card' | 'transfer';

type Props = {
  visible: boolean;
  total: number;
  customerName?: string;
  customerPhone?: string;
  onCustomerNameChange?: (v: string) => void;
  onCustomerPhoneChange?: (v: string) => void;
  tableLabel?: string;
  accentColor?: string;
  onConfirm: (paymentMethod: PaymentMethod, cashReceived?: number) => Promise<void>;
  onClose: () => void;
};

const format = (v: number) => v.toLocaleString('fr-FR') + ' FCFA';

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: any }[] = [
  { key: 'cash', label: 'Espèces', icon: 'cash-outline' },
  { key: 'card', label: 'Carte', icon: 'card-outline' },
  { key: 'transfer', label: 'Mobile Money', icon: 'phone-portrait-outline' },
];

export const PosCheckoutModal = ({
  visible,
  total,
  customerName = '',
  customerPhone = '',
  onCustomerNameChange,
  onCustomerPhoneChange,
  tableLabel,
  accentColor = COLORS.info,
  onConfirm,
  onClose,
}: Props) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [loading, setLoading] = useState(false);

  const cashAmount = parseFloat(cashReceived || '0') || 0;
  const change = cashAmount - total;
  const canConfirm = paymentMethod !== 'cash' || cashAmount >= total;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setLoading(true);
    try {
      await onConfirm(paymentMethod, paymentMethod === 'cash' ? cashAmount : undefined);
      setCashReceived('');
      setPaymentMethod('cash');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <BlurView intensity={90} tint="dark" style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.wrapper}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Paiement</Text>
                {tableLabel && (
                  <Text style={styles.subtitle}>Table {tableLabel}</Text>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Montant */}
            <View style={[styles.totalBox, { borderColor: accentColor + '40' }]}>
              <Text style={styles.totalLabel}>Total à payer</Text>
              <Text style={[styles.totalAmount, { color: accentColor }]}>
                {format(total)}
              </Text>
            </View>

            {/* Client (optionnel) */}
            {(onCustomerNameChange || onCustomerPhoneChange) && (
              <View style={styles.clientSection}>
                <Text style={styles.sectionLabel}>Client (optionnel)</Text>
                <View style={styles.clientFields}>
                  {onCustomerNameChange && (
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Nom du client"
                      placeholderTextColor={COLORS.textMuted}
                      value={customerName}
                      onChangeText={onCustomerNameChange}
                    />
                  )}
                  {onCustomerPhoneChange && (
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Téléphone"
                      placeholderTextColor={COLORS.textMuted}
                      value={customerPhone}
                      onChangeText={onCustomerPhoneChange}
                      keyboardType="phone-pad"
                    />
                  )}
                </View>
              </View>
            )}

            {/* Méthode de paiement */}
            <Text style={styles.sectionLabel}>Mode de paiement</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[
                    styles.methodBtn,
                    paymentMethod === m.key && {
                      backgroundColor: accentColor + '20',
                      borderColor: accentColor,
                    },
                  ]}
                  onPress={() => setPaymentMethod(m.key)}
                >
                  <Ionicons
                    name={m.icon}
                    size={22}
                    color={paymentMethod === m.key ? accentColor : COLORS.textMuted}
                  />
                  <Text style={[
                    styles.methodLabel,
                    paymentMethod === m.key && { color: accentColor, fontWeight: '700' },
                  ]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Espèces reçues */}
            {paymentMethod === 'cash' && (
              <View style={styles.cashSection}>
                <Text style={styles.sectionLabel}>Espèces reçues</Text>
                <TextInput
                  style={[styles.cashInput, { borderColor: accentColor + '60' }]}
                  keyboardType="numeric"
                  placeholder={`Min. ${format(total)}`}
                  placeholderTextColor={COLORS.textMuted}
                  value={cashReceived}
                  onChangeText={setCashReceived}
                  autoFocus
                />
                {cashAmount >= total && (
                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>Monnaie à rendre :</Text>
                    <Text style={[styles.changeAmount, { color: COLORS.success }]}>
                      {format(change)}
                    </Text>
                  </View>
                )}
                {cashAmount > 0 && cashAmount < total && (
                  <Text style={styles.insufficientText}>
                    Montant insuffisant — manque {format(total - cashAmount)}
                  </Text>
                )}
              </View>
            )}

            {/* Bouton confirmer */}
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm || loading}
            >
              <LinearGradient
                colors={canConfirm ? [accentColor, accentColor + 'CC'] : ['#94a3b8', '#94a3b8']}
                style={styles.confirmGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.confirmText}>Valider le paiement</Text>
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  wrapper: {
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 36 : SPACING.xl,
    gap: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  totalBox: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  totalLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
  },
  clientSection: {
    gap: SPACING.sm,
  },
  clientFields: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
  methodRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  methodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  methodLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  cashSection: {
    gap: SPACING.sm,
  },
  cashInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    textAlign: 'right',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  changeAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  insufficientText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  confirmText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { Card } from '../components/Card';
import { supabase, type Product } from '../lib/supabase';
import { authService, orderService } from '../lib/supabase';
import { userService } from '../lib/userService';
import { useAuthStore, useCartStore } from '../store';

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  description: string;
  providers: string[];
}

export const PaymentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    amount = 0,
    orderId: routeOrderId,
    storeId,
    items: routeItems,
    customer: routeCustomer,
    itemsJson,
    customerJson,
    paymentMethod,
  } = route.params || {};

  const orderId = routeOrderId || `ORD-${Date.now()}`;

  const user = useAuthStore((s) => s.user);
  const { clearCart, removeItem } = useCartStore();

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
  const customer = routeCustomer || parseJsonParam<any>(customerJson, undefined);

  const [selectedMethod, setSelectedMethod] = useState<string>(paymentMethod || 'mobile_money');
  const [phoneNumber, setPhoneNumber] = useState(customer?.phone || '');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'mobile_money',
      name: 'Mobile Money',
      icon: 'phone-portrait-outline',
      description: 'Orange Money, Moov, MTN...',
      providers: ['Orange Money', 'Moov Money', 'MTN Money', 'Glo Mobile'],
    },
    {
      id: 'card',
      name: 'Carte Bancaire',
      icon: 'card-outline',
      description: 'Visa, Mastercard...',
      providers: ['Visa', 'Mastercard', 'American Express'],
    },
    {
      id: 'bank_transfer',
      name: 'Virement Bancaire',
      icon: 'swap-horizontal-outline',
      description: 'Virement direct',
      providers: ['Compte Benin', 'Compte Nigeria', 'Compte International'],
    },
    {
      id: 'cash',
      name: 'À la Livraison',
      icon: 'cash-outline',
      description: 'Paiement à la réception',
      providers: [],
    },
  ];

  const handlePayment = () => {
    if (selectedMethod === 'mobile_money' && !phoneNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro tél.')
      return;
    }
    if (selectedMethod === 'card' && (!cardNumber.trim() || !cardExpiry.trim() || !cardCVV.trim())) {
      Alert.alert('Erreur', 'Veuillez compléter les données de la carte')
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmPayment = async () => {
    setShowConfirmModal(false);
    setProcessing(true);
    setErrorMessage(null);

    try {
      if (!storeId) throw new Error('storeId manquant');
      let userId = user?.id;
      if (!userId) {
        if (!supabase) throw new Error('Utilisateur non connecté');

        try {
          const { data, error } = await supabase.auth.getUser();
          if (error) throw error;
          userId = data?.user?.id || undefined;
        } catch {
          // ignore, will try anonymous sign-in below
        }

        if (!userId) {
          // Anonymous sign-ins may be disabled on the Supabase project.
          // In that case we must require an explicit login.
          try {
            await authService.signInAnonymously();
            const { data } = await supabase.auth.getUser();
            userId = data?.user?.id || undefined;
          } catch (e) {
            errorHandler.handle(e instanceof Error ? e : new Error(String(e)), 'failed to create guest session at payment time', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
          }
        }
      }

      if (!userId) {
        setProcessing(false);
        setErrorMessage('Veuillez vous connecter pour passer commande');
        Alert.alert('Connexion requise', 'Veuillez vous connecter pour passer commande', [
          {
            text: 'Se connecter',
            onPress: () => navigation.navigate('SellerAuth'),
          },
          { text: 'Annuler', style: 'cancel' },
        ]);
        return;
      }
      if (!Array.isArray(items) || items.length === 0) throw new Error('Panier vide');

      await userService.upsertProfile(userId, {
        full_name: customer?.name || 'Client',
        phone: phoneNumber,
        whatsapp_number: phoneNumber,
      });

      const isExisting = !!route.params?.existingOrder;

      if (isExisting) {
        // Pay an existing order: mark as paid, insert order_items if needed, run post-processing RPC and notify seller
        const existingOrderId = routeOrderId;
        if (!existingOrderId) throw new Error('orderId manquant pour paiement existant');

        try {
          // update order payment status
          const paymentMethodDb =
            selectedMethod === 'cash'
              ? 'cash_on_delivery'
              : selectedMethod === 'card'
              ? 'card'
              : 'mobile_money';

          const { data: updatedOrder, error: updErr } = await supabase
            .from('orders')
            .update({ payment_status: 'paid', payment_method: paymentMethodDb, status: 'paid' })
            .eq('id', existingOrderId)
            .select('*')
            .single();
          if (updErr) throw updErr;

          // insert order_items if provided (best-effort)
          try {
            if (supabase && Array.isArray(items) && items.length > 0) {
              const rows = items.map((it: { product: Product; quantity: number }) => ({
                order_id: existingOrderId,
                product_id: it.product.id,
                quantity: it.quantity,
                price: it.product.price,
              }));
              const { error } = await supabase.from('order_items').insert(rows);
              if (error) console.warn('failed to insert order items for existing order', error);
            }
          } catch (e) {
            console.warn('order_items insert skipped for existing order', e);
          }

          // run RPC to decrement stock + notify seller
          try {
            if (supabase) {
              const { error } = await supabase.rpc('process_order_after_payment', { p_order_id: existingOrderId });
              if (error) console.warn('process_order_after_payment failed for existing order', error);
            }
          } catch (e) {
            console.warn('process_order_after_payment skipped for existing order', e);
          }

          // client-side notification (best-effort)
          try {
            const { storeService } = await import('../lib/supabase');
            const { notificationService } = await import('../lib/notificationService');
            if (storeId) {
              const store = await storeService.getById(String(storeId));
              if (store?.user_id) {
                await notificationService.create({
                  user_id: store.user_id,
                  title: 'Nouvelle commande 🛍️',
                  body: `Vous avez reçu une nouvelle commande de ${customer?.name || 'un client'} pour un montant de ${(amount / 1000).toFixed(0)} KCFA.`,
                  type: 'order',
                  read: false,
                  data: { orderId: existingOrderId, storeId },
                });
              }
            }
          } catch (e) {
            console.warn('notification creation failed for existing order', e);
          }

          // remove paid items from cart
          try {
            if (Array.isArray(items) && items.length > 0) {
              for (const it of items) {
                try { removeItem(it.product.id); } catch (e) { /* ignore */ }
              }
            }
          } catch (e) {
            console.warn('failed to remove items from cart after existing order payment', e);
          }

          const successTitle = 'Paiement réussi';
          const successMessage = `Votre paiement de ${(amount / 1000).toFixed(0)} KCFA a été traité avec succès.`;
          if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).alert === 'function') {
            (window as any).alert(`${successTitle}\n\n${successMessage}`);
          }

          Alert.alert(
            successTitle,
            successMessage,
            [
              {
                text: 'Continuer',
                onPress: () => {
                  navigation.navigate('Confirmation', {
                    orderId: existingOrderId,
                    amount,
                    storeId,
                    itemsJson: JSON.stringify(items),
                    customerJson: JSON.stringify(customer || {}),
                    paymentMethod: selectedMethod,
                  });
                },
              },
            ]
          );
        } catch (e: any) {
          throw e;
        }
      } else {
        // existing flow: create order then process
        const baseOrderPayload = {
          user_id: userId,
          store_id: String(storeId),
          total_amount: Number(amount),
          status: 'pending' as const,
          payment_method:
            (selectedMethod === 'cash'
              ? 'cash_on_delivery'
              : selectedMethod === 'card'
                ? 'card'
                : 'mobile_money') as any,
          payment_status: 'paid' as const,
          shipping_address: customer?.address,
          customer_phone: phoneNumber,
          notes: customer?.notes,
        };

        let created: any;
        try {
          created = await orderService.create({
            ...baseOrderPayload,
            customer_name: customer?.name,
          });
        } catch (e: any) {
          const msg = typeof e?.message === 'string' ? e.message : '';
          const isSchemaCacheIssue =
            msg.toLowerCase().includes('schema') &&
            msg.toLowerCase().includes('cache') &&
            msg.toLowerCase().includes('customer_name');
          const isMissingColumnIssue =
            msg.toLowerCase().includes('column') &&
            msg.toLowerCase().includes('customer_name');

          if (isSchemaCacheIssue || isMissingColumnIssue) {
            created = await orderService.create(baseOrderPayload);
          } else {
            throw e;
          }
        }

        // Insert order items (best effort). If the table differs, we still continue to confirmation.
        try {
          if (supabase) {
            const rows = items.map((it: { product: Product; quantity: number }) => ({
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

        // Decrement stock + notify seller (best effort)
        try {
          if (supabase && created?.id) {
            const { error } = await supabase.rpc('process_order_after_payment', {
              p_order_id: created.id,
            });
            if (error) errorHandler.handle(error, 'process_order_after_payment failed', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
          }
        } catch (e) {
          errorHandler.handle(e, 'process_order_after_payment skipped', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
        }

        // Notification créée par le RPC process_order_after_payment, mais on en ajoute une côté client 
        // pour garantir une réception instantanée et fiable même si le RPC a un délai ou échoue.
        try {
          const { storeService } = await import('../lib/supabase');
          const { notificationService } = await import('../lib/notificationService');
          
          if (storeId) {
            const store = await storeService.getById(String(storeId));
            if (store?.user_id) {
              await notificationService.create({
                user_id: store.user_id,
                title: 'Nouvelle commande 🛍️',
                body: `Vous avez reçu une nouvelle commande de ${customer?.name || 'un client'} pour un montant de ${(amount / 1000).toFixed(0)} KCFA.`,
                type: 'order',
                read: false,
                data: {
                  orderId: created?.id,
                  storeId: storeId,
                }
              });
            }
          }
        } catch (e) {
          errorHandler.handle(e instanceof Error ? e : new Error(String(e)), 'notification creation failed', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
        }


        clearCart();

        const successTitle = 'Paiement réussi';
        const successMessage = `Votre paiement de ${(amount / 1000).toFixed(0)} KCFA a été traité avec succès.`;
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).alert === 'function') {
          (window as any).alert(`${successTitle}\n\n${successMessage}`);
        }

        Alert.alert(
          successTitle,
          successMessage,
          [
            {
              text: 'Continuer',
              onPress: () => {
                navigation.navigate('Confirmation', {
                  orderId: created.id,
                  amount,
                  storeId,
                  itemsJson: JSON.stringify(items),
                  customerJson: JSON.stringify(customer || {}),
                  paymentMethod: selectedMethod,
                });
              },
            },
          ]
        );
      }
    } catch (e: any) {
      errorHandler.handle(e, 'payment confirm failed', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      const msg =
        typeof e?.message === 'string'
          ? e.message
          : typeof e === 'string'
            ? e
            : 'Impossible de finaliser la commande';
      setErrorMessage(msg);

      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).alert === 'function') {
        (window as any).alert(`Erreur\n\n${msg}`);
      }

      Alert.alert('Erreur', msg);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return (value / 1000).toFixed(0) + ' KCFA';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Numéro de commande</Text>
            <Text style={styles.summaryValue}>{orderId}</Text>
          </View>
          <View style={[styles.summaryRow, styles.divider]}>
            <Text style={styles.summaryLabel}>Montant à payer</Text>
            <Text style={styles.amountValue}>{formatCurrency(amount)}</Text>
          </View>
        </View>

        {Array.isArray(items) && items.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Articles</Text>
              <Text style={styles.summaryValue}>{items.length}</Text>
            </View>
            {items.slice(0, 5).map((it: { product: Product; quantity: number }) => (
              <View key={it.product.id} style={styles.summaryRow}>
                <Text style={styles.summaryLabel} numberOfLines={1}>
                  {it.product.name} × {it.quantity}
                </Text>
                <Text style={styles.summaryValue}>
                  {(it.product.price * it.quantity).toLocaleString()} FCA
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Méthode de paiement</Text>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                selectedMethod === method.id && styles.methodCardSelected,
              ]}
              onPress={() => setSelectedMethod(method.id)}
            >
              <View style={styles.methodIcon}>
                <Ionicons
                  name={method.icon as any}
                  size={24}
                  color={selectedMethod === method.id ? COLORS.accent : COLORS.textMuted}
                />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodName}>{method.name}</Text>
                <Text style={styles.methodDesc}>{method.description}</Text>
              </View>
              <Ionicons
                name={selectedMethod === method.id ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={selectedMethod === method.id ? COLORS.accent : COLORS.border}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment Details Form */}
        {selectedMethod === 'mobile_money' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Détails Mobile Money</Text>
            <TextInput
              style={styles.input}
              placeholder="Numéro tél. (ex: +229 90123456)"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
            <Text style={styles.helperText}>
              Vous recevrez une confirmation sur ce numéro
            </Text>
          </View>
        )}

        {selectedMethod === 'card' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Données de la carte</Text>
            <TextInput
              style={styles.input}
              placeholder="Numéro de carte (16 chiffres)"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              maxLength={16}
              value={cardNumber}
              onChangeText={setCardNumber}
            />
            <View style={styles.cardRow}>
              <TextInput
                style={[styles.input, styles.cardInput]}
                placeholder="MM/YY"
                placeholderTextColor={COLORS.textMuted}
                value={cardExpiry}
                onChangeText={setCardExpiry}
              />
              <TextInput
                style={[styles.input, styles.cardInput]}
                placeholder="CVV"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                value={cardCVV}
                onChangeText={setCardCVV}
              />
            </View>
          </View>
        )}

        {selectedMethod === 'bank_transfer' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations bancaires</Text>
            <Card style={styles.bankCard}>
              <View style={styles.bankInfo}>
                <Text style={styles.bankLabel}>Titulaire du compte</Text>
                <Text style={styles.bankValue}>LibreShop SARL</Text>
              </View>
              <View style={styles.bankInfo}>
                <Text style={styles.bankLabel}>IBAN</Text>
                <Text style={styles.bankValue}>BJ26 1556 2000 0100 0001 0001 00</Text>
              </View>
              <View style={styles.bankInfo}>
                <Text style={styles.bankLabel}>BIC</Text>
                <Text style={styles.bankValue}>ECOPBJJ</Text>
              </View>
              <View style={styles.bankInfo}>
                <Text style={styles.bankLabel}>Montant</Text>
                <Text style={styles.bankValue}>{formatCurrency(amount)}</Text>
              </View>
              <Text style={styles.bankNote}>
                Veuillez copier ces informations et effectuer le virement depuis votre banque.
              </Text>
            </Card>
          </View>
        )}

        {selectedMethod === 'cash' && (
          <View style={styles.section}>
            <Card style={styles.cashCard}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
              <Text style={styles.cashTitle}>Paiement à la Livraison</Text>
              <Text style={styles.cashDesc}>
                Vous paierez le montant de {formatCurrency(amount)} lors de la réception de votre commande.
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Payment Button */}
      <View style={styles.footer}>
        {!!errorMessage && (
          <Text style={styles.errorText} numberOfLines={3}>
            {errorMessage}
          </Text>
        )}
        <Pressable
          style={[styles.payButton, processing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={processing}
          hitSlop={10}
        >
          {processing ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.text} />
              <Text style={styles.payButtonText}>
                Payer {formatCurrency(amount)}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Confirmer le paiement</Text>
            <View style={styles.confirmInfo}>
              <Text style={styles.confirmLabel}>Méthode</Text>
              <Text style={styles.confirmValue}>
                {paymentMethods.find(m => m.id === selectedMethod)?.name}
              </Text>
            </View>
            <View style={styles.confirmInfo}>
              <Text style={styles.confirmLabel}>Montant</Text>
              <Text style={styles.confirmValueLarge}>{formatCurrency(amount)}</Text>
            </View>
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmButton}
                onPress={() => setShowConfirmModal(false)}
                hitSlop={10}
              >
                <Text style={styles.confirmButtonText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonPrimary]}
                onPress={confirmPayment}
                hitSlop={10}
              >
                <Text style={[styles.confirmButtonText, styles.confirmButtonTextPrimary]}>
                  Confirmer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingTop: SPACING.xxl,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  summaryCard: {
    backgroundColor: COLORS.accent + '20',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  summaryValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  amountValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.accent,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  methodCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '10',
  },
  methodIcon: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  methodDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    marginBottom: SPACING.md,
  },
  cardRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cardInput: {
    flex: 1,
    marginBottom: 0,
  },
  helperText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: -SPACING.md,
    marginBottom: SPACING.md,
  },
  bankCard: {
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
  },
  bankInfo: {
    marginBottom: SPACING.lg,
  },
  bankLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  bankValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.accent,
    fontFamily: 'monospace',
  },
  bankNote: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  cashCard: {
    padding: SPACING.xl,
    alignItems: 'center',
    backgroundColor: COLORS.success + '10',
  },
  cashTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  cashDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  payButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  errorText: {
    color: COLORS.danger,
    marginBottom: SPACING.sm,
    fontSize: FONT_SIZE.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  confirmModal: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  confirmInfo: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  confirmLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  confirmValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 4,
  },
  confirmValueLarge: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.accent,
    marginTop: 4,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  confirmButtonPrimary: {
    backgroundColor: COLORS.accent,
  },
  confirmButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmButtonTextPrimary: {
    color: COLORS.text,
  },
});

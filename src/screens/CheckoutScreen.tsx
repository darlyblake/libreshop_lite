import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useAuthStore, useCartStore } from '../store';
import { genericStorage } from '../lib/storage';
import { storeService } from '../services/storeService';
import { orderService } from '../services/orderService';
import { userService } from '../services/userService';
import { authService } from '../services/authService';

export const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const { items: globalItems, getTotal, storeId: storeIdFromStore, clearCart } = useCartStore();
  const route = useRoute<any>();

  // allow passing `itemsJson` or `items` in navigation to checkout a subset (per-store)
  const paramItems = (() => {
    const p = route.params || {};
    if (Array.isArray(p.items)) return p.items;
    // If itemsJson passed explicitly, parse it
    if (typeof p.itemsJson === 'string') {
      try { return JSON.parse(p.itemsJson); } catch { return undefined; }
    }

    // Handle malformed web query where items was serialized as "[object Object]"
    if (typeof p.items === 'string') {
      try {
        // Try to recover from a JSON string in the URL query (itemsJson)
        if (typeof window !== 'undefined' && typeof URLSearchParams !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const itemsJsonFromQuery = params.get('itemsJson') || params.get('items');
          if (itemsJsonFromQuery) {
            try { return JSON.parse(decodeURIComponent(itemsJsonFromQuery)); } catch {}
          }
        }
      } catch (e) {
        // ignore
      }
    }

    return undefined;
  })();

  const items = paramItems ?? globalItems;
  const activeStoreId = route.params?.storeId ?? storeIdFromStore;
  const [store, setStore] = useState<any>(null);
  const [loadingStore, setLoadingStore] = useState(false);
    const [storesData, setStoresData] = useState<any[]>([]);
    const [aggregatedTaxAmount, setAggregatedTaxAmount] = useState(0);
    const [aggregatedShipping, setAggregatedShipping] = useState(0);

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    phone: user?.whatsapp_number || user?.phone || '',
    address: '',
    notes: '',
  });
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load store data for tax and shipping. Supports single-store or mixed carts.
  useEffect(() => {
    let mounted = true;
    const loadStores = async () => {
      try {
        setLoadingStore(true);

            // If a single storeId is locked, load that store only
            if (activeStoreId) {
              const storeData = await storeService.getById(activeStoreId);
          if (!mounted) return;
              setStore(storeData);
              setStoresData(storeData ? [storeData] : []);
              // compute aggregated values for single store -- use passed items when available
              const subtotalSingle = (paramItems && Array.isArray(paramItems))
                ? paramItems.reduce((s: number, it: any) => s + (it.product.price || 0) * (it.quantity || 0), 0)
                : getTotal();
          const taxAmt = storeData?.tax_rate ? subtotalSingle * (storeData.tax_rate / 100) : 0;
          const ship = storeData?.shipping_price || 0;
          setAggregatedTaxAmount(Math.round(taxAmt));
          setAggregatedShipping(ship);
          return;
        }

        // Mixed cart: gather unique store ids from items and fetch each store
        const ids = Array.from(new Set((paramItems ?? items).map((i: any) => (i.product as any)?.store_id).filter(Boolean)));
        if (ids.length === 0) {
          setStore(null);
          setStoresData([]);
          setAggregatedTaxAmount(0);
          setAggregatedShipping(0);
          return;
        }

        const stores = await Promise.all(ids.map((id: unknown) => storeService.getById(id as string)));
        if (!mounted) return;
        setStore(null);
        setStoresData(stores.filter(Boolean));

        // compute subtotal per store
        const subtotalByStore: Record<string, number> = {};
        (paramItems ?? items).forEach((it: any) => {
          const sid = (it.product as any)?.store_id || (it as any).store_id;
          if (!sid) return;
          subtotalByStore[sid] = (subtotalByStore[sid] || 0) + ((it.product?.price || 0) * (it.quantity || 0));
        });

        let taxSum = 0;
        let shippingSum = 0;
        for (const s of stores) {
          if (!s) continue;
          const sid = s.id;
          const storeSubtotal = subtotalByStore[sid] || 0;
          const t = s.tax_rate ? storeSubtotal * (s.tax_rate / 100) : 0;
          taxSum += t;
          shippingSum += s.shipping_price || 0;
        }
        setAggregatedTaxAmount(Math.round(taxSum));
        setAggregatedShipping(shippingSum);
      } catch (e) {
        errorHandler.handle(e, 'load store for checkout', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      } finally {
        if (mounted) setLoadingStore(false);
      }
    };
    loadStores();
    return () => { mounted = false; };
  }, [activeStoreId, items, paramItems]);

  const subtotal = (paramItems && Array.isArray(paramItems))
    ? paramItems.reduce((s: number, it: any) => s + (it.product.price || 0) * (it.quantity || 0), 0)
    : getTotal();
  const taxRate = store?.tax_rate || 0; // legacy single-store rate for label
  const shippingPrice = store?.shipping_price || 0; // legacy single-store shipping
  const taxAmount = store ? Math.round(subtotal * (taxRate / 100)) : aggregatedTaxAmount;
  const total = subtotal + taxAmount + (store ? shippingPrice : aggregatedShipping);
  const cartEmpty = (paramItems ? paramItems.length === 0 : items.length === 0);

  useEffect(() => {
    const restore = async () => {
      const saved = await genericStorage.getItem<any>('@libreshop_client_profile');
      if (saved) {
        setFormData((prev) => ({
          ...prev,
          name: String(saved?.name || prev.name || ''),
          phone: String(saved?.phone || prev.phone || ''),
          address: String(saved?.address || prev.address || ''),
          notes: String(saved?.notes || prev.notes || ''),
        }));
      }
    };
    restore();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      genericStorage.setItem('@libreshop_client_profile', next);
      return next;
    });

    // Clear error for this field when user edits it
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
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

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Delivery Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={20} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Adresse de livraison</Text>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nom complet</Text>
            <TextInput
              style={[styles.input, errors.name ? { borderColor: COLORS.danger } : null]}
              placeholder="Votre nom"
              placeholderTextColor={COLORS.textMuted}
              value={formData.name}
              onChangeText={(v) => handleInputChange('name', v)}
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Téléphone WhatsApp</Text>
            <TextInput
              style={[styles.input, errors.phone ? { borderColor: COLORS.danger } : null]}
              placeholder="+241 XX XXX XXXX"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(v) => handleInputChange('phone', v)}
            />
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Adresse de livraison</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, errors.address ? { borderColor: COLORS.danger } : null]}
              placeholder="Ville, quartier, rue..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              value={formData.address}
              onChangeText={(v) => handleInputChange('address', v)}
            />
            {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Notes (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Instructions spéciales pour la livraison..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={2}
              value={formData.notes}
              onChangeText={(v) => handleInputChange('notes', v)}
            />
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card-outline" size={20} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Moyen de paiement</Text>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.paymentOption,
              { opacity: 0.6 },
            ]}
            disabled
            accessibilityLabel="Mobile Money temporairement désactivé"
          >
            <Ionicons name="phone-portrait-outline" size={24} color={COLORS.accent2} />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>Mobile Money</Text>
              <Text style={[styles.paymentDesc, { color: COLORS.textMuted }]}>Temporairement désactivé</Text>
            </View>
            <View style={[
              styles.radioButton,
              { borderColor: COLORS.border }
            ]}>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.paymentOption,
              paymentMethod === 'cash' && styles.paymentOptionActive
            ]}
            onPress={() => setPaymentMethod('cash')}
          >
            <Ionicons name="cash-outline" size={24} color={COLORS.success} />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>Paiement à la livraison</Text>
              <Text style={styles.paymentDesc}>Payez en espèces lors de la réception</Text>
            </View>
            <View style={[
              styles.radioButton,
              paymentMethod === 'cash' && styles.radioButtonActive
            ]}>
              {paymentMethod === 'cash' && (
                <View style={styles.radioInner} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={20} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Résumé de la commande</Text>
          </View>
          
          <View style={styles.summaryCard}>
            {(paramItems ?? items).map((item: any) => (
              <View key={item.product.id} style={styles.summaryRow}>
                <Text style={styles.summaryLabel} numberOfLines={1}>
                  {item.product.name} × {item.quantity}
                </Text>
                <Text style={styles.summaryValue}>
                  {(item.product.price * item.quantity).toLocaleString()} FCA
                </Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sous-total</Text>
              <Text style={styles.summaryValue}>{subtotal.toLocaleString()} FCA</Text>
            </View>
            {/* Taxes */}
            {storesData.length <= 1 ? (
              taxRate > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>TVA ({taxRate}%)</Text>
                  <Text style={styles.summaryValue}>{taxAmount.toLocaleString()} FCA</Text>
                </View>
              )
            ) : (
              // Mixed cart: show per-store tax lines
              storesData.map((s) => {
                const sid = s?.id;
                const storeSubtotal = (paramItems ?? items).reduce((sum: number, it: any) => {
                  return sum + ((it.product as any)?.store_id === sid ? (it.product.price || 0) * (it.quantity || 0) : 0);
                }, 0);
                const tax = s?.tax_rate ? Math.round(storeSubtotal * (s.tax_rate / 100)) : 0;
                return (
                  <View style={styles.summaryRow} key={`tax-${sid}`}>
                    <Text style={styles.summaryLabel}>TVA {s?.name ? `(${s.name})` : ''}</Text>
                    <Text style={styles.summaryValue}>{tax.toLocaleString()} FCA</Text>
                  </View>
                );
              })
            )}

            {/* Shipping */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Livraison</Text>
              <Text style={styles.summaryValue}>
                {loadingStore ? '...' : (store ? (shippingPrice > 0 ? `${shippingPrice.toLocaleString()} FCA` : 'Gratuite') : `${aggregatedShipping.toLocaleString()} FCA`)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total TTC</Text>
              <Text style={styles.totalValue}>{total.toLocaleString()} FCA</Text>
            </View>
          </View>
        </View>

        {/* WhatsApp Contact Info */}
        <View style={styles.whatsappInfo}>
          <Ionicons name="logo-whatsapp" size={24} color={COLORS.success} />
          <Text style={styles.whatsappText}>
            Après commande, vous recevrez un message WhatsApp pour confirmer et finaliser le paiement
          </Text>
        </View>

        <View style={styles.whatsappInfo}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.textMuted} />
          <Text style={styles.whatsappText}>
            Vos informations sont enregistrées sur cet appareil pour éviter de les ressaisir. Si vous changez de téléphone, elles peuvent être perdues.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.totalContainer}>
          <Text style={styles.bottomTotalLabel}>Total TTC</Text>
          <Text style={styles.bottomTotalValue}>{total.toLocaleString()} FCA</Text>
        </View>
          <TouchableOpacity 
          style={[styles.orderButton, (cartEmpty || processing || completed) && { opacity: 0.6 }]}
          disabled={cartEmpty || processing || completed}
          onPress={async () => {
            // Validate items exist and are parseable
            if (!Array.isArray(paramItems) && !Array.isArray(items)) {
              // Attempt to recover from URL query if possible
              if (typeof window !== 'undefined' && typeof URLSearchParams !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                const raw = params.get('itemsJson') || params.get('items');
                if (!raw || raw === '[object Object]') {
                  if (typeof window !== 'undefined' && Platform.OS === 'web') {
                    window.alert('Erreur: Impossible de lire le panier depuis l’URL. Retournez au panier et recommencez.');
                  } else {
                    Alert.alert('Erreur', 'Impossible de lire le panier depuis l’URL. Retournez au panier et recommencez.');
                  }
                  return;
                }
                try {
                  const recovered = JSON.parse(decodeURIComponent(raw));
                  if (!Array.isArray(recovered) || recovered.length === 0) {
                    if (typeof window !== 'undefined' && Platform.OS === 'web') {
                      window.alert('Erreur: Le panier est vide ou mal formé.');
                    } else {
                      Alert.alert('Erreur', 'Le panier est vide ou mal formé.');
                    }
                    return;
                  }
                } catch (e) {
                  if (typeof window !== 'undefined' && Platform.OS === 'web') {
                    window.alert('Erreur: Impossible de décoder les articles de la commande.');
                  } else {
                    Alert.alert('Erreur', 'Impossible de décoder les articles de la commande.');
                  }
                  return;
                }
              } else {
                Alert.alert('Erreur', 'Panier introuvable.');
                return;
              }
            }

            // Basic form validation — collect field errors and show them on the form
            const newErrors: Record<string, string> = {};
            if (!formData.name || formData.name.trim().length < 2) {
              newErrors.name = 'Veuillez entrer votre nom complet.';
            }
            if (!formData.phone || formData.phone.trim().length < 6) {
              newErrors.phone = 'Veuillez entrer un numéro de téléphone valide.';
            }
            if (!formData.address || formData.address.trim().length < 5) {
              newErrors.address = 'Veuillez entrer votre adresse de livraison.';
            }

            if (Object.keys(newErrors).length > 0) {
              setErrors(newErrors);
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.alert('Erreur: Veuillez corriger les champs marqués.');
              } else {
                Alert.alert('Erreur', 'Veuillez corriger les champs marqués.');
              }
              return;
            }

            // Create order directly (commande)
            setProcessing(true);
            try {
              // ensure user exists
              let userId = user?.id;
              if (!userId) {
                try {
                  await authService.signInAnonymously();
                  const u = await authService.getCurrentUser();
                  userId = u?.id;
                } catch (e) {
                  // ignore - will require login
                }
              }

              if (!userId) {
                setProcessing(false);
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  const ok = window.confirm('Connexion requise: veuillez vous connecter pour passer commande. Voulez-vous vous connecter maintenant ?');
                  if (ok) navigation.navigate('SellerAuth');
                } else {
                  Alert.alert('Connexion requise', 'Veuillez vous connecter pour passer commande', [
                    { text: 'Se connecter', onPress: () => navigation.navigate('SellerAuth') },
                    { text: 'Annuler', style: 'cancel' },
                  ]);
                }
                return;
              }

              const updatedUser = await userService.upsertProfile(userId, {
                full_name: formData.name,
                phone: formData.phone,
                whatsapp_number: formData.phone,
                address: formData.address,
              });

              // Refresh global auth state with updated user data
              useAuthStore.getState().setUser(updatedUser);

              const payload = {
                user_id: userId,
                store_id: String(activeStoreId),
                total_amount: Number(total),
                status: 'pending',
                payment_method: paymentMethod === 'cash' ? 'cash_on_delivery' : paymentMethod,
                payment_status: 'paid',
                shipping_address: formData.address,
                customer_phone: formData.phone,
                notes: formData.notes,
                customer_name: formData.name,
              } as any;

              const created = await orderService.create(payload);

              // insert items
              try {
                const rows = (paramItems ?? items).map((it: any) => ({
                  order_id: created.id,
                  product_id: it.product.id,
                  quantity: it.quantity,
                  price: it.product.price,
                }));
                await orderService.createItems(rows);
                // Envoi best-effort d'une notification vendeur côté client
                try {
                  await orderService.sendSellerNotification(created, 'new');
                } catch (nErr) {
                  console.warn('sendSellerNotification failed', nErr);
                }
              } catch (e: any) {
                // best-effort
                console.warn('order_items insert failed', e);
              }

              // process order (decrement stock, notify)
              try { await orderService.processPayment(created.id); } catch (e) { /* ignore */ }

              // clear cart when success
              clearCart();
              setCompleted(true);

              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                try { window.alert('Votre commande a été créée avec succès.'); } catch { /* ignore */ }
                navigation.navigate('Confirmation', { orderId: created.id, amount: total, storeId: activeStoreId });
              } else {
                Alert.alert('Commande créée', 'Votre commande a été créée avec succès.', [
                  { text: 'Continuer', onPress: () => navigation.navigate('Confirmation', { orderId: created.id, amount: total, storeId: activeStoreId }) }
                ]);
              }
            } catch (e: any) {
              errorHandler.handle(e, 'place order failed', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.alert('Erreur: ' + (e?.message || 'Impossible de créer la commande'));
              } else {
                Alert.alert('Erreur', e?.message || 'Impossible de créer la commande');
              }
            } finally {
              if (!completed) setProcessing(false);
            }
          }}
        >
          <Text style={styles.orderButtonText}>{processing || completed ? '...' : 'Commander'}</Text>
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
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  paymentOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '10',
  },
  paymentInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  paymentTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  paymentDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginTop: 2,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonActive: {
    borderColor: COLORS.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
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
    marginVertical: SPACING.sm,
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
  whatsappInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 120,
  },
  whatsappText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexWrap: 'wrap',
  },
  totalContainer: {
    flex: 1,
    minWidth: 0,
    flexBasis: '60%',
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
  orderButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    flexShrink: 0,
    alignSelf: 'flex-end',
    minWidth: 140,
  },
  orderButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  errorText: {
    color: COLORS.danger,
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.sm,
  },
});


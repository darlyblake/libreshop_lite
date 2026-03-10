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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore, useCartStore } from '../store';
import { genericStorage } from '../lib/storage';
import { storeService } from '../lib/supabase';

export const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const { items, getTotal, storeId } = useCartStore();
  const [store, setStore] = useState<any>(null);
  const [loadingStore, setLoadingStore] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    phone: user?.whatsapp_number || user?.phone || '',
    address: '',
    notes: '',
  });

  // Load store data for tax and shipping
  useEffect(() => {
    if (!storeId) return;
    const loadStore = async () => {
      try {
        setLoadingStore(true);
        const storeData = await storeService.getById(storeId);
        setStore(storeData);
      } catch (e) {
        console.warn('load store for checkout', e);
      } finally {
        setLoadingStore(false);
      }
    };
    loadStore();
  }, [storeId]);

  const subtotal = getTotal();
  const taxRate = store?.tax_rate || 0; // %
  const shippingPrice = store?.shipping_price || 0; // FCFA
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount + shippingPrice;
  const cartEmpty = items.length === 0;

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
              style={styles.input}
              placeholder="Votre nom"
              placeholderTextColor={COLORS.textMuted}
              value={formData.name}
              onChangeText={(v) => handleInputChange('name', v)}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Téléphone WhatsApp</Text>
            <TextInput
              style={styles.input}
              placeholder="+229 XX XXX XXXX"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(v) => handleInputChange('phone', v)}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Adresse de livraison</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Ville, quartier, rue..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              value={formData.address}
              onChangeText={(v) => handleInputChange('address', v)}
            />
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
              paymentMethod === 'mobile_money' && styles.paymentOptionActive
            ]}
            onPress={() => setPaymentMethod('mobile_money')}
          >
            <Ionicons name="phone-portrait-outline" size={24} color={COLORS.accent2} />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>Mobile Money</Text>
              <Text style={styles.paymentDesc}>Paiement via MTN Momo ou Moov</Text>
            </View>
            <View style={[
              styles.radioButton,
              paymentMethod === 'mobile_money' && styles.radioButtonActive
            ]}>
              {paymentMethod === 'mobile_money' && (
                <View style={styles.radioInner} />
              )}
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
            {items.map((item) => (
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
          style={[styles.orderButton, cartEmpty && { opacity: 0.6 }]}
          disabled={cartEmpty}
          onPress={() =>
            navigation.navigate('Payment', {
              amount: total,
              storeId,
              itemsJson: JSON.stringify(items),
              customerJson: JSON.stringify({
                name: formData.name,
                phone: formData.phone,
                address: formData.address,
                notes: formData.notes,
              }),
              paymentMethod,
            })
          }
        >
          <Text style={styles.orderButtonText}>Procéder au paiement</Text>
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
  orderButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
  },
  orderButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
});


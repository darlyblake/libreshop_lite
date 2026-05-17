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
import { locationService, LocationCoords } from '../services/locationService';
import { couponService } from '../services/couponService';
import { getStoreStatus } from '../utils/storeStatus';

export const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, showAuthModal } = useAuthStore();
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
    city: '',
    notes: '',
  });
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

  // Calculate shipping dynamically
  useEffect(() => {
    let mounted = true;
    const computeShipping = async () => {
      if (storesData.length === 0) return;
      
      let totalShipping = 0;
      let hasError = false;
      let errorMsg = '';

      for (const s of storesData) {
        if (!s) continue;
        
        let fee = s.shipping_price || 0;
        
        if (s.delivery_mode === 'km') {
          const dist = locationService.calculateDistanceToStore(userLocation, s);
          if (dist !== null) {
            fee = Math.round(dist * (s.delivery_price_km || 0));
          } else {
            fee = 0;
          }
        } else if (s.delivery_mode === 'city') {
          if (formData.city) {
            if (s.delivery_city_fees && Object.keys(s.delivery_city_fees).length > 0) {
              const normalizeStr = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              const userCityNormal = normalizeStr(formData.city);
              const cityKey = Object.keys(s.delivery_city_fees).find(k => normalizeStr(k) === userCityNormal);
              if (cityKey) {
                fee = s.delivery_city_fees[cityKey];
              } else {
                hasError = true;
                errorMsg = `Le vendeur ne livre pas à ${formData.city}.`;
                fee = 0;
              }
            } else {
              fee = s.shipping_price || 0;
            }
          } else {
            fee = 0;
          }
        }
        
        totalShipping += fee;
      }
      
      if (mounted) {
        setAggregatedShipping(totalShipping);
        setDeliveryError(hasError ? errorMsg : '');
      }
    };
    
    computeShipping();
    return () => { mounted = false; };
  }, [storesData, userLocation, formData.city]);

  // Load store data for tax and base settings.
  useEffect(() => {
    let mounted = true;
    const loadStores = async () => {
      try {
        setLoadingStore(true);

            if (activeStoreId) {
              const storeData = await storeService.getById(activeStoreId);
          if (!mounted) return;
              setStore(storeData);
              setStoresData(storeData ? [storeData] : []);
              
              const subtotalSingle = (paramItems && Array.isArray(paramItems))
                ? paramItems.reduce((s: number, it: any) => s + (it.product.price || 0) * (it.quantity || 0), 0)
                : getTotal();
              const taxAmt = storeData?.tax_rate ? subtotalSingle * (storeData.tax_rate / 100) : 0;
              setAggregatedTaxAmount(Math.round(taxAmt));
              return;
            }

        const ids = Array.from(new Set((paramItems ?? items).map((i: any) => (i.product as any)?.store_id).filter(Boolean)));
        if (ids.length === 0) {
          setStore(null);
          setStoresData([]);
          setAggregatedTaxAmount(0);
          return;
        }

        const stores = await Promise.all(ids.map((id: unknown) => storeService.getById(id as string)));
        if (!mounted) return;
        setStore(null);
        setStoresData(stores.filter(Boolean));

        const subtotalByStore: Record<string, number> = {};
        (paramItems ?? items).forEach((it: any) => {
          const sid = (it.product as any)?.store_id || (it as any).store_id;
          if (!sid) return;
          subtotalByStore[sid] = (subtotalByStore[sid] || 0) + ((it.product?.price || 0) * (it.quantity || 0));
        });

        let taxSum = 0;
        for (const s of stores) {
          if (!s) continue;
          const storeSubtotal = subtotalByStore[s.id] || 0;
          taxSum += s.tax_rate ? storeSubtotal * (s.tax_rate / 100) : 0;
        }
        setAggregatedTaxAmount(Math.round(taxSum));
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
  const taxAmount = store ? Math.round(subtotal * (taxRate / 100)) : aggregatedTaxAmount;
  const deliveryFeeCalculated = aggregatedShipping;
  // Make sure total doesn't go below 0
  const total = Math.max(0, subtotal + taxAmount + deliveryFeeCalculated - discountAmount);
  const cartEmpty = (paramItems ? paramItems.length === 0 : items.length === 0);



  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    const validationStoreId = activeStoreId || (storesData.length > 0 ? storesData[0].id : null);
    if (!validationStoreId) {
      setCouponMessage('Impossible de vérifier le code pour ce panier.');
      return;
    }

    setValidatingCoupon(true);
    setCouponMessage('');
    try {
      const orderAmountBeforeDiscount = subtotal + taxAmount + deliveryFeeCalculated;
      const result = await couponService.validateCoupon(couponCode, validationStoreId, orderAmountBeforeDiscount);
      
      if (result.isValid) {
        if (result.discountType === 'free_shipping') {
          setDiscountAmount(deliveryFeeCalculated);
        } else {
          setDiscountAmount(result.discountAmount);
        }
        setCouponApplied(true);
        setCouponMessage(result.message || 'Code appliqué !');
      } else {
        setDiscountAmount(0);
        setCouponApplied(false);
        setCouponMessage(result.message || 'Code invalide.');
      }
    } catch (e) {
      setCouponMessage('Erreur lors de la vérification.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setDiscountAmount(0);
    setCouponApplied(false);
    setCouponMessage('');
  };

  // Check if we need strict location (city or km delivery mode)
  const requiresLocation = storesData.some(s => s.delivery_mode === 'km' || s.delivery_mode === 'city');

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
          
          {requiresLocation && (
            <View style={{ marginBottom: SPACING.md }}>
              <TouchableOpacity 
                style={{ 
                  backgroundColor: COLORS.card, 
                  borderWidth: 2, 
                  borderColor: userLocation ? COLORS.success : COLORS.primary,
                  padding: SPACING.md, 
                  borderRadius: RADIUS.lg, 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: SPACING.sm
                }}
                onPress={async () => {
                  setProcessing(true);
                  try {
                    const pos = await locationService.getCurrentPosition();
                    if (pos) {
                      setUserLocation(pos);
                      const addr = await locationService.reverseGeocode(pos.latitude, pos.longitude);
                      if (addr) {
                        handleInputChange('address', addr.street || '');
                        if (addr.city) handleInputChange('city', addr.city);
                      }
                    } else {
                      Alert.alert('Erreur', 'Impossible de récupérer votre position. Vérifiez vos paramètres GPS.');
                    }
                  } catch(e) {
                    Alert.alert('Erreur', 'Impossible de récupérer votre position.');
                  } finally {
                    setProcessing(false);
                  }
                }}
              >
                <Ionicons name={userLocation ? "checkmark-circle" : "locate"} size={24} color={userLocation ? COLORS.success : COLORS.primary} />
                <Text style={{ fontSize: 16, color: userLocation ? COLORS.success : COLORS.primary, fontWeight: '700' }}>
                  {userLocation ? 'Position validée' : 'Obtenir ma position de livraison'}
                </Text>
              </TouchableOpacity>
              {!userLocation && (
                <Text style={{ fontSize: 12, color: COLORS.danger, marginTop: 8, textAlign: 'center' }}>
                  Ce vendeur nécessite votre position exacte pour calculer les frais de livraison.
                </Text>
              )}
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Ville {requiresLocation && '(Détectée via GPS)'}</Text>
            <TextInput
              style={[styles.input, errors.city ? { borderColor: COLORS.danger } : null, requiresLocation && { backgroundColor: COLORS.bg, opacity: 0.7 }]}
              placeholder={requiresLocation ? "Utilisez le bouton de localisation" : "Ex: Douala, Yaoundé..."}
              placeholderTextColor={COLORS.textMuted}
              value={formData.city}
              editable={!requiresLocation}
              onChangeText={(v) => handleInputChange('city', v)}
            />
            {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
              <Text style={styles.label}>Adresse précise {requiresLocation && '(Détectée via GPS)'}</Text>
              {!requiresLocation && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={async () => {
                    const pos = await locationService.getCurrentPosition();
                    if (pos) {
                      setUserLocation(pos);
                      const addr = await locationService.reverseGeocode(pos.latitude, pos.longitude);
                      if (addr) {
                        handleInputChange('address', addr.street || '');
                        if (addr.city) handleInputChange('city', addr.city);
                      }
                      Alert.alert('Localisation', 'Position récupérée avec succès !');
                    } else {
                      Alert.alert('Erreur', 'Impossible de récupérer votre position. Vérifiez vos paramètres GPS.');
                    }
                  }}
                >
                  <Ionicons name="locate" size={16} color={COLORS.accent} />
                  <Text style={{ fontSize: 12, color: COLORS.accent, fontWeight: '600' }}>Me localiser</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, styles.multilineInput, errors.address ? { borderColor: COLORS.danger } : null, requiresLocation && { backgroundColor: COLORS.bg, opacity: 0.7 }]}
              placeholder={requiresLocation ? "Utilisez le bouton de localisation" : "Quartier, Carrefour, description..."}
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              value={formData.address}
              editable={!requiresLocation}
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

        {/* Code Promo */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ticket-outline" size={20} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Code Promo</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            <TextInput 
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Entrez votre code"
              placeholderTextColor={COLORS.textMuted}
              value={couponCode}
              onChangeText={(v) => {
                setCouponCode(v);
                if (couponApplied) handleRemoveCoupon();
              }}
              autoCapitalize="characters"
              editable={!couponApplied}
            />
            <TouchableOpacity 
              style={[{
                backgroundColor: couponApplied ? COLORS.danger : COLORS.primary,
                paddingHorizontal: SPACING.lg,
                borderRadius: RADIUS.md,
                justifyContent: 'center',
                alignItems: 'center',
              }]}
              onPress={couponApplied ? handleRemoveCoupon : handleApplyCoupon}
              disabled={validatingCoupon}
            >
              {validatingCoupon ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  {couponApplied ? 'Retirer' : 'Appliquer'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {couponMessage ? (
            <Text style={{ 
              color: couponApplied ? COLORS.success : COLORS.danger, 
              fontSize: 13, 
              marginTop: SPACING.sm 
            }}>{couponMessage}</Text>
          ) : null}
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
                {loadingStore ? '...' : (requiresLocation && !userLocation ? 'À calculer' : (aggregatedShipping > 0 ? `${aggregatedShipping.toLocaleString()} FCA` : 'Gratuite'))}
              </Text>
            </View>

            {/* Discount */}
            {discountAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: COLORS.success }]}>Réduction (Code Promo)</Text>
                <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                  -{discountAmount.toLocaleString()} FCA
                </Text>
              </View>
            )}

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
            // Check store status
            for (const s of storesData) {
              if (s) {
                const status = getStoreStatus(s);
                if (!status.isOpen) {
                  Alert.alert(
                    "Boutique fermée",
                    `La boutique "${s.name}" est actuellement fermée${status.reason === 'paused' ? ' (en pause)' : ''}. Impossible de passer commande pour le moment.`
                  );
                  return;
                }
              }
            }

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
            if (!formData.city || formData.city.trim().length < 2) {
              newErrors.city = 'Veuillez entrer votre ville.';
            }
            if (!formData.address || formData.address.trim().length < 5) {
              newErrors.address = 'Veuillez entrer votre adresse de livraison.';
            }
            if (deliveryError) {
              newErrors.city = deliveryError;
            }

            // Specific check for location delivery (KM or City)
            if (requiresLocation && !userLocation) {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const ok = window.confirm('Attention: La position est nécessaire pour calculer les frais de livraison. Voulez-vous continuer avec les frais par défaut (0 FCA) ?');
                if (!ok) return;
              } else {
                Alert.alert('Position requise', 'Le vendeur nécessite votre position pour calculer la livraison. Souhaitez-vous continuer sans position ?', [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Continuer', style: 'default' }
                ]);
              }
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
                setProcessing(false);
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  const ok = window.confirm('Connexion requise: veuillez vous connecter pour passer commande. Voulez-vous vous connecter maintenant ?');
                  if (ok) showAuthModal({ type: 'CHECKOUT' });
                } else {
                  Alert.alert('Connexion requise', 'Veuillez vous connecter pour passer commande', [
                    { text: 'Se connecter', onPress: () => showAuthModal({ type: 'CHECKOUT' }) },
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
                tax_amount: Number(taxAmount),
                delivery_fee: Number(deliveryFeeCalculated),
                discount_amount: Number(discountAmount),
                coupon_code: couponApplied ? couponCode : null,
                status: 'pending',
                payment_method: paymentMethod === 'cash' ? 'cash_on_delivery' : paymentMethod,
                payment_status: 'paid',
                shipping_address: formData.address,
                city: formData.city,
                latitude: userLocation?.latitude,
                longitude: userLocation?.longitude,
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
                  cost_price: it.product.cost_price,
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


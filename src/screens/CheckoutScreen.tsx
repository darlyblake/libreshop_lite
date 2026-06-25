import React, { useEffect, useState, useMemo } from 'react';
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
  Modal,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
import { addressService } from '../services/addressService';
import { useAlertModal } from '../components/AlertModal';
import { useLegacyPalette } from '../hooks/useLegacyPalette';
import { useTheme } from '../hooks/useTheme';

export const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, showAuthModal } = useAuthStore();
  const { items: globalItems, getTotal, storeId: storeIdFromStore, clearCart } = useCartStore();
  const route = useRoute<any>();
  const { show: showAlert, AlertModalComponent } = useAlertModal();
  
  const COLORS = useLegacyPalette();
  const { spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE } = useTheme();
  const styles = React.useMemo(() => createCheckoutStyles(COLORS, SPACING, RADIUS, FONT_SIZE), [COLORS, SPACING, RADIUS, FONT_SIZE]);

  // allow passing `itemsJson` or `items` in navigation to checkout a subset (per-store)
  const paramItems = useMemo(() => {
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
  }, [route.params]);

  const items = useMemo(() => paramItems ?? globalItems, [paramItems, globalItems]);
  const activeStoreId = route.params?.storeId ?? storeIdFromStore;
  
  // Extract store IDs to use as a stable dependency for store loading
  const storeIds = useMemo(() => {
    const ids = Array.from(new Set(items.map((i) => i.product?.store_id).filter(Boolean)));
    return ids.sort().join(',');
  }, [items]);
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

  // Address & Onboarding states
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingPhone, setOnboardingPhone] = useState('');
  const [onboardingAddress, setOnboardingAddress] = useState({
    label: 'Maison',
    city: '',
    address: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    note: '',
  });

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

  // Modals
  const [locationConfirmVisible, setLocationConfirmVisible] = useState(false);
  const [orderSuccessModalVisible, setOrderSuccessModalVisible] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
  }, [storesData, userLocation]);

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

        const ids = Array.from(new Set((paramItems ?? items).map((i) => i.product?.store_id).filter(Boolean)));
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
        (paramItems ?? items).forEach((it) => {
          const sid = it.product?.store_id || (it as any).store_id;
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
  }, []);

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

  const handleSelectAddress = (addr: any) => {
    setSelectedAddressId(addr.id);
    setFormData((prev) => {
      const next = {
        ...prev,
        city: addr.city || '',
        address: addr.address || '',
        notes: addr.note || prev.notes || '',
      };
      genericStorage.setItem('@libreshop_client_profile', next);
      return next;
    });
    if (addr.latitude && addr.longitude) {
      setUserLocation({ latitude: addr.latitude, longitude: addr.longitude });
    } else {
      setUserLocation(null);
    }
  };

  const loadAddresses = async () => {
    if (!user) return;
    try {
      // 1. Migration one-shot depuis AsyncStorage → Supabase (une seule fois par user)
      await addressService.migrateFromLocal(user.id);

      // 2. Récupérer le profil frais depuis Supabase.
      //    On utilise getSelfProfile (sans vérification de permission JS) pour éviter
      //    la race condition après OAuth : auth.getUser() peut retourner null quelques
      //    millisecondes après la connexion Google, causant une erreur "Accès non autorisé"
      //    dans getProfile() et un retour au profil en cache (sans whatsapp_number).
      let freshProfile: any = user;

      // Première tentative
      let profileFromDB = await userService.getSelfProfile(user.id);

      // Si null (session pas encore établie), on réessaie après 1 seconde
      if (!profileFromDB) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        profileFromDB = await userService.getSelfProfile(user.id);
      }

      if (profileFromDB) {
        freshProfile = profileFromDB;
        // Mettre à jour le store avec le profil complet
        const { setUser } = useAuthStore.getState();
        setUser({ ...user, ...profileFromDB } as any);
      }

      // 3. Charger les adresses depuis Supabase (source de vérité)
      const list = await addressService.getByUser(user.id);
      setAddresses(list);

      // 4. Décider si l'onboarding est nécessaire
      const hasPhone = !!(freshProfile.whatsapp_number || freshProfile.phone);
      const hasAddress = list.length > 0;

      if (!hasPhone || !hasAddress) {
        // Pré-remplir avec les données existantes du profil si disponibles
        setOnboardingPhone(freshProfile.whatsapp_number || freshProfile.phone || '');
        setOnboardingAddress(prev => ({
          ...prev,
          city: '',
          address: freshProfile.address || '',
          label: 'Maison',
        }));
        setOnboardingStep(1);
        setIsOnboardingVisible(true);
      } else {
        // L'utilisateur a déjà tout — aller directement au checkout
        const def = list.find((a: any) => a.is_default) || list[0];
        if (def) {
          handleSelectAddress(def);
        }
      }
    } catch (error) {
      console.error('Error loading addresses in Checkout:', error);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    if (!onboardingAddress.label.trim() || !onboardingAddress.city.trim() || !onboardingAddress.address.trim()) {
      showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Veuillez remplir tous les champs obligatoires (*)'
      });
      return;
    }

    setProcessing(true);
    try {
      // 1. Mettre à jour le profil Supabase avec le numéro WhatsApp
      const updatedUser = await userService.upsertProfile(user.id, {
        whatsapp_number: onboardingPhone,
        phone: onboardingPhone,
      });
      useAuthStore.getState().setUser(updatedUser);

      // 2. Sauvegarder la première adresse dans Supabase (pas AsyncStorage)
      const savedAddr = await addressService.add(user.id, {
        label: onboardingAddress.label,
        city: onboardingAddress.city,
        address: onboardingAddress.address,
        latitude: onboardingAddress.latitude ?? null,
        longitude: onboardingAddress.longitude ?? null,
        note: onboardingAddress.note || null,
        is_default: true,
      });

      // 3. Mettre à jour les états locaux
      const newList = [savedAddr];
      setAddresses(newList);
      setSelectedAddressId(savedAddr.id);
      setFormData(prev => ({
        ...prev,
        phone: onboardingPhone,
        city: onboardingAddress.city,
        address: onboardingAddress.address,
        notes: onboardingAddress.note || '',
      }));
      if (onboardingAddress.latitude && onboardingAddress.longitude) {
        setUserLocation({ latitude: onboardingAddress.latitude, longitude: onboardingAddress.longitude });
      }

      setIsOnboardingVisible(false);
      showAlert({ type: 'success', title: 'Succès', message: 'Votre profil de livraison a été créé avec succès !' });
    } catch (e) {
      errorHandler.handle(e, 'Complete onboarding failed');
      showAlert({ type: 'error', title: 'Erreur', message: 'Impossible de terminer la configuration de votre profil.' });
    } finally {
      setProcessing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadAddresses();
    }, [user])
  );

  useEffect(() => {
    const restore = async () => {
      const saved = await genericStorage.getItem<any>('@libreshop_client_profile');
      if (saved) {
        setFormData((prev) => ({
          ...prev,
          name: String(saved?.name || prev.name || user?.full_name || ''),
          phone: String(saved?.phone || prev.phone || user?.whatsapp_number || user?.phone || ''),
          address: String(saved?.address || prev.address || ''),
          notes: String(saved?.notes || prev.notes || ''),
        }));
      } else if (user) {
        setFormData((prev) => ({
          ...prev,
          name: user.full_name || '',
          phone: user.whatsapp_number || user.phone || '',
        }));
      }
    };
    restore();
  }, [user?.id]);

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

  const executeOrder = async () => {
    setProcessing(true);
    try {
      // ensure user exists
      let userId = user?.id;

      if (!userId) {
        setProcessing(false);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const ok = window.confirm('Connexion requise: veuillez vous connecter pour passer commande. Voulez-vous vous connecter maintenant ?');
          if (ok) showAuthModal({ type: 'CHECKOUT', payload: { params: route.params } });
        } else {
          showAlert({
            type: 'warning',
            title: 'Connexion requise',
            message: 'Veuillez vous connecter pour passer commande',
            buttons: [
              { text: 'Se connecter', onPress: () => showAuthModal({ type: 'CHECKOUT', payload: { params: route.params } }) },
              { text: 'Annuler', style: 'cancel' },
            ]
          });
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
        payment_status: 'pending',
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

      setCreatedOrderId(created.id);
      setOrderSuccessModalVisible(true);
    } catch (e: any) {
      errorHandler.handle(e, 'place order failed', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      showAlert({ type: 'error', title: 'Erreur', message: e?.message || 'Impossible de créer la commande' });
    } finally {
      if (!completed) setProcessing(false);
    }
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

          {user && addresses.length > 0 ? (
            <View style={styles.addressSelectorContainer}>
              <Text style={styles.addressSelectorLabel}>Sélectionnez une adresse enregistrée :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.addressSelectorScroll}>
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  return (
                    <TouchableOpacity
                      key={addr.id}
                      style={[styles.addressChip, isSelected && styles.addressChipActive]}
                      onPress={() => handleSelectAddress(addr)}
                    >
                      <Ionicons 
                        name={isSelected ? "checkmark-circle" : "location"} 
                        size={16} 
                        color={isSelected ? "#fff" : COLORS.accent} 
                      />
                      <Text style={[styles.addressChipText, isSelected && styles.addressChipTextActive]}>
                        {addr.label} {addr.is_default && " ★"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.addressChipAdd}
                  onPress={() => navigation.navigate('Address')}
                >
                  <Ionicons name="settings-outline" size={16} color={COLORS.textMuted} />
                  <Text style={styles.addressChipAddText}>Gérer</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          ) : user ? (
            <TouchableOpacity 
              style={styles.noAddressButton}
              onPress={() => navigation.navigate('Address')}
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.accent} />
              <Text style={styles.noAddressButtonText}>Gérer mes adresses de livraison</Text>
            </TouchableOpacity>
          ) : null}
          
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
                    showAlert({ type: 'error', title: 'Erreur', message: 'Impossible de récupérer votre position. Vérifiez vos paramètres GPS.' });
                  }
                } catch(e) {
                  showAlert({ type: 'error', title: 'Erreur', message: 'Impossible de récupérer votre position.' });
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
            {!userLocation && requiresLocation && (
              <Text style={{ fontSize: 12, color: COLORS.danger, marginTop: 8, textAlign: 'center' }}>
                Ce vendeur nécessite votre position exacte pour calculer les frais de livraison.
              </Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Ville</Text>
            <TextInput
              style={[styles.input, errors.city ? { borderColor: COLORS.danger } : null, { backgroundColor: COLORS.bg, color: COLORS.textSoft, opacity: 0.8 }]}
              placeholder="Cliquez sur 'Obtenir ma position' ci-dessus"
              placeholderTextColor={COLORS.textMuted}
              value={formData.city}
              editable={false}
            />
            {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
              <Text style={styles.label}>Adresse précise</Text>
            </View>
            <TextInput
              style={[styles.input, styles.multilineInput, errors.address ? { borderColor: COLORS.danger } : null, { backgroundColor: COLORS.bg, color: COLORS.textSoft, opacity: 0.8 }]}
              placeholder="Cliquez sur 'Obtenir ma position' ci-dessus"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              value={formData.address}
              editable={false}
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
                const storeSubtotal = (paramItems ?? items).reduce((sum: number, it) => {
                  return sum + (it.product?.store_id === sid ? (it.product.price || 0) * (it.quantity || 0) : 0);
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
                  showAlert({
                    type: 'error',
                    title: 'Boutique fermée',
                    message: `La boutique "${s.name}" est actuellement fermée${status.reason === 'paused' ? ' (en pause)' : ''}. Impossible de passer commande pour le moment.`
                  });
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
                  showAlert({ type: 'error', title: 'Erreur', message: 'Impossible de lire le panier depuis l’URL. Retournez au panier et recommencez.' });
                  return;
                }
                try {
                  const recovered = JSON.parse(decodeURIComponent(raw));
                  if (!Array.isArray(recovered) || recovered.length === 0) {
                    showAlert({ type: 'error', title: 'Erreur', message: 'Le panier est vide ou mal formé.' });
                    return;
                  }
                } catch (e) {
                  showAlert({ type: 'error', title: 'Erreur', message: 'Impossible de décoder les articles de la commande.' });
                  return;
                }
              } else {
                showAlert({ type: 'error', title: 'Erreur', message: 'Panier introuvable.' });
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

            if (Object.keys(newErrors).length > 0) {
              setErrors(newErrors);
              showAlert({ type: 'error', title: 'Erreur', message: 'Veuillez corriger les champs marqués.' });
              return;
            }

            // Specific check for location delivery (KM or City)
            if (requiresLocation && !userLocation) {
              setLocationConfirmVisible(true);
              return;
            }

            // ─── Vérification finale du stock en temps réel ───────────────
            try {
              const activeItems: any[] = paramItems ?? items;
              const stockIssues: string[] = [];

              // Re-fetch stock pour chaque produit depuis Supabase
              await Promise.all(
                activeItems.map(async (it: any) => {
                  try {
                    const { productService } = await import('../services/productService');
                    const latest = await productService.getById(String(it.product.id));
                    const liveStock = typeof latest?.stock === 'number' ? latest.stock : 9999;

                    if (liveStock <= 0) {
                      stockIssues.push(`❌ "${it.product.name}" est en rupture de stock.`);
                    } else if (it.quantity > liveStock) {
                      stockIssues.push(`⚠️ "${it.product.name}" : demandé ${it.quantity}, disponible ${liveStock}.`);
                    }
                  } catch (e) {
                    // En cas d'erreur réseau, on laisse passer (best-effort)
                    console.warn('stock check failed for product', it.product.id, e);
                  }
                })
              );

              if (stockIssues.length > 0) {
                showAlert({
                  type: 'warning',
                  title: 'Stock insuffisant',
                  message: `Impossible de valider votre commande :\n\n${stockIssues.join('\n')}\n\nVeuillez retourner au panier et ajuster les quantités.`,
                  buttons: [
                    { text: 'Retour au panier', onPress: () => navigation.navigate('Cart') },
                    { text: 'OK', style: 'cancel' },
                  ],
                });
                return;
              }
            } catch (e) {
              // Si la vérif globale plante, on laisse executeOrder gérer
              console.warn('global stock pre-check failed', e);
            }
            // ─────────────────────────────────────────────────────────────

            await executeOrder();
          }}
        >
          <Text style={styles.orderButtonText}>{processing || completed ? '...' : 'Commander'}</Text>
        </TouchableOpacity>
      </View>

      {/* Onboarding Modal for First Order (WhatsApp + First Address) */}
      <Modal
        visible={isOnboardingVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingContainer}>
            <Text style={styles.onboardingTitle}>Bienvenue sur LibreShop !</Text>
            <Text style={styles.onboardingSubtitle}>
              Configurez vos informations de contact et de livraison pour votre première commande.
            </Text>

            {/* Progress Indicator */}
            <View style={styles.progressRow}>
              <View style={[styles.progressStep, onboardingStep >= 1 && styles.progressStepActive]} />
              <View style={[styles.progressStep, onboardingStep >= 2 && styles.progressStepActive]} />
            </View>
            <Text style={styles.stepIndicatorText}>Étape {onboardingStep} sur 2</Text>

            {onboardingStep === 1 ? (
              <View style={styles.stepContent}>
                <View style={styles.onboardingBadge}>
                  <Ionicons name="logo-whatsapp" size={32} color="#fff" />
                </View>
                <Text style={styles.stepTitle}>Numéro de téléphone WhatsApp</Text>
                <Text style={styles.stepDesc}>
                  Ce numéro permettra au vendeur ou au livreur de vous contacter pour la livraison ou pour discuter de votre commande.
                </Text>
                <TextInput
                  style={styles.onboardingInput}
                  placeholder="Ex: +225 07 00 00 00 00"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                  value={onboardingPhone}
                  onChangeText={setOnboardingPhone}
                />
                <TouchableOpacity 
                  style={styles.onboardingNextBtn}
                  onPress={() => {
                    if (onboardingPhone.trim().length < 6) {
                      showAlert({ type: 'error', title: 'Erreur', message: 'Veuillez saisir un numéro de téléphone WhatsApp valide.' });
                      return;
                    }
                    setOnboardingStep(2);
                  }}
                >
                  <Text style={styles.onboardingNextText}>Suivant</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.stepContentScroll} showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.onboardingBadge, { backgroundColor: COLORS.accent }]}>
                    <Ionicons name="location" size={32} color="#fff" />
                  </View>
                  <Text style={styles.stepTitle}>Adresse de livraison</Text>
                  <Text style={styles.stepDesc}>
                    Ajoutez votre première adresse pour recevoir vos commandes.
                  </Text>
                </View>

                <View style={styles.onboardingFormGroup}>
                  <Text style={styles.onboardingLabel}>Nom de l'adresse (Ex: Maison, Bureau)*</Text>
                  <TextInput
                    style={styles.onboardingInput}
                    placeholder="Ex: Maison, Bureau..."
                    placeholderTextColor={COLORS.textMuted}
                    value={onboardingAddress.label}
                    onChangeText={(v) => setOnboardingAddress(prev => ({ ...prev, label: v }))}
                  />
                </View>

                <View style={styles.onboardingFormGroup}>
                  <Text style={styles.onboardingLabel}>Ville *</Text>
                  <TextInput
                    style={[styles.onboardingInput, { backgroundColor: '#f0f0f0', color: COLORS.textSoft }]}
                    placeholder="Rempli via 'Me localiser' ci-dessous"
                    placeholderTextColor={COLORS.textMuted}
                    value={onboardingAddress.city}
                    editable={false}
                  />
                </View>

                <View style={styles.onboardingFormGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.onboardingLabel}>Adresse complète (Quartier, détails) *</Text>
                    <TouchableOpacity 
                      style={styles.onboardingLocateBtn}
                      onPress={async () => {
                        setProcessing(true);
                        try {
                          const pos = await locationService.getCurrentPosition();
                          if (pos) {
                            setOnboardingAddress(prev => ({
                              ...prev,
                              latitude: pos.latitude,
                              longitude: pos.longitude,
                            }));
                            const addr = await locationService.reverseGeocode(pos.latitude, pos.longitude);
                            if (addr) {
                              setOnboardingAddress(prev => ({
                                ...prev,
                                address: addr.street || prev.address || '',
                                city: addr.city || prev.city || '',
                              }));
                            }
                            showAlert({ type: 'success', title: 'Succès', message: 'Votre position GPS a été enregistrée !' });
                          } else {
                            showAlert({ type: 'error', title: 'Erreur', message: 'Impossible de récupérer votre position GPS.' });
                          }
                        } catch (e) {
                          showAlert({ type: 'error', title: 'Erreur', message: 'Impossible de récupérer votre position GPS.' });
                        } finally {
                          setProcessing(false);
                        }
                      }}
                    >
                      <Ionicons name="locate" size={14} color={COLORS.accent} />
                      <Text style={{ fontSize: 12, color: COLORS.accent, fontWeight: '600' }}>Me localiser</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.onboardingInput, { height: 60, textAlignVertical: 'top', backgroundColor: '#f0f0f0', color: COLORS.textSoft }]}
                    placeholder="Rempli via 'Me localiser' ci-dessus"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    value={onboardingAddress.address}
                    editable={false}
                  />
                </View>

                <View style={styles.onboardingFormGroup}>
                  <Text style={styles.onboardingLabel}>Note / Instructions spéciales (optionnel)</Text>
                  <TextInput
                    style={styles.onboardingInput}
                    placeholder="Ex: Portail bleu, à côté du supermarché..."
                    placeholderTextColor={COLORS.textMuted}
                    value={onboardingAddress.note}
                    onChangeText={(v) => setOnboardingAddress(prev => ({ ...prev, note: v }))}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.xl }}>
                  <TouchableOpacity 
                    style={styles.onboardingBackBtn}
                    onPress={() => setOnboardingStep(1)}
                  >
                    <Text style={styles.onboardingBackText}>Retour</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.onboardingFinishBtn}
                    onPress={handleCompleteOnboarding}
                  >
                    <Text style={styles.onboardingFinishText}>Terminer</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Location Confirm Modal */}
      <Modal visible={locationConfirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { alignItems: 'center', padding: SPACING.xl }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.warning + '20', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md }}>
              <Ionicons name="location-outline" size={32} color={COLORS.warning} />
            </View>
            <Text style={[styles.confirmTitle, { marginBottom: SPACING.xs }]}>Position requise</Text>
            <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.lg, lineHeight: 20 }}>
              La position est nécessaire pour calculer précisément les frais de livraison.
              Voulez-vous continuer avec les frais par défaut (0 FCA) ?
            </Text>
            <View style={{ flexDirection: 'row', gap: SPACING.md, width: '100%' }}>
              <TouchableOpacity
                style={[styles.confirmButton, { flex: 1, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border }]}
                onPress={() => setLocationConfirmVisible(false)}
              >
                <Text style={{ fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { flex: 1, backgroundColor: COLORS.warning }]}
                onPress={() => {
                  setLocationConfirmVisible(false);
                  executeOrder();
                }}
              >
                <Text style={{ fontSize: FONT_SIZE.md, color: '#fff', fontWeight: '700' }}>Continuer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Success Modal */}
      <Modal visible={orderSuccessModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { alignItems: 'center', padding: SPACING.xl }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.success + '20', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md }}>
              <Ionicons name="checkmark-circle" size={40} color={COLORS.success} />
            </View>
            <Text style={[styles.confirmTitle, { marginBottom: SPACING.xs }]}>Commande envoyée avec succès !</Text>
            <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.lg }}>
              Votre commande a bien été enregistrée.
            </Text>

            <View style={{ backgroundColor: COLORS.bg, padding: SPACING.md, borderRadius: RADIUS.md, width: '100%', marginBottom: SPACING.lg }}>
              <Text style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 4 }}>Numéro de commande</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, letterSpacing: 1 }}>
                  {createdOrderId ? createdOrderId.split('-')[0] : ''}
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    if (createdOrderId) {
                      await Clipboard.setStringAsync(createdOrderId.split('-')[0]);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  style={{ padding: 6, backgroundColor: COLORS.card, borderRadius: RADIUS.sm, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={copied ? COLORS.success : COLORS.accent} />
                  <Text style={{ fontSize: FONT_SIZE.xs, color: copied ? COLORS.success : COLORS.accent, fontWeight: '600' }}>
                    {copied ? 'Copié' : 'Copier'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ backgroundColor: COLORS.accent + '10', padding: SPACING.md, borderRadius: RADIUS.md, width: '100%', marginBottom: SPACING.xl, flexDirection: 'row', gap: SPACING.sm }}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textSoft, lineHeight: 18 }}>
                Pour suivre les étapes de votre commande, rendez-vous dans l'onglet <Text style={{ fontWeight: '700', color: COLORS.accent }}>Commandes</Text> sur la barre de navigation et utilisez ce code.
              </Text>
            </View>

            <TouchableOpacity
              style={{ width: '100%', backgroundColor: COLORS.accent, paddingVertical: SPACING.md, borderRadius: RADIUS.full, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm }}
              onPress={() => {
                setOrderSuccessModalVisible(false);
                navigation.navigate('ClientTabs');
              }}
            >
              <Text style={{ color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' }}>Continuer</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {AlertModalComponent}
    </View>
  );
};

const createCheckoutStyles = (COLORS: any, SPACING: any, RADIUS: any, FONT_SIZE: any) => StyleSheet.create({
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
  addressSelectorContainer: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressSelectorLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  addressSelectorScroll: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.xs,
  },
  addressChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  addressChipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
  },
  addressChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  addressChipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: COLORS.bg,
  },
  addressChipAddText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  noAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: SPACING.md,
    justifyContent: 'center',
  },
  noAddressButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  onboardingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  onboardingContainer: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '90%',
    padding: SPACING.xl,
    paddingTop: SPACING.xxl,
  },
  onboardingTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  onboardingSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  progressStep: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  progressStepActive: {
    backgroundColor: COLORS.accent,
  },
  stepIndicatorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  stepContent: {
    alignItems: 'center',
    paddingBottom: SPACING.xl,
  },
  stepContentScroll: {
    maxHeight: 500,
  },
  onboardingBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  stepTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  stepDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  onboardingInput: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  onboardingNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    width: '100%',
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  onboardingNextText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#fff',
  },
  onboardingFormGroup: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  onboardingLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSoft,
    marginBottom: SPACING.xs,
  },
  onboardingLocateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onboardingBackBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  onboardingBackText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textSoft,
  },
  onboardingFinishBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: '#4CAF50',
  },
  onboardingFinishText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#fff',
  },
  errorText: {
    color: COLORS.danger,
    marginTop: SPACING.sm,
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
  confirmButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


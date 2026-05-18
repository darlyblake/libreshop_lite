const fs = require('fs');
let code = fs.readFileSync('src/screens/CheckoutScreen.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { orderService } from '../services/orderService';",
  "import { orderService } from '../services/orderService';\nimport * as Clipboard from 'expo-clipboard';"
);

// 2. Add state variables
code = code.replace(
  "const [deliveryError, setDeliveryError] = useState('');",
  "const [deliveryError, setDeliveryError] = useState('');\n\n  // Modals\n  const [locationConfirmVisible, setLocationConfirmVisible] = useState(false);\n  const [orderSuccessModalVisible, setOrderSuccessModalVisible] = useState(false);\n  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);\n  const [copied, setCopied] = useState(false);"
);

// 3. Extract executeOrder
const executeOrderFunc = `
  const executeOrder = async () => {
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
        try {
          await orderService.sendSellerNotification(created, 'new');
        } catch (nErr) {
          console.warn('sendSellerNotification failed', nErr);
        }
      } catch (e: any) {
        console.warn('order_items insert failed', e);
      }

      // process order (decrement stock, notify)
      try { await orderService.processPayment(created.id); } catch (e) { /* ignore */ }

      // clear cart when success
      clearCart();
      setCompleted(true);
      
      // SHOW SUCCESS MODAL INSTEAD OF ALERTS
      setCreatedOrderId(created.id);
      setOrderSuccessModalVisible(true);

    } catch (e: any) {
      errorHandler.handle(e, 'place order failed', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Erreur: ' + (e?.message || 'Impossible de créer la commande'));
      } else {
        Alert.alert('Erreur', e?.message || 'Impossible de créer la commande');
      }
    } finally {
      setProcessing(false);
    }
  };
`;

code = code.replace("return (", executeOrderFunc + "\n  return (");

// 4. Update onPress to use executeOrder
const oldOnPressBodyStart = `            // Create order directly (commande)
            setProcessing(true);
            try {
              // ensure user exists`;
              
const oldOnPressBodyFull = code.substring(
  code.indexOf(oldOnPressBodyStart),
  code.indexOf("          }}\n        >\n          {processing ?")
);

const newOnPressLogic = `            await executeOrder();
`;

code = code.replace(oldOnPressBodyFull, newOnPressLogic);

// 5. Replace Location Check
const oldLocationCheck = `            // Specific check for location delivery (KM or City)
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
            }`;

const newLocationCheck = `            // Specific check for location delivery (KM or City)
            if (requiresLocation && !userLocation) {
              setLocationConfirmVisible(true);
              return;
            }`;

code = code.replace(oldLocationCheck, newLocationCheck);

// 6. Add modals at the end of the file
const modals = `
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
`;

code = code.replace(
  "    </View>\n  );\n};\n\nconst styles = StyleSheet.create({",
  modals + "\n    </View>\n  );\n};\n\nconst styles = StyleSheet.create({"
);

fs.writeFileSync('src/screens/CheckoutScreen.tsx', code, 'utf8');

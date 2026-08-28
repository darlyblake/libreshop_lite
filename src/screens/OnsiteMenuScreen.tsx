/**
 * OnsiteMenuScreen.tsx
 * Parcours client anonyme via QR code.
 *
 * Flux : /onsite/:token → validation → menu → panier → commande
 *
 * Sécurité :
 *  - Aucun signInAnonymously()
 *  - user_id = null pour toutes les commandes
 *  - qr_token envoyé, backend résout store/table
 *  - prix NOT envoyés, backend recalcule
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator,
  TouchableOpacity, ScrollView, TextInput, Alert, Modal,
  Image, FlatList, StatusBar,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useOnsiteTable } from '../features/onsite/hooks/useOnsiteTable';
import { OnsiteTableContext } from '../features/onsite/types';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { Product } from '../types/product';

type OnsiteMenuRouteProp = RouteProp<RootStackParamList, 'OnsiteMenu'>;

type CartItem = { product: Product; quantity: number };

const C = {
  primary: '#1A1A2E',
  accent: '#4CAF50',
  accentBg: '#E8F5E9',
  danger: '#E53935',
  bg: '#F8F9FA',
  card: '#FFFFFF',
  border: '#E0E0E0',
  textPrimary: '#1A1A2E',
  textMuted: '#9E9E9E',
  textLight: '#FFFFFF',
};

// ─── Loading/Error states ─────────────────────────────────────────────────────

function LoadingView() {
  return (
    <SafeAreaView style={s.center}>
      <ActivityIndicator size="large" color={C.accent} />
      <Text style={s.loadingText}>Vérification du QR…</Text>
    </SafeAreaView>
  );
}

function ErrorView({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <SafeAreaView style={s.center}>
      <Ionicons name="qr-code-outline" size={64} color={C.danger} />
      <Text style={s.errorTitle}>QR invalide</Text>
      <Text style={s.errorMessage}>{message}</Text>
      <TouchableOpacity style={s.backBtn} onPress={onBack}>
        <Text style={s.backBtnText}>Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Banner de table ──────────────────────────────────────────────────────────

function TableBanner({ context, cartCount, onCartPress }: {
  context: OnsiteTableContext;
  cartCount: number;
  onCartPress: () => void;
}) {
  return (
    <View style={s.banner}>
      <View style={s.bannerLeft}>
        <Ionicons name="restaurant-outline" size={18} color={C.textLight} />
        <View style={{ marginLeft: 8 }}>
          <Text style={s.bannerStore}>{context.storeName}</Text>
          <Text style={s.bannerTable}>Table {context.tableNumber}</Text>
        </View>
      </View>
      <TouchableOpacity style={s.cartBtn} onPress={onCartPress}>
        <Ionicons name="cart-outline" size={22} color={C.textLight} />
        {cartCount > 0 && (
          <View style={s.cartBadge}>
            <Text style={s.cartBadgeText}>{cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Carte produit ────────────────────────────────────────────────────────────

function ProductCard({ product, qty, onAdd, onRemove }: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={s.productCard}>
      {product.images?.[0] ? (
        <Image source={{ uri: product.images[0] }} style={s.productImage} />
      ) : (
        <View style={[s.productImage, s.productImagePlaceholder]}>
          <Ionicons name="fast-food-outline" size={28} color={C.textMuted} />
        </View>
      )}
      <View style={s.productInfo}>
        <Text style={s.productName} numberOfLines={2}>{product.name}</Text>
        {product.description ? (
          <Text style={s.productDesc} numberOfLines={2}>{product.description}</Text>
        ) : null}
        <Text style={s.productPrice}>{product.price?.toFixed(2)} €</Text>
      </View>
      <View style={s.productActions}>
        {qty > 0 ? (
          <View style={s.qtyRow}>
            <TouchableOpacity style={s.qtyBtn} onPress={onRemove}>
              <Ionicons name="remove" size={18} color={C.primary} />
            </TouchableOpacity>
            <Text style={s.qtyText}>{qty}</Text>
            <TouchableOpacity style={s.qtyBtn} onPress={onAdd}>
              <Ionicons name="add" size={18} color={C.accent} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.addBtn} onPress={onAdd}>
            <Ionicons name="add" size={20} color={C.textLight} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Écran panier / checkout ──────────────────────────────────────────────────

function CartSheet({ context, cart, products, visible, onClose, onOrderSuccess }: {
  context: OnsiteTableContext;
  cart: Record<string, number>;
  products: Product[];
  visible: boolean;
  onClose: () => void;
  onOrderSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const cartItems: CartItem[] = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const product = products.find(p => p.id === id);
      return product ? { product, quantity: qty } : null;
    })
    .filter(Boolean) as CartItem[];

  const total = cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const handleOrder = async () => {
    if (!name.trim()) {
      Alert.alert('Prénom requis', 'Merci de saisir votre prénom pour identifier votre commande.');
      return;
    }
    if (cartItems.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez au moins un article.');
      return;
    }

    setLoading(true);
    try {
      const result = await orderService.createOnsiteOrder({
        qr_token: context.token,
        customer_name: name.trim(),
        customer_phone: phone.trim() || null,
        notes: notes.trim() || null,
        payment_method: 'cash_on_delivery',
        items: cartItems.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      });

      // Utiliser le total retourné par le serveur (pas celui du panier local)
      const confirmedTotal = result.total?.toFixed(2) ?? total.toFixed(2);

      Alert.alert(
        '✅ Commande envoyée !',
        `Votre commande à la table ${context.tableNumber} a bien été reçue.\nTotal : ${confirmedTotal} €`,
        [{ text: 'Super !', onPress: onOrderSuccess }]
      );
    } catch (err: any) {
      // Erreurs déjà traduites par _translateRpcError — message utilisateur propre
      Alert.alert('Commande impossible', err?.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.sheetContainer}>
        {/* Header */}
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Mon panier</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={s.sheetSub}>{context.storeName} · Table {context.tableNumber}</Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Articles */}
          {cartItems.map(item => (
            <View key={item.product.id} style={s.cartRow}>
              <Text style={s.cartQty}>{item.quantity}×</Text>
              <Text style={s.cartName} numberOfLines={1}>{item.product.name}</Text>
              <Text style={s.cartPrice}>{(item.product.price * item.quantity).toFixed(2)} €</Text>
            </View>
          ))}

          <View style={s.separator} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total estimé</Text>
            <Text style={s.totalAmount}>{total.toFixed(2)} €</Text>
          </View>
          <Text style={s.totalNote}>Le total définitif sera calculé par l'établissement.</Text>

          <View style={s.separator} />

          {/* Infos client */}
          <Text style={s.fieldLabel}>Prénom *</Text>
          <TextInput
            style={s.input}
            placeholder="Votre prénom"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={s.fieldLabel}>Téléphone (optionnel)</Text>
          <TextInput
            style={s.input}
            placeholder="06 00 00 00 00"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={s.fieldLabel}>Notes (optionnel)</Text>
          <TextInput
            style={[s.input, { height: 80 }]}
            placeholder="Allergies, préférences…"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </ScrollView>

        {/* Bouton commander */}
        <View style={s.sheetFooter}>
          <TouchableOpacity
            style={[s.orderBtn, loading && { opacity: 0.6 }]}
            onPress={handleOrder}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.textLight} />
              : <Text style={s.orderBtnText}>Commander · {total.toFixed(2)} €</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function OnsiteMenuScreen() {
  const route = useRoute<OnsiteMenuRouteProp>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = route.params;

  const tableState = useOnsiteTable(token);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCart, setShowCart] = useState(false);

  // Charger les produits une fois la table validée
  useEffect(() => {
    if (tableState.status !== 'valid') return;
    const { storeId } = tableState.context;
    setProductsLoading(true);
    productService.getByStoreAvailable(storeId)
      .then(data => setProducts(data || []))
      .catch(e => console.error('[OnsiteMenu] Erreur produits:', e))
      .finally(() => setProductsLoading(false));
  }, [tableState.status]);

  const addToCart = useCallback((productId: string) => {
    setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => {
      const n = (prev[productId] || 1) - 1;
      if (n <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: n };
    });
  }, []);

  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);

  const handleOrderSuccess = useCallback(() => {
    setCart({});
    setShowCart(false);
  }, []);

  if (tableState.status === 'loading') return <LoadingView />;
  if (tableState.status === 'error') return (
    <ErrorView message={tableState.message} onBack={() => navigation.goBack()} />
  );

  const { context } = tableState;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <TableBanner
        context={context}
        cartCount={cartCount}
        onCartPress={() => setShowCart(true)}
      />

      {productsLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : products.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="fast-food-outline" size={48} color={C.textMuted} />
          <Text style={s.emptyText}>Aucun produit disponible</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              qty={cart[item.id] || 0}
              onAdd={() => addToCart(item.id)}
              onRemove={() => removeFromCart(item.id)}
            />
          )}
        />
      )}

      {cartCount > 0 && (
        <TouchableOpacity style={s.floatingCart} onPress={() => setShowCart(true)}>
          <Ionicons name="cart" size={20} color={C.textLight} />
          <Text style={s.floatingCartText}>
            {cartCount} article{cartCount > 1 ? 's' : ''} · Voir panier
          </Text>
        </TouchableOpacity>
      )}

      <CartSheet
        context={context}
        cart={cart}
        products={products}
        visible={showCart}
        onClose={() => setShowCart(false)}
        onOrderSuccess={handleOrderSuccess}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg },
  loadingText: { marginTop: 12, fontSize: 15, color: C.textMuted },
  errorTitle: { marginTop: 16, fontSize: 22, fontWeight: '700', color: C.danger },
  errorMessage: { marginTop: 8, fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  backBtn: { marginTop: 24, backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backBtnText: { color: C.textLight, fontSize: 15, fontWeight: '600' },
  emptyText: { marginTop: 12, fontSize: 16, color: C.textMuted },

  // Banner
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.primary, paddingVertical: 12, paddingHorizontal: 16,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center' },
  bannerStore: { color: C.textLight, fontSize: 15, fontWeight: '700' },
  bannerTable: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  cartBtn: { position: 'relative', padding: 4 },
  cartBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: C.accent, borderRadius: 10, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: C.textLight, fontSize: 11, fontWeight: '700' },

  // Product card
  productCard: {
    flexDirection: 'row', backgroundColor: C.card, borderRadius: 12,
    marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  productImage: { width: 90, height: 90 },
  productImagePlaceholder: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, padding: 10, justifyContent: 'center' },
  productName: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  productDesc: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  productPrice: { fontSize: 15, fontWeight: '700', color: C.accent, marginTop: 6 },
  productActions: { padding: 10, justifyContent: 'center' },
  addBtn: {
    backgroundColor: C.accent, width: 36, height: 36,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { marginHorizontal: 8, fontSize: 15, fontWeight: '700', color: C.textPrimary },

  // Floating cart button
  floatingCart: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: C.primary, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  floatingCartText: { color: C.textLight, fontSize: 16, fontWeight: '700' },

  // Cart sheet
  sheetContainer: { flex: 1, backgroundColor: C.card },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderColor: C.border,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
  sheetSub: { fontSize: 13, color: C.textMuted, paddingHorizontal: 16, paddingTop: 4 },
  cartRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F0F0F0',
  },
  cartQty: { fontSize: 15, fontWeight: '700', color: C.accent, width: 30 },
  cartName: { flex: 1, fontSize: 14, color: C.textPrimary },
  cartPrice: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  separator: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  totalAmount: { fontSize: 18, fontWeight: '700', color: C.accent },
  totalNote: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.textPrimary, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: C.bg,
  },
  sheetFooter: { padding: 16, borderTopWidth: 1, borderColor: C.border },
  orderBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  orderBtnText: { color: C.textLight, fontSize: 17, fontWeight: '700' },
});

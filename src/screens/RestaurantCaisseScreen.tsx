/**
 * RestaurantCaisseScreen.tsx
 * Interface caisse Restaurant — POS par table avec menu, bon cuisine, paiement et reçu
 * Réutilise les composants partagés du dossier components/pos/
 * Les modules Comptabilité, Analytics, Rapports sont identiques à SellerAccountingScreen etc.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  useWindowDimensions,
  Alert,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '../store';
import { useSupabase } from '../lib/supabase';
import { productService } from '../services/productService';
import { storeService } from '../services/storeService';
import { orderService } from '../services/orderService';
import { qrCodeService } from '../services/qrCodeService';
import { networkService } from '../services/networkService';
import { offlineSyncManager } from '../services/offlineSyncManager';
import { tableService } from '../services/tableService';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { SearchBar } from '../components/SearchBar';
import { useSearch } from '../hooks/useSearch';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { PosAddTableModal } from '../components/pos/PosAddTableModal';

import {
  PosMenuGrid,
  PosCartPanel,
  PosCheckoutModal,
  PosReceiptModal,
  PosTableManager,
  PosOrderTicket,
  type PosProduct,
  type PosCartItem,
  type PosTable,
  type PaymentMethod,
} from '../components/pos';

// Couleur accent restaurant (orange chaleureux)
const RESTAURANT_COLOR = '#f97316';

const format = (v: number) => v.toLocaleString('fr-FR') + ' FCFA';

export const RestaurantCaisseScreen = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();
  const supabase = useSupabase();

  const isTablet = width >= 768;
  const isLargeScreen = width >= 1200;
  const numColumns = isLargeScreen ? 4 : isTablet ? 3 : 2;

  // ── State principal ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [store, setStore] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(networkService.isOnline());
  const [isAddTableModalVisible, setAddTableModalVisible] = useState(false);

  // ── Tables ───────────────────────────────────────────────────────────────────
  const [tables, setTables] = useState<PosTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);
  /** Paniers par table : Map<tableId, PosCartItem[]> */
  const [tablesCarts, setTablesCarts] = useState<Map<string, PosCartItem[]>>(new Map());
  /** Réductions par table */
  const [tablesDiscounts, setTablesDiscounts] = useState<Map<string, string>>(new Map());
  const [showTableView, setShowTableView] = useState(true); // true = vue tables, false = vue caisse

  // ── Recherche produits ───────────────────────────────────────────────────────
  const { query: productSearch, setQuery: setProductSearch } = useSearch({ debounceDelay: 300 });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showKitchenTicket, setShowKitchenTicket] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showQrCartScanner, setShowQrCartScanner] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState('');
  const [orderShareInfo, setOrderShareInfo] = useState<{ id: string; total: string; url: string; storeName: string } | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // ── Client associé à la table ────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // ── Panier de la table sélectionnée ─────────────────────────────────────────
  const cart = useMemo<PosCartItem[]>(
    () => (selectedTable ? (tablesCarts.get(selectedTable.id) || []) : []),
    [selectedTable, tablesCarts]
  );

  const discount = useMemo(
    () => (selectedTable ? (tablesDiscounts.get(selectedTable.id) || '') : ''),
    [selectedTable, tablesDiscounts]
  );

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const discountAmount = useMemo(() => Math.min(parseFloat(discount || '0') || 0, subtotal), [discount, subtotal]);
  const total = useMemo(() => {
    const afterDiscount = subtotal - discountAmount;
    return afterDiscount + Math.round(afterDiscount * 0.18);
  }, [subtotal, discountAmount]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
    return ['Tout', ...cats];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedCategory && selectedCategory !== 'Tout') {
      list = list.filter(p => p.category === selectedCategory);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.reference?.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCategory, productSearch]);

  // ── Réseau ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = networkService.subscribe(s => setIsOnline(s));
    return () => unsub();
  }, []);

  // ── Chargement initial ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        let currentStore: any = null;
        if (networkService.isOnline()) {
          currentStore = await storeService.getByUser(user.id);
        }
        if (!currentStore?.id) {
          setLoading(false);
          return;
        }

        if (!storeService.isSubscriptionActive(currentStore)) {
          Alert.alert('Abonnement expiré', 'Veuillez renouveler votre abonnement.');
          setLoading(false);
          return;
        }

        setStore(currentStore);
        setStoreId(currentStore.id);

        // Charger les produits
        let rawProducts: any[] = [];
        if (networkService.isOnline()) {
          rawProducts = await productService.getByStoreAvailable(currentStore.id);
          await offlineSyncManager.saveOfflineProducts(currentStore.id, rawProducts);
        } else {
          rawProducts = await offlineSyncManager.getOfflineProducts(currentStore.id);
        }
        setProducts(rawProducts.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock ?? 999,
          maxStock: p.stock ?? 999,
          category: p.category,
          icon: p.icon,
          reference: p.reference,
          cost_price: p.cost_price,
          image_url: p.image_url,
        })));

        // Charger les tables
        const savedTables = await tableService.getTables(currentStore.id);
        setTables(savedTables);
      } catch (e) {
        console.warn('Erreur chargement restaurant caisse:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  // ── Actions sur le panier ────────────────────────────────────────────────────
  const updateCart = useCallback((tableId: string, updater: (prev: PosCartItem[]) => PosCartItem[]) => {
    setTablesCarts(prev => {
      const newMap = new Map(prev);
      newMap.set(tableId, updater(newMap.get(tableId) || []));
      return newMap;
    });
  }, []);

  const addToCart = useCallback((product: PosProduct) => {
    if (!selectedTable) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCart(selectedTable.id, prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (existing.quantity >= (product.maxStock ?? 999)) return prev;
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1, maxStock: product.maxStock ?? 999 }];
    });

    // Mettre à jour le montant de la table
    if (storeId) {
      setTables(prev => tableService.optimisticAmount(prev, selectedTable.id, total + product.price));
    }
  }, [selectedTable, updateCart, storeId, total]);

  const increaseQty = useCallback((id: string) => {
    if (!selectedTable) return;
    updateCart(selectedTable.id, prev =>
      prev.map(i => i.id === id && i.quantity < i.maxStock ? { ...i, quantity: i.quantity + 1 } : i)
    );
  }, [selectedTable, updateCart]);

  const decreaseQty = useCallback((id: string) => {
    if (!selectedTable) return;
    updateCart(selectedTable.id, prev =>
      prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i)
    );
  }, [selectedTable, updateCart]);

  const removeItem = useCallback((id: string) => {
    if (!selectedTable) return;
    updateCart(selectedTable.id, prev => prev.filter(i => i.id !== id));
  }, [selectedTable, updateCart]);

  const clearCart = useCallback(() => {
    if (!selectedTable) return;
    updateCart(selectedTable.id, () => []);
  }, [selectedTable, updateCart]);

  // ── Sélection de table ───────────────────────────────────────────────────────
  const handleSelectTable = useCallback(async (table: PosTable) => {
    setSelectedTable(table);
    if (table.status === 'free' && storeId) {
      // Optimistic UI
      setTables(prev => tableService.optimisticOpen(prev, table.id, 1));
      try {
        await tableService.openTable(storeId, table.id, 1);
      } catch (error) {
        console.error('Erreur ouverture table:', error);
        // Rollback on refresh
        const refreshed = await tableService.getTables(storeId);
        setTables(refreshed);
      }
    }
    setShowTableView(false);
    setCustomerName('');
    setCustomerPhone('');
  }, [storeId]);

  // ── Finalisation de la vente ─────────────────────────────────────────────────
  const handleCheckoutConfirm = useCallback(async (method: PaymentMethod, cashReceived?: number) => {
    if (!storeId || cart.length === 0 || !selectedTable) return;
    try {
      const orderPayload: any = {
        user_id: user?.id || '',
        store_id: storeId,
        total_amount: total,
        tax_amount: Math.round((subtotal - discountAmount) * 0.18),
        discount_amount: discountAmount,
        delivery_fee: 0,
        status: 'paid',
        payment_method: method === 'cash' ? 'cash_on_delivery' : method === 'card' ? 'card' : 'mobile_money',
        payment_status: 'paid',
        notes: `Vente caisse Restaurant - Table ${selectedTable.number} - ${method}`,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
      };

      const itemsPayload = cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        cost_price: item.cost_price,
        product_name: item.name,
      }));

      let orderId = '';
      if (!networkService.isOnline()) {
        const offline = await offlineSyncManager.queueOfflineOrder(storeId, orderPayload, itemsPayload);
        orderId = offline.id;
      } else {
        const order = await orderService.create(orderPayload);
        orderId = order.id;
        const formattedItems = itemsPayload.map(i => ({
          order_id: orderId,
          product_id: i.product_id,
          quantity: i.quantity,
          price: i.price,
          cost_price: i.cost_price,
        }));
        await orderService.createItems(formattedItems);

        // Mouvement de stock
        for (const item of cart) {
          try {
            await supabase.from('stock_movements').insert({
              product_id: item.id,
              quantity_changed: -item.quantity,
              previous_stock: item.stock,
              new_stock: item.stock - item.quantity,
              type: 'sale',
              reason: 'Vente caisse Restaurant',
              notes: `Table ${selectedTable.number} - Ticket #${orderId.slice(0, 8).toUpperCase()}`,
              created_by: user?.id,
            });
          } catch {}
        }

        await orderService.processPayment(orderId);
      }

      // Génération du QR et du reçu
      const orderUrl = qrCodeService.getOrderUrl(orderId);
      const qrBase64 = await qrCodeService.getQrImageBase64(orderUrl, 100);

      setOrderShareInfo({ id: orderId, total: format(total), url: orderUrl, storeName: store?.name || 'Restaurant' });

      const html = generateReceiptHtml({
        storeName: store?.name || 'Restaurant',
        storeAddress: store?.address,
        storePhone: store?.phone,
        orderId,
        tableNumber: selectedTable.number,
        items: cart,
        subtotal,
        discountAmount,
        total,
        paymentMethod: method,
        cashReceived,
        customerName,
        user,
        qrBase64,
      });

      setReceiptHtml(html);

      // Fermer la table et vider le panier
      if (storeId) {
        setTables(prev => tableService.optimisticClose(prev, selectedTable.id));
        // Async update
        tableService.closeTable(storeId, selectedTable.id).catch(e => console.error(e));
      }
      clearCart();
      setShowCheckout(false);
      setShowReceipt(true);
    } catch (e) {
      console.warn('Erreur finalisation restaurant:', e);
      Alert.alert('Erreur', 'Impossible de finaliser la vente');
    }
  }, [storeId, cart, selectedTable, total, subtotal, discountAmount, customerName, customerPhone, user, store, supabase, clearCart]);

  // ── Retour à la vue tables ───────────────────────────────────────────────────
  const handleBackToTables = () => {
    if (cart.length > 0) {
      Alert.alert(
        'Panier non vide',
        `La table ${selectedTable?.number} a des articles en cours. Voulez-vous quitter quand même ?`,
        [
          { text: 'Rester', style: 'cancel' },
          { text: 'Quitter', style: 'destructive', onPress: () => { setSelectedTable(null); setShowTableView(true); } },
        ]
      );
    } else {
      setSelectedTable(null);
      setShowTableView(true);
    }
  };

  // ── Libérer une table manuellement ──────────────────────────────────────────
  const handleFreeTable = useCallback(() => {
    if (!selectedTable || !storeId) return;
    const hasItems = cart.length > 0;
    Alert.alert(
      '🔓 Libérer la table',
      hasItems
        ? `La table ${selectedTable.number} a encore ${cart.length} article(s) au panier. Voulez-vous vraiment la libérer et vider le panier ?`
        : `Marquer la table ${selectedTable.number} comme libre ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Libérer',
          style: 'destructive',
          onPress: () => {
            setTables(prev => tableService.optimisticClose(prev, selectedTable.id));
            tableService.closeTable(storeId, selectedTable.id).catch(e => console.error(e));
            
            if (hasItems) clearCart();
            setSelectedTable(null);
            setShowTableView(true);
          },
        },
      ]
    );
  }, [selectedTable, storeId, cart, clearCart]);

  // ── Scan QR panier client ────────────────────────────────────────────────────
  const handleQrCartScan = useCallback((data: string) => {
    setShowQrCartScanner(false);
    try {
      const payload = JSON.parse(data);
      if (!payload?.v || payload.v !== 1 || !payload.items) {
        Alert.alert('QR invalide', 'Ce code QR ne contient pas de commande client valide.');
        return;
      }
      const tableNum = String(payload.table);
      // Trouver la table correspondante
      const targetTable = tables.find(t => String(t.number) === tableNum);
      if (!targetTable) {
        Alert.alert('Table introuvable', `La table ${tableNum} n'existe pas dans cet établissement.`);
        return;
      }
      // Construire les articles POS depuis le payload
      const importedItems: PosCartItem[] = (payload.items as any[]).map((item: any) => {
        // Chercher le produit dans le catalogue pour avoir toutes les infos
        const found = products.find(p => p.id === item.id);
        return {
          id: item.id,
          name: item.name || found?.name || 'Article',
          price: item.price || found?.price || 0,
          stock: found?.stock ?? 999,
          quantity: item.qty || 1,
          maxStock: found?.maxStock ?? 999,
          category: found?.category,
          icon: found?.icon,
          reference: found?.reference,
        };
      });
      // Importer dans la table (ajouter aux articles existants)
      setTablesCarts(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(targetTable.id) || [];
        // Fusionner : si l'article existe déjà, augmenter la quantité
        const merged = [...existing];
        for (const item of importedItems) {
          const idx = merged.findIndex(i => i.id === item.id);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + item.quantity };
          } else {
            merged.push(item);
          }
        }
        newMap.set(targetTable.id, merged);
        return newMap;
      });
      // Activer la table et ouvrir la vue caisse
      handleSelectTable(targetTable);
      Alert.alert(
        '✅ Commande importée',
        `${importedItems.length} article(s) ajouté(s) à la table ${tableNum}.`
      );
    } catch {
      Alert.alert('Erreur', 'Impossible de lire le QR code. Format invalide.');
    }
  }, [tables, products, setTablesCarts, handleSelectTable]);

  const handleAddTable = useCallback(async (number: string, capacity: number) => {
    if (storeId) {
      try {
        await tableService.addTable(storeId, number, capacity);
        // Rafraîchir
        const refreshed = await tableService.getTables(storeId);
        setTables(refreshed);
        setAddTableModalVisible(false);
      } catch (error) {
        console.error('Erreur addTable:', error);
      }
    }
  }, [storeId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RESTAURANT_COLOR} />
          <Text style={styles.loadingText}>Chargement du restaurant...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <LinearGradient colors={[COLORS.card, COLORS.bg]} style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('SellerTabs', { screen: 'SellerDashboard' })}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Ionicons name="restaurant" size={26} color={RESTAURANT_COLOR} />
          <Text style={styles.headerTitle}>Caisse (Tables)</Text>
          {!showTableView && selectedTable && (
            <View style={[styles.tableBadge, { backgroundColor: RESTAURANT_COLOR }]}>
              <Text style={styles.tableBadgeText}>Table {selectedTable.number}</Text>
            </View>
          )}
          {!isOnline && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>⚡ Hors-ligne</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          {showTableView && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: RESTAURANT_COLOR + '22', borderRadius: RADIUS.md, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
              onPress={async () => {
                if (!permission?.granted) await requestPermission();
                setShowQrCartScanner(true);
              }}
            >
              <Ionicons name="scan-outline" size={18} color={RESTAURANT_COLOR} />
              <Text style={{ color: RESTAURANT_COLOR, fontSize: FONT_SIZE.xs, fontWeight: '700' }}>Scan Client</Text>
            </TouchableOpacity>
          )}
          {!showTableView && (
            <TouchableOpacity style={styles.headerBtn} onPress={handleBackToTables}>
              <Ionicons name="grid-outline" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
          {!showTableView && selectedTable && selectedTable.status !== 'free' && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: '#ef444422', borderRadius: RADIUS.md, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }]}
              onPress={handleFreeTable}
            >
              <Ionicons name="lock-open-outline" size={16} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: FONT_SIZE.xs, fontWeight: '700' }}>Libérer</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('SellerAccounting')}
          >
            <Ionicons name="calculator-outline" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('SellerAnalytics')}
          >
            <Ionicons name="stats-chart-outline" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── VUE TABLES ─────────────────────────────────────────── */}
      {showTableView ? (
        <PosTableManager
          tables={tables}
          selectedTableId={selectedTable?.id}
          onSelectTable={handleSelectTable}
          onAddTable={() => setAddTableModalVisible(true)}
          accentColor={RESTAURANT_COLOR}
          interfaceLabel="Tables"
          storeSlug={store?.slug}
          storeName={store?.name}
        />
      ) : (
        /* ── VUE CAISSE ───────────────────────────────────────── */
        <View style={[styles.main, { flexDirection: isTablet ? 'row' : 'column' }]}>
          {/* Section menu */}
          <View style={styles.menuSection}>
            {/* Barre de recherche */}
            <View style={styles.searchContainer}>
              <SearchBar
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Rechercher un plat..."
                onClear={() => setProductSearch('')}
              />
            </View>

            {/* Catégories */}
            <View style={styles.categoriesRow}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    (selectedCategory === cat || (cat === 'Tout' && !selectedCategory)) && {
                      backgroundColor: RESTAURANT_COLOR,
                      borderColor: RESTAURANT_COLOR,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat === 'Tout' ? null : cat)}
                >
                  <Text style={[
                    styles.categoryChipText,
                    (selectedCategory === cat || (cat === 'Tout' && !selectedCategory)) && { color: '#fff' },
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Grille menu */}
            <PosMenuGrid
              products={filtered}
              onAddToCart={addToCart}
              numColumns={numColumns}
              cartItems={cart}
              displayMode="large"
              accentColor={RESTAURANT_COLOR}
            />
          </View>

          {/* Section panier */}
          {isTablet && (
            <View style={[styles.cartSection, { width: 360 }]}>
              <PosCartPanel
                cart={cart}
                onIncrease={increaseQty}
                onDecrease={decreaseQty}
                onRemove={removeItem}
                onClear={clearCart}
                onCheckout={() => setShowCheckout(true)}
                discount={discount}
                onDiscountChange={val => {
                  if (!selectedTable) return;
                  setTablesDiscounts(prev => new Map(prev).set(selectedTable.id, val));
                }}
                accentColor={RESTAURANT_COLOR}
                tableLabel={String(selectedTable?.number || '')}
                checkoutLabel="Encaisser la table"
                onSendToKitchen={cart.length > 0 ? () => setShowKitchenTicket(true) : undefined}
              />
            </View>
          )}
        </View>
      )}

      {/* ── BOUTON PANIER FLOTTANT (mobile) ───────────────────── */}
      {!showTableView && !isTablet && cart.length > 0 && (
        <TouchableOpacity
          style={[styles.floatingCartBtn, { backgroundColor: RESTAURANT_COLOR }]}
          onPress={() => setShowCheckout(true)}
        >
          <Ionicons name="cart" size={22} color="#fff" />
          <Text style={styles.floatingCartText}>
            {cart.reduce((s, i) => s + i.quantity, 0)} article{cart.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''} — {format(total)}
          </Text>
          <View style={styles.floatingKitchenBtn}>
            <TouchableOpacity onPress={() => setShowKitchenTicket(true)}>
              <Ionicons name="restaurant-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* ── MODALS ────────────────────────────────────────────── */}
      <PosCheckoutModal
        visible={showCheckout}
        total={total}
        customerName={customerName}
        customerPhone={customerPhone}
        onCustomerNameChange={setCustomerName}
        onCustomerPhoneChange={setCustomerPhone}
        tableLabel={String(selectedTable?.number || '')}
        accentColor={RESTAURANT_COLOR}
        onConfirm={handleCheckoutConfirm}
        onClose={() => setShowCheckout(false)}
      />

      <PosReceiptModal
        visible={showReceipt}
        receiptHtml={receiptHtml}
        orderInfo={orderShareInfo}
        customerPhone={customerPhone}
        accentColor={RESTAURANT_COLOR}
        onClose={() => { setShowReceipt(false); setShowTableView(true); setSelectedTable(null); }}
        onNewSale={() => setShowTableView(true)}
      />

      <PosOrderTicket
        visible={showKitchenTicket}
        tableLabel={selectedTable?.number ?? ''}
        items={cart}
        storeName={store?.name || 'Restaurant'}
        onClose={() => setShowKitchenTicket(false)}
      />

      <BarcodeScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={(data) => {
          const q = data.trim().toLowerCase();
          const match = products.find(p => p.reference?.toLowerCase() === q || p.name.toLowerCase() === q);
          if (match) addToCart(match);
          setShowCameraScanner(false);
        }}
        hintText="Scannez le code-barres d'un plat"
      />

      {/* Scanner QR Panier Client */}
      <BarcodeScannerModal
        visible={showQrCartScanner}
        onClose={() => setShowQrCartScanner(false)}
        onScan={handleQrCartScan}
        hintText="📲 Scannez le QR code sur l'écran du client"
      />
      <PosAddTableModal
        visible={isAddTableModalVisible}
        onClose={() => setAddTableModalVisible(false)}
        onAdd={handleAddTable}
        accentColor={RESTAURANT_COLOR}
      />
    </SafeAreaView>
  );
};

// ── Générateur de reçu thermique ──────────────────────────────────────────────
function generateReceiptHtml(params: {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  orderId: string;
  tableNumber: number | string;
  items: PosCartItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  customerName: string;
  user: any;
  qrBase64: string;
}) {
  const { storeName, storeAddress, storePhone, orderId, tableNumber, items, subtotal, discountAmount, total, paymentMethod, cashReceived, customerName, user, qrBase64 } = params;
  const fmt = (v: number) => v.toLocaleString('fr-FR') + ' FCFA';
  const taxRate = 18;
  const afterDiscount = subtotal - discountAmount;
  const tax = Math.round(afterDiscount * taxRate / 100);

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>
body { font-family: 'Courier New', monospace; margin: 0 auto; padding: 15px; width: 300px; color: #000; font-size: 13px; line-height: 1.4; background: white; }
.center { text-align: center; } .right { text-align: right; } .bold { font-weight: bold; }
.dashed-line { border-top: 1px dashed #000; margin: 10px 0; }
.store-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px; }
th, td { padding: 4px 0; vertical-align: top; }
</style></head><body>
<div class="center">
  <div class="store-name">${storeName}</div>
  ${storeAddress ? `<div>${storeAddress}</div>` : ''}
  ${storePhone ? `<div>Tél: ${storePhone}</div>` : ''}
</div>
<div class="dashed-line"></div>
<div>
  <div><span class="bold">Date :</span> ${new Date().toLocaleString('fr-FR')}</div>
  <div><span class="bold">Ticket N° :</span> ${orderId.slice(0, 8).toUpperCase()}</div>
  <div><span class="bold">Table :</span> ${tableNumber}</div>
  <div><span class="bold">Caissier :</span> ${user?.user_metadata?.full_name || user?.email || 'Admin'}</div>
  ${customerName.trim() ? `<div><span class="bold">Client :</span> ${customerName.trim()}</div>` : ''}
</div>
<div class="center bold" style="margin: 15px 0; font-size: 15px;">TICKET DE CAISSE — RESTAURANT</div>
<div class="dashed-line"></div>
<table>
  <thead><tr style="border-bottom: 1px solid #000;"><th style="text-align:left; width:70%">QTE &amp; ARTICLE</th><th style="text-align:right; width:30%">MONTANT</th></tr></thead>
  <tbody>
    ${items.map(item => `<tr><td>${item.quantity}x ${item.name}<div style="font-size:11px">${fmt(item.price)}/U</div></td><td style="text-align:right; font-weight:bold">${fmt(item.price * item.quantity)}</td></tr>`).join('')}
  </tbody>
</table>
<div class="dashed-line"></div>
<table style="font-size:14px">
  <tr><td>SOUS-TOTAL :</td><td class="right">${fmt(subtotal)}</td></tr>
  ${discountAmount > 0 ? `<tr><td>REMISE :</td><td class="right">- ${fmt(discountAmount)}</td></tr><tr><td>NET :</td><td class="right">${fmt(afterDiscount)}</td></tr>` : ''}
  <tr><td>TVA (${taxRate}%) :</td><td class="right">${fmt(tax)}</td></tr>
  <tr class="bold" style="font-size:18px"><td style="padding-top:10px">NET À PAYER :</td><td class="right" style="padding-top:10px">${fmt(total)}</td></tr>
</table>
<div class="dashed-line"></div>
<div style="font-size:13px">
  <div style="display:flex;justify-content:space-between"><span>Mode de paiement :</span><span class="bold">${paymentMethod === 'cash' ? 'ESPÈCES' : paymentMethod === 'card' ? 'CARTE' : 'MOBILE MONEY'}</span></div>
  ${paymentMethod === 'cash' && cashReceived ? `<div style="display:flex;justify-content:space-between"><span>Espèces reçues :</span><span>${fmt(cashReceived)}</span></div><div style="display:flex;justify-content:space-between"><span>Monnaie :</span><span class="bold">${fmt(cashReceived - total)}</span></div>` : ''}
</div>
<div class="dashed-line"></div>
<div class="center" style="margin-top:20px">
  <img src="${qrBase64}" style="width:80px;height:80px;margin-bottom:10px;" />
  <div class="bold" style="font-size:14px">MERCI ET À BIENTÔT !</div>
  <div style="font-size:10px;margin-top:15px;color:#666">Propulsé par LibreShop App</div>
</div>
</body></html>`;
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 10 : 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.card,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerTitle: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  headerBtn: { padding: 4 },
  tableBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  tableBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  offlineBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  offlineBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  main: { flex: 1 },
  menuSection: { flex: 1, padding: SPACING.md },
  cartSection: { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  searchContainer: { marginBottom: SPACING.sm },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  categoryChipText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '600' },
  floatingCartBtn: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingCartText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700', flex: 1 },
  floatingKitchenBtn: { padding: 4 },
});

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  useWindowDimensions,
  Alert,
  FlatList,
  Animated,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '../store';
import { type Order, useSupabase } from '../lib/supabase';
import { productService } from '../services/productService';
import { storeService } from '../services/storeService';
import { orderService } from '../services/orderService';
import { qrCodeService } from '../services/qrCodeService';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { SearchBar } from '../components/SearchBar';
import { useSearch } from '../hooks/useSearch';
import { PosReturnModal } from '../components/PosReturnModal';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  reference?: string;
  cost_price?: number;
};

type CartItem = Product & {
  quantity: number;
};

export const SellerCaisseScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { initialClientName, initialClientPhone } = route.params || {};
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();
  const [cartVisible, setCartVisible] = useState(false);
  const cartAnimation = useRef(new Animated.Value(0)).current;

  const isTablet = width >= 768;
  const isLargeScreen = width >= 1200;

  // Colonnes dynamiques selon écran
  const numColumns = isLargeScreen ? 4 : isTablet ? 3 : 2;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [store, setStore] = useState<any>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [clients, setClients] = useState<{id: string, name: string, phone: string}[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const { query: productSearch, setQuery: setProductSearch, isLoading: productSearchLoading } = useSearch({ debounceDelay: 300 });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Initialiser le client si passé en paramètre
  useEffect(() => {
    if (initialClientName) setCustomerName(initialClientName);
    if (initialClientPhone) setCustomerPhone(initialClientPhone);
  }, [initialClientName, initialClientPhone]);

  const format = (v: number) => v.toLocaleString('fr-FR') + ' FCFA';

  // Charger les produits depuis Supabase
  useEffect(() => {
    const loadProducts = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const store = await storeService.getByUser(user.id);
        if (!store?.id) {
          setStoreId(null);
          setStore(null);
          setProducts([]);
          return;
        }

        if (!storeService.isSubscriptionActive(store)) {
          Alert.alert(
            'Abonnement expiré',
            `Votre abonnement pour "${store.name}" a expiré. Veuillez le renouveler pour accéder à la caisse.`,
            [
              {
                text: 'Renouveler',
                onPress: () => navigation.replace('SubscriptionExpired'),
              },
            ]
          );
          setLoading(false);
          return;
        }

        if (store.cashier_active === false) {
          Alert.alert(
            'Non inclus',
            `Le Point de Vente n'est pas inclus dans votre abonnement "${store.subscription_plan || 'actuel'}".`,
            [
              { text: 'Retour', onPress: () => navigation.goBack() },
              { text: 'Changer d\'offre', onPress: () => navigation.navigate('SellerChangePlan') }
            ]
          );
          setLoading(false);
          return;
        }

        setStoreId(store.id);
        setStore(store);
        const data = await productService.getByStoreAvailable(store.id);
        setProducts(data as Product[] || []);
      } catch (e) {
        errorHandler.handleDatabaseError(e as any, 'Erreur chargement produits caisse');
        Alert.alert('Erreur', 'Impossible de charger les produits');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [user?.id]);

  // Animation du panier
  useEffect(() => {
    Animated.timing(cartAnimation, {
      toValue: cartVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [cartVisible]);

  const cartWidth = cartAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isTablet ? 380 : width],
  });

  /* ======================
     CART + STOCK
  ====================== */

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      Alert.alert('Stock épuisé', `Le produit ${product.name} n'est plus disponible.`);
      return;
    }

    setProducts(prev =>
      prev.map(p =>
        p.id === product.id ? { ...p, stock: p.stock - 1 } : p
      )
    );

    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    // Feedback haptique
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const removeFromCart = useCallback((id: string) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    setProducts(prev =>
      prev.map(p =>
        p.id === id ? { ...p, stock: p.stock + 1 } : p
      )
    );

    setCart(prev => {
      if (item.quantity > 1) {
        return prev.map(i =>
          i.id === id ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter(i => i.id !== id);
    });
  }, [cart]);

  const clearCart = useCallback(() => {
    if (cart.length === 0) return;
    
    Alert.alert(
      'Vider le panier',
      'Êtes-vous sûr de vouloir vider le panier ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider',
          style: 'destructive',
          onPress: () => {
            // Restaurer les stocks
            cart.forEach(item => {
              setProducts(prev =>
                prev.map(p =>
                  p.id === item.id ? { ...p, stock: p.stock + item.quantity } : p
                )
              );
            });
            setCart([]);
          },
        },
      ]
    );
  }, [cart]);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.quantity, 0),
    [cart]
  );

  const taxRate = store?.tax_rate !== undefined ? Number(store.tax_rate) : 18;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  useEffect(() => {
    if (!storeId) return;
    const loadClients = async () => {
      try {
        const res = await orderService.getByStore(storeId, { includeUser: true });
        const orders = res.orders || [];
        const map = new Map<string, {id: string, name: string, phone: string}>();
        (orders as any[]).forEach((o: any) => {
          const cPhone = String(o?.customer_phone || '').trim();
          const cName = String(o?.customer_name || '').trim();
          const uId = String(o?.user_id || '').trim();
          const id = String(cPhone || cName || uId || o?.id || '');
          if (!id) return;
          const name = String(cName || o?.users?.full_name || '').trim();
          const phone = String(cPhone || o?.users?.phone || '').trim();
          if (!map.has(id) && name && name.toLowerCase() !== 'client') {
            map.set(id, { id, name, phone });
          }
        });
        setClients(Array.from(map.values()));
      } catch (e) {
        console.warn('Erreur chargement clients:', e);
      }
    };
    loadClients();
  }, [storeId]);

  const cartTotalElements = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const cartItemCount = useMemo(
    () => cart.reduce((count, item) => count + item.quantity, 0),
    [cart]
  );

  /* ======================
     FILTRES
  ====================== */

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['Tous', ...Array.from(cats) as string[]];
  }, [products]);

  const filtered = useMemo(() => {
    let filtered = products;
    
    // Filtre recherche
    const q = productSearch.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q)
      );
    }
    
    // Filtre catégorie
    if (selectedCategory && selectedCategory !== 'Tous') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    return filtered;
  }, [productSearch, products, selectedCategory]);

  /* ======================
     RENDER PRODUCT CARD
  ====================== */

  const renderProduct = useCallback(({ item, index }: { item: Product; index: number }) => {
    const stockColor = item.stock > 10 ? COLORS.success : item.stock > 0 ? COLORS.warning : COLORS.danger;
    const cartItem = cart.find(i => i.id === item.id);
    const quantity = cartItem ? cartItem.quantity : 0;
    const isSelected = quantity > 0;
    
    return (
      <TouchableOpacity
        style={[
          styles.productCard,
          { marginLeft: index % numColumns === 0 ? 0 : 8 },
          isSelected && styles.productCardSelected
        ]}
        onPress={() => addToCart(item)}
        disabled={item.stock <= 0}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={item.stock <= 0 ? [COLORS.border, COLORS.card] : isSelected ? [COLORS.info + '15', COLORS.card] : [COLORS.card, COLORS.bg]}
          style={styles.productGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {isSelected && (
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityBadgeText}>{quantity}</Text>
            </View>
          )}

          <View style={styles.productIcon}>
            <Ionicons 
              name={item.icon || (isSelected ? 'checkbox' : 'cube')} 
              size={32} 
              color={item.stock <= 0 ? COLORS.textMuted : isSelected ? COLORS.info : COLORS.info + '80'} 
            />
          </View>
          
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          
          {item.category ? (
            <Text style={styles.productCategory}>{item.category}</Text>
          ) : null}
          
          <Text style={styles.productPrice}>
            {format(item.price)}
          </Text>
          
          <View style={styles.productFooter}>
            <View style={[styles.stockBadge, { backgroundColor: stockColor + '20' }]}>
              <Text style={[styles.stockText, { color: stockColor }]}>
                Stock: {item.stock}
              </Text>
            </View>
            
            {item.stock > 0 ? (
              <View style={[styles.addButton, isSelected && styles.addButtonSelected]}>
                <Ionicons name={isSelected ? "add" : "add"} size={20} color="white" />
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }, [cart, numColumns, addToCart]);

  /* ======================
     RENDER CART ITEM
  ====================== */

  const renderCartItem = useCallback(({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemLeft}>
        <View style={styles.cartItemIcon}>
          <Ionicons name={item.icon || 'cube'} size={20} color={COLORS.info} />
        </View>
        <View style={styles.cartItemInfo}>
          <Text style={styles.cartItemName}>{item.name}</Text>
          <Text style={styles.cartItemPrice}>{format(item.price)}</Text>
        </View>
      </View>

      <View style={styles.cartItemRight}>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => removeFromCart(item.id)}
          >
            <Ionicons name="remove" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <Text style={styles.quantityText}>{item.quantity}</Text>
          
          <TouchableOpacity
            style={[styles.quantityButton, styles.quantityButtonAdd]}
            onPress={() => addToCart(item)}
          >
            <Ionicons name="add" size={18} color="white" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.cartItemTotal}>
          {format(item.price * item.quantity)}
        </Text>
      </View>
    </View>
  ), [removeFromCart, addToCart]);

  /* ======================
     CHECKOUT
  ====================== */

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (paymentMethod === 'cash') {
      const received = cashReceived ? parseFloat(cashReceived) : total;
      if (isNaN(received) || received < total) {
        Alert.alert('Erreur', 'Le montant reçu est insuffisant ou invalide.');
        return;
      }
      
      const change = received - total;
      if (change > 0) {
        if (Platform.OS === 'web') {
          // Sur le web, Alert.alert avec boutons "custom" peut bloquer le composant sous certaines versions
          window.alert(`Monnaie à rendre : ${format(change)}`);
          finalizeCheckout();
        } else {
          Alert.alert(
            'Monnaie à rendre',
            `${format(change)}`,
            [{ text: 'OK', onPress: () => finalizeCheckout() }]
          );
        }
      } else {
        finalizeCheckout();
      }
    } else {
      finalizeCheckout();
    }
  };

  const finalizeCheckout = async () => {
    if (!storeId || cart.length === 0) {
      Alert.alert('Erreur', 'Panier vide ou boutique non définie');
      return;
    }

    try {
      // Créer la commande dans Supabase
      const orderPayload: any = {
        user_id: user?.id || '',
        store_id: storeId,
        total_amount: total,
        tax_amount: tax,
        delivery_fee: 0,
        status: 'paid',
        payment_method: paymentMethod === 'cash' ? 'cash_on_delivery' : paymentMethod === 'card' ? 'card' : 'mobile_money',
        payment_status: 'paid',
        notes: `Vente caisse - ${paymentMethod}`,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
      };

      const order = await orderService.create(orderPayload);

      // Insérer les order_items
      const itemsPayload = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        cost_price: item.cost_price,
      }));
      await orderService.createItems(itemsPayload);

      // Log stock movements to stock_movements table before updating stocks
      const client = useSupabase();
      for (const item of cart) {
        try {
          await client.from('stock_movements').insert({
            product_id: item.id,
            quantity_changed: -item.quantity,
            previous_stock: item.stock, // original stock
            new_stock: item.stock - item.quantity,
            type: 'sale',
            reason: 'Vente caisse',
            notes: `Vente caisse - Ticket #${order.id.slice(0, 8).toUpperCase()} - Paiement : ${paymentMethod}`,
            created_by: user?.id,
          });
        } catch (mErr) {
          console.warn('Failed to log stock movement for caisse item:', mErr);
        }
      }

      // Décrémenter le stock via le RPC
      await orderService.processPayment(order.id);

      // Préchargement du QR code en base64 pour garantir son affichage dans le reçu
      const orderUrl = qrCodeService.getOrderUrl(order.id);
      const qrBase64 = await qrCodeService.getQrImageBase64(orderUrl, 100);

      // Génération du ticket format thermique (58/80mm)
      const html = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ticket de caisse</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
            body {
              font-family: 'Courier Prime', 'Courier New', monospace;
              margin: 0 auto;
              padding: 15px;
              width: 300px;
              color: #000;
              font-size: 13px;
              line-height: 1.4;
              background: white;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .left { text-align: left; }
            .bold { font-weight: bold; }
            .dashed-line {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }
            .store-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .header-info {
              font-size: 12px;
              margin-bottom: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
              font-size: 13px;
            }
            th, td {
              padding: 4px 0;
              vertical-align: top;
            }
            .item-name {
              text-transform: uppercase;
              padding-right: 5px;
              word-wrap: break-word;
            }
            img.logo {
              max-width: 120px;
              max-height: 80px;
              margin-bottom: 10px;
              filter: grayscale(100%);
            }
          </style>
        </head>
        <body>
          <div class="center">
            
            <div class="store-name">${store?.name || 'BOUTIQUE'}</div>
            ${store?.address ? `<div class="header-info">${store.address}</div>` : ''}
            ${store?.phone ? `<div class="header-info">Tél: ${store.phone}</div>` : ''}
          </div>

          <div class="dashed-line"></div>

          <div style="margin-bottom: 10px;">
            <div><span class="bold">Date :</span> ${new Date().toLocaleString('fr-FR')}</div>
            <div><span class="bold">Ticket N° :</span> ${order.id.slice(0, 8).toUpperCase()}</div>
            <div><span class="bold">Caissier :</span> ${(user as any)?.user_metadata?.full_name || user?.email || 'Admin'}</div>
            ${customerName.trim() ? `<div><span class="bold">Client :</span> ${customerName.trim()}</div>` : ''}
          </div>

          <div class="center bold" style="margin: 15px 0; font-size: 15px;">TICKET DE CAISSE</div>
          <div class="dashed-line"></div>

          <table>
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th class="left" style="width: 70%;">QTE & ARTICLE</th>
                <th class="right" style="width: 30%;">MONTANT</th>
              </tr>
            </thead>
            <tbody>
              ${cart.map(item => `
                <tr>
                  <td class="item-name">
                    ${item.quantity}x ${item.name}
                    <div style="font-size: 11px; margin-top: 2px;">${format(item.price)}/U</div>
                  </td>
                  <td class="right bold">${format(item.price * item.quantity)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="dashed-line"></div>

          <table style="font-size: 14px;">
            <tr>
              <td class="left">SOUS-TOTAL :</td>
              <td class="right">${format(subtotal)}</td>
            </tr>
            <tr>
              <td class="left">TVA (${taxRate}%) :</td>
              <td class="right">${format(tax)}</td>
            </tr>
            <tr class="bold" style="font-size: 18px;">
              <td class="left" style="padding-top: 10px;">NET A PAYER :</td>
              <td class="right" style="padding-top: 10px;">${format(total)}</td>
            </tr>
          </table>

          <div class="dashed-line"></div>

          <div style="font-size: 13px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>Mode de paiement :</span>
              <span class="bold">${paymentMethod === 'cash' ? 'ESPECES' : paymentMethod === 'card' ? 'CARTE' : 'MOBILE MONEY'}</span>
            </div>
            ${paymentMethod === 'cash' ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Espèces reçues :</span>
                <span>${format(parseFloat(cashReceived || total.toString()))}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Monnaie rendue :</span>
                <span class="bold">${format(parseFloat(cashReceived || total.toString()) - total)}</span>
              </div>
            ` : ''}
          </div>

          <div class="dashed-line"></div>

          <div class="center" style="margin-top: 20px;">
            <img src="${qrBase64}" style="width: 80px; height: 80px; margin-bottom: 10px;" />
            <div class="bold" style="font-size: 14px;">MERCI ET A BIENTOT !</div>
            <div style="font-size: 10px; margin-top: 15px; color: #666;">Propulsé par LibreShop App</div>
          </div>
        </body>
        </html>
      `;

      try {
        if (Platform.OS === 'web') {
          // Sur le web (mobile & desktop) : ouvrir une nouvelle fenêtre dédiée au ticket
          // Beaucoup de navigateurs mobiles gèrent mieux window.print() depuis une popup.
          try {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.open();
              printWindow.document.write(html);
              printWindow.document.close();
              // Laisser le navigateur charger les ressources puis lancer l'impression
              setTimeout(() => {
                try {
                  printWindow.focus();
                  printWindow.print();
                  // Fermer la fenêtre après impression (certaines plateformes empêchent)
                  setTimeout(() => { try { printWindow.close(); } catch {} }, 1000);
                } catch (pwErr) {
                  console.warn('printWindow.print failed', pwErr);
                }
              }, 600);
            } else {
              // Fallback visible iframe (utile si popup bloquée) — rendre visible pour éviter capture écran
              const iframe = document.createElement('iframe');
              iframe.style.position = 'fixed';
              iframe.style.left = '50%';
              iframe.style.top = '10%';
              iframe.style.transform = 'translateX(-50%)';
              iframe.style.width = '360px';
              iframe.style.height = '640px';
              iframe.style.zIndex = '99999';
              iframe.style.border = '1px solid #ccc';
              document.body.appendChild(iframe);
              if (iframe.contentWindow) {
                iframe.contentWindow.document.open();
                iframe.contentWindow.document.write(html);
                iframe.contentWindow.document.close();
                setTimeout(() => {
                  iframe.contentWindow?.focus();
                  iframe.contentWindow?.print();
                  setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000);
                }, 700);
              }
            }
          } catch (e) {
            console.warn('Web print fallback failed, attempting iframe', e);
            try {
              const iframe = document.createElement('iframe');
              iframe.style.position = 'fixed';
              iframe.style.left = '50%';
              iframe.style.top = '10%';
              iframe.style.transform = 'translateX(-50%)';
              iframe.style.width = '360px';
              iframe.style.height = '640px';
              iframe.style.zIndex = '99999';
              iframe.style.border = '1px solid #ccc';
              document.body.appendChild(iframe);
              if (iframe.contentWindow) {
                iframe.contentWindow.document.open();
                iframe.contentWindow.document.write(html);
                iframe.contentWindow.document.close();
                setTimeout(() => {
                  iframe.contentWindow?.focus();
                  iframe.contentWindow?.print();
                  setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000);
                }, 700);
              }
            } catch (e2) {
              console.warn('All web print fallbacks failed', e2);
            }
          }
        } else {
          const { uri } = await Print.printToFileAsync({ html });
          await Sharing.shareAsync(uri);
        }
      } catch (printError) {
        console.warn('Erreur lors de l\'impression ou du partage du ticket:', printError);
      }
      
      // Recharger les produits pour mettre à jour les stocks
      const updatedProducts = await productService.getByStoreAvailable(storeId);
      setProducts(updatedProducts || []);
      
      // Vider le panier
      setCart([]);
      setShowCheckoutModal(false);
      setCashReceived('');
      
      Alert.alert('Succès', 'Vente effectuée avec succès !');
    } catch (error) {
      errorHandler.handleDatabaseError(error as any, 'Erreur finalisation caisse:');
      Alert.alert('Erreur', 'Impossible de finaliser la vente');
      
      // Ensure Modal closes even if order errors out partially
      setShowCheckoutModal(false);
    }
  };

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (!showCameraScanner) return;
    
    const q = data.trim().toLowerCase();
    const match = products.find(p => p.reference?.toLowerCase() === q);
    
    if (match) {
      addToCart(match);
      setShowCameraScanner(false);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Non trouvé', `Aucun produit avec la référence ${data} n'a été trouvé.`);
      setShowCameraScanner(false);
    }
  }, [showCameraScanner, products, addToCart]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.info} />
          <Text style={styles.loadingText}>Chargement des produits...</Text>
        </View>
      )}
      
      {!loading && (
        <>
      
      {/* Header avec padding pour éviter les boutons système */}
      <LinearGradient
        colors={[COLORS.card, COLORS.bg]}
        style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 10 : 15 }]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('SellerDashboard')} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Ionicons name="cash-outline" size={28} color={COLORS.info} />
          <Text style={styles.headerTitle}>Smart Caisse</Text>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowReturnModal(true)}
          >
            <Ionicons name="receipt" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="stats-chart" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerButton, customerName ? { backgroundColor: COLORS.info + '20', borderRadius: 8, padding: 4, margin: -4 } : {}]}
            onPress={() => setShowClientPicker(true)}
          >
            <Ionicons name={customerName ? "person" : "person-outline"} size={22} color={customerName ? COLORS.info : COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={[
        styles.main,
        { flexDirection: isTablet ? 'row' : 'column' }
      ]}>

        {/* SECTION PRODUITS */}
        <View style={styles.productsSection}>

          {/* Barre de recherche */}
          <View style={styles.searchContainer}>
            <SearchBar
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="Scanner ou rechercher..."
              isLoading={productSearchLoading}
              onClear={() => setProductSearch('')}
              onSubmitEditing={() => {
                const q = productSearch.trim().toLowerCase();
                if (q) {
                  const match = products.find(p => p.reference?.toLowerCase() === q);
                  if (match) {
                    addToCart(match);
                    setProductSearch('');
                  }
                }
              }}
            />
            <TouchableOpacity 
              style={{ marginLeft: 12, padding: 4 }}
              onPress={async () => {
                if (!permission?.granted) {
                  const status = await requestPermission();
                  if (!status.granted) {
                    Alert.alert('Permission requise', 'L\'accès à la caméra est nécessaire pour scanner des codes-barres.');
                    return;
                  }
                }
                setShowCameraScanner(true);
              }}
            >
              <Ionicons name="barcode-outline" size={24} color={COLORS.info} />
            </TouchableOpacity>
          </View>

          {/* Client sélectionné */}
          {customerName ? (
            <View style={styles.selectedClientBanner}>
              <View style={styles.selectedClientInfo}>
                <Ionicons name="person" size={16} color={COLORS.info} />
                <Text style={styles.selectedClientText}>
                  Client : <Text style={{ fontWeight: 'bold' }}>{customerName}</Text>
                  {customerPhone ? ` (${customerPhone})` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setCustomerName(''); setCustomerPhone(''); }}>
                <Ionicons name="close-circle" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Filtres catégories */}
          <ScrollableCategories
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {/* Grille produits */}
          <FlatList
            data={filtered}
            renderItem={renderProduct}
            keyExtractor={item => item.id}
            numColumns={numColumns}
            key={numColumns}
            columnWrapperStyle={
              numColumns > 1 ? styles.productRow : undefined
            }
            contentContainerStyle={styles.productGrid}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== 'web'}
            updateCellsBatchingPeriod={50}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color="#334155" />
                <Text style={styles.emptyStateText}>
                  Aucun produit trouvé
                </Text>
              </View>
            }
          />
        </View>

        {/* BOUTON TOGGLE PANIER (Mobile) */}
        {!isTablet && (
          <TouchableOpacity
            style={styles.toggleCartButton}
            onPress={() => setCartVisible(!cartVisible)}
          >
            <BlurView intensity={80} tint="dark" style={styles.toggleCartBlur}>
              <Ionicons 
                name={cartVisible ? 'cart-outline' : 'cart'} 
                size={24} 
                color="white" 
              />
              {cartItemCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
                </View>
              ) : null}
            </BlurView>
          </TouchableOpacity>
        )}

        {/* SECTION PANIER */}
        {(isTablet || cartVisible) && (
          <Animated.View style={[
            styles.cartSection,
            { width: isTablet ? 380 : '100%' },
            !isTablet && { position: 'absolute', right: 0, top: 0, bottom: 0 }
          ]}>
            <LinearGradient
              colors={[COLORS.bg, COLORS.bg]}
              style={styles.cartGradient}
            >
              {/* En-tête panier */}
              <View style={styles.cartHeader}>
                <View style={styles.cartHeaderLeft}>
                  <Ionicons name="cart" size={24} color={COLORS.info} />
                  <Text style={styles.cartTitle}>Panier</Text>
                  {cartItemCount > 0 ? (
                    <View style={styles.cartItemCount}>
                      <Text style={styles.cartItemCountText}>
                        {cartItemCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
                
                {cart.length > 0 ? (
                  <TouchableOpacity onPress={clearCart}>
                    <Text style={styles.clearCartText}>Vider</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Liste articles panier */}
              {cart.length > 0 ? (
                <FlatList
                  data={cart}
                  renderItem={renderCartItem}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.cartList}
                  showsVerticalScrollIndicator={false}
                />
              ) : (
                <View style={styles.emptyCart}>
                  <Ionicons name="basket-outline" size={48} color="#334155" />
                  <Text style={styles.emptyCartText}>
                    Votre panier est vide
                  </Text>
                </View>
              )}

              {/* Résumé et paiement */}
              {cart.length > 0 ? (
                <View style={styles.cartFooter}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Sous-total</Text>
                    <Text style={styles.summaryValue}>{format(subtotal)}</Text>
                  </View>
                  
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>TVA ({taxRate}%)</Text>
                    <Text style={styles.summaryValue}>{format(tax)}</Text>
                  </View>
                  
                  <View style={[styles.summaryItem, styles.totalItem]}>
                    <Text style={styles.totalLabel}>Total TTC</Text>
                    <Text style={styles.totalValue}>{format(total)}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.payButton}
                    onPress={() => setShowCheckoutModal(true)}
                  >
                    <LinearGradient
                      colors={[COLORS.success, COLORS.accent]}
                      style={styles.payButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.payButtonText}>Procéder au paiement</Text>
                      <Ionicons name="arrow-forward" size={20} color="white" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : null}
            </LinearGradient>
          </Animated.View>
        )}
      </View>

      {/* MODAL DE PAIEMENT */}
      <Modal
        visible={showCheckoutModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCheckoutModal(false)}
      >
        <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Paiement</Text>
                <TouchableOpacity onPress={() => setShowCheckoutModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalTotal}>
                Total à payer : {format(total)}
              </Text>

              {/* Infos Client (Optionnel) */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>
                  Client (Optionnel)
                </Text>
                <TextInput
                  style={[styles.cashInput, { marginBottom: 10, fontSize: 14 }]}
                  placeholder="Rechercher ou entrer un nom de client"
                  placeholderTextColor="#9ca3af"
                  value={customerName}
                  onChangeText={(text) => {
                    setCustomerName(text);
                    setCustomerPhone(''); // Reset phone when typing manually
                  }}
                />
                
                {/* AUTOCOMPLETE SUGGESTIONS */}
                {customerName.length > 1 && !clients.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase()) && (
                  <View style={{ marginBottom: 10, backgroundColor: COLORS.bg, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
                    {clients
                      .filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()) || c.phone.includes(customerName))
                      .slice(0, 3)
                      .map(client => (
                        <TouchableOpacity 
                          key={client.id}
                          style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}
                          onPress={() => {
                            setCustomerName(client.name);
                            setCustomerPhone(client.phone);
                          }}
                        >
                          <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '500' }}>{client.name}</Text>
                          {client.phone ? <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>{client.phone}</Text> : null}
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>

              {/* Méthodes de paiement */}
              <View style={styles.paymentMethods}>
                <TouchableOpacity
                  style={[
                    styles.paymentMethod,
                    paymentMethod === 'cash' && styles.paymentMethodActive
                  ]}
                  onPress={() => setPaymentMethod('cash')}
                >
                  <Ionicons 
                    name="cash-outline" 
                    size={24} 
                    color={paymentMethod === 'cash' ? COLORS.success : COLORS.textMuted} 
                  />
                  <Text style={[
                    styles.paymentMethodText,
                    paymentMethod === 'cash' && styles.paymentMethodTextActive
                  ]}>
                    Espèces
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentMethod,
                    paymentMethod === 'card' && styles.paymentMethodActive
                  ]}
                  onPress={() => setPaymentMethod('card')}
                >
                  <Ionicons 
                    name="card-outline" 
                    size={24} 
                    color={paymentMethod === 'card' ? COLORS.success : COLORS.textMuted} 
                  />
                  <Text style={[
                    styles.paymentMethodText,
                    paymentMethod === 'card' && styles.paymentMethodTextActive
                  ]}>
                    Carte
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentMethod,
                    paymentMethod === 'transfer' && styles.paymentMethodActive
                  ]}
                  onPress={() => setPaymentMethod('transfer')}
                >
                  <Ionicons 
                    name="phone-portrait-outline" 
                    size={24} 
                    color={paymentMethod === 'transfer' ? COLORS.success : COLORS.textMuted} 
                  />
                  <Text style={[
                    styles.paymentMethodText,
                    paymentMethod === 'transfer' && styles.paymentMethodTextActive
                  ]}>
                    Mobile
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Montant reçu (pour espèces) */}
              {paymentMethod === 'cash' && (
                <View style={styles.cashInputContainer}>
                  <Text style={styles.cashInputLabel}>Montant reçu</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {[total, Math.ceil(total/5000)*5000, Math.ceil(total/10000)*10000].filter((v, i, a) => v >= total && a.indexOf(v) === i).map((amt, idx) => (
                      <TouchableOpacity 
                        key={idx}
                        style={{ backgroundColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                        onPress={() => setCashReceived(amt.toString())}
                      >
                         <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>
                           {amt === total ? 'Exact' : `${amt.toLocaleString('fr-FR')} F`}
                         </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.cashInput}
                    placeholder="0"
                    placeholderTextColor="#4b5563"
                    value={cashReceived}
                    onChangeText={setCashReceived}
                    keyboardType="numeric"
                  />
                </View>
              )}

              {/* Bouton valider */}
              <TouchableOpacity
                style={styles.validateButton}
                onPress={handleCheckout}
                disabled={loading}
              >
                <View style={[styles.validateButtonGradient, { backgroundColor: COLORS.accent }]}>
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text style={[styles.validateButtonText, { color: 'white' }]}>
                        Valider le paiement
                      </Text>
                      <Ionicons name="checkmark-circle" size={20} color="white" />
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>

      {/* MODAL DE SÉLECTION DE CLIENT */}
      <Modal
        visible={showClientPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowClientPicker(false)}
      >
        <TouchableOpacity 
          style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }]} 
          activeOpacity={1} 
          onPress={() => setShowClientPicker(false)}
        >
          <View style={[styles.modalContent, { marginHorizontal: 20, borderRadius: 20, minHeight: 300, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attribuer à un client</Text>
              <TouchableOpacity onPress={() => setShowClientPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.cashInput, { marginBottom: 15, fontSize: 14 }]}
              placeholder="Rechercher par nom ou téléphone..."
              placeholderTextColor="#9ca3af"
              autoFocus
              onChangeText={(text) => {
                setCustomerName(text);
                // Si on tape un truc qui n'est pas dans la liste, on laisse le nom tel quel
              }}
              value={customerName}
            />

            <FlatList
              data={clients.filter(c => 
                c.name.toLowerCase().includes(customerName.toLowerCase()) || 
                c.phone.includes(customerName)
              )}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={{ 
                    padding: 16, 
                    borderBottomWidth: 1, 
                    borderBottomColor: COLORS.border,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onPress={() => {
                    setCustomerName(item.name);
                    setCustomerPhone(item.phone);
                    setShowClientPicker(false);
                  }}
                >
                  <View>
                    <Text style={{ color: COLORS.text, fontWeight: '600' }}>{item.name}</Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>{item.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.textMuted }}>Aucun client trouvé</Text>
                  <TouchableOpacity 
                    style={{ marginTop: 10, padding: 8, backgroundColor: COLORS.info + '20', borderRadius: 8 }}
                    onPress={() => setShowClientPicker(false)}
                  >
                    <Text style={{ color: COLORS.info }}>Utiliser "{customerName}"</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL SCANNER CAMÉRA */}
      <Modal
        visible={showCameraScanner}
        animationType="slide"
        onRequestClose={() => setShowCameraScanner(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"],
            }}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraHeader}>
                <TouchableOpacity 
                  style={styles.closeCameraButton}
                  onPress={() => setShowCameraScanner(false)}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.cameraTargetContainer}>
                <View style={styles.cameraTarget} />
              </View>

              <View style={styles.cameraFooter}>
                <Text style={styles.cameraHint}>Placez le code-barres dans le cadre</Text>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Modal de Retour Caisse (POS Return) */}
      {showReturnModal && storeId && user?.id && (
        <PosReturnModal
          visible={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          storeId={storeId}
          userId={user.id}
        />
      )}
        </>
      )}
    </SafeAreaView>
  );
};

/* ======================
   COMPOSANT CATÉGORIES SCROLLABLE
====================== */

const ScrollableCategories = ({ 
  categories, 
  selectedCategory, 
  onSelectCategory 
}: { 
  categories: string[], 
  selectedCategory: string | null, 
  onSelectCategory: (cat: string | null) => void 
}) => (
  <View style={styles.categoriesContainer}>
    <FlatList
      horizontal
      data={categories}
      keyExtractor={item => item}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.categoryChip,
            selectedCategory === item && styles.categoryChipActive
          ]}
          onPress={() => onSelectCategory(selectedCategory === item ? null : item)}
        >
          <Text style={[
            styles.categoryChipText,
            selectedCategory === item && styles.categoryChipTextActive
          ]}>
            {item}
          </Text>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.categoriesList}
    />
  </View>
);

/* ======================
   STYLES MODERNES
====================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.card,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 15,
  },
  main: {
    flex: 1,
  },
  productsSection: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    marginBottom: 15,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: COLORS.text,
    fontSize: 16,
    padding: 0,
  },
  selectedClientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.info + '15',
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.info + '30',
  },
  selectedClientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedClientText: {
    color: COLORS.text,
    fontSize: 14,
  },
  categoriesContainer: {
    marginBottom: 20,
  },
  categoriesList: {
    paddingRight: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.info,
    borderColor: COLORS.info,
  },
  categoryChipText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: COLORS.text,
  },
  productGrid: {
    paddingBottom: 20,
  },
  productRow: {
    justifyContent: 'flex-start',
  },
  productCard: {
    flex: 1,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  productGradient: {
    padding: 16,
    borderRadius: 20,
  },
  productIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  productName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productCategory: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  productPrice: {
    color: COLORS.info,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.info,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonSelected: {
    backgroundColor: COLORS.success,
  },
  productCardSelected: {
    borderColor: COLORS.info,
    borderWidth: 2,
  },
  quantityBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.info,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  quantityBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginTop: 10,
  },
  toggleCartButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 100,
    borderRadius: 30,
    overflow: 'hidden',
  },
  toggleCartBlur: {
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  cartSection: {
    height: '100%',
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.card,
  },
  cartGradient: {
    flex: 1,
    padding: 16,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cartItemCount: {
    backgroundColor: COLORS.info,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  cartItemCountText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  clearCartText: {
    color: COLORS.danger,
    fontSize: 14,
  },
  cartList: {
    paddingBottom: 20,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.card,
  },
  cartItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cartItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  cartItemPrice: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  cartItemRight: {
    alignItems: 'flex-end',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonAdd: {
    backgroundColor: COLORS.info,
  },
  quantityText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  cartItemTotal: {
    color: COLORS.info,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyCartText: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginTop: 10,
  },
  cartFooter: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.card,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 14,
  },
  totalItem: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.card,
  },
  totalLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: COLORS.success,
    fontSize: 20,
    fontWeight: 'bold',
  },
  payButton: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  payButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalTotal: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  paymentMethod: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.border,
    minWidth: 100,
  },
  paymentMethodActive: {
    backgroundColor: COLORS.info,
  },
  paymentMethodText: {
    color: COLORS.textMuted,
    marginTop: 8,
    fontSize: 14,
  },
  paymentMethodTextActive: {
    color: COLORS.text,
    marginTop: 8,
    fontSize: 14,
  },
  cashInputContainer: {
    marginBottom: 30,
  },
  cashInputLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  cashInput: {
    backgroundColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    color: COLORS.text,
    fontSize: 18,
  },
  validateButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  validateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  validateButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 16,
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 20,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Platform.OS === 'ios' ? 40 : 20,
  },
  closeCameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraTargetContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTarget: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cameraFooter: {
    alignItems: 'center',
    marginBottom: 40,
  },
  cameraHint: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
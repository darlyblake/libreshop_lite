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
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store';
import { productService, storeService, orderService, type Product, type Order } from '../lib/supabase';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type CartItem = Product & {
  quantity: number;
};

export const SellerCaisseScreen = () => {
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();
  const [cartVisible, setCartVisible] = useState(true);
  const cartAnimation = useRef(new Animated.Value(0)).current;

  const isTablet = width >= 768;
  const isLargeScreen = width >= 1200;

  // Colonnes dynamiques selon écran
  const numColumns = isLargeScreen ? 4 : isTablet ? 3 : 2;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState('');

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
          setProducts([]);
          return;
        }
        setStoreId(store.id);
        const data = await productService.getByStoreAvailable(store.id);
        setProducts(data || []);
      } catch (e) {
        console.error('Erreur chargement produits caisse', e);
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

  const tax = subtotal * 0.18; // TVA 18%
  const total = subtotal + tax;

  const cartItemCount = useMemo(
    () => cart.reduce((count, item) => count + item.quantity, 0),
    [cart]
  );

  /* ======================
     FILTRES
  ====================== */

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['Tous', ...Array.from(cats)];
  }, [products]);

  const filtered = useMemo(() => {
    let filtered = products;
    
    // Filtre recherche
    const q = search.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    
    // Filtre catégorie
    if (selectedCategory && selectedCategory !== 'Tous') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    return filtered;
  }, [search, products, selectedCategory]);

  /* ======================
     RENDER PRODUCT CARD
  ====================== */

  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    const stockColor = item.stock > 10 ? '#22c55e' : item.stock > 0 ? '#f59e0b' : '#ef4444';
    
    return (
      <TouchableOpacity
        style={[
          styles.productCard,
          { marginLeft: index % numColumns === 0 ? 0 : 8 }
        ]}
        onPress={() => addToCart(item)}
        disabled={item.stock <= 0}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={item.stock <= 0 ? ['#2d3748', '#1e293b'] : ['#1e293b', '#0f172a']}
          style={styles.productGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.productIcon}>
            <Ionicons 
              name={item.icon || 'cube'} 
              size={32} 
              color={item.stock <= 0 ? '#64748b' : '#3b82f6'} 
            />
          </View>
          
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          
          {item.category && (
            <Text style={styles.productCategory}>{item.category}</Text>
          )}
          
          <Text style={styles.productPrice}>
            {format(item.price)}
          </Text>
          
          <View style={styles.productFooter}>
            <View style={[styles.stockBadge, { backgroundColor: stockColor + '20' }]}>
              <Text style={[styles.stockText, { color: stockColor }]}>
                Stock: {item.stock}
              </Text>
            </View>
            
            {item.stock > 0 && (
              <View style={styles.addButton}>
                <Ionicons name="add" size={20} color="white" />
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  /* ======================
     RENDER CART ITEM
  ====================== */

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemLeft}>
        <View style={styles.cartItemIcon}>
          <Ionicons name={item.icon || 'cube'} size={20} color="#3b82f6" />
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
            <Ionicons name="remove" size={18} color="#94a3b8" />
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
  );

  /* ======================
     CHECKOUT
  ====================== */

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived);
      if (isNaN(received) || received < total) {
        Alert.alert('Erreur', 'Le montant reçu est insuffisant ou invalide.');
        return;
      }
      
      const change = received - total;
      Alert.alert(
        'Monnaie à rendre',
        `${format(change)}`,
        [{ text: 'OK', onPress: () => finalizeCheckout() }]
      );
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
      const orderPayload: Partial<Order> = {
        user_id: user?.id || '',
        store_id: storeId,
        total_amount: total,
        status: 'paid',
        payment_method: paymentMethod === 'cash' ? 'cash_on_delivery' : paymentMethod === 'card' ? 'card' : 'mobile_money',
        payment_status: 'paid',
        notes: `Vente caisse - ${paymentMethod}`,
      };

      const order = await orderService.create(orderPayload);

      // Insérer les order_items
      const itemsPayload = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));
      await orderService.client?.from('order_items').insert(itemsPayload);

      // Décrémenter le stock via le RPC
      await orderService.client?.rpc('process_order_after_payment', {
        p_order_id: order.id,
      });

      // Génération du ticket
      const html = `
        <html>
          <body style="font-family: Arial; padding: 20px;">
            <h1 style="text-align: center;">TICKET DE CAISSE</h1>
            <p>Date: ${new Date().toLocaleString()}</p>
            <p>Commande: ${order.id}</p>
            <hr/>
            ${cart.map(item => `
              <div style="display: flex; justify-content: space-between;">
                <span>${item.name} x${item.quantity}</span>
                <span>${format(item.price * item.quantity)}</span>
              </div>
            `).join('')}
            <hr/>
            <div style="display: flex; justify-content: space-between;">
              <strong>Sous-total</strong>
              <strong>${format(subtotal)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <strong>TVA (18%)</strong>
              <strong>${format(tax)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 18px;">
              <strong>TOTAL</strong>
              <strong>${format(total)}</strong>
            </div>
            <p style="text-align: center; margin-top: 30px;">Merci de votre visite !</p>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
      
      // Recharger les produits pour mettre à jour les stocks
      const updatedProducts = await productService.getByStoreAvailable(storeId);
      setProducts(updatedProducts || []);
      
      // Vider le panier
      setCart([]);
      setShowCheckoutModal(false);
      setCashReceived('');
      
      Alert.alert('Succès', 'Vente effectuée avec succès !');
    } catch (error) {
      console.error('Erreur finalisation caisse:', error);
      Alert.alert('Erreur', 'Impossible de finaliser la vente');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Chargement des produits...</Text>
        </View>
      )}
      
      {!loading && (
        <>
      
      {/* Header avec padding pour éviter les boutons système */}
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 10 : 15 }]}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="cash-outline" size={28} color="#3b82f6" />
          <Text style={styles.headerTitle}>Smart Caisse</Text>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="stats-chart" size={22} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="person-outline" size={22} color="#94a3b8" />
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
            <View style={styles.searchWrapper}>
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput
                placeholder="Rechercher un produit..."
                placeholderTextColor="#64748b"
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
              {search !== '' && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          </View>

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
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
                </View>
              )}
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
              colors={['#111827', '#0f172a']}
              style={styles.cartGradient}
            >
              {/* En-tête panier */}
              <View style={styles.cartHeader}>
                <View style={styles.cartHeaderLeft}>
                  <Ionicons name="cart" size={24} color="#3b82f6" />
                  <Text style={styles.cartTitle}>Panier</Text>
                  {cartItemCount > 0 && (
                    <View style={styles.cartItemCount}>
                      <Text style={styles.cartItemCountText}>
                        {cartItemCount}
                      </Text>
                    </View>
                  )}
                </View>
                
                {cart.length > 0 && (
                  <TouchableOpacity onPress={clearCart}>
                    <Text style={styles.clearCartText}>Vider</Text>
                  </TouchableOpacity>
                )}
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
              {cart.length > 0 && (
                <View style={styles.cartFooter}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Sous-total</Text>
                    <Text style={styles.summaryValue}>{format(subtotal)}</Text>
                  </View>
                  
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>TVA (18%)</Text>
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
                      colors={['#22c55e', '#16a34a']}
                      style={styles.payButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.payButtonText}>Procéder au paiement</Text>
                      <Ionicons name="arrow-forward" size={20} color="white" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
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
                  <Ionicons name="close" size={24} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalTotal}>
                Total à payer : {format(total)}
              </Text>

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
                    color={paymentMethod === 'cash' ? '#22c55e' : '#94a3b8'} 
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
                    color={paymentMethod === 'card' ? '#22c55e' : '#94a3b8'} 
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
                    color={paymentMethod === 'transfer' ? '#22c55e' : '#94a3b8'} 
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
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  style={styles.validateButtonGradient}
                >
                  <Text style={styles.validateButtonText}>
                    Valider le paiement
                  </Text>
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>
        </>
      )}
    </SafeAreaView>
  );
};

/* ======================
   COMPOSANT CATÉGORIES SCROLLABLE
====================== */

const ScrollableCategories = ({ categories, selectedCategory, onSelectCategory }) => (
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
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
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
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: 'white',
    fontSize: 16,
    padding: 0,
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
    backgroundColor: '#1e293b',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryChipText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: 'white',
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
    backgroundColor: '#2d3748',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  productName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productCategory: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
  },
  productPrice: {
    color: '#3b82f6',
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
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#64748b',
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
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cartSection: {
    height: '100%',
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderLeftColor: '#1e293b',
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
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cartItemCount: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  cartItemCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  clearCartText: {
    color: '#ef4444',
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
    borderBottomColor: '#1e293b',
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
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  cartItemPrice: {
    color: '#94a3b8',
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
    backgroundColor: '#2d3748',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonAdd: {
    backgroundColor: '#3b82f6',
  },
  quantityText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  cartItemTotal: {
    color: '#3b82f6',
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
    color: '#64748b',
    fontSize: 16,
    marginTop: 10,
  },
  cartFooter: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  summaryValue: {
    color: 'white',
    fontSize: 14,
  },
  totalItem: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  totalLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#22c55e',
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
    color: 'white',
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
    backgroundColor: '#1e293b',
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
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalTotal: {
    color: 'white',
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
    backgroundColor: '#2d3748',
    minWidth: 100,
  },
  paymentMethodActive: {
    backgroundColor: '#3b82f6',
  },
  paymentMethodText: {
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 14,
  },
  paymentMethodTextActive: {
    color: 'white',
    marginTop: 8,
    fontSize: 14,
  },
  cashInputContainer: {
    marginBottom: 30,
  },
  cashInputLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  cashInput: {
    backgroundColor: '#2d3748',
    borderRadius: 12,
    padding: 16,
    color: 'white',
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
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
});
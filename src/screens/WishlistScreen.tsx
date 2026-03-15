import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { wishlistService } from '../lib/wishlistService';
import { shopFollowService, ShopFollow } from '../lib/shopFollowService';
import { Product, Store } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';

const { width } = Dimensions.get('window');

// Types
interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  product?: Product & {
    store?: Store;
  };
  created_at: string;
}

interface FollowedStore extends ShopFollow {
  store?: Store;
}

export const WishlistScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'products' | 'shops'>('products');
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [followedStores, setFollowedStores] = useState<FollowedStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingItem, setRemovingItem] = useState<string | null>(null);
  const [unfollowingStore, setUnfollowingStore] = useState<string | null>(null);

  // Charger les favoris depuis Supabase
  const loadWishlist = async (): Promise<void> => {
    if (!user?.id) return;
    
    try {
      const items = await wishlistService.getByUser(String(user.id));
      
      // Charger les détails des produits avec les boutiques
      const itemsWithDetails = await Promise.all(
        items.map(async (item: WishlistItem) => {
          if (!item.product_id) return item;
          
          try {
            const { data: product, error } = await supabase!
              .from('products')
              .select('*, store:stores(*)')
              .eq('id', item.product_id)
              .single();
              
            if (error) throw error;
            
            return {
              ...item,
              product: product || undefined
            };
          } catch (err) {
            console.warn(`Erreur chargement produit ${item.product_id}:`, err);
            return item;
          }
        })
      );
      
      setWishlistItems(itemsWithDetails.filter(item => item.product));
    } catch (error) {
      console.error('Error loading wishlist:', error);
      setWishlistItems([]);
    }
  };

  // Charger les boutiques suivies
  const loadFollowedStores = async (): Promise<void> => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase!
        .from('shop_follows')
        .select('*, store:stores(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFollowedStores(data || []);
    } catch (error) {
      console.error('Error loading followed shops:', error);
      setFollowedStores([]);
    }
  };

  // Charger les deux listes
  const loadAllData = async (): Promise<void> => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      await Promise.all([loadWishlist(), loadFollowedStores()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Recharger quand l'écran est focus
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [user?.id])
  );

  // Supprimer un favori
  const removeFromWishlist = async (productId: string): Promise<void> => {
    if (!user?.id) return;
    
    try {
      setRemovingItem(productId);
      await wishlistService.remove(String(user.id), productId);
      setWishlistItems(prev => prev.filter(item => item.product_id !== productId));
      Alert.alert('✅ Succès', 'Produit retiré des favoris');
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      Alert.alert('❌ Erreur', 'Impossible de retirer ce produit');
    } finally {
      setRemovingItem(null);
    }
  };

  // Arrêter de suivre une boutique
  const unfollowStore = async (storeId: string): Promise<void> => {
    if (!user?.id) return;
    
    try {
      setUnfollowingStore(storeId);
      await shopFollowService.removeFollow(String(user.id), storeId);
      setFollowedStores(prev => prev.filter(item => item.store_id !== storeId));
      Alert.alert('✅ Succès', 'Vous avez arrêté de suivre cette boutique');
    } catch (error) {
      console.error('Error unfollowing store:', error);
      Alert.alert('❌ Erreur', 'Impossible d\'arrêter de suivre cette boutique');
    } finally {
      setUnfollowingStore(null);
    }
  };

  // Confirmation avant suppression
  const confirmRemove = (productId: string, productName: string): void => {
    Alert.alert(
      'Retirer des favoris',
      `Voulez-vous retirer "${productName}" de vos favoris ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Retirer', 
          onPress: () => removeFromWishlist(productId),
          style: 'destructive'
        }
      ]
    );
  };

  // Confirmation avant désabonnement
  const confirmUnfollow = (storeId: string, storeName: string): void => {
    Alert.alert(
      'Ne plus suivre',
      `Voulez-vous arrêter de suivre "${storeName}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Ne plus suivre', 
          onPress: () => unfollowStore(storeId),
          style: 'destructive'
        }
      ]
    );
  };

  // Rafraîchir
  const onRefresh = useCallback((): void => {
    setRefreshing(true);
    loadAllData();
  }, []);

  const renderWishlistItem = (item: WishlistItem) => (
    <TouchableOpacity 
      key={item.id} 
      style={styles.wishlistCard}
      onPress={() => navigation.navigate('ProductDetail', { productId: item.product_id })}
      activeOpacity={0.7}
    >
      <Image 
        source={{ 
          uri: item.product?.images?.[0] || 
               item.product?.image_url || 
               'https://via.placeholder.com/400?text=Produit'
        }} 
        style={styles.productImage} 
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.product?.name || 'Produit sans nom'}
        </Text>
        <Text style={styles.productStore} numberOfLines={1}>
          {item.product?.store?.name || 'Boutique inconnue'}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>
            {item.product?.price ? item.product.price.toLocaleString('fr-FR') : '0'} FCFA
          </Text>
          {item.product?.compare_price && item.product.compare_price > 0 && (
            <Text style={styles.comparePrice}>
              {item.product.compare_price.toLocaleString('fr-FR')} FCFA
            </Text>
          )}
        </View>
        
        {!item.product?.in_stock && (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockText}>Rupture de stock</Text>
          </View>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => confirmRemove(item.product_id, item.product?.name || 'ce produit')}
        disabled={removingItem === item.product_id}
      >
        {removingItem === item.product_id ? (
          <ActivityIndicator size="small" color={COLORS.danger} />
        ) : (
          <Ionicons name="heart" size={22} color={COLORS.danger} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderFollowedStore = (follow: FollowedStore) => (
    <TouchableOpacity
      key={follow.id}
      style={styles.storeCard}
      onPress={() => navigation.navigate('StoreDetail', { storeId: follow.store_id })}
      activeOpacity={0.7}
    >
      <Image
        source={{ 
          uri: follow.store?.logo_url || 
               'https://via.placeholder.com/150?text=Boutique'
        }}
        style={styles.storeLogo}
      />
      <View style={styles.storeInfo}>
        <Text style={styles.storeName} numberOfLines={1}>
          {follow.store?.name || 'Boutique sans nom'}
        </Text>
        <Text style={styles.storeCategory} numberOfLines={1}>
          {follow.store?.category || 'Non catégorisé'}
        </Text>
        <View style={styles.storeStats}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
          <Text style={styles.statText}>
            {follow.store?.verified ? 'Vérifiée · ' : ''}
            Suivie depuis {new Date(follow.created_at).toLocaleDateString('fr-FR')}
          </Text>
        </View>
        
        {follow.store?.products_count && (
          <Text style={styles.productCount}>
            {follow.store.products_count} produit(s)
          </Text>
        )}
      </View>
      
      <TouchableOpacity
        style={styles.unfollowButton}
        onPress={() => confirmUnfollow(follow.store_id, follow.store?.name || 'cette boutique')}
        disabled={unfollowingStore === follow.store_id}
      >
        {unfollowingStore === follow.store_id ? (
          <ActivityIndicator size="small" color={COLORS.danger} />
        ) : (
          <Ionicons name="close-circle" size={24} color={COLORS.danger} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes favoris</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={80} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Connectez-vous</Text>
          <Text style={styles.emptyText}>
            Connectez-vous pour voir vos produits favoris et boutiques suivies
          </Text>
          <Button
            title="Se connecter"
            onPress={() => navigation.navigate('Login')}
            style={styles.loginButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header avec dégradé */}
      <LinearGradient
        colors={[COLORS.accent, COLORS.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButtonLight} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitleLight}>Mes favoris</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Ionicons 
            name={activeTab === 'products' ? 'heart' : 'heart-outline'} 
            size={20} 
            color={activeTab === 'products' ? COLORS.white : COLORS.textMuted} 
          />
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            Produits ({wishlistItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'shops' && styles.activeTab]}
          onPress={() => setActiveTab('shops')}
        >
          <Ionicons 
            name={activeTab === 'shops' ? 'storefront' : 'storefront-outline'} 
            size={20} 
            color={activeTab === 'shops' ? COLORS.white : COLORS.textMuted} 
          />
          <Text style={[styles.tabText, activeTab === 'shops' && styles.activeTabText]}>
            Boutiques ({followedStores.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.accent} size="large" />
            <Text style={styles.loadingText}>Chargement de vos favoris...</Text>
          </View>
        ) : activeTab === 'products' ? (
          wishlistItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={80} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucun produit favori</Text>
              <Text style={styles.emptyText}>
                Ajoutez des produits à vos favoris en cliquant sur le cœur
              </Text>
              <TouchableOpacity 
                style={styles.exploreButton}
                onPress={() => navigation.navigate('ClientAllProducts')}
              >
                <Text style={styles.exploreButtonText}>Découvrir des produits</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.wishlistContainer}>
              {wishlistItems.map(renderWishlistItem)}
            </View>
          )
        ) : (
          followedStores.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={80} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucune boutique suivie</Text>
              <Text style={styles.emptyText}>
                Suivez vos boutiques préférées pour voir leurs nouveautés
              </Text>
              <TouchableOpacity 
                style={styles.exploreButton}
                onPress={() => navigation.navigate('ClientAllStores')}
              >
                <Text style={styles.exploreButtonText}>Découvrir des boutiques</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.storesContainer}>
              {followedStores.map(renderFollowedStore)}
            </View>
          )
        )}
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  headerGradient: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  backButtonLight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleLight: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.white,
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
  headerPlaceholder: {
    width: 40,
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeTab: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  activeTabText: {
    color: COLORS.white,
  },
  // Content
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  exploreButton: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
  },
  exploreButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  loginButton: {
    marginTop: SPACING.xl,
    minWidth: 200,
  },
  // Products section
  wishlistContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  wishlistCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.md,
  },
  productInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  productStore: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  productPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.accent,
  },
  comparePrice: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  outOfStockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.danger + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.xs,
  },
  outOfStockText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.danger,
    fontWeight: '600',
  },
  removeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  // Stores section
  storesContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  storeCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  storeLogo: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
  },
  storeInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  storeName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  storeCategory: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  storeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  statText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    flex: 1,
  },
  productCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  unfollowButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  bottomPadding: {
    height: SPACING.xxl,
  },
});
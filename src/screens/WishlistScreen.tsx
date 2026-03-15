import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { wishlistService } from '../lib/wishlistService';
import { shopFollowService, ShopFollow } from '../lib/shopFollowService';
import { Product, Store } from '../lib/supabase';
import { supabase } from '../lib/supabase';

interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  product?: Product;
  created_at: string;
}

interface FollowedStore extends ShopFollow {
  store?: Store;
}

const { width } = Dimensions.get('window');

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
  const loadWishlist = async () => {
    if (!user?.id) return;
    
    try {
      const items = await wishlistService.getByUser(String(user.id));
      setWishlistItems(items);
    } catch (error: any) {
      console.warn('Error loading wishlist:', error);
      setWishlistItems([]);
    }
  };

  // Charger les boutiques suivies
  const loadFollowedStores = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase!
        .from('shop_follows')
        .select('*, store:stores(*)')
        .eq('user_id', user.id);

      if (error) throw error;
      setFollowedStores(data || []);
    } catch (error: any) {
      console.warn('Error loading followed shops:', error);
      setFollowedStores([]);
    }
  };

  // Charger les deux listes
  const loadAllData = async () => {
    if (!user?.id) return;
    
    try {
      await Promise.all([loadWishlist(), loadFollowedStores()]);
    } catch (error) {
      console.warn('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Supprimer un favori
  const removeFromWishlist = async (productId: string) => {
    if (!user?.id) return;
    
    try {
      setRemovingItem(productId);
      await wishlistService.remove(String(user.id), productId);
      setWishlistItems(prev => prev.filter(item => item.product_id !== productId));
      Alert.alert('Succès', 'Produit retiré des favoris');
    } catch (error: any) {
      console.warn('Error removing from wishlist:', error);
      Alert.alert('Erreur', 'Impossible de retirer ce produit');
    } finally {
      setRemovingItem(null);
    }
  };

  // Arrêter de suivre une boutique
  const unfollowStore = async (storeId: string) => {
    if (!user?.id) return;
    
    try {
      setUnfollowingStore(storeId);
      await shopFollowService.removeFollow(String(user.id), storeId);
      setFollowedStores(prev => prev.filter(item => item.store_id !== storeId));
      Alert.alert('Succès', 'Vous avez arrêté de suivre cette boutique');
    } catch (error: any) {
      console.warn('Error unfollowing store:', error);
      Alert.alert('Erreur', 'Impossible d\'arrêter de suivre cette boutique');
    } finally {
      setUnfollowingStore(null);
    }
  };

  // Rafraîchir
  const onRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  useEffect(() => {
    loadAllData();
  }, [user?.id]);

  const renderWishlistItem = (item: WishlistItem) => (
    <TouchableOpacity 
      key={item.id} 
      style={styles.wishlistCard}
      onPress={() => navigation.navigate('ProductDetail', { productId: item.product_id })}
    >
      <Image 
        source={{ 
          uri: item.product?.image_url || 'https://picsum.photos/400?random=' + item.product_id 
        }} 
        style={styles.productImage} 
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.product?.name || 'Produit'}
        </Text>
        <Text style={styles.productStore}>
          {item.product?.store?.name || 'Boutique'}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>
            {item.product?.price ? item.product.price.toLocaleString() : '0'} FCA
          </Text>
          {item.product?.compare_price && (
            <Text style={styles.comparePrice}>
              {item.product.compare_price.toLocaleString()} FCA
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => removeFromWishlist(item.product_id)}
        disabled={removingItem === item.product_id}
      >
        {removingItem === item.product_id ? (
          <ActivityIndicator size="small" color={COLORS.danger} />
        ) : (
          <Ionicons name="heart" size={20} color={COLORS.danger} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderFollowedStore = (follow: FollowedStore) => (
    <TouchableOpacity
      key={follow.id}
      style={styles.storeCard}
      onPress={() => navigation.navigate('StoreDetail', { storeId: follow.store_id })}
    >
      <Image
        source={{ uri: follow.store?.logo_url || 'https://picsum.photos/150?random=' + follow.store_id }}
        style={styles.storeLogo}
      />
      <View style={styles.storeInfo}>
        <Text style={styles.storeName} numberOfLines={2}>
          {follow.store?.name || 'Boutique'}
        </Text>
        <Text style={styles.storeCategory}>
          {follow.store?.category || ''}
        </Text>
        <View style={styles.storeStats}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
          <Text style={styles.statText}>Suivi depuis {new Date(follow.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.unfollowButton}
        onPress={() => unfollowStore(follow.store_id)}
        disabled={unfollowingStore === follow.store_id}
      >
        {unfollowingStore === follow.store_id ? (
          <ActivityIndicator size="small" color={COLORS.danger} />
        ) : (
          <Ionicons name="close" size={20} color={COLORS.danger} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes favoris</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Ionicons name="heart" size={18} color={activeTab === 'products' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            Produits ({wishlistItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'shops' && styles.activeTab]}
          onPress={() => setActiveTab('shops')}
        >
          <Ionicons name="storefront" size={18} color={activeTab === 'shops' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'shops' && styles.activeTabText]}>
            Boutiques ({followedStores.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.accent} size="large" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : activeTab === 'products' ? (
          wishlistItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucun produit favori</Text>
              <Text style={styles.emptyText}>Vos produits préférés apparaîtront ici</Text>
              <TouchableOpacity 
                style={styles.exploreButton}
                onPress={() => navigation.navigate('ClientHome')}
              >
                <Text style={styles.exploreButtonText}>Explorer les produits</Text>
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
              <Ionicons name="storefront-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucune boutique suivie</Text>
              <Text style={styles.emptyText}>Les boutiques que vous suivez apparaîtront ici</Text>
              <TouchableOpacity 
                style={styles.exploreButton}
                onPress={() => navigation.navigate('ClientAllStores')}
              >
                <Text style={styles.exploreButtonText}>Découvrir les boutiques</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.storesContainer}>
              {followedStores.map(renderFollowedStore)}
            </View>
          )
        )}
      </ScrollView>
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
  headerPlaceholder: {
    width: 40,
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  // Content
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  exploreButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  exploreButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  // Products section
  wishlistContainer: {
    paddingHorizontal: SPACING.xl,
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
  },
  productImage: {
    width: 80,
    height: 80,
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
  },
  productStore: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  productPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
  comparePrice: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
    textDecorationLine: 'line-through',
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
  },
  storeCategory: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  storeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  statText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
  },
  unfollowButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
});


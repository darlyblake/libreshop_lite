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
import { Product } from '../lib/supabase';

interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  product?: Product;
  created_at: string;
}

const { width } = Dimensions.get('window');

export const WishlistScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingItem, setRemovingItem] = useState<string | null>(null);

  // Charger les favoris depuis Supabase
  const loadWishlist = async () => {
    if (!user?.id) return;
    
    try {
      const items = await wishlistService.getByUser(String(user.id));
      setWishlistItems(items);
    } catch (error: any) {
      console.warn('Error loading wishlist:', error);
      
      // Si la table n'existe pas, afficher un état vide avec message approprié
      if (error?.code === 'PGRST116' || error?.message?.includes('Could not find the table')) {
        console.log('Wishlist table not found, showing empty state');
        setWishlistItems([]);
      } else {
        // Pour autres erreurs, afficher l'alerte
        Alert.alert('Erreur', 'Impossible de charger vos favoris');
      }
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
      
      // Mettre à jour localement
      setWishlistItems(prev => prev.filter(item => item.product_id !== productId));
      
      Alert.alert('Succès', 'Produit retiré des favoris');
    } catch (error: any) {
      console.warn('Error removing from wishlist:', error);
      
      // Si la table n'existe pas, afficher un message informatif
      if (error?.code === 'PGRST116' || error?.message?.includes('Could not find the table')) {
        Alert.alert('Info', 'La fonctionnalité favoris sera bientôt disponible');
      } else {
        Alert.alert('Erreur', 'Impossible de retirer ce produit des favoris');
      }
    } finally {
      setRemovingItem(null);
    }
  };

  // Rafraîchir
  const onRefresh = () => {
    setRefreshing(true);
    loadWishlist();
  };

  useEffect(() => {
    loadWishlist();
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes favoris</Text>
        <Text style={styles.itemCount}>{wishlistItems.length}</Text>
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
            <Text style={styles.loadingText}>Chargement de vos favoris...</Text>
          </View>
        ) : wishlistItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Aucun favori</Text>
            <Text style={styles.emptyText}>Vos produits favoris apparaîtront ici</Text>
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
  itemCount: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    fontWeight: '500',
  },
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
    color: COLORS.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  productPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.accent2,
  },
  comparePrice: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  removeButton: {
    padding: SPACING.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  exploreButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
  },
  exploreButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
});


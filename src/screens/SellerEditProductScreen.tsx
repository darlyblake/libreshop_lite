import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AddProductModal } from '../components/AddProductModal';
import { productService } from '../services/productService';
import { collectionService } from '../services/collectionService';
import { cloudinaryService } from '../services/cloudinaryService';
import { storeService } from '../services/storeService';
import { useAuthStore } from '../store';
import { COLORS } from '../config/theme';

type RouteParams = {
  SellerEditProduct: { productId: string };
};

export const SellerEditProductScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'SellerEditProduct'>>();
  const { productId } = route.params;
  const { user } = useAuthStore();

  const [isFetching, setIsFetching] = useState(true);
  const [collections, setCollections] = useState<any[]>([]);
  const [initialProduct, setInitialProduct] = useState<any>(null);
  const [featuredCount, setFeaturedCount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [product, store] = await Promise.all([
        productService.getById(productId),
        storeService.getByUser(user?.id || ''),
      ]);

      if (!product) {
        throw new Error('Produit introuvable');
      }

      const cols = store?.id ? await collectionService.getByStore(store.id) : [];
      setCollections(cols);

      if (store?.id) {
        if (!storeService.isSubscriptionActive(store)) {
          Alert.alert(
            'Abonnement expiré',
            `Votre abonnement pour "${store.name}" a expiré. Veuillez le renouveler pour modifier des produits.`,
            [
              {
                text: 'Renouveler',
                onPress: () => navigation.replace('SubscriptionExpired'),
              },
            ]
          );
          return;
        }

        const count = await productService.getFeaturedCount(store.id);
        setFeaturedCount(count);
      }

      // Mapper le produit Supabase vers le format Product du modal
      setInitialProduct({
        name: product.name,
        price: product.price?.toString() || '',
        costPrice: product.cost_price?.toString() || '',
        comparePrice: product.compare_price?.toString() || '',
        stock: product.stock?.toString() || '0',
        barcode: product.reference || '',
        description: product.description || '',
        images: product.images || [],
        collectionId: product.collection_id || (cols[0]?.id || ''),
        featured: product.featured || false,
        condition: product.condition || 'new',
        attributes: product.attributes || {},
      });
    } catch (error) {
      console.error('[SellerEditProduct] Erreur chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger le produit');
      navigation.goBack();
    } finally {
      setIsFetching(false);
    }
  }, [productId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdate = async (updatedProduct: any) => {
    setIsSaving(true);
    try {
      const uploadedImages = [];
      for (let img of (updatedProduct.images || [])) {
        if (typeof img === 'string' && img.startsWith('blob:')) {
          // Skip dead blob URLs saved by mistake previously
          continue;
        }
        if (typeof img === 'string' && (img.startsWith('data:') || img.startsWith('file://') || img.startsWith('exp://'))) {
          try {
            const url = await cloudinaryService.uploadImage(img, { folder: 'libreshop/products' });
            uploadedImages.push(url);
          } catch (e) {
            console.warn('[SellerEditProduct] Upload image échoué:', e);
          }
        } else {
          uploadedImages.push(img);
        }
      }

      const parseSafeFloat = (val: string) => {
        const p = parseFloat(val);
        return isNaN(p) ? null : p;
      };
      const parseSafeInt = (val: string, fallback = 0) => {
        const p = parseInt(val);
        return isNaN(p) ? fallback : p;
      };

      const price = parseSafeFloat(updatedProduct.price) || 0;
      const comparePrice = parseSafeFloat(updatedProduct.comparePrice);

      const updatePayload: any = {
        name: updatedProduct.name,
        description: updatedProduct.description,
        price: price,
        cost_price: parseSafeFloat(updatedProduct.costPrice),
        stock: parseSafeInt(updatedProduct.stock),
        reference: updatedProduct.barcode || '',
        images: uploadedImages,
        collection_id: updatedProduct.collectionId || null,
        is_active: true,
        attributes: updatedProduct.attributes || {},
        featured: updatedProduct.featured || false,
        condition: updatedProduct.condition || 'new',
      };

      // Only include compare_price if it's valid (greater than price)
      if (comparePrice && comparePrice > price) {
        updatePayload.compare_price = comparePrice;
      }

      await productService.update(productId, updatePayload);

      if (Platform.OS === 'web') {
        window.alert('✅ Succès : Produit mis à jour avec succès !');
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('SellerProducts');
        }
      } else {
        Alert.alert('✅ Succès', 'Produit mis à jour avec succès !', [
          { 
            text: 'OK', 
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('SellerProducts');
              }
            } 
          }
        ]);
      }
    } catch (error: any) {
      console.error('[SellerEditProduct] Erreur mise à jour:', error);
      if (Platform.OS === 'web') {
        window.alert('Erreur : Impossible de mettre à jour le produit. Réessayez.');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour le produit. Réessayez.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isFetching || !initialProduct) {
    return (
      <View style={styles.container}>
        <LoadingSpinner message="Chargement du produit..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AddProductModal
        visible={true}
        onClose={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('SellerProducts');
          }
        }}
        onAdd={() => {}}
        onUpdate={handleUpdate}
        collections={collections}
        title="Modifier le produit"
        initialProduct={initialProduct}
        editProductId={productId}
        featuredCount={featuredCount}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});

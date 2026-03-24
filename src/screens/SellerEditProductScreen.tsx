import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { productService } from '../lib/supabase';
import { cloudinaryService } from '../lib/cloudinaryService';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { Product } from '../lib/supabase';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

interface FormData {
  name: string;
  description: string;
  price: string;
  comparePrice: string;
  stock: string;
  reference: string;
  category: string;
  isActive: boolean;
  isOnlineSale: boolean;
  isPhysicalSale: boolean;
  images: string[];
}

type RouteParams = {
  SellerEditProduct: { productId: string };
};

export const SellerEditProductScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'SellerEditProduct'>>();
  const { productId } = route.params;
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    price: '',
    comparePrice: '',
    stock: '',
    reference: '',
    category: '',
    isActive: true,
    isOnlineSale: true,
    isPhysicalSale: true,
    images: [],
  });

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const product = await productService.getById(productId);
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        comparePrice: product.compare_price?.toString() || '',
        stock: product.stock.toString(),
        reference: product.reference || '',
        category: product.category || '',
        isActive: product.is_active,
        isOnlineSale: product.is_online_sale,
        isPhysicalSale: product.is_physical_sale,
        images: product.images || [],
      });
      setImages(product.images || []);
    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'ProductLoad');
      Alert.alert('Erreur', 'Impossible de charger le produit');
    } finally {
      setIsFetching(false);
    }
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Nous avons besoin de l'accès aux images.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        const updatedImages = [...images, ...newImages].slice(0, 5); // Max 5 images
        setImages(updatedImages);
        updateField('images', updatedImages);
      }
    } catch (error) {
      errorHandler.handle(error as Error, 'ImagePicker', ErrorCategory.USER_INPUT, ErrorSeverity.MEDIUM);
      Alert.alert('Erreur', 'Impossible de sélectionner les images');
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    updateField('images', updatedImages);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Nous avons besoin d'accès à la caméra.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const updatedImages = [...images, result.assets[0].uri].slice(0, 5);
        setImages(updatedImages);
        updateField('images', updatedImages);
      }
    } catch (error) {
      errorHandler.handle(error as Error, 'CameraCapture', ErrorCategory.USER_INPUT, ErrorSeverity.MEDIUM);
      Alert.alert('Erreur', 'Impossible de prendre la photo');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Erreur', 'Le nom du produit est requis');
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      Alert.alert('Erreur', 'Le prix est requis');
      return;
    }

    setIsLoading(true);
    try {
      // Upload new images if any
      const uploadedImages = [...images];
      const existingImages = (await productService.getById(productId)).images || [];
      
      // Find which images are new (URIs starting with file:// or exp://)
      const newImages = images.filter(img => 
        img.startsWith('file://') || img.startsWith('exp://') || img.startsWith('data:')
      );
      
      // Upload new images
      for (const newImage of newImages) {
        try {
          const uploadedUrl = await cloudinaryService.uploadImage(newImage, { 
            folder: 'libreshop/products' 
          });
          const index = uploadedImages.indexOf(newImage);
          if (index > -1) {
            uploadedImages[index] = uploadedUrl;
          }
        } catch (error) {
          errorHandler.handleNetworkError(error as Error, 'ImageUpload');
        }
      }

      await productService.update(productId, {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        compare_price: formData.comparePrice ? parseFloat(formData.comparePrice) : undefined,
        stock: formData.stock ? parseInt(formData.stock) : 0,
        reference: formData.reference,
        category: formData.category,
        is_active: formData.isActive,
        is_online_sale: formData.isOnlineSale,
        is_physical_sale: formData.isPhysicalSale,
        images: uploadedImages,
      });
      Alert.alert('Succès', 'Produit mis à jour avec succès', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'ProductUpdate');
      Alert.alert('Erreur', 'Impossible de mettre à jour le produit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le produit',
      'Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.delete(productId);
              Alert.alert('Succès', 'Produit supprimé', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le produit');
            }
          },
        },
      ]
    );
  };

  if (isFetching) {
    return <LoadingSpinner message="Chargement..." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Modifier le produit</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations générales</Text>
        <Input
          label="Nom du produit"
          value={formData.name}
          onChangeText={(value) => updateField('name', value)}
          placeholder="Ex: Tee-shirt cotton"
        />
        <Input
          label="Description"
          value={formData.description}
          onChangeText={(value) => updateField('description', value)}
          placeholder="Description du produit..."
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Images</Text>
        <View style={styles.imageGrid}>
          {images.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.productImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={24} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 5 && (
            <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
              <Ionicons name="add" size={32} color={COLORS.textMuted} />
              <Text style={styles.addImageText}>Ajouter</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.imageActions}>
          <TouchableOpacity style={styles.imageActionButton} onPress={pickImages}>
            <Ionicons name="images-outline" size={20} color={COLORS.accent} />
            <Text style={styles.imageActionText}>Galerie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imageActionButton} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={20} color={COLORS.accent} />
            <Text style={styles.imageActionText}>Appareil photo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prix et stock</Text>
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Input
              label="Prix (FCFA)"
              value={formData.price}
              onChangeText={(value) => updateField('price', value)}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfInput}>
            <Input
              label="Prix comparatif"
              value={formData.comparePrice}
              onChangeText={(value) => updateField('comparePrice', value)}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Input
              label="Stock"
              value={formData.stock}
              onChangeText={(value) => updateField('stock', value)}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfInput}>
            <Input
              label="Référence"
              value={formData.reference}
              onChangeText={(value) => updateField('reference', value)}
              placeholder="SKU-001"
            />
          </View>
        </View>
        <Input
          label="Catégorie"
          value={formData.category}
          onChangeText={(value) => updateField('category', value)}
          placeholder="Ex: Vêtements"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disponibilité</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Produit actif</Text>
          </View>
          <Switch
            value={formData.isActive}
            onValueChange={(value) => updateField('isActive', value)}
            trackColor={{ false: COLORS.border, true: COLORS.accent }}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Vente en ligne</Text>
          </View>
          <Switch
            value={formData.isOnlineSale}
            onValueChange={(value) => updateField('isOnlineSale', value)}
            trackColor={{ false: COLORS.border, true: COLORS.accent }}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Vente physique</Text>
          </View>
          <Switch
            value={formData.isPhysicalSale}
            onValueChange={(value) => updateField('isPhysicalSale', value)}
            trackColor={{ false: COLORS.border, true: COLORS.accent }}
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Annuler"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={styles.button}
        />
        <Button
          title={isLoading ? 'Enregistrement...' : 'Enregistrer'}
          onPress={handleSubmit}
          disabled={isLoading}
          style={styles.button}
        />
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        <Text style={styles.deleteText}>Supprimer le produit</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  halfInput: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  button: {
    flex: 1,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xxl,
    padding: SPACING.lg,
  },
  deleteText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.danger,
    fontWeight: '600',
  },
  // Image styles
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  imageContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 2,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  imageActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imageActionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '500',
  },
});


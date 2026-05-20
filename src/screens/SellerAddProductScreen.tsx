import React, { useEffect, useState } from 'react';
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
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { type Category, type Collection } from '../lib/supabase';
import { collectionService } from '../services/collectionService';
import { categoryService } from '../services/categoryService';
import { productService } from '../services/productService';
import { storeService } from '../services/storeService';
import { cloudinaryService } from '../services/cloudinaryService';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useAuthStore } from '../store';

interface FormData {
  name: string;
  description: string;
  price: string;
  comparePrice: string;
  stock: string;
  lowStockThreshold: string;
  reference: string;
  category: string;
  subcategory: string;
  isActive: boolean;
  isOnlineSale: boolean;
  isPhysicalSale: boolean;
}

export const SellerAddProductScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!showCameraScanner) return;
    updateField('reference', data);
    setShowCameraScanner(false);
  };
  const [images, setImages] = useState<string[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    price: '',
    comparePrice: '',
    stock: '',
    lowStockThreshold: '5',
    reference: '',
    category: '',
    subcategory: '',
    isActive: true,
    isOnlineSale: true,
    isPhysicalSale: true,
  });

  const updateField = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim() || !storeId) return;
    try {
      setIsLoading(true);
      const newCol = await collectionService.create({ store_id: storeId, name: newCollectionName.trim(), is_active: true } as any);
      setCollections(prev => [...prev, newCol as Collection]);
      setCollectionId(newCol.id);
      setShowNewCollection(false);
      setNewCollectionName('');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de créer la collection');
    } finally {
      setIsLoading(false);
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages(prev => {
      const newImages = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newImages.length) return newImages;
      const temp = newImages[index];
      newImages[index] = newImages[targetIndex];
      newImages[targetIndex] = temp;
      return newImages;
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const loadStoreAndCollections = async () => {
      if (!user?.id) return;
      try {
        const store = await storeService.getByUser(user.id);
        if (!store?.id) {
          setStoreId(null);
          setCollections([]);
          setCollectionId('');
          return;
        }
        setStoreId(store.id);
        const cols = await collectionService.getByStore(store.id);
        setCollections(cols);
        const firstActive = (cols || []).find((c) => c.is_active);
        if (firstActive && !collectionId) {
          setCollectionId(firstActive.id);
        }
      } catch (e) {
        errorHandler.handleDatabaseError(e, 'loadStoreAndCollections');
      }
    };

    const loadCategories = async () => {
      try {
        const cats = await categoryService.getByParent(null);
        setCategories(cats || []);
      } catch (e) {
        errorHandler.handleDatabaseError(e, 'loadTopCategories');
      }
    };

    loadStoreAndCollections();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const pickCollection = () => {
    const options = (collections || []).filter((c) => c.is_active);
    if (options.length === 0) {
      Alert.alert('Collections requises', 'Créez au moins une collection avant d’ajouter un produit.', [
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(
      'Choisir une collection',
      undefined,
      [
        ...options.slice(0, 8).map((c) => ({
          text: c.name,
          onPress: () => setCollectionId(c.id),
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const pickCategory = () => {
    if (categories.length === 0) {
      Alert.alert('Catégories non disponibles', 'Chargement des catégories en cours. Réessayez dans un instant.');
      return;
    }
    Alert.alert(
      'Choisir une catégorie',
      undefined,
      [
        ...categories.slice(0, 8).map((cat) => ({
          text: cat.name,
          onPress: () => {
            setSelectedCategoryId(cat.id);
            setSelectedSubcategoryId('');
            updateField('category', cat.name);
            updateField('subcategory', '');
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const pickSubcategory = () => {
    if (!selectedCategoryId) {
      Alert.alert('Sélectionnez une catégorie d’abord', 'Choisissez d’abord une catégorie mère pour voir les sous-catégories.');
      return;
    }
    if (subcategories.length === 0) {
      Alert.alert('Aucune sous-catégorie', 'Cette catégorie ne contient pas de sous-catégories.');
      return;
    }
    Alert.alert(
      'Choisir une sous-catégorie',
      undefined,
      [
        ...subcategories.slice(0, 8).map((sub) => ({
          text: sub.name,
          onPress: () => {
            setSelectedSubcategoryId(sub.id);
            updateField('subcategory', sub.name);
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  useEffect(() => {
    const loadSubcategories = async () => {
      if (!selectedCategoryId) {
        setSubcategories([]);
        setSelectedSubcategoryId('');
        updateField('subcategory', '');
        return;
      }
      try {
        const subs = await categoryService.getByParent(selectedCategoryId);
        setSubcategories(subs || []);
      } catch (e) {
        errorHandler.handleDatabaseError(e, 'loadSubcategories');
        setSubcategories([]);
      }
    };
    loadSubcategories();
  }, [selectedCategoryId]);

  useEffect(() => {
    const syncCollectionCategory = async () => {
      if (!collectionId) return;
      const selectedCol = collections.find((c) => c.id === collectionId);
      if (!selectedCol?.category_id) return;

      try {
        const category = await categoryService.getById(selectedCol.category_id);
        if (category.parent_id) {
          const parent = await categoryService.getById(category.parent_id);
          setSelectedCategoryId(parent.id);
          updateField('category', parent.name);
          setSelectedSubcategoryId(category.id);
          updateField('subcategory', category.name);
        } else {
          setSelectedCategoryId(category.id);
          updateField('category', category.name);
          setSelectedSubcategoryId('');
          updateField('subcategory', '');
        }
      } catch (e) {
        console.warn('Failed to sync category from collection', e);
      }
    };
    syncCollectionCategory();
  }, [collectionId, collections]);

  const pickImages = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission requise', "Autorisez l'accès aux images pour ajouter des photos");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled) return;
      const uri = result.assets && result.assets[0] ? result.assets[0].uri : undefined;
      if (!uri) return;
      setImages((prev) => [...prev, uri].slice(0, 5));
    } catch (e) {
      errorHandler.handle(e, 'pickImages error', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      Alert.alert('Erreur', "Impossible d'ajouter l'image");
    }
  };

  const handleSubmit = async () => {
    if (!storeId) {
      Alert.alert('Erreur', 'Aucune boutique trouvée pour ce compte');
      return;
    }

    if (!collectionId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une collection');
      return;
    }

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
      const uploadedUrls: string[] = [];
      for (const uri of images) {
        const url = await cloudinaryService.uploadImage(uri, { folder: 'libreshop/products' });
        uploadedUrls.push(url);
      }

      await productService.create({
        store_id: storeId,
        collection_id: collectionId,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        compare_price: formData.comparePrice ? parseFloat(formData.comparePrice) : undefined,
        stock: formData.stock ? parseInt(formData.stock) : 0,
        low_stock_threshold: formData.lowStockThreshold ? parseInt(formData.lowStockThreshold) : 5,
        reference: formData.reference,
        category: formData.category,
        subcategory: formData.subcategory,
        is_active: formData.isActive,
        is_online_sale: formData.isOnlineSale,
        is_physical_sale: formData.isPhysicalSale,
        images: uploadedUrls,
      });
      Alert.alert('Succès', 'Produit ajouté avec succès', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error creating product:');
      Alert.alert('Erreur', 'Impossible de créer le produit');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ajouter un produit</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations générales</Text>

        {showNewCollection ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Input 
                label="Nouvelle collection"
                placeholder="Ex: Nouveautés" 
                value={newCollectionName} 
                onChangeText={setNewCollectionName} 
              />
            </View>
            <Button title="Créer" onPress={handleCreateCollection} style={{ marginBottom: 16 }} />
            <TouchableOpacity onPress={() => setShowNewCollection(false)} style={{ marginBottom: 24, marginHorizontal: 8 }}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
            <TouchableOpacity onPress={pickCollection} style={[styles.collectionSelect, { flex: 1, marginBottom: 0 }]} activeOpacity={0.8}>
              <Text style={styles.collectionSelectLabel}>Collection *</Text>
              <Text style={styles.collectionSelectValue}>
                {collections?.find((c) => c.id === collectionId)?.name || 'Sélectionner une collection'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowNewCollection(true)} style={{ marginLeft: 8, padding: 12, backgroundColor: COLORS.accent + '15', borderRadius: RADIUS.md }}>
              <Ionicons name="add" size={24} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
        )}

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
        <TouchableOpacity onPress={pickCategory} style={[styles.collectionSelect, { marginBottom: SPACING.md }]} activeOpacity={0.8}>
          <Text style={styles.collectionSelectLabel}>Catégorie *</Text>
          <Text style={styles.collectionSelectValue}>{formData.category || 'Choisir une catégorie'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={pickSubcategory} style={[styles.collectionSelect, { marginBottom: SPACING.md }]} activeOpacity={0.8}>
          <Text style={styles.collectionSelectLabel}>Sous-catégorie</Text>
          <Text style={styles.collectionSelectValue}>{formData.subcategory || 'Choisir une sous-catégorie'}</Text>
        </TouchableOpacity>
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
              label="Seuil d'alerte stock"
              value={formData.lowStockThreshold}
              onChangeText={(value) => updateField('lowStockThreshold', value)}
              placeholder="5"
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Référence"
              value={formData.reference}
              onChangeText={(value) => updateField('reference', value)}
              placeholder="SKU-001"
            />
          </View>
          <TouchableOpacity 
            style={{ 
              marginBottom: 16, 
              padding: 12, 
              backgroundColor: COLORS.accent + '15', 
              borderRadius: RADIUS.md,
              height: 48,
              justifyContent: 'center',
              alignItems: 'center'
            }}
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
            <Ionicons name="barcode-outline" size={24} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
        <Input
          label="Catégorie (optionnel)"
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
            <Text style={styles.switchDescription}>
              Le produit sera visible en ligne
            </Text>
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
            <Text style={styles.switchDescription}>
              Disponible à l'achat sur la plateforme
            </Text>
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
            <Text style={styles.switchDescription}>
              Disponible à l'achat en magasin
            </Text>
          </View>
          <Switch
            value={formData.isPhysicalSale}
            onValueChange={(value) => updateField('isPhysicalSale', value)}
            trackColor={{ false: COLORS.border, true: COLORS.accent }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Images</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImages}>
          <Ionicons name="camera-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.imagePickerText}>Ajouter des images</Text>
        </TouchableOpacity>
        {!!images.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 4 }}>
              {images.map((uri, idx) => (
                <View key={String(idx)} style={{ position: 'relative', paddingBottom: 12 }}>
                  <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }} />
                  <View style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    alignSelf: 'center', 
                    flexDirection: 'row', 
                    backgroundColor: COLORS.card, 
                    borderRadius: 12, 
                    elevation: 4, 
                    paddingHorizontal: 6, 
                    paddingVertical: 4,
                    ...Platform.select({
                      web: { boxShadow: '0 2px 4px rgba(0,0,0,0.25)' },
                      default: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                      }
                    })
                  }}>
                    <TouchableOpacity onPress={() => moveImage(idx, -1)} disabled={idx === 0}>
                      <Ionicons name="chevron-back" size={18} color={idx === 0 ? COLORS.textMuted : COLORS.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeImage(idx)} style={{ marginHorizontal: 8 }}>
                      <Ionicons name="trash" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveImage(idx, 1)} disabled={idx === images.length - 1}>
                      <Ionicons name="chevron-forward" size={18} color={idx === images.length - 1 ? COLORS.textMuted : COLORS.accent} />
                    </TouchableOpacity>
                  </View>
                  {idx === 0 && (
                    <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: COLORS.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                       <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>Principal</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Annuler"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={styles.button}
        />
        <Button
          title={isLoading ? 'Enregistrement...' : 'Ajouter le produit'}
          onPress={handleSubmit}
          disabled={isLoading}
          style={styles.button}
        />
      </View>
    </ScrollView>

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
  </>
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
  collectionSelect: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  collectionSelectLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSoft,
    marginBottom: 4,
  },
  collectionSelectValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
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
  switchDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  imagePicker: {
    height: 150,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  imagePickerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  button: {
    flex: 1,
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


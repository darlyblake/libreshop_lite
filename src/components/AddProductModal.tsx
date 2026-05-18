import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
  TextInput,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../hooks/useTheme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { cloudinaryService } from '../services/cloudinaryService';
import { imageProcessorService } from '../services/imageProcessorService';
import { categoryService } from '../services/categoryService';

interface CollectionOption {
  id: string;
  name: string;
  category_id?: string | null;
}

interface Product {
  name: string;
  price: string;
  costPrice: string;
  comparePrice: string;
  stock: string;
  barcode?: string; // code barre facultatif
  description: string;
  images: string[];
  collectionId: string;
  featured?: boolean;
  attributes?: Record<string, any>;
}

interface AddProductModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (product: Product) => void;
  collections: CollectionOption[];
  
  title?: string;
}

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: COLORS.bg + 'E6',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: COLORS.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      height: '90%',
      paddingBottom: SPACING.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    modalTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: COLORS.text,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.bg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    modalBody: {
      flex: 1,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    modalInput: {
      marginBottom: SPACING.lg,
    },
    inputLabel: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: SPACING.sm,
    },
    required: {
      color: COLORS.danger,
    },
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      fontSize: FONT_SIZE.md,
      color: COLORS.text,
      backgroundColor: COLORS.bg,
      pointerEvents: 'auto' as const,
    },
    inputError: {
      borderColor: COLORS.danger,
      backgroundColor: COLORS.danger + '08',
    },
    errorText: {
      color: COLORS.danger,
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      marginTop: SPACING.xs,
      marginLeft: SPACING.xs,
    },
    selectInput: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.bg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
      pointerEvents: 'auto' as const,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'flex-end',
    },
    pickerContent: {
      backgroundColor: COLORS.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      maxHeight: '75%',
      paddingBottom: SPACING.lg,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    pickerTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: COLORS.text,
    },
    pickerSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.bg,
    },
    pickerSearchInput: {
      flex: 1,
      fontSize: FONT_SIZE.md,
      color: COLORS.text,
      paddingVertical: 0,
    },
    pickerList: {
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    pickerEmpty: {
      paddingVertical: SPACING.xl,
      alignItems: 'center',
    },
    pickerEmptyText: {
      color: COLORS.textMuted,
      fontSize: FONT_SIZE.md,
      fontWeight: '500',
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      marginBottom: SPACING.sm,
    },
    pickerItemSelected: {
      borderColor: COLORS.accent,
      backgroundColor: COLORS.accent + '10',
    },
    pickerItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      flex: 1,
      marginRight: SPACING.md,
    },
    pickerItemText: {
      color: COLORS.text,
      fontSize: FONT_SIZE.md,
      fontWeight: '600',
      flex: 1,
    },
    radioOuter: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.card,
    },
    radioOuterSelected: {
      borderColor: COLORS.accent,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: COLORS.accent,
    },
    pickerActions: {
      flexDirection: 'row',
      gap: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    pickerButton: {
      flex: 1,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerCancelButton: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    pickerConfirmButton: {
      backgroundColor: COLORS.accent,
    },
    pickerCancelText: {
      color: COLORS.text,
      fontWeight: '600',
      fontSize: FONT_SIZE.md,
    },
    pickerConfirmText: {
      color: COLORS.text,
      fontWeight: '600',
      fontSize: FONT_SIZE.md,
    },
    imagesContainer: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg, // Added vertical padding
      gap: SPACING.md,
    },
    imageItem: {
      position: 'relative',
      marginRight: SPACING.md,
    },
    imagePreview: {
      width: 100,
      height: 100,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    imageLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeImageButton: {
      position: 'absolute',
      top: -8,
      right: -8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: COLORS.danger,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 30,
      elevation: 5,
    },
    addImageButton: {
      width: 100,
      height: 100,
      borderRadius: RADIUS.md,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.bg,
    },
    addImageText: {
      fontSize: FONT_SIZE.xs,
      color: COLORS.textMuted,
      marginTop: SPACING.xs,
    },
    stockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
    },
    stockButton: {
      padding: SPACING.xs,
    },
    stockValue: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: COLORS.text,
      minWidth: 40,
      textAlign: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      gap: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    modalButton: {
      flex: 1,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'auto' as const,
    },
    cancelButton: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    confirmButton: {
      backgroundColor: COLORS.accent,
    },
    cancelButtonText: {
      color: COLORS.text,
      fontWeight: '600',
      fontSize: FONT_SIZE.md,
    },
    confirmButtonText: {
      color: COLORS.text,
      fontWeight: '600',
      fontSize: FONT_SIZE.md,
    },
    // Dynamic Attributes Styling
    dynamicAttrsSection: {
      backgroundColor: COLORS.bg,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    dynamicAttrsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginBottom: SPACING.xs,
    },
    dynamicAttrsTitle: {
      fontSize: FONT_SIZE.md,
      fontWeight: '700',
      color: COLORS.text,
    },
    dynamicAttrsSubtitle: {
      fontSize: FONT_SIZE.xs,
      color: COLORS.textMuted,
      marginBottom: SPACING.md,
    },
    attrChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs + 2,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      marginTop: SPACING.xs,
    },
    attrChipActive: {
      borderColor: COLORS.accent,
      backgroundColor: COLORS.accent + '15',
    },
    attrChipText: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.textMuted,
      fontWeight: '600',
    },
    attrChipTextActive: {
      color: COLORS.accent,
    },
    // Web-specific fixes for modal interaction
    webInteractiveElement: Platform.OS === 'web' ? {
      pointerEvents: 'auto' as const,
    } : {},
    imagesErrorContainer: {
      borderWidth: 2,
      borderColor: COLORS.danger,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
    },
    toggleButton: {
      width: 50,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleButtonActive: {
      backgroundColor: COLORS.accent,
      borderColor: COLORS.accent,
    },
    toggleText: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: COLORS.textMuted,
    },
    toggleTextActive: {
      color: COLORS.card,
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
};

export const AddProductModal: React.FC<AddProductModalProps> = ({
  visible,
  onClose,
  onAdd,
  collections,
  title = 'Ajouter un produit',
}) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  const initialCollectionId = collections && collections.length > 0 ? collections[0]!.id : '';
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [pendingCollectionId, setPendingCollectionId] = useState(initialCollectionId);
  const [newProduct, setNewProduct] = useState<Product>({
    name: '',
    price: '',
    costPrice: '',
    comparePrice: '',
    stock: '',
    barcode: undefined,
    description: '',
    images: [],
    collectionId: initialCollectionId,
    featured: false,
  });
  const [enhancingImages, setEnhancingImages] = useState<{ [key: number]: boolean }>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [categorySchema, setCategorySchema] = useState<any[]>([]);
  const [productAttributes, setProductAttributes] = useState<Record<string, any>>({});

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!showCameraScanner) return;
    setNewProduct(prev => ({ ...prev, barcode: data }));
    setShowCameraScanner(false);
  };

  React.useEffect(() => {
    if (!visible) return;
    if (newProduct.collectionId) return;
    if (!collections || collections.length === 0) return;
    setNewProduct((prev) => ({ ...prev, collectionId: collections[0]!.id }));
  }, [visible, collections, newProduct.collectionId]);

  React.useEffect(() => {
    setPendingCollectionId(newProduct.collectionId || initialCollectionId);
  }, [newProduct.collectionId, initialCollectionId]);

  React.useEffect(() => {
    const fetchSchema = async () => {
      const selectedCol = collections?.find(c => c.id === newProduct.collectionId);
      if (selectedCol?.category_id) {
        try {
          const category = await categoryService.getById(selectedCol.category_id);
          let schema = category.attribute_schema || [];
          if (category.parent_id) {
            try {
              const parentCategory = await categoryService.getById(category.parent_id);
              if (parentCategory.attribute_schema) {
                schema = [...parentCategory.attribute_schema, ...schema];
              }
            } catch (err) {
              console.warn('Failed to load parent category schema:', err);
            }
          }
          setCategorySchema(schema);
          
          // Pre-populate with default values/empty values for the schema fields
          const initialAttrs: Record<string, any> = {};
          schema.forEach((attr: any) => {
            initialAttrs[attr.name] = attr.type === 'multiselect' ? [] : '';
          });
          setProductAttributes(initialAttrs);
        } catch (e) {
          console.warn('Failed to fetch category schema:', e);
          setCategorySchema([]);
          setProductAttributes({});
        }
      } else {
        setCategorySchema([]);
        setProductAttributes({});
      }
    };
    fetchSchema();
  }, [newProduct.collectionId, collections]);

  const openCollectionPicker = () => {
    if (!collections || collections.length === 0) {
      Alert.alert('Info', 'Aucune collection disponible');
      return;
    }
    setCollectionSearch('');
    setPendingCollectionId(newProduct.collectionId || initialCollectionId || collections[0]!.id);
    setShowCollectionPicker(true);
  };

  const filteredCollectionOptions = (collections || []).filter((c) =>
    String(c.name || '').toLowerCase().includes(collectionSearch.toLowerCase())
  );

  const handleAddProduct = () => {
    const errors: Record<string, string> = {};

    // Validation champs obligatoires
    if (!newProduct.name || !newProduct.name.trim()) {
      errors.name = 'Nom requis';
    } else if (newProduct.name.trim().length < 3) {
      errors.name = 'Min 3 caractères';
    }

    if (!newProduct.price || !newProduct.price.trim()) {
      errors.price = 'Prix requis';
    } else if (isNaN(Number(newProduct.price)) || Number(newProduct.price) <= 0) {
      errors.price = 'Prix invalide (> 0)';
    }

    if (!newProduct.stock || !newProduct.stock.trim()) {
      errors.stock = 'Stock requis';
    } else if (isNaN(Number(newProduct.stock)) || Number(newProduct.stock) < 0) {
      errors.stock = 'Stock invalide (≥ 0)';
    }

    if (newProduct.costPrice && newProduct.costPrice.trim()) {
      if (isNaN(Number(newProduct.costPrice)) || Number(newProduct.costPrice) < 0) {
        errors.costPrice = 'Prix invalide (≥ 0)';
      }
    }

    if (!newProduct.collectionId) {
      errors.collection = 'Collection requise';
    }

    if (!newProduct.description || !newProduct.description.trim()) {
      errors.description = 'Description requise';
    } else if (newProduct.description.trim().length < 3) {
      errors.description = 'Min 3 caractères';
    }

    if (!newProduct.images || newProduct.images.length === 0) {
      errors.images = 'Au moins 1 image requise';
    }

    // Validate dynamic attributes
    categorySchema.forEach((attr) => {
      const val = productAttributes[attr.name];
      if (attr.required) {
        if (attr.type === 'multiselect') {
          if (!Array.isArray(val) || val.length === 0) {
            errors[`attr_${attr.name}`] = `${attr.label} requis`;
          }
        } else {
          if (val === undefined || val === null || String(val).trim() === '') {
            errors[`attr_${attr.name}`] = `${attr.label} requis`;
          }
        }
      }
    });

    // S'il y a des erreurs, les afficher et arrêter
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      console.warn('[AddProductModal] Validation errors:', errors);
      return;
    }

    // Réinitialiser les erreurs si tout est valide
    setFieldErrors({});

    // Validation prix comparé (optionnel mais si rempli, doit être valide)
    if (newProduct.comparePrice && newProduct.comparePrice.trim()) {
      if (isNaN(Number(newProduct.comparePrice)) || Number(newProduct.comparePrice) <= 0) {
        setFieldErrors({ comparePrice: 'Prix invalide (> 0)' });
        return;
      }
      if (Number(newProduct.comparePrice) <= Number(newProduct.price)) {
        setFieldErrors({ comparePrice: 'Doit être > prix de vente' });
        return;
      }
    }

    console.log('[AddProductModal] ✅ Validation passed, calling onAdd()', { ...newProduct, attributes: productAttributes });
    onAdd({ ...newProduct, attributes: productAttributes });
    
    // Reset form
    setNewProduct({
      name: '',
      price: '',
      costPrice: '',
      comparePrice: '',
      stock: '',
      barcode: undefined,
      description: '',
      images: [],
      collectionId: initialCollectionId,
      featured: false,
    });
    setProductAttributes({});
  };

  const handleAddImage = () => {
    (async () => {
      try {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission requise', "Autorisez l'accès aux images pour ajouter des photos");
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          allowsEditing: true,
        });

        // newer versions use `canceled` flag
        if (result.canceled) {
          return;
        }

        // images available in assets array
        const uri = result.assets && result.assets[0] ? result.assets[0].uri : undefined;
        if (uri) {
          setNewProduct({
            ...newProduct,
            images: [...newProduct.images, uri].slice(0, 5),
          });
        }
      } catch (e) {
        errorHandler.handle(e, 'ImagePicker error', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
        Alert.alert('Erreur', "Impossible d'ajouter l'image");
      }
    })();
  };

  const handleRemoveImage = (index: number) => {
    setNewProduct({
      ...newProduct,
      images: newProduct.images.filter((_, i) => i !== index),
    });
    // Remove from enhancing state if present
    const nextEnhancing = { ...enhancingImages };
    delete nextEnhancing[index];
    setEnhancingImages(nextEnhancing);
  };

  const handleEnhanceImage = async (index: number) => {
    const uri = newProduct.images[index];
    if (!uri || enhancingImages[index]) return;

    try {
      console.log('[AddProductModal] Enhancing image at index:', index);
      setEnhancingImages(prev => ({ ...prev, [index]: true }));
      
      // 1. Remove background locally (100% Free)
      console.log('[AddProductModal] Calling imageProcessorService.removeBackground...');
      const processedUri = await imageProcessorService.removeBackground(uri);
      console.log('[AddProductModal] Enhancement complete. New URI length:', processedUri.length);
      
      // 2. Update state
      const nextImages = [...newProduct.images];
      nextImages[index] = processedUri;
      
      setNewProduct(prev => ({
        ...prev,
        images: nextImages
      }));

    } catch (e) {
      console.error('[AddProductModal] Enhancement failed:', e);
      Alert.alert('Erreur', "L'amélioration automatique a échoué. Vérifiez votre connexion ou réessayez.");
    } finally {
      setEnhancingImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const incrementStock = () => {
    const current = parseInt(newProduct.stock || '0', 10);
    setNewProduct({ ...newProduct, stock: String(current + 1) });
  };

  const decrementStock = () => {
    const current = parseInt(newProduct.stock || '0', 10);
    if (current <= 0) return;
    setNewProduct({ ...newProduct, stock: String(current - 1) });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : 'overFullScreen'}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>
                Collection <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity style={[styles.selectInput, fieldErrors.collection && styles.inputError]} onPress={openCollectionPicker} activeOpacity={0.8}>
                <Text style={{ color: newProduct.collectionId ? COLORS.text : COLORS.textMuted }} numberOfLines={1}>
                  {collections?.find((c) => c.id === newProduct.collectionId)?.name || 'Sélectionner une collection'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
              {fieldErrors.collection && <Text style={styles.errorText}>{fieldErrors.collection}</Text>}
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>
                Nom du produit <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, fieldErrors.name && styles.inputError]}
                placeholder="Ex: iPhone 15 Pro"
                placeholderTextColor={COLORS.textMuted}
                value={newProduct.name}
                onChangeText={(text) =>
                  setNewProduct({ ...newProduct, name: text })
                }
              />
              {fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>
                Prix <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, fieldErrors.price && styles.inputError]}
                placeholder="Ex: 850000"
                placeholderTextColor={COLORS.textMuted}
                value={newProduct.price}
                onChangeText={(text) =>
                  setNewProduct({ ...newProduct, price: text })
                }
                keyboardType="numeric"
              />
              {fieldErrors.price && <Text style={styles.errorText}>{fieldErrors.price}</Text>}
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>
                Prix d'achat (pour calcul des bénéfices)
              </Text>
              <TextInput
                style={[styles.input, fieldErrors.costPrice && styles.inputError]}
                placeholder="Ex: 500000"
                placeholderTextColor={COLORS.textMuted}
                value={newProduct.costPrice}
                onChangeText={(text) =>
                  setNewProduct({ ...newProduct, costPrice: text })
                }
                keyboardType="numeric"
              />
              {fieldErrors.costPrice && <Text style={styles.errorText}>{fieldErrors.costPrice}</Text>}
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>Prix comparé</Text>
              <TextInput
                style={[styles.input, fieldErrors.comparePrice && styles.inputError]}
                placeholder="Ex: 950000"
                placeholderTextColor={COLORS.textMuted}
                value={newProduct.comparePrice}
                onChangeText={(text) =>
                  setNewProduct({ ...newProduct, comparePrice: text })
                }
                keyboardType="numeric"
              />
            </View>

            {/* Code barre */}
            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>Code barre</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="0001234567890"
                  placeholderTextColor={COLORS.textMuted}
                  value={newProduct.barcode || ''}
                  onChangeText={(text) =>
                    setNewProduct({ ...newProduct, barcode: text })
                  }
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={{
                    padding: 12,
                    backgroundColor: COLORS.accent + '15',
                    borderRadius: 8,
                    height: 48,
                    width: 48,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  onPress={async () => {
                    if (!cameraPermission?.granted) {
                      const status = await requestCameraPermission();
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
            </View>

            <View style={[styles.modalInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={styles.inputLabel}>Ajouter en vedette (Accueil)</Text>
              <TouchableOpacity 
                style={[styles.toggleButton, newProduct.featured && styles.toggleButtonActive]}
                onPress={() => setNewProduct({ ...newProduct, featured: !newProduct.featured })}
              >
                <Text style={[styles.toggleText, newProduct.featured && styles.toggleTextActive]}>
                  {newProduct.featured ? '✓' : '○'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>Stock</Text>
              <View style={styles.stockRow}>
                <TouchableOpacity style={styles.stockButton} onPress={decrementStock}>
                  <Ionicons name="remove-circle-outline" size={24} color={COLORS.danger} />
                </TouchableOpacity>
                <Text style={styles.stockValue}>{newProduct.stock || '0'}</Text>
                <TouchableOpacity style={styles.stockButton} onPress={incrementStock}>
                  <Ionicons name="add-circle-outline" size={24} color={COLORS.success} />
                </TouchableOpacity>
              </View>
              {fieldErrors.stock && <Text style={styles.errorText}>{fieldErrors.stock}</Text>}
            </View>

            {/* Dynamic Attributes Section */}
            {categorySchema.length > 0 && (
              <View style={styles.dynamicAttrsSection}>
                <View style={styles.dynamicAttrsHeader}>
                  <Ionicons name="sparkles-outline" size={18} color={COLORS.accent} />
                  <Text style={styles.dynamicAttrsTitle}>Informations complémentaires</Text>
                </View>
                <Text style={styles.dynamicAttrsSubtitle}>
                  Remplissez ces caractéristiques spécifiques pour améliorer la visibilité de votre produit.
                </Text>

                {categorySchema.map((attr) => {
                  const val = productAttributes[attr.name];
                  return (
                    <View key={attr.name} style={styles.modalInput}>
                      <Text style={styles.inputLabel}>
                        {attr.label} {attr.required && <Text style={styles.required}>*</Text>}
                      </Text>
                      
                      {attr.type === 'text' && (
                        <TextInput
                          style={[styles.input, fieldErrors[`attr_${attr.name}`] && styles.inputError]}
                          placeholder={`Entrez ${attr.label.toLowerCase()}`}
                          placeholderTextColor={COLORS.textMuted}
                          value={val || ''}
                          onChangeText={(text) => setProductAttributes(prev => ({ ...prev, [attr.name]: text }))}
                        />
                      )}

                      {attr.type === 'number' && (
                        <TextInput
                          style={[styles.input, fieldErrors[`attr_${attr.name}`] && styles.inputError]}
                          placeholder={`Entrez ${attr.label.toLowerCase()}`}
                          placeholderTextColor={COLORS.textMuted}
                          keyboardType="numeric"
                          value={val !== undefined && val !== null ? String(val) : ''}
                          onChangeText={(text) => setProductAttributes(prev => ({ ...prev, [attr.name]: text }))}
                        />
                      )}

                      {attr.type === 'select' && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                          {attr.options?.map((opt: string) => {
                            const selected = val === opt;
                            return (
                              <TouchableOpacity
                                key={opt}
                                style={[
                                  styles.attrChip,
                                  selected && styles.attrChipActive
                                ]}
                                onPress={() => setProductAttributes(prev => ({ ...prev, [attr.name]: opt }))}
                              >
                                <Text style={[
                                  styles.attrChipText,
                                  selected && styles.attrChipTextActive
                                ]}>
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {attr.type === 'multiselect' && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                          {attr.options?.map((opt: string) => {
                            const arr = Array.isArray(val) ? val : [];
                            const selected = arr.includes(opt);
                            return (
                              <TouchableOpacity
                                key={opt}
                                style={[
                                  styles.attrChip,
                                  selected && styles.attrChipActive
                                ]}
                                onPress={() => {
                                  const next = selected ? arr.filter((x: any) => x !== opt) : [...arr, opt];
                                  setProductAttributes(prev => ({ ...prev, [attr.name]: next }));
                                }}
                              >
                                <Text style={[
                                  styles.attrChipText,
                                  selected && styles.attrChipTextActive
                                ]}>
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {fieldErrors[`attr_${attr.name}`] && (
                        <Text style={styles.errorText}>{fieldErrors[`attr_${attr.name}`]}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>
                Description <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, fieldErrors.description && styles.inputError]}
                placeholder="Description du produit (minimum 3 caractères)..."
                placeholderTextColor={COLORS.textMuted}
                value={newProduct.description}
                onChangeText={(text) =>
                  setNewProduct({ ...newProduct, description: text })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {fieldErrors.description && <Text style={styles.errorText}>{fieldErrors.description}</Text>}
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>
                Images ({newProduct.images.length}/5) <Text style={styles.required}>*</Text>
              </Text>
              <View style={fieldErrors.images ? styles.imagesErrorContainer : {}}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imagesContainer}
                >
                {newProduct.images.map((image, index) => (
                  <View key={index} style={styles.imageItem}>
                    <Image
                      source={{ uri: cloudinaryService.getOptimizedUrl(image, 800) }}
                      style={[styles.imagePreview, enhancingImages[index] && { opacity: 0.5 }]}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                    
                    {enhancingImages[index] ? (
                      <View style={styles.imageLoadingOverlay}>
                        <ActivityIndicator color="#fff" size="small" />
                      </View>
                    ) : null}
                  </View>
                ))}

                {newProduct.images.length < 5 && (
                  <TouchableOpacity
                    style={styles.addImageButton}
                    onPress={handleAddImage}
                  >
                    <Ionicons name="add" size={24} color={COLORS.textMuted} />
                    <Text style={styles.addImageText}>Ajouter</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              </View>
              {fieldErrors.images && <Text style={styles.errorText}>{fieldErrors.images}</Text>}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleAddProduct}
            >
              <Text style={styles.confirmButtonText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showCollectionPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCollectionPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisir une collection</Text>
              <TouchableOpacity onPress={() => setShowCollectionPicker(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchRow}>
              <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Rechercher..."
                placeholderTextColor={COLORS.textMuted}
                value={collectionSearch}
                onChangeText={setCollectionSearch}
                autoCorrect={false}
              />
            </View>

            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {filteredCollectionOptions.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>Aucune collection</Text>
                </View>
              ) : (
                filteredCollectionOptions.map((c) => {
                  const selected = c.id === pendingCollectionId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.pickerItem, selected && styles.pickerItemSelected]}
                      onPress={() => setPendingCollectionId(c.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.pickerItemLeft}>
                        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                          {selected ? <View style={styles.radioInner} /> : null}
                        </View>
                        <Text style={styles.pickerItemText} numberOfLines={1}>
                          {c.name}
                        </Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark" size={18} color={COLORS.accent} />
                      ) : (
                        <View style={{ width: 18 }} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={[styles.pickerButton, styles.pickerCancelButton]}
                onPress={() => setShowCollectionPicker(false)}
              >
                <Text style={styles.pickerCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerButton, styles.pickerConfirmButton]}
                onPress={() => {
                  if (!pendingCollectionId) {
                    Alert.alert('Erreur', 'Veuillez sélectionner une collection');
                    return;
                  }
                  setNewProduct((prev) => ({ ...prev, collectionId: pendingCollectionId }));
                  setShowCollectionPicker(false);
                }}
              >
                <Text style={styles.pickerConfirmText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    </Modal>
  );
};

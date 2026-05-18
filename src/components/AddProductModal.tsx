import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
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
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { cloudinaryService } from '../services/cloudinaryService';
import { imageProcessorService } from '../services/imageProcessorService';
import { categoryService } from '../services/categoryService';

interface CollectionOption {
  id: string;
  name: string;
  category_id?: string | null;
  custom_attributes?: any[];
}

interface Product {
  name: string;
  price: string;
  costPrice: string;
  comparePrice: string;
  stock: string;
  barcode?: string;
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: COLORS.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      height: '92%',
      paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    },
    modalHeader: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: COLORS.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.bg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    // Step indicator styles
    stepIndicatorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.md,
    },
    stepDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDotActive: {
      borderColor: COLORS.accent,
      backgroundColor: COLORS.accent,
    },
    stepDotCompleted: {
      borderColor: COLORS.success,
      backgroundColor: COLORS.success,
    },
    stepDotText: {
      fontSize: 11,
      fontWeight: '700',
      color: COLORS.textSoft,
    },
    stepDotTextActive: {
      color: '#fff',
    },
    stepDotTextCompleted: {
      color: '#fff',
    },
    stepLine: {
      flex: 1,
      height: 2,
      backgroundColor: COLORS.border,
      marginHorizontal: SPACING.xs,
    },
    stepLineActive: {
      backgroundColor: COLORS.accent,
    },
    stepSubText: {
      textAlign: 'center',
      fontSize: 12,
      color: COLORS.textSoft,
      fontWeight: '600',
      marginTop: 6,
    },
    modalBody: {
      flex: 1,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
    },
    modalInput: {
      marginBottom: SPACING.lg,
    },
    inputLabel: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      color: COLORS.textSoft,
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
    },
    inputError: {
      borderColor: COLORS.danger,
      backgroundColor: COLORS.danger + '05',
    },
    errorText: {
      color: COLORS.danger,
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      marginTop: SPACING.xs,
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
    },
    textArea: {
      height: 120,
      textAlignVertical: 'top',
    },
    stockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.lg,
      backgroundColor: COLORS.bg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginTop: SPACING.xs,
    },
    stockButton: {
      padding: SPACING.xs,
    },
    stockValue: {
      fontSize: FONT_SIZE.xl,
      fontWeight: '800',
      color: COLORS.text,
      minWidth: 60,
      textAlign: 'center',
    },
    // Toggle / Switch styles
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: COLORS.bg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginTop: SPACING.xs,
    },
    toggleLabel: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      color: COLORS.text,
    },
    toggleButton: {
      width: 50,
      height: 28,
      borderRadius: 14,
      backgroundColor: COLORS.border,
      padding: 2,
      justifyContent: 'center',
    },
    toggleButtonActive: {
      backgroundColor: COLORS.accent,
    },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#fff',
    },
    toggleThumbActive: {
      alignSelf: 'flex-end',
    },
    // Picker list styles
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
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
      backgroundColor: COLORS.accent + '08',
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
      color: '#fff',
      fontWeight: '600',
      fontSize: FONT_SIZE.md,
    },
    // Image uploader styles
    imagesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.md,
      marginTop: SPACING.xs,
    },
    imageItem: {
      position: 'relative',
      width: '30%',
      aspectRatio: 1,
    },
    imagePreview: {
      width: '100%',
      height: '100%',
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    imageLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
      zIndex: 10,
    },
    enhanceImageButton: {
      position: 'absolute',
      bottom: -6,
      left: '5%',
      right: '5%',
      height: 22,
      borderRadius: 11,
      backgroundColor: COLORS.accent,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 4,
      zIndex: 10,
    },
    enhanceImageText: {
      color: 'white',
      fontSize: 9,
      fontWeight: '700',
    },
    addImageButton: {
      width: '30%',
      aspectRatio: 1,
      borderRadius: RADIUS.md,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.bg,
    },
    addImageText: {
      fontSize: 10,
      color: COLORS.textMuted,
      marginTop: 4,
      fontWeight: '600',
    },
    // Dynamic attributes panel
    dynamicAttrsSection: {
      backgroundColor: COLORS.bg,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
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
    attrChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    attrChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs + 2,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    attrChipActive: {
      borderColor: COLORS.accent,
      backgroundColor: COLORS.accent + '10',
    },
    attrChipText: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.textSoft,
      fontWeight: '600',
    },
    attrChipTextActive: {
      color: COLORS.accent,
    },
    // Bottom actions
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
      flexDirection: 'row',
      gap: SPACING.xs,
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
      color: '#fff',
      fontWeight: '600',
      fontSize: FONT_SIZE.md,
    },
    // Camera modal
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
  const [currentStep, setCurrentStep] = useState(1);

  // Picker States
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [pendingCollectionId, setPendingCollectionId] = useState(initialCollectionId);

  // Form States
  const [newProduct, setNewProduct] = useState<Product>({
    name: '',
    price: '',
    costPrice: '',
    comparePrice: '',
    stock: '1',
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      if (selectedCol) {
        try {
          let schema: any[] = [];
          if (selectedCol.category_id) {
            const category = await categoryService.getById(selectedCol.category_id);
            schema = category.attribute_schema || [];
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
          }

          // Merge custom attributes from the collection
          const customAttributes = selectedCol.custom_attributes || [];
          schema = [...schema, ...customAttributes];

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

  // Step validation
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!newProduct.collectionId) {
        errors.collection = 'Collection requise';
      }
      if (!newProduct.name || !newProduct.name.trim()) {
        errors.name = 'Nom requis';
      } else if (newProduct.name.trim().length < 3) {
        errors.name = 'Min 3 caractères';
      }
      if (!newProduct.description || !newProduct.description.trim()) {
        errors.description = 'Description requise';
      } else if (newProduct.description.trim().length < 3) {
        errors.description = 'Min 3 caractères';
      }
    }

    if (step === 2) {
      if (!newProduct.price || !newProduct.price.trim()) {
        errors.price = 'Prix requis';
      } else if (isNaN(Number(newProduct.price)) || Number(newProduct.price) <= 0) {
        errors.price = 'Prix de vente invalide (> 0)';
      }

      if (newProduct.costPrice && newProduct.costPrice.trim()) {
        if (isNaN(Number(newProduct.costPrice)) || Number(newProduct.costPrice) < 0) {
          errors.costPrice = "Prix d'achat invalide (≥ 0)";
        }
      }

      if (newProduct.comparePrice && newProduct.comparePrice.trim()) {
        if (isNaN(Number(newProduct.comparePrice)) || Number(newProduct.comparePrice) <= 0) {
          errors.comparePrice = 'Prix comparé invalide';
        } else if (Number(newProduct.comparePrice) <= Number(newProduct.price)) {
          errors.comparePrice = 'Doit être > prix de vente';
        }
      }

      if (!newProduct.stock || !newProduct.stock.trim()) {
        errors.stock = 'Stock requis';
      } else if (isNaN(Number(newProduct.stock)) || Number(newProduct.stock) < 0) {
        errors.stock = 'Stock invalide (≥ 0)';
      }
    }

    if (step === 3) {
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
    }

    if (step === 4) {
      if (!newProduct.images || newProduct.images.length === 0) {
        errors.images = 'Au moins 1 image requise';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setFieldErrors({});
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // If Step 2 and there are no dynamic attributes, we skip step 3!
      if (currentStep === 2 && categorySchema.length === 0) {
        setCurrentStep(4);
      } else {
        setCurrentStep(prev => prev + 1);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handlePrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFieldErrors({});
    if (currentStep === 4 && categorySchema.length === 0) {
      setCurrentStep(2);
    } else {
      setCurrentStep(prev => Math.max(1, prev - 1));
    }
  };

  const handleAddProduct = () => {
    if (!validateStep(4)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    onAdd({ ...newProduct, attributes: productAttributes });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset Form
    setNewProduct({
      name: '',
      price: '',
      costPrice: '',
      comparePrice: '',
      stock: '1',
      barcode: undefined,
      description: '',
      images: [],
      collectionId: initialCollectionId,
      featured: false,
    });
    setProductAttributes({});
    setCurrentStep(1);
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

        if (result.canceled) return;

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
    const nextEnhancing = { ...enhancingImages };
    delete nextEnhancing[index];
    setEnhancingImages(nextEnhancing);
  };

  const handleEnhanceImage = async (index: number) => {
    const uri = newProduct.images[index];
    if (!uri || enhancingImages[index]) return;

    try {
      setEnhancingImages(prev => ({ ...prev, [index]: true }));
      const processedUri = await imageProcessorService.removeBackground(uri);
      
      const nextImages = [...newProduct.images];
      nextImages[index] = processedUri;
      
      setNewProduct(prev => ({ ...prev, images: nextImages }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[AddProductModal] Enhancement failed:', e);
      Alert.alert('Erreur', "L'amélioration automatique a échoué. Réessayez.");
    } finally {
      setEnhancingImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const incrementStock = () => {
    const current = parseInt(newProduct.stock || '0', 10);
    setNewProduct({ ...newProduct, stock: String(current + 1) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const decrementStock = () => {
    const current = parseInt(newProduct.stock || '0', 10);
    if (current <= 0) return;
    setNewProduct({ ...newProduct, stock: String(current - 1) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const totalSteps = categorySchema.length > 0 ? 4 : 3;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerRow}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Premium step progress tracker */}
            <View style={styles.stepIndicatorContainer}>
              {/* Step 1 */}
              <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive, currentStep > 1 && styles.stepDotCompleted]}>
                <Text style={[styles.stepDotText, currentStep >= 1 && styles.stepDotTextActive, currentStep > 1 && styles.stepDotTextCompleted]}>
                  {currentStep > 1 ? '✓' : '1'}
                </Text>
              </View>
              <View style={[styles.stepLine, currentStep > 1 && styles.stepLineActive]} />

              {/* Step 2 */}
              <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive, currentStep > 2 && styles.stepDotCompleted]}>
                <Text style={[styles.stepDotText, currentStep >= 2 && styles.stepDotTextActive, currentStep > 2 && styles.stepDotTextCompleted]}>
                  {currentStep > 2 ? '✓' : '2'}
                </Text>
              </View>
              <View style={[styles.stepLine, currentStep > 2 && styles.stepLineActive]} />

              {/* Step 3 (Optional specs) */}
              {categorySchema.length > 0 && (
                <>
                  <View style={[styles.stepDot, currentStep >= 3 && styles.stepDotActive, currentStep > 3 && styles.stepDotCompleted]}>
                    <Text style={[styles.stepDotText, currentStep >= 3 && styles.stepDotTextActive, currentStep > 3 && styles.stepDotTextCompleted]}>
                      {currentStep > 3 ? '✓' : '3'}
                    </Text>
                  </View>
                  <View style={[styles.stepLine, currentStep > 3 && styles.stepLineActive]} />
                </>
              )}

              {/* Step 4 / Final */}
              <View style={[styles.stepDot, currentStep === 4 && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, currentStep === 4 && styles.stepDotTextActive]}>
                  {categorySchema.length > 0 ? '4' : '3'}
                </Text>
              </View>
            </View>

            <Text style={styles.stepSubText}>
              {currentStep === 1 && 'Étape 1 : Informations de base'}
              {currentStep === 2 && 'Étape 2 : Prix & Stock'}
              {currentStep === 3 && 'Étape 3 : Spécifications techniques'}
              {currentStep === 4 && 'Étape 4 : Images du produit'}
            </Text>
          </View>

          {/* Modal Body */}
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* STEP 1 : BASIC INFORMATIONS */}
            {currentStep === 1 && (
              <View>
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
                    placeholder="Ex: Robe en soie rouge, Pizza Reine"
                    placeholderTextColor={COLORS.textMuted}
                    value={newProduct.name}
                    onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
                  />
                  {fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}
                </View>

                <View style={styles.modalInput}>
                  <Text style={styles.inputLabel}>
                    Description <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea, fieldErrors.description && styles.inputError]}
                    placeholder="Présentez brièvement le produit à vos clients..."
                    placeholderTextColor={COLORS.textMuted}
                    value={newProduct.description}
                    onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  {fieldErrors.description && <Text style={styles.errorText}>{fieldErrors.description}</Text>}
                </View>

                <View style={styles.modalInput}>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Mettre le produit en vedette (Accueil)</Text>
                    <TouchableOpacity 
                      style={[styles.toggleButton, newProduct.featured && styles.toggleButtonActive]}
                      onPress={() => {
                        setNewProduct({ ...newProduct, featured: !newProduct.featured });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <View style={[styles.toggleThumb, newProduct.featured && styles.toggleThumbActive]} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* STEP 2 : PRICE & STOCK */}
            {currentStep === 2 && (
              <View>
                <View style={styles.modalInput}>
                  <Text style={styles.inputLabel}>
                    Prix de vente (F CFA) <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, fieldErrors.price && styles.inputError]}
                    placeholder="Ex: 15000"
                    placeholderTextColor={COLORS.textMuted}
                    value={newProduct.price}
                    onChangeText={(text) => setNewProduct({ ...newProduct, price: text })}
                    keyboardType="numeric"
                  />
                  {fieldErrors.price && <Text style={styles.errorText}>{fieldErrors.price}</Text>}
                </View>

                <View style={styles.modalInput}>
                  <Text style={styles.inputLabel}>Prix d'achat (Optionnel - Pour calculer vos bénéfices)</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.costPrice && styles.inputError]}
                    placeholder="Ex: 10000"
                    placeholderTextColor={COLORS.textMuted}
                    value={newProduct.costPrice}
                    onChangeText={(text) => setNewProduct({ ...newProduct, costPrice: text })}
                    keyboardType="numeric"
                  />
                  {fieldErrors.costPrice && <Text style={styles.errorText}>{fieldErrors.costPrice}</Text>}
                </View>

                <View style={styles.modalInput}>
                  <Text style={styles.inputLabel}>Prix comparé (Prix barré - Idéal pour les promotions)</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.comparePrice && styles.inputError]}
                    placeholder="Ex: 20000"
                    placeholderTextColor={COLORS.textMuted}
                    value={newProduct.comparePrice}
                    onChangeText={(text) => setNewProduct({ ...newProduct, comparePrice: text })}
                    keyboardType="numeric"
                  />
                  {fieldErrors.comparePrice && <Text style={styles.errorText}>{fieldErrors.comparePrice}</Text>}
                </View>

                <View style={styles.modalInput}>
                  <Text style={styles.inputLabel}>Stock disponible</Text>
                  <View style={styles.stockRow}>
                    <TouchableOpacity style={styles.stockButton} onPress={decrementStock}>
                      <Ionicons name="remove-circle-outline" size={28} color={COLORS.danger} />
                    </TouchableOpacity>
                    <Text style={styles.stockValue}>{newProduct.stock || '0'}</Text>
                    <TouchableOpacity style={styles.stockButton} onPress={incrementStock}>
                      <Ionicons name="add-circle-outline" size={28} color={COLORS.success} />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.stock && <Text style={styles.errorText}>{fieldErrors.stock}</Text>}
                </View>

                {/* Barcode scanner */}
                <View style={styles.modalInput}>
                  <Text style={styles.inputLabel}>Code-barres / EAN (Optionnel)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="0001234567890"
                      placeholderTextColor={COLORS.textMuted}
                      value={newProduct.barcode || ''}
                      onChangeText={(text) => setNewProduct({ ...newProduct, barcode: text })}
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
                            Alert.alert('Permission requise', 'L\'accès à la caméra est nécessaire pour scanner.');
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
              </View>
            )}

            {/* STEP 3 : TECHNICAL SPECIFICATIONS (DYNAMIC FIELDS) */}
            {currentStep === 3 && categorySchema.length > 0 && (
              <View style={styles.dynamicAttrsSection}>
                <View style={styles.dynamicAttrsHeader}>
                  <Ionicons name="sparkles-outline" size={18} color={COLORS.accent} />
                  <Text style={styles.dynamicAttrsTitle}>Caractères spécifiques</Text>
                </View>
                <Text style={styles.dynamicAttrsSubtitle}>
                  Spécifiez les options disponibles pour vos produits (ex: Couleurs, Tailles) héritées de la catégorie.
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
                          placeholder={`Saisir ${attr.label.toLowerCase()}`}
                          placeholderTextColor={COLORS.textMuted}
                          value={val || ''}
                          onChangeText={(text) => setProductAttributes(prev => ({ ...prev, [attr.name]: text }))}
                        />
                      )}

                      {attr.type === 'number' && (
                        <TextInput
                          style={[styles.input, fieldErrors[`attr_${attr.name}`] && styles.inputError]}
                          placeholder={`Saisir ${attr.label.toLowerCase()}`}
                          placeholderTextColor={COLORS.textMuted}
                          keyboardType="numeric"
                          value={val !== undefined && val !== null ? String(val) : ''}
                          onChangeText={(text) => setProductAttributes(prev => ({ ...prev, [attr.name]: text }))}
                        />
                      )}

                      {attr.type === 'select' && (
                        <View style={styles.attrChipsRow}>
                          {attr.options?.map((opt: string) => {
                            const selected = val === opt;
                            return (
                              <TouchableOpacity
                                key={opt}
                                style={[styles.attrChip, selected && styles.attrChipActive]}
                                onPress={() => setProductAttributes(prev => ({ ...prev, [attr.name]: opt }))}
                              >
                                <Text style={[styles.attrChipText, selected && styles.attrChipTextActive]}>
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {attr.type === 'multiselect' && (
                        <View style={styles.attrChipsRow}>
                          {attr.options?.map((opt: string) => {
                            const arr = Array.isArray(val) ? val : [];
                            const selected = arr.includes(opt);
                            return (
                              <TouchableOpacity
                                key={opt}
                                style={[styles.attrChip, selected && styles.attrChipActive]}
                                onPress={() => {
                                  const next = selected ? arr.filter((x: any) => x !== opt) : [...arr, opt];
                                  setProductAttributes(prev => ({ ...prev, [attr.name]: next }));
                                }}
                              >
                                <Text style={[styles.attrChipText, selected && styles.attrChipTextActive]}>
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

            {/* STEP 4 : IMAGES & UPLOADER */}
            {currentStep === 4 && (
              <View>
                <View style={styles.modalInput}>
                  <Text style={styles.inputLabel}>
                    Photos du produit ({newProduct.images.length}/5) <Text style={styles.required}>*</Text>
                  </Text>
                  
                  <View style={styles.imagesGrid}>
                    {newProduct.images.map((image, index) => (
                      <View key={index} style={styles.imageItem}>
                        <Image
                          source={{ uri: cloudinaryService.getOptimizedUrl(image, 800) }}
                          style={[styles.imagePreview, enhancingImages[index] && { opacity: 0.4 }]}
                        />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => handleRemoveImage(index)}
                        >
                          <Ionicons name="close" size={14} color="#fff" />
                        </TouchableOpacity>

                        {/* IA Background Removal Button */}
                        {!enhancingImages[index] && (
                          <TouchableOpacity
                            style={styles.enhanceImageButton}
                            onPress={() => handleEnhanceImage(index)}
                          >
                            <Ionicons name="sparkles" size={10} color="#fff" />
                            <Text style={styles.enhanceImageText}>Améliorer</Text>
                          </TouchableOpacity>
                        )}
                        
                        {enhancingImages[index] && (
                          <View style={styles.imageLoadingOverlay}>
                            <ActivityIndicator color="#fff" size="small" />
                          </View>
                        )}
                      </View>
                    ))}

                    {newProduct.images.length < 5 && (
                      <TouchableOpacity style={styles.addImageButton} onPress={handleAddImage}>
                        <Ionicons name="camera-outline" size={28} color={COLORS.textMuted} />
                        <Text style={styles.addImageText}>Ajouter</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {fieldErrors.images && <Text style={styles.errorText}>{fieldErrors.images}</Text>}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Modal Footer Actions */}
          <View style={styles.modalActions}>
            {currentStep > 1 ? (
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={handlePrev}>
                <Ionicons name="arrow-back" size={18} color={COLORS.text} />
                <Text style={styles.cancelButtonText}>Retour</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            )}

            {currentStep < totalSteps ? (
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleNext}>
                <Text style={styles.confirmButtonText}>Suivant</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleAddProduct}>
                <Text style={styles.confirmButtonText}>Ajouter le produit</Text>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* SELECTOR : COLLECTION */}
      <Modal visible={showCollectionPicker} animationType="slide" transparent={true} onRequestClose={() => setShowCollectionPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisir une collection</Text>
              <TouchableOpacity onPress={() => setShowCollectionPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchRow}>
              <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Rechercher une collection..."
                placeholderTextColor={COLORS.textMuted}
                value={collectionSearch}
                onChangeText={setCollectionSearch}
                autoCorrect={false}
              />
            </View>

            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {filteredCollectionOptions.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>Aucune collection disponible</Text>
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
                      {selected && <Ionicons name="checkmark" size={18} color={COLORS.accent} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.pickerActions}>
              <TouchableOpacity style={[styles.pickerButton, styles.pickerCancelButton]} onPress={() => setShowCollectionPicker(false)}>
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
      <Modal visible={showCameraScanner} animationType="slide" onRequestClose={() => setShowCameraScanner(false)}>
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
                <TouchableOpacity style={styles.closeCameraButton} onPress={() => setShowCameraScanner(false)}>
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

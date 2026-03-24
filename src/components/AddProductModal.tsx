import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../hooks/useTheme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

interface CollectionOption {
  id: string;
  name: string;
}

interface Product {
  name: string;
  price: string;
  comparePrice: string;
  stock: string;
  barcode?: string; // code barre facultatif
  description: string;
  images: string[];
  collectionId: string;
}

interface AddProductModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (product: Product) => void;
  collections: CollectionOption[];
  
  title?: string;
}

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
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(themeContext) : {}, [themeContext]);

  const initialCollectionId = collections && collections.length > 0 ? collections[0]!.id : '';
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [pendingCollectionId, setPendingCollectionId] = useState(initialCollectionId);
  const [newProduct, setNewProduct] = useState<Product>({
    name: '',
    price: '',
    comparePrice: '',
    stock: '',
    barcode: undefined,
    description: '',
    images: [],
    collectionId: initialCollectionId,
  });

  React.useEffect(() => {
    if (!visible) return;
    if (newProduct.collectionId) return;
    if (!collections || collections.length === 0) return;
    setNewProduct((prev) => ({ ...prev, collectionId: collections[0]!.id }));
  }, [visible, collections, newProduct.collectionId]);

  React.useEffect(() => {
    setPendingCollectionId(newProduct.collectionId || initialCollectionId);
  }, [newProduct.collectionId, initialCollectionId]);

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
    if (!newProduct.name.trim() || !newProduct.price.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir au moins le nom et le prix');
      return;
    }

    if (!newProduct.collectionId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une collection');
      return;
    }

    onAdd(newProduct);
    
    // Reset form
    setNewProduct({
      name: '',
      price: '',
      comparePrice: '',
      stock: '',
      barcode: undefined,
      description: '',
      images: [],
      collectionId: initialCollectionId,
    });
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
              <TouchableOpacity style={styles.selectInput} onPress={openCollectionPicker} activeOpacity={0.8}>
                <Text style={{ color: newProduct.collectionId ? COLORS.text : COLORS.textMuted }} numberOfLines={1}>
                  {collections?.find((c) => c.id === newProduct.collectionId)?.name || 'Sélectionner une collection'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>
                Nom du produit <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: iPhone 15 Pro"
                placeholderTextColor={COLORS.textMuted}
                value={newProduct.name}
                onChangeText={(text) =>
                  setNewProduct({ ...newProduct, name: text })
                }
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>
                Prix <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 850000"
                placeholderTextColor={COLORS.textMuted}
                value={newProduct.price}
                onChangeText={(text) =>
                  setNewProduct({ ...newProduct, price: text })
                }
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>Prix comparé</Text>
              <TextInput
                style={styles.input}
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
              <TextInput
                style={styles.input}
                placeholder="0001234567890"
                placeholderTextColor={COLORS.textMuted}
                value={newProduct.barcode || ''}
                onChangeText={(text) =>
                  setNewProduct({ ...newProduct, barcode: text })
                }
                keyboardType="numeric"
              />
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
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description du produit..."
                placeholderTextColor={COLORS.textMuted}
                value={newProduct.description}
                onChangeText={(text) =>
                  setNewProduct({ ...newProduct, description: text })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={styles.inputLabel}>
                Images ({newProduct.images.length}/5)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imagesContainer}
              >
                {newProduct.images.map((image, index) => (
                  <View key={index} style={styles.imageItem}>
                    <Image
                      source={{ uri: image }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <Ionicons name="close" size={16} color={COLORS.text} />
                    </TouchableOpacity>
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
    </Modal>
  );
};

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
    paddingRight: SPACING.lg,
    gap: SPACING.md,
  },
  imageItem: {
    position: 'relative',
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 80,
    height: 80,
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
});
};

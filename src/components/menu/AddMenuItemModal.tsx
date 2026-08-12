import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { type MenuCategory } from './MenuCategoryTabs';
import { type Product } from '../../types/product';
import { cloudinaryService } from '../../services/cloudinaryService';
import { productService } from '../../services/productService';
import { collectionService } from '../../services/collectionService';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (product: Product) => void;
  storeId: string;
  categories: MenuCategory[];
  accentColor: string;
  accentGradient: readonly [string, string];
  /** Si fourni → mode édition */
  editProduct?: Product | null;
};

type FormState = {
  name: string;
  description: string;
  price: string;
  costPrice: string;   // Coût de revient (ingrédients)
  prepTime: string;
  categoryId: string;
  imageUri: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  price: '',
  costPrice: '',
  prepTime: '',
  categoryId: '',
  imageUri: null,
  imageUrl: null,
  isAvailable: true,
};

export const AddMenuItemModal: React.FC<Props> = ({
  visible,
  onClose,
  onSaved,
  storeId,
  categories,
  accentColor,
  accentGradient,
  editProduct,
}) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Pré-remplir en mode édition
  useEffect(() => {
    if (editProduct) {
      setForm({
        name: editProduct.name,
        description: editProduct.description ?? '',
        price: String(editProduct.price),
        costPrice: editProduct.cost_price ? String(editProduct.cost_price) : '',
        prepTime: String(editProduct.attributes?.prep_time ?? ''),
        categoryId: editProduct.category ?? '',
        imageUri: null,
        imageUrl: editProduct.images?.[0] ?? null,
        isAvailable: editProduct.is_active,
      });
    } else {
      setForm({ ...EMPTY_FORM, categoryId: categories.find(c => c.id !== 'all')?.id ?? '' });
    }
  }, [editProduct, visible]);

  const set = (key: keyof FormState, val: any) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        set('imageUri', uri);
        // Upload immédiat
        setUploadingImage(true);
        try {
          const url = await cloudinaryService.uploadImage(uri, { folder: 'menu' });
          set('imageUrl', url);
        } catch (e) {
          Alert.alert('Erreur', "Impossible d'uploader la photo. Réessaie.");
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'ouvrir la galerie.");
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Champ requis', 'Le nom du plat est obligatoire.');
      return;
    }
    const price = parseFloat(form.price);
    if (!form.price || isNaN(price) || price < 0) {
      Alert.alert('Prix invalide', 'Renseigne un prix valide (ex: 3500).');
      return;
    }

    setSaving(true);
    try {
      // Trouver ou créer la collection pour cette catégorie
      let collectionId: string | undefined;
      if (form.categoryId && form.categoryId !== 'all') {
        const existingCols = await collectionService.getByStore(storeId);
        const match = existingCols.find(
          c => (c as any).menu_category === form.categoryId
        );
        if (match) {
          collectionId = match.id;
        } else {
          const cat = categories.find(c => c.id === form.categoryId);
          if (cat) {
            const created = await collectionService.create({
              store_id: storeId,
              name: `${cat.emoji} ${cat.label}`,
              // Stocker l'id de catégorie dans un champ custom si dispo, sinon utiliser description
              description: `menu_category:${cat.id}`,
            } as any);
            collectionId = created.id;
          }
        }
      }

      const payload = {
        store_id: storeId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price,
        cost_price: form.costPrice ? parseFloat(form.costPrice) : undefined,
        stock: 9999,
        images: form.imageUrl ? [form.imageUrl] : [],
        category: form.categoryId || undefined,
        collection_id: collectionId,
        is_active: form.isAvailable,
        attributes: form.prepTime
          ? { prep_time: parseInt(form.prepTime, 10) }
          : undefined,
      };

      let saved: Product;
      if (editProduct) {
        saved = await productService.update(editProduct.id, payload);
      } else {
        saved = await productService.create(payload);
      }

      onSaved(saved);
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de sauvegarder ce plat.');
    } finally {
      setSaving(false);
    }
  };

  const nonAllCategories = categories.filter(c => c.id !== 'all');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#fff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: accentColor }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {editProduct ? '✏️ Modifier le plat' : '➕ Nouveau plat / boisson'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo */}
          <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage} activeOpacity={0.8}>
            {uploadingImage ? (
              <ActivityIndicator size="large" color={accentColor} />
            ) : form.imageUrl ? (
              <>
                <Image source={{ uri: form.imageUrl }} style={styles.pickedImage} resizeMode="cover" />
                <View style={[styles.imageOverlay, { backgroundColor: accentColor + 'CC' }]}>
                  <Ionicons name="camera" size={22} color="#fff" />
                  <Text style={styles.imageOverlayText}>Changer la photo</Text>
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={40} color={accentColor} />
                <Text style={[styles.imagePlaceholderText, { color: accentColor }]}>
                  Ajouter une photo du plat
                </Text>
                <Text style={styles.imagePlaceholderSub}>Recommandé — attire plus de clients</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Catégorie */}
          <Text style={styles.fieldLabel}>Catégorie *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {nonAllCategories.map(cat => {
              const active = form.categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => set('categoryId', cat.id)}
                  style={[
                    styles.catChip,
                    active && { backgroundColor: accentColor, borderColor: accentColor },
                  ]}
                >
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.catLabel, active && { color: '#fff' }]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Nom */}
          <Text style={styles.fieldLabel}>Nom du plat *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Pizza 4 fromages, Mojito, Salade César..."
            placeholderTextColor="#bbb"
            value={form.name}
            onChangeText={v => set('name', v)}
            maxLength={80}
          />

          {/* Description */}
          <Text style={styles.fieldLabel}>Description / Ingrédients</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ex: Tomates, mozzarella, basilic frais... (optionnel)"
            placeholderTextColor="#bbb"
            value={form.description}
            onChangeText={v => set('description', v)}
            multiline
            numberOfLines={3}
            maxLength={300}
          />

          {/* Prix + Temps prépa (côte à côte) */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Prix (FCFA) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 3500"
                placeholderTextColor="#bbb"
                value={form.price}
                onChangeText={v => set('price', v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Préparation (min)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 15"
                placeholderTextColor="#bbb"
                value={form.prepTime}
                onChangeText={v => set('prepTime', v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Prix de revient (pour calcul bénéfice) */}
          <View style={styles.costRow}>
            <Ionicons name="calculator-outline" size={15} color="#888" />
            <Text style={styles.costLabel}>Prix de revient (coût ingrédients) — optionnel</Text>
          </View>
          <TextInput
            style={[styles.input, { borderColor: '#f97316' + '60' }]}
            placeholder="Ex: 1200  (pour calculer votre bénéfice)"
            placeholderTextColor="#bbb"
            value={form.costPrice}
            onChangeText={v => set('costPrice', v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
          <Text style={styles.costHint}>
            💡 Bénéfice = Prix vente − Prix de revient. Remplis ce champ pour voir vos marges dans l'onglet Bénéfices.
          </Text>

          {/* Disponibilité */}
          <Text style={styles.fieldLabel}>Disponibilité</Text>
          <View style={styles.availRow}>
            <TouchableOpacity
              style={[
                styles.availBtn,
                form.isAvailable && { backgroundColor: '#22c55e', borderColor: '#22c55e' },
              ]}
              onPress={() => set('isAvailable', true)}
            >
              <Ionicons name="checkmark-circle" size={18} color={form.isAvailable ? '#fff' : '#888'} />
              <Text style={[styles.availBtnText, form.isAvailable && { color: '#fff' }]}>
                Disponible
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.availBtn,
                !form.isAvailable && { backgroundColor: '#ef4444', borderColor: '#ef4444' },
              ]}
              onPress={() => set('isAvailable', false)}
            >
              <Ionicons name="close-circle" size={18} color={!form.isAvailable ? '#fff' : '#888'} />
              <Text style={[styles.availBtnText, !form.isAvailable && { color: '#fff' }]}>
                Épuisé
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bouton Sauvegarder */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {editProduct ? 'Enregistrer les modifications' : 'Ajouter à la carte'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  body: {
    padding: 20,
    gap: 4,
    paddingBottom: 100,
  },
  imagePickerBtn: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  pickedImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  imageOverlayText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imagePlaceholderSub: {
    fontSize: 11,
    color: '#aaa',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginTop: 14,
    marginBottom: 6,
  },
  catRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#f8f8f8',
  },
  catEmoji: {
    fontSize: 15,
  },
  catLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  availRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  availBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#f8f8f8',
  },
  availBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 6,
  },
  costLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  costHint: {
    fontSize: 11,
    color: '#f97316',
    marginTop: 5,
    lineHeight: 16,
  },
});

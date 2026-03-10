import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { collectionService, productService, type Product } from '../lib/supabase';

export const SellerEditCollectionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { collectionId } = route.params || {};
  
  const [loading, setLoading] = useState(false);
  const [productsPreview, setProductsPreview] = useState<Product[]>([]);
  const [collection, setCollection] = useState({
    name: '',
    description: '',
    isActive: true,
  });

  const loadData = useCallback(async () => {
    if (!collectionId) {
      Alert.alert('Erreur', 'Collection introuvable');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);
      const col = await collectionService.getById(String(collectionId));
      setCollection({
        name: col.name || '',
        description: col.description || '',
        isActive: !!col.is_active,
      });

      const prods = await productService.getByStoreAll(col.store_id);
      const filtered = (prods || []).filter((p) => String((p as any).collection_id || '') === String(col.id));
      setProductsPreview(filtered.slice(0, 2) as any);
    } catch (e) {
      console.error('load collection', e);
      Alert.alert('Erreur', 'Impossible de charger la collection');
    } finally {
      setLoading(false);
    }
  }, [collectionId, navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!collection.name.trim()) {
      Alert.alert('Erreur', 'Le nom de la collection est requis');
      return;
    }

    if (!collectionId) {
      Alert.alert('Erreur', 'Collection introuvable');
      return;
    }

    try {
      setLoading(true);
      await collectionService.update(String(collectionId), {
        name: collection.name.trim(),
        description: collection.description || null,
        is_active: collection.isActive,
      } as any);
      Alert.alert('Succès', 'Collection mise à jour avec succès');
      navigation.goBack();
    } catch (e) {
      console.error('update collection', e);
      Alert.alert('Erreur', "Impossible d'enregistrer");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer la collection',
      'Êtes-vous sûr de vouloir supprimer cette collection ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: async () => {
            if (!collectionId) {
              Alert.alert('Erreur', 'Collection introuvable');
              return;
            }
            try {
              setLoading(true);
              await collectionService.delete(String(collectionId));
              Alert.alert('Succès', 'Collection supprimée avec succès');
              navigation.goBack();
            } catch (e) {
              console.error('delete collection', e);
              Alert.alert('Erreur', 'Impossible de supprimer la collection');
            } finally {
              setLoading(false);
            }
          },
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier la collection</Text>
        <TouchableOpacity onPress={handleSave}>
          <Ionicons name="checkmark" size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Collection Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations de la collection</Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.loadingText}>Chargement...</Text>
              </View>
            ) : null}
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom de la collection *</Text>
              <TextInput
                style={styles.input}
                value={collection.name}
                onChangeText={(text) => setCollection({ ...collection, name: text })}
                placeholder="Ex: Électronique"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={collection.description}
                onChangeText={(text) => setCollection({ ...collection, description: text })}
                placeholder="Description de la collection..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            
            <View style={styles.switchGroup}>
              <Text style={styles.inputLabel}>Statut</Text>
              <TouchableOpacity 
                style={[
                  styles.switch,
                  collection.isActive ? styles.switchActive : styles.switchInactive
                ]}
                onPress={() => setCollection({ ...collection, isActive: !collection.isActive })}
              >
                <Ionicons 
                  name={collection.isActive ? 'checkmark' : 'close'} 
                  size={16} 
                  color={COLORS.white} 
                />
                <Text style={styles.switchText}>
                  {collection.isActive ? 'Active' : 'Inactive'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Products Preview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aperçu des produits</Text>
            <View style={styles.productsPreview}>
              {productsPreview.length === 0 ? (
                <View style={styles.emptyProductsPreview}>
                  <Text style={styles.emptyProductsText}>Aucun produit dans cette collection</Text>
                </View>
              ) : (
                productsPreview.map((p) => (
                  <View key={p.id} style={styles.productItem}>
                    <View style={styles.productImage} />
                    <Text style={styles.productName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.productPrice}>
                      {Number(p.price || 0).toLocaleString()} F
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Danger Zone */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zone de danger</Text>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
              <Text style={styles.deleteButtonText}>Supprimer la collection</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSoft,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
  },
  switchActive: {
    backgroundColor: COLORS.success,
  },
  switchInactive: {
    backgroundColor: COLORS.textMuted,
  },
  switchText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.white,
  },
  productsPreview: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  emptyProductsPreview: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyProductsText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  productItem: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.accent + '20',
    marginBottom: SPACING.sm,
  },
  productName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  productPrice: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.accent2,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.danger + '10',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.danger,
  },

  loadingContainer: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
});

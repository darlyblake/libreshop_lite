import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { collectionService, productService, type Product } from '../lib/supabase';

export const SellerCollectionProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { collectionId } = route.params || {};
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [collectionInfo, setCollectionInfo] = useState<{ id: string; name: string; description: string; productCount: number } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const loadData = useCallback(async () => {
    if (!collectionId) return;
    try {
      setLoading(true);
      const col = await collectionService.getById(String(collectionId));
      const all = await productService.getByStoreAll(col.store_id);
      const filtered = (all || []).filter((p) => String((p as any).collection_id || '') === String(col.id));
      setProducts(filtered as any);
      setCollectionInfo({
        id: col.id,
        name: col.name || 'Collection',
        description: col.description || '',
        productCount: filtered.length,
      });
    } catch (e) {
      console.error('load collection products', e);
      Alert.alert('Erreur', 'Impossible de charger les produits de la collection');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleBulkAction = (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedProducts.length === 0) return;
    Alert.alert(
      `${action === 'delete' ? 'Supprimer' : action === 'activate' ? 'Activer' : 'Désactiver'} les produits`,
      `Êtes-vous sûr de vouloir ${action === 'delete' ? 'supprimer' : action === 'activate' ? 'activer' : 'désactiver'} ${selectedProducts.length} produit(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Confirmer',
          onPress: async () => {
            try {
              setLoading(true);
              if (action === 'delete') {
                await Promise.all(selectedProducts.map((id) => productService.delete(id)));
                setProducts((prev) => prev.filter((p) => !selectedProducts.includes(p.id)));
              } else {
                const nextActive = action === 'activate';
                await Promise.all(selectedProducts.map((id) => productService.update(id, { is_active: nextActive } as any)));
                setProducts((prev) => prev.map((p) => (selectedProducts.includes(p.id) ? { ...p, is_active: nextActive } : p)));
              }
              setSelectedProducts([]);
              Alert.alert('Succès', `${selectedProducts.length} produit(s) ${action === 'delete' ? 'supprimé(s)' : action === 'activate' ? 'activé(s)' : 'désactivé(s)'} avec succès`);
            } catch (e) {
              console.error('bulk action', e);
              Alert.alert('Erreur', "Impossible d'exécuter l'action");
            } finally {
              setLoading(false);
            }
          },
        }
      ]
    );
  };

  const renderProduct = ({ item: product }: { item: Product }) => {
    const isSelected = selectedProducts.includes(product.id);
    const imageUri = Array.isArray((product as any).images) && (product as any).images[0]
      ? (product as any).images[0]
      : 'https://picsum.photos/200?product';
    const isActive = !!(product as any).is_active;
    
    return (
      <View key={product.id} style={styles.productCard}>
        <TouchableOpacity 
          style={styles.selectionCheckbox}
          onPress={() => toggleProductSelection(product.id)}
        >
          <View style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected
          ]}>
            {isSelected && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
          </View>
        </TouchableOpacity>
        
        <Image source={{ uri: imageUri }} style={styles.productImage} />
        
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>{(product.price ?? 0).toLocaleString()} F</Text>
          <View style={styles.stockRow}>
            <Text style={[
              styles.stockText,
              { color: product.stock > 0 ? COLORS.success : COLORS.danger }
            ]}>
              {product.stock > 0 ? `${product.stock} en stock` : 'Rupture'}
            </Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: isActive ? COLORS.success + '20' : COLORS.textMuted + '20' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: isActive ? COLORS.success : COLORS.textMuted }
              ]}>
                {isActive ? 'Actif' : 'Inactif'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const filteredProducts = useMemo(() => {
    return (products || []).filter((p) =>
      String(p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{collectionInfo?.name || 'Collection'}</Text>
          <Text style={styles.headerSubtitle}>{collectionInfo?.productCount ?? 0} produits</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="filter-outline" size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un produit..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Bulk Actions */}
      {selectedProducts.length > 0 && (
        <View style={styles.bulkActions}>
          <Text style={styles.selectedCount}>
            {selectedProducts.length} produit(s) sélectionné(s)
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.activateButton]}
              onPress={() => handleBulkAction('activate')}
            >
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
              <Text style={styles.actionButtonText}>Activer</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.deactivateButton]}
              onPress={() => handleBulkAction('deactivate')}
            >
              <Ionicons name="pause" size={16} color={COLORS.white} />
              <Text style={styles.actionButtonText}>Désactiver</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleBulkAction('delete')}
            >
              <Ionicons name="trash" size={16} color={COLORS.white} />
              <Text style={styles.actionButtonText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Products List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.productsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucun produit</Text>
              <Text style={styles.emptyText}>Cette collection ne contient aucun produit.</Text>
            </View>
          }
        />
      )}
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
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.accent + '10',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
  },
  selectedCount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.accent,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  activateButton: {
    backgroundColor: COLORS.success,
  },
  deactivateButton: {
    backgroundColor: COLORS.textMuted,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
  },
  actionButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    color: COLORS.white,
  },
  productsList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  selectionCheckbox: {
    marginRight: SPACING.md,
    paddingTop: SPACING.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    marginRight: SPACING.md,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  productPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.accent2,
    marginBottom: SPACING.sm,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stockText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
});

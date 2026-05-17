import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { productService } from '../services/productService';
import { stockMovementService, StockMovement } from '../services/stockMovementService';
import { lowStockAlertService } from '../services/lowStockAlertService';
import { errorHandler } from '../utils/errorHandler';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

type FilterType = 'all' | 'restock' | 'sale' | 'loss' | 'theft' | 'manual';

export const SellerStockHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { spacing, fontSize } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  
  // Adjustment Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'restock' | 'loss' | 'theft' | 'manual'>('restock');
  const [quantityChanged, setQuantityChanged] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadStoreData();
  }, [user?.id]);

  useEffect(() => {
    if (route.params?.productId) {
      setSelectedProductId(route.params.productId);
    }
    if (route.params?.openRestockModal) {
      setAdjustmentType('restock');
      setAdjustmentModalVisible(true);
    }
  }, [route.params?.productId, route.params?.openRestockModal]);


  const loadStoreData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const store = await storeService.getByUser(user.id);
      if (store?.id) {
        setStoreId(store.id);
        
        // Load products for dropdown
        const pList = await productService.getByStoreAll(store.id);
        setProducts(pList || []);

        // Load movements
        const moveData = await stockMovementService.getByStore(store.id);
        setMovements(moveData);
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'Error loading stock history');
      Alert.alert('Erreur', 'Impossible de charger l\'historique');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!selectedProductId) {
      Alert.alert('Erreur', 'Veuillez choisir un produit');
      return;
    }

    const qty = parseInt(quantityChanged);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité valide supérieure à 0');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    setSaving(true);
    try {
      const currentStock = product.stock || 0;
      let finalQtyChanged = qty;
      let newStock = currentStock;

      if (['loss', 'theft'].includes(adjustmentType)) {
        finalQtyChanged = -qty;
        newStock = Math.max(0, currentStock - qty);
      } else if (adjustmentType === 'manual') {
        // Manual adjustment can be negative or positive depending on reasoning, let's prompt or handle
        // Let's assume negative if they specify loss, positive otherwise or we can just ask
        finalQtyChanged = qty; // For default manual we add, or we can configure it
        newStock = currentStock + qty;
      } else {
        // restock
        finalQtyChanged = qty;
        newStock = currentStock + qty;
      }

      await stockMovementService.create({
        product_id: selectedProductId,
        quantity_changed: finalQtyChanged,
        previous_stock: currentStock,
        new_stock: newStock,
        type: adjustmentType,
        reason: reason || undefined,
        notes: notes || undefined,
        created_by: user?.id,
      });

      // Reset low stock alert flag when product is restocked
      if (adjustmentType === 'restock') {
        try {
          await lowStockAlertService.resetAlertFlag(selectedProductId);
        } catch (alertErr) {
          console.warn('Failed to reset low stock alert flag:', alertErr);
        }
      }

      Alert.alert('Succès', 'Ajustement de stock enregistré');
      setAdjustmentModalVisible(false);
      
      // Reset form
      setSelectedProductId('');
      setAdjustmentType('restock');
      setQuantityChanged('');
      setReason('');
      setNotes('');

      // Reload
      await loadStoreData();
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'Error saving stock adjustment');
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'ajustement');
    } finally {
      setSaving(false);
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'restock': return 'Réapprovisionnement';
      case 'sale': return 'Vente';
      case 'loss': return 'Perte';
      case 'theft': return 'Vol';
      case 'return': return 'Retour';
      case 'manual': return 'Ajustement Manuel';
      default: return type;
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'restock': return COLORS.success;
      case 'sale': return COLORS.primary;
      case 'loss': return COLORS.danger;
      case 'theft': return COLORS.danger;
      case 'return': return COLORS.warning;
      case 'manual': return COLORS.accent;
      default: return COLORS.textMuted;
    }
  };

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case 'restock': return 'add-circle-outline';
      case 'sale': return 'cart-outline';
      case 'loss': return 'trash-outline';
      case 'theft': return 'alert-circle-outline';
      case 'return': return 'refresh-outline';
      case 'manual': return 'construct-outline';
      default: return 'help-circle-outline';
    }
  };

  const filteredMovements = movements.filter(m => {
    if (selectedFilter === 'all') return true;
    return m.type === selectedFilter;
  });

  const getStats = () => {
    let added = 0;
    let sold = 0;
    let losses = 0;

    movements.forEach(m => {
      if (m.quantity_changed > 0) {
        added += m.quantity_changed;
      } else {
        if (m.type === 'sale') {
          sold += Math.abs(m.quantity_changed);
        } else if (['loss', 'theft'].includes(m.type)) {
          losses += Math.abs(m.quantity_changed);
        }
      }
    });

    return { added, sold, losses };
  };

  const renderMovementItem = useCallback(({ item }: { item: StockMovement }) => {
    const typeColor = getMovementTypeColor(item.type);
    const iconName = getMovementTypeIcon(item.type);
    const formattedDate = item.created_at 
      ? new Date(item.created_at).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Date inconnue';

    return (
      <Card style={styles.movementItem}>
        <View style={styles.itemHeader}>
          <View style={styles.typeBadgeContainer}>
            <View style={[styles.iconBadge, { backgroundColor: typeColor + '20' }]}>
              <Ionicons name={iconName as any} size={16} color={typeColor} />
            </View>
            <View>
              <Text style={styles.productName}>{item.products?.name || 'Produit inconnu'}</Text>
              <Text style={styles.timeText}>{formattedDate}</Text>
            </View>
          </View>
          <Text style={[styles.qtyText, { color: item.quantity_changed > 0 ? COLORS.success : COLORS.danger }]}>
            {item.quantity_changed > 0 ? `+${item.quantity_changed}` : item.quantity_changed}
          </Text>
        </View>

        <View style={styles.itemDetails}>
          <Text style={styles.detailText}>
            Stock: <Text style={{ fontWeight: '600' }}>{item.previous_stock}</Text> → <Text style={{ fontWeight: '600' }}>{item.new_stock}</Text>
          </Text>
          {item.reason && (
            <Text style={styles.detailText}>
              Raison: <Text style={{ fontStyle: 'italic' }}>{item.reason}</Text>
            </Text>
          )}
          {item.notes && (
            <Text style={styles.detailText}>
              Notes: <Text style={{ color: COLORS.textMuted }}>{item.notes}</Text>
            </Text>
          )}
        </View>
      </Card>
    );
  }, []);

  const stats = getStats();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={[COLORS.accent, COLORS.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Audit & Mouvements de Stock</Text>
            <Text style={styles.headerSubtitle}>Suivi et traçabilité en temps réel</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Chargement de l'historique...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Quick Stats Grid */}
          <View style={styles.statsContainer}>
            <Card style={[styles.statCard, { borderLeftColor: COLORS.success, borderLeftWidth: 4 }]}>
              <Text style={styles.statLabel}>Ajoutés (+)</Text>
              <Text style={[styles.statValue, { color: COLORS.success }]}>+{stats.added}</Text>
            </Card>
            <Card style={[styles.statCard, { borderLeftColor: COLORS.primary, borderLeftWidth: 4 }]}>
              <Text style={styles.statLabel}>Vendus (-)</Text>
              <Text style={[styles.statValue, { color: COLORS.primary }]}>-{stats.sold}</Text>
            </Card>
            <Card style={[styles.statCard, { borderLeftColor: COLORS.danger, borderLeftWidth: 4 }]}>
              <Text style={styles.statLabel}>Pertes/Vols</Text>
              <Text style={[styles.statValue, { color: COLORS.danger }]}>-{stats.losses}</Text>
            </Card>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setAdjustmentModalVisible(true)}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Enregistrer une perte, vol ou réassort</Text>
          </TouchableOpacity>

          {/* Filters Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
            {(['all', 'restock', 'sale', 'loss', 'theft', 'manual'] as FilterType[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  selectedFilter === filter && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilter === filter && styles.filterChipTextActive,
                  ]}
                >
                  {filter === 'all' ? 'Tout' : getMovementTypeLabel(filter)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* History List */}
          <FlatList
            data={filteredMovements}
            keyExtractor={(item) => item.id || ''}
            contentContainerStyle={styles.listContent}
            renderItem={renderMovementItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== 'web'}
            updateCellsBatchingPeriod={50}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="journal-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>Aucun mouvement de stock enregistré</Text>
              </View>
            }
          />
        </View>
      )}

      {/* Save Adjustment Modal */}
      <Modal
        visible={adjustmentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAdjustmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajustement Manuel de Stock</Text>
              <TouchableOpacity onPress={() => setAdjustmentModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              {/* Product Selector */}
              <Text style={styles.inputLabel}>Produit *</Text>
              <View style={styles.pickerContainer}>
                {products.length === 0 ? (
                  <Text style={{ color: COLORS.danger }}>Aucun produit disponible</Text>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    style={styles.selectWeb}
                  >
                    <option value="">Sélectionner un produit</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                    ))}
                  </select>
                )}
              </View>

              {/* Adjustment Type Selector */}
              <Text style={styles.inputLabel}>Type d'ajustement</Text>
              <View style={styles.typeSelectorRow}>
                {([
                  { key: 'restock', label: 'Réappro', color: COLORS.success },
                  { key: 'loss', label: 'Perte', color: COLORS.danger },
                  { key: 'theft', label: 'Vol', color: COLORS.danger },
                  { key: 'manual', label: 'Ajustement', color: COLORS.accent },
                ] as const).map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      styles.typeOption,
                      adjustmentType === t.key && { borderColor: t.color, backgroundColor: t.color + '15' }
                    ]}
                    onPress={() => setAdjustmentType(t.key)}
                  >
                    <Text style={[styles.typeOptionText, adjustmentType === t.key && { color: t.color, fontWeight: '700' }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quantity */}
              <Text style={styles.inputLabel}>Quantité *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: 5"
                keyboardType="numeric"
                value={quantityChanged}
                onChangeText={setQuantityChanged}
              />

              {/* Reason */}
              <Text style={styles.inputLabel}>Raison / Motif (Optionnel)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: Réassort hebdomadaire, Casse, Inventaire..."
                value={reason}
                onChangeText={setReason}
              />

              {/* Notes */}
              <Text style={styles.inputLabel}>Notes Additionnelles (Optionnel)</Text>
              <TextInput
                style={[styles.textInput, { height: 80 }]}
                placeholder="Détails supplémentaires..."
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />

              <Button
                title={saving ? 'Enregistrement...' : 'Valider l\'ajustement'}
                onPress={handleSaveAdjustment}
                disabled={saving}
                style={{ marginTop: SPACING.lg }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
  },
  headerGradient: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    opacity: 0.8,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  filtersContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    maxHeight: 60,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.card,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterChipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  movementItem: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  timeText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  qtyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
  itemDetails: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 4,
  },
  detailText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSoft,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    maxHeight: '85%',
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalForm: {
    padding: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSoft,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.sm,
  },
  selectWeb: {
    width: '100%',
    height: 40,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: COLORS.text,
    fontSize: 14,
    outlineStyle: 'none',
  } as any,
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  typeOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  typeOptionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSoft,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 40,
    backgroundColor: COLORS.card,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
});

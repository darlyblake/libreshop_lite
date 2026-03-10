import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { productService, Product, restockService } from '../lib/supabase';
import { Button } from '../components/Button';
import { DatePickerInput } from '../components/DatePickerInput';

type RouteParams = {
  productId: string;
};

type RestockHistory = {
  id: string;
  product_id: string;
  quantity_added: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  restock_date?: string;
  notes?: string;
  created_at: string;
};

export const SellerRestockScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { productId } = (route.params as RouteParams) || {};

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quantityToAdd, setQuantityToAdd] = useState('');
  const [restockReason, setRestockReason] = useState('');
  const [restockDate, setRestockDate] = useState('');
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<RestockHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load product and history on mount
  useEffect(() => {
    const loadData = async () => {
      if (!productId) {
        Alert.alert('Erreur', 'Produit non trouvé');
        navigation.goBack();
        return;
      }
      try {
        const pData = await productService.getById(productId);
        setProduct(pData);

        // Load restock history
        const items = await restockService.getByProduct(productId);
        setHistory(items || []);
      } catch (e) {
        console.error('Load restock data:', e);
        Alert.alert('Erreur', 'Impossible de charger les données');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [productId, navigation]);

  const handleSaveRestock = async () => {
    if (!product) return;

    if (!quantityToAdd || parseFloat(quantityToAdd) <= 0) {
      Alert.alert('Erreur', 'Quantité requise');
      return;
    }

    setSaving(true);
    try {
      const quantity = parseFloat(quantityToAdd);
      const previousStock = product.stock || 0;
      const newStock = previousStock + quantity;

      // Save restock record to database
      await restockService.create({
        product_id: productId,
        quantity_added: quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: restockReason || undefined,
        restock_date: restockDate || undefined,
        notes: notes || undefined,
      });

      // Update product stock
      await productService.update(productId, {
        stock: newStock,
      } as any);

      // Reload history
      const items = await restockService.getByProduct(productId);
      setHistory(items || []);

      // Reset form
      setQuantityToAdd('');
      setRestockReason('');
      setRestockDate('');
      setNotes('');

      // Refresh product
      const updated = await productService.getById(productId);
      setProduct(updated);

      Alert.alert('Succès', 'Réapprovisionnement enregistré');
    } catch (e) {
      console.error('Save restock:', e);
      Alert.alert('Erreur', 'Impossible de sauvegarder le réapprovisionnement');
    } finally {
      setSaving(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Confirmer',
      'Êtes-vous sûr de vouloir supprimer tout l\'historique de réapprovisionnement ?',
      [
        { text: 'Annuler', onPress: () => {}, style: 'cancel' },
        {
          text: 'Supprimer',
          onPress: async () => {
            try {
              await restockService.deleteByProduct(productId);
              setHistory([]);
              Alert.alert('Succès', 'Historique supprimé');
            } catch (e) {
              console.error('Clear history:', e);
              Alert.alert('Erreur', 'Impossible de supprimer l\'historique');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Produit introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.accent, COLORS.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Réapprovisionnement</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {product.name}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Current stock */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock actuel</Text>
          <View style={styles.stockCard}>
            <Text style={styles.stockValue}>{product.stock || 0}</Text>
            <Text style={styles.stockLabel}>unités en stock</Text>
          </View>
        </View>

        {/* Restock form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ajouter du stock</Text>

          <TextInput
            style={styles.input}
            placeholder="Quantité à ajouter"
            keyboardType="numeric"
            placeholderTextColor={COLORS.textLight}
            value={quantityToAdd}
            onChangeText={setQuantityToAdd}
          />

          <TextInput
            style={[styles.input, { marginTop: SPACING.md }]}
            placeholder="Raison du réapprovisionnement (optionnel)"
            placeholderTextColor={COLORS.textLight}
            value={restockReason}
            onChangeText={setRestockReason}
          />

          <View style={{ marginTop: SPACING.md }}>
            <DatePickerInput
              label="Date de réception (optionnel)"
              value={restockDate}
              onChange={setRestockDate}
              placeholder="Sélectionner une date"
            />
          </View>

          <TextInput
            style={[styles.input, { marginTop: SPACING.md, height: 80 }]}
            placeholder="Notes (optionnel)"
            placeholderTextColor={COLORS.textLight}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />

          <Button
            title={saving ? 'Enregistrement...' : 'Enregistrer le réapprovisionnement'}
            onPress={handleSaveRestock}
            disabled={saving || !quantityToAdd}
            style={{ marginTop: SPACING.lg }}
          />
        </View>

        {/* History section */}
        {history.length > 0 && (
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>Historique</Text>
              <TouchableOpacity onPress={() => setShowHistory(!showHistory)}>
                <Ionicons
                  name={showHistory ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color={COLORS.accent}
                />
              </TouchableOpacity>
            </View>

            {showHistory && (
              <>
                <FlatList
                  data={history}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View style={styles.historyItem}>
                      <View style={styles.historyRow}>
                        <View style={styles.historyLeft}>
                          <Text style={styles.historyQuantity}>+{item.quantity_added}</Text>
                          <Text style={styles.historyDate}>
                            {formatDateForDisplay(item.restock_date || item.created_at)}
                          </Text>
                        </View>
                        <View style={styles.historyRight}>
                          <Text style={styles.historyStock}>
                            {item.previous_stock} → {item.new_stock}
                          </Text>
                          {item.reason && (
                            <Text style={styles.historyReason}>{item.reason}</Text>
                          )}
                        </View>
                      </View>
                      {item.notes && (
                        <Text style={styles.historyNotes}>{item.notes}</Text>
                      )}
                    </View>
                  )}
                />

                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearHistory}
                >
                  <Ionicons name="trash" size={18} color={COLORS.white} />
                  <Text style={styles.clearButtonText}>Effacer l'historique</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.error,
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
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
    opacity: 0.8,
    marginTop: 4,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  stockCard: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  stockValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.white,
  },
  stockLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
    marginTop: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  historyItem: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyLeft: {
    flex: 0.4,
  },
  historyRight: {
    flex: 0.6,
    alignItems: 'flex-end',
  },
  historyQuantity: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.success,
  },
  historyDate: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  historyStock: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  historyReason: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  historyNotes: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  clearButton: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  clearButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
    marginLeft: SPACING.sm,
  },
});

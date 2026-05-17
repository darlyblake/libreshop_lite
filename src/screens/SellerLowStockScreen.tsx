import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { lowStockAlertService, LowStockProduct } from '../services/lowStockAlertService';
import { storeService } from '../services/storeService';
import { useAuthStore } from '../store';
import { errorHandler } from '../utils/errorHandler';

export const SellerLowStockScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [products, setProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const loadLowStockProducts = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const data = await lowStockAlertService.getLowStockProducts(storeId);
      setProducts(data);
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'Error loading low stock products:');
      Alert.alert('Erreur', 'Impossible de charger les produits avec stock faible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadStore = async () => {
      if (!user?.id) return;
      try {
        const store = await storeService.getByUser(user.id);
        if (store?.id) {
          setStoreId(store.id);
        }
      } catch (e) {
        errorHandler.handleDatabaseError(e, 'Error loading store:');
      }
    };
    loadStore();
  }, [user?.id]);

  useEffect(() => {
    if (storeId) {
      loadLowStockProducts();
    }
  }, [storeId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLowStockProducts();
    setRefreshing(false);
  };

  const renderProduct = ({ item }: { item: LowStockProduct }) => {
    const stockPercentage = (item.current_stock / item.low_stock_threshold) * 100;
    const isCritical = item.current_stock === 0;
    const isVeryLow = item.current_stock <= item.low_stock_threshold / 2;

    return (
      <View style={[
        styles.productCard,
        isCritical && styles.productCardCritical,
        isVeryLow && !isCritical && styles.productCardVeryLow,
      ]}>
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.product_name}
            </Text>
            <Text style={styles.productId}>ID: {item.product_id.slice(0, 8)}</Text>
          </View>
          <View style={[
            styles.stockBadge,
            isCritical && styles.stockBadgeCritical,
            isVeryLow && !isCritical && styles.stockBadgeVeryLow,
          ]}>
            <Text style={[
              styles.stockText,
              isCritical && styles.stockTextCritical,
              isVeryLow && !isCritical && styles.stockTextVeryLow,
            ]}>
              {item.current_stock}
            </Text>
          </View>
        </View>

        <View style={styles.productDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stock actuel:</Text>
            <Text style={styles.detailValue}>{item.current_stock} unités</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Seuil d'alerte:</Text>
            <Text style={styles.detailValue}>{item.low_stock_threshold} unités</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(stockPercentage, 100)}%` },
                  isCritical && styles.progressBarCritical,
                  isVeryLow && !isCritical && styles.progressBarVeryLow,
                ]} 
              />
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.restockButton}
          onPress={() => navigation.navigate('SellerStockHistory', { productId: item.product_id, openRestockModal: true })}
        >
          <Ionicons name="add-circle" size={20} color={COLORS.accent} />
          <Text style={styles.restockButtonText}>Réapprovisionner</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alertes Stock Faible</Text>
      </View>

      {products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
          <Text style={styles.emptyTitle}>Tout va bien !</Text>
          <Text style={styles.emptyDescription}>
            Aucun produit avec stock faible
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <Ionicons name="warning" size={24} color={COLORS.warning} />
            <Text style={styles.summaryText}>
              {products.length} produit{products.length > 1 ? 's' : ''} avec stock faible
            </Text>
          </View>

          <FlatList
            data={products}
            renderItem={renderProduct}
            keyExtractor={(item) => item.product_id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.accent}
              />
            }
          />
        </>
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
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.card,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textMuted,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.warning + '15',
    borderRadius: RADIUS.md,
  },
  summaryText: {
    marginLeft: SPACING.md,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  listContent: {
    padding: SPACING.lg,
  },
  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productCardCritical: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.danger + '10',
  },
  productCardVeryLow: {
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warning + '10',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
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
  productId: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  stockBadge: {
    backgroundColor: COLORS.info + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    minWidth: 50,
    alignItems: 'center',
  },
  stockBadgeCritical: {
    backgroundColor: COLORS.danger + '15',
  },
  stockBadgeVeryLow: {
    backgroundColor: COLORS.warning + '15',
  },
  stockText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.info,
  },
  stockTextCritical: {
    color: COLORS.danger,
  },
  stockTextVeryLow: {
    color: COLORS.warning,
  },
  productDetails: {
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  detailLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  detailValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  progressBarContainer: {
    marginTop: SPACING.sm,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 4,
  },
  progressBarCritical: {
    backgroundColor: COLORS.danger,
  },
  progressBarVeryLow: {
    backgroundColor: COLORS.warning,
  },
  restockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.accent + '15',
    borderRadius: RADIUS.md,
  },
  restockButtonText: {
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.accent,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptyDescription: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});

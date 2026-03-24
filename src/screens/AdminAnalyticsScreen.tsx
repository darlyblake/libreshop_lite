import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { BackToDashboard } from '../components/BackToDashboard';

interface Store {
  id: string;
  name: string;
  visits: number;
  orders: number;
  revenue: number;
  rating: number;
  growth: number;
  topProduct: string;
}

interface Product {
  id: string;
  name: string;
  sold: number;
  revenue: number;
  rating: number;
  growth: number;
  category: string;
  stock: number;
}

export const AdminAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'stores' | 'products'>('stores');
  const [refreshing, setRefreshing] = useState(false);

  // Mock data - Boutiques
  const [topStores] = useState<Store[]>([
    {
      id: '1',
      name: 'Supermarché Central',
      visits: 8540,
      orders: 320,
      revenue: 45600000,
      rating: 4.8,
      growth: 23.5,
      topProduct: 'Riz 5kg',
    },
    {
      id: '2',
      name: 'Boutique Mode Pro',
      visits: 6230,
      orders: 215,
      revenue: 32100000,
      rating: 4.5,
      growth: 18.2,
      topProduct: 'T-shirt blanc',
    },
    {
      id: '3',
      name: 'Électronique Plus',
      visits: 5890,
      orders: 178,
      revenue: 28900000,
      rating: 4.6,
      growth: 15.7,
      topProduct: 'Chargeur USB',
    },
    {
      id: '4',
      name: 'Pharmacie Express',
      visits: 4120,
      orders: 156,
      revenue: 18700000,
      rating: 4.7,
      growth: 12.3,
      topProduct: 'Vitamines C',
    },
    {
      id: '5',
      name: 'Cosmétiques Luxe',
      visits: 3650,
      orders: 98,
      revenue: 15200000,
      rating: 4.4,
      growth: 9.8,
      topProduct: 'Crème visage',
    },
  ]);

  // Mock data - Produits
  const [topProducts] = useState<Product[]>([
    {
      id: 'p1',
      name: 'Riz 5kg',
      sold: 2340,
      revenue: 11700000,
      rating: 4.9,
      growth: 31.2,
      category: 'Alimentation',
      stock: 450,
    },
    {
      id: 'p2',
      name: 'Huile 1L',
      sold: 1920,
      revenue: 5760000,
      rating: 4.7,
      growth: 25.6,
      category: 'Alimentation',
      stock: 320,
    },
    {
      id: 'p3',
      name: 'T-shirt blanc',
      sold: 1650,
      revenue: 13200000,
      rating: 4.6,
      growth: 22.1,
      category: 'Vêtements',
      stock: 180,
    },
    {
      id: 'p4',
      name: 'Chargeur USB',
      sold: 1450,
      revenue: 8700000,
      rating: 4.8,
      growth: 19.8,
      category: 'Électronique',
      stock: 210,
    },
    {
      id: 'p5',
      name: 'Vitamines C',
      sold: 980,
      revenue: 4900000,
      rating: 4.5,
      growth: 16.3,
      category: 'Santé',
      stock: 150,
    },
  ]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    return `${(value / 1000).toFixed(0)}K`;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return COLORS.success;
    if (growth < 0) return COLORS.danger;
    return COLORS.textMuted;
  };

  const totalStoresVisits = useMemo(() => topStores.reduce((sum, s) => sum + s.visits, 0), [topStores]);
  const totalStoresRevenue = useMemo(() => topStores.reduce((sum, s) => sum + s.revenue, 0), [topStores]);
  const totalStoresOrders = useMemo(() => topStores.reduce((sum, s) => sum + s.orders, 0), [topStores]);
  const avgStoresRating = useMemo(() => (topStores.reduce((sum, s) => sum + s.rating, 0) / topStores.length).toFixed(1), [topStores]);

  const totalProductsSold = useMemo(() => topProducts.reduce((sum, p) => sum + p.sold, 0), [topProducts]);
  const totalProductsRevenue = useMemo(() => topProducts.reduce((sum, p) => sum + p.revenue, 0), [topProducts]);
  const avgProductsRating = useMemo(() => (topProducts.reduce((sum, p) => sum + p.rating, 0) / topProducts.length).toFixed(1), [topProducts]);

  const getStoreRankColor = (index: number) => {
    if (index === 0) return COLORS.gold; // Gold
    if (index === 1) return COLORS.silver; // Silver
    if (index === 2) return COLORS.bronze; // Bronze
    return COLORS.border;
  };

  const getProductRankColor = (index: number) => {
    if (index === 0) return COLORS.gold;
    if (index === 1) return COLORS.silver;
    if (index === 2) return COLORS.bronze;
    return COLORS.border;
  };

  const renderStoresTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
        />
      }
    >
      {/* Statistiques globales - Boutiques */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="eye" size={24} color={COLORS.accent} />
          </View>
          <Text style={styles.statValue}>{totalStoresVisits.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Visites totales</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="cash" size={24} color={COLORS.success} />
          </View>
          <Text style={styles.statValue}>{formatCurrency(totalStoresRevenue)}</Text>
          <Text style={styles.statLabel}>Revenus</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="receipt" size={24} color={COLORS.accent2} />
          </View>
          <Text style={styles.statValue}>{totalStoresOrders}</Text>
          <Text style={styles.statLabel}>Commandes</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="star" size={24} color={COLORS.warning} />
          </View>
          <Text style={styles.statValue}>{avgStoresRating}</Text>
          <Text style={styles.statLabel}>Note moyenne</Text>
        </View>
      </View>

      {/* Boutiques les plus visitées */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Boutiques les plus visitées</Text>
        <FlatList
          data={topStores}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.rankingCard, { borderLeftColor: getStoreRankColor(index), borderLeftWidth: 4 }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}
            >
              <View style={styles.rankingHeader}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeName}>{item.name}</Text>
                  <Text style={styles.storeCategory}>{item.topProduct}</Text>
                </View>
                <View style={[styles.growthBadge, { backgroundColor: getGrowthColor(item.growth) + '20' }]}>
                  <Ionicons name="arrow-up" size={14} color={getGrowthColor(item.growth)} />
                  <Text style={[styles.growthText, { color: getGrowthColor(item.growth) }]}>
                    +{item.growth}%
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricSmall}>
                  <Ionicons name="eye-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.metricSmallValue}>{item.visits.toLocaleString()}</Text>
                  <Text style={styles.metricSmallLabel}>visites</Text>
                </View>

                <View style={styles.metricSmall}>
                  <Ionicons name="bag-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.metricSmallValue}>{item.orders}</Text>
                  <Text style={styles.metricSmallLabel}>commandes</Text>
                </View>

                <View style={styles.metricSmall}>
                  <Ionicons name="cash-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.metricSmallValue}>{formatCurrency(item.revenue)}</Text>
                  <Text style={styles.metricSmallLabel}>revenus</Text>
                </View>

                <View style={styles.metricSmall}>
                  <Ionicons name="star" size={14} color={COLORS.warning} />
                  <Text style={styles.metricSmallValue}>{item.rating}</Text>
                  <Text style={styles.metricSmallLabel}>note</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </ScrollView>
  );

  const renderProductsTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
        />
      }
    >
      {/* Statistiques globales - Produits */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="bag" size={24} color={COLORS.accent} />
          </View>
          <Text style={styles.statValue}>{totalProductsSold.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Vendus</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="cash" size={24} color={COLORS.success} />
          </View>
          <Text style={styles.statValue}>{formatCurrency(totalProductsRevenue)}</Text>
          <Text style={styles.statLabel}>Revenus</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="star" size={24} color={COLORS.warning} />
          </View>
          <Text style={styles.statValue}>{avgProductsRating}</Text>
          <Text style={styles.statLabel}>Note moyenne</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="list" size={24} color={COLORS.accent2} />
          </View>
          <Text style={styles.statValue}>{topProducts.length}</Text>
          <Text style={styles.statLabel}>Catégories</Text>
        </View>
      </View>

      {/* Produits les plus vendus */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Produits les plus vendus</Text>
        <FlatList
          data={topProducts}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.rankingCard, { borderLeftColor: getProductRankColor(index), borderLeftWidth: 4 }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
            >
              <View style={styles.rankingHeader}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeName}>{item.name}</Text>
                  <Text style={styles.storeCategory}>{item.category}</Text>
                </View>
                <View style={[styles.growthBadge, { backgroundColor: getGrowthColor(item.growth) + '20' }]}>
                  <Ionicons name="arrow-up" size={14} color={getGrowthColor(item.growth)} />
                  <Text style={[styles.growthText, { color: getGrowthColor(item.growth) }]}>
                    +{item.growth}%
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricSmall}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.metricSmallValue}>{item.sold.toLocaleString()}</Text>
                  <Text style={styles.metricSmallLabel}>vendus</Text>
                </View>

                <View style={styles.metricSmall}>
                  <Ionicons name="cash-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.metricSmallValue}>{formatCurrency(item.revenue)}</Text>
                  <Text style={styles.metricSmallLabel}>revenus</Text>
                </View>

                <View style={styles.metricSmall}>
                  <Ionicons name="star" size={14} color={COLORS.warning} />
                  <Text style={styles.metricSmallValue}>{item.rating}</Text>
                  <Text style={styles.metricSmallLabel}>note</Text>
                </View>

                <View style={styles.metricSmall}>
                  <Ionicons name="layers-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.metricSmallValue}>{item.stock}</Text>
                  <Text style={styles.metricSmallLabel}>stock</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytiques</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stores' && styles.activeTab]}
          onPress={() => setActiveTab('stores')}
        >
          <Ionicons 
            name="storefront" 
            size={20} 
            color={activeTab === 'stores' ? COLORS.accent : COLORS.textMuted} 
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'stores' && styles.activeTabText,
            ]}
          >
            Boutiques
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Ionicons 
            name="bag" 
            size={20} 
            color={activeTab === 'products' ? COLORS.accent : COLORS.textMuted} 
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'products' && styles.activeTabText,
            ]}
          >
            Produits
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'stores' ? renderStoresTab() : renderProductsTab()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  activeTabText: {
    color: COLORS.accent,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  rankingCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.accent,
  },
  storeName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  storeCategory: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  growthText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  metricSmall: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricSmallValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  metricSmallLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

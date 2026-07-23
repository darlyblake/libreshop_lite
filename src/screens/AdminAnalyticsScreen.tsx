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
import { telemetryService, TelemetryData } from '../services/telemetryService';
import { adminService } from '../services/adminService';
import { supabase } from '../lib/supabase';

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
  const [activeTab, setActiveTab] = useState<'stores' | 'products' | 'telemetry'>('stores');
  const [refreshing, setRefreshing] = useState(false);
  const [telemetryData, setTelemetryData] = useState<TelemetryData>({ crashes: [], pages: [], devices: [] });

  // Data states
  const [topStores, setTopStores] = useState<Store[]>([]);
  const [topProducts, setTopProducts] = useState<Product[]>([]);

  React.useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      // 1. Télémétrie
      const tData = await telemetryService.getAggregatedTelemetry();
      setTelemetryData(tData);

      // 2. Boutiques via adminService
      const storesData = await adminService.getStoresWithDetails();
      const mappedStores = storesData.map(s => ({
        id: s.id,
        name: s.name,
        visits: s.visits || 0,
        orders: s.orders || 0,
        revenue: s.revenue || 0,
        rating: s.rating || 0,
        growth: 0,
        topProduct: '-'
      })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
      setTopStores(mappedStores);

      // 3. Produits via requêtes Supabase
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - 30);

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, quantity, price, products(name, category, stock)')
        .gte('created_at', dateLimit.toISOString());

      if (orderItems) {
        const pMap: Record<string, any> = {};
        for (const item of orderItems) {
          const pid = item.product_id;
          if (!pid || !item.products) continue;
          if (!pMap[pid]) {
            const p = Array.isArray(item.products) ? item.products[0] : item.products;
            pMap[pid] = {
              id: pid,
              name: p?.name || 'Inconnu',
              sold: 0,
              revenue: 0,
              rating: 0,
              growth: 0,
              category: p?.category || 'Général',
              stock: p?.stock || 0
            };
          }
          pMap[pid].sold += (item.quantity || 0);
          pMap[pid].revenue += (item.quantity || 0) * (item.price || 0);
        }
        const mappedProducts = Object.values(pMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);
        setTopProducts(mappedProducts as Product[]);
      }

    } catch (e) {
      console.warn('Error loading analytics', e);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics().finally(() => {
      setTimeout(() => {
        setRefreshing(false);
      }, 500);
    });
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

  const renderTelemetryTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      {/* Parcours et Appareils */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Appareils Utilisés</Text>
        <View style={styles.telemetryCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md }}>
            {telemetryData.devices.map(device => (
              <View key={device.os} style={{ alignItems: 'center', flex: 1 }}>
                <Ionicons name={device.icon as any} size={32} color={device.color} style={{ marginBottom: 4 }} />
                <Text style={{ fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text }}>{device.percentage}%</Text>
                <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>{device.os}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Pages les plus visitées</Text>
        <View style={styles.telemetryCard}>
          {telemetryData.pages.map((page, index) => (
            <View key={page.id} style={[styles.pageRow, index !== telemetryData.pages.length - 1 && styles.borderBottom]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pagePath}>{page.path}</Text>
                <Text style={styles.pageTime}>Temps moyen : {page.avgTime}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pageViews}>{page.views.toLocaleString()}</Text>
                <Text style={styles.pageTime}>Vues</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Rapports de Crashs & Erreurs</Text>
        {telemetryData.crashes.map(crash => (
          <View key={crash.id} style={styles.crashCard}>
            <View style={styles.crashHeader}>
              <View style={styles.crashBadge}>
                <Ionicons name="warning-outline" size={16} color={COLORS.danger} />
                <Text style={styles.crashBadgeText}>{crash.count} occurences</Text>
              </View>
              <Text style={styles.crashTime}>{crash.time}</Text>
            </View>
            <Text style={styles.crashError} numberOfLines={2}>{crash.error}</Text>
            <View style={styles.crashFooter}>
              <View style={styles.crashDeviceBadge}>
                <Ionicons name={crash.os.includes('iOS') ? 'logo-apple' : crash.os.includes('Android') ? 'logo-android' : 'globe-outline'} size={12} color={COLORS.textMuted} />
                <Text style={styles.crashDeviceText}>{crash.device} • {crash.os}</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.crashAction}>Analyser</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
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

        <TouchableOpacity
          style={[styles.tab, activeTab === 'telemetry' && styles.activeTab]}
          onPress={() => setActiveTab('telemetry')}
        >
          <Ionicons 
            name="analytics-outline" 
            size={20} 
            color={activeTab === 'telemetry' ? COLORS.accent : COLORS.textMuted} 
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'telemetry' && styles.activeTabText,
            ]}
          >
            Télémétrie
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'stores' ? renderStoresTab() : activeTab === 'products' ? renderProductsTab() : renderTelemetryTab()}
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
  telemetryCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pagePath: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  pageTime: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  pageViews: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.accent,
  },
  crashCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.danger + '40',
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  crashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  crashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  crashBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.danger,
  },
  crashTime: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  crashError: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontFamily: 'monospace',
    backgroundColor: COLORS.bg,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  crashFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crashDeviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crashDeviceText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  crashAction: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.accent,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSupabase } from '../../lib/supabase';
import { useAuthStore } from '../../store';
import { storeService } from '../../services/storeService';

// ─── Types locaux ──────────────────────────────────────────────────────────────
type Period = 'today' | 'week' | 'month' | 'year';

type OrderItemRaw = {
  quantity: number;
  price: number;
  products?: { name: string; cost_price?: number | null };
};

type OrderRaw = {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items?: OrderItemRaw[];
};

type TopItemStat = {
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
};

type ProfitData = {
  revenue: number;        // CA = somme total_amount des commandes payées
  cost: number;           // Coût total = Σ(cost_price × qty)
  profit: number;         // Bénéfice net
  margin: number;         // Marge %
  orderCount: number;
  hasCostData: boolean;   // true si au moins un produit a un cost_price renseigné
  topItems: TopItemStat[];
  dailyRevenue: { date: string; revenue: number; profit: number }[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' FCFA';
const fmtPct = (n: number) => (isFinite(n) ? n.toFixed(1) + '%' : '—');

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;
  switch (period) {
    case 'today':
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      break;
    case 'week':
      from = new Date(now);
      from.setDate(now.getDate() - 7);
      break;
    case 'month':
      from = new Date(now);
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return { from: from!.toISOString(), to };
}

function computeProfit(orders: OrderRaw[]): ProfitData {
  let revenue = 0;
  let cost = 0;
  let hasCostData = false;
  const itemMap: Record<string, TopItemStat> = {};
  const dailyMap: Record<string, { revenue: number; profit: number }> = {};

  for (const order of orders) {
    const statusOk = ['delivered', 'paid', 'completed'].includes(order.status);
    if (!statusOk) continue;

    revenue += order.total_amount ?? 0;
    const day = order.created_at.slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { revenue: 0, profit: 0 };
    dailyMap[day].revenue += order.total_amount ?? 0;

    for (const item of order.order_items ?? []) {
      const qty = item.quantity ?? 1;
      const price = item.price ?? 0;
      const costPrice = item.products?.cost_price ?? null;
      const name = item.products?.name ?? 'Plat inconnu';
      const itemRevenue = price * qty;
      const itemCost = costPrice !== null ? costPrice * qty : 0;

      if (costPrice !== null) hasCostData = true;
      cost += itemCost;
      const itemProfit = costPrice !== null ? itemRevenue - itemCost : itemRevenue;
      dailyMap[day].profit += itemProfit;

      if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0, cost: 0, profit: 0 };
      itemMap[name].qty += qty;
      itemMap[name].revenue += itemRevenue;
      itemMap[name].cost += itemCost;
      itemMap[name].profit += itemProfit;
    }
  }

  const profit = hasCostData ? revenue - cost : revenue;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const topItems = Object.values(itemMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const dailyRevenue = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, ...d }));

  return { revenue, cost, profit, margin, orderCount: orders.length, hasCostData, topItems, dailyRevenue };
}

// ─── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  type: 'restaurant' | 'bar';
};

const THEMES = {
  restaurant: {
    gradient: ['#FF6B35', '#FF8C42'] as const,
    accent: '#FF6B35',
    light: '#FFF3ED',
    emoji: '🍽️',
    label: 'Restaurant',
  },
  bar: {
    gradient: ['#6C3483', '#8E44AD'] as const,
    accent: '#7C3AED',
    light: '#F5F0FF',
    emoji: '🍸',
    label: 'Bar',
  },
};

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: "Auj." },
  { id: 'week', label: '7 jours' },
  { id: 'month', label: 'Ce mois' },
  { id: 'year', label: 'Cette année' },
];

// ─── Composant ─────────────────────────────────────────────────────────────────
export const MenuProfitScreen: React.FC<Props> = ({ type }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const theme = THEMES[type];
  const client = useSupabase();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState(theme.label);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ProfitData | null>(null);

  // ─── Init boutique ────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;
      try {
        const store = await storeService.getByUser(user.id);
        if (!store?.id) return;
        setStoreId(store.id);
        setStoreName(store.name ?? theme.label);
      } catch (e) {
        console.warn('MenuProfitScreen init error', e);
      }
    };
    init();
  }, [user?.id]);

  // ─── Chargement des données ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { from, to } = getDateRange(period);
      const { data: orders, error } = await client
        .from('orders')
        .select(`
          id, total_amount, status, created_at,
          order_items(
            quantity, price,
            products(name, cost_price)
          )
        `)
        .eq('store_id', storeId)
        .gte('created_at', from)
        .lte('created_at', to)
        .in('status', ['delivered', 'paid', 'completed']);

      if (error) throw error;
      setData(computeProfit((orders as unknown as OrderRaw[]) ?? []));
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de charger les données.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId, period]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ─── Mini bar chart ───────────────────────────────────────────────────────
  const maxRevenue = data?.dailyRevenue.reduce((m, d) => Math.max(m, d.revenue), 1) ?? 1;

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f7f7' }}>
      {/* Header */}
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{theme.emoji} Bénéfices & Revenus</Text>
          <Text style={styles.headerSub}>{storeName}</Text>
        </View>
      </LinearGradient>

      {/* Sélecteur de période */}
      <View style={styles.periodBar}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[styles.periodChip, period === p.id && { backgroundColor: theme.accent }]}
            onPress={() => setPeriod(p.id)}
          >
            <Text style={[styles.periodChipText, period === p.id && { color: '#fff' }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Calcul en cours...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.accent]} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── KPI Cards ─── */}
          {data && (
            <>
              {/* Avertissement si pas de coût renseigné */}
              {!data.hasCostData && (
                <View style={[styles.warnBox, { backgroundColor: theme.light, borderColor: theme.accent + '40' }]}>
                  <Ionicons name="information-circle" size={18} color={theme.accent} />
                  <Text style={[styles.warnText, { color: theme.accent }]}>
                    Renseigne le <Text style={{ fontWeight: '800' }}>prix de revient</Text> de tes plats pour voir le bénéfice réel. Pour l'instant on affiche le chiffre d'affaires brut.
                  </Text>
                </View>
              )}

              {/* Ligne 1 : CA + Bénéfice */}
              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, styles.kpiCardLarge, { borderLeftColor: theme.accent }]}>
                  <View style={styles.kpiIcon}>
                    <Ionicons name="cash-outline" size={22} color={theme.accent} />
                  </View>
                  <Text style={styles.kpiLabel}>Chiffre d'affaires</Text>
                  <Text style={[styles.kpiValue, { color: theme.accent }]}>{fmt(data.revenue)}</Text>
                  <Text style={styles.kpiSub}>{data.orderCount} commande{data.orderCount !== 1 ? 's' : ''}</Text>
                </View>

                <View style={[styles.kpiCard, styles.kpiCardLarge, {
                  borderLeftColor: data.profit >= 0 ? '#22c55e' : '#ef4444'
                }]}>
                  <View style={styles.kpiIcon}>
                    <Ionicons name="trending-up" size={22} color={data.profit >= 0 ? '#22c55e' : '#ef4444'} />
                  </View>
                  <Text style={styles.kpiLabel}>
                    {data.hasCostData ? 'Bénéfice net' : 'Revenus bruts'}
                  </Text>
                  <Text style={[styles.kpiValue, { color: data.profit >= 0 ? '#22c55e' : '#ef4444' }]}>
                    {fmt(data.profit)}
                  </Text>
                  <Text style={styles.kpiSub}>
                    Marge : {fmtPct(data.margin)}
                  </Text>
                </View>
              </View>

              {/* Ligne 2 : Coût + Marge */}
              {data.hasCostData && (
                <View style={styles.kpiRow}>
                  <View style={[styles.kpiCard, { borderLeftColor: '#f97316', flex: 1 }]}>
                    <Ionicons name="cart-outline" size={18} color="#f97316" />
                    <Text style={styles.kpiLabel}>Coût total matières</Text>
                    <Text style={[styles.kpiValue, { color: '#f97316', fontSize: 18 }]}>{fmt(data.cost)}</Text>
                  </View>
                  <View style={[styles.kpiCard, { borderLeftColor: '#3b82f6', flex: 1 }]}>
                    <Ionicons name="pie-chart-outline" size={18} color="#3b82f6" />
                    <Text style={styles.kpiLabel}>Marge bénéficiaire</Text>
                    <Text style={[styles.kpiValue, { color: '#3b82f6', fontSize: 18 }]}>{fmtPct(data.margin)}</Text>
                  </View>
                </View>
              )}

              {/* ─── Mini graphique journalier ─── */}
              {data.dailyRevenue.length > 1 && (
                <View style={styles.chartCard}>
                  <Text style={styles.sectionTitle}>📈 Évolution du CA</Text>
                  <View style={styles.barChart}>
                    {data.dailyRevenue.slice(-14).map((d, i) => {
                      const h = Math.max(4, (d.revenue / maxRevenue) * 80);
                      const dateLabel = d.date.slice(5); // MM-DD
                      return (
                        <View key={i} style={styles.barCol}>
                          <View style={[styles.bar, { height: h, backgroundColor: theme.accent }]} />
                          <Text style={styles.barLabel}>{dateLabel.replace('-', '/')}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ─── Top plats par CA ─── */}
              {data.topItems.length > 0 && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>🏆 Top plats vendus</Text>
                  {data.topItems.map((item, i) => (
                    <View key={i} style={styles.topItem}>
                      <View style={[styles.topRank, { backgroundColor: i < 3 ? theme.accent : '#eee' }]}>
                        <Text style={[styles.topRankText, { color: i < 3 ? '#fff' : '#888' }]}>
                          {i + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.topItemSub}>
                          {item.qty} vendu{item.qty !== 1 ? 's' : ''}
                          {data.hasCostData && item.cost > 0
                            ? `  ·  Marge : ${fmtPct(item.revenue > 0 ? ((item.profit / item.revenue) * 100) : 0)}`
                            : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.topItemRevenue, { color: theme.accent }]}>
                          {fmt(item.revenue)}
                        </Text>
                        {data.hasCostData && item.cost > 0 && (
                          <Text style={[styles.topItemProfit, { color: item.profit >= 0 ? '#22c55e' : '#ef4444' }]}>
                            +{fmt(item.profit)}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ─── Message si aucune commande ─── */}
              {data.orderCount === 0 && (
                <View style={styles.emptyBox}>
                  <Text style={{ fontSize: 48 }}>{theme.emoji}</Text>
                  <Text style={styles.emptyTitle}>Aucune commande sur cette période</Text>
                  <Text style={styles.emptySub}>Les bénéfices s'afficheront ici dès que tu auras des commandes livrées ou payées.</Text>
                </View>
              )}

              {/* ─── Conseil pour mieux calculer ─── */}
              <View style={[styles.tipBox, { borderColor: theme.accent + '30', backgroundColor: theme.light }]}>
                <Text style={[styles.tipTitle, { color: theme.accent }]}>💡 Comment améliorer le calcul ?</Text>
                <Text style={styles.tipText}>
                  Pour chaque plat de ta carte, renseigne le <Text style={{ fontWeight: '700' }}>prix de revient</Text> (coût des ingrédients). Ça te permettra de voir le bénéfice exact par plat et ta marge réelle.
                </Text>
                <Text style={styles.tipText}>
                  Va dans <Text style={{ fontWeight: '700' }}>Carte → modifier un plat → Prix de revient</Text>.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  periodBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  periodChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  periodChipText: { fontSize: 12, fontWeight: '700', color: '#555' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#888', fontSize: 14 },
  body: { padding: 16, gap: 14, paddingBottom: 80 },
  warnBox: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  warnText: { flex: 1, fontSize: 13, lineHeight: 18 },
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: 4,
  },
  kpiCardLarge: { flex: 1 },
  kpiIcon: { marginBottom: 4 },
  kpiLabel: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase' },
  kpiValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  kpiSub: { fontSize: 12, color: '#aaa', marginTop: 2 },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#222', marginBottom: 14 },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 100,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 8, color: '#aaa', textAlign: 'center' },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  topItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topRank: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  topRankText: { fontSize: 13, fontWeight: '800' },
  topItemName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  topItemSub: { fontSize: 11, color: '#888', marginTop: 1 },
  topItemRevenue: { fontSize: 14, fontWeight: '800' },
  topItemProfit: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#333', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19 },
  tipBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  tipTitle: { fontSize: 14, fontWeight: '800' },
  tipText: { fontSize: 13, color: '#555', lineHeight: 18 },
});

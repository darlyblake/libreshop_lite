import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store';
import { RevenueChart } from '../components/RevenueChart';
import { useTheme } from '../hooks/useTheme';
import { useResponsive } from '../utils/useResponsive';
import { storeService } from '../services/storeService';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { analyticsService, TimelineDataPoint } from '../services/analyticsService';
import { COLORS as THEME_COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { getGeminiStrategicAdvice, answerSellerQuestion, SellerStats, CoachAdvice } from '../services/analyticsCoach';
import { LinearGradient } from 'expo-linear-gradient';
import { errorHandler } from '../utils/errorHandler';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | '3m' | 'thisYear' | 'all';

interface Kpi {
  title: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface TopProduct {
  id: string;
  name: string;
  qty: number;
  revenue: number;
  prevQty: number;
  prevRevenue: number;
  growth: number;
}

interface DeadStockItem {
  id: string;
  name: string;
  stock: number;
  price: number;
}

const formatAmount = (amount: number) => amount.toLocaleString() + ' FCFA';
export const SellerAnalyticsScreen = () => {
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice[]>([]);
  const [coachStats, setCoachStats] = useState<SellerStats | null>(null);
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { width } = useWindowDimensions();
  const { spacing, fontSize, component, isDesktop, isTablet } = useResponsive();
  const { getColor: COLORS } = useTheme();

  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [store, setStore] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  
  const [revenueTimeline, setRevenueTimeline] = useState<TimelineDataPoint[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [productPerformance, setProductPerformance] = useState<TopProduct[]>([]);
  const [deadStock, setDeadStock] = useState<DeadStockItem[]>([]);
  const [loyalty, setLoyalty] = useState<{totalCustomers: number, recurringCustomers: number, loyaltyRate: number} | null>(null);
  const [marketBenchmark, setMarketBenchmark] = useState<{marketAvgBasket: number, marketTopGrowth: number, topMarketProducts: any[]}>({ marketAvgBasket: 0, marketTopGrowth: 0, topMarketProducts: [] });
  const [showMarketView, setShowMarketView] = useState(false);

  const getRangeBounds = useCallback((range: TimeRange) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
      case 'today':
        return { start: startOfToday, end: now, days: 1 };
      case 'yesterday':
        const yesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        const endOfYesterday = new Date(startOfToday.getTime() - 1);
        return { start: yesterday, end: endOfYesterday, days: 1 };
      case '7d':
        return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now, days: 7 };
      case '30d':
        return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now, days: 30 };
      case 'thisMonth':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, days: now.getDate() };
      case 'lastMonth':
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: firstOfLastMonth, end: lastOfLastMonth, days: 30 };
      case '3m':
        return { start: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()), end: now, days: 90 };
      case 'thisYear':
        return { start: new Date(now.getFullYear(), 0, 1), end: now, days: 365 };
      case 'all':
        const startOfHistory = store?.created_at ? new Date(store.created_at) : new Date(2025, 0, 1);
        const daysSinceStart = Math.max(1, Math.ceil((now.getTime() - startOfHistory.getTime()) / (24 * 60 * 60 * 1000)));
        return { start: startOfHistory, end: now, days: daysSinceStart };
      default:
        return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now, days: 7 };
    }
  }, [store]);

  const fetchStore = useCallback(async () => {
    if (!user) return;
    try {
      const s = await storeService.getByUser(user.id);
      if (s) {
        if (!storeService.isSubscriptionActive(s)) {
          Alert.alert(
            'Abonnement expiré',
            `Votre abonnement pour "${s.name}" a expiré. Veuillez le renouveler pour accéder aux analyses.`,
            [
              {
                text: 'Renouveler',
                onPress: () => navigation.replace('SubscriptionExpired'),
              },
            ]
          );
          return;
        }
        setStoreId(s.id);
        setStore(s);
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'SellerAnalytics load store');
    }
  }, [user]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  const loadAnalyticsData = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const { start, days } = getRangeBounds(timeRange);

      const [ordersResponse, timeline, perf, dead, loyal, bench] = await Promise.all([
        orderService.getByStore(storeId),
        analyticsService.getStoreRevenueTimeline(storeId, days),
        analyticsService.getStoreProductPerformance(storeId, days),
        analyticsService.getDeadStock(storeId),
        analyticsService.getLoyaltyStats(storeId),
        analyticsService.getMarketBenchmark(store?.category || 'General')
      ]);

      const orders = ordersResponse.orders || [];
      const ordersCount = ordersResponse.count || orders.length;

      setRevenueTimeline(timeline);
      setProductPerformance(perf);
      setDeadStock(dead.slice(0, 5)); // Limit to first 5 for UI
      setLoyalty(loyal);
      setMarketBenchmark(bench);

      const ordersInRange = orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return Number.isFinite(t) && t >= start.getTime();
      });

      const confirmedStatuses = new Set(['paid', 'shipped', 'delivered']);
      const confirmedOrdersInRange = ordersInRange.filter((o) => confirmedStatuses.has(o.status));
      const totalRevenue = confirmedOrdersInRange.reduce((sum: number, o) => sum + Number(o.total_amount || 0), 0);
      const cancelledOrders = ordersInRange.filter((o) => o.status === 'cancelled').length;
      const deliveredOrders = ordersInRange.filter((o) => o.status === 'delivered').length;

      // --- Préparation des stats pour le Coach IA ---
      const totalRevenueAllTime = orders.filter((o) => confirmedStatuses.has(o.status)).reduce((sum: number, o) => sum + Number(o.total_amount || 0), 0);
      
      // Calculer le revenu des 30 jours précédents pour la tendance
      const thirtyDaysAgo = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);
      const prev30DaysOrders = orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return Number.isFinite(t) && t >= thirtyDaysAgo.getTime() && t < start.getTime() && confirmedStatuses.has(o.status);
      });
      const revenuePrev30 = prev30DaysOrders.reduce((sum: number, o) => sum + Number(o.total_amount || 0), 0);

      const statsForCoach: SellerStats = {
        totalExpenses: 0,
        netProfit: 0,
        totalRevenue: totalRevenueAllTime,
        totalOrders: ordersCount,
        averageBasket: confirmedOrdersInRange.length > 0 ? totalRevenue / confirmedOrdersInRange.length : 0,
        revenueLast30Days: totalRevenue,
        revenuePrevious30Days: revenuePrev30,
        deliveryRate: ordersCount > 0 ? (deliveredOrders / ordersCount) * 100 : 0,
        topProducts: perf.slice(0, 3).map((p: TopProduct) => ({
          name: p.name,
          revenue: p.revenue,
          quantity: p.qty,
          trend: p.growth >= 0 ? 'up' : 'down'
        })),
        deadProducts: dead.map((d: DeadStockItem) => ({
          name: d.name,
          daysWithoutSale: 30, // Heuristique simple
          stock: d.stock
        })),
        loyaltyRate: loyal.loyaltyRate,
        marketAvgBasket: bench.marketAvgBasket
      };

      setCoachStats(statsForCoach);
      
      // Chargement asynchrone des conseils Gemini avec CACHE
      setLoadingAdvice(true);
      getGeminiStrategicAdvice(statsForCoach, storeId, days)
        .then(advice => setCoachAdvice(advice))
        .catch(err => console.error("Coach Advice Error:", err))
        .finally(() => setLoadingAdvice(false));

      const averageOrderValue = confirmedOrdersInRange.length > 0 ? totalRevenue / confirmedOrdersInRange.length : 0;
      const cancelRate = ordersCount > 0 ? (cancelledOrders / ordersCount) * 100 : 0;
      const deliveryRate = ordersCount > 0 ? (deliveredOrders / ordersCount) * 100 : 0;

      setKpis([
        {
          title: 'Revenu Total',
          value: formatAmount(totalRevenue),
          subtitle: `Sur les ${days} derniers jours`,
          icon: 'cash',
          color: COLORS.success,
        },
        {
          title: 'Panier moyen',
          value: formatAmount(Math.round(averageOrderValue)),
          subtitle: `Moyenne par commande`,
          icon: 'pricetag',
          color: COLORS.accent,
        },
        {
          title: 'Fidélité',
          value: `${Math.round(loyal.loyaltyRate)}%`,
          subtitle: `${loyal.recurringCustomers} clients récurrents`,
          icon: 'people',
          color: COLORS.info,
        },
        {
          title: 'Livraison',
          value: `${Math.round(deliveryRate)}%`,
          subtitle: `${deliveredOrders} livrées`,
          icon: 'checkmark-done',
          color: COLORS.success,
        },
      ]);

    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de charger les données analytiques');
      errorHandler.handleDatabaseError(e as any, 'load analytics');
    } finally {
      setLoading(false);
    }
  }, [storeId, store, timeRange, getRangeBounds, COLORS]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  const handleAskCoach = async (question: string) => {
    if (!coachStats) return;
    setIsAnswering(true);
    setCoachResponse(null);
    try {
      const response = await answerSellerQuestion(question, coachStats);
      setCoachResponse(response);
    } catch (e) {
      setCoachResponse("Désolé, je rencontre une petite difficulté technique. Peux-tu reformuler ?");
    } finally {
      setIsAnswering(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      if (productPerformance.length === 0) {
        Alert.alert('Info', 'Aucune donnée à exporter');
        return;
      }

      let csv = 'Produit;Ventes;Revenu (FCFA)\n';
      productPerformance.forEach(p => {
        csv += `${p.name};${p.qty};${p.revenue}\n`;
      });

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `libreshop_perf_${timeRange}_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Mobile fallback if sharing/file-system is needed
        Alert.alert('Info', 'Export CSV disponible uniquement sur Web pour le moment');
      }
    } catch (e) {
      console.error('Export CSV error:', e);
      Alert.alert('Erreur', 'Impossible de générer le fichier CSV');
    }
  };

  const handleExportPDF = async () => {
    try {
      setLoading(true);
      const { start, end } = getRangeBounds(timeRange);
      const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { margin: 20mm; }
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2937; line-height: 1.5; padding: 0; margin: 0; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366F1; padding-bottom: 20px; margin-bottom: 30px; }
              .logo { font-size: 24px; font-weight: 800; color: #6366F1; }
              .report-title { font-size: 18px; color: #4B5563; font-weight: 600; }
              .date-range { font-size: 14px; color: #9CA3AF; margin-top: 5px; }
              
              .kpi-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; }
              .kpi-card { background: #F9FAFB; padding: 15px; border-radius: 10px; border: 1px solid #E5E7EB; }
              .kpi-label { font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
              .kpi-value { font-size: 18px; font-weight: 700; color: #111827; }
              
              .section { margin-bottom: 35px; }
              .section-title { font-size: 16px; font-weight: 700; color: #374151; margin-bottom: 15px; border-left: 4px solid #6366F1; padding-left: 10px; }
              
              .advice-box { background: #EEF2FF; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
              .advice-item { display: flex; gap: 12px; margin-bottom: 12px; font-size: 13px; color: #4338CA; }
              
              table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; }
              th { background: #F3F4F6; text-align: left; padding: 12px; font-size: 12px; font-weight: 600; color: #4B5563; }
              td { padding: 12px; border-bottom: 1px solid #F3F4F6; font-size: 13px; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              
              .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 10px; color: #9CA3AF; }
              .highlight { color: #6366F1; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="logo">LIBRESHOP <span style="font-weight: 300;">ANALYTICS</span></div>
                <div class="date-range">Période : ${fmt.format(start)} — ${fmt.format(end)}</div>
              </div>
              <div style="text-align: right">
                <div class="report-title">Rapport de Performance</div>
                <div style="font-size: 12px; color: #6B7280;">Boutique : ${store?.name || 'Ma Boutique'}</div>
              </div>
            </div>

            <div class="kpi-container">
              ${kpis.map(k => `
                <div class="kpi-card">
                  <div class="kpi-label">${k.title}</div>
                  <div class="kpi-value">${k.value}</div>
                </div>
              `).join('')}
            </div>

            <div class="section">
              <div class="section-title">Analyse Stratégique (IA Coach)</div>
              <div class="advice-box">
                ${coachAdvice.map(a => `
                  <div class="advice-item">
                    <span>◈</span>
                    <span>${a.text}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="section">
              <div class="section-title">Performance des Produits</div>
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th class="text-center">Quantité Vendue</th>
                    <th class="text-right">Chiffre d'Affaires</th>
                    <th class="text-right">Tendance</th>
                  </tr>
                </thead>
                <tbody>
                  ${productPerformance.map(p => `
                    <tr>
                      <td style="font-weight: 500;">${p.name}</td>
                      <td class="text-center">${p.qty}</td>
                      <td class="text-right highlight">${formatAmount(p.revenue)}</td>
                      <td class="text-right" style="color: ${p.growth >= 0 ? '#10B981' : '#EF4444'}">
                        ${p.growth >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(p.growth))}%
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="footer">
              Ce document a été généré par l'IA LibreShop pour aider au pilotage de votre activité commerciale.<br/>
              © ${new Date().getFullYear()} LibreShop Global - Analyse réalisée le ${new Date().toLocaleString('fr-FR')}
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 500);
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (e) {
      console.error('Export PDF error:', e);
      Alert.alert('Erreur', 'Impossible de générer le rapport PDF');
    } finally {
      setLoading(false);
    }
  };

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: 'today', label: "Aujourd'hui" },
    { key: 'yesterday', label: 'Hier' },
    { key: '7d', label: '7 jours' },
    { key: '30d', label: '30 jours' },
    { key: 'thisMonth', label: 'Ce mois' },
    { key: 'lastMonth', label: 'Mois dernier' },
    { key: '3m', label: '3 mois' },
    { key: 'thisYear', label: 'Cette année' },
    { key: 'all', label: 'Tout' },
  ];

  const getDateRangeForFilter = (key: TimeRange) => {
    const { start, end } = getRangeBounds(key);
    const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
    if (key === 'today' || key === 'yesterday') return fmt.format(start);
    return `${fmt.format(start)} - ${fmt.format(end)}`;
  };

  const chartData = useMemo(() => {
    if (!revenueTimeline || revenueTimeline.length === 0) {
      return [];
    }
    return revenueTimeline
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((d) => ({
        date: new Date(d.date).getTime(),
        revenue: Number(d.revenue) || 0,
      }));
  }, [revenueTimeline]);


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: COLORS.text },
    content: { padding: spacing.xl },
    filtersContainer: { marginBottom: spacing.xl },
    timeChip: {
      borderRadius: RADIUS.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      borderWidth: 1,
      minWidth: 90,
    },
    section: { marginBottom: spacing.xxl },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: COLORS.text, marginBottom: spacing.md, marginLeft: 4 },
    chartCard: {
      backgroundColor: COLORS.card,
      borderRadius: component.cardBorderRadius,
      padding: spacing.lg,
      paddingRight: spacing.md,
      overflow: 'hidden',
      minHeight: 260,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    kpiCard: {
      backgroundColor: COLORS.card,
      borderRadius: component.cardBorderRadius,
      padding: spacing.lg,
      flexGrow: 1,
      minWidth: isDesktop ? 220 : 160,
    },
    kpiTitle: { fontSize: fontSize.sm, color: COLORS.textSoft, marginBottom: spacing.xs },
    kpiValue: { fontSize: fontSize.xl, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
    kpiSubtitle: { fontSize: fontSize.xs, color: COLORS.textMuted },
    topProductRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.card,
      padding: spacing.md,
      borderRadius: component.cardBorderRadius,
      marginBottom: spacing.sm,
    },
    rankBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    topProductName: { fontSize: fontSize.md, fontWeight: '600', color: COLORS.text },
    topProductMeta: { fontSize: fontSize.xs, color: COLORS.textSoft, marginTop: 2 },

    // New Styles for Premium Overhaul
    card: {
      backgroundColor: COLORS.card,
      borderRadius: component.cardBorderRadius,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: spacing.md,
      marginBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: spacing.sm,
    },
    cardTitle: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: COLORS.text,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    rankText: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: COLORS.textSoft,
      width: 24,
    },
    productName: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: COLORS.text,
    },
    productMeta: {
      fontSize: fontSize.xs,
      color: COLORS.textMuted,
      marginTop: 2,
    },
    growthBadge: {
      backgroundColor: COLORS.bg,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 12,
    },
    growthText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
    },
    emptyText: {
      fontSize: fontSize.sm,
      color: COLORS.textMuted,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    actionButton: {
      backgroundColor: COLORS.danger + '15',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 100,
    },
    actionButtonText: {
      fontSize: fontSize.xs,
      color: COLORS.danger,
      fontWeight: '600',
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    tableCard: {
      backgroundColor: COLORS.card,
      borderRadius: component.cardBorderRadius,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: COLORS.bg,
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    tableHead: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: COLORS.textSoft,
      textTransform: 'uppercase',
    },
    tableRow: {
      flexDirection: 'row',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      alignItems: 'center',
    },
    tableCell: {
      fontSize: fontSize.sm,
      color: COLORS.text,
    },
    benchmarkToggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: COLORS.info + '10',
      padding: spacing.lg,
      borderRadius: component.cardBorderRadius,
      borderWidth: 1,
      borderColor: COLORS.info + '30',
    },
    benchmarkCard: {
      backgroundColor: COLORS.card,
      padding: spacing.lg,
      borderRadius: component.cardBorderRadius,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    responseContainer: {
      backgroundColor: COLORS.accent + '10',
      padding: spacing.md,
      borderRadius: RADIUS.md,
      marginTop: spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: COLORS.accent,
    },
    coachSection: {
      marginBottom: spacing.xxl,
    },
    coachCard: {
      backgroundColor: COLORS.card,
      borderRadius: component.cardBorderRadius,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    coachHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.sm,
    },
    coachHeaderText: {
      color: '#FFF',
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    coachContent: {
      padding: spacing.lg,
    },
    adviceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    adviceIconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adviceText: {
      flex: 1,
      fontSize: fontSize.sm,
      color: COLORS.text,
      lineHeight: 20,
    },
    coachFooter: {
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      padding: spacing.md,
      backgroundColor: COLORS.bg,
    },
    questionBubble: {
      backgroundColor: COLORS.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.accent + '30',
      marginBottom: spacing.sm,
    },
    questionText: {
      fontSize: fontSize.xs,
      color: COLORS.accent,
      fontWeight: '500',
    },
    responseText: {
      fontSize: fontSize.sm,
      color: COLORS.text,
      fontStyle: 'italic',
    },
    benchmarkDesc: {
      fontSize: fontSize.xs,
      color: COLORS.textSoft,
      marginBottom: spacing.lg,
      lineHeight: 18,
    },
    benchmarkGrid: {
      flexDirection: 'row',
      gap: spacing.lg,
    },
    benchmarkItem: {
      flex: 1,
    },
    benchmarkLabel: {
      fontSize: fontSize.xs,
      color: COLORS.textMuted,
      marginBottom: 4,
    },
    benchmarkValue: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: spacing.sm,
    },
    comparisonBar: {
      height: 6,
      borderRadius: 3,
      marginBottom: 4,
    },
    comparisonProgress: {
      height: '100%',
      borderRadius: 3,
    },
    marketLabel: {
      fontSize: 10,
      color: COLORS.textMuted,
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.card,
      padding: spacing.lg,
      borderRadius: component.cardBorderRadius,
      borderLeftWidth: 4,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    alertTitle: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: COLORS.text,
    },
    alertDesc: {
      fontSize: fontSize.xs,
      color: COLORS.textSoft,
      marginTop: 2,
    },
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.card,
      paddingVertical: spacing.md,
      borderRadius: component.cardBorderRadius,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: spacing.sm,
    },
    exportButtonText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: COLORS.text,
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analyse Détaillée</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Time Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {timeRanges.map((r) => {
              const active = r.key === timeRange;
              return (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setTimeRange(r.key)}
                  activeOpacity={0.8}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor: active ? COLORS.accent : COLORS.bg,
                      borderColor: active ? COLORS.accent : COLORS.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? COLORS.textInverse : COLORS.textSoft, fontWeight: '600' }}>
                    {r.label}
                  </Text>
                  <Text style={{ color: active ? COLORS.textInverse + 'CC' : COLORS.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                    {getDateRangeForFilter(r.key)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Revenue Chart */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <Ionicons name="trending-up" size={20} color={COLORS.success} />
                <Text style={styles.sectionTitle}>Revenus réalisés</Text>
              </View>

              <View style={styles.chartCard}>
                <RevenueChart 
                  data={chartData} 
                  loading={loading} 
                  timeRange={timeRange} 
                  color={COLORS.primary} 
                  textColor={COLORS.textMuted} 
                  borderColor={COLORS.border} 
                  cardColor={COLORS.card} 
                />
              </View>
            </View>

            {/* KPIs */}
            {kpis.length > 0 && (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <Ionicons name="stats-chart" size={20} color={COLORS.accent} />
                  <Text style={styles.sectionTitle}>Indicateurs de performance</Text>
                </View>
                <View style={styles.kpiGrid}>
                  {kpis.map((kpi, index) => (
                    <View key={index} style={styles.kpiCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.xs }}>
                        <Ionicons name={kpi.icon} size={18} color={kpi.color} />
                        <Text style={styles.kpiTitle}>{kpi.title}</Text>
                      </View>
                      <Text style={styles.kpiValue}>{kpi.value}</Text>
                      {kpi.subtitle && <Text style={styles.kpiSubtitle}>{kpi.subtitle}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* AI Coach Section */}
            <View style={styles.coachSection}>
              <View style={styles.coachCard}>
                <LinearGradient 
                  colors={[COLORS.accent, COLORS.accent2]} 
                  start={{ x: 0, y: 0 }} 
                  end={{ x: 1, y: 0 }} 
                  style={styles.coachHeader}
                >
                  <Ionicons name="sparkles" size={20} color="#FFF" />
                  <Text style={styles.coachHeaderText}>Coach IA LibreShop</Text>
                </LinearGradient>
                
                <View style={styles.coachContent}>
                  {coachAdvice.length > 0 ? (
                    coachAdvice.map((advice, index) => (
                      <View key={index} style={styles.adviceRow}>
                        <View style={[styles.adviceIconBox, { backgroundColor: advice.color + '15' }]}>
                          <Ionicons name={advice.icon as any} size={16} color={advice.color} />
                        </View>
                        <Text style={styles.adviceText}>{advice.text}</Text>
                      </View>
                    ))
                  ) : loadingAdvice ? (
                    <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={COLORS.accent} />
                      <Text style={[styles.adviceText, { marginTop: 8, color: COLORS.textMuted }]}>Gemini analyse tes données...</Text>
                    </View>
                  ) : (
                    <Text style={styles.adviceText}>Aucun conseil disponible pour le moment.</Text>
                  )}

                  {coachResponse && (
                    <View style={styles.responseContainer}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                        <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.accent} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.accent }}>RÉPONSE DU COACH</Text>
                      </View>
                      <Text style={styles.responseText}>{coachResponse}</Text>
                    </View>
                  )}

                  {isAnswering && (
                    <View style={[styles.responseContainer, { alignItems: 'center', paddingVertical: spacing.lg }]}>
                      <ActivityIndicator size="small" color={COLORS.accent} />
                      <Text style={[styles.responseText, { marginTop: 8 }]}>Le coach analyse tes chiffres...</Text>
                    </View>
                  )}
                </View>

                <View style={styles.coachFooter}>
                  <Text style={{ fontSize: 12, color: COLORS.textSoft, marginBottom: spacing.md, fontWeight: '600' }}>
                    QUESTIONS FRÉQUENTES
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                    {[
                      "Pourquoi mon CA baisse ?",
                      "Quel est mon meilleur produit ?",
                      "Comment augmenter mon panier ?",
                      "Produits qui ne vendent pas ?",
                    ].map((q, idx) => (
                      <TouchableOpacity 
                        key={idx} 
                        style={styles.questionBubble}
                        onPress={() => handleAskCoach(q)}
                        disabled={isAnswering}
                      >
                        <Text style={styles.questionText}>{q}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>

            {/* Stars & Dead Stock */}
            <View style={[styles.section, { flexDirection: isTablet ? 'row' : 'column', gap: spacing.md }]}>
              {/* Stars Card */}
              <View style={[styles.card, { flex: 1 }]}>
                <View style={[styles.cardHeader, { borderBottomColor: COLORS.success + '20' }]}>
                  <Ionicons name="star" size={18} color={COLORS.warning} />
                  <Text style={styles.cardTitle}>Produits Vedettes (Stars)</Text>
                </View>
                {productPerformance.slice(0, 3).map((p, idx) => (
                  <View key={p.id} style={styles.listRow}>
                    <Text style={styles.rankText}>#{idx + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.productMeta}>{formatAmount(p.revenue)}</Text>
                    </View>
                    <View style={styles.growthBadge}>
                      <Text style={[styles.growthText, { color: p.growth >= 0 ? COLORS.success : COLORS.danger }]}>
                        {p.growth >= 0 ? '+' : ''}{Math.round(p.growth)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Dead Stock Card */}
              <View style={[styles.card, { flex: 1 }]}>
                <View style={[styles.cardHeader, { borderBottomColor: COLORS.danger + '20' }]}>
                  <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
                  <Text style={styles.cardTitle}>Stock Mort (30j+)</Text>
                </View>
                {deadStock.length > 0 ? deadStock.map((p) => (
                  <View key={p.id} style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.productMeta}>{p.stock} en stock · {formatAmount(p.price)}</Text>
                    </View>
                    <TouchableOpacity style={styles.actionButton}>
                      <Text style={styles.actionButtonText}>Promo</Text>
                    </TouchableOpacity>
                  </View>
                )) : (
                  <Text style={styles.emptyText}>Aucun stock mort détecté !</Text>
                )}
              </View>
            </View>

            {/* Performance Détaillée Table */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="list" size={20} color={COLORS.accent} />
                <Text style={styles.sectionTitle}>Performance Détaillée</Text>
              </View>
              <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHead, { flex: 2 }]}>Produit</Text>
                  <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>Ventes</Text>
                  <Text style={[styles.tableHead, { flex: 1.5, textAlign: 'right' }]}>CA</Text>
                </View>
                {productPerformance.map((p) => (
                  <View key={p.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>{p.qty}</Text>
                    <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'right', fontWeight: '600' }]}>{formatAmount(p.revenue)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Market Benchmark - Premium Feature */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.benchmarkToggle}
                onPress={() => setShowMarketView(!showMarketView)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="globe" size={20} color={COLORS.info} />
                  <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: spacing.sm }]}>Benchmark Marché (Anonymisé)</Text>
                </View>
                <Ionicons name={showMarketView ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
              
              {showMarketView && marketBenchmark && (
                <View style={styles.benchmarkCard}>
                  <Text style={styles.benchmarkDesc}>Compare ta performance à la moyenne des boutiques de ta catégorie.</Text>
                  <View style={styles.benchmarkGrid}>
                    <View style={styles.benchmarkItem}>
                      <Text style={styles.benchmarkLabel}>Ton Panier Moyen</Text>
                      <Text style={styles.benchmarkValue}>{kpis[1]?.value}</Text>
                      <View style={[styles.comparisonBar, { backgroundColor: COLORS.info + '20' }]}>
                        <View style={[styles.comparisonProgress, { width: '85%', backgroundColor: COLORS.info }]} />
                      </View>
                      <Text style={styles.marketLabel}>Moyenne Marché: {formatAmount(Math.round(marketBenchmark.marketAvgBasket))}</Text>
                    </View>
                    <View style={styles.benchmarkItem}>
                      <Text style={styles.benchmarkLabel}>Croissance Top (Top 10%)</Text>
                      <Text style={[styles.benchmarkValue, { color: COLORS.success }]}>+{marketBenchmark.marketTopGrowth}%</Text>
                      <Text style={styles.marketLabel}>Derniers 30 jours.</Text>
                    </View>
                  </View>

                  {/* Anonymized Top Products */}
                  <View style={{ marginTop: spacing.xl }}>
                    <Text style={[styles.cardTitle, { marginBottom: spacing.md, color: COLORS.info }]}>
                      🔥 Top 10 du marché ({store?.category || 'Général'})
                    </Text>
                    {marketBenchmark.topMarketProducts.map((p, idx) => (
                      <View key={idx} style={styles.listRow}>
                        <Text style={styles.rankText}>{idx + 1}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.productName}>{p.name}</Text>
                          <Text style={styles.productMeta}>Anonymisé</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontWeight: '700', color: COLORS.text }}>{p.qty} ventes</Text>
                        </View>
                      </View>
                    ))}
                    {marketBenchmark.topMarketProducts.length === 0 && (
                      <Text style={styles.emptyText}>Données insuffisantes pour cette catégorie.</Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* Smart Alerts */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="notifications" size={20} color={COLORS.warning} />
                <Text style={styles.sectionTitle}>Alertes & Recommandations</Text>
              </View>
              {deadStock.length > 0 && (
                <View style={[styles.alertCard, { borderLeftColor: COLORS.warning }]}>
                  <Ionicons name="flash" size={20} color={COLORS.warning} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.alertTitle}>Optimise ton stock</Text>
                    <Text style={styles.alertDesc}>Tu as {deadStock.length} produits sans ventes depuis 30 jours. Pense à créer une collection "Promo" !</Text>
                  </View>
                </View>
              )}
              {loyalty && loyalty.loyaltyRate < 10 && (
                <View style={[styles.alertCard, { borderLeftColor: COLORS.info, marginTop: spacing.sm }]}>
                  <Ionicons name="heart" size={20} color={COLORS.info} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.alertTitle}>Fidélise tes clients</Text>
                    <Text style={styles.alertDesc}>Ton taux de clients récurrents est de {Math.round(loyalty.loyaltyRate)}%. Offre un coupon aux anciens clients !</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={[styles.section, { marginBottom: spacing.xxl * 2 }]}>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <TouchableOpacity 
                   style={[styles.exportButton, { flex: 1 }]}
                   onPress={handleExportPDF}
                >
                  <Ionicons name="document-text" size={20} color={COLORS.text} />
                  <Text style={styles.exportButtonText}>Export PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.exportButton, { flex: 1 }]}
                  onPress={handleExportCSV}
                >
                  <Ionicons name="grid" size={20} color={COLORS.text} />
                  <Text style={styles.exportButtonText}>Export CSV</Text>
                </TouchableOpacity>
              </View>
            </View>

          </>
        )}
      </ScrollView>
    </View>
  );
};

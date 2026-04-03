import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Dimensions,
  ScrollView,
  TextInput,
  Linking,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store';
import { useNotificationStore } from '../store/notificationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { storeService } from '../services/storeService';
import { authService } from '../services/authService';
import { productLikesService } from '../services/productLikesService';
import { notificationService } from '../services/notificationService';
import { analyticsService, TimelineDataPoint, TopProductData } from '../services/analyticsService';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { Card, LoadingSpinner } from '../components';
import { useResponsive } from '../utils/useResponsive';

// Types
interface Stat {
  title: string;
  value: string;
  trend: string;
  icon: keyof typeof Ionicons.glyphMap;
  positive: boolean;
  color?: string;
}

interface DashboardOrder {
  id: string;
  customer: string;
  amount: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  time: string;
  items?: number;
}

interface Activity {
  id: string;
  text: string;
  time: string;
  ts: number;
  icon: keyof typeof Ionicons.glyphMap;
  type?: 'order' | 'product' | 'payment' | 'system';
}

type TimeRange = 'today' | '7d' | '30d' | 'month';

interface Kpi {
  title: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface AlertItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface TopProduct {
  id: string;
  name: string;
  qty: number;
  revenue: number;
}

// Fonction utilitaire pour le formatage
const formatAmount = (amount: number) => {
  return amount.toLocaleString() + ' FCA';
};

const formatTimeAgo = (isoDate?: string) => {
  if (!isoDate) return '';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hier';
  return `Il y a ${diffDays}j`;
};

export const SellerDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);
  const { unreadCount, setNotifications } = useNotificationStore();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { 
    isMobile, 
    isTablet, 
    isDesktop,
    spacing,
    fontSize,
    component,
  } = useResponsive();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const [store, setStore] = useState<Partial<import('../lib/supabase').Store>>({});
  const [stats, setStats] = useState<Stat[]>([]);
  const [recentOrders, setRecentOrders] = useState<DashboardOrder[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [recentActivity, setRecentActivity] = React.useState<Activity[]>([]);

  const [nowTs, setNowTs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const [summary, setSummary] = useState({ totalRevenue: 0, pendingOrders: 0, deliveredOrders: 0 });

  const sellerName = React.useMemo(() => {
    const fullName = String(user?.full_name || '').trim();
    if (fullName) return fullName;

    const email = String(user?.email || '').trim();
    if (email.includes('@')) {
      const local = email.split('@')[0] || '';
      const cleaned = local
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return 'Vendeur';
  }, [user?.full_name, user?.email]);
  const sellerInitials = sellerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const contentMaxWidth = isDesktop ? 1400 : isTablet ? 900 : '100%';
  const isLandscape = width > height;

  const getRangeBounds = React.useCallback((range: TimeRange) => {
    const now = new Date();

    if (range === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = now;
      const prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
      const prevEnd = start;
      return { start, end, prevStart, prevEnd };
    }

    if (range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = now;
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = start;
      return { start, end, prevStart, prevEnd };
    }

    const days = range === '7d' ? 7 : 30;
    const end = now;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
    const prevEnd = start;
    return { start, end, prevStart, prevEnd };
  }, []);

  const formatTrend = React.useCallback((current: number, previous: number) => {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return '';
    if (previous <= 0) {
      if (current <= 0) return '0%';
      return '+100%';
    }
    const pct = ((current - previous) / previous) * 100;
    const rounded = Math.round(pct);
    return `${rounded >= 0 ? '+' : ''}${rounded}%`;
  }, []);

  // load current seller store
  const fetchStore = React.useCallback(async () => {
    try {
      if (user) {
        const s = await storeService.getByUser(user.id);
        if (!s) {
          // Si aucune boutique n'est réellement trouvée (pas d'erreur DB)
          setTimeout(() => {
            navigation.replace('SellerAddStore');
          }, 500);
          return;
        }
        setStore(s);
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'load store');
    }
  }, [user, navigation]);

  React.useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  // Refresh store quand l'écran reprend le focus
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchStore();
    });
    return unsubscribe;
  }, [navigation, fetchStore]);

  // Polling toutes les 30 secondes pour détecter l'expiration en temps réel
  React.useEffect(() => {
    const pollingInterval = setInterval(() => {
      fetchStore();
    }, 30000); // 30 secondes
    
    return () => clearInterval(pollingInterval);
  }, [fetchStore]);

  // Charger les notifications au montage et quand l'écran a le focus
  const loadNotifications = React.useCallback(async () => {
    try {
      if (user?.id) {
        const notifications = await notificationService.getByUser(user.id);
        setNotifications(notifications);
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'load notifications');
    }
  }, [user?.id, setNotifications]);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Refresh notifications quand l'écran reprend le focus
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadNotifications();
    });
    return unsubscribe;
  }, [navigation, loadNotifications]);

  const subscriptionStatus = useMemo(() => storeService.getSubscriptionStatus(store), [store]);
  const isTrial = subscriptionStatus === 'trial';
  const isActive = subscriptionStatus === 'active';
  const isExpired = subscriptionStatus === 'expired';

  // Rediriger vers Pricing si l'abonnement est expiré
  React.useEffect(() => {
    if (isExpired && store?.id) {
      Alert.alert(
        'Abonnement expiré',
        'Votre abonnement a expiré. Veuillez choisir un nouveau plan pour continuer.',
        [
          {
            text: 'Choisir un plan',
            onPress: () => {
              navigation.navigate('SubscriptionExpired' as never);
            },
          },
        ]
      );
    }
  }, [isExpired, store?.id, navigation]);

  const loadDashboardData = React.useCallback(async () => {
    if (!store?.id) return;
    try {
      setLoading(true);

      const { start, prevStart, prevEnd } = getRangeBounds(timeRange);

      const [ordersResponse, products, totalLikes] = await Promise.all([
        orderService.getByStore(store.id),
        productService.getByStoreAll(store.id),
        productLikesService.getStoreLikesCount(store.id).catch(() => 0),
      ]);
      
      const orders = ordersResponse.orders || [];
      const ordersCount = ordersResponse.count || orders.length;

      const ordersInRange = (orders as any[]).filter((o: any) => {
        const t = new Date(o.created_at).getTime();
        return Number.isFinite(t) && t >= start.getTime();
      });

      const ordersPrevRange = (orders as any[]).filter((o: any) => {
        const t = new Date(o.created_at).getTime();
        return Number.isFinite(t) && t >= prevStart.getTime() && t < prevEnd.getTime();
      });

      const confirmedStatuses = new Set(['paid', 'shipped', 'delivered']);
      const confirmedOrdersInRange = ordersInRange.filter((o: any) => confirmedStatuses.has(o.status));
      const confirmedOrdersPrevRange = ordersPrevRange.filter((o: any) => confirmedStatuses.has(o.status));

      const totalOrders = (orders as any[]).length;
      const totalOrdersPrev = (orders as any[]).length; // Simplified for now
      const pendingOrders = (orders as any[]).filter((o: any) => o.status === 'pending').length;
      const deliveredOrders = (orders as any[]).filter((o: any) => o.status === 'delivered').length;
      const totalRevenue = confirmedOrdersInRange.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
      const totalRevenuePrev = confirmedOrdersPrevRange.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

      const revenueLabel =
        totalRevenue >= 1000000
          ? `${Math.round(totalRevenue / 1000000)}M`
          : totalRevenue >= 1000
            ? `${Math.round(totalRevenue / 1000)}K`
            : String(Math.round(totalRevenue));

      const totalViews = (products as any[]).reduce((sum, p) => sum + (Number(p?.view_count) || 0), 0);

      setStats([
        {
          title: 'Total commandes',
          value: String(ordersCount),
          trend: formatTrend(totalOrders, totalOrdersPrev),
          icon: 'cart',
          positive: totalOrdersPrev <= 0 ? totalOrders > 0 : totalOrders >= totalOrdersPrev,
          color: COLORS.accent,
        },
        {
          title: 'Revenus',
          value: revenueLabel,
          trend: formatTrend(totalRevenue, totalRevenuePrev),
          icon: 'wallet',
          positive: totalRevenuePrev <= 0 ? totalRevenue > 0 : totalRevenue >= totalRevenuePrev,
          color: COLORS.success,
        },
        {
          title: 'Produits actifs',
          value: String(products.length),
          trend: '',
          icon: 'cube',
          positive: true,
          color: COLORS.warning,
        },
        {
          title: 'En attente',
          value: String(pendingOrders),
          trend: '',
          icon: 'time',
          positive: pendingOrders === 0,
          color: COLORS.info,
        },
        {
          title: 'Total Vues',
          value: totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}K` : String(totalViews),
          trend: '',
          icon: 'eye',
          positive: true,
          color: COLORS.accent,
        },
        {
          title: 'Favoris',
          value: String(totalLikes),
          trend: '',
          icon: 'heart',
          positive: true,
          color: COLORS.danger,
        },
      ]);

      const lowStock = (products as any[]).filter((p: any) => Number(p?.stock || 0) > 0 && Number(p?.stock || 0) <= 3);
      const outOfStock = (products as any[]).filter((p: any) => Number(p?.stock || 0) <= 0);
      const noImage = (products as any[]).filter((p: any) => !Array.isArray(p?.images) || p.images.length === 0);
      const maxOrders = 4;
      const mappedOrders: DashboardOrder[] = orders.slice(0, maxOrders).map((o: any) => {
        const itemsCount = Array.isArray(o.order_items)
          ? o.order_items.reduce((sum: number, it: any) => sum + Number(it?.quantity || 0), 0)
          : undefined;

        const customerName = o?.customer_phone || 'Client';
        return {
          id: o.id,
          customer: String(customerName),
          amount: Number(o.total_amount || 0),
          status: o.status,
          time: formatTimeAgo(o.created_at),
          items: itemsCount,
        };
      });

      // Activités récentes basées sur les données réelles
      const orderActivities: Activity[] = orders.slice(0, 4).map((o: any) => ({
        id: `order-${o.id}`,
        text: `Nouvelle commande de ${o.customer_phone || 'client'} (${formatAmount(Number(o.total_amount))})`,
        time: formatTimeAgo(o.created_at),
        ts: new Date(o.created_at).getTime(),
        icon: 'cart' as keyof typeof Ionicons.glyphMap,
        type: 'order',
      }));

      const productActivities: Activity[] = (products as any[]).slice(0, 4).map((p: any) => ({
        id: `product-${p.id}`,
        text: `Produit "${p.name}" ${p.created_at ? 'ajouté' : 'mis à jour'}`,
        time: formatTimeAgo(p.created_at || p.updated_at),
        ts: new Date(p.created_at || p.updated_at || p.created_at).getTime(),
        icon: 'cube' as keyof typeof Ionicons.glyphMap,
        type: 'product',
      }));

      const recentActivities: Activity[] = [...orderActivities, ...productActivities]
        .sort((a, b) => (Number.isFinite(b.ts) ? b.ts : 0) - (Number.isFinite(a.ts) ? a.ts : 0))
        .slice(0, 4);

      setRecentOrders(mappedOrders);
      setActivities(recentActivities.length > 0 ? recentActivities : []);
      setSummary({ totalRevenue, pendingOrders, deliveredOrders });
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'load dashboard data');
      const rawMsg = String((e as any)?.message || '');
      const isRls =
        rawMsg.toLowerCase().includes('permission denied') ||
        rawMsg.toLowerCase().includes('row level security') ||
        (e as any)?.code === '42501';

      Alert.alert(
        'Erreur',
        isRls
          ? "Accès refusé (RLS). Vérifie que tu es connecté avec le compte vendeur propriétaire de la boutique et que les policies Supabase pour 'orders'/'products' sont appliquées."
          : rawMsg || 'Impossible de charger le tableau de bord'
      );
    } finally {
      setLoading(false);
    }
  }, [store?.id, store?.subscription_end, isExpired, isMobile, formatTrend]);

  React.useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const effectiveSubscriptionEnd = React.useMemo(() => {
    // 1. Trust the explicit subscription_end from database
    if (store.subscription_end) return store.subscription_end;
    
    // 2. Fallback only if missing (should be rare now)
    if (!store.subscription_start) return null;

    const start = new Date(store.subscription_start);
    if (Number.isNaN(start.getTime())) return null;

    const status = String(store.subscription_status || '').toLowerCase();
    const plan = String(store.subscription_plan || '').toLowerCase();

    // Default durations if end date is missing
    const isTrialLike = status === 'trial' || plan.includes('essai') || plan.includes('trial');
    const days = isTrialLike ? 7 : 30;
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    return end.toISOString();
  }, [store.subscription_end, store.subscription_start, store.subscription_plan, store.subscription_status]);

  const remainingDays = React.useMemo(() => {
    if (!effectiveSubscriptionEnd) return 0;
    const diff = (new Date(effectiveSubscriptionEnd).getTime() - nowTs) / 86400000;
    return Math.max(0, Math.ceil(diff));
  }, [effectiveSubscriptionEnd, nowTs]);

  const planLabel = React.useMemo(() => {
    const raw = String(store.subscription_plan || '').trim();
    if (raw) return raw;
    
    // Fallback si le nom du plan est vide
    switch (store.subscription_status as string) {
      case 'trial': return 'Essai gratuit';
      case 'active': return 'Abonnement actif';
      case 'expired': return 'Plan expiré';
      case 'cancelled': return 'Plan annulé';
      default: return 'Plan Standard';
    }
  }, [store.subscription_plan, store.subscription_status]);

  const planEndsAtLabel = React.useMemo(() => {
    if (!effectiveSubscriptionEnd) return '';
    try {
      const endDate = new Date(effectiveSubscriptionEnd);
      return endDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  }, [effectiveSubscriptionEnd]);

  const handleLogout = async () => {
    try {
      Alert.alert(
        'Déconnexion',
        'Êtes-vous sûr de vouloir vous déconnecter ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Déconnecter',
            style: 'destructive',
            onPress: async () => {
              try {
                await authService.signOut();
                setUser(null);
                setSession(null);
                navigation.replace('Landing');
              } catch (e) {
                Alert.alert('Erreur', 'Impossible de se déconnecter');
              }
            }
          }
        ]
      );
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'Logout error:');
    }
  };

  const onRefresh = React.useCallback(() => {
    const run = async () => {
      setRefreshing(true);
      await loadDashboardData();
      setRefreshing(false);
    };
    run();
  }, [loadDashboardData]);

  const getStatusColor = (status: DashboardOrder['status']) => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'paid': return COLORS.success;
      case 'shipped': return COLORS.accent;
      case 'delivered': return COLORS.info;
      case 'cancelled': return COLORS.danger;
      default: return COLORS.textMuted;
    }
  };

  const getStatusLabel = (status: DashboardOrder['status']) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'paid': return 'Payée';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  const getStatusIcon = (status: DashboardOrder['status']) => {
    switch (status) {
      case 'pending': return 'time';
      case 'paid': return 'checkmark-circle';
      case 'shipped': return 'cube';
      case 'delivered': return 'checkmark-done';
      case 'cancelled': return 'close-circle';
      default: return 'help';
    }
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'order': return 'cart';
      case 'product': return 'cube';
      case 'payment': return 'cash';
      case 'system': return 'settings';
      default: return 'notifications';
    }
  };

  const renderSubscriptionPlan = () => {
    if (!store?.id) return null;
    
    const isTrial = store.subscription_status === 'trial';
    const isExpired = store.subscription_status === 'expired';
    const statusColor = isExpired ? COLORS.danger : isTrial ? COLORS.success : COLORS.accent;
    const daysLabel = remainingDays <= 1 ? 'jour restant' : 'jours restants';

    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => navigation.navigate('SellerChangePlan')}
        style={[styles.subscriptionBanner, { 
          padding: spacing.lg, 
          marginBottom: spacing.xl,
          backgroundColor: COLORS.card,
          borderRadius: RADIUS.xl,
          borderWidth: 1,
          borderColor: statusColor + '40',
          overflow: 'hidden',
          ...Platform.select({
            web: { boxShadow: `0 8px 24px ${statusColor}15` },
            default: { elevation: 4, shadowColor: statusColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 }
          })
        }]}
      >
        <LinearGradient
          colors={[statusColor + '08', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.planIconCircle, { backgroundColor: statusColor + '15', width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg }]}>
            <Ionicons name={isExpired ? "alert-circle" : "sparkles"} size={28} color={statusColor} />
          </View>
          
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: fontSize.lg }}>
                {planLabel}
              </Text>
              {isTrial && (
                <View style={{ backgroundColor: COLORS.success, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>ESSAI</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
              <Ionicons name="time-outline" size={14} color={statusColor} />
              <Text style={{ color: statusColor, fontWeight: '700', fontSize: fontSize.md }}>
                {isExpired ? 'Abonnement expiré' : `${remainingDays} ${daysLabel}`}
              </Text>
            </View>
            {planEndsAtLabel && (
              <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4 }}>
                Expire le {planEndsAtLabel}
              </Text>
            )}
          </View>

          <View style={{ alignItems: 'flex-end' }}>
             <View style={[styles.changeBtn, { backgroundColor: statusColor + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
               <Text style={{ color: statusColor, fontWeight: '700', fontSize: 12 }}>Changer</Text>
               <Ionicons name="chevron-forward" size={14} color={statusColor} />
             </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAlerts = () => {
    if (alerts.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="alert" size={fontSize.lg} color={COLORS.warning} />
            <Text style={[styles.sectionTitle, { fontSize: fontSize.lg }]}>Attention requise</Text>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          {alerts.slice(0, 4).map((a) => (
            <View
              key={a.id}
              style={[
                styles.alertRow,
                {
                  padding: spacing.lg,
                  backgroundColor: COLORS.card,
                  borderRadius: component.cardBorderRadius,
                },
              ]}
            >
              <View style={[styles.alertIcon, { backgroundColor: a.color + '20' }]}>
                <Ionicons name={a.icon} size={fontSize.lg} color={a.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { fontSize: fontSize.md }]} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={[styles.alertSubtitle, { fontSize: fontSize.xs }]} numberOfLines={2}>
                  {a.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={fontSize.lg} color={COLORS.textMuted} />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const getStatCardMinWidth = () => {
    if (isDesktop) return 260;
    if (isTablet) return 240;
    return 160;
  };

  // Rendu des cartes statistiques en grille responsive
  const renderStats = () => {
    const cardMinWidth = getStatCardMinWidth();
    return (
      <View style={styles.statsWrapper}>
        <View style={[
          styles.statsGrid,
          { 
            gap: spacing.md,
          }
        ]}>
          {stats.map((stat, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.statCard,
                { 
                  flexGrow: 1,
                  minWidth: cardMinWidth,
                  padding: spacing.lg,
                  backgroundColor: COLORS.card,
                  borderRadius: component.cardBorderRadius,
                }
              ]}
              activeOpacity={0.7}
              onPress={() => {
                if (index === 0) navigation.navigate('SellerOrders');
                if (index === 1) navigation.navigate('SellerCaisse');
                if (index === 2) navigation.navigate('SellerProducts');
              }}
            >
              <LinearGradient
                colors={[stat.color + '20', stat.color + '05']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              
              <View style={styles.statHeader}>
                <Text style={[styles.statTitle, { fontSize: fontSize.xs }]}>
                  {stat.title}
                </Text>
                <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                  <Ionicons name={stat.icon} size={fontSize.lg} color={stat.color} />
                </View>
              </View>
              
              <Text style={[styles.statValue, { fontSize: fontSize.xxxl }]}>
                {stat.value}
              </Text>
              
              <View style={styles.statFooter}>
                <Ionicons 
                  name={stat.positive ? 'trending-up' : 'trending-down'} 
                  size={fontSize.sm} 
                  color={stat.positive ? COLORS.success : COLORS.warning} 
                />
                <Text style={[
                  styles.statTrend,
                  { fontSize: fontSize.xs },
                  stat.positive ? styles.positive : styles.negative
                ]}>
                  {stat.trend}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };


  // Rendu des commandes récentes
  const renderRecentOrders = () => {
    const ordersToShow = recentOrders.slice(0, 4);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="cart" size={fontSize.lg} color={COLORS.accent} />
            <Text style={[styles.sectionTitle, { fontSize: fontSize.lg }]}>
              Dernières commandes
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => navigation.navigate('SellerOrders')}
            style={styles.seeAllButton}
          >
            <Text style={[styles.seeAll, { fontSize: fontSize.sm }]}>
              Voir tout
            </Text>
            <Ionicons name="arrow-forward" size={fontSize.sm} color={COLORS.accent} />
          </TouchableOpacity>
        </View>

        {ordersToShow.length > 0 ? (
          ordersToShow.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={[
                styles.orderCard,
                {
                  padding: spacing.lg,
                  backgroundColor: COLORS.card,
                  borderRadius: component.cardBorderRadius,
                  marginBottom: spacing.sm,
                }
              ]}
              onPress={() => navigation.navigate('SellerOrderDetail', { orderId: order.id })}
              activeOpacity={0.7}
            >
              <View style={styles.orderInfo}>
                <LinearGradient
                  colors={[getStatusColor(order.status) + '20', 'transparent']}
                  style={styles.orderGradient}
                />
                
                <View style={[
                  styles.customerAvatar,
                  { backgroundColor: getStatusColor(order.status) + '30' }
                ]}>
                  <Text style={[styles.avatarText, { fontSize: fontSize.md }]}>
                    {order.customer.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                  </Text>
                </View>
                
                <View style={styles.orderDetails}>
                  <Text style={[styles.customerName, { fontSize: fontSize.md }]} numberOfLines={1}>
                    {order.customer}
                  </Text>
                  <View style={styles.orderMeta}>
                    <Ionicons name="time" size={fontSize.xs} color={COLORS.textMuted} />
                    <Text style={[styles.orderTime, { fontSize: fontSize.xs }]}>
                      {order.time}
                    </Text>
                    {order.items && (
                      <>
                        <View style={styles.metaDot} />
                        <Ionicons name="cube" size={fontSize.xs} color={COLORS.textMuted} />
                        <Text style={[styles.orderItems, { fontSize: fontSize.xs }]}>
                          {order.items} art.
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.orderRight}>
                <Text style={[styles.orderAmount, { fontSize: fontSize.lg }]}>
                  {formatAmount(order.amount)}
                </Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(order.status) + '20' }
                ]}>
                  <Ionicons 
                    name={getStatusIcon(order.status)} 
                    size={fontSize.xs} 
                    color={getStatusColor(order.status)} 
                  />
                  <Text style={[
                    styles.statusText,
                    { fontSize: fontSize.xs, color: getStatusColor(order.status) }
                  ]}>
                    {getStatusLabel(order.status)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={48} color={COLORS.textMuted} />
            <Text style={[styles.emptyStateText, { fontSize: fontSize.md }]}>
              Aucune commande récente
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Rendu des actions rapides
  const renderQuickActions = () => {
    const handleActionPress = (action: { screen: string; storeId?: string; inactive?: boolean }) => {
      if (action.inactive) {
        Alert.alert(
          'Option non incluse',
          `Cette fonctionnalité n'est pas incluse dans votre plan ${store?.subscription_plan || 'actuel'}. Souhaitez-vous passer au plan supérieur ?`,
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Changer de plan', onPress: () => navigation.navigate('SellerChangePlan' as never) }
          ]
        );
        return;
      }

      if (action.screen === 'SellerAddProduct') {
        navigation.navigate('SellerProducts');
      } else if (action.screen === 'StoreDetail') {
        navigation.navigate('StoreDetail', { storeId: action.storeId });
      } else {
        navigation.navigate(action.screen);
      }
    };

    const actions = [
      { 
        label: 'Assistant IA', 
        icon: 'sparkles', 
        color: COLORS.info, // distinctive color
        screen: 'AgentChat' 
      },
      { 
        label: 'Ajouter produit', 
        icon: 'add-circle', 
        color: COLORS.accent,
        screen: 'SellerAddProduct' 
      },
      { 
        label: 'Caisse (POS)', 
        icon: 'card', 
        color: COLORS.warning,
        screen: 'SellerCaisse',
        inactive: store?.cashier_active === false
      },
      { 
        label: 'Voir ma boutique', 
        icon: 'eye', 
        color: COLORS.success,
        screen: 'StoreDetail',
        storeId: store?.id,
        inactive: store?.online_store_active === false
      },
      { 
        label: 'Collections', 
        icon: 'folder', 
        color: COLORS.info,
        screen: 'SellerCollection' 
      },
    ];

    const visibleActions = isMobile && !isLandscape ? actions.slice(0, 4) : actions;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="flash" size={fontSize.lg} color={COLORS.accent} />
            <Text style={[styles.sectionTitle, { fontSize: fontSize.lg }]}>
              Actions rapides
            </Text>
          </View>
        </View>

        <View style={[
          styles.quickActions,
          { 
            gap: spacing.md,
            flexDirection: isMobile && !isLandscape ? 'row' : 'row',
            flexWrap: isMobile && !isLandscape ? 'nowrap' : 'wrap',
          }
        ]}>
          {visibleActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.quickAction,
                {
                  padding: spacing.lg,
                  backgroundColor: COLORS.card,
                  borderRadius: component.cardBorderRadius,
                  flex: isMobile && !isLandscape ? 1 : undefined,
                  minWidth: isDesktop ? 200 : isTablet ? 180 : 'auto',
                }
              ]}
              onPress={() => handleActionPress(action)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.quickActionIcon,
                { 
                  backgroundColor: action.color + '20',
                  width: component.fabSize,
                  height: component.fabSize,
                  borderRadius: component.fabBorderRadius,
                }
              ]}>
                <Ionicons name={action.inactive ? "lock-closed" : (action.icon as any)} size={fontSize.xl} color={action.inactive ? COLORS.textMuted : action.color} />
              </View>
              <Text style={[styles.quickActionText, { fontSize: fontSize.sm, color: action.inactive ? COLORS.textMuted : COLORS.text }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Rendu des activités récentes
  const renderActivities = () => {
    const activitiesToShow = activities.slice(0, 4);

    if (activitiesToShow.length === 0) return null;

    return (
      <View style={[styles.section, { marginBottom: spacing.xxxl }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="notifications" size={fontSize.lg} color={COLORS.accent} />
            <Text style={[styles.sectionTitle, { fontSize: fontSize.lg }]}>
              Activité récente
            </Text>
          </View>
          <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate('Notifications')}>
            <Text style={[styles.seeAll, { fontSize: fontSize.sm }]}>Voir tout</Text>
            <Ionicons name="arrow-forward" size={fontSize.sm} color={COLORS.accent} />
          </TouchableOpacity>
        </View>

        <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="light" style={styles.activityBlur}>
          <View style={[
            styles.activityList,
            { backgroundColor: COLORS.card + '80' }
          ]}>
            {activitiesToShow.map((activity) => (
              <View key={activity.id} style={[
                styles.activityItem,
                { 
                  padding: spacing.lg,
                  borderBottomColor: COLORS.border,
                }
              ]}>
                <View style={[
                  styles.activityIcon,
                  { 
                    backgroundColor: COLORS.accent + '20',
                    width: component.buttonHeight * 0.75,
                    height: component.buttonHeight * 0.75,
                    borderRadius: component.buttonBorderRadius,
                  }
                ]}>
                  <Ionicons 
                    name={getActivityIcon(activity.type) as any} 
                    size={fontSize.md} 
                    color={COLORS.accent} 
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityText, { fontSize: fontSize.sm }]} numberOfLines={2}>
                    {activity.text}
                  </Text>
                  <Text style={[styles.activityTime, { fontSize: fontSize.xs }]}>
                    {activity.time}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={fontSize.md} color={COLORS.textMuted} />
              </View>
            ))}
          </View>
        </BlurView>
      </View>
    );
  };

  // Skeleton loader pendant le chargement
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <LoadingSpinner />
        </View>
      </View>
    );
  }

  // Bloquer l'accès au tableau de bord si l'abonnement est expiré
  if (isExpired && store?.id) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <LoadingSpinner />
      </View>
    );
  }

  const renderAnalyticsButton = () => {
    const isAnalyticsActive = store?.analytics_active !== false && !isExpired;

    return (
      <View style={[styles.section, { marginBottom: spacing.xl }]}>
        <TouchableOpacity
          style={[
            {
              backgroundColor: isAnalyticsActive ? COLORS.accent : COLORS.border,
              borderRadius: component.cardBorderRadius,
              padding: spacing.xl,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
          onPress={() => {
            if (isAnalyticsActive) {
              navigation.navigate('SellerAnalytics');
            } else {
              Alert.alert(
                'Fonctionnalité bloquée',
                'L\'analytique détaillée n\'est pas incluse dans votre offre actuelle. Veuillez mettre à niveau votre abonnement.'
              );
            }
          }}
          activeOpacity={isAnalyticsActive ? 0.8 : 1}
        >
          <View style={{ flex: 1, opacity: isAnalyticsActive ? 1 : 0.6 }}>
            <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: isAnalyticsActive ? COLORS.textInverse : COLORS.text, marginBottom: 4 }}>
              Analyse Détaillée
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: isAnalyticsActive ? 'rgba(255,255,255,0.8)' : COLORS.textMuted }}>
              Consultez les revenus, les KPIs et les statistiques de vos produits.
            </Text>
          </View>
          <View style={{ backgroundColor: isAnalyticsActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', padding: 12, borderRadius: 100 }}>
            <Ionicons name={isAnalyticsActive ? "bar-chart" : "lock-closed"} size={24} color={isAnalyticsActive ? COLORS.textInverse : COLORS.textMuted} />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + (isMobile ? 80 : spacing.xxl),
          }
        ]}
      >
        {/* Header avec gradient */}
        <LinearGradient
          colors={[COLORS.accent + '10', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.header, { 
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing.lg,
          }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.greeting, { fontSize: fontSize.titleLarge }]}>
                Bonjour, {sellerName.split(' ')[0]} 👋
              </Text>
              <TouchableOpacity style={[
                styles.dateBadge,
                {
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: RADIUS.full,
                }
              ]}>
                <Ionicons name="calendar-outline" size={fontSize.sm} color={COLORS.textSoft} />
                <Text style={[styles.dateText, { fontSize: fontSize.xs }]}>
                  {new Date().toLocaleDateString('fr-FR', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={[styles.headerButton, { 
                  width: component.buttonHeight,
                  height: component.buttonHeight,
                  borderRadius: component.buttonBorderRadius,
                }]}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={fontSize.lg} color={COLORS.text} />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.profileButton, { 
                  width: component.buttonHeight,
                  height: component.buttonHeight,
                  borderRadius: component.buttonBorderRadius,
                  backgroundColor: COLORS.accent,
                }]}
                onPress={handleLogout}
              >
                <Text style={[styles.profileInitials, { fontSize: fontSize.md }]}>
                  {sellerInitials}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: spacing.lg }]}>
          {renderSubscriptionPlan()}
          {renderStats()}
          {renderAnalyticsButton()}
          {renderAlerts()}
          {renderQuickActions()}
          {renderRecentOrders()}
          {renderActivities()}

          <View
            style={[
              styles.planRow,
              {
                marginTop: spacing.xl,
                gap: spacing.md,
                flexWrap: 'wrap',
              },
            ]}
          >
            <View
              style={[
                styles.planCard,
                {
                  backgroundColor: COLORS.card,
                  borderRadius: component.cardBorderRadius,
                  padding: spacing.lg,
                  flexGrow: 1,
                  minWidth: isMobile ? 160 : 220,
                },
              ]}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planTitle, { fontSize: fontSize.xs }]}>Plan</Text>
                <View style={[styles.planIcon, { backgroundColor: COLORS.accent + '20' }]}>
                  <Ionicons name="ribbon" size={fontSize.lg} color={COLORS.accent} />
                </View>
              </View>
              <Text style={[styles.planValue, { fontSize: fontSize.lg }]}>{planLabel}</Text>
              {!!effectiveSubscriptionEnd && (
                <Text style={[styles.planStatus, { fontSize: fontSize.xs }]}>
                  {isExpired ? 'Expiré' : `Expire le ${planEndsAtLabel.split(',')[0]}`}
                </Text>
              )}
            </View>

            <View
              style={[
                styles.planCard,
                {
                  backgroundColor: COLORS.card,
                  borderRadius: component.cardBorderRadius,
                  padding: spacing.lg,
                  flexGrow: 1,
                  minWidth: isMobile ? 160 : 220,
                },
              ]}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planTitle, { fontSize: fontSize.xs }]}>Revenus</Text>
                <View style={[styles.planIcon, { backgroundColor: COLORS.success + '20' }]}>
                  <Ionicons name="cash" size={fontSize.lg} color={COLORS.success} />
                </View>
              </View>
              <Text style={[styles.planValue, { fontSize: fontSize.lg }]}>{formatAmount(summary.totalRevenue)}</Text>
              <Text style={[styles.planStatus, { fontSize: fontSize.xs }]}>Période actuelle</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* FABs pour mobile uniquement */}
      {isMobile && !isExpired && (
        <>
          <TouchableOpacity 
            style={[
              styles.fab,
              {
                bottom: spacing.xxl + (insets.bottom || 0),
                right: spacing.lg,
                width: component.fabSize,
                height: component.fabSize,
                borderRadius: component.fabBorderRadius,
                backgroundColor: COLORS.accent,
                ...(Platform.OS === 'web'
                  ? { boxShadow: `0px 4px 8px ${COLORS.accent}4D` }
                  : {
                      shadowColor: COLORS.accent,
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 8,
                    }),
              }
            ]}
            onPress={() => {
              if (store?.cashier_active === false) {
                Alert.alert(
                  'Caisse non incluse',
                  `La caisse physique n'est pas incluse dans votre plan ${store?.subscription_plan || 'actuel'}.`,
                  [
                    { text: 'Plus tard', style: 'cancel' },
                    { text: 'Changer de plan', onPress: () => navigation.navigate('SellerChangePlan' as never) }
                  ]
                );
                return;
              }
              navigation.navigate('SellerCaisse');
            }}
          >
            <Ionicons name={store?.cashier_active === false ? "lock-closed" : "calculator"} size={fontSize.xxl} color={COLORS.text} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.fab,
              {
                bottom: spacing.xxl + (insets.bottom || 0) + component.fabSize + 16,
                right: spacing.lg,
                width: component.fabSize,
                height: component.fabSize,
                borderRadius: component.fabBorderRadius,
                backgroundColor: COLORS.info, // Distinct color for AI
                ...(Platform.OS === 'web'
                  ? { boxShadow: `0px 4px 8px ${COLORS.info}4D` }
                  : {
                      shadowColor: COLORS.info,
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 8,
                    }),
              }
            ]}
            onPress={() => navigation.navigate('AgentChat' as never)}
          >
            <Ionicons name="sparkles" size={fontSize.xxl} color={COLORS.bg} />
          </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
  },
  contentWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerButton: {
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  notificationText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '700',
  },
  greeting: {
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: 'flex-start',
  },
  dateText: {
    color: COLORS.textSoft,
  },
  profileButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    color: COLORS.text,
    fontWeight: '600',
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    marginVertical: SPACING.md,
    display: 'none', // Hide old banners as they are now consolidated at the top
  },
  trialBannerExpired: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    marginVertical: SPACING.md,
    display: 'none', // Hide old banners
  },
  summaryRow: {
    flexDirection: 'row',
    marginVertical: SPACING.lg,
  },
  summaryItem: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    color: COLORS.textSoft,
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontWeight: '700',
    color: COLORS.text,
  },
  timeFilters: {
    width: '100%',
  },
  timeChip: {
    borderWidth: 1,
  },
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  planCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  planTitle: {
    color: COLORS.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planIcon: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planValue: {
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  planMeta: {
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  planStatus: {
    color: COLORS.textSoft,
    marginTop: 4,
  },
  statsWrapper: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  statCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statTitle: {
    color: COLORS.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statIcon: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statTrend: {
    fontWeight: '500',
  },
  positive: {
    color: COLORS.success,
  },
  negative: {
    color: COLORS.warning,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  kpiCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  kpiTitle: {
    color: COLORS.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiIcon: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  kpiSubtitle: {
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  alertSubtitle: {
    color: COLORS.textMuted,
  },
  topProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProductName: {
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  topProductMeta: {
    color: COLORS.textMuted,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontWeight: '600',
    color: COLORS.text,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  seeAll: {
    color: COLORS.accent,
    fontWeight: '500',
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
    overflow: 'hidden',
  },
  orderGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '600',
    color: COLORS.text,
  },
  orderDetails: {
    flex: 1,
  },
  customerName: {
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  orderTime: {
    color: COLORS.textMuted,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.textMuted,
    marginHorizontal: SPACING.xs,
  },
  orderItems: {
    color: COLORS.textMuted,
  },
  orderRight: {
    alignItems: 'flex-end',
    marginLeft: SPACING.sm,
  },
  orderAmount: {
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    gap: 4,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickAction: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  quickActionText: {
    fontWeight: '500',
    color: COLORS.textSoft,
    textAlign: 'center',
  },
  activityBlur: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  activityList: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderBottomWidth: 1,
  },
  activityIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  activityTime: {
    color: COLORS.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyStateText: {
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fab: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: `0px 4px 8px ${COLORS.accent}4D` }
      : {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }),
  },
});
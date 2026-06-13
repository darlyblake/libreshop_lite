import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Platform,
  Dimensions as RN_Dimensions,
} from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useDerivedValue, 
  withTiming, 
  runOnJS,
  useAnimatedReaction,
  FadeInDown,
  FadeInUp,
  Layout,
  SlideInRight
} from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RevenueChart } from '../components/RevenueChart';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOWS } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { RootStackParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';
import { adminService } from '../services/adminService';
import { analyticsService, TimelineDataPoint, TopStoreData } from '../services/analyticsService';
import { systemAlertService, SystemAlert } from '../services/systemAlertService';
import { useAuthStore } from '../store';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - SPACING.lg * 2;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface StatCard {
  id: string;
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface Activity {
  id: string;
  type: 'user' | 'store' | 'order' | 'payment' | 'subscription';
  message: string;
  time: string;
  user?: string;
  amount?: number;
}

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const auth = useAuthStore ? useAuthStore() : { user: null, session: null };
  const { user, session } = auth;

  const [connectionLabel, setConnectionLabel] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStores: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    pendingOrders: 0,
    pendingPayments: 0,
  });
  const [revenueTimeline, setRevenueTimeline] = useState<TimelineDataPoint[]>([]);
  const [topStores, setTopStores] = useState<TopStoreData[]>([]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [newStats, newTimeline, newTopStores] = await Promise.all([
        adminService.getDashboardStats(),
        analyticsService.getGlobalRevenueTimeline(7),
        analyticsService.getTopStores(3),
      ]);
      setStats(newStats);
      setRevenueTimeline(newTimeline);
      setTopStores(newTopStores);
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, [adminService, analyticsService]); // Added dependencies for clarity, though not strictly required if they are stable constants

  const loadRecentActivity = useCallback(async () => {
    try {
      const items = await adminService.getRecentActivity();
      setRecentActivity(items);
    } catch (e) {
      errorHandler.handleDatabaseError(e as any, 'load recent activity');
    }
  }, []);

  const loadUnreadNotifications = useCallback(async () => {
    try {
      const sessionData = await authService.getSession();
      const s = sessionData.session;
      const userId = s?.user?.id;
      if (!userId) {
        setUnreadNotifications(0);
        return;
      }
      try {
        const count = await notificationService.getUnreadCount(userId);
        setUnreadNotifications(count);
      } catch (err: any) {
        // If notifications table is not deployed yet, avoid spamming errors on the dashboard.
        if (err?.code === 'PGRST205' || String(err?.message || '').includes('404')) {
          setUnreadNotifications(0);
          return;
        }
        throw err;
      }
    } catch (e: any) {
      errorHandler.handleDatabaseError(e, 'load unread notifications');
    }
  }, []);
  
  const loadSystemAlerts = useCallback(async () => {
    try {
      const alerts = await systemAlertService.getActiveAlerts();
      setSystemAlerts(alerts);
    } catch (e) {
      // silent fail
    }
  }, []);

  const chartData = useMemo(() => {
    if (!revenueTimeline || revenueTimeline.length === 0) {
      return [];
    }
    
    return revenueTimeline
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(d => ({
        date: new Date(d.date).getTime(),
        revenue: d.revenue
      }));
  }, [revenueTimeline]);

  const distributionData = [
    {
      name: 'Boutiques',
      value: stats.totalStores,
      color: COLORS.accent,
    },
    {
      name: 'Utilisateurs',
      value: stats.totalUsers,
      color: COLORS.accent2,
    },
    {
      name: 'Commandes',
      value: stats.totalOrders,
      color: COLORS.success,
    },
  ];

  const statCards: StatCard[] = useMemo(() => [
    {
      id: 'users',
      title: 'Utilisateurs',
      value: stats.totalUsers.toLocaleString(),
      icon: 'people',
      color: COLORS.accent,
      change: '+12%',
      trend: 'up',
    },
    {
      id: 'stores',
      title: 'Boutiques',
      value: stats.totalStores.toLocaleString(),
      icon: 'storefront',
      color: COLORS.accent2,
      change: '+5%',
      trend: 'up',
    },
    {
      id: 'orders',
      title: 'Commandes',
      value: stats.totalOrders.toLocaleString(),
      icon: 'receipt',
      color: COLORS.success,
      change: '+8%',
      trend: 'up',
    },
    {
      id: 'revenue',
      title: 'Revenus',
      value: (stats.totalRevenue / 1000000).toFixed(1) + 'M FCFA',
      icon: 'cash',
      color: COLORS.warning,
      change: '+15%',
      trend: 'up',
    },
    {
      id: 'subscriptions',
      title: 'Abonnements',
      value: stats.activeSubscriptions.toLocaleString(),
      icon: 'card',
      color: COLORS.info,
      change: '+23%',
      trend: 'up',
    },
    {
      id: 'pending',
      title: 'En attente',
      value: stats.pendingPayments.toLocaleString(),
      icon: 'time',
      color: COLORS.danger,
      change: '-2%',
      trend: 'down',
    },
  ], [stats]);

  const menuItems = [
    { 
      id: 'agent',
      title: 'Assistant IA', 
      icon: 'sparkles-outline' as const, 
      screen: 'AdminAgentChat' as const,
      color: COLORS.primary,
      description: 'Analyser les requêtes et conseiller',
    },
    { 
      id: 'users',
      title: 'Gestion des utilisateurs', 
      icon: 'people-outline' as const, 
      screen: 'AdminUsers' as const,
      color: COLORS.accent,
      count: stats.totalUsers,
      description: 'Gérer les comptes utilisateurs',
    },
    { 
      id: 'stores',
      title: 'Gestion des boutiques', 
      icon: 'storefront-outline' as const, 
      screen: 'AdminStores' as const,
      color: COLORS.accent2,
      count: stats.totalStores,
      description: 'Valider et gérer les boutiques',
    },
    { 
      id: 'categories',
      title: 'Catégories', 
      icon: 'grid-outline' as const, 
      screen: 'AdminCategories' as const,
      color: COLORS.success,
      count: 24,
      description: 'Organiser les produits',
    },
    { 
      id: 'location',
      title: 'Localisation', 
      icon: 'location-outline' as const, 
      screen: 'AdminCountries' as const,
      color: COLORS.info,
      description: 'Gérer pays et villes',
    },
    { 
      id: 'subscriptions',
      title: 'Abonnements', 
      icon: 'card-outline' as const, 
      screen: 'AdminSubscriptions' as const,
      color: COLORS.warning,
      count: stats.activeSubscriptions,
      description: 'Gérer les plans et paiements',
    },
    { 
      id: 'payments',
      title: 'Paiements', 
      icon: 'cash-outline' as const, 
      screen: 'AdminPayments' as const,
      color: COLORS.success,
      count: stats.pendingPayments,
      description: 'Gérer les paiements des boutiques',
    },
    { 
      id: 'administrators',
      title: 'Administrateurs', 
      icon: 'people-outline' as const, 
      screen: 'AdminAdministrators' as const,
      color: COLORS.accent,
      count: 11,
      description: 'Gérer le personnel admin',
    },
    { 
      id: 'featured',
      title: 'Mise en avant', 
      icon: 'pricetag-outline' as const, 
      screen: 'AdminFeatured' as const,
      color: COLORS.accent,
      description: 'Contrôler la visibilité des boutiques',
    },
    { 
      id: 'banners',
      title: 'Bannières publicitaires', 
      icon: 'images-outline' as const, 
      screen: 'AdminBanners' as const,
      color: COLORS.warning,
      description: 'Gérer les bannières et promotions',
    },
    { 
      id: 'reports',
      title: 'Signalements', 
      icon: 'warning-outline' as const, 
      screen: 'AdminReports' as const,
      color: COLORS.danger,
      description: 'Gérer les conflits et problèmes',
    },
    { 
      id: 'analytics',
      title: 'Analytiques', 
      icon: 'bar-chart-outline' as const, 
      screen: 'AdminAnalytics' as const,
      color: COLORS.info,
      description: 'Voir les statistiques détaillées',
    },
    { 
      id: 'sendNotification',
      title: 'Envoyer une notification', 
      icon: 'send-outline' as const, 
      screen: 'AdminSendNotification' as const,
      color: COLORS.accent2,
      description: 'Envoyer des notifications aux utilisateurs',
    },
    { 
      id: 'apkUpdates',
      title: 'Mises à jour APK', 
      icon: 'cloud-download-outline' as const, 
      screen: 'AdminAPKUpdates' as const,
      color: COLORS.success,
      description: 'Gérer les versions et mises à jour',
    },
    { 
      id: 'settings',
      title: 'Paramètres', 
      icon: 'settings-outline' as const, 
      screen: 'AdminSettings' as const,
      color: COLORS.textMuted,
      description: 'Configuration de la plateforme',
    },
    { 
      id: 'interfaces',
      title: 'Gestion des interfaces', 
      icon: 'shapes-outline' as const, 
      screen: 'AdminInterfaces' as const,
      color: COLORS.primary,
      description: 'Activer, désactiver ou ajouter des types de boutiques',
    },
    { 
      id: 'points',
      title: 'Gestion des Points', 
      icon: 'star-outline' as const, 
      screen: 'AdminPoints' as const,
      color: COLORS.warning,
      description: 'Définir les quotas de points et récompenses',
    },
  ];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStats();
      await loadUnreadNotifications();
      await loadRecentActivity();
      await loadSystemAlerts();
    } finally {
      setRefreshing(false);
    }
  }, [loadStats, loadUnreadNotifications, loadRecentActivity]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        try {
          const sessionData = await authService.getSession();
          const s = sessionData.session;
          const email = s?.user?.email || (user as any)?.email;
          const role = (s?.user as any)?.user_metadata?.role || (user as any)?.user_metadata?.role;
          if (!s) {
            if (mounted) setConnectionLabel('Non connecté');
            return;
          }
          if (mounted) {
            setConnectionLabel(`Connecté: ${email || '—'}${role ? ` (${role})` : ''}`);
          }

          await loadStats();
          await loadUnreadNotifications();
          await loadRecentActivity();
          await loadSystemAlerts();
        } catch {
          if (mounted) setConnectionLabel('Non connecté');
        }
      };
      load();
      return () => {
        mounted = false;
      };
    }, [user, session, loadStats, loadUnreadNotifications, loadRecentActivity])
  );

  // navigation helpers for header and links
  const goToNotifications = () => navigation.navigate('AdminNotifications');
  const goToProfile = () => navigation.navigate('AdminProfile');
  const goToActivity = () => navigation.navigate('AdminActivity');
  const goToRevenueDetails = () => navigation.navigate('AdminRevenueDetails');

  const getActivityIcon = (type: Activity['type']): keyof typeof Ionicons.glyphMap => {
    const icons: Record<Activity['type'], keyof typeof Ionicons.glyphMap> = {
      user: 'person',
      store: 'storefront',
      order: 'cart',
      payment: 'cash',
      subscription: 'card',
    };
    return icons[type];
  };

  const getActivityColor = (type: Activity['type']) => {
    const colors = {
      user: COLORS.accent,
      store: COLORS.accent2,
      order: COLORS.success,
      payment: COLORS.warning,
      subscription: COLORS.info,
    };
    return colors[type];
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return 'arrow-up';
      case 'down': return 'arrow-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return COLORS.success;
      case 'down': return COLORS.danger;
      default: return COLORS.textMuted;
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      {loading && (
        <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm }}>
          <LoadingSpinner />
        </View>
      )}
      {/* Header avec animation */}
      <Animated.View 
        entering={FadeInDown.duration(600).springify()}
        style={styles.header}
      >
        <View>
          <Text style={styles.greeting}>Tableau de bord</Text>
          <Text style={styles.headerTitle}>Administrateur</Text>
          {!!connectionLabel && (
            <Text style={styles.connectionText}>{connectionLabel}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={goToNotifications}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>{unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileButton} onPress={goToProfile}>
            <Ionicons name="person" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* System Alerts Banner */}
      {systemAlerts.map((alert) => (
        <Animated.View 
          key={alert.key}
          entering={FadeInDown.duration(400)}
          style={[
            styles.alertBanner, 
            { backgroundColor: alert.severity === 'danger' ? COLORS.danger + '20' : COLORS.warning + '20' }
          ]}
        >
          <Ionicons 
            name={alert.severity === 'danger' ? 'alert-circle' : 'warning'} 
            size={20} 
            color={alert.severity === 'danger' ? COLORS.danger : COLORS.warning} 
          />
          <Text style={[
            styles.alertText, 
            { color: alert.severity === 'danger' ? COLORS.danger : COLORS.warning }
          ]}>
            {alert.message}
          </Text>
          <TouchableOpacity 
            onPress={() => systemAlertService.resolveAlert(alert.key).then(loadSystemAlerts)}
            style={styles.alertClose}
          >
            <Ionicons name="close" size={18} color={alert.severity === 'danger' ? COLORS.danger : COLORS.warning} />
          </TouchableOpacity>
        </Animated.View>
      ))}

      {/* Stats Cards avec animation */}
      <View style={styles.statsGrid}>
        {statCards.map((stat, index) => (
          <Animated.View
            key={stat.id}
            entering={FadeInUp.delay(index * 100).duration(500)}
            style={styles.statCardWrapper}
          >
            <Card style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: stat.color + '15' }]}>
                  <Ionicons name={stat.icon} size={22} color={stat.color} />
                </View>
                {stat.change && (
                  <View style={[
                    styles.changeBadge, 
                    { backgroundColor: getTrendColor(stat.trend) + '15' }
                  ]}>
                    <Ionicons 
                      name={getTrendIcon(stat.trend)} 
                      size={10} 
                      color={getTrendColor(stat.trend)} 
                    />
                    <Text style={[styles.changeText, { color: getTrendColor(stat.trend) }]}>
                      {stat.change}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statTitle}>{stat.title}</Text>
            </Card>
          </Animated.View>
        ))}
      </View>

      {/* Graphique des revenus - Version simplifiée */}
      <Animated.View entering={SlideInRight.delay(400)}>
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Évolution des revenus</Text>
            <TouchableOpacity onPress={goToRevenueDetails}>
              <Text style={styles.chartLink}>Voir détails</Text>
            </TouchableOpacity>
          </View>
          {revenueTimeline.length > 0 ? (
            <View style={{ height: 240, paddingRight: SPACING.md }}>
              <RevenueChart 
                data={chartData} 
                loading={loading} 
                timeRange="30d" 
                primaryColor={COLORS.accent} 
              />
            </View>
          ) : (
            <View style={[styles.simpleChart, { height: 220, justifyContent: 'center' }]}>
              <Text style={styles.chartLabel}>Aucune donnée disponible</Text>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Top Stores List */}
      {topStores.length > 0 && (
        <Animated.View entering={SlideInRight.delay(450)}>
          <Card style={styles.topStoresCard}>
            <Text style={styles.chartTitle}>Meilleures Boutiques (30j)</Text>
            {topStores.map((store, index) => (
              <View key={store.store_id} style={[styles.topStoreItem, index < topStores.length - 1 && styles.activityBorder]}>
                <View style={styles.topStoreRank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.topStoreInfo}>
                  <Text style={styles.topStoreName} numberOfLines={1}>{store.store_name}</Text>
                  <Text style={styles.topStoreRevenue}>{(store.total_revenue / 1000).toFixed(0)} k FCFA</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('AdminStores')}>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {/* Distribution - Version simplifiée */}
      <Animated.View entering={SlideInRight.delay(500)}>
        <Card style={styles.distributionCard}>
          <Text style={styles.chartTitle}>Distribution</Text>
          <View style={styles.distributionItems}>
            <View style={styles.distributionItem}>
              <View style={[styles.distributionDot, { backgroundColor: COLORS.accent }]} />
              <Text style={styles.distributionLabel}>Boutiques: {stats.totalStores}</Text>
            </View>
            <View style={styles.distributionItem}>
              <View style={[styles.distributionDot, { backgroundColor: COLORS.accent2 }]} />
              <Text style={styles.distributionLabel}>Utilisateurs: {stats.totalUsers}</Text>
            </View>
            <View style={styles.distributionItem}>
              <View style={[styles.distributionDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.distributionLabel}>Commandes: {stats.totalOrders}</Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* Actions rapides */}
      <Text style={styles.sectionTitle}>Actions rapides</Text>
      <View style={styles.menuGrid}>
        {menuItems.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeInDown.delay(600 + index * 100).duration(400)}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <View style={styles.menuHeader}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  {item.count !== undefined && (
                    <View style={[styles.countBadge, { backgroundColor: item.color + '15' }]}>
                      <Text style={[styles.countText, { color: item.color }]}>
                        {item.count}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Activité récente */}
      <Text style={styles.sectionTitle}>Activité récente</Text>
      <Card style={styles.activityCard}>
        {recentActivity.map((activity, index) => (
          <Animated.View
            key={activity.id}
            entering={FadeInDown.delay(700 + index * 50).duration(300)}
          >
            <TouchableOpacity 
              style={[
                styles.activityItem,
                index < recentActivity.length - 1 && styles.activityBorder
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.activityIcon, { backgroundColor: getActivityColor(activity.type) + '15' }]}>
                <Ionicons 
                  name={getActivityIcon(activity.type)} 
                  size={16} 
                  color={getActivityColor(activity.type)} 
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityMessage}>{activity.message}</Text>
                <View style={styles.activityDetails}>
                  {activity.user && (
                    <Text style={styles.activityUser}>{activity.user}</Text>
                  )}
                  {activity.amount && (
                    <Text style={styles.activityAmount}>
                      {activity.amount.toLocaleString()} FCFA
                    </Text>
                  )}
                  <Text style={styles.activityTime}>• {activity.time}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
        <TouchableOpacity style={styles.viewAllButton} onPress={goToActivity}>
          <Text style={styles.viewAllText}>Voir toute l'activité</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.accent} />
        </TouchableOpacity>
      </Card>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
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
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.bg,
  },
  greeting: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  connectionText: {
    marginTop: 4,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  notificationText: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.text,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  statCardWrapper: {
    width: '48%',
  },
  statCard: {
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)' }
      : {
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.06)',
          elevation: 1,
        }),
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    gap: 2,
  },
  changeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  statValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  statTitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  chartCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)' }
      : {
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.06)',
          elevation: 1,
        }),
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  chartTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  retryButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  alertText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  alertClose: {
    padding: 4,
  },
  chartLink: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '500',
  },
  simpleChart: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  chartBar: {
    height: 8,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  barSegment: {
    height: '100%',
    borderRadius: RADIUS.sm,
  },
  chartLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  distributionCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)' }
      : {
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.06)',
          elevation: 1,
        }),
  },
  distributionItems: {
    gap: SPACING.lg,
  },
  distributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  distributionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  distributionLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  menuGrid: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)' }
      : {
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.06)',
          elevation: 1,
        }),
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuContent: {
    flex: 1,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 2,
  },
  menuTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  countBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  countText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  menuDescription: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  activityCard: {
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)' }
      : {
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.06)',
          elevation: 1,
        }),
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
  },
  activityBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  activityDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  activityUser: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    fontWeight: '500',
  },
  activityAmount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewAllText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '500',
  },
  topStoresCard: {
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
  },
  topStoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  topStoreRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${COLORS.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  rankText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.accent,
  },
  topStoreInfo: {
    flex: 1,
  },
  topStoreName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  topStoreRevenue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    fontWeight: '600',
  },
});
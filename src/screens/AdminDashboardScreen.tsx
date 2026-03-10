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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
  SlideInRight,
} from 'react-native-reanimated';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOWS } from '../config/theme';
import { RootStackParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { supabase } from '../lib/supabase';
import { notificationService } from '../lib/notificationService';
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

  const loadStats = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [
        usersRes,
        storesRes,
        ordersRes,
        pendingOrdersRes,
        activeSubscriptionsRes,
        pendingPaymentsRes,
        overduePaymentsRes,
        paidStoresRes,
      ] = await Promise.all([
        supabase.from('users').select('id', { head: true, count: 'exact' }),
        supabase.from('stores').select('id', { head: true, count: 'exact' }),
        supabase.from('orders').select('id', { head: true, count: 'exact' }),
        supabase.from('orders').select('id', { head: true, count: 'exact' }).eq('status', 'pending'),
        supabase
          .from('stores')
          .select('id', { head: true, count: 'exact' })
          .in('subscription_status', ['active', 'trial']),
        supabase.from('stores').select('id', { head: true, count: 'exact' }).eq('billing_status', 'pending'),
        supabase.from('stores').select('id', { head: true, count: 'exact' }).eq('billing_status', 'overdue'),
        supabase.from('stores').select('subscription_price').eq('billing_status', 'paid'),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (storesRes.error) throw storesRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (pendingOrdersRes.error) throw pendingOrdersRes.error;
      if (activeSubscriptionsRes.error) throw activeSubscriptionsRes.error;
      if (pendingPaymentsRes.error) throw pendingPaymentsRes.error;
      if (overduePaymentsRes.error) throw overduePaymentsRes.error;
      if (paidStoresRes.error) throw paidStoresRes.error;

      const paidRevenue = (paidStoresRes.data || []).reduce((acc: number, row: any) => {
        const v = Number(row?.subscription_price || 0);
        return acc + (Number.isFinite(v) ? v : 0);
      }, 0);

      const pendingPayments = (pendingPaymentsRes.count || 0) + (overduePaymentsRes.count || 0);

      setStats({
        totalUsers: usersRes.count || 0,
        totalStores: storesRes.count || 0,
        totalOrders: ordersRes.count || 0,
        totalRevenue: paidRevenue,
        activeSubscriptions: activeSubscriptionsRes.count || 0,
        pendingOrders: pendingOrdersRes.count || 0,
        pendingPayments,
      });
    } catch (e) {
      console.error('load dashboard stats', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecentActivity = useCallback(async () => {
    if (!supabase) return;
    try {
      const [usersRes, storesRes, ordersRes, notificationsRes] = await Promise.all([
        supabase.from('users').select('full_name,created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('stores').select('name,created_at').order('created_at', { ascending: false }).limit(5),
        supabase
          .from('orders')
          .select('total_amount,created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('notifications').select('title,type,created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (storesRes.error) throw storesRes.error;
      if (ordersRes.error) throw ordersRes.error;
      const notificationsMissing =
        (notificationsRes as any)?.error?.code === 'PGRST205' ||
        String((notificationsRes as any)?.error?.message || '').toLowerCase().includes('could not find the table');
      if (notificationsRes.error && !notificationsMissing) throw notificationsRes.error;

      const items: Array<Activity & { _createdAt: string }> = [];

      (usersRes.data || []).forEach((u: any, idx: number) => {
        const createdAt = String(u?.created_at || '');
        items.push({
          id: `user-${idx}-${createdAt}`,
          type: 'user',
          message: 'Nouvel utilisateur inscrit',
          time: createdAt ? new Date(createdAt).toLocaleString() : '',
          user: String(u?.full_name || ''),
          _createdAt: createdAt,
        });
      });

      (storesRes.data || []).forEach((s: any, idx: number) => {
        const createdAt = String(s?.created_at || '');
        items.push({
          id: `store-${idx}-${createdAt}`,
          type: 'store',
          message: 'Nouvelle boutique créée',
          time: createdAt ? new Date(createdAt).toLocaleString() : '',
          user: String(s?.name || ''),
          _createdAt: createdAt,
        });
      });

      (ordersRes.data || []).forEach((o: any, idx: number) => {
        const createdAt = String(o?.created_at || '');
        items.push({
          id: `order-${idx}-${createdAt}`,
          type: 'order',
          message: 'Nouvelle commande passée',
          time: createdAt ? new Date(createdAt).toLocaleString() : '',
          amount: Number(o?.total_amount || 0),
          _createdAt: createdAt,
        });
      });

      if (!notificationsMissing) {
        (notificationsRes.data || []).forEach((n: any, idx: number) => {
          const createdAt = String(n?.created_at || '');
          const notifType = String(n?.type || 'system');
          const activityType: Activity['type'] =
            notifType === 'payment'
              ? 'payment'
              : notifType === 'order'
                ? 'order'
                : notifType === 'system'
                  ? 'subscription'
                  : 'payment';
          items.push({
            id: `notif-${idx}-${createdAt}`,
            type: activityType,
            message: String(n?.title || 'Notification'),
            time: createdAt ? new Date(createdAt).toLocaleString() : '',
            _createdAt: createdAt,
          });
        });
      }

      items.sort((a, b) => String(b._createdAt).localeCompare(String(a._createdAt)));
      setRecentActivity(items.slice(0, 5).map(({ _createdAt, ...rest }) => rest));
    } catch (e) {
      console.error('load recent activity', e);
    }
  }, []);

  const loadUnreadNotifications = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
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
    } catch (e) {
      console.error('load unread notifications', e);
    }
  }, []);

  // Chart data (simplifié pour éviter les erreurs d'import)
  const revenueData = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    values: [4500000, 5200000, 4800000, 6100000, 5900000, 7200000, 6800000],
  };

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
  ];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStats();
      await loadUnreadNotifications();
      await loadRecentActivity();
    } finally {
      setRefreshing(false);
    }
  }, [loadStats, loadUnreadNotifications, loadRecentActivity]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        try {
          if (!supabase) {
            if (mounted) setConnectionLabel('Supabase: non initialisé');
            return;
          }
          const { data } = await supabase.auth.getSession();
          const s = data.session;
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
            <Text style={styles.chartTitle}>Revenus hebdomadaires</Text>
            <TouchableOpacity onPress={goToRevenueDetails}>
              <Text style={styles.chartLink}>Voir détails</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.simpleChart}>
            <View style={styles.chartBar}>
              <View style={[styles.barSegment, { backgroundColor: COLORS.accent, width: '70%' }]} />
            </View>
            <Text style={styles.chartLabel}>7.0M FCFA cette semaine</Text>
          </View>
        </Card>
      </Animated.View>

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
    color: COLORS.white,
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
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
});
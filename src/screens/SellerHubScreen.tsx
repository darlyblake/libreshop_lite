import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Image,
  TextInput,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../hooks/useTheme';
import { useAuthStore, useStoreStore } from '../store';
import { storeService } from '../services/storeService';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { errorHandler } from '../utils/errorHandler';
import { supabase } from '../lib/supabase';
import { Store } from '../lib/supabase';

const formatAbbreviatedAmount = (value: number) => {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(1).replace('.', ',') + ' Md';
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace('.', ',') + ' M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(0) + ' k';
  }
  return value.toString();
};

export const SellerHubScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { width: windowWidth } = useWindowDimensions();
  const isMobileWidth = windowWidth < 768;
  const insets = useSafeAreaInsets();
  const { user, setUser, setSession } = useAuthStore();
  const { setStore } = useStoreStore();

  const { getColor: COLORS, spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE, isDark, toggleTheme } = useTheme();

  const styles = createStyles(COLORS, SPACING, RADIUS, FONT_SIZE, isMobileWidth);

  // Tabs: 'stores' | 'settings'
  const [activeTab, setActiveTab] = useState<'stores' | 'settings'>('stores');
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  
  // Real-time calculated stats
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    salesPerStore: {} as Record<string, number>,
    ordersPerStore: {} as Record<string, number>,
  });
  
  const [productsCount, setProductsCount] = useState({
    totalProducts: 0,
    productsPerStore: {} as Record<string, number>,
  });

  const [notificationCounts, setNotificationCounts] = useState<Record<string, number>>({});

  const [activityBreakdown, setActivityBreakdown] = useState({
    boutique: { sales: 0, orders: 0, items: 0, count: 0 },
    restaurantBar: { sales: 0, orders: 0, items: 0, count: 0 },
    hospitality: { sales: 0, orders: 0, items: 0, count: 0 },
  });

  // Settings form states
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadStoresAndData();
  }, [user?.id]);

  const loadStoresAndData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // 0. Fetch latest user profile from the database to keep local Zustand store and states synchronized
      try {
        const profile = await userService.getProfile(user.id);
        if (profile) {
          setFullName(profile.full_name || '');
          setPhone(profile.phone || '');
          setUser({ ...user, ...profile } as any);
        }
      } catch (err) {
        console.error('Failed to sync user profile in Hub:', err);
      }
      
      // 1. Fetch stores
      const userStores = await storeService.getStoresByUser(user.id);
      setStores(userStores);
      
      // If there are no stores, direct the user to create one
      if (userStores.length === 0) {
        setTimeout(() => {
          navigation.replace('SellerAddStore');
        }, 500);
        return;
      }

      const storeIds = userStores.map(s => s.id);

      // 2. Fetch notifications for user
      let unreadNotifs: any[] = [];
      try {
        const { data: notifs } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('read', false);
        unreadNotifs = notifs || [];
      } catch (err) {
        console.error('Failed to load notifications in Hub', err);
      }

      const notifCounts: Record<string, number> = {};
      storeIds.forEach(id => {
        notifCounts[id] = 0;
      });

      unreadNotifs.forEach(n => {
        const storeId = n.data?.storeId || n.data?.store_id;
        if (storeId && notifCounts[storeId] !== undefined) {
          notifCounts[storeId] += 1;
        } else {
          // Fallback distribution to keep it interesting
          if (storeIds[0]) {
            notifCounts[storeIds[0]] += 1;
          }
        }
      });
      setNotificationCounts(notifCounts);

      // 3. Fetch orders for stats
      let allOrders: any[] = [];
      try {
        const { data: ords } = await supabase
          .from('orders')
          .select('*')
          .in('store_id', storeIds);
        allOrders = ords || [];
      } catch (err) {
        console.error('Failed to load orders in Hub', err);
      }

      let totalSales = 0;
      let totalOrdersCount = allOrders.length;
      
      const salesPerStore: Record<string, number> = {};
      const ordersPerStore: Record<string, number> = {};
      
      storeIds.forEach(id => {
        salesPerStore[id] = 0;
        ordersPerStore[id] = 0;
      });

      allOrders.forEach(o => {
        if (o.status !== 'cancelled') {
          totalSales += Number(o.total_amount || 0);
          if (o.store_id && salesPerStore[o.store_id] !== undefined) {
            salesPerStore[o.store_id] += Number(o.total_amount || 0);
          }
        }
        if (o.store_id && ordersPerStore[o.store_id] !== undefined) {
          ordersPerStore[o.store_id] += 1;
        }
      });

      setStats({
        totalSales,
        totalOrders: totalOrdersCount,
        salesPerStore,
        ordersPerStore,
      });

      // 4. Fetch products count
      let allProducts: any[] = [];
      try {
        const { data: prods } = await supabase
          .from('products')
          .select('id, store_id')
          .in('store_id', storeIds);
        allProducts = prods || [];
      } catch (err) {
        console.error('Failed to load products in Hub', err);
      }

      const productsPerStore: Record<string, number> = {};
      storeIds.forEach(id => {
        productsPerStore[id] = 0;
      });
      allProducts.forEach(p => {
        if (p.store_id && productsPerStore[p.store_id] !== undefined) {
          productsPerStore[p.store_id] += 1;
        }
      });

      setProductsCount({
        totalProducts: allProducts.length,
        productsPerStore,
      });

      // 5. Calculate activity type breakdown
      const activityStats = {
        boutique: { sales: 0, orders: 0, items: 0, count: 0 },
        restaurantBar: { sales: 0, orders: 0, items: 0, count: 0 },
        hospitality: { sales: 0, orders: 0, items: 0, count: 0 },
      };

      userStores.forEach(s => {
        const type = s.store_type || 'general';
        const sSales = salesPerStore[s.id] || 0;
        const sOrders = ordersPerStore[s.id] || 0;
        const sItems = productsPerStore[s.id] || 0;

        if (type === 'general') {
          activityStats.boutique.sales += sSales;
          activityStats.boutique.orders += sOrders;
          activityStats.boutique.items += sItems;
          activityStats.boutique.count += 1;
        } else if (type === 'restaurant' || type === 'bar') {
          activityStats.restaurantBar.sales += sSales;
          activityStats.restaurantBar.orders += sOrders;
          activityStats.restaurantBar.items += sItems;
          activityStats.restaurantBar.count += 1;
        } else if (type === 'hotel' || type === 'logement') {
          activityStats.hospitality.sales += sSales;
          activityStats.hospitality.orders += sOrders;
          activityStats.hospitality.items += sItems;
          activityStats.hospitality.count += 1;
        }
      });
      setActivityBreakdown(activityStats);

    } catch (error) {
      errorHandler.handleDatabaseError(error as Error, 'Error loading stores in Hub');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStore = (selected: Store) => {
    setStore(selected);
    navigation.navigate('SellerTabs', { screen: 'SellerDashboard' });
  };

  const handleLogout = async () => {
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
              setStore(null);
              navigation.replace('Landing');
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de se déconnecter');
            }
          }
        }
      ]
    );
  };

  const handleSaveSettings = async () => {
    if (!user?.id) return;
    try {
      setSavingSettings(true);
      await authService.updateProfile(user.id, {
        full_name: fullName,
        phone: phone,
      });
      
      // Update auth store local state
      const updatedUser = { ...user, full_name: fullName, phone: phone };
      setUser(updatedUser as any);
      
      Alert.alert('Succès 🎉', 'Vos paramètres ont été mis à jour avec succès.');
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible de sauvegarder les modifications');
    } finally {
      setSavingSettings(false);
    }
  };

  const renderStoreCard = ({ item }: { item: Store }) => {
    const status = storeService.getSubscriptionStatus(item);
    const isExpired = status === 'expired';
    const isTrial = status === 'trial';
    const statusColor = isExpired ? COLORS.danger : isTrial ? COLORS.warning : COLORS.success;
    const statusLabel = isExpired ? 'Expiré' : isTrial ? 'Essai' : 'Actif';

    const notifs = notificationCounts[item.id] || 0;
    const storeSales = stats.salesPerStore[item.id] || 0;
    const storeProducts = productsCount.productsPerStore[item.id] || 0;

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: COLORS.border }]}
        activeOpacity={0.85}
        onPress={() => handleSelectStore(item)}
      >
        <LinearGradient
          colors={[COLORS.card, COLORS.bg]}
          style={StyleSheet.absoluteFillObject}
        />
        
        {/* Unread notifications count badge */}
        {notifs > 0 && (
          <View style={[styles.notifBadge, { backgroundColor: COLORS.danger }]}>
            <Text style={styles.notifBadgeText}>{notifs}</Text>
          </View>
        )}

        <View style={styles.cardTop}>
          <View style={[styles.logoContainer, { borderColor: COLORS.border }]}>
            {item.logo_url ? (
              <Image source={{ uri: item.logo_url }} style={styles.logoImage} />
            ) : (
              <Ionicons name="storefront" size={20} color={COLORS.primary} />
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={[styles.cardName, { color: COLORS.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.cardSlug, { color: COLORS.textMuted }]} numberOfLines={1}>
          @{item.slug}
        </Text>

        <View style={[styles.cardDivider, { backgroundColor: COLORS.border }]} />

        {/* Small stats breakdown per store */}
        <View style={styles.cardStatsRow}>
          <View style={styles.cardStat}>
            <Text style={[styles.cardStatValue, { color: COLORS.text }]}>
              {storeProducts}
            </Text>
            <Text style={[styles.cardStatLabel, { color: COLORS.textMuted }]}>
              Prod.
            </Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={[styles.cardStatValue, { color: COLORS.accent }]}>
              {formatAbbreviatedAmount(storeSales)} F
            </Text>
            <Text style={[styles.cardStatLabel, { color: COLORS.textMuted }]}>
              Ventes
            </Text>
          </View>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: COLORS.border, marginVertical: SPACING.xs }]} />

        <View style={styles.cardFooter}>
          <Text style={[styles.footerText, { color: COLORS.textMuted }]}>
            {item.subscription_plan || 'Plan Standard'}
          </Text>
          <Ionicons name="arrow-forward-circle" size={20} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: COLORS.bg }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: COLORS.bg }]}>
      
      {/* PROFESSIONAL UPPER HUB BRAND BANNER */}
      <View style={[styles.bannerContainer, { borderBottomColor: COLORS.border }]}>
        <LinearGradient
          colors={['#4f46e5', '#8b5cf6', '#d946ef']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.bannerOverlay}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.bannerBrand}>LibreShop Business</Text>
              <Text style={styles.bannerSubtitle}>Espace Client Multi-Boutiques</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* User profile resume inside banner */}
          <View style={styles.bannerProfile}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {(user?.full_name || 'V').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{user?.full_name || 'Vendeur'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* INTERACTIVE NAVIGATION TABS */}
      <View style={[styles.tabBar, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'stores' && styles.tabItemActive]}
          onPress={() => setActiveTab('stores')}
        >
          <Ionicons 
            name="grid-outline" 
            size={18} 
            color={activeTab === 'stores' ? COLORS.primary : COLORS.textMuted} 
          />
          <Text style={[styles.tabText, { color: activeTab === 'stores' ? COLORS.primary : COLORS.textMuted }]}>
            Mes Boutiques
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons 
            name="settings-outline" 
            size={18} 
            color={activeTab === 'settings' ? COLORS.primary : COLORS.textMuted} 
          />
          <Text style={[styles.tabText, { color: activeTab === 'settings' ? COLORS.primary : COLORS.textMuted }]}>
            Paramètres Compte
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'stores' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* UNIVERSAL UNIFIED GENERAL STATISTICS */}
          <Text style={[styles.sectionTitle, { color: COLORS.text, marginBottom: SPACING.md }]}>
            Statistiques Générales Consolidées
          </Text>

          {!isMobileWidth ? (
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.statIconContainer, { backgroundColor: COLORS.accent + '15' }]}>
                  <Ionicons name="cash-outline" size={20} color={COLORS.accent} />
                </View>
                <Text style={[styles.statValue, { color: COLORS.text }]} numberOfLines={1}>
                  {formatAbbreviatedAmount(stats.totalSales)} FCFA
                </Text>
                <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>
                  Revenus Cumulés
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.statIconContainer, { backgroundColor: COLORS.primary + '15' }]}>
                  <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
                </View>
                <Text style={[styles.statValue, { color: COLORS.text }]} numberOfLines={1}>
                  {stats.totalOrders}
                </Text>
                <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>
                  Transactions & Réservations
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.statIconContainer, { backgroundColor: COLORS.success + '15' }]}>
                  <Ionicons name="folder-open-outline" size={20} color={COLORS.success} />
                </View>
                <Text style={[styles.statValue, { color: COLORS.text }]} numberOfLines={1}>
                  {productsCount.totalProducts}
                </Text>
                <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>
                  Offres & Catalogue
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.statIconContainer, { backgroundColor: '#a855f715' }]}>
                  <Ionicons name="business-outline" size={20} color="#a855f7" />
                </View>
                <Text style={[styles.statValue, { color: COLORS.text }]} numberOfLines={1}>
                  {stores.length}
                </Text>
                <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>
                  Établissements Actifs
                </Text>
              </View>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statsScroll}
              style={{ marginBottom: SPACING.md }}
            >
              <View style={[styles.statCardMobile, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.statIconContainer, { backgroundColor: COLORS.accent + '15' }]}>
                  <Ionicons name="cash-outline" size={20} color={COLORS.accent} />
                </View>
                <Text style={[styles.statValue, { color: COLORS.text }]} numberOfLines={1}>
                  {formatAbbreviatedAmount(stats.totalSales)} FCFA
                </Text>
                <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>
                  Revenus Cumulés
                </Text>
              </View>

              <View style={[styles.statCardMobile, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.statIconContainer, { backgroundColor: COLORS.primary + '15' }]}>
                  <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
                </View>
                <Text style={[styles.statValue, { color: COLORS.text }]} numberOfLines={1}>
                  {stats.totalOrders}
                </Text>
                <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>
                  Transactions
                </Text>
              </View>

              <View style={[styles.statCardMobile, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.statIconContainer, { backgroundColor: COLORS.success + '15' }]}>
                  <Ionicons name="folder-open-outline" size={20} color={COLORS.success} />
                </View>
                <Text style={[styles.statValue, { color: COLORS.text }]} numberOfLines={1}>
                  {productsCount.totalProducts}
                </Text>
                <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>
                  Offres & Catalogue
                </Text>
              </View>

              <View style={[styles.statCardMobile, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.statIconContainer, { backgroundColor: '#a855f715' }]}>
                  <Ionicons name="business-outline" size={20} color="#a855f7" />
                </View>
                <Text style={[styles.statValue, { color: COLORS.text }]} numberOfLines={1}>
                  {stores.length}
                </Text>
                <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>
                  Établissements Actifs
                </Text>
              </View>
            </ScrollView>
          )}

          {/* DETAILED STATISTICS BY BUSINESS SECTOR (ACTIVITY TYPE) */}
          <Text style={[styles.sectionTitle, { color: COLORS.text, marginBottom: SPACING.md, marginTop: SPACING.xs }]}>
            📊 Activité Détaillée par Secteur
          </Text>

          <View style={styles.breakdownRow}>
            {activityBreakdown.boutique.count > 0 && (
              <View style={[styles.breakdownCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={styles.breakdownHeader}>
                  <View style={[styles.breakdownIconWrapper, { backgroundColor: '#3b82f615' }]}>
                    <Ionicons name="basket" size={18} color="#3b82f6" />
                  </View>
                  <Text style={[styles.breakdownTitle, { color: COLORS.text }]}>Commerce & Vente ({activityBreakdown.boutique.count})</Text>
                </View>
                <View style={styles.breakdownBody}>
                  <View style={styles.breakdownRowItem}>
                    <View style={styles.breakdownRowLeft}>
                      <Ionicons name="cash-outline" size={14} color={COLORS.accent} />
                      <Text style={[styles.breakdownRowLbl, { color: COLORS.textSoft }]}>Volume de ventes</Text>
                    </View>
                    <Text style={[styles.breakdownRowVal, { color: COLORS.text }]}>
                      {formatAbbreviatedAmount(activityBreakdown.boutique.sales)} F
                    </Text>
                  </View>
                  
                  <View style={styles.breakdownRowItem}>
                    <View style={styles.breakdownRowLeft}>
                      <Ionicons name="receipt-outline" size={14} color={COLORS.primary} />
                      <Text style={[styles.breakdownRowLbl, { color: COLORS.textSoft }]}>Commandes validées</Text>
                    </View>
                    <Text style={[styles.breakdownRowVal, { color: COLORS.text }]}>
                      {activityBreakdown.boutique.orders}
                    </Text>
                  </View>

                  <View style={styles.breakdownRowItem}>
                    <View style={styles.breakdownRowLeft}>
                      <Ionicons name="cube-outline" size={14} color={COLORS.success} />
                      <Text style={[styles.breakdownRowLbl, { color: COLORS.textSoft }]}>Produits actifs</Text>
                    </View>
                    <Text style={[styles.breakdownRowVal, { color: COLORS.text }]}>
                      {activityBreakdown.boutique.items}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {activityBreakdown.restaurantBar.count > 0 && (
              <View style={[styles.breakdownCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={styles.breakdownHeader}>
                  <View style={[styles.breakdownIconWrapper, { backgroundColor: '#ef444415' }]}>
                    <Ionicons name="restaurant" size={18} color="#ef4444" />
                  </View>
                  <Text style={[styles.breakdownTitle, { color: COLORS.text }]}>Restos & Boissons ({activityBreakdown.restaurantBar.count})</Text>
                </View>
                <View style={styles.breakdownBody}>
                  <View style={styles.breakdownRowItem}>
                    <View style={styles.breakdownRowLeft}>
                      <Ionicons name="cash-outline" size={14} color={COLORS.accent} />
                      <Text style={[styles.breakdownRowLbl, { color: COLORS.textSoft }]}>Volume de recettes</Text>
                    </View>
                    <Text style={[styles.breakdownRowVal, { color: COLORS.text }]}>
                      {formatAbbreviatedAmount(activityBreakdown.restaurantBar.sales)} F
                    </Text>
                  </View>
                  
                  <View style={styles.breakdownRowItem}>
                    <View style={styles.breakdownRowLeft}>
                      <Ionicons name="beer-outline" size={14} color={COLORS.primary} />
                      <Text style={[styles.breakdownRowLbl, { color: COLORS.textSoft }]}>Couverts & Verres</Text>
                    </View>
                    <Text style={[styles.breakdownRowVal, { color: COLORS.text }]}>
                      {activityBreakdown.restaurantBar.orders}
                    </Text>
                  </View>

                  <View style={styles.breakdownRowItem}>
                    <View style={styles.breakdownRowLeft}>
                      <Ionicons name="restaurant-outline" size={14} color={COLORS.success} />
                      <Text style={[styles.breakdownRowLbl, { color: COLORS.textSoft }]}>Plats & Boissons</Text>
                    </View>
                    <Text style={[styles.breakdownRowVal, { color: COLORS.text }]}>
                      {activityBreakdown.restaurantBar.items}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {activityBreakdown.hospitality.count > 0 && (
              <View style={[styles.breakdownCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={styles.breakdownHeader}>
                  <View style={[styles.breakdownIconWrapper, { backgroundColor: '#10b98115' }]}>
                    <Ionicons name="bed" size={18} color="#10b981" />
                  </View>
                  <Text style={[styles.breakdownTitle, { color: COLORS.text }]}>Hôtels & Hébergement ({activityBreakdown.hospitality.count})</Text>
                </View>
                <View style={styles.breakdownBody}>
                  <View style={styles.breakdownRowItem}>
                    <View style={styles.breakdownRowLeft}>
                      <Ionicons name="cash-outline" size={14} color={COLORS.accent} />
                      <Text style={[styles.breakdownRowLbl, { color: COLORS.textSoft }]}>Revenus locatifs</Text>
                    </View>
                    <Text style={[styles.breakdownRowVal, { color: COLORS.text }]}>
                      {formatAbbreviatedAmount(activityBreakdown.hospitality.sales)} F
                    </Text>
                  </View>
                  
                  <View style={styles.breakdownRowItem}>
                    <View style={styles.breakdownRowLeft}>
                      <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                      <Text style={[styles.breakdownRowLbl, { color: COLORS.textSoft }]}>Réservations</Text>
                    </View>
                    <Text style={[styles.breakdownRowVal, { color: COLORS.text }]}>
                      {activityBreakdown.hospitality.orders}
                    </Text>
                  </View>

                  <View style={styles.breakdownRowItem}>
                    <View style={styles.breakdownRowLeft}>
                      <Ionicons name="key-outline" size={14} color={COLORS.success} />
                      <Text style={[styles.breakdownRowLbl, { color: COLORS.textSoft }]}>Chambres & Biens</Text>
                    </View>
                    <Text style={[styles.breakdownRowVal, { color: COLORS.text }]}>
                      {activityBreakdown.hospitality.items}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* COMPACT STORE GRID */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Mes Enseignes ({stores.length})
            </Text>
            <TouchableOpacity 
              style={[styles.addStoreBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => navigation.navigate('SellerAddStore')}
            >
              <Ionicons name="add" size={16} color="#ffffff" />
              <Text style={styles.addStoreText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {stores.length === 0 ? (
            <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>
              Aucun établissement enregistré.
            </Text>
          ) : (
            <View style={styles.storesContainer}>
              {stores.map((item) => (
                <View key={item.id} style={styles.storeCardWrapper}>
                  {renderStoreCard({ item })}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        /* PROFESSIONAL ACCOUNT SETTINGS MANAGEMENT TAB */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.settingsCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <Text style={[styles.settingsTitle, { color: COLORS.text }]}>
              Informations Personnelles
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: COLORS.textSoft }]}>Nom Complet</Text>
              <TextInput
                style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
                placeholder="Votre nom complet"
                placeholderTextColor={COLORS.textMuted}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: COLORS.textSoft }]}>Numéro de Téléphone</Text>
              <TextInput
                style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
                placeholder="ex: +241 77 12 34 56"
                placeholderTextColor={COLORS.textMuted}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          <View style={[styles.settingsCard, { backgroundColor: COLORS.card, borderColor: COLORS.border, marginTop: SPACING.md }]}>
            <Text style={[styles.settingsTitle, { color: COLORS.text }]}>
              Préférences de l'Espace
            </Text>

            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={[styles.switchLabel, { color: COLORS.text }]}>Mode Sombre</Text>
                <Text style={[styles.switchDesc, { color: COLORS.textMuted }]}>
                  Activer ou désactiver le thème sombre
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={isDark ? COLORS.accent : '#f4f3f4'}
              />
            </View>

            <View style={[styles.cardDivider, { backgroundColor: COLORS.border, marginVertical: SPACING.sm }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={[styles.switchLabel, { color: COLORS.text }]}>Notifications Email</Text>
                <Text style={[styles.switchDesc, { color: COLORS.textMuted }]}>
                  Recevoir des alertes de ventes par email
                </Text>
              </View>
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={emailNotifications ? COLORS.accent : '#f4f3f4'}
              />
            </View>

            <View style={[styles.cardDivider, { backgroundColor: COLORS.border, marginVertical: SPACING.sm }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={[styles.switchLabel, { color: COLORS.text }]}>Notifications Push</Text>
                <Text style={[styles.switchDesc, { color: COLORS.textMuted }]}>
                  Alertes instantanées sur vos terminaux mobiles
                </Text>
              </View>
                  <Switch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                trackColor={{ false: '#767577', true: COLORS.primary }}
                thumbColor={pushNotifications ? COLORS.accent : '#f4f3f4'}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: COLORS.primary }]}
            onPress={handleSaveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const createStyles = (COLORS: any, SPACING: any, RADIUS: any, FONT_SIZE: any, isMobileWidth: boolean) => StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Banner upper panel
  bannerContainer: {
    height: 170,
    overflow: 'hidden',
    borderBottomWidth: 1,
  },
  bannerOverlay: {
    padding: SPACING.lg,
    justifyContent: 'space-between',
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerBrand: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  logoutBtn: {
    padding: SPACING.xs,
  },
  bannerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },

  // Interactive Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    height: 50,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: '100%',
  },
  tabItemActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#4f46e5',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },

  scrollContent: {
    padding: SPACING.md,
  },

  // Aggregated stats cards layout
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: '48%',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    ...Platform.select({
      web: { width: '23%', marginHorizontal: 2 },
    }),
  },
  statCardMobile: {
    width: 145,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    marginRight: 6,
  },
  statsScroll: {
    paddingRight: SPACING.md,
    gap: 6,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  breakdownCard: {
    width: isMobileWidth ? '100%' : '48%',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  breakdownIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: 8,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  breakdownBody: {
    marginTop: SPACING.xs,
    gap: 4,
  },
  breakdownRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breakdownRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownRowLbl: {
    fontSize: 11,
    fontWeight: '600',
  },
  breakdownRowVal: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Store grid & cards
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  addStoreText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyText: {
    textAlign: 'center',
    padding: SPACING.xl,
    fontSize: 13,
  },
  storesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -4,
    width: '100%',
  },
  storeCardWrapper: {
    width: isMobileWidth ? '100%' : '33.3%',
    padding: 4,
  },
  card: {
    width: '100%',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 1,
  },
  cardSlug: {
    fontSize: 11,
  },
  cardDivider: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardStat: {
    flex: 1,
  },
  cardStatValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardStatLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Account Settings Form
  settingsCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: SPACING.md,
  },
  inputContainer: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  switchDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    gap: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});

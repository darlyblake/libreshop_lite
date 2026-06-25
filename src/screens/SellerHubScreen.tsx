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
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '../hooks/useTheme';
import { useAuthStore, useStoreStore } from '../store';
import { storeService } from '../services/storeService';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { errorHandler } from '../utils/errorHandler';
import { supabase } from '../lib/supabase';
import { sessionStorage } from '../lib/storage';
import { Store, WithdrawalRequest, KYCStatus } from '../lib/supabase';
import { financeService, WalletStats, Transaction } from '../services/financeService';
import { pointsService } from '../services/pointsService';
import { SellerSubscriptionsScreen } from './SellerSubscriptionsScreen';

const formatAbbreviatedAmount = (value: number | undefined | null) => {
  const safeValue = value || 0;
  if (safeValue >= 1_000_000_000) {
    return (safeValue / 1_000_000_000).toFixed(1).replace('.', ',') + ' Md';
  }
  if (safeValue >= 1_000_000) {
    return (safeValue / 1_000_000).toFixed(1).replace('.', ',') + ' M';
  }
  if (safeValue >= 1_000) {
    return (safeValue / 1_000).toFixed(0) + ' k';
  }
  return safeValue.toString();
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

  // Tabs: 'stores' | 'finance' | 'subscriptions' | 'settings'
  const [activeTab, setActiveTab] = useState<'stores' | 'finance' | 'subscriptions' | 'settings'>('stores');
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  
  // Finance states
  const [walletStats, setWalletStats] = useState<WalletStats>({ availableBalance: 0, pendingBalance: 0, totalWithdrawn: 0 });
  const [kycStatus, setKycStatus] = useState<KYCStatus>('unverified');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [showBalance, setShowBalance] = useState(true);

  // Withdraw Modal State
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('Orange Money');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const withdrawMethods = ['Orange Money', 'MTN MoMo', 'Wave', 'Virement Bancaire'];
  
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
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Points & Referral states
  const [userPoints, setUserPoints] = useState(0);
  const [userReferralCode, setUserReferralCode] = useState<string | null>(null);

  useEffect(() => {
    loadStoresAndData();
  }, [user?.id]);

  const loadStoresAndData = async () => {
    if (!user?.id || !supabase) return;
    try {
      setLoading(true);

      // 0. Fetch latest user profile from the database to keep local Zustand store and states synchronized
      try {
        const profile = await userService.getProfile(user.id);
        if (profile) {
          setFullName(profile.full_name || '');
          setPhone(profile.phone || '');
          setUser({ ...user, ...profile });
        }
      } catch (err) {
        console.error('Failed to sync user profile in Hub:', err);
      }
      
      // 0.5 Fetch user points
      try {
        const pointsInfo = await pointsService.getUserPointsInfo(user.id);
        setUserPoints(pointsInfo.points || 0);
        
        if (pointsInfo.referral_code) {
          setUserReferralCode(pointsInfo.referral_code);
        } else {
          // Génération automatique du code de parrainage unique pour le vendeur
          const randomCode = 'LBS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          await pointsService.setReferralCode(user.id, randomCode);
          setUserReferralCode(randomCode);
        }
      } catch (err) {
        console.error('Failed to load points info:', err);
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

      // 6. Fetch Finance Data
      if (storeIds.length > 0) {
        const mainStoreId = storeIds[0];
        try {
          const [kyc, txs, wds] = await Promise.all([
            financeService.getKYCStatus(mainStoreId),
            financeService.getRecentTransactions(mainStoreId),
            financeService.getWithdrawals(mainStoreId),
          ]);
          setKycStatus(kyc);
          setTransactions(txs);
          setWithdrawals(wds);
          
          let totalAvail = 0;
          let totalPend = 0;
          let totalWithd = 0;
          
          for (const sid of storeIds) {
             const ws = await financeService.getWalletStats(sid);
             totalAvail += ws.availableBalance;
             totalPend += ws.pendingBalance;
             totalWithd += ws.totalWithdrawn;
          }
          setWalletStats({ availableBalance: totalAvail, pendingBalance: totalPend, totalWithdrawn: totalWithd });
        } catch (err) {
          console.error('Failed to load finance data in Hub', err);
        }
      }

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

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const performLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await authService.signOut();
      setUser(null);
      setSession(null);
      setStore(null);
      navigation.replace('Landing');
    } catch (e) {
      if (Platform.OS === 'web') {
        alert('Impossible de se déconnecter');
      } else {
        Alert.alert('Erreur', 'Impossible de se déconnecter');
      }
    }
  };

  const handleWithdrawRequest = async () => {
    if (kycStatus !== 'verified') {
      Alert.alert(
        'Vérification requise',
        'Vous devez faire vérifier votre compte (KYC) avant de pouvoir effectuer un retrait.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Vérifier mon compte', onPress: () => navigation.navigate('SellerKYC') }
        ]
      );
      return;
    }

    const amountNum = parseInt(withdrawAmount.replace(/\s/g, ''), 10);
    
    if (!amountNum || amountNum < 5000) {
      Alert.alert('Erreur', 'Le montant minimum de retrait est de 5000 FCFA.');
      return;
    }
    
    if (amountNum > walletStats.availableBalance) {
      Alert.alert('Erreur', 'Solde insuffisant pour ce montant.');
      return;
    }

    if (!withdrawPhone || withdrawPhone.length < 8) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide pour la réception.');
      return;
    }

    try {
      setIsSubmittingWithdraw(true);
      const mainStoreId = stores[0].id; // using first store for withdrawal logic
      await financeService.requestWithdrawal(mainStoreId, amountNum, withdrawMethod, { phone: withdrawPhone });
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      Alert.alert('Succès', 'Votre demande de retrait a été soumise avec succès.');
      loadStoresAndData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de soumettre la demande de retrait.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const getKycBanner = () => {
    if (kycStatus === 'verified') return null;
    
    const isPending = kycStatus === 'pending';
    const color = isPending ? COLORS.warning : COLORS.danger;
    
    return (
      <View style={[styles.kycBanner, { backgroundColor: color + '15', borderColor: color }]}>
        <Ionicons name={isPending ? 'time' : 'alert-circle'} size={24} color={color} />
        <View style={styles.kycTextContainer}>
          <Text style={[styles.kycTitle, { color }]}>
            {isPending ? 'Vérification en cours' : 'Compte non vérifié'}
          </Text>
          <Text style={styles.kycDescription}>
            {isPending 
              ? 'Vos documents sont en cours de vérification par notre équipe.' 
              : 'Vérifiez votre identité pour débloquer les retraits LibrePay.'}
          </Text>
        </View>
        {!isPending && (
          <TouchableOpacity 
            style={[styles.kycBtn, { backgroundColor: color }]}
            onPress={() => navigation.navigate('SellerKYC')}
          >
            <Text style={styles.kycBtnText}>Vérifier</Text>
          </TouchableOpacity>
        )}
      </View>
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
      setUser(updatedUser);
      
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity 
                style={[styles.logoutBtn, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }]} 
                onPress={async () => {
                  await sessionStorage.saveUserRole('client');
                  navigation.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
                }}
              >
                <Ionicons name="cart-outline" size={16} color="#ffffff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Mode Acheteur</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                <View style={{
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: 'rgba(251, 191, 36, 0.2)', 
                  paddingHorizontal: 8, 
                  paddingVertical: 4, 
                  borderRadius: 16,
                  marginLeft: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(251, 191, 36, 0.5)'
                }}>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={{ color: '#FBBF24', fontSize: 13, fontWeight: '900', marginLeft: 4 }}>
                    {userPoints} XP
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* INTERACTIVE NAVIGATION TABS */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: SPACING.sm }}
          style={[styles.tabBar, { borderBottomColor: COLORS.border }]}
        >
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
            Boutiques
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'finance' && styles.tabItemActive]}
          onPress={() => setActiveTab('finance')}
        >
          <Ionicons 
            name="wallet-outline" 
            size={18} 
            color={activeTab === 'finance' ? COLORS.primary : COLORS.textMuted} 
          />
          <Text style={[styles.tabText, { color: activeTab === 'finance' ? COLORS.primary : COLORS.textMuted }]}>
            LibrePay
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'subscriptions' && styles.tabItemActive]}
          onPress={() => setActiveTab('subscriptions')}
        >
          <Ionicons 
            name="card-outline" 
            size={18} 
            color={activeTab === 'subscriptions' ? COLORS.primary : COLORS.textMuted} 
          />
          <Text style={[styles.tabText, { color: activeTab === 'subscriptions' ? COLORS.primary : COLORS.textMuted }]}>
            Abonnements
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
        </ScrollView>
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
      ) : activeTab === 'finance' ? (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scrollContent, { opacity: 0.2 }]} showsVerticalScrollIndicator={false} scrollEnabled={false}>
            {/* SOLDE CARD */}
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.balanceCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceLabel}>Solde Global Disponible</Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
                  <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={22} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceAmount}>
                {showBalance ? `${formatAbbreviatedAmount(walletStats.availableBalance)} F` : '••••••••'}
              </Text>
              
              <View style={styles.balanceDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>En attente</Text>
                  <Text style={styles.detailValue}>{formatAbbreviatedAmount(walletStats.pendingBalance)} F</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Revenus Totaux</Text>
                  <Text style={[styles.detailValue, { color: '#10b981' }]}>{formatAbbreviatedAmount(walletStats.totalWithdrawn)} F</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.withdrawBtn, (kycStatus !== 'verified' || walletStats.availableBalance <= 0) && { opacity: 0.5 }]} 
                onPress={() => kycStatus === 'verified' && walletStats.availableBalance > 0 && setWithdrawModalVisible(true)}
                disabled={kycStatus !== 'verified' || walletStats.availableBalance <= 0}
              >
                <Ionicons name="cash-outline" size={20} color="#fff" />
                <Text style={styles.withdrawBtnText}>Demander un Retrait</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* KYC BANNER */}
            {getKycBanner()}

            {/* WITHDRAWALS HISTORY */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Historique des Retraits</Text>
            </View>
            
            <View style={[styles.historyCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              {withdrawals.length === 0 ? (
                <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>Aucun retrait pour le moment.</Text>
              ) : (
                withdrawals.map((w, index) => {
                  let statusColor = COLORS.warning;
                  let statusText = 'En cours';
                  if (w.status === 'completed') { statusColor = COLORS.success; statusText = 'Terminé'; }
                  if (w.status === 'rejected') { statusColor = COLORS.danger; statusText = 'Rejeté'; }
                  
                  return (
                    <View key={w.id} style={[styles.wdItem, index < withdrawals.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                      <View style={styles.wdInfo}>
                        <Text style={styles.wdMethod}>{w.method}</Text>
                        <Text style={styles.wdDate}>{new Date(w.created_at).toLocaleDateString('fr-FR')}</Text>
                      </View>
                      <View style={styles.wdStatusContainer}>
                        <Text style={styles.wdAmount}>{formatAbbreviatedAmount(w.amount)} F</Text>
                        <Text style={[styles.wdStatus, { color: statusColor }]}>{statusText}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10 }]}>
            <View style={{ backgroundColor: 'rgba(30, 41, 59, 0.95)', padding: 32, borderRadius: 24, alignItems: 'center', maxWidth: 320, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(99, 102, 241, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="wallet" size={32} color="#818cf8" />
              </View>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>LibrePay</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                La gestion de vos revenus centralisée et les paiements en ligne arrivent très prochainement sur LibreShop.
              </Text>
              <View style={{ marginTop: 24, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                <Text style={{ color: '#a5b4fc', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Fonctionnalité à venir</Text>
              </View>
            </View>
          </View>
        </View>
      ) : activeTab === 'subscriptions' ? (
        <SellerSubscriptionsScreen isEmbedded={true} />
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

            <View style={[styles.settingsCard, { backgroundColor: COLORS.card, borderColor: COLORS.border, marginTop: SPACING.md }]}>
              <Text style={[styles.settingsTitle, { color: COLORS.text }]}>
                Points & Fidélité
              </Text>

              <View style={[styles.switchRow, { marginBottom: SPACING.sm }]}>
                <View style={styles.switchTextContainer}>
                  <Text style={[styles.switchLabel, { color: COLORS.text }]}>Solde actuel</Text>
                  <Text style={[styles.switchDesc, { color: COLORS.textMuted }]}>
                    Vos points LibreShop cumulés
                  </Text>
                </View>
                <View style={{ backgroundColor: COLORS.accent + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full }}>
                  <Text style={{ color: COLORS.accent, fontWeight: '800', fontSize: 16 }}>{userPoints} pts</Text>
                </View>
              </View>

              <View style={[styles.cardDivider, { backgroundColor: COLORS.border, marginVertical: SPACING.sm }]} />

              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={[styles.switchLabel, { color: COLORS.text }]}>Code de Parrainage</Text>
                  <Text style={[styles.switchDesc, { color: COLORS.textMuted }]}>
                    Invitez des vendeurs et gagnez des points
                  </Text>
                </View>
              </View>
              
              <View style={{ marginTop: SPACING.sm, backgroundColor: COLORS.bg, padding: SPACING.sm, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                {userReferralCode ? (
                  <>
                    <Text style={{ color: COLORS.text, fontWeight: '700', letterSpacing: 2, fontSize: 16 }}>{userReferralCode}</Text>
                    <TouchableOpacity onPress={async () => {
                      await Clipboard.setStringAsync(userReferralCode);
                      Alert.alert('Succès', 'Code de parrainage copié !');
                    }}>
                      <Ionicons name="copy-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: COLORS.danger, marginTop: SPACING.xl, marginBottom: SPACING.xxl }]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Se déconnecter</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

      {/* CUSTOM LOGOUT CONFIRMATION MODAL */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <View style={[styles.modalHeaderIcon, { backgroundColor: COLORS.danger + '15' }]}>
              <Ionicons name="log-out-outline" size={28} color={COLORS.danger} />
            </View>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>Déconnexion</Text>
            <Text style={[styles.modalMessage, { color: COLORS.textSoft }]}>
              Êtes-vous sûr de vouloir vous déconnecter de votre compte professionnel ?
            </Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: COLORS.border }]}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: COLORS.text }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: COLORS.danger }]}
                onPress={performLogout}
              >
                <Text style={styles.modalConfirmText}>Déconnexion</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* WITHDRAW MODAL */}
      <Modal
        visible={withdrawModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: COLORS.bg }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg, width: '100%' }}>
              <Text style={styles.modalTitle}>Demande de retrait</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={{ width: '100%' }}>
              <Text style={[styles.modalLabel, { color: COLORS.textMuted }]}>Méthode de retrait</Text>
              <View style={styles.methodContainer}>
                {withdrawMethods.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodBtn, withdrawMethod === m && styles.methodBtnActive, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
                    onPress={() => setWithdrawMethod(m)}
                  >
                    <Text style={[styles.methodBtnText, withdrawMethod === m ? styles.methodBtnTextActive : { color: COLORS.text }]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalLabel, { color: COLORS.textMuted }]}>Numéro de réception</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: COLORS.card, borderColor: COLORS.border, color: COLORS.text }]}
                placeholder="Ex: 0700000000"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                value={withdrawPhone}
                onChangeText={setWithdrawPhone}
              />

              <Text style={[styles.modalLabel, { color: COLORS.textMuted }]}>Montant (FCFA)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: COLORS.card, borderColor: COLORS.border, color: COLORS.text }]}
                placeholder="Ex: 15000"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
              
              <Text style={styles.modalHelper}>
                Solde global disponible : {walletStats.availableBalance.toLocaleString('fr-FR')} F
              </Text>

              <TouchableOpacity 
                style={[{ backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.sm }, isSubmittingWithdraw && { opacity: 0.7 }]}
                onPress={handleWithdrawRequest}
                disabled={isSubmittingWithdraw}
              >
                {isSubmittingWithdraw ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Confirmer le retrait</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    width: '90%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
      },
    }),
  },
  modalHeaderIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalCancelText: {
    fontWeight: '700',
    fontSize: 13,
  },
  modalConfirmButton: {},
  modalConfirmText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  modalLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: SPACING.sm },
  methodContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: { padding: 10, borderRadius: RADIUS.md, borderWidth: 1 },
  methodBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  methodBtnText: { fontSize: 12, fontWeight: '600' },
  methodBtnTextActive: { color: COLORS.primary },
  modalInput: { height: 44, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, marginTop: 4, fontSize: 14 },
  modalHelper: { fontSize: 11, textAlign: 'right', marginTop: 4, color: COLORS.textMuted },

  // Finance styles
  balanceCard: { 
    borderRadius: RADIUS.xl, 
    padding: SPACING.xl, 
    marginBottom: SPACING.lg, 
    elevation: 8, 
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.15, shadowRadius: 15 },
      android: { shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.15, shadowRadius: 15 },
      web: { boxShadow: '0px 10px 15px rgba(0,0,0,0.15)' }
    })
  },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginBottom: SPACING.md },
  balanceDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.lg },
  detailItem: { alignItems: 'center', flex: 1 },
  detailLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  detailDivider: { width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.1)' },
  withdrawBtn: { backgroundColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: RADIUS.lg, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  withdrawBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  kycBanner: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderWidth: 1, borderRadius: RADIUS.lg, marginBottom: SPACING.lg },
  kycTextContainer: { flex: 1, marginLeft: SPACING.sm },
  kycTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  kycDescription: { fontSize: 12, color: COLORS.textMuted },
  kycBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm },
  kycBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  historyCard: { borderRadius: RADIUS.lg, borderWidth: 1, paddingHorizontal: SPACING.md },
  wdItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  wdInfo: { flex: 1 },
  wdMethod: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  wdDate: { fontSize: 12, color: COLORS.textMuted },
  wdStatusContainer: { alignItems: 'flex-end' },
  wdAmount: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  wdStatus: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }
});

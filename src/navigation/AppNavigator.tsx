import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform, StatusBar, AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Imports optimisés en direct pour les écrans clients
import { LandingScreen } from '../screens/LandingScreen';
import { ClientOnboardingScreen } from '../screens/ClientOnboardingScreen';
import { AboutStaticScreen } from '../screens/AboutStaticScreen';
import { SellerAuthScreen } from '../screens/SellerAuthScreen';
import { ClientAuthScreen } from '../screens/ClientAuthScreen';
import { ClientAuthModal } from '../components/ClientAuthModal';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { SellerEmailConfirmScreen } from '../screens/SellerEmailConfirmScreen';
import { SubscriptionExpiredScreen } from '../screens/SubscriptionExpiredScreen';
import { ClientHomeScreen } from '../screens/ClientHomeScreen';
import { ClientOrdersScreen } from '../screens/ClientOrdersScreen';
import { ClientSearchScreen } from '../screens/ClientSearchScreen';
import { ClientMapScreen } from '../screens/ClientMapScreen';
import { WishlistScreen } from '../screens/WishlistScreen';
import { ClientProfileScreen } from '../screens/ClientProfileScreen';
import { ClientDetailScreen } from '../screens/ClientDetailScreen';
import { ClientOrderDetailScreen } from '../screens/ClientOrderDetailScreen';
import { ClientEditScreen } from '../screens/ClientEditScreen';
import { ClientAllStoresScreen } from '../screens/ClientAllStoresScreen';
import { ClientAllProductsScreen } from '../screens/ClientAllProductsScreen';
import { StoreDetailScreen } from '../screens/StoreDetailScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { CartScreen } from '../screens/CartScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { PaymentScreen } from '../screens/PaymentScreen';
import { BulkPaymentScreen } from '../screens/BulkPaymentScreen';
import { ConfirmationScreen } from '../screens/ConfirmationScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PersonalInfoScreen } from '../screens/PersonalInfoScreen';
import { AddressScreen } from '../screens/AddressScreen';
import { SecurityScreen } from '../screens/SecurityScreen';
import { HelpScreen } from '../screens/HelpScreen';
import { AccountSuspendedScreen } from '../screens/AccountSuspendedScreen';
import ReviewScreen from '../screens/ReviewScreen';

// HOC pour le lazy loading des écrans lourds (vendeurs / admin)
const lazyLoad = (importFn: () => Promise<any>, exportName: string) => {
  const LazyComponent = (props: any) => {
    const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);

    useEffect(() => {
      let active = true;
      importFn().then((module) => {
        if (active) {
          setComponent(() => module[exportName] || module.default);
        }
      }).catch(err => {
        console.error(`Failed to lazy load ${exportName}:`, err);
      });
      return () => { active = false; };
    }, []);

    if (!Component) {
      return <LoadingScreen />;
    }

    return <Component {...props} />;
  };
  
  LazyComponent.displayName = `Lazy(${exportName})`;
  return LazyComponent;
};

// Lazy loaded Seller screens
const SellerDashboardScreen = lazyLoad(() => import('../screens/SellerDashboardScreen'), 'SellerDashboardScreen');
const SellerProductsScreen = lazyLoad(() => import('../screens/SellerProductsScreen'), 'SellerProductsScreen');
const SellerOrdersScreen = lazyLoad(() => import('../screens/SellerOrdersScreen'), 'SellerOrdersScreen');
const SellerCollectionScreen = lazyLoad(() => import('../screens/SellerCollectionScreen'), 'SellerCollectionScreen');
const SellerClientsScreen = lazyLoad(() => import('../screens/SellerClientsScreen'), 'SellerClientsScreen');
const SellerStoreScreen = lazyLoad(() => import('../screens/SellerStoreScreen'), 'SellerStoreScreen');
const SellerAddStoreScreen = lazyLoad(() => import('../screens/SellerAddStoreScreen'), 'SellerAddStoreScreen');
const SellerCaisseScreen = lazyLoad(() => import('../screens/SellerCaisseScreen'), 'SellerCaisseScreen');
const SellerAddProductScreen = lazyLoad(() => import('../screens/SellerAddProductScreen'), 'SellerAddProductScreen');
const SellerEditProductScreen = lazyLoad(() => import('../screens/SellerEditProductScreen'), 'SellerEditProductScreen');
const SellerEditCollectionScreen = lazyLoad(() => import('../screens/SellerEditCollectionScreen'), 'SellerEditCollectionScreen');
const SellerCollectionProductsScreen = lazyLoad(() => import('../screens/SellerCollectionProductsScreen'), 'SellerCollectionProductsScreen');
const SellerOrderDetailScreen = lazyLoad(() => import('../screens/SellerOrderDetailScreen'), 'SellerOrderDetailScreen');
const SellerProductActionsScreen = lazyLoad(() => import('../screens/SellerProductActionsScreen'), 'SellerProductActionsScreen');
const SellerSaleScreen = lazyLoad(() => import('../screens/SellerSaleScreen'), 'SellerSaleScreen');
const SellerLowStockScreen = lazyLoad(() => import('../screens/SellerLowStockScreen'), 'SellerLowStockScreen');
const SellerAnalyticsScreen = lazyLoad(() => import('../screens/SellerAnalyticsScreen'), 'SellerAnalyticsScreen');
const SellerReportsScreen = lazyLoad(() => import('../screens/SellerReportsScreen'), 'SellerReportsScreen');
const SellerStockHistoryScreen = lazyLoad(() => import('../screens/SellerStockHistoryScreen'), 'SellerStockHistoryScreen');
const SellerRefundsScreen = lazyLoad(() => import('../screens/SellerRefundsScreen'), 'SellerRefundsScreen');
const SellerAccountingScreen = lazyLoad(() => import('../screens/SellerAccountingScreen'), 'SellerAccountingScreen');
const SellerReturnsScreen = lazyLoad(() => import('../screens/SellerReturnsScreen'), 'SellerReturnsScreen');
const SellerCouponsScreen = lazyLoad(() => import('../screens/SellerCouponsScreen'), 'SellerCouponsScreen');
const SellerFinanceScreen = lazyLoad(() => import('../screens/SellerFinanceScreen'), 'SellerFinanceScreen');
const SellerKYCScreen = lazyLoad(() => import('../screens/SellerKYCScreen'), 'SellerKYCScreen');
const SellerHubScreen = lazyLoad(() => import('../screens/SellerHubScreen'), 'SellerHubScreen');

// Lazy loaded Admin screens
const AdminDashboardScreen = lazyLoad(() => import('../screens/AdminDashboardScreen'), 'AdminDashboardScreen');
const AdminSettingsScreen = lazyLoad(() => import('../screens/AdminSettingsScreen'), 'AdminSettingsScreen');
const AdminUsersScreen = lazyLoad(() => import('../screens/AdminUsersScreen'), 'AdminUsersScreen');
const AdminStoresScreen = lazyLoad(() => import('../screens/AdminStoresScreen'), 'AdminStoresScreen');
const AdminCategoriesScreen = lazyLoad(() => import('../screens/AdminCategoriesScreen'), 'AdminCategoriesScreen');
const AdminSubscriptionsScreen = lazyLoad(() => import('../screens/AdminSubscriptionsScreen'), 'AdminSubscriptionsScreen');
const AdminPaymentsScreen = lazyLoad(() => import('../screens/AdminPaymentsScreen'), 'AdminPaymentsScreen');
const AdminAdministratorsScreen = lazyLoad(() => import('../screens/AdminAdministratorsScreen'), 'AdminAdministratorsScreen');
const AdminFeaturedScreen = lazyLoad(() => import('../screens/AdminFeaturedScreen'), 'AdminFeaturedScreen');
const AdminReportsScreen = lazyLoad(() => import('../screens/AdminReportsScreen'), 'AdminReportsScreen');
const AdminAnalyticsScreen = lazyLoad(() => import('../screens/AdminAnalyticsScreen'), 'AdminAnalyticsScreen');
const AdminProfileScreen = lazyLoad(() => import('../screens/AdminProfileScreen'), 'AdminProfileScreen');
const AdminActivityScreen = lazyLoad(() => import('../screens/AdminActivityScreen'), 'AdminActivityScreen');
const AdminRevenueDetailsScreen = lazyLoad(() => import('../screens/AdminRevenueDetailsScreen'), 'AdminRevenueDetailsScreen');
const AdminNotificationsScreen = lazyLoad(() => import('../screens/AdminNotificationsScreen'), 'AdminNotificationsScreen');
const AdminSendNotificationScreen = lazyLoad(() => import('../screens/AdminSendNotificationScreen'), 'AdminSendNotificationScreen');
const AdminAPKUpdatesScreen = lazyLoad(() => import('../screens/AdminAPKUpdatesScreen'), 'AdminAPKUpdatesScreen');
const AdminCountriesScreen = lazyLoad(() => import('../screens/AdminCountriesScreen'), 'AdminCountriesScreen');
const AdminCitiesScreen = lazyLoad(() => import('../screens/AdminCitiesScreen'), 'AdminCitiesScreen');
const AdminBannersScreen = lazyLoad(() => import('../screens/AdminBannersScreen'), 'AdminBannersScreen');
const AdminBannerFormScreen = lazyLoad(() => import('../screens/AdminBannerFormScreen'), 'AdminBannerFormScreen');
const AdminAgentScreen = lazyLoad(() => import('../screens/AdminAgentScreen'), 'AdminAgentScreen');
const AdminInterfacesScreen = lazyLoad(() => import('../screens/AdminInterfacesScreen'), 'AdminInterfacesScreen');
const AdminPointsScreen = lazyLoad(() => import('../screens/AdminPointsScreen'), 'AdminPointsScreen');

// Other Lazy loaded screens
const FeaturesScreen = lazyLoad(() => import('../screens/FeaturesScreen'), 'FeaturesScreen');
const PricingScreen = lazyLoad(() => import('../screens/PricingScreen'), 'PricingScreen');
const SellerChangePlanScreen = lazyLoad(() => import('../screens/SellerChangePlanScreen'), 'SellerChangePlanScreen');
const SellerSubscriptionsScreen = lazyLoad(() => import('../screens/SellerSubscriptionsScreen'), 'SellerSubscriptionsScreen');
const SellerAgentChatScreen = lazyLoad(() => import('../screens/SellerAgentChatScreen'), 'SellerAgentChatScreen');

import { RootStackParamList, ClientTabParamList, SellerTabParamList, UserRole, NotificationPayload } from './types';
import { useAuthStore } from '../store';
import { sessionStorage, onboardingStorage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { authService } from '../services/authService';
import { storeService } from '../services/storeService';
import { useNotificationStore } from '../store/notificationStore';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useTheme } from '../hooks/useTheme';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useSettingsStore } from '../store/settingsStore';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ClientTab = createBottomTabNavigator<ClientTabParamList>();
const SellerTab = createBottomTabNavigator<SellerTabParamList>();

// Types
interface NotificationSound {
  play: () => void;
}

// Configuration des liens profonds
const linking = (() => {
  const prefixes: string[] = [];
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Prefer explicit origin on web to avoid generic prefix parsing issues
    prefixes.push(window.location.origin);
  }
  // Fallback / universal expo url
  prefixes.push(Linking.createURL('/'));

  return {
    prefixes,
    config: {
      screens: {
        ClientTabs: {
          screens: {
            ClientHome: '',
            ClientOrders: 'orders',
            ClientSearch: 'search',
            Wishlist: 'wishlist',
          }
        },
        SellerTabs: {
          path: 'SellerTabs',
          screens: {
            SellerDashboard: 'SellerDashboard',
            SellerProducts: 'SellerProducts',
            SellerOrders: 'SellerOrders',
            SellerCollection: 'SellerCollection',
            SellerClients: 'SellerClients',
            SellerStore: 'SellerStore',
          }
        },
        AdminDashboard: 'AdminDashboard',
        Landing: 'welcome',
        About: 'about',
        SellerEmailConfirm: 'auth/confirm',
        Checkout: 'Checkout',
        Payment: 'Payment',
        StoreDetail: 'store/:slug?',
        ProductDetail: 'product/:productId',
        ClientOrderDetail: 'ClientOrderDetail/:orderId',
        SellerOrderDetail: 'SellerOrderDetail/:orderId',
        SellerAddStore: 'SellerAddStore',
        SellerAddProduct: 'SellerAddProduct',
        SellerHub: 'SellerHub',
        SellerAnalytics: 'SellerAnalytics',
        SellerReports: 'SellerReports',
        SellerLowStock: 'SellerLowStock',
        SellerRefunds: 'SellerRefunds',
        SellerCoupons: 'SellerCoupons',
        SellerFinance: 'SellerFinance',
        SellerAccounting: 'SellerAccounting',
        SellerKYC: 'SellerKYC',
        Notifications: 'Notifications',
        Cart: 'Cart',
      },
    },
  } as const;
})();

// Écran de chargement (thème dynamique)
const LoadingScreen: React.FC = () => {
  const { getColor } = useTheme();
  return (
    <View style={[styles.loadingContainer, { backgroundColor: getColor.bg }]}>
      <Ionicons name="cart-outline" size={50} color={getColor.accent} />
    </View>
  );
};

// Hook personnalisé pour la gestion responsive
const useResponsiveTabBar = () => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isSmallPhone = width < 375;

  return {
    isLandscape,
    tabBarHeight: Platform.OS === 'ios' ? (isLandscape ? 60 : 83) : 70,
    bottomPadding: Platform.OS === 'ios' ? (isLandscape ? 10 : 25) : 15,
    iconSize: isSmallPhone ? 20 : 24,
    labelSize: isSmallPhone ? 9 : 11,
    showLabels: width > 350,
  };
};

// Hook personnalisé pour les notifications sonores
const useNotificationSound = () => {
  const playNotificationSound = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (hapticError) {
        errorHandler.handle(hapticError instanceof Error ? hapticError : new Error(String(hapticError)), 'NotificationFeedback', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      }
    }
  }, []);

  return { playNotificationSound };
};

// Hook personnalisé pour la vérification d'abonnement
const useSubscriptionCheck = () => {
  const checkSubscription = useCallback(async (userId: string): Promise<boolean> => {
    const TIMEOUT_MS = 15000;
    
    const performCheck = async (): Promise<boolean> => {
      try {
        if (!userId || !supabase) {
          errorHandler.handle(new Error('Missing userId or supabase client'), 'SubscriptionCheck', ErrorCategory.SYSTEM, ErrorSeverity.HIGH);
          return true;
        }

        // Vérification du store
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('id, subscription_end, subscription_status, name')
          .eq('user_id', userId)
          .maybeSingle();

        if (storeError) {
          errorHandler.handleDatabaseError(storeError, 'SubscriptionCheck', 'stores subscription query');
          return true;
        }

        if (!store) {
          return false; // Nouveau vendeur
        }

        // Vérification du statut via le service centralisé
        const status = storeService.getSubscriptionStatus(store);
        
        if (status === 'expired' || status === 'cancelled') {
          return true;
        }

        return false;
      } catch (error) {
        errorHandler.handleDatabaseError(error as Error, 'SubscriptionCheck');
        return true;
      }
    };

    return Promise.race([
      performCheck(),
      new Promise<boolean>((resolve) => 
        setTimeout(() => resolve(true), TIMEOUT_MS)
      ),
    ]);
  }, []);

  return { checkSubscription };
};

// Navigation Client
const ClientTabs: React.FC = React.memo(() => {
  const { getColor } = useTheme();
  const { tabBarHeight, bottomPadding, iconSize, labelSize, showLabels } = useResponsiveTabBar();
  const unreadOrdersCount = useNotificationStore((state) => 
    state.notifications.filter(n => !n.read && n.type === 'order').length
  );

  const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, [string, string]> = {
      ClientHome: ['home', 'home-outline'],
      ClientOrders: ['receipt', 'receipt-outline'],
      ClientSearch: ['search', 'search-outline'],
      Wishlist: ['heart', 'heart-outline'],
    };
    
    const [focusedIcon, outlineIcon] = icons[routeName] || ['home', 'home-outline'];
    return focused ? focusedIcon as keyof typeof Ionicons.glyphMap : outlineIcon as keyof typeof Ionicons.glyphMap;
  };

  return (
    <ClientTab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
          <Ionicons 
            name={getIconName(route.name, focused)} 
            size={iconSize} 
            color={color} 
          />
        ),
        tabBarActiveTintColor: getColor.accent,
        tabBarInactiveTintColor: getColor.textMuted,
        tabBarStyle: {
          backgroundColor: getColor.bg,
          borderTopColor: getColor.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 5,
          elevation: 8,
          ...Platform.select({
            web: { boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)' },
            default: {
              boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)',
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: labelSize,
          fontWeight: '500',
          marginTop: 2,
          display: showLabels ? 'flex' : 'none',
        },
        tabBarItemStyle: { paddingVertical: 5 },
        headerShown: false,
      })}
    >
      <ClientTab.Screen name="ClientHome" component={ClientHomeScreen} options={{ title: 'Accueil' }} />
      <ClientTab.Screen 
        name="ClientOrders" 
        component={ClientOrdersScreen} 
        options={{ 
          title: 'Commandes',
          tabBarBadge: unreadOrdersCount > 0 ? unreadOrdersCount : undefined,
          tabBarBadgeStyle: { backgroundColor: getColor.accent, fontSize: 10 }
        }} 
      />
      <ClientTab.Screen name="ClientSearch" component={ClientSearchScreen} options={{ title: 'Recherche' }} />
      <ClientTab.Screen name="Wishlist" component={WishlistScreen} options={{ title: 'Favoris' }} />
    </ClientTab.Navigator>
  );
});

// Navigation Vendeur
const SellerTabs: React.FC = React.memo(() => {
  const { getColor } = useTheme();
  const { tabBarHeight, bottomPadding, iconSize, labelSize, showLabels, isLandscape } = useResponsiveTabBar();

  const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, [string, string]> = {
      SellerDashboard: ['grid', 'grid-outline'],
      SellerProducts: ['cube', 'cube-outline'],
      SellerOrders: ['receipt', 'receipt-outline'],
      SellerCollection: ['folder', 'folder-outline'],
      SellerClients: ['people', 'people-outline'],
      SellerStore: ['storefront', 'storefront-outline'],
    };
    
    const [focusedIcon, outlineIcon] = icons[routeName] || ['home', 'home-outline'];
    return focused ? focusedIcon as keyof typeof Ionicons.glyphMap : outlineIcon as keyof typeof Ionicons.glyphMap;
  };

  const isLandscapeIOS = isLandscape && Platform.OS === 'ios';

  return (
    <SellerTab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
          <Ionicons 
            name={getIconName(route.name, focused)} 
            size={iconSize} 
            color={color} 
          />
        ),
        tabBarActiveTintColor: getColor.accent,
        tabBarInactiveTintColor: getColor.textMuted,
        tabBarStyle: {
          backgroundColor: getColor.bg,
          borderTopColor: getColor.border,
          borderTopWidth: 1,
          height: isLandscapeIOS ? 60 : tabBarHeight,
          paddingBottom: isLandscapeIOS ? 5 : bottomPadding,
          paddingTop: 5,
          ...(!isLandscapeIOS && {
            elevation: 8,
            ...Platform.select({
              web: { boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)' },
              default: {
                boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)',
              },
            }),
          }),
        },
        tabBarLabelStyle: {
          fontSize: isLandscapeIOS ? 9 : labelSize,
          fontWeight: '500',
          marginTop: 2,
          display: isLandscapeIOS ? 'flex' : (showLabels ? 'flex' : 'none'),
        },
        tabBarItemStyle: isLandscapeIOS ? {
          paddingVertical: 5,
          width: 'auto',
          minWidth: 70,
        } : { paddingVertical: 5 },
        tabBarScrollEnabled: isLandscapeIOS,
        headerShown: false,
      })}
    >
      <SellerTab.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ title: 'Dashboard' }} />
      <SellerTab.Screen name="SellerProducts" component={SellerProductsScreen} options={{ title: 'Produits' }} />
      <SellerTab.Screen name="SellerOrders" component={SellerOrdersScreen} options={{ title: 'Commandes' }} />
      <SellerTab.Screen name="SellerCollection" component={SellerCollectionScreen} options={{ title: 'Collections' }} />
      <SellerTab.Screen name="SellerClients" component={SellerClientsScreen} options={{ title: 'Clients' }} />
      <SellerTab.Screen name="SellerStore" component={SellerStoreScreen} options={{ title: 'Boutique' }} />
    </SellerTab.Navigator>
  );
});

// Navigateur principal
export const AppNavigator: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('ClientTabs');
  const appState = useRef(AppState.currentState);

  // Auth store avec fallback sécurisé
  const authStore = useAuthStore();
  const { user, setUser, setSession, isLoading, setLoading } = authStore || {
    user: null,
    setUser: () => {},
    setSession: () => {},
    isLoading: false,
    setLoading: () => {},
  };

  const addNotification = useNotificationStore((state) => state.addNotification);
  const { theme, getColor: COLORS } = useTheme();
  const { playNotificationSound } = useNotificationSound();
  const { checkSubscription } = useSubscriptionCheck();
  const loadAppSettings = useSettingsStore((state) => state.loadSettings);
  
  // Charger les paramètres de l'application au démarrage
  useEffect(() => {
    loadAppSettings();
  }, [loadAppSettings]);

  // Enregistrement des notifications push
  usePushNotifications(user?.id);

  // Gestion des notifications en temps réel
  useEffect(() => {
    if (!supabase?.channel || !user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        async (payload: NotificationPayload) => {
          try {
            if (payload.new && payload.new.user_id === user.id) {
              addNotification(payload.new);
              await playNotificationSound();
            }
          } catch (error) {
            errorHandler.handle(error as Error, 'NotificationHandling', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [user?.id, addNotification, playNotificationSound]);

  // Gestion de l'état de l'application
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Rafraîchir les données si nécessaire
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Fallback Polling for notifications optimisé
  const { unreadCount, setNotifications } = useNotificationStore();
  const unreadCountRef = useRef(unreadCount);

  // Sync ref with store
  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!user?.id) return;
    
    let pollingInProgress = false;
    
    // Check fonction pour le polling
    const checkNotifications = async () => {
      try {
        // Ne pas poll si hors ligne
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        
        // Optimisation web : ne pas poll si la page n'est pas visible
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        
        // Optimisation mobile : ne pas poll si l'app n'est pas active
        if (appState.current !== 'active') return;

        if (pollingInProgress) return;
        pollingInProgress = true;

        const { notificationService } = await import('../services/notificationService');
        const count = await notificationService.getUnreadCount(user.id);
        
        if (count > unreadCountRef.current) {
          const notifs = await notificationService.getByUser(user.id);
          setNotifications(notifs);
          await playNotificationSound();
        } else if (count < unreadCountRef.current) {
          const notifs = await notificationService.getByUser(user.id);
          setNotifications(notifs);
        }
      } catch (err) {
        // Ignorer silencieusement
      } finally {
        pollingInProgress = false;
      }
    };

    // Vérifier immédiatement au chargement
    checkNotifications();

    // Polling toutes les 45 secondes au lieu de 15s pour éviter la surcharge réseau signalée par l'utilisateur
    const interval = setInterval(checkNotifications, 45000);

    return () => clearInterval(interval);
  }, [user?.id, playNotificationSound, setNotifications]);

  // Restauration de session - Version optimisée
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      setLoading(true);

      try {
        console.log('🔄 [restoreSession] Démarrage...');

        if (!supabase?.auth) {
          const onboardingCompleted = await onboardingStorage.isOnboardingCompleted();
          if (isMounted) setInitialRoute(onboardingCompleted ? 'ClientTabs' : 'ClientOnboarding');
          return;
        }

        // 1. Récupération de la session
        let session = null;
        const hasHashToken = typeof window !== 'undefined' &&
                            (window.location.hash.includes('access_token') ||
                             window.location.search.includes('access_token'));

        if (hasHashToken) {
          // Polling court pour token dans l'URL
          for (let i = 0; i < 12; i++) {  // ~1.2s max
            const sessionResult = await Promise.race([
              supabase.auth.getSession(),
              new Promise<{ data: any, error: any }>((resolve) => setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 500))
            ]);
            if (sessionResult.data?.session) {
              session = sessionResult.data.session;
              break;
            }
            await new Promise(r => setTimeout(r, 100));
          }
        } else {
          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise<{ data: any, error: any }>((resolve) => setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 3000))
          ]);
          session = sessionResult.data?.session;
        }

        if (session?.user && isMounted) {
          // 2. Récupération du profil utilisateur avec timeout
          let userData = await Promise.race([
            authService.getCurrentUser(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
          ]);
          
          // Fallback sur session.user si l'appel réseau échoue (ex: extension chrome, lenteur réseau, timeout)
          if (!userData && session.user) {
            console.log('⚠️ [restoreSession] Fallback sur session.user local');
            userData = session.user;
          }

          if (userData) {
            setUser(userData as any);
            setSession(session);

            const role = (userData as any)?.user_metadata?.role ||
                        (userData as any)?.app_metadata?.role;

            if (role) await sessionStorage.saveUserRole(String(role));

            const route = await getInitialRouteForRole(role as UserRole, userData.id);
            const onboardingCompleted = await onboardingStorage.isOnboardingCompleted();

            if (isMounted) {
              setInitialRoute(route === 'ClientTabs' && !onboardingCompleted
                ? 'ClientOnboarding'
                : route);
            }
            console.log('✅ [restoreSession] Session restaurée avec succès');
            return;
          }
        }

        // Pas de session → mode invité
        const onboardingCompleted = await onboardingStorage.isOnboardingCompleted();
        if (isMounted) {
          setInitialRoute(onboardingCompleted ? 'ClientTabs' : 'ClientOnboarding');
        }

      } catch (error) {
        console.error('❌ [restoreSession] Erreur:', error);
        errorHandler.handleAuthError(error as Error, 'SessionRestoration');

        if (isMounted) {
          const onboardingCompleted = await onboardingStorage.isOnboardingCompleted();
          setInitialRoute(onboardingCompleted ? 'ClientTabs' : 'ClientOnboarding');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsReady(true);
        }
      }
    };

    restoreSession();

    return () => { isMounted = false; };
  }, []); // Dépendances vides = une seule fois au montage

  // Écoute des changements d'authentification
  useEffect(() => {
    if (!supabase?.auth) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (!session?.user) {
            setUser(null);
            setSession(null);
            setInitialRoute('ClientTabs');
            return;
          }

          setUser(session.user as any);
          setSession(session);

          const role = (session.user as any)?.user_metadata?.role || 
                      (session.user as any)?.app_metadata?.role;

          const route = await getInitialRouteForRole(role as UserRole, session.user.id);
          setInitialRoute(route);
        } catch (error) {
          errorHandler.handleAuthError(error as Error, 'AuthStateChange');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Écoute en temps réel des nouvelles notifications (base de données)
  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel(`public:notifications:user_id=eq.${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotification = payload.new as any;
          useNotificationStore.getState().addNotification(newNotification);
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [user]);

  // Helper pour déterminer la route initiale
  const getInitialRouteForRole = async (role: UserRole, userId: string): Promise<keyof RootStackParamList> => {
    if (!userId || !supabase) {
      return role === 'seller' ? 'SellerHub' : 'ClientTabs';
    }

    try {
      // Faire les checks en parallèle avec un timeout pour éviter le blocage infini
      const networkChecks = Promise.all([
        supabase.from('users').select('status').eq('id', userId).maybeSingle(),
        role === 'seller' ?
          supabase.from('stores').select('id').eq('user_id', userId).maybeSingle() : null,
      ]);

      const timeoutPromise = new Promise<[any, any]>((resolve) => 
        setTimeout(() => resolve([{ data: null }, { data: null }]), 3000)
      );

      const [dbUserCheck, dbStoreCheck] = await Promise.race([networkChecks, timeoutPromise]);
      const userCheck = dbUserCheck || { data: null };
      const storeCheck = dbStoreCheck || { data: null };

      const pendingAction = await AsyncStorage.getItem('@libreshop_pending_action');
      const intent = await AsyncStorage.getItem('@libreshop_auth_intent');

      // Suspended ?
      if (userCheck.data?.status === 'suspended') return 'AccountSuspended';

      // Pending checkout ?
      if (pendingAction) {
        const action = JSON.parse(pendingAction);
        if (action.type === 'CHECKOUT' || action.type === 'BUY_NOW') {
          await AsyncStorage.removeItem('@libreshop_pending_action');
          return 'Checkout';
        }
      }

      // Intent auth
      if (intent === 'client') {
        await AsyncStorage.removeItem('@libreshop_auth_intent');
        return 'ClientTabs';
      } else if (intent === 'seller') {
        await AsyncStorage.removeItem('@libreshop_auth_intent');
        return 'SellerTabs';
      }

      // Seller sans store ?
      if (role === 'seller' && !storeCheck?.data) {
        // Si on est déjà sur une page vendeur (URL contient 'Seller'), ne pas rediriger vers SellerAddStore
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        if (currentPath.includes('Seller') && !currentPath.includes('SellerAddStore')) {
          return 'SellerTabs';
        }
        return 'SellerAddStore';
      }

      return role === 'admin' ? 'AdminDashboard' : 'ClientTabs';

    } catch (error) {
      console.error('Error in getInitialRouteForRole:', error);
      return role === 'seller' ? 'SellerHub' : 'ClientTabs';
    }
  };

  if (!isReady || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer linking={linking}>
      <StatusBar
        barStyle={initialRoute === 'Landing' ? 'light-content' : 'dark-content'}
        backgroundColor={initialRoute === 'Landing' ? 'transparent' : '#ffffff'}
        translucent={Platform.OS === 'android' || initialRoute === 'Landing'}
      />
      <ClientAuthModal />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        {/* Routes publiques */}
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="ClientOnboarding" component={ClientOnboardingScreen} />
        <Stack.Screen name="About" component={AboutStaticScreen} options={{ title: 'À propos' }} />
        <Stack.Screen name="SellerAuth" component={SellerAuthScreen} />
        <Stack.Screen name="ClientAuth" component={ClientAuthScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="SellerEmailConfirm" component={SellerEmailConfirmScreen} />
        <Stack.Screen name="SubscriptionExpired" component={SubscriptionExpiredScreen} />
        
        {/* Routes principales */}
        <Stack.Screen name="ClientTabs" component={ClientTabs} />
        <Stack.Screen name="SellerTabs" component={SellerTabs} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        
        {/* Routes clients */}
        <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
        <Stack.Screen name="ClientOrderDetail" component={ClientOrderDetailScreen} />
        <Stack.Screen name="ClientEdit" component={ClientEditScreen} />
        <Stack.Screen name="ClientAllStores" component={ClientAllStoresScreen} />
        <Stack.Screen name="ClientAllProducts" component={ClientAllProductsScreen} />
        <Stack.Screen name="ClientMap" component={ClientMapScreen} />
        <Stack.Screen name="StoreDetail" component={StoreDetailScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="BulkPayment" component={BulkPaymentScreen} />
        <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
        <Stack.Screen name="Address" component={AddressScreen} />
        <Stack.Screen name="Security" component={SecurityScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
        <Stack.Screen name="AccountSuspended" component={AccountSuspendedScreen} />
        <Stack.Screen name="ClientProfile" component={ClientProfileScreen} />
        <Stack.Screen name="Review" component={ReviewScreen} />
        
        {/* Routes vendeurs */}
        <Stack.Screen name="SellerAddStore" component={SellerAddStoreScreen} />
        <Stack.Screen name="SellerCaisse" component={SellerCaisseScreen} />
        <Stack.Screen name="SellerAddProduct" component={SellerAddProductScreen} />
        <Stack.Screen name="SellerEditProduct" component={SellerEditProductScreen} />
        <Stack.Screen name="SellerEditCollection" component={SellerEditCollectionScreen} />
        <Stack.Screen name="SellerCollectionProducts" component={SellerCollectionProductsScreen} />
        <Stack.Screen name="SellerOrderDetail" component={SellerOrderDetailScreen} />
        <Stack.Screen name="SellerProductActions" component={SellerProductActionsScreen} />
        <Stack.Screen name="SellerSale" component={SellerSaleScreen} />
        <Stack.Screen name="SellerLowStock" component={SellerLowStockScreen} />
        <Stack.Screen name="SellerAnalytics" component={SellerAnalyticsScreen} />
        <Stack.Screen name="SellerReports" component={SellerReportsScreen} />
        <Stack.Screen name="SellerStockHistory" component={SellerStockHistoryScreen} />
        <Stack.Screen name="SellerRefunds" component={SellerRefundsScreen} />

        <Stack.Screen name="SellerAccounting" component={SellerAccountingScreen} />
        <Stack.Screen name="SellerReturns" component={SellerReturnsScreen} />
        <Stack.Screen name="SellerCoupons" component={SellerCouponsScreen} />
        <Stack.Screen name="SellerFinance" component={SellerFinanceScreen} />
        <Stack.Screen name="SellerKYC" component={SellerKYCScreen} />
        <Stack.Screen name="SellerHub" component={SellerHubScreen} />
        
        {/* Routes admin */}
        <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
        <Stack.Screen name="AdminInterfaces" component={AdminInterfacesScreen} />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
        <Stack.Screen name="AdminStores" component={AdminStoresScreen} />
        <Stack.Screen name="AdminCategories" component={AdminCategoriesScreen} />
        <Stack.Screen name="AdminSubscriptions" component={AdminSubscriptionsScreen} />
        <Stack.Screen name="AdminPayments" component={AdminPaymentsScreen} />
        <Stack.Screen name="AdminAdministrators" component={AdminAdministratorsScreen} />
        <Stack.Screen name="AdminFeatured" component={AdminFeaturedScreen} />
        <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
        <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
        <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
        <Stack.Screen name="AdminActivity" component={AdminActivityScreen} />
        <Stack.Screen name="AdminRevenueDetails" component={AdminRevenueDetailsScreen} />
        <Stack.Screen name="AdminNotifications" component={AdminNotificationsScreen} />
        <Stack.Screen name="AdminSendNotification" component={AdminSendNotificationScreen} />
        <Stack.Screen name="AdminAPKUpdates" component={AdminAPKUpdatesScreen} />
        <Stack.Screen name="AdminCountries" component={AdminCountriesScreen} />
        <Stack.Screen name="AdminCities" component={AdminCitiesScreen} />
        <Stack.Screen name="AdminBanners" component={AdminBannersScreen} />
        <Stack.Screen name="AdminBannerForm" component={AdminBannerFormScreen} />
        <Stack.Screen name="AdminPoints" component={AdminPointsScreen} />
        
        {/* Routes info */}
        <Stack.Screen name="Features" component={FeaturesScreen} />
        <Stack.Screen name="Pricing" component={PricingScreen} />
        <Stack.Screen name="SellerChangePlan" component={SellerChangePlanScreen} />
        <Stack.Screen name="SellerSubscriptions" component={SellerSubscriptionsScreen} />
        <Stack.Screen name="AgentChat" component={SellerAgentChatScreen} />
        <Stack.Screen name="AdminAgentChat" component={AdminAgentScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppNavigator;
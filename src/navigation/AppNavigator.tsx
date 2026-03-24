import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform, StatusBar, AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

// Imports optimisés
import * as Screens from '../screens';
import { RootStackParamList, ClientTabParamList, SellerTabParamList, UserRole, NotificationPayload } from './types';
import { COLORS, SPACING, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { sessionStorage } from '../lib/storage';
import { authService, storeService, supabase } from '../lib/supabase';
import { useNotificationStore } from '../store/notificationStore';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useTheme } from '../hooks/useTheme';
import { usePushNotifications } from '../hooks/usePushNotifications';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ClientTab = createBottomTabNavigator<ClientTabParamList>();
const SellerTab = createBottomTabNavigator<SellerTabParamList>();

// Types
interface NotificationSound {
  play: () => void;
}

// Configuration des liens profonds
const linking = {
  prefixes: Platform.OS === 'web' 
    ? ['https://', 'http://'] 
    : [Linking.createURL('/')],
  config: {
    screens: {
      Landing: '',
      SellerEmailConfirm: 'auth/confirm',
      StoreDetail: 'store/:slug',
      ProductDetail: 'product/:productId',
    },
  },
};

// Écran de chargement
const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <Ionicons name="cart-outline" size={50} color={COLORS.accent} />
  </View>
);

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
  const player = useAudioPlayer('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

  const playNotificationSound = useCallback(async (): Promise<void> => {
    try {
      if (player) {
        player.play();
      }
    } catch (soundError) {
      // Fallback haptique
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (hapticError) {
          errorHandler.handle(hapticError instanceof Error ? hapticError : new Error(String(hapticError)), 'NotificationFeedback', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
        }
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

        // Vérification du statut
        if (store.subscription_status === 'expired' || store.subscription_status === 'cancelled') {
          return true;
        }

        // Vérification de la date
        if (store.subscription_end) {
          const isExpired = new Date(store.subscription_end) < new Date();
          if (isExpired) return true;
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
  const { tabBarHeight, bottomPadding, iconSize, labelSize, showLabels } = useResponsiveTabBar();

  const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, [string, string]> = {
      ClientHome: ['home', 'home-outline'],
      ClientOrders: ['receipt', 'receipt-outline'],
      ClientSearch: ['search', 'search-outline'],
      Wishlist: ['heart', 'heart-outline'],
      ClientProfile: ['person', 'person-outline'],
      Cart: ['cart', 'cart-outline'],
    };
    
    const [focusedIcon, outlineIcon] = icons[routeName] || ['home', 'home-outline'];
    return focused ? focusedIcon as keyof typeof Ionicons.glyphMap : outlineIcon as keyof typeof Ionicons.glyphMap;
  };

  return (
    <ClientTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => (
          <Ionicons 
            name={getIconName(route.name, focused)} 
            size={iconSize} 
            color={color} 
          />
        ),
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
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
      <ClientTab.Screen name="ClientHome" component={Screens.ClientHomeScreen} options={{ title: 'Accueil' }} />
      <ClientTab.Screen name="ClientOrders" component={Screens.ClientOrdersScreen} options={{ title: 'Commandes' }} />
      <ClientTab.Screen name="ClientSearch" component={Screens.ClientSearchScreen} options={{ title: 'Recherche' }} />
      <ClientTab.Screen name="Wishlist" component={Screens.WishlistScreen} options={{ title: 'Favoris' }} />
      <ClientTab.Screen name="ClientProfile" component={Screens.ClientProfileScreen} options={{ title: 'Profil' }} />
      <ClientTab.Screen name="Cart" component={Screens.CartScreen} options={{ title: 'Panier' }} />
    </ClientTab.Navigator>
  );
});

// Navigation Vendeur
const SellerTabs: React.FC = React.memo(() => {
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
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => (
          <Ionicons 
            name={getIconName(route.name, focused)} 
            size={iconSize} 
            color={color} 
          />
        ),
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
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
      <SellerTab.Screen name="SellerDashboard" component={Screens.SellerDashboardScreen} options={{ title: 'Dashboard' }} />
      <SellerTab.Screen name="SellerProducts" component={Screens.SellerProductsScreen} options={{ title: 'Produits' }} />
      <SellerTab.Screen name="SellerOrders" component={Screens.SellerOrdersScreen} options={{ title: 'Commandes' }} />
      <SellerTab.Screen name="SellerCollection" component={Screens.SellerCollectionScreen} options={{ title: 'Collections' }} />
      <SellerTab.Screen name="SellerClients" component={Screens.SellerClientsScreen} options={{ title: 'Clients' }} />
      <SellerTab.Screen name="SellerStore" component={Screens.SellerStoreScreen} options={{ title: 'Boutique' }} />
    </SellerTab.Navigator>
  );
});

// Navigateur principal
export const AppNavigator: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Landing');
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
  
  // Enregistrement des notifications push
  usePushNotifications(user?.id);

  // Gestion des notifications en temps réel
  useEffect(() => {
    if (!supabase?.channel || !user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
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
      supabase.removeChannel(channel).catch(() => {});
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

  // Fallback Polling for notifications (in case Supabase Realtime is disabled for the table)
  const { unreadCount, setNotifications } = useNotificationStore();
  const unreadCountRef = useRef(unreadCount);

  // Sync ref with store
  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!user?.id) return;
    
    // Polling every 15 seconds
    const interval = setInterval(async () => {
      try {
        // Check if there are new unread notifications
        const { notificationService } = await import('../lib/notificationService');
        const count = await notificationService.getUnreadCount(user.id);
        
        if (count > unreadCountRef.current) {
          // New notification arrived! Fetch them all and play sound
          const notifs = await notificationService.getByUser(user.id);
          setNotifications(notifs);
          await playNotificationSound();
        } else if (count < unreadCountRef.current) {
          // Some were deleted or read elsewhere
          const notifs = await notificationService.getByUser(user.id);
          setNotifications(notifs);
        }
      } catch (err) {
        // Ignore silent polling errors
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [user?.id, playNotificationSound, setNotifications]);

  // Restauration de session
  useEffect(() => {
    const restoreSession = async () => {
      setLoading(true);
      try {
        if (!supabase?.auth) {
          setInitialRoute('Landing');
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const userData = await authService.getCurrentUser();
          if (userData) {
            setUser(userData);
            setSession(session);
            
            const role = (userData as any)?.user_metadata?.role || (userData as any)?.app_metadata?.role;
            
            if (role) {
              await sessionStorage.saveUserRole(String(role));
            }

            // Déterminer la route initiale
            const route = await getInitialRouteForRole(role as UserRole, userData.id);
            setInitialRoute(route);
            return;
          }
        }

        // Pas de session active -> Sign in anonymously for "ghost" users
        try {
          const { data: { session: anonSession } } = await authService.signInAnonymously();
          if (anonSession?.user) {
            setUser(anonSession.user);
            setSession(anonSession);
          }
          setInitialRoute('ClientTabs');
        } catch (anonError) {
          // If anonymous sign in fails, just continue as guest
          setInitialRoute('ClientTabs');
        }
      } catch (error) {
        errorHandler.handleAuthError(error as Error, 'SessionRestoration');
        setInitialRoute('Landing');
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    };

    restoreSession();
  }, []);

  // Écoute des changements d'authentification
  useEffect(() => {
    if (!supabase?.auth) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (!session?.user) {
            setUser(null);
            setSession(null);
            setInitialRoute('Landing');
            return;
          }

          setUser(session.user);
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

  // Helper pour déterminer la route initiale
  const getInitialRouteForRole = async (role: UserRole, userId: string): Promise<keyof RootStackParamList> => {
    switch (role) {
      case 'seller': {
        try {
          const isExpired = await checkSubscription(userId);
          if (isExpired) return 'SubscriptionExpired';
          
          const hasStore = await storeService.getByUser(userId).catch(() => null);
          return hasStore ? 'SellerTabs' : 'SellerAddStore';
        } catch {
          return 'SubscriptionExpired';
        }
      }
      case 'admin':
        return 'AdminDashboard';
      case 'client':
      default:
        return 'ClientTabs';
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
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        {/* Routes publiques */}
        <Stack.Screen name="Landing" component={Screens.LandingScreen} />
        <Stack.Screen name="SellerAuth" component={Screens.SellerAuthScreen} />
        <Stack.Screen name="SellerEmailConfirm" component={Screens.SellerEmailConfirmScreen} />
        <Stack.Screen name="SubscriptionExpired" component={Screens.SubscriptionExpiredScreen} />
        
        {/* Routes principales */}
        <Stack.Screen name="ClientTabs" component={ClientTabs} />
        <Stack.Screen name="SellerTabs" component={SellerTabs} />
        <Stack.Screen name="AdminDashboard" component={Screens.AdminDashboardScreen} />
        
        {/* Routes clients */}
        <Stack.Screen name="ClientDetail" component={Screens.ClientDetailScreen} />
        <Stack.Screen name="ClientOrders" component={Screens.ClientOrdersScreen} />
        <Stack.Screen name="ClientOrderDetail" component={Screens.ClientOrderDetailScreen} />
        <Stack.Screen name="ClientEdit" component={Screens.ClientEditScreen} />
        <Stack.Screen name="ClientAllStores" component={Screens.ClientAllStoresScreen} />
        <Stack.Screen name="ClientAllProducts" component={Screens.ClientAllProductsScreen} />
        <Stack.Screen name="StoreDetail" component={Screens.StoreDetailScreen} />
        <Stack.Screen name="ProductDetail" component={Screens.ProductDetailScreen} />
        <Stack.Screen name="Cart" component={Screens.CartScreen} />
        <Stack.Screen name="Checkout" component={Screens.CheckoutScreen} />
        <Stack.Screen name="Payment" component={Screens.PaymentScreen} />
        <Stack.Screen name="BulkPayment" component={Screens.BulkPaymentScreen} />
        <Stack.Screen name="Confirmation" component={Screens.ConfirmationScreen} />
        <Stack.Screen name="Wishlist" component={Screens.WishlistScreen} />
        <Stack.Screen name="Notifications" component={Screens.NotificationsScreen} />
        
        {/* Routes vendeurs */}
        <Stack.Screen name="SellerAddStore" component={Screens.SellerAddStoreScreen} />
        <Stack.Screen name="SellerCaisse" component={Screens.SellerCaisseScreen} />
        <Stack.Screen name="SellerAddProduct" component={Screens.SellerAddProductScreen} />
        <Stack.Screen name="SellerEditProduct" component={Screens.SellerEditProductScreen} />
        <Stack.Screen name="SellerEditCollection" component={Screens.SellerEditCollectionScreen} />
        <Stack.Screen name="SellerCollectionProducts" component={Screens.SellerCollectionProductsScreen} />
        <Stack.Screen name="SellerOrderDetail" component={Screens.SellerOrderDetailScreen} />
        <Stack.Screen name="SellerProductActions" component={Screens.SellerProductActionsScreen} />
        <Stack.Screen name="SellerSale" component={Screens.SellerSaleScreen} />
        <Stack.Screen name="SellerRestock" component={Screens.SellerRestockScreen} />
        
        {/* Routes admin */}
        <Stack.Screen name="AdminSettings" component={Screens.AdminSettingsScreen} />
        <Stack.Screen name="AdminUsers" component={Screens.AdminUsersScreen} />
        <Stack.Screen name="AdminStores" component={Screens.AdminStoresScreen} />
        <Stack.Screen name="AdminCategories" component={Screens.AdminCategoriesScreen} />
        <Stack.Screen name="AdminSubscriptions" component={Screens.AdminSubscriptionsScreen} />
        <Stack.Screen name="AdminPayments" component={Screens.AdminPaymentsScreen} />
        <Stack.Screen name="AdminAdministrators" component={Screens.AdminAdministratorsScreen} />
        <Stack.Screen name="AdminFeatured" component={Screens.AdminFeaturedScreen} />
        <Stack.Screen name="AdminReports" component={Screens.AdminReportsScreen} />
        <Stack.Screen name="AdminAnalytics" component={Screens.AdminAnalyticsScreen} />
        <Stack.Screen name="AdminProfile" component={Screens.AdminProfileScreen} />
        <Stack.Screen name="AdminActivity" component={Screens.AdminActivityScreen} />
        <Stack.Screen name="AdminRevenueDetails" component={Screens.AdminRevenueDetailsScreen} />
        <Stack.Screen name="AdminNotifications" component={Screens.AdminNotificationsScreen} />
        <Stack.Screen name="AdminSendNotification" component={Screens.AdminSendNotificationScreen} />
        <Stack.Screen name="AdminAPKUpdates" component={Screens.AdminAPKUpdatesScreen} />
        <Stack.Screen name="AdminCountries" component={Screens.AdminCountriesScreen} />
        <Stack.Screen name="AdminCities" component={Screens.AdminCitiesScreen} />
        <Stack.Screen name="AdminBanners" component={Screens.AdminBannersScreen} />
        <Stack.Screen name="AdminBannerForm" component={Screens.AdminBannerFormScreen} />
        
        {/* Routes info */}
        <Stack.Screen name="Features" component={Screens.FeaturesScreen} />
        <Stack.Screen name="Pricing" component={Screens.PricingScreen} />
        <Stack.Screen name="SellerChangePlan" component={Screens.SellerChangePlanScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
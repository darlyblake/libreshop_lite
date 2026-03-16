import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform, StatusBar, ScrollView, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

import { 
  LandingScreen, 
  SellerAuthScreen, 
  ClientHomeScreen, 
  ClientSearchScreen,
  ClientAllStoresScreen,
  ClientAllProductsScreen,
  SellerDashboardScreen,
  StoreDetailScreen,
  ProductDetailScreen,
  CartScreen,
  CheckoutScreen,
  PaymentScreen,
  ConfirmationScreen,
  WishlistScreen,
  SellerProductsScreen,
  SellerOrdersScreen,
  SellerStoreScreen,
  SellerCaisseScreen,
  SellerAddProductScreen,
  SellerEditProductScreen,
  SellerAddStoreScreen,
  SellerOrderDetailScreen,
  FeaturesScreen,
  PricingScreen,
  SellerCollectionScreen,
  SellerClientsScreen,
  SellerEditCollectionScreen,
  SellerCollectionProductsScreen,
  ClientDetailScreen,
  ClientOrdersScreen,
  ClientOrderDetailScreen,
  ClientEditScreen,
  ClientProfileScreen,
  AdminDashboardScreen,
  AdminSettingsScreen,
  AdminUsersScreen,
  AdminStoresScreen,
  AdminCategoriesScreen,
  AdminSubscriptionsScreen,
  AdminPaymentsScreen,
  AdminAdministratorsScreen,
  AdminFeaturedScreen,
  AdminReportsScreen,
  AdminAnalyticsScreen,
  AdminProfileScreen,
  AdminActivityScreen,
  AdminRevenueDetailsScreen,
  AdminNotificationsScreen,
  AdminSendNotificationScreen,
  AdminAPKUpdatesScreen,
  AdminCountriesScreen,
  AdminCitiesScreen,
  AdminBannersScreen,
  AdminBannerFormScreen,
  NotificationsScreen,
  SellerProductActionsScreen,
  SellerSaleScreen,
  SellerRestockScreen,
  SellerEmailConfirmScreen,
} from '../screens';
import { RootStackParamList, ClientTabParamList, SellerTabParamList } from './types';
import { COLORS, SPACING, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { sessionStorage } from '../lib/storage';
import { authService, storeService, supabase } from '../lib/supabase';
import { useNotificationStore } from '../store/notificationStore';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ClientTab = createBottomTabNavigator<ClientTabParamList>();
const SellerTab = createBottomTabNavigator<SellerTabParamList>();

// Deep linking configuration - platform-specific for web
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

// Placeholder screen
const PlaceholderScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  
  return (
    <View style={[placeholderStyles.container, { paddingHorizontal: SPACING.xl * (width > 600 ? 2 : 1) }]}>
      <Ionicons name="construct-outline" size={width > 600 ? 80 : 50} color={COLORS.textSoft} />
      <Text style={[placeholderStyles.text, { fontSize: width > 600 ? FONT_SIZE.lg : FONT_SIZE.md }]}>
        Bientôt disponible
      </Text>
    </View>
  );
};

const placeholderStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  text: {
    color: COLORS.textSoft,
    textAlign: 'center',
  },
});

// Hook pour la gestion responsive (UNIQUEMENT pour le style, pas pour le contenu)
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
    showLabels: width > 350, // Cacher les labels seulement sur très petits écrans
  };
};

// Client Tab Navigator - TOUS LES ÉCRANS DISPONIBLES SUR MOBILE
const ClientTabs: React.FC = () => {
  const { tabBarHeight, bottomPadding, iconSize, labelSize, showLabels } = useResponsiveTabBar();

  return (
    <ClientTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          switch (route.name) {
            case 'ClientHome':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'ClientOrders':
              iconName = focused ? 'receipt' : 'receipt-outline';
              break;
            case 'ClientSearch':
              iconName = focused ? 'search' : 'search-outline';
              break;
            case 'Wishlist':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
            case 'ClientProfile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'Cart':
              iconName = focused ? 'cart' : 'cart-outline';
              break;
            default:
              iconName = 'home';
          }
          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
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
          ...(Platform.OS === 'web'
            ? { boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)' }
            : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 8,
              }),
        },
        tabBarLabelStyle: {
          fontSize: labelSize,
          fontWeight: '500',
          marginTop: 2,
          display: showLabels ? 'flex' : 'none', // Cacher les labels si pas assez de place
        },
        tabBarItemStyle: {
          paddingVertical: 5,
        },
        headerShown: false,
      })}
    >
      <ClientTab.Screen 
        name="ClientHome" 
        component={ClientHomeScreen} 
        options={{ title: 'Accueil' }} 
      />
      <ClientTab.Screen 
        name="ClientOrders" 
        component={ClientOrdersScreen} 
        options={{ title: 'Mes Commandes' }} 
      />
      <ClientTab.Screen 
        name="ClientSearch" 
        component={ClientSearchScreen} 
        options={{ title: 'Recherche' }} 
      />
      <ClientTab.Screen 
        name="Wishlist" 
        component={WishlistScreen} 
        options={{ title: 'Favoris' }} 
      />
      <ClientTab.Screen 
        name="ClientProfile" 
        component={ClientProfileScreen} 
        options={{ title: 'Profil' }} 
      />
      <ClientTab.Screen 
        name="Cart" 
        component={CartScreen} 
        options={{ title: 'Panier' }} 
      />
    </ClientTab.Navigator>
  );
};

// Seller Tab Navigator - TOUS LES ÉCRANS DISPONIBLES SUR MOBILE
const SellerTabs: React.FC = () => {
  const { tabBarHeight, bottomPadding, iconSize, labelSize, showLabels, isLandscape } = useResponsiveTabBar();

  // Sur mobile en paysage, on utilise un ScrollView horizontal pour la tab bar
  if (isLandscape && Platform.OS === 'ios') {
    return (
      <SellerTab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color }) => {
            let iconName: keyof typeof Ionicons.glyphMap;
            switch (route.name) {
              case 'SellerDashboard':
                iconName = focused ? 'grid' : 'grid-outline';
                break;
              case 'SellerProducts':
                iconName = focused ? 'cube' : 'cube-outline';
                break;
              case 'SellerOrders':
                iconName = focused ? 'receipt' : 'receipt-outline';
                break;
              case 'SellerCollection':
                iconName = focused ? 'folder' : 'folder-outline';
                break;
              case 'SellerClients':
                iconName = focused ? 'people' : 'people-outline';
                break;
              case 'SellerStore':
                iconName = focused ? 'storefront' : 'storefront-outline';
                break;
              default:
                iconName = 'home';
            }
            return <Ionicons name={iconName} size={iconSize} color={color} />;
          },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarStyle: {
            backgroundColor: COLORS.bg,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 5,
            paddingTop: 5,
          },
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '500',
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingVertical: 5,
            width: 'auto', // Permettre le défilement horizontal
            minWidth: 70,
          },
          tabBarScrollEnabled: true, // Activer le défilement horizontal
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
  }

  // Version normale pour portrait et Android
  return (
    <SellerTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          switch (route.name) {
            case 'SellerDashboard':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'SellerProducts':
              iconName = focused ? 'cube' : 'cube-outline';
              break;
            case 'SellerOrders':
              iconName = focused ? 'receipt' : 'receipt-outline';
              break;
            case 'SellerCollection':
              iconName = focused ? 'folder' : 'folder-outline';
              break;
            case 'SellerClients':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'SellerStore':
              iconName = focused ? 'storefront' : 'storefront-outline';
              break;
            default:
              iconName = 'home';
          }
          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
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
          ...(Platform.OS === 'web'
            ? { boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)' }
            : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 8,
              }),
        },
        tabBarLabelStyle: {
          fontSize: labelSize,
          fontWeight: '500',
          marginTop: 2,
          display: showLabels ? 'flex' : 'none',
        },
        tabBarItemStyle: {
          paddingVertical: 5,
        },
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
};

// Main App Navigator
export const AppNavigator: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'Landing' | 'SellerAuth' | 'ClientTabs' | 'SellerTabs' | 'AdminDashboard'>('Landing');

  // `useAuthStore` may briefly be undefined if the store module isn't yet
  // fully evaluated (rare but seen during HMR malformed state). call it
  // defensively and fall back to no-op functions.
  const auth = useAuthStore ? useAuthStore() : {
    user: null,
    setUser: () => {},
    setSession: () => {},
    isLoading: false,
    setLoading: () => {},
  };
  const { user, setUser, setSession, isLoading, setLoading } = auth;

  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!supabase) return;
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          try {
            if (payload?.new) {
              addNotification(payload.new);
            }
          } catch (e) {
            console.warn('failed to add notification to store', e);
          }

          // Play sound (best effort) + haptics fallback
          try {
            // Essayer de jouer le son par URL
            const { sound } = await Audio.Sound.createAsync(
              {
                uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
              },
              { shouldPlay: true }
            );
            sound.setOnPlaybackStatusUpdate((status) => {
              const s: any = status;
              if (s?.didJustFinish) {
                sound.unloadAsync().catch(() => {});
              }
            });
          } catch (soundError) {
            // Fallback: jouer une vibration/haptic
            try {
              if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (hapticError) {
              console.warn('Failed to play sound or haptic', { soundError, hapticError });
            }
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [user?.id, addNotification]);

  useEffect(() => {
    const restore = async () => {
      setLoading(true);
      try {
        // Source of truth: Supabase session (JWT). sessionStorage is only a local hint.
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            const res = await authService.getCurrentUser();
            if (res) {
              setUser(res as any);
              setSession(data.session);
              const role = (res as any)?.user_metadata?.role || (res as any)?.app_metadata?.role;
              if (role) {
                await sessionStorage.saveUserRole(String(role));
              }
              switch (role) {
                case 'seller':
                  try {
                    await storeService.getByUser((res as any).id);
                    setInitialRoute('SellerTabs');
                  } catch {
                    setInitialRoute('SellerAddStore');
                  }
                  break;
                case 'admin':
                  setInitialRoute('AdminDashboard');
                  break;
                case 'client':
                  setInitialRoute('ClientTabs');
                  break;
                default:
                  // Guest/anonymous session: treat as client.
                  setInitialRoute('ClientTabs');
              }
              return;
            }
          }
        }

        // Fallback: legacy local session (may exist without Supabase JWT)
        // IMPORTANT: on ne doit pas router vers des écrans protégés (Admin/Seller/Client)
        // si aucune session Supabase n'existe. Sinon on arrive en rôle anon et RLS bloque.
        const localSession = await sessionStorage.getSession();
        const localRole = await sessionStorage.getUserRole();
        if (localSession && localRole) {
          setSession(localSession);
        }

        // Sans session Supabase: permettre la navigation (explorer) sans compte.
        // La commande/paiement doivent exiger une connexion explicite.
        setInitialRoute('ClientTabs');
      } catch (err) {
        console.warn('failed to restore session', err);
        setInitialRoute('Landing');
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (!session) {
          setUser(null as any);
          setSession(null as any);
          setInitialRoute('Landing');
          return;
        }

        const role =
          (session.user as any)?.user_metadata?.role ||
          (session.user as any)?.app_metadata?.role;

        setUser(session.user as any);
        setSession(session as any);

        switch (role) {
          case 'seller':
            setInitialRoute('SellerTabs');
            break;
          case 'admin':
            setInitialRoute('AdminDashboard');
            break;
          case 'client':
          default:
            // Guest/anonymous session is treated as client.
            setInitialRoute('ClientTabs');
        }
      } catch (e) {
        console.warn('onAuthStateChange handler failed', e);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [setSession, setUser]);

  if (!isReady || isLoading) {
    return (
      <View style={loadingStyles.container}>
        <Ionicons name="cart-outline" size={50} color={COLORS.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={COLORS.bg}
        translucent={Platform.OS === 'android'}
      />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="SellerAuth" component={SellerAuthScreen} />
        <Stack.Screen name="SellerEmailConfirm" component={SellerEmailConfirmScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="ClientTabs" component={ClientTabs} />
        <Stack.Screen name="SellerTabs" component={SellerTabs} />
        
        {/* seller/client detail/edit routes */}
        <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
        <Stack.Screen name="ClientOrders" component={ClientOrdersScreen} />
        <Stack.Screen name="ClientOrderDetail" component={ClientOrderDetailScreen} />
        <Stack.Screen name="ClientEdit" component={ClientEditScreen} />

        {/* Admin Stack Screens */}
        <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
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

        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        
        {/* Client Stack Screens */}
        <Stack.Screen name="ClientAllStores" component={ClientAllStoresScreen} />
        <Stack.Screen name="ClientAllProducts" component={ClientAllProductsScreen} />
        <Stack.Screen name="StoreDetail" component={StoreDetailScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} />
        
        {/* Seller Stack Screens */}
        <Stack.Screen name="SellerCaisse" component={SellerCaisseScreen} />
        <Stack.Screen name="SellerAddProduct" component={SellerAddProductScreen} />
        <Stack.Screen name="SellerEditProduct" component={SellerEditProductScreen} />
        <Stack.Screen name="SellerAddStore" component={SellerAddStoreScreen} />
        <Stack.Screen name="SellerEditCollection" component={SellerEditCollectionScreen} />
        <Stack.Screen name="SellerCollectionProducts" component={SellerCollectionProductsScreen} />
        <Stack.Screen name="SellerOrderDetail" component={SellerOrderDetailScreen} />
        <Stack.Screen name="SellerProductActions" component={SellerProductActionsScreen} />
        <Stack.Screen name="SellerSale" component={SellerSaleScreen} />
        <Stack.Screen name="SellerRestock" component={SellerRestockScreen} />
        
        {/* Info Screens */}
        <Stack.Screen name="Features" component={FeaturesScreen} />
        <Stack.Screen name="Pricing" component={PricingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
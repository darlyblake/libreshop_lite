import { NavigatorScreenParams } from '@react-navigation/native';

// Stack Navigator param lists
export type RootStackParamList = {
  Landing: undefined;
  About: undefined;
  SellerAuth: undefined;
  SellerEmailConfirm: { token?: string; type?: string; email?: string };
  SubscriptionExpired: undefined;
  AdminDashboard: undefined;
  AdminSettings: undefined;
  AdminUsers: undefined;
  AdminStores: undefined;
  AdminCategories: undefined;
  AdminSubscriptions: undefined;
  AdminPayments: undefined;
  AdminAdministrators: undefined;
  AdminFeatured: undefined;
  AdminReports: undefined;
  AdminAnalytics: undefined;
  SellerAnalytics: undefined;
  AdminProfile: undefined;
  AdminActivity: undefined;
  AdminRevenueDetails: undefined;
  AdminNotifications: undefined;
  AdminSendNotification: undefined;
  AdminAPKUpdates: undefined;
  AdminCountries: undefined;
  AdminCities: { countryId?: string };
  AdminBanners: undefined;
  AdminBannerForm: { bannerId?: string };
  AgentChat: undefined;
  AdminAgentChat: undefined;
  Payment: { amount?: number; orderId?: string };
  BulkPayment: { orders?: any[] };
  ClientTabs: NavigatorScreenParams<ClientTabParamList>;
  SellerTabs: NavigatorScreenParams<SellerTabParamList>;
  StoreDetail: { storeId?: string; slug?: string };
  ProductDetail: { productId: string };
  Cart: undefined;
  Checkout: undefined;
  Confirmation: undefined;
  SellerDashboard: undefined;
  SellerProducts: undefined;
  SellerOrders: undefined;
  SellerCollection: undefined;
  SellerClients: undefined;
  SellerStore: undefined;
  SellerCaisse: undefined;
  SellerAddProduct: undefined;
  SellerEditProduct: { productId: string };
  SellerAddStore: undefined;
  ClientHome: undefined;
  ClientSearch: undefined;
  ClientAllStores: undefined;
  ClientAllProducts: undefined;
  ClientDetail: { clientId: string };
  ClientOrderDetail: { orderId: string };
  ClientEdit: { userId: string };
  SellerEditCollection: { collectionId: string };
  SellerCollectionProducts: { collectionId: string };
  SellerOrderDetail: { orderId: string };
  SellerProductActions: { productId: string };
  SellerSale: { productId: string };
  SellerRestock: { productId: string };
  SellerLowStock: undefined;
  Notifications: undefined;
  Features: undefined;
  Pricing: undefined;
  SellerChangePlan: undefined;
  PersonalInfo: undefined;
  Address: undefined;
  Security: undefined;
  Help: undefined;
  AccountSuspended: undefined;
};

export type ClientTabParamList = {
  ClientHome: undefined;
  ClientOrders: undefined;
  ClientSearch: undefined;
  Wishlist: undefined;
  ClientProfile: undefined;
};

export type SellerTabParamList = {
  SellerDashboard: undefined;
  SellerProducts: undefined;
  SellerOrders: undefined;
  SellerCollection: undefined;
  SellerClients: undefined;
  SellerStore: undefined;
};

// Declare global types for useNavigation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
export type UserRole = 'client' | 'seller' | 'admin';

export interface NotificationPayload {
  new: {
    id: string;
    user_id: string;
    title: string;
    body: string;
    type: 'order' | 'payment' | 'promo' | 'system';
    read: boolean;
    data?: any;
    created_at: string;
  };
  old: any;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
}

/**
 * Types pour le service des commandes
 * Fichier créé pour remplacer les `any` du orderService
 */

export type OrderStatus = 
  | 'pending' 
  | 'accepted' 
  | 'processing'
  | 'paid' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded';

export type DeliveryMode = 'fixed' | 'city' | 'km';
export type PaymentMethod = 'cash_on_delivery' | 'card' | 'mobile_money' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Order {
  id: string;
  user_id: string;
  store_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  
  // Montants
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  
  // Infos client
  customer_name: string;
  customer_phone: string;
  shipping_address: string | null;
  notes?: string; // Notes internes sur la commande
  
  // Géolocalisation
  city?: string;
  latitude?: number;
  longitude?: number;
  delivery_mode?: DeliveryMode;
  
  // Tracking livraison
  tracking_number?: string;
  shipping_provider?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  delivery_proof_url?: string; // Photo/signature
  
  // Timestamps
  created_at: string;
  updated_at: string;
  status_changed_at?: string;
  version?: number; // Pour optimistic locking
  
  // Relations (non-nullable quand on les fetch)
  stores?: Store;
  users?: User;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  subtotal?: number;
  products?: Product;
}

export interface Store {
  id: string;
  user_id: string;
  name: string;
  slug?: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

// Projections pour requêtes optimisées
export type OrderSummary = Pick<
  Order,
  'id' | 'status' | 'total_amount' | 'created_at' | 'customer_name'
>;

export type OrderDetail = Order & {
  items: OrderItem[];
  store: Store;
  user: User;
};

// Filtres et options
export interface OrderFilters {
  status?: OrderStatus | 'all';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
  forceRefresh?: boolean;
}

export interface GetByStoreOptions extends OrderFilters {
  includeUser?: boolean;
}

export interface StoreOrderCounts {
  total: number;
  pending: number;
  accepted?: number;
  paid?: number;
  shipped?: number;
  delivered?: number;
  cancelled?: number;
  refunded?: number;
}

export interface PaginationResult<T> {
  items: T[];
  orders: T[]; // Alias backward-compatible (always present = items)
  hasMore: boolean;
  nextCursor: string | null;
  count: number;
}

// Pagination cursor normalisé
export interface PaginationCursor {
  timestamp: string;
  id: string;
}

// Stock movements
export type StockMovementType = 'sale' | 'return' | 'adjustment' | 'restock';

export interface StockMovement {
  id: string;
  product_id: string;
  quantity_changed: number;
  previous_stock: number;
  new_stock: number;
  type: StockMovementType;
  reason: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

// RPC Payloads
export interface OrderPayload {
  user_id: string;
  store_id: string | null;
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  shipping_address: string | null;
  customer_phone: string;
  customer_name: string;
  delivery_fee: number;
  tax_amount: number;
}

export interface OrderItemPayload {
  product_id: string;
  quantity: number;
  price: number;
}

// Thresholds for stuck orders
export interface OrderStatusThreshold {
  status: OrderStatus;
  threshold_hours: number;
  should_notify_vendor: boolean;
  should_notify_customer: boolean;
}

export interface StuckOrderInfo {
  isStuck: boolean;
  threshold?: OrderStatusThreshold;
  hoursOver?: number;
  hoursInStatus?: number;
}

// Notifications
export interface OrderNotification {
  user_id: string;
  title: string;
  body: string;
  type: 'order';
  targetRole: 'client' | 'seller';
  data: {
    orderId: string;
    status: OrderStatus;
    [key: string]: any;
  };
}

// Retry configuration
export interface RetryConfig {
  maxRetries?: number;
  backoffMs?: number;
  shouldRetry?: (error: any) => boolean;
}

// Query result types
export type GetOrderByIdResult = Order | null;
export type GetOrdersByUserResult = Order[];
export type GetOrdersByStoreResult = PaginationResult<Order>;
export type GetOrderCountsResult = StoreOrderCounts;
export type GetCountsByStatusResult = Record<OrderStatus | 'total', number>;

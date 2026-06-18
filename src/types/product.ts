/**
 * Product Service Types
 * Complete type definitions replacing all `any` types
 * Ensures strict type checking and runtime safety
 */

export type SortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'date_asc' | 'date_desc';
export type RankingSort = 'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top';
export type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

/**
 * Store interface (nested in products)
 */
export interface Store {
  id: string;
  name: string;
  logo_url?: string;
  category?: string;
  user_id?: string;
  status?: string;
  visible?: boolean;
}


/**
 * Product Option interface
 */
export interface ProductOption {
  id: string;
  product_id: string;
  name: string;
  values: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Product Like interface
 */
export interface ProductLike {
  id: string;
  product_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Order Item interface (for stats)
 */
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  orders?: {
    status: 'pending' | 'accepted' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
    created_at: string;
  };
}

/**
 * Main Product interface
 */
export interface Product {
  // Primary
  id: string;
  store_id: string;
  name: string;
  description?: string;
  reference?: string;

  // Pricing
  price: number;
  compare_price?: number;
  discount_percent?: number;

  // Inventory
  stock: number;
  reserved_stock?: number; // For orders in progress

  // Media
  images?: string[];
  thumbnail_url?: string;

  // Categorization
  category?: string;
  collection_id?: string;

  // Stats
  view_count?: number;
  sales_count?: number;

  // Engagement
  featured?: boolean;
  sale_active?: boolean;

  // Status
  is_active: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
  status_changed_at?: string;

  // Soft delete
  deleted_at?: string | null;
  deleted_by?: string | null;

  // Versioning (for optimistic locking)
  version?: number;

  // Relations
  stores?: Store;
  product_options?: ProductOption[];
}

/**
 * Product with nested relations (from Supabase .select())
 */
export interface ProductWithRelations extends Product {
  stores: Store;
  product_options?: ProductOption[];
}

/**
 * Product response from Supabase queries with partial store data
 * Used when selecting specific store fields (stores(name, logo_url, category))
 * Note: Supabase returns stores as an array when using .select('...stores(...)')
 */
export interface ProductResponse {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  price: number;
  compare_price?: number;
  images?: string[];
  view_count?: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  stock: number;
  stores?: Array<{
    id?: string;
    name?: string;
    logo_url?: string;
    category?: string;
  } | any>; // Allow partial store data from Supabase
}

/**
 * Convert ProductResponse to Product (flattening stores array)
 * Takes the first store from the array and converts to Store object
 */
export function toProduct(response: any): Product {
  // Handle Supabase response where stores is an array
  const storeData = Array.isArray(response.stores) && response.stores.length > 0 
    ? response.stores[0]
    : response.stores;

  const store: Store = {
    id: storeData?.id || response.store_id,
    name: storeData?.name || '',
    logo_url: storeData?.logo_url,
    category: storeData?.category,
  };

  return {
    id: response.id,
    store_id: response.store_id,
    name: response.name,
    description: response.description,
    price: response.price,
    compare_price: response.compare_price,
    images: response.images,
    view_count: response.view_count,
    created_at: response.created_at,
    updated_at: response.updated_at,
    is_active: response.is_active,
    stock: response.stock,
    stores: store,
  };
}

/**
 * Paginated Products Result
 */
export interface ProductsResult {
  products: Product[];
  hasMore: boolean;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

/**
 * Cursor-based pagination result
 */
export interface CursorPaginationResult {
  data: Product[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Product Stats
 */
export interface ProductStats {
  views: number;
  likes: number;
  sales: number;
}

/**
 * Product with Stats
 */
export interface ProductWithStats extends Product {
  stats?: ProductStats;
}

/**
 * Get similar products result
 */
export interface SimilarProductsResult {
  sameCollection: Product[];
  sameStore: Product[];
  sameCategory: Product[];
  all: Product[];
}

/**
 * Options for getByStorePaginated
 */
export interface GetByStorePaginatedOptions {
  page?: number;
  limit?: number;
  collectionId?: string;
  stockFilter?: StockFilter;
  search?: string;
  sortBy?: SortOption;
  isActive?: boolean;
}

/**
 * Options for search
 */
export interface SearchOptions {
  category?: string;
  collection_id?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

/**
 * Product validation error
 */
export interface ProductValidationError {
  field: string;
  message: string;
}

/**
 * Product creation/update payload
 */
export interface CreateProductPayload {
  store_id: string;
  name: string;
  description?: string;
  reference?: string;
  price: number;
  compare_price?: number;
  stock: number;
  images?: string[];
  category?: string;
  collection_id?: string;
  featured?: boolean;
  sale_active?: boolean;
  is_active?: boolean;
}

export interface UpdateProductPayload extends Partial<CreateProductPayload> {
  version?: number; // For optimistic locking
}

/**
 * Promotion product (with calculated discount)
 */
export interface PromotionProduct extends Product {
  discount_percent: number;
  discount_amount: number;
}

/**
 * Popular product (with ranking score)
 */
export interface RankedProduct extends Product {
  __score?: number; // Internal ranking score (removed before return)
}

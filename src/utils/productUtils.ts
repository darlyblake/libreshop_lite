/**
 * Product Service Utilities
 * Helpers for validation, RLS checks, and business logic
 */

import { useSupabase } from '../lib/supabase';
import type { Product, CreateProductPayload, UpdateProductPayload, ProductValidationError, Store } from '../types/product';

/**
 * Validate product data before create/update
 */
export function validateProduct(product: Partial<Product>): ProductValidationError[] {
  const errors: ProductValidationError[] = [];

  if (!product.name || product.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Product name is required' });
  }

  if (product.name && product.name.length > 200) {
    errors.push({ field: 'name', message: 'Product name must be less than 200 characters' });
  }

  if (product.price === undefined || product.price < 0) {
    errors.push({ field: 'price', message: 'Price must be >= 0' });
  }

  if (product.compare_price !== undefined && product.compare_price < (product.price || 0)) {
    errors.push({ field: 'compare_price', message: 'Compare price must be >= price' });
  }

  if (product.stock !== undefined && product.stock < 0) {
    errors.push({ field: 'stock', message: 'Stock must be >= 0' });
  }

  if (product.images && !Array.isArray(product.images)) {
    errors.push({ field: 'images', message: 'Images must be an array' });
  }

  return errors;
}

/**
 * Get current user with error handling
 */
export async function getCurrentUser() {
  const client = useSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  
  if (error || !user) {
    throw new Error('Unauthorized: user not authenticated');
  }

  return user;
}

/**
 * Get store with RLS check - ensure user is owner
 */
export async function getStoreAndValidateOwnership(storeId: string) {
  const client = useSupabase();
  const user = await getCurrentUser();

  const { data: store, error } = await client
    .from('stores')
    .select('id, user_id, name')
    .eq('id', storeId)
    .single();

  if (error || !store) {
    throw new Error(`Store not found: ${storeId}`);
  }

  if (store.user_id !== user.id) {
    throw new Error(`Unauthorized: you are not the owner of store ${storeId}`);
  }

  return store as Store;
}

/**
 * Get product and validate ownership (user must own the store)
 */
export async function getProductAndValidateOwnership(productId: string) {
  const client = useSupabase();
  const user = await getCurrentUser();

  // Fetch product with store owner info
  const { data: product, error } = await client
    .from('products')
    .select('id, store_id, stores!inner(user_id)')
    .eq('id', productId)
    .single();

  if (error || !product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const store = product.stores as any;
  if (store.user_id !== user.id) {
    throw new Error(`Unauthorized: you don't own product ${productId}`);
  }

  return product;
}

/**
 * Check if user can view product (public, or owns store)
 */
export async function canViewProduct(productId: string): Promise<boolean> {
  const client = useSupabase();

  const { data: product, error } = await client
    .from('products')
    .select('id, is_active, store_id')
    .eq('id', productId)
    .single();

  if (error || !product) {
    return false;
  }

  // If product is active, anyone can view
  if (product.is_active) {
    return true;
  }

  // Otherwise, only owner can view
  try {
    await getProductAndValidateOwnership(productId);
    return true;
  } catch {
    return false;
  }
}


/**
 * Apply RLS - filter products by user's permission level
 * Returns products where:
 * 1. Product is active (public), OR
 * 2. User is the store owner
 */
export async function applyProductRLS(products: Product[]): Promise<Product[]> {
  try {
    const user = await getCurrentUser();

    // Fetch user's store IDs
    const { data: stores, error } = await useSupabase()
      .from('stores')
      .select('id')
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    const userStoreIds = new Set((stores || []).map(s => s.id));

    // Filter products: active OR user owns store
    return products.filter(p => 
      p.is_active || userStoreIds.has(p.store_id)
    );
  } catch {
    // If error getting user, only return active products
    return products.filter(p => p.is_active);
  }
}

/**
 * Calculate discount percentage
 */
export function calculateDiscountPercent(price: number, comparePrice?: number): number {
  if (!comparePrice || comparePrice <= price) {
    return 0;
  }
  return Math.round(((comparePrice - price) / comparePrice) * 100);
}

/**
 * Rank products using composite score
 * Based on view_count, freshness, and other metrics
 */
export function rankProductsByScore(
  products: Product[],
  sort: 'newest' | 'popular' | 'trending' | 'ranked' | 'sales' | 'top' = 'newest'
): Product[] {
  const now = Date.now();

  const withScores = products.map((p) => {
    const viewCount = Number(p.view_count || 0);
    const ageDays = Math.max(0, (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const freshness = Math.max(0, (30 - ageDays) / 30);

    let score = 0;

    switch (sort) {
      case 'newest':
        score = -new Date(p.created_at).getTime();
        break;

      case 'popular':
        score = -viewCount;
        break;

      case 'trending':
        score = -(viewCount * 0.6 + freshness * 40);
        break;

      case 'ranked':
        score = -(viewCount * 0.3 + freshness * 100 * 0.2);
        break;

      case 'sales':
        score = -(viewCount * 0.7 + freshness * 50);
        break;

      case 'top':
        const recentBoost = ageDays <= 30 ? (30 - ageDays) / 30 : 0;
        score = -(viewCount * (1 + recentBoost));
        break;
    }

    return { ...p, __score: score };
  });

  // Sort by score
  withScores.sort((a: any, b: any) => a.__score - b.__score);

  // Remove score
  return withScores.map((p: any) => {
    const { __score, ...rest } = p;
    return rest as Product;
  });
}

/**
 * Deduplicate products by ID
 */
export function deduplicateProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const unique: Product[] = [];

  for (const p of products) {
    if (p?.id && !seen.has(p.id)) {
      seen.add(p.id);
      unique.push(p);
    }
  }

  return unique;
}

/**
 * Filter products by stock status
 */
export function filterByStockStatus(products: Product[], filter: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'): Product[] {
  switch (filter) {
    case 'in_stock':
      return products.filter(p => (p.stock || 0) > 10);
    case 'low_stock':
      return products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 10);
    case 'out_of_stock':
      return products.filter(p => (p.stock || 0) === 0);
    case 'all':
    default:
      return products;
  }
}

/**
 * Filter products by search query
 */
export function filterBySearch(products: Product[], query: string): Product[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return products;

  return products.filter(p =>
    (p.name?.toLowerCase().includes(normalizedQuery)) ||
    (p.description?.toLowerCase().includes(normalizedQuery)) ||
    (p.reference?.toLowerCase().includes(normalizedQuery)) ||
    (p.category?.toLowerCase().includes(normalizedQuery))
  );
}

/**
 * Sort products by option
 */
export function sortProducts(products: Product[], sortBy: 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'date_asc' | 'date_desc'): Product[] {
  const sorted = [...products];

  switch (sortBy) {
    case 'name_asc':
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'name_desc':
      sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      break;
    case 'price_asc':
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price_desc':
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'stock_asc':
      sorted.sort((a, b) => (a.stock || 0) - (b.stock || 0));
      break;
    case 'stock_desc':
      sorted.sort((a, b) => (b.stock || 0) - (a.stock || 0));
      break;
    case 'date_asc':
      sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
    case 'date_desc':
    default:
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
  }

  return sorted;
}

/**
 * Encode cursor for pagination
 */
export function encodeCursor(offset: number, sort: string): string {
  return btoa(JSON.stringify({ offset, sort }));
}

/**
 * Decode cursor for pagination
 */
export function decodeCursor(cursor: string): { offset: number; sort: string } | null {
  try {
    return JSON.parse(atob(cursor));
  } catch {
    return null;
  }
}

/**
 * Calculate promotion discount info
 */
export function getPromotionInfo(product: Product) {
  if (!product.compare_price || product.compare_price <= product.price) {
    return {
      hasDiscount: false,
      discountPercent: 0,
      discountAmount: 0,
    };
  }

  const discountAmount = product.compare_price - product.price;
  const discountPercent = Math.round((discountAmount / product.compare_price) * 100);

  return {
    hasDiscount: true,
    discountPercent,
    discountAmount,
  };
}

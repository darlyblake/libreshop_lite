import { useReducer } from 'react';
import type { Store, Product, HomeBanner, Collection } from '../lib/supabase';

/**
 * Consolidated state for ClientHomeScreen
 * Replaces 15+ separate useState declarations
 */
export interface ClientHomeState {
  // Data
  stores: Store[];
  products: Product[];
  collections: Collection[];
  carouselBanners: HomeBanner[];
  promoBanners: HomeBanner[];
  categoriesList: string[];

  // Loading states
  loading: boolean;
  loadingStores: boolean;
  loadingProducts: boolean;
  loadingMoreProducts: boolean;
  refreshing: boolean;
  newsletterLoading: boolean;

  // UI State
  currentBannerIndex: number;
  productPage: number;
  productCursor: string | null;
  hasMoreProducts: boolean;
  selectedCategory: string | null;
  selectedCollection: string;
  productSort: 'popular' | 'ranked' | 'newest' | 'sales';
  isPaused: boolean;
  error: string | null;
  newsletterEmail: string;
  newsletterSuccess: boolean;
  searchQuery: string;
}

export type HomeAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_STORES'; payload: Store[] }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'SET_PRODUCTS_WITH_CURSOR'; payload: { data: Product[]; cursor: string | null; hasMore: boolean } }
  | { type: 'APPEND_PRODUCTS'; payload: Product[] }
  | { type: 'SET_BANNERS'; payload: { carousel: HomeBanner[]; promo: HomeBanner[] } }
  | { type: 'SET_CATEGORIES'; payload: string[] }
  | { type: 'SET_COLLECTIONS'; payload: Collection[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_LOADING_STORES'; payload: boolean }
  | { type: 'SET_LOADING_PRODUCTS'; payload: boolean }
  | { type: 'UPDATE_SORT'; payload: 'popular' | 'ranked' | 'newest' | 'sales' }
  | { type: 'UPDATE_CATEGORY'; payload: string | null }
  | {
      type: 'ADD_MORE_PRODUCTS';
      payload: { data: Product[]; hasMore: boolean; cursor: string | null };
    }
  | { type: 'SET_NEWSLETTER_EMAIL'; payload: string }
  | { type: 'SET_NEWSLETTER_LOADING'; payload: boolean }
  | { type: 'SET_NEWSLETTER_SUCCESS'; payload: boolean }
  | { type: 'SET_CURRENT_BANNER_INDEX'; payload: number }
  | { type: 'SET_IS_PAUSED'; payload: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'RESET'; payload?: Partial<ClientHomeState> };

const initialState: ClientHomeState = {
  stores: [],
  products: [],
  collections: [],
  carouselBanners: [],
  promoBanners: [],
  categoriesList: ['Toutes'],
  loading: true,
  loadingStores: false,
  loadingProducts: false,
  loadingMoreProducts: false,
  refreshing: false,
  newsletterLoading: false,
  currentBannerIndex: 0,
  productPage: 0,
  productCursor: null,
  hasMoreProducts: true,
  selectedCategory: null,
  selectedCollection: 'Toutes',
  productSort: 'popular',
  isPaused: false,
  error: null,
  newsletterEmail: '',
  newsletterSuccess: false,
  searchQuery: '',
};

/**
 * Reducer function to handle state transitions atomically
 * Ensures state consistency and reduces re-render thrashing
 */
function homeReducer(state: ClientHomeState, action: HomeAction): ClientHomeState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_LOADING_STORES':
      return { ...state, loadingStores: action.payload };

    case 'SET_LOADING_PRODUCTS':
      return { ...state, loadingProducts: action.payload };

    case 'SET_STORES':
      return { ...state, stores: action.payload, loadingStores: false };

    case 'SET_PRODUCTS':
      return {
        ...state,
        products: action.payload,
        loadingProducts: false,
        productCursor: null,
        hasMoreProducts: action.payload.length >= 8,
      };

    case 'SET_PRODUCTS_WITH_CURSOR':
      return {
        ...state,
        products: action.payload.data,
        loadingProducts: false,
        productCursor: action.payload.cursor,
        hasMoreProducts: action.payload.hasMore,
      };

    case 'APPEND_PRODUCTS':
      return {
        ...state,
        products: [...state.products, ...action.payload],
        loadingMoreProducts: false,
      };

    case 'ADD_MORE_PRODUCTS':
      return {
        ...state,
        products: [...state.products, ...action.payload.data],
        productCursor: action.payload.cursor,
        hasMoreProducts: action.payload.hasMore,
        loadingMoreProducts: false,
      };

    case 'SET_BANNERS':
      return {
        ...state,
        carouselBanners: action.payload.carousel,
        promoBanners: action.payload.promo,
      };

    case 'SET_CATEGORIES':
      return { ...state, categoriesList: action.payload };

    case 'SET_COLLECTIONS':
      return { ...state, collections: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    case 'SET_REFRESHING':
      return { ...state, refreshing: action.payload };

    case 'UPDATE_SORT':
      return {
        ...state,
        productSort: action.payload,
        products: [],
        productCursor: null,
        hasMoreProducts: true,
        loadingProducts: true,
      };

    case 'UPDATE_CATEGORY':
      return {
        ...state,
        selectedCategory: action.payload,
        selectedCollection: action.payload || 'Toutes',
        loadingStores: true,
      };

    case 'SET_NEWSLETTER_EMAIL':
      return { ...state, newsletterEmail: action.payload };

    case 'SET_NEWSLETTER_LOADING':
      return { ...state, newsletterLoading: action.payload };

    case 'SET_NEWSLETTER_SUCCESS':
      return { ...state, newsletterSuccess: action.payload };

    case 'SET_CURRENT_BANNER_INDEX':
      return { ...state, currentBannerIndex: action.payload };

    case 'SET_IS_PAUSED':
      return { ...state, isPaused: action.payload };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'RESET':
      return { ...initialState, ...action.payload };

    default:
      return state;
  }
}

/**
 * Hook to manage ClientHomeScreen state with useReducer
 * Replaces 15+ useState declarations with atomic state management
 *
 * @returns [state, dispatch] - Current state and dispatch function
 *
 * @example
 * const [state, dispatch] = useClientHomeState();
 * dispatch({ type: 'SET_PRODUCTS', payload: productArray });
 */
export function useClientHomeState() {
  const [state, dispatch] = useReducer(homeReducer, initialState);

  return { state, dispatch };
}

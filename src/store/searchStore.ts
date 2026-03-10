import { create } from 'zustand';
import { Product } from '../lib/supabase';
import { productService } from '../lib/supabase';

// Mock data fallback
const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro Max',
    price: 850000,
    compare_price: 950000,
    images: ['https://picsum.photos/200?1'],
    store_id: '1',
    category: 'Electronics',
    description: 'Latest iPhone model',
    stock: 10,
    is_online_sale: true,
    is_physical_sale: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'MacBook Air M3',
    price: 720000,
    compare_price: 850000,
    images: ['https://picsum.photos/200?2'],
    store_id: '1',
    category: 'Electronics',
    description: 'Powerful laptop',
    stock: 5,
    is_online_sale: true,
    is_physical_sale: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'AirPods Pro 2',
    price: 185000,
    compare_price: 220000,
    images: ['https://picsum.photos/200?3'],
    store_id: '1',
    category: 'Electronics',
    description: 'Wireless earbuds',
    stock: 20,
    is_online_sale: true,
    is_physical_sale: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'iPad Pro 12.9"',
    price: 580000,
    compare_price: 650000,
    images: ['https://picsum.photos/200?4'],
    store_id: '2',
    category: 'Electronics',
    description: 'Large tablet',
    stock: 8,
    is_online_sale: true,
    is_physical_sale: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Samsung Galaxy S24',
    price: 680000,
    compare_price: 780000,
    images: ['https://picsum.photos/200?5'],
    store_id: '2',
    category: 'Electronics',
    description: 'Premium smartphone',
    stock: 12,
    is_online_sale: true,
    is_physical_sale: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '6',
    name: 'Google Pixel 8 Pro',
    price: 620000,
    compare_price: 720000,
    images: ['https://picsum.photos/200?6'],
    store_id: '3',
    category: 'Electronics',
    description: 'Google flagship phone',
    stock: 7,
    is_online_sale: true,
    is_physical_sale: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '7',
    name: 'Sony WH-1000XM5',
    price: 320000,
    compare_price: 380000,
    images: ['https://picsum.photos/200?7'],
    store_id: '3',
    category: 'Electronics',
    description: 'Noise-canceling headphones',
    stock: 15,
    is_online_sale: true,
    is_physical_sale: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '8',
    name: 'DJI Air 3S',
    price: 890000,
    compare_price: 1000000,
    images: ['https://picsum.photos/200?8'],
    store_id: '4',
    category: 'Electronics',
    description: 'Premium drone',
    stock: 4,
    is_online_sale: true,
    is_physical_sale: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

interface SearchState {
  query: string;
  results: Product[];
  isLoading: boolean;
  recentSearches: string[];
  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  isLoading: false,
  recentSearches: [],

  setQuery: (query) => set({ query }),

  search: async (query: string) => {
    if (!query.trim()) {
      set({ results: [], isLoading: false });
      return;
    }

    set({ isLoading: true, query });
    try {
      const results = await productService.search(query);
      set({ results, isLoading: false });
      // Add to recent searches
      get().addRecentSearch(query);
    } catch (error) {
      console.warn('API search failed, using mock data:', error);
      // Fallback to mock data when API fails
      const mockResults = MOCK_PRODUCTS.filter(product =>
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(query.toLowerCase()))
      );
      set({ results: mockResults, isLoading: false });
      get().addRecentSearch(query);
    }
  },

  clearResults: () => set({ results: [], query: '' }),

  addRecentSearch: (query: string) => {
    const { recentSearches } = get();
    const filtered = recentSearches.filter((s) => s !== query);
    const updated = [query, ...filtered].slice(0, 10);
    set({ recentSearches: updated });
    // Save to localStorage would be good here
  },

  clearRecentSearches: () => set({ recentSearches: [] }),
}));


import { create } from 'zustand';
import { productService } from '../lib/supabase';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

interface SearchState {
  query: string;
  results: any[];
  isLoading: boolean;
  recentSearches: string[];
  totalResults: number;
  currentPage: number;
  hasMore: boolean;
  error: string | null;
  filterBy: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
  };
  search: (query: string, page?: number) => Promise<void>;
  loadMore: () => void;
  addRecentSearch: (query: string) => void;
  clearRecent: () => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  isLoading: false,
  recentSearches: [],
  totalResults: 0,
  currentPage: 1,
  hasMore: false,
  error: null,
  filterBy: {},

  search: async (query: string, page = 1) => {
    if (!query.trim()) {
      set({ results: [], isLoading: false });
      return;
    }

    set({ isLoading: true, query, error: null, results: [] });
    try {
      const response = await productService.search(query);
      set({ 
        results: page === 1 ? response : [...get().results, ...response],
        totalResults: response.length,
        hasMore: false,
        currentPage: page,
        isLoading: false 
      });
      get().addRecentSearch(query);
    } catch (error) {
      const mockResults = getMockResults(query);
      set({ 
        error: 'Erreur lors de la recherche',
        isLoading: false,
        results: mockResults
      });
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Search failed', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
    }
  },

  loadMore: () => {
    const { query, currentPage, hasMore, isLoading } = get();
    if (hasMore && !isLoading) {
      get().search(query, currentPage + 1);
    }
  },

  addRecentSearch: (query: string) => {
    const { recentSearches } = get();
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
    set({ recentSearches: updated });
  },

  clearRecent: () => {
    set({ recentSearches: [] });
  },

  clearResults: () => {
    set({ 
      results: [], 
      query: '', 
      totalResults: 0, 
      currentPage: 1, 
      hasMore: false, 
      error: null 
    });
  },
}));

// Helper function for mock results
function getMockResults(query: string): any[] {
  return [
    {
      id: 'mock-1',
      name: `Produit mock pour "${query}"`,
      description: 'Ceci est un produit de test',
      price: 10.99,
      stock: 5,
      is_active: true,
      created_at: new Date().toISOString()
    }
  ];
}
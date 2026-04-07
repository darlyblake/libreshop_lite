import { useState, useCallback, useEffect, useRef } from 'react';
import { searchService } from '../services/searchService';

interface UseSearchOptions {
  debounceDelay?: number;
  maxSuggestions?: number;
  onSearch?: (query: string) => Promise<any[]>;
  autoloadHistory?: boolean;
}

interface UseSearchReturn {
  query: string;
  setQuery: (text: string) => void;
  results: any[];
  suggestions: any[];
  isLoading: boolean;
  history: any[];
  clearSearch: () => void;
  clearHistory: () => Promise<void>;
  removeFromHistory: (query: string) => Promise<void>;
  performSearch: (searchFn: (q: string) => Promise<any[]>) => Promise<void>;
}

export const useSearch = (options: UseSearchOptions = {}): UseSearchReturn => {
  const {
    debounceDelay = 300,
    maxSuggestions = 10,
    onSearch,
    autoloadHistory = true,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const isMountedRef = useRef(true);

  // Charger l'historique au montage
  useEffect(() => {
    if (autoloadHistory) {
      loadHistory();
    }

    return () => {
      isMountedRef.current = false;
      searchService.cancelPendingOperations();
    };
  }, [autoloadHistory]);

  // Charger et mettre à jour les suggestions quand la requête change
  useEffect(() => {
    const updateSuggestions = async () => {
      if (!isMountedRef.current) return;
      const newSuggestions = await searchService.getSuggestions(query);
      if (isMountedRef.current) {
        setSuggestions(newSuggestions.slice(0, maxSuggestions));
      }
    };

    updateSuggestions();
  }, [query, maxSuggestions]);

  const loadHistory = useCallback(async () => {
    const hist = await searchService.getHistory();
    if (isMountedRef.current) {
      setHistory(hist);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
  }, []);

  const clearHistoryFn = useCallback(async () => {
    await searchService.clearHistory();
    setHistory([]);
  }, []);

  const removeFromHistoryFn = useCallback(async (q: string) => {
    await searchService.removeFromHistory(q);
    await loadHistory();
  }, [loadHistory]);

  const performSearch = useCallback(
    async (searchFn: (q: string) => Promise<any[]>) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchResults = await searchService.performSearch(
          query,
          searchFn,
          debounceDelay
        );

        if (isMountedRef.current) {
          setResults(searchResults);
          await loadHistory(); // Actualiser l'historique
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [query, debounceDelay, loadHistory]
  );

  return {
    query,
    setQuery,
    results,
    suggestions,
    isLoading,
    history,
    clearSearch,
    clearHistory: clearHistoryFn,
    removeFromHistory: removeFromHistoryFn,
    performSearch,
  };
};

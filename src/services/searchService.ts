import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorHandler } from '../utils/errorHandler';

interface SearchHistoryItem {
  query: string;
  timestamp: number;
  category?: string;
}

interface SearchSuggestion {
  id: string;
  label: string;
  type: 'recent' | 'popular' | 'category';
}

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  category?: string;
  image?: string;
  metadata?: any;
}

class SearchService {
  private static instance: SearchService;
  private searchHistoryKey = 'search_history';
  private maxHistoryItems = 20;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private popularSearches: string[] = [
    'Produits populaires',
    'Nouvelles collections',
    'Soldes',
    'Électronique',
    'Mode',
    'Maison',
    'Sports',
  ];

  private constructor() {}

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Effectue une recherche avec debounce
   */
  async performSearch(
    query: string,
    searchFunction: (query: string) => Promise<SearchResult[]>,
    debounceDelay: number = 300
  ): Promise<SearchResult[]> {
    return new Promise((resolve) => {
      // Annuler le délai précédent s'il existe
      const existingTimer = this.debounceTimers.get('search');
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Si la requête est vide, résoudre immédiatement
      if (!query.trim()) {
        resolve([]);
        return;
      }

      // Créer un nouveau délai
      const timer = setTimeout(async () => {
        try {
          const results = await searchFunction(query);
          // Ajouter à l'historique après une recherche réussie
          await this.addToHistory(query);
          this.debounceTimers.delete('search');
          resolve(results);
        } catch (error) {
          errorHandler.handle(error, 'Erreur lors de la recherche');
          this.debounceTimers.delete('search');
          resolve([]);
        }
      }, debounceDelay);

      this.debounceTimers.set('search', timer);
    });
  }

  /**
   * Obtient les suggestions de recherche
   */
  async getSuggestions(query: string): Promise<SearchSuggestion[]> {
    try {
      const suggestions: SearchSuggestion[] = [];
      const trimmedQuery = query.toLowerCase().trim();

      if (!trimmedQuery) {
        // Si pas de recherche, retourner l'historique récent et les recherches populaires
        const recent = await this.getHistory();
        suggestions.push(
          ...recent.map((item) => ({
            id: `history-${item.timestamp}`,
            label: item.query,
            type: 'recent' as const,
          }))
        );

        suggestions.push(
          ...this.popularSearches.map((search) => ({
            id: `popular-${search}`,
            label: search,
            type: 'popular' as const,
          }))
        );
      } else {
        // Filtrer l'historique par compatibilité
        const history = await this.getHistory();
        const matchingHistory = history
          .filter((item) => item.query.toLowerCase().includes(trimmedQuery))
          .slice(0, 3);

        suggestions.push(
          ...matchingHistory.map((item) => ({
            id: `history-${item.timestamp}`,
            label: item.query,
            type: 'recent' as const,
          }))
        );

        // Filtrer les recherches populaires
        const matchingPopular = this.popularSearches
          .filter((search) => search.toLowerCase().includes(trimmedQuery))
          .slice(0, 3);

        suggestions.push(
          ...matchingPopular.map((search) => ({
            id: `popular-${search}`,
            label: search,
            type: 'popular' as const,
          }))
        );
      }

      return suggestions;
    } catch (error) {
      errorHandler.handle(error, 'Erreur lors de la récupération des suggestions');
      return [];
    }
  }

  /**
   * Ajoute une recherche à l'historique
   */
  async addToHistory(query: string, category?: string): Promise<void> {
    try {
      if (!query.trim()) return;

      const history = await this.getHistory();

      // Éviter les doublons
      const filteredHistory = history.filter((item) => item.query !== query);

      // Ajouter la nouvelle recherche au début
      const newHistory: SearchHistoryItem[] = [
        {
          query: query.trim(),
          timestamp: Date.now(),
          category,
        },
        ...filteredHistory,
      ].slice(0, this.maxHistoryItems);

      await AsyncStorage.setItem(this.searchHistoryKey, JSON.stringify(newHistory));
    } catch (error) {
      errorHandler.handle(error, 'Erreur lors de la sauvegarde dans l\'historique');
    }
  }

  /**
   * Récupère l'historique de recherche
   */
  async getHistory(): Promise<SearchHistoryItem[]> {
    try {
      const history = await AsyncStorage.getItem(this.searchHistoryKey);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      errorHandler.handle(error, 'Erreur lors de la lecture de l\'historique');
      return [];
    }
  }

  /**
   * Supprime une recherche de l'historique
   */
  async removeFromHistory(query: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const filtered = history.filter((item) => item.query !== query);
      await AsyncStorage.setItem(this.searchHistoryKey, JSON.stringify(filtered));
    } catch (error) {
      errorHandler.handle(error, 'Erreur lors de la suppression de l\'historique');
    }
  }

  /**
   * Efface tout l'historique de recherche
   */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.searchHistoryKey);
    } catch (error) {
      errorHandler.handle(error, 'Erreur lors du nettoyage de l\'historique');
    }
  }

  /**
   * Annule les opérations de debounce en cours
   */
  cancelPendingOperations(): void {
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  /**
   * Filtre les résultats de recherche par catégorie
   */
  filterResults(results: SearchResult[], category?: string): SearchResult[] {
    if (!category) return results;
    return results.filter((result) => result.category === category);
  }

  /**
   * Trie les résultats de recherche
   */
  sortResults(
    results: SearchResult[],
    sortBy: 'relevance' | 'date' | 'name' = 'relevance'
  ): SearchResult[] {
    switch (sortBy) {
      case 'date':
        return [...results].sort((a, b) => {
          const aDate = a.metadata?.date || 0;
          const bDate = b.metadata?.date || 0;
          return bDate - aDate;
        });
      case 'name':
        return [...results].sort((a, b) => a.title.localeCompare(b.title));
      case 'relevance':
      default:
        return results;
    }
  }
}

export const searchService = SearchService.getInstance();

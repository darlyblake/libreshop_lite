import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from '../components/SearchBar';
import { useLegacyPalette } from '../hooks/useLegacyPalette';
import { useTheme } from '../hooks/useTheme';

/**
 * Exemple complet d'écran de recherche utilisant le nouveau système unifié
 * Remplace les implémentations dupliquées dans:
 * - SellerClientsScreen (ligne 393)
 * - ClientAllStoresScreen (ligne 374)
 * - SellerCaisseScreen (lignes 728, 971)
 * - ClientSearchScreen (version simplifiée)
 */

interface SearchExampleProps {
  onItemSelect?: (item: any) => void;
  searchFunction: (query: string) => Promise<any[]>;
  placeholder?: string;
  emptyMessage?: string;
  renderItem?: (item: any) => React.ReactElement;
}

export const SearchExampleScreen: React.FC<SearchExampleProps> = ({
  onItemSelect,
  searchFunction,
  placeholder = 'Rechercher...',
  emptyMessage = 'Aucun résultat',
  renderItem,
}) => {
  const palette = useLegacyPalette();
  const theme = useTheme();
  const SPACING = theme.spacing;
  const FONT_SIZE = theme.fontSize;

  // Utiliser le hook personnalisé pour toute la logique
  const {
    query,
    setQuery,
    results,
    suggestions,
    isLoading,
    history,
    clearSearch,
    removeFromHistory,
    performSearch,
  } = useSearch({
    debounceDelay: 300,
    maxSuggestions: 8,
    autoloadHistory: true,
  });

  // Effectuer la recherche quand la requête change
  useEffect(() => {
    if (query.trim()) {
      performSearch(searchFunction);
    }
  }, [query, performSearch, searchFunction]);

  const handleSuggestionPress = useCallback(
    (suggestionLabel: string) => {
      setQuery(suggestionLabel);
    },
    [setQuery]
  );

  const handleResultPress = useCallback(
    (item: any) => {
      onItemSelect?.(item);
    },
    [onItemSelect]
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    searchBarContainer: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      backgroundColor: palette.card,
    },
    suggestionsContainer: {
      backgroundColor: palette.card,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      maxHeight: 200,
    },
    suggestionItem: {
      flex: 1,
      flexDirection: 'row',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    suggestionText: {
      flex: 1,
      fontSize: FONT_SIZE.md,
      color: palette.text,
    },
    suggestionRemoveButton: {
      paddingLeft: SPACING.md,
    },
    resultsContainer: {
      flex: 1,
    },
    resultItem: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      backgroundColor: palette.card,
    },
    resultText: {
      fontSize: FONT_SIZE.md,
      color: palette.text,
      marginBottom: SPACING.xs,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: FONT_SIZE.lg,
      color: palette.textMuted,
    },
    historyContainer: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    historyTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '600',
      color: palette.text,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    historyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    historyText: {
      fontSize: FONT_SIZE.md,
      color: palette.text,
    },
  });

  // État de la recherche: suggestions, résultats ou historique
  const showSuggestions = query.trim() === '' && suggestions.length > 0;
  const showResults = query.trim() !== '' && results.length > 0;
  const showHistory = query.trim() === '' && history.length > 0 && !showSuggestions;
  const showEmpty = query.trim() !== '' && results.length === 0 && !isLoading;

  return (
    <View style={styles.container}>
      {/* Barre de recherche */}
      <View style={styles.searchBarContainer}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          isLoading={isLoading}
          onClear={clearSearch}
          showCancelButton={query.length > 0}
          onCancel={clearSearch}
        />
      </View>

      {/* Suggestions */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSuggestionPress(item.label)}
              >
                <Text style={styles.suggestionText}>{item.label}</Text>
                {item.type === 'recent' && (
                  <TouchableOpacity
                    style={styles.suggestionRemoveButton}
                    onPress={() => removeFromHistory(item.label)}
                  >
                    <Text style={{ color: palette.textMuted }}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Résultats */}
      {showResults && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) =>
              renderItem ? (
                <TouchableOpacity onPress={() => handleResultPress(item)}>
                  {renderItem(item)}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleResultPress(item)}
                >
                  <Text style={styles.resultText}>{item.title}</Text>
                  {item.description && (
                    <Text style={{ ...styles.resultText, fontSize: FONT_SIZE.sm, color: palette.textMuted }}>
                      {item.description}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            }
          />
        </View>
      )}

      {/* Chargement */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      )}

      {/* Vide */}
      {showEmpty && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      )}

      {/* Historique */}
      {showHistory && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Recherches Récentes</Text>
          <FlatList
            data={history}
            keyExtractor={(item) => item.timestamp.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.historyItem}
                onPress={() => handleSuggestionPress(item.query)}
              >
                <Text style={styles.historyText}>{item.query}</Text>
                <TouchableOpacity onPress={() => removeFromHistory(item.query)}>
                  <Text style={{ color: palette.textMuted }}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

export default SearchExampleScreen;

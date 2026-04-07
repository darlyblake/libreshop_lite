# Système de Recherche Unifié - Guide d'Utilisation

## 📋 Résumé

Trois nouveaux fichiers ont été créés pour centraliser la logique de recherche et éliminer la duplication de code:

1. **SearchBar.tsx (Enhanced)** - Composant de barre de recherche amélioré
2. **searchService.ts** - Service centralisé de recherche
3. **useSearch.ts** - Hook React pour la logique de recherche

## 🎯 Améliorations

### SearchBar Component
✅ Props consolidées de tous les écrans:
- `value` & `onChangeText` - Gestion du texte
- `onFocus` & `onBlur` - Callbacks de focus
- `showCancelButton` & `onCancel` - Bouton annuler
- `onSubmitEditing` - Soumission du clavier
- `isLoading` - Indicateur de chargement
- `editable` - Contrôle activation/désactivation
- `testID` - Support du testing

### Search Service
✅ Centralize:
- **Debouncing** - Évite les requêtes trop fréquentes
- **Historique** - Gestion automatique des recherches recentes
- **Suggestions** - Récentes + Populaires + Filtrées
- **Filtrage** - Par catégorie
- **Tri** - Pertinence/Date/Nom

### useSearch Hook
✅ Encapsule:
- État de la recherche (query, results, suggestions)
- Chargement de l'historique automatique
- Annulation des opérations en cours au unmount
- Callbacks préconfigurés pour les actions courantes

## 💡 Exemples d'Utilisation

### Utilisation Basique

```typescript
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from '../components/SearchBar';

// Dans votre composant
const { 
  query, 
  setQuery, 
  results, 
  suggestions, 
  isLoading,
  clearSearch,
  performSearch 
} = useSearch({
  debounceDelay: 300,
  autoloadHistory: true,
});

// Effectuer une recherche quand la requête change
useEffect(() => {
  if (query.trim()) {
    performSearch(async (q) => {
      // Votre fonction de recherche
      return await yourSearchFunction(q);
    });
  }
}, [query, performSearch]);

return (
  <SearchBar
    value={query}
    onChangeText={setQuery}
    isLoading={isLoading}
    onClear={clearSearch}
  />
);
```

### Avec Suggestionss

```typescript
const { query, setQuery, suggestions, performSearch, isLoading } = useSearch();

return (
  <>
    <SearchBar
      value={query}
      onChangeText={setQuery}
      isLoading={isLoading}
      showCancelButton={query.length > 0}
      onCancel={() => setQuery('')}
    />
    
    <FlatList
      data={suggestions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => {
            setQuery(item.label);
            performSearch(mySearchFn);
          }}
        >
          <Text>{item.label}</Text>
        </TouchableOpacity>
      )}
    />
  </>
);
```

### Avec Historique

```typescript
const { 
  query, 
  setQuery, 
  history, 
  clearHistory, 
  removeFromHistory,
  performSearch 
} = useSearch();

return (
  <>
    {history.length > 0 && (
      <View>
        <Text>Historique</Text>
        <FlatList
          data={history}
          keyExtractor={(item) => item.timestamp.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                setQuery(item.query);
                performSearch(mySearchFn);
              }}
            >
              <Text>{item.query}</Text>
              <TouchableOpacity 
                onPress={() => removeFromHistory(item.query)}
              >
                <Text>Supprimer</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
        <Button title="Effacer l'historique" onPress={clearHistory} />
      </View>
    )}
  </>
);
```

## 🔄 Migration des Écrans Existants

### Avant (Duplication)
```typescript
// SellerClientsScreen.tsx (ligne 393)
<View style={styles.searchContainer}>
  <TextInput
    style={styles.searchInput}
    value={searchText}
    onChangeText={setSearchText}
    placeholder="Rechercher un client..."
  />
  <Ionicons name="search" size={20} />
</View>

// ClientAllStoresScreen.tsx (ligne 374)
<BlurView style={styles.header}>
  <TextInput
    value={searchText}
    onChangeText={setSearchText}
    placeholder="Rechercher un magasin..."
  />
</BlurView>

// SellerCaisseScreen.tsx (ligne 728)
<TextInput
  value={searchText}
  onChangeText={setSearchText}
  placeholder="Scanner ou rechercher..."
/>
```

### Après (Unifié)
```typescript
// Tous les écrans
import { SearchBar } from '../components/SearchBar';
import { useSearch } from '../hooks/useSearch';

const { query, setQuery, isLoading } = useSearch();

return (
  <SearchBar
    value={query}
    onChangeText={setQuery}
    placeholder="Rechercher..."
    isLoading={isLoading}
  />
);
```

## 📊 API Complète

### SearchBar Props
```typescript
interface SearchBarProps {
  value: string;                           // Valeur du texte
  onChangeText: (text: string) => void;    // Callback texte changé
  onSubmitEditing?: () => void;            // Callback clavier submit
  onClear?: () => void;                    // Callback effacer
  onFocus?: () => void;                    // Callback focus
  onBlur?: () => void;                     // Callback blur
  placeholder?: string;                    // Placeholder du champ
  style?: ViewStyle;                       // Style personnalisé
  autoFocus?: boolean;                     // Auto-focus au montage
  showCancelButton?: boolean;               // Afficher bouton annuler
  onCancel?: () => void;                   // Callback annuler
  isLoading?: boolean;                     // Afficher spinner
  editable?: boolean;                      // Editable ou non
  testID?: string;                         // Pour les tests
}
```

### useSearch Options
```typescript
interface UseSearchOptions {
  debounceDelay?: number;                  // Délai debounce (300ms défaut)
  maxSuggestions?: number;                 // Max suggestions affichées
  onSearch?: (query: string) => Promise<any[]>;  // Fonction recherche
  autoloadHistory?: boolean;               // Charger historique au mount
}
```

### useSearch Return
```typescript
interface UseSearchReturn {
  query: string;                           // Requête actuelle
  setQuery: (text: string) => void;        // Setter requête
  results: any[];                          // Résultats recherche
  suggestions: any[];                      // Suggestions
  isLoading: boolean;                      // État chargement
  history: any[];                          // Historique recherche
  clearSearch: () => void;                 // Vider recherche
  clearHistory: () => Promise<void>;       // Effacer historique
  removeFromHistory: (query: string) => Promise<void>;  // Supprimer un item
  performSearch: (searchFn: (q: string) => Promise<any[]>) => Promise<void>;  // Effectuer recherche
}
```

### searchService Methods
```typescript
// Recherche avec debounce
performSearch(query, searchFn, debounceDelay = 300): Promise<SearchResult[]>

// Suggestions (récentes + populaires)
getSuggestions(query): Promise<SearchSuggestion[]>

// Historique
getHistory(): Promise<SearchHistoryItem[]>
addToHistory(query, category?): Promise<void>
removeFromHistory(query): Promise<void>
clearHistory(): Promise<void>

// Filtrage et tri
filterResults(results, category?): SearchResult[]
sortResults(results, sortBy = 'relevance'): SearchResult[]

// Utilitaires
cancelPendingOperations(): void
```

## 🎯 Prochaines Étapes

### Phase 1: Validation (Immediate)
- [ ] Tester SearchBar avec tous les props
- [ ] Vérifier debounce et suggestions
- [ ] Valider historique persistence

### Phase 2: Migration Progressive
- [ ] ClientSearchScreen (écran complet)
- [ ] SellerClientsScreen (ligne 393)
- [ ] ClientAllStoresScreen (ligne 374)
- [ ] SellerCaisseScreen (lignes 728, 971)

### Phase 3: Optimisations
- [ ] Ajouter cache aux résultats de recherche
- [ ] Intégrer analytics (recherches populaires)
- [ ] Support des filtres avancés
- [ ] Recherche offline avec cache

## 🐛 Dépannage

### Suggestions ne s'affichent pas
```typescript
// Vérifier que getSuggestions est appelé après setQuery
useEffect(() => {
  // Les suggestions sont mises à jour automatiquement via le hook
}, [query]); // Dépendance sur query
```

### Historique ne persiste pas
```typescript
// Vérifier AsyncStorage est bien configuré
const { clearHistory } = useSearch({ autoloadHistory: true });
// Puis vérifier dans AsyncStorage.getItem('search_history')
```

### Performance lente
```typescript
// Augmenter le debounceDelay
const { query } = useSearch({ debounceDelay: 500 });
```

## 📈 Bénéfices Attendus

- ✅ **Élimination de duplication**: -500+ lignes de code
- ✅ **Cohérence**: Same behavior partout
- ✅ **Maintenabilité**: Changements centralisés
- ✅ **Performance**: Debouncing optimisé + historique local
- ✅ **UX**: Suggestions + Historique auto
- ✅ **Testing**: Logique isolée et testable

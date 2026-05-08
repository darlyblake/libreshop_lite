# Plan d'Implémentation - Géolocalisation et Cartes

## Stack Technologique
- **Carte**: MapLibre GL + OpenStreetMap (gratuit, open-source)
- **Bibliothèque**: `@maplibre/maplibre-react-native`
- **Géolocalisation**: `expo-location`
- **Geocoding**: API Nominatim (OSM)

---

## 📋 Ordre d'Implémentation avec Validation

### Étape 1: Mise à jour BDD (Supabase)
- [x] Exécuter le SQL pour ajouter les colonnes
- [x] Vérifier que les colonnes sont créées
- [x] Tester l'index

**SQL à exécuter :**
```sql
ALTER TABLE stores 
ADD COLUMN latitude numeric,
ADD COLUMN longitude numeric,
ADD COLUMN address text,
ADD COLUMN city text,
ADD COLUMN country text DEFAULT 'Gabon',
ADD COLUMN location_set_at timestamp with time zone;

CREATE INDEX idx_stores_location ON stores(latitude, longitude) WHERE latitude IS NOT NULL;
```

---

### Étape 2: Installation des Packages
- [ ] Installer @maplibre/maplibre-react-native
- [ ] Installer expo-location
- [ ] Exécuter pod install pour iOS
- [ ] Vérifier que les packages sont installés

**Commandes :**
```bash
npm install @maplibre/maplibre-react-native expo-location
cd ios && pod install && cd ..
```

---

### Étape 3: Création des Services
- [ ] Créer src/services/locationService.ts
- [ ] Implémenter getCurrentPosition()
- [ ] Implémenter geocodeAddress()
- [ ] Implémenter reverseGeocode()
- [ ] Implémenter calculateDistance()
- [ ] Implémenter openDirections()
- [ ] Ajouter updateStoreLocation() dans storeService
- [ ] Ajouter findNearbyStores() dans storeService
- [ ] Tester les services

---

### Étape 4: Création des Composants
- [ ] Créer src/components/StoreMap.tsx
- [ ] Créer src/components/LocationPicker.tsx
- [ ] Tester StoreMap en mode 'view'
- [ ] Tester StoreMap en mode 'select'
- [ ] Tester LocationPicker
- [ ] Ajouter les exports dans src/components/index.ts

---

### Étape 5: Intégration SellerSettingsScreen (PRIORITÉ)
- [ ] Ouvrir src/screens/SellerSettingsScreen.tsx
- [ ] Ajouter l'option "Localisation de la boutique"
- [ ] Ajouter le modal avec LocationPicker
- [ ] Implémenter la mise à jour de localisation
- [ ] Tester avec une boutique existante
- [ ] Vérifier que les données sont sauvegardées en BDD

---

### Étape 6: Intégration AddStoreScreen
- [ ] Ouvrir src/screens/AddStoreScreen.tsx
- [ ] Ajouter LocationPicker dans le formulaire
- [ ] Récupérer la localisation sélectionnée
- [ ] Envoyer lat/lon/address/city lors de la création
- [ ] Tester la création d'une boutique avec localisation

---

### Étape 7: Intégration StoreDetailScreen
- [ ] Ouvrir src/screens/StoreDetailScreen.tsx
- [ ] Ajouter bouton "Carte" (si localisation définie)
- [ ] Ajouter bouton "Itinéraire" (si localisation définie)
- [ ] Créer l'écran StoreMap pour afficher la carte
- [ ] Tester l'ouverture de la carte
- [ ] Tester l'itinéraire Google Maps

---

### Étape 8: Ajouter filtre "Près de chez moi" sur HomeScreen
- [ ] Ouvrir src/screens/HomeScreen.tsx
- [ ] Ajouter le bouton/filtre "Près de chez moi"
- [ ] Implémenter le sélecteur de rayon (5km, 10km, 20km)
- [ ] Utiliser findNearbyStores() pour filtrer
- [ ] Trier les résultats par distance
- [ ] Afficher la distance sur chaque boutique
- [ ] Tester le filtre

---

### Étape 9: Configuration Permissions Expo
- [ ] Ouvrir app.config.js ou app.json
- [ ] Ajouter le plugin expo-location
- [ ] Définir le message de permission
- [ ] Tester la demande de permission sur mobile

---

### Étape 10: Tests Finaux
- [ ] Tester création boutique avec localisation
- [ ] Test modification localisation boutique existante
- [ ] Test affichage carte sur détail boutique
- [ ] Test itinéraire Google Maps
- [ ] Test filtre "Près de chez moi"
- [ ] Test sur iOS
- [ ] Test sur Android
- [ ] Test sur Web

---

## 📊 Progression Globale

**Étapes complétées : 1 / 10**  
**Pourcentage : 10%**

---

## Notes Importantes

- Les boutiques créées avant cette fonctionnalité auront latitude/longitude = NULL
- Le paramètre dans SellerSettingsScreen permet de corriger cela
- Geocoding Nominatim limité à 1 req/sec (utiliser cache côté client)
- Demander permission localisation avec message clair

## Étape 3: Services à Créer

### src/services/locationService.ts
- getCurrentPosition() - Position utilisateur
- geocodeAddress(address) - Adresse → Coordonnées
- reverseGeocode(lat, lon) - Coordonnées → Adresse
- calculateDistance() - Distance entre 2 points
- openDirections() - Ouvrir Google Maps

### src/services/storeService.ts (ajouts)
- updateStoreLocation(storeId, location)
- findNearbyStores(lat, lon, radiusKm)

## Étape 4: Composants

### src/components/StoreMap.tsx
- Mode 'view': Afficher les boutiques sur carte
- Mode 'select': Choisir une position (draggable)

### src/components/LocationPicker.tsx
- Bouton "Utiliser ma position"
- Carte interactive pour sélection
- Reverse geocoding automatique

## Étape 5: Intégration

### 5.1 Création Boutique (AddStoreScreen)
- Ajouter LocationPicker dans formulaire
- Sauvegarder lat/lon/address/city

### 5.2 Détail Boutique (StoreDetailScreen)
- Bouton "Carte" → Voir sur carte
- Bouton "Itinéraire" → Ouvrir Google Maps
- Afficher localisation si définie

### 5.3 Paramètres Boutique (SellerSettingsScreen) ⚠️ IMPORTANT
Permettre aux boutiques existantes d'ajouter/modifier localisation:

```typescript
// Dans SellerSettingsScreen
<View style={styles.settingItem}>
  <Ionicons name="location" size={24} color={COLORS.accent} />
  <View>
    <Text>Localisation de la boutique</Text>
    <Text>
      {storeLocation?.latitude 
        ? storeLocation.address || 'Définie'
        : 'Non définie'}
    </Text>
  </View>
  <TouchableOpacity onPress={() => setShowLocationPicker(true)}>
    <Ionicons name="chevron-forward" size={20} />
  </TouchableOpacity>
</View>

// Modal avec LocationPicker pour modifier
<Modal visible={showLocationPicker}>
  <LocationPicker
    initialLocation={storeLocation}
    onLocationSelect={async (location) => {
      await storeService.updateStoreLocation(store.id, location);
      setStoreLocation(location);
      setShowLocationPicker(false);
    }}
  />
</Modal>
```

### 5.4 Accueil (HomeScreen)
- Filtre "Près de chez moi"
- Rayon: 5km, 10km, 20km
- Tri par distance

## Étape 6: Permissions Expo

Ajouter dans app.config.js:
```json
{
  "plugins": [
    ["expo-location", {
      "locationAlwaysAndWhenInUsePermission": "Autoriser LibreShop à accéder à votre position"
    }]
  ]
}
```

## Ordre Recommandé

1. ✅ Mise à jour BDD (Supabase)
2. ✅ Installation packages
3. ✅ Créer locationService
4. ✅ Créer StoreMap + LocationPicker
5. ✅ Intégrer dans SellerSettingsScreen (priorité - pour boutiques existantes)
6. ✅ Intégrer dans AddStoreScreen
7. ✅ Intégrer dans StoreDetailScreen
8. ✅ Ajouter filtre "Près de chez moi" sur HomeScreen

## Notes Importantes

- Les boutiques créées avant cette fonctionnalité auront latitude/longitude = NULL
- Le paramètre dans SellerSettingsScreen permet de corriger cela
- Geocoding Nominatim limité à 1 req/sec (utiliser cache côté client)
- Demander permission localisation avec message clair

import * as Location from 'expo-location';
import * as Linking from 'expo-linking';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface Address {
  street?: string;
  city?: string;
  country?: string;
  postalCode?: string;
}

export const locationService = {
  /**
   * Obtenir la position actuelle de l'utilisateur
   */
  async getCurrentPosition(): Promise<LocationCoords | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[LocationService] Permission de localisation refusée');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('[LocationService] Erreur lors de l\'obtention de la position:', error);
      return null;
    }
  },

  /**
   * Geocoding : Adresse → Coordonnées
   * Utilise l'API Nominatim d'OpenStreetMap (gratuit, limité à 1 req/sec)
   */
  async geocodeAddress(address: string): Promise<LocationCoords | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'LibreShop/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
      }
      return null;
    } catch (error) {
      console.error('[LocationService] Erreur de geocoding:', error);
      return null;
    }
  },

  /**
   * Reverse Geocoding : Coordonnées → Adresse
   * Utilise l'API Nominatim d'OpenStreetMap
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<Address | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'LibreShop/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        street: data.display_name,
        city: data.address?.city || data.address?.town || data.address?.village,
        country: data.address?.country,
      };
    } catch (error) {
      console.error('[LocationService] Erreur de reverse geocoding:', error);
      return null;
    }
  },

  /**
   * Calculer la distance entre deux points (en km)
   * Utilise la formule de Haversine
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Ouvrir l'itinéraire dans Google Maps
   */
  async openDirections(destLat: number, destLon: number, destName: string): Promise<void> {
    try {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLon}&destination_place_id=${encodeURIComponent(destName)}`;
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error('[LocationService] Impossible d\'ouvrir l\'URL:', url);
      }
    } catch (error) {
      console.error('[LocationService] Erreur lors de l\'ouverture des directions:', error);
    }
  },

  /**
   * Ouvrir une position spécifique dans Google Maps
   */
  async openInMaps(lat: number, lon: number, label?: string): Promise<void> {
    try {
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}${label ? `+${encodeURIComponent(label)}` : ''}`;
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error('[LocationService] Impossible d\'ouvrir l\'URL:', url);
      }
    } catch (error) {
      console.error('[LocationService] Erreur lors de l\'ouverture de la carte:', error);
    }
  },
};

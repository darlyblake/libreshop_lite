import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '../config/theme';
import { locationService, LocationCoords, Address } from '../services/locationService';
import { StoreMap } from './StoreMap';

interface LocationPickerProps {
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  }) => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  initialLocation,
}) => {
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(
    initialLocation || null
  );
  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [address, setAddress] = useState<string>('');

  const handleGetCurrentLocation = async () => {
    setLoading(true);
    try {
      const location = await locationService.getCurrentPosition();
      if (location) {
        setCurrentLocation(location);
        
        // Reverse geocoding pour obtenir l'adresse
        setLoadingAddress(true);
        const addr = await locationService.reverseGeocode(
          location.latitude,
          location.longitude
        );
        setAddress(addr?.street || addr?.city || 'Localisation obtenue');
        setLoadingAddress(false);
      } else {
        Alert.alert(
          'Permission refusée',
          'Veuillez autoriser l\'accès à votre position pour utiliser cette fonctionnalité.'
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'obtention de la position:', error);
      Alert.alert(
        'Erreur',
        'Impossible d\'obtenir votre position actuelle. Vérifiez vos paramètres de localisation.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLocation = async () => {
    if (!currentLocation) {
      Alert.alert('Erreur', 'Veuillez d\'abord sélectionner une localisation');
      return;
    }

    setLoadingAddress(true);
    try {
      const addr = await locationService.reverseGeocode(
        currentLocation.latitude,
        currentLocation.longitude
      );

      onLocationSelect({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: addr?.street,
        city: addr?.city,
      });
    } catch (error) {
      console.error('Erreur lors du reverse geocoding:', error);
      // Confirmer même sans adresse
      onLocationSelect({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    } finally {
      setLoadingAddress(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Localisation de la boutique</Text>
        <Text style={styles.subtitle}>
          Sélectionnez la position de votre boutique sur la carte
        </Text>
      </View>

      {Platform.OS === 'web' && (
        <View style={styles.webNotice}>
          <Ionicons name="information-circle" size={20} color={COLORS.accent} />
          <Text style={styles.webNoticeText}>
            La carte interactive n'est pas disponible sur le web. Utilisez "Utiliser ma position actuelle" pour définir votre localisation.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.currentLocationButton}
        onPress={handleGetCurrentLocation}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.accent} />
        ) : (
          <>
            <Ionicons name="location" size={20} color={COLORS.accent} />
            <Text style={styles.buttonText}>
              Utiliser ma position actuelle
            </Text>
          </>
        )}
      </TouchableOpacity>

      {currentLocation && Platform.OS !== 'web' && (
        <>
          <StoreMap
            mode="select"
            initialCenter={currentLocation}
            height={250}
            onLocationSelect={(coords) => {
              setCurrentLocation(coords);
              setAddress('Position mise à jour');
            }}
          />

          {address && (
            <View style={styles.addressContainer}>
              <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.addressText}>{address}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmLocation}
            disabled={loadingAddress}
          >
            {loadingAddress ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.confirmButtonText}>Confirmer la localisation</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {currentLocation && Platform.OS === 'web' && (
        <>
          <View style={styles.addressContainer}>
            <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.addressText}>
              Position : {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmLocation}
            disabled={loadingAddress}
          >
            {loadingAddress ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.confirmButtonText}>Confirmer la localisation</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {!currentLocation && (
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>
            Sélectionnez une position sur la carte
          </Text>
          <Text style={styles.emptySubtext}>
            Cliquez sur "Utiliser ma position actuelle" ou déplacez le marqueur
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent + '15',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  webNoticeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    flex: 1,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  buttonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
  },
  addressText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    flex: 1,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

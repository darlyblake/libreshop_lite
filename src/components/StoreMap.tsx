import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { COLORS, SPACING, RADIUS } from '../config/theme';

// Configuration du style de carte OpenStreetMap
const STYLE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

interface Store {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface StoreMapProps {
  stores?: Store[];
  onStorePress?: (storeId: string) => void;
  selectedStore?: string;
  onLocationSelect?: (coords: { latitude: number; longitude: number }) => void;
  mode?: 'view' | 'select';
  initialCenter?: { latitude: number; longitude: number };
  height?: number;
}

export const StoreMap: React.FC<StoreMapProps> = ({
  stores = [],
  onStorePress,
  selectedStore,
  onLocationSelect,
  mode = 'view',
  initialCenter = { latitude: 0.375, longitude: 9.45 }, // Centre du Gabon par défaut
  height = 300,
}) => {
  const [region, setRegion] = useState({
    latitude: initialCenter.latitude,
    longitude: initialCenter.longitude,
    zoomLevel: 12,
  });

  return (
    <View style={[styles.container, { height }]}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL={STYLE_URL}
      >
        <MapLibreGL.Camera
          zoomLevel={region.zoomLevel}
          centerCoordinate={[region.longitude, region.latitude]}
        />

        {mode === 'select' && (
          <MapLibreGL.PointAnnotation
            id="selected-location"
            coordinate={[region.longitude, region.latitude]}
            onDragEnd={(e) => {
              const { latitude, longitude } = e.geometry.coordinates;
              if (onLocationSelect) {
                onLocationSelect({ latitude, longitude });
              }
            }}
            draggable
          >
            <View style={styles.marker}>
              <View style={styles.markerInner} />
              <View style={styles.markerRing} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {stores.map((store) => (
          <MapLibreGL.PointAnnotation
            key={store.id}
            id={store.id}
            coordinate={[store.longitude, store.latitude]}
            onSelected={() => onStorePress?.(store.id)}
          >
            <View style={[
              styles.marker, 
              selectedStore === store.id && styles.markerSelected
            ]}>
              <View style={styles.markerInner} />
              {selectedStore === store.id && <View style={styles.markerRing} />}
            </View>
            <MapLibreGL.Callout title={store.name} />
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    borderWidth: 3,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerSelected: {
    backgroundColor: COLORS.primary,
    transform: [{ scale: 1.2 }],
  },
  markerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.white,
  },
  markerRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
  },
});

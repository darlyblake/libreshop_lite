import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { COLORS, RADIUS } from '../config/theme';

// Fix for default marker icon in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create a custom icon to ensure visibility
const customIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div style="background-color: #e11d48; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

interface Store {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface WebMapProps {
  stores?: Store[];
  onStorePress?: (storeId: string) => void;
  selectedStore?: string;
  onLocationSelect?: (coords: { latitude: number; longitude: number }) => void;
  mode?: 'view' | 'select';
  initialCenter?: { latitude: number; longitude: number };
  height?: number;
  selectedLocation?: { latitude: number; longitude: number };
}

// Component to handle map clicks in select mode
const MapClickHandler: React.FC<{ onLocationSelect: (coords: { latitude: number; longitude: number }) => void }> = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      });
    },
  });
  return null;
};

// Component to update map center when location changes
const MapCenterUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
};

export const WebMap: React.FC<WebMapProps> = ({
  stores = [],
  onStorePress,
  selectedStore,
  onLocationSelect,
  mode = 'view',
  initialCenter = { latitude: 0.375, longitude: 9.45 }, // Centre du Gabon par défaut
  height = 300,
  selectedLocation,
}) => {
  const [center, setCenter] = useState<[number, number]>([initialCenter.latitude, initialCenter.longitude]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    selectedLocation ? [selectedLocation.latitude, selectedLocation.longitude] : null
  );

  useEffect(() => {
    console.log('[WebMap] Initial center set to:', initialCenter);
    setCenter([initialCenter.latitude, initialCenter.longitude]);
  }, [initialCenter]);

  useEffect(() => {
    console.log('[WebMap] selectedLocation changed:', selectedLocation);
    if (selectedLocation) {
      console.log('[WebMap] Setting marker and center to:', selectedLocation);
      setCenter([selectedLocation.latitude, selectedLocation.longitude]);
      setMarkerPosition([selectedLocation.latitude, selectedLocation.longitude]);
    }
  }, [selectedLocation]);

  const handleLocationSelect = (coords: { latitude: number; longitude: number }) => {
    console.log('[WebMap] Location selected:', coords);
    setMarkerPosition([coords.latitude, coords.longitude]);
    setCenter([coords.latitude, coords.longitude]);
    if (onLocationSelect) {
      onLocationSelect(coords);
    }
  };

  return (
    <div style={{ height: `${height}px`, width: '100%', borderRadius: `${RADIUS.lg}px`, overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <MapCenterUpdater center={center} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mode === 'select' && <MapClickHandler onLocationSelect={handleLocationSelect} />}

        {mode === 'select' && (
          <>
            {console.log('[WebMap] Rendering marker, markerPosition:', markerPosition)}
            {markerPosition && (
              <Marker 
                key="selected-location" 
                position={markerPosition}
                icon={customIcon}
              >
                <Popup>Position sélectionnée</Popup>
              </Marker>
            )}
          </>
        )}

        {stores.map((store) => (
          <Marker
            key={store.id}
            position={[store.latitude, store.longitude]}
            eventHandlers={{
              click: () => onStorePress?.(store.id),
            }}
          >
            <Popup>{store.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

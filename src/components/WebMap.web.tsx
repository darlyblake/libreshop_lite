import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '../config/theme';
import { Ionicons } from '@expo/vector-icons';
import { cloudinaryService } from '../services/cloudinaryService';

// Fix Leaflet icons issue in React Web
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface StoreMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  category: string;
  logo_url?: string;
  banner_url?: string;
  rating_avg?: number;
}

interface WebMapProps {
  stores: StoreMapMarker[];
  onStoreClick: (storeId: string) => void;
  onNavigateClick: (store: StoreMapMarker) => void;
}

// Center map on Gabon (Libreville roughly)
const GABON_CENTER: [number, number] = [0.3901, 9.4544];

export const WebMap: React.FC<WebMapProps> = ({ stores, onStoreClick, onNavigateClick }) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  }

  // Filter out stores without coordinates
  const validStores = stores.filter(s => s.latitude && s.longitude);

  return (
    <View style={{ flex: 1 }}>
      <MapContainer 
        center={GABON_CENTER} 
        zoom={12} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {validStores.map(store => (
          <Marker 
            key={store.id} 
            position={[store.latitude, store.longitude]}
          >
            <Popup className="custom-popup">
              <View style={styles.popupContainer}>
                {/* Banner */}
                {store.banner_url ? (
                  <Image 
                    source={{ uri: cloudinaryService.getOptimizedUrl(store.banner_url, 300) }} 
                    style={styles.banner} 
                  />
                ) : (
                  <View style={[styles.banner, { backgroundColor: COLORS.accent + '30' }]} />
                )}
                
                {/* Logo */}
                <View style={styles.logoContainer}>
                  {store.logo_url ? (
                    <Image source={{ uri: cloudinaryService.getOptimizedUrl(store.logo_url, 100) }} style={styles.logo} />
                  ) : (
                    <Ionicons name="storefront" size={20} color={COLORS.accent} />
                  )}
                </View>

                {/* Content */}
                <View style={styles.content}>
                  <Text style={styles.name} numberOfLines={1}>{store.name}</Text>
                  <Text style={styles.category}>{store.category}</Text>
                  
                  {store.rating_avg !== undefined && store.rating_avg > 0 && (
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text style={styles.ratingText}>{store.rating_avg.toFixed(1)}</Text>
                    </View>
                  )}

                  <View style={styles.actions}>
                    <TouchableOpacity 
                      style={styles.btnNavigate} 
                      onPress={() => onNavigateClick(store)}
                    >
                      <Ionicons name="navigate-circle" size={18} color="white" />
                      <Text style={styles.btnNavigateText}>S'y rendre</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.btnView} 
                      onPress={() => onStoreClick(store.id)}
                    >
                      <Text style={styles.btnViewText}>Voir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  popupContainer: {
    width: 200,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  banner: {
    width: '100%',
    height: 80,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.card,
    position: 'absolute',
    top: 58,
    left: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 10,
    paddingTop: 28,
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  category: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  btnNavigate: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  btnNavigateText: {
    color: 'white',
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
  },
  btnView: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: RADIUS.full,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnViewText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
  }
});

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZE, SPACING } from '../config/theme';
import { storeService } from '../services/storeService';
import { WebMap } from '../components/WebMap';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const ClientMapScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Fetch all active stores for the map
        // For performance, we could only fetch stores that have lat/lng set
        // But storeService.getAll limits to 20 by default unless we specify
        // For a map, we might need a specific endpoint to fetch just map markers
        // We'll use getPopularStores as a proxy for now, or getAll with a large limit
        
        // Let's use a broad fetch.
        const fetchedStores = await storeService.getPopularStores(100); 
        // Filter out those without valid coordinates
        const storesWithLocation = fetchedStores.filter((s: any) => s.latitude && s.longitude);
        setStores(storesWithLocation);
      } catch (err) {
        console.error('Error fetching map stores:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, []);

  const handleNavigateClick = (store: any) => {
    if (!store.latitude || !store.longitude) return;
    
    // Create the routing URL
    const scheme = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${store.latitude},${store.longitude}`;
    const label = encodeURIComponent(store.name);
    
    let url = '';
    if (Platform.OS === 'ios') {
      url = `maps:0,0?q=${label}@${latLng}`;
    } else if (Platform.OS === 'android') {
      url = `geo:0,0?q=${latLng}(${label})`;
    } else {
      // Web
      url = `https://www.google.com/maps/dir/?api=1&destination=${latLng}`;
    }

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to browser
        const browserUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng}`;
        Linking.openURL(browserUrl);
      }
    });
  };

  const handleStoreClick = (storeId: string) => {
    navigation.navigate('StoreDetail', { storeId });
  };

  return (
    <View style={styles.container}>
      {/* Header overlay */}
      <View style={[styles.header, { top: insets.top + SPACING.md }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Boutiques à proximité</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
        </View>
      ) : (
        <WebMap 
          stores={stores} 
          onStoreClick={handleStoreClick} 
          onNavigateClick={handleNavigateClick} 
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 30,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default ClientMapScreen;

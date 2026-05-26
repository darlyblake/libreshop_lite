import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE } from '../config/theme';

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

export const WebMap: React.FC<WebMapProps> = ({ stores, onStoreClick, onNavigateClick }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>La carte interactive n'est disponible que sur la version Web pour le moment.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  text: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  }
});

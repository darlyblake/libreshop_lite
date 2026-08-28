import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { storeService } from '../services/storeService';
import { StoreDetailScreen } from './StoreDetailScreen';
import { BarDetailScreen } from './BarDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreDetail'>;
type StoreKind = 'bar' | 'restaurant' | 'general';

/**
 * Stable public entry point for /store links.
 * Resolves the store type before selecting the client-facing interface.
 */
export const StoreDetailRouterScreen: React.FC<Props> = ({ route }) => {
  const { storeId } = route.params || {};
  const [storeKind, setStoreKind] = useState<StoreKind | null>(null);

  useEffect(() => {
    let mounted = true;

    const resolveStore = async () => {
      // Preserve existing slug-only StoreDetail behavior.
      if (!storeId) {
        if (mounted) setStoreKind('general');
        return;
      }

      try {
        const store = await storeService.getById(String(storeId));
        if (!mounted) return;

        const type = String(store?.store_type || '').trim().toLowerCase();
        if (type === 'bar') setStoreKind('bar');
        else if (type === 'restaurant') setStoreKind('restaurant');
        else setStoreKind('general');
      } catch (error) {
        // Let StoreDetailScreen keep its existing error handling if the type
        // cannot be resolved (for example, an invalid/inaccessible store id).
        console.warn('[StoreDetailRouter] Unable to resolve store type:', error);
        if (mounted) setStoreKind('general');
      }
    };

    resolveStore();
    return () => {
      mounted = false;
    };
  }, [storeId]);

  if (storeKind === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (storeKind === 'bar' || storeKind === 'restaurant') {
    return <BarDetailScreen route={route as any} />;
  }

  return <StoreDetailScreen route={route as any} />;
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StoreDetailRouterScreen;

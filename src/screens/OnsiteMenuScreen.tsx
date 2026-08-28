/**
 * OnsiteMenuScreen.tsx
 * Page accessible via /onsite/:token (scan QR table).
 * 
 * Flux :
 *   Scan QR → /onsite/{token}
 *      ↓
 *   Validation token (RPC backend)
 *      ↓
 *   Contexte table (storeName, tableNumber)
 *      ↓
 *   Menu + commande (sans compte)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useOnsiteTable } from '../features/onsite/hooks/useOnsiteTable';

type OnsiteMenuRouteProp = RouteProp<RootStackParamList, 'OnsiteMenu'>;

const COLORS = {
  primary: '#1A1A2E',
  accent: '#4CAF50',
  error: '#E53935',
  warning: '#FF9800',
  bg: '#F5F5F5',
  card: '#FFFFFF',
  textPrimary: '#1A1A2E',
  textMuted: '#9E9E9E',
};

export default function OnsiteMenuScreen() {
  const route = useRoute<OnsiteMenuRouteProp>();
  const navigation = useNavigation();
  const { token } = route.params;

  const tableState = useOnsiteTable(token);

  if (tableState.status === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Vérification du QR code…</Text>
      </SafeAreaView>
    );
  }

  if (tableState.status === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="qr-code-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorTitle}>QR invalide</Text>
        <Text style={styles.errorMessage}>{tableState.message}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { context } = tableState;

  return (
    <SafeAreaView style={styles.container}>
      {/* Bandeau contexte table — toujours visible */}
      <View style={styles.tableContextBanner}>
        <Ionicons name="restaurant-outline" size={20} color={COLORS.card} />
        <View style={styles.tableContextText}>
          <Text style={styles.storeName}>{context.storeName}</Text>
          <Text style={styles.tableNumber}>Table {context.tableNumber}</Text>
        </View>
      </View>

      {/* Corps principal — à connecter au menu de la boutique */}
      <View style={styles.body}>
        <Text style={styles.comingSoon}>
          Menu disponible — intégration en cours
        </Text>
        <Text style={styles.comingSoonSub}>
          Store ID : {context.storeId}
        </Text>
        <Text style={styles.comingSoonSub}>
          Table : {context.tableNumber} (ID : {context.tableId})
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textMuted,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.error,
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.card,
    fontSize: 15,
    fontWeight: '600',
  },
  tableContextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  tableContextText: {
    flex: 1,
  },
  storeName: {
    color: COLORS.card,
    fontSize: 15,
    fontWeight: '700',
  },
  tableNumber: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 2,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  comingSoon: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  comingSoonSub: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

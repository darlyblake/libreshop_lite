import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import { useStoreStore } from '../store';
import { Store } from '../types';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  isEmbedded?: boolean;
}

export const SellerSubscriptionsScreen: React.FC<Props> = ({ isEmbedded = false }) => {
  const navigation = useNavigation<any>();
  const { getColor: COLORS, spacing: SPACING, radius: RADIUS } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setStores(data || []);
    } catch (e) {
      console.warn('Failed to load stores for subscriptions', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = (store: Store) => {
    useStoreStore.getState().setStore(store);
    navigation.navigate('SellerChangePlan');
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {!isEmbedded && (
        <View style={[styles.header, { borderBottomColor: COLORS.border, backgroundColor: COLORS.card }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: COLORS.text }]}>Mes Abonnements</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
        <LinearGradient colors={[COLORS.warning + '20', COLORS.bg]} style={styles.infoBanner}>
          <Ionicons name="card" size={24} color={COLORS.warning} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.infoTitle, { color: COLORS.text }]}>Gérez vos renouvellements</Text>
            <Text style={[styles.infoDesc, { color: COLORS.textSoft }]}>
              Renouvelez vos abonnements en payant avec vos points XP ou par moyen de paiement classique (au prorata).
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: 'rgba(251, 191, 36, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' }}>
              <Ionicons name="star" size={12} color="#FBBF24" />
              <Text style={{ color: '#FBBF24', fontSize: 12, fontWeight: '800', marginLeft: 4 }}>
                Taux: 1 XP = 1 FCFA
              </Text>
            </View>
          </View>
        </LinearGradient>

        {stores.length === 0 ? (
          <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>
            Vous n'avez pas encore d'établissement enregistré.
          </Text>
        ) : (
          stores.map((store) => {
            const planName = store.subscription_plan || 'Gratuit';
            const status = store.subscription_status || 'inactive';
            const endDate = store.subscription_end ? new Date(store.subscription_end) : null;
            const isExpired = endDate ? endDate < new Date() : false;
            
            let statusColor = COLORS.success;
            let statusLabel = 'Actif';
            if (status === 'trial') {
              statusColor = COLORS.primary;
              statusLabel = 'En Essai';
            } else if (isExpired || status === 'expired') {
              statusColor = COLORS.danger;
              statusLabel = 'Expiré';
            } else if (status === 'inactive') {
              statusColor = COLORS.textMuted;
              statusLabel = 'Inactif';
            }

            return (
              <View key={store.id} style={[styles.storeCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={styles.storeHeader}>
                  <Text style={[styles.storeName, { color: COLORS.text }]} numberOfLines={1}>
                    {store.name}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

                <View style={styles.planDetails}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: COLORS.textSoft }]}>Plan actuel :</Text>
                    <Text style={[styles.detailValue, { color: COLORS.text }]}>{planName}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: COLORS.textSoft }]}>Expiration :</Text>
                    <Text style={[styles.detailValue, { color: isExpired ? COLORS.danger : COLORS.text }]}>
                      {endDate ? endDate.toLocaleDateString('fr-FR') : 'N/A'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.renewBtn, { backgroundColor: COLORS.primary }]}
                  onPress={() => handleRenew(store)}
                >
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.renewBtnText}>Renouveler / Changer de plan</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  backBtn: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoDesc: {
    fontSize: 13,
    marginTop: 4,
  },
  storeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeName: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  planDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  renewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  renewBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  }
});

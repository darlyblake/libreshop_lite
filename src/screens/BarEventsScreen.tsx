import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { barService, BarEvent } from '../services/barService';

export const BarEventsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fontSize } = useResponsive();
  const isFocused = useIsFocused();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [events, setEvents] = useState<BarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (showLoading = true) => {
    if (!user?.id) return;
    try {
      if (showLoading) setLoading(true);
      const s = await storeService.getByUser(user.id);
      if (s) {
        if (!storeService.isSubscriptionActive(s)) {
          Alert.alert(
            'Abonnement expiré',
            `Votre abonnement pour "${s.name}" a expiré. Veuillez le renouveler pour accéder aux événements.`,
            [
              {
                text: 'Renouveler',
                onPress: () => navigation.replace('SubscriptionExpired'),
              },
            ]
          );
          return;
        }
        setStoreId(s.id);
        const storeEvents = await barService.getEventsByStore(s.id);
        setEvents(storeEvents);
      }
    } catch (e) {
      console.error('Error loading events:', e);
      Alert.alert('Erreur', 'Impossible de charger les événements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [user?.id, isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return COLORS.success;
      case 'draft': return COLORS.warning;
      case 'ended': return COLORS.textMuted;
      default: return COLORS.primary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'published': return 'Publié';
      case 'draft': return 'Brouillon';
      case 'ended': return 'Terminé';
      default: return status;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: fontSize.xl }]}>
          Événements du Bar
        </Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={COLORS.border} />
            <Text style={[styles.emptyStateText, { fontSize: fontSize.md }]}>
              Aucun événement pour le moment
            </Text>
            <TouchableOpacity
              style={styles.createButtonEmpty}
              onPress={() => navigation.navigate('BarEventForm')}
            >
              <Text style={styles.createButtonEmptyText}>Créer mon premier événement</Text>
            </TouchableOpacity>
          </View>
        ) : (
          events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => navigation.navigate('BarEventForm', { eventId: event.id })}
            >
              <View style={styles.eventCardHeader}>
                <Text style={[styles.eventTitle, { fontSize: fontSize.lg }]} numberOfLines={1}>
                  {event.title}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(event.status) }]}>
                    {getStatusLabel(event.status)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.eventDate, { fontSize: fontSize.sm }]}>
                <Ionicons name="time-outline" size={14} /> {formatDate(event.start_time)}
              </Text>

              <View style={styles.eventFeatures}>
                {event.is_photo_wall_active && (
                  <View style={styles.featureBadge}>
                    <Ionicons name="images" size={12} color={COLORS.textInverse} />
                    <Text style={styles.featureText}>Mur Photo</Text>
                  </View>
                )}
                {event.is_contest_active && (
                  <View style={[styles.featureBadge, { backgroundColor: COLORS.warning }]}>
                    <Ionicons name="trophy" size={12} color={COLORS.textInverse} />
                    <Text style={styles.featureText}>Concours</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + SPACING.lg }]}
        onPress={() => navigation.navigate('BarEventForm')}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    marginTop: SPACING.xxl,
  },
  emptyStateText: {
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  createButtonEmpty: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  createButtonEmptyText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  eventTitle: {
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.md,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventDate: {
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  eventFeatures: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  featureText: {
    color: COLORS.textInverse,
    fontSize: 11,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
export default BarEventsScreen;

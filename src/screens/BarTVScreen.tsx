import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Animated
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, SPACING, RADIUS } from '../config/theme';
import { barService, BarPhoto, BarEvent } from '../services/barService';
import { storeService } from '../services/storeService';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

export const BarTVScreen: React.FC = () => {
  const route = useRoute<any>();
  const slug = route.params?.slug;
  const paramStoreId = route.params?.storeId;

  const [store, setStore] = useState<any>(null);
  const [storeId, setStoreId] = useState<string | null>(paramStoreId || null);
  const [loading, setLoading] = useState(true);
  const [currentScreenMode, setCurrentMode] = useState<string>('photo_wall');
  const [screenMessage, setScreenMessage] = useState<string>('');
  
  const [activeEvent, setActiveEvent] = useState<BarEvent | null>(null);
  const [photos, setPhotos] = useState<BarPhoto[]>([]);
  const [contestPhotos, setContestPhotos] = useState<BarPhoto[]>([]);

  // Animation for photos
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (!slug && !storeId) return;
    loadData();
  }, [slug, storeId]);

  useEffect(() => {
    if (!storeId) return;

    const channel = supabase.channel(`public:stores:id=eq.${storeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` }, (payload) => {
        const newDoc = payload.new as any;
        if (newDoc.screen_current_mode !== currentScreenMode) {
          setCurrentMode(newDoc.screen_current_mode);
        }
        if (newDoc.screen_message !== screenMessage) {
          setScreenMessage(newDoc.screen_message);
        }
      })
      .subscribe();

    const contestChannel = supabase.channel(`public:bar_events:store_id=eq.${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_events', filter: `store_id=eq.${storeId}` }, () => {
        if (storeId) loadEvents(storeId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_event_photos' }, () => {
        loadPhotos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_event_votes' }, () => {
        loadPhotos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(contestChannel);
    };
  }, [storeId, currentScreenMode, screenMessage, activeEvent]); // Add dependencies appropriately

  useEffect(() => {
    // Fade in effect when mode changes
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [currentScreenMode, fadeAnim]);

  const loadData = async () => {
    setLoading(true);
    try {
      let storeData = null;
      if (storeId) {
        storeData = await storeService.getById(storeId);
      } else if (slug) {
        storeData = await storeService.getBySlug(slug);
        if (storeData) {
          setStoreId(storeData.id);
        }
      }

      if (storeData) {
        setStore(storeData);
        setCurrentMode(storeData.screen_current_mode || 'photo_wall');
        setScreenMessage(storeData.screen_message || '');
        await loadEvents(storeData.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (sId: string) => {
    const storeEvents = await barService.getEventsByStore(sId);
    const active = storeEvents.find(e => e.status === 'published' && (e.is_photo_wall_active || e.is_contest_active));
    setActiveEvent(active || null);
    if (active) {
      const allPhotos = await barService.getPhotosForEvent(active.id);
      const approvedPhotos = allPhotos.filter(p => p.status === 'approved');
      
      setPhotos(approvedPhotos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      
      const contest = [...approvedPhotos].sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0));
      setContestPhotos(contest);
    }
  };

  const loadPhotos = async () => {
    if (!activeEvent?.id) return;
    const allPhotos = await barService.getPhotosForEvent(activeEvent.id);
    const approvedPhotos = allPhotos.filter(p => p.status === 'approved');
    
    setPhotos(approvedPhotos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    
    const contest = [...approvedPhotos].sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0));
    setContestPhotos(contest);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const renderPhotoWall = () => {
    if (photos.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={100} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Scannez le QR Code pour envoyer la première photo !</Text>
        </View>
      );
    }

    return (
      <View style={styles.grid}>
        {photos.slice(0, 12).map((photo) => (
          <View key={photo.id} style={styles.photoCardWall}>
            <Image source={{ uri: (photo as any).image_url || (photo as any).photo_url }} style={styles.photoImage} resizeMode="cover" />
          </View>
        ))}
      </View>
    );
  };

  const renderContestRanking = () => {
    if (!activeEvent || !activeEvent.is_contest_active) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={100} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Aucun concours en cours</Text>
        </View>
      );
    }

    return (
      <View style={styles.contestContainer}>
        <Text style={styles.contestTitle}>🏆 Classement en direct</Text>
        <Text style={styles.contestSubtitle}>
          Phase actuelle : {activeEvent.contest_phase === 'participation' ? 'Prenez vos photos !' : activeEvent.contest_phase === 'voting' ? 'Votez pour votre favori !' : 'Terminé'}
        </Text>
        <View style={styles.podiumGrid}>
          {contestPhotos.slice(0, 3).map((photo, index) => (
            <View key={photo.id} style={[styles.photoCardContest, index === 0 ? styles.firstPlace : {}]}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
              <Image source={{ uri: photo.photo_url }} style={styles.photoImage} resizeMode="cover" />
              <View style={styles.votesBadge}>
                <Ionicons name="heart" size={24} color={COLORS.danger} />
                <Text style={styles.votesText}>{photo.votes_count || 0}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderCustomMessage = () => {
    return (
      <View style={styles.messageContainer}>
        <Ionicons name="megaphone" size={80} color={COLORS.primary} style={{ marginBottom: SPACING.xl }} />
        <Text style={styles.customMessageText}>{screenMessage || 'Bienvenue !'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        {store?.banner_url && (
          <Image source={{ uri: store.banner_url }} style={StyleSheet.absoluteFillObject} blurRadius={10} />
        )}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.85)' }]} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          {store?.logo_url ? (
            <Image source={{ uri: store.logo_url }} style={styles.logo} />
          ) : (
            <Ionicons name="wine" size={40} color={COLORS.primary} />
          )}
          <Text style={styles.storeName}>{store?.name || 'Live'}</Text>
        </View>

        {/* Dynamic Content */}
        <View style={styles.mainArea}>
          {currentScreenMode === 'photo_wall' && renderPhotoWall()}
          {currentScreenMode === 'contest' && renderContestRanking()}
          {currentScreenMode === 'custom_message' && renderCustomMessage()}
          {currentScreenMode === 'menu' && (
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={100} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Menu affiché sur les téléphones des clients</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: SPACING.md,
  },
  storeName: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  mainArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 24,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  messageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  customMessageText: {
    color: '#FFF',
    fontSize: 64,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  photoCardWall: {
    width: width / 4 - SPACING.xl,
    height: width / 4 - SPACING.xl,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  contestContainer: {
    alignItems: 'center',
    width: '100%',
  },
  contestTitle: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  contestSubtitle: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: SPACING.xxl,
  },
  podiumGrid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: SPACING.xl,
    height: 400,
  },
  photoCardContest: {
    width: 250,
    height: 250,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: COLORS.textMuted,
    position: 'relative',
  },
  firstPlace: {
    width: 350,
    height: 350,
    borderColor: '#FFD700', // Gold
    borderWidth: 6,
    zIndex: 10,
    marginBottom: SPACING.xl,
  },
  rankBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    zIndex: 2,
  },
  rankText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 24,
  },
  votesBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    gap: 8,
    zIndex: 2,
  },
  votesText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 24,
  },
});

export default BarTVScreen;

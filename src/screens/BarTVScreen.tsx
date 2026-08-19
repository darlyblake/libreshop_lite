import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Animated,
  Platform,
  TouchableOpacity
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, SPACING, RADIUS } from '../config/theme';
import { barService, BarPhoto, BarEvent } from '../services/barService';
import { storeService } from '../services/storeService';
import { supabase } from '../lib/supabase';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { PhotoDecoration } from '../components/PhotoDecoration';

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

  // Slideshow state
  const [slideState, setSlideState] = useState<{ isWall: boolean, photoIndex: number }>({ isWall: true, photoIndex: 0 });

  // Animation for photos
  const fadeAnim = useState(new Animated.Value(0))[0];

  const toggleFullscreen = () => {
    if (Platform.OS === 'web') {
      const doc = window.document as any;
      const elem = doc.documentElement;
      
      if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari */
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
          elem.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) { /* Safari */
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) { /* IE11 */
          doc.msExitFullscreen();
        }
      }
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'f' || e.key === 'F') {
          toggleFullscreen();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  useEffect(() => {
    if (!slug && !storeId) return;
    loadData();
  }, [slug, storeId]);

  // Slideshow interval
  useEffect(() => {
    if (currentScreenMode !== 'photo_wall' || photos.length === 0) {
      setSlideState({ isWall: true, photoIndex: 0 });
      return;
    }

    const interval = setInterval(() => {
      setSlideState(prev => {
        if (!prev.isWall) {
          // Switch back to wall, increment index for next time
          let nextIndex = prev.photoIndex + 1;
          if (nextIndex >= photos.length) nextIndex = 0;
          return { isWall: true, photoIndex: nextIndex };
        } else {
          // Switch to single highlighted photo
          return { isWall: false, photoIndex: prev.photoIndex };
        }
      });
    }, 7000); // cycle every 7 seconds

    return () => clearInterval(interval);
  }, [currentScreenMode, photos.length]);

  // Polling fallback every 10 seconds in case Supabase Realtime is not active on this table
  useEffect(() => {
    if (!storeId) return;
    const interval = setInterval(() => {
      // Re-fetch store settings silently to detect mode changes
      storeService.getById(storeId).then(s => {
        if (s) {
          setCurrentMode(s.screen_current_mode || 'photo_wall');
          setScreenMessage(s.screen_message || '');
        }
      }).catch(() => {});
    }, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;

    // Store screen mode changes
    const storeChannel = supabase.channel(`tv:stores:${storeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` }, (payload) => {
        const newDoc = payload.new as any;
        setCurrentMode(newDoc.screen_current_mode || 'photo_wall');
        setScreenMessage(newDoc.screen_message || '');
      })
      .subscribe();

    // Bar events changes (contest start/stop, phase change)
    const eventsChannel = supabase.channel(`tv:bar_events:${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_events', filter: `store_id=eq.${storeId}` }, () => {
        loadEvents(storeId);
      })
      .subscribe();

    // Wall photos changes (INSERT/UPDATE/DELETE on bar_photos)
    const wallPhotosChannel = supabase.channel(`tv:bar_photos:${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_photos', filter: `store_id=eq.${storeId}` }, () => {
        loadWallPhotos(storeId);
      })
      .subscribe();

    // Contest photos and votes changes
    const contestChannel = supabase.channel(`tv:bar_event_photos:${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_event_photos' }, () => {
        loadPhotos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_event_votes' }, () => {
        loadPhotos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(storeChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(wallPhotosChannel);
      supabase.removeChannel(contestChannel);
    };
  }, [storeId, activeEvent]);

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
    // Always load general wall photos for the photo wall mode
    await loadWallPhotos(sId);

    const storeEvents = await barService.getEventsByStore(sId);
    const active = storeEvents.find(e => e.status === 'published' && (e.is_photo_wall_active || e.is_contest_active));
    setActiveEvent(active || null);
    
    if (active) {
      const allContestPhotos = await barService.getPhotosForEvent(active.id);
      const approvedContestPhotos = allContestPhotos.filter(p => p.status === 'approved');
      const contest = [...approvedContestPhotos].sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0));
      setContestPhotos(contest);
    }
  };

  const loadWallPhotos = async (sId: string) => {
    try {
      const wallPhotos = await barService.getPhotosByStore(sId, 'approved');
      setPhotos(wallPhotos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (e) {
      console.error('Error loading wall photos:', e);
    }
  };

  const loadPhotos = async () => {
    if (storeId) {
      await loadWallPhotos(storeId);
    }
    
    if (activeEvent?.id) {
      const allContestPhotos = await barService.getPhotosForEvent(activeEvent.id);
      const approvedContestPhotos = allContestPhotos.filter(p => p.status === 'approved');
      const contest = [...approvedContestPhotos].sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0));
      setContestPhotos(contest);
    }
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
          <Text style={styles.emptyText}>Soyez le premier à envoyer une photo !</Text>
        </View>
      );
    }

    if (!slideState.isWall && photos[slideState.photoIndex]) {
      const highlightedPhoto = photos[slideState.photoIndex];
      return (
        <View style={styles.highlightedPhotoContainer}>
          <Image 
            source={{ uri: (highlightedPhoto as any).image_url || (highlightedPhoto as any).photo_url }} 
            style={styles.highlightedPhoto} 
            resizeMode="contain" 
          />
          <PhotoDecoration type={(highlightedPhoto as any).decoration_type || 'none'} />
        </View>
      );
    }

    // Optimal sizing so all photos fit on screen without scrolling
    const N = Math.min(photos.length, 12);
    let c = 1, r = 1;
    if (N === 1) { c = 1; r = 1; }
    else if (N === 2) { c = 2; r = 1; }
    else if (N <= 4) { c = 2; r = 2; }
    else if (N <= 6) { c = 3; r = 2; }
    else if (N <= 9) { c = 3; r = 3; }
    else { c = 4; r = 3; }

    const availableW = width - SPACING.xl * 2;
    const availableH = height * 0.65; // Leave room for header/footer
    
    // We want the squares to fit in both dimensions
    const maxWidth = availableW / c;
    const maxHeight = availableH / r;
    const dynamicSize = Math.floor(Math.min(maxWidth, maxHeight)) - SPACING.md * 2;

    return (
      <View style={styles.grid}>
        {photos.slice(0, 12).map((photo, index) => {
          const isHighlighted = slideState.isWall && index === slideState.photoIndex;
          return (
            <View 
              key={photo.id} 
              style={[
                styles.photoCardWall, 
                { 
                  width: dynamicSize, 
                  height: dynamicSize,
                  borderColor: isHighlighted ? COLORS.primary : 'rgba(255,255,255,0.2)',
                  borderWidth: isHighlighted ? 6 : 3,
                  transform: [{ scale: isHighlighted ? 1.05 : 1 }]
                }
              ]}
            >
              <Image 
                source={{ uri: (photo as any).image_url || (photo as any).photo_url }} 
                style={styles.photoImage} 
                resizeMode="cover" 
              />
              <PhotoDecoration type={(photo as any).decoration_type || 'none'} />
            </View>
          );
        })}
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
    <View style={[styles.container, store?.tv_primary_color ? { backgroundColor: store.tv_primary_color } : {}]}>
      <StatusBar hidden={true} />
      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        {store?.banner_url && (
          <Image source={{ uri: store.banner_url }} style={StyleSheet.absoluteFillObject} blurRadius={10} />
        )}
        <View style={[
          StyleSheet.absoluteFillObject, 
          { backgroundColor: store?.tv_primary_color ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.85)' }
        ]} />
      </View>
      
      {/* Dynamic Animated Particles based on Theme */}
      <AnimatedBackground theme={store?.tv_wall_theme || 'default'} />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.logo} />
            ) : (
              <Ionicons name="wine" size={40} color={COLORS.primary} />
            )}
            <Text style={styles.storeName}>{store?.name || 'Live'}</Text>
          </View>
          
          {Platform.OS === 'web' && (
            <TouchableOpacity onPress={toggleFullscreen} style={styles.fullscreenBtn}>
              <Ionicons name="expand" size={24} color="#FFF" />
              <Text style={styles.fullscreenText}>Plein écran (F)</Text>
            </TouchableOpacity>
          )}
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

        {/* Permanent footer instruction */}
        <View style={styles.footerContainer}>
          <Ionicons name="qr-code-outline" size={32} color="#FFF" style={{ marginRight: SPACING.md }} />
          <Text style={styles.footerText}>
            Scannez le QR code sur votre table pour envoyer une photo au mur !
          </Text>
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
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: SPACING.sm,
  },
  fullscreenText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
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
  highlightedPhotoContainer: {
    width: width * 0.8,
    height: height * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  highlightedPhoto: {
    width: '100%',
    height: '100%',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: RADIUS.full,
    marginTop: SPACING.xl,
    alignSelf: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  footerText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
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

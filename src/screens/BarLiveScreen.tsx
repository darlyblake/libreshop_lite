import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  StatusBar
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { barService, BarPhoto } from '../services/barService';
import { storeService } from '../services/storeService';
import { cloudinaryService } from '../services/cloudinaryService';
import { productService } from '../services/productService';
import { Product } from '../types/product';
import { supabase } from '../lib/supabase';
import { BarMenuSection } from '../components/BarMenuSection';

const { width } = Dimensions.get('window');

type LiveTab = 'menu' | 'wall' | 'contest';

export const BarLiveScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { fontSize } = useResponsive();
  const { user } = useAuthStore();

  const paramStoreId = route.params?.storeId;
  const slug = route.params?.slug;
  const tableNumber = route.params?.table;

  const [resolvedStoreId, setResolvedStoreId] = useState<string | null>(paramStoreId || null);
  const storeId = resolvedStoreId; // alias for the rest of the code

  const [activeTab, setActiveTab] = useState<LiveTab>('menu');
  const [store, setStore] = useState<any>(null);
  const [photos, setPhotos] = useState<BarPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Menu + Cart states
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  
  // Real-time states
  const [currentScreenMode, setCurrentScreenMode] = useState<string>('menu');
  const [screenMessage, setScreenMessage] = useState<string>('');

  // Contest states
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [contestPhotos, setContestPhotos] = useState<any[]>([]);
  const [userVoted, setUserVoted] = useState(false);
  const [userParticipated, setUserParticipated] = useState(false);
  const [timeRemainingLabel, setTimeRemainingLabel] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  // Résolution du storeId depuis le slug si nécessaire (accès web direct)
  useEffect(() => {
    if (!paramStoreId && slug) {
      storeService.getBySlug(slug).then(s => {
        if (s) setResolvedStoreId(s.id);
      });
    }
  }, [paramStoreId, slug]);

  useEffect(() => {
    if (storeId) {
      loadData();
      setupRealtimeSubscription();
    }
  }, [storeId, activeTab, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const storeData = await storeService.getById(storeId);
      setStore(storeData);
      setCurrentScreenMode(storeData.screen_current_mode || 'menu');
      setScreenMessage(storeData.screen_message || '');

      // Load active event
      const events = await barService.getEventsByStore(storeId);
      const currentEvent = events.find(e => e.is_contest_active || e.is_photo_wall_active) || null;
      setActiveEvent(currentEvent);

      if (activeTab === 'menu') {
        const prods = await productService.getByStore(storeId);
        setProducts(prods || []);
      } else if (activeTab === 'wall') {
        const pts = await barService.getPhotosByStore(storeId, 'approved');
        setPhotos(pts);
      } else if (activeTab === 'contest' && currentEvent) {
        const pts = await barService.getContestPhotos(currentEvent.id);
        setContestPhotos(pts);
        
        if (user) {
          const hasVoted = await barService.checkIfUserVoted(currentEvent.id, user.id);
          const hasParticipated = await barService.checkIfUserParticipated(currentEvent.id, user.id);
          setUserVoted(hasVoted);
          setUserParticipated(hasParticipated);
        }

        // Auto-switch to voting phase if participant limit reached
        if (currentEvent.contest_phase === 'participation' && currentEvent.contest_participant_limit) {
          if (pts.length >= currentEvent.contest_participant_limit) {
            // Update to voting
            await barService.updateEvent(currentEvent.id, { contest_phase: 'voting' });
            setActiveEvent({ ...currentEvent, contest_phase: 'voting' });
          }
        }
      }
    } catch (error) {
      console.error('Error loading live data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    setCart(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
  };

  const cartItemCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find(prod => prod.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  // Timer: auto-advance phases based on configured durations
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!activeEvent || !activeEvent.contest_started_at) return;

    const tick = async () => {
      const now = Date.now();
      const evt = activeEvent;

      if (evt.contest_phase === 'participation') {
        const participationMs = (evt.contest_participation_duration || 30) * 60 * 1000;
        const startedAt = new Date(evt.contest_started_at).getTime();
        const remaining = participationMs - (now - startedAt);

        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setTimeRemainingLabel(null);
          try {
            await barService.startContestVotingPhase(evt.id);
            setActiveEvent((prev: any) => prev ? { ...prev, contest_phase: 'voting', contest_voting_started_at: new Date().toISOString() } : prev);
          } catch (e) { console.error('Auto-advance to voting failed', e); }
        } else {
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          setTimeRemainingLabel(`Participation · encore ${mins}min ${secs}s`);
        }
      } else if (evt.contest_phase === 'voting' && evt.contest_voting_started_at) {
        const votingMs = (evt.contest_voting_duration || 15) * 60 * 1000;
        const votingStarted = new Date(evt.contest_voting_started_at).getTime();
        const remaining = votingMs - (now - votingStarted);

        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setTimeRemainingLabel('Vote terminé');
          try {
            await barService.endContest(evt.id);
            setActiveEvent((prev: any) => prev ? { ...prev, contest_phase: 'ended' } : prev);
          } catch (e) { console.error('Auto-end contest failed', e); }
        } else {
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          setTimeRemainingLabel(`Vote · encore ${mins}min ${secs}s`);
        }
      }
    };

    tick();
    timerRef.current = setInterval(tick, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeEvent?.id, activeEvent?.contest_phase, activeEvent?.contest_started_at, activeEvent?.contest_voting_started_at]);

  const setupRealtimeSubscription = () => {
    const channel = supabase.channel(`public:stores:id=eq.${storeId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` },
        (payload) => {
          const newDoc = payload.new as any;
          if (newDoc.screen_current_mode !== currentScreenMode) {
            setCurrentScreenMode(newDoc.screen_current_mode);
          }
          if (newDoc.screen_message !== screenMessage) {
            setScreenMessage(newDoc.screen_message || '');
          }
        }
      )
      .subscribe();

    const contestChannel = supabase.channel(`public:bar_events:store_id=eq.${storeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bar_events' }, (payload) => {
          const newEvt = payload.new as any;
          if (activeEvent && newEvt.id === activeEvent.id && newEvt.contest_phase !== activeEvent.contest_phase) {
             setActiveEvent(newEvt);
          }
      }).subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(contestChannel);
    };
  };

  const handleUploadPhoto = async () => {
    if (!user) {
      navigation.navigate('ClientAuth', { pendingAction: 'upload' });
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploading(true);
        const asset = result.assets[0];
        
        // Upload to cloudinary
        const photoUrl = await cloudinaryService.uploadImage(asset.uri);
        if (!photoUrl) throw new Error("Upload failed");

        if (activeTab === 'contest' && activeEvent) {
          // Contest specific upload
          if (userParticipated) {
            Alert.alert('Oups', 'Vous avez déjà participé à ce concours !');
            return;
          }
          await barService.uploadContestPhoto(activeEvent.id, user.id, photoUrl);
          setUserParticipated(true);
          Alert.alert('Succès', 'Votre participation est enregistrée !');
          loadData(); // refresh to check limit
        } else {
          // Wall specific upload
          await barService.uploadClientPhoto({
            store_id: storeId,
            user_id: user.id,
            photo_url: photoUrl
          });
          Alert.alert('Succès', 'Votre photo a été envoyée ! Elle sera affichée après validation.');
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer la photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (photo: any, isContest: boolean = false) => {
    if (!user) {
      navigation.navigate('ClientAuth', { pendingAction: 'like' });
      return;
    }
    
    try {
      if (isContest && activeEvent) {
        if (userVoted) {
          Alert.alert('Info', 'Vous avez déjà voté pour ce concours !');
          return;
        }
        await barService.voteForContestPhoto(activeEvent.id, photo.id, user.id);
        setUserVoted(true);
        // Optimistic update
        setContestPhotos(contestPhotos.map(p => 
          p.id === photo.id ? { ...p, votes_count: (p.votes_count || 0) + 1 } : p
        ));
      } else {
        const isLiked = await barService.checkUserLike(photo.id, user.id);
        await barService.togglePhotoLike(photo.id, user.id, isLiked);
        
        // Update local state optimistically
        setPhotos(photos.map(p => {
          if (p.id === photo.id) {
            return {
              ...p,
              likes_count: isLiked ? (p.likes_count || 1) - 1 : (p.likes_count || 0) + 1
            };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const renderLiveStatus = () => {
    let text = "Mode normal";
    if (currentScreenMode === 'photo_wall') text = "Mur Photo affiché sur les écrans";
    if (currentScreenMode === 'contest') {
      if (timeRemainingLabel) {
        text = `🏆 Concours · ${timeRemainingLabel}`;
      } else if (activeEvent?.contest_phase === 'participation') {
        const remaining = (activeEvent.contest_participant_limit || 0) - contestPhotos.length;
        text = `🏆 Concours · Participation (${remaining > 0 ? remaining + ' places' : 'complet'})`;
      } else if (activeEvent?.contest_phase === 'voting') {
        text = "🗳 Concours · Phase de vote ouverte !";
      } else if (activeEvent?.contest_phase === 'ended') {
        text = "🏆 Concours terminé – résultats affichés !";
      } else {
        text = "Concours en direct sur les écrans !";
      }
    }
    if (currentScreenMode === 'custom_message' && screenMessage) text = screenMessage;

    return (
      <View style={styles.liveBanner}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveIndicatorText}>EN DIRECT</Text>
        </View>
        <Text style={styles.liveBannerText} numberOfLines={1}>{text}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{store?.name || 'Live'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {renderLiveStatus()}

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'menu' && styles.activeTab]}
          onPress={() => setActiveTab('menu')}
        >
          <Ionicons name="restaurant" size={20} color={activeTab === 'menu' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>Menu</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'wall' && styles.activeTab]}
          onPress={() => setActiveTab('wall')}
        >
          <Ionicons name="images" size={20} color={activeTab === 'wall' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'wall' && styles.activeTabText]}>Mur Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'contest' && styles.activeTab]}
          onPress={() => setActiveTab('contest')}
        >
          <Ionicons name="trophy" size={20} color={activeTab === 'contest' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'contest' && styles.activeTabText]}>Concours</Text>
        </TouchableOpacity>
      </View>

      {/* ── MENU TAB ── */}
      {activeTab === 'menu' && (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: cartItemCount > 0 ? 130 : 80 }]}>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <BarMenuSection products={products} cart={cart} onAddToCart={handleAddToCart} />
          )}
        </ScrollView>
      )}

      {/* ── WALL / CONTEST TABS ── */}
      {(activeTab === 'wall' || activeTab === 'contest') && (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.grid}>
              {(activeTab === 'contest' ? contestPhotos : photos).map((photo) => (
                <View key={photo.id} style={styles.photoCard}>
                  <Image source={{ uri: photo.photo_url }} style={styles.photoImage} />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.photoGradient}
                  />
                  {activeTab === 'contest' && activeEvent?.contest_phase === 'voting' && (
                    <View style={styles.photoActions}>
                      <Text style={styles.likesText}>{photo.votes_count || 0} votes</Text>
                      <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(photo, true)}>
                        <Ionicons name={userVoted ? "checkmark-circle" : "heart"} size={24} color={userVoted ? COLORS.success : COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {activeTab === 'wall' && (
                    <View style={styles.photoActions}>
                      <Text style={styles.likesText}>{photo.likes_count || 0} likes</Text>
                      <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(photo, false)}>
                        <Ionicons name="heart" size={24} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {photo.featured_at && (
                    <View style={styles.featuredBadge}>
                      <Ionicons name="star" size={12} color="#FFF" />
                      <Text style={styles.featuredText}>Gagnant</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── BOTTOM: PANIER (menu tab) ou PARTICIPER (photo tabs) ── */}
      {activeTab === 'menu' ? (
        cartItemCount > 0 ? (
          <View style={[styles.cartBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
            <View style={styles.cartInfo}>
              <Text style={styles.cartCount}>🛒 {cartItemCount} article(s)</Text>
              <Text style={styles.cartTotal}>{cartTotal.toLocaleString('fr-FR')} FCFA</Text>
            </View>
            <TouchableOpacity
              style={styles.cartBtn}
              onPress={() => Alert.alert('Commande envoyée !', 'Le bar a bien reçu votre commande.')}
            >
              <Text style={styles.cartBtnText}>Commander →</Text>
            </TouchableOpacity>
          </View>
        ) : null
      ) : activeTab === 'wall' || (activeTab === 'contest' && activeEvent?.contest_phase === 'participation') ? (
        <View style={[styles.bottomActions, { paddingBottom: insets.bottom || SPACING.md }]}>
          <TouchableOpacity 
            style={styles.cameraBtn}
            onPress={handleUploadPhoto}
            disabled={uploading || (activeTab === 'contest' && userParticipated)}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="camera" size={24} color="#FFF" />
                <Text style={styles.cameraBtnText}>
                  {activeTab === 'contest' && userParticipated ? "Vous avez participé !" : "Participer avec une photo"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Deep black for immersion
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: '#121212',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  liveBanner: {
    backgroundColor: COLORS.danger + '20',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.danger + '40',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  liveIndicatorText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  liveBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#121212',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: COLORS.primary,
  },
  scrollContent: {
    padding: SPACING.xs,
    paddingBottom: 120, // space for bottom actions
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  photoCard: {
    width: '50%',
    aspectRatio: 1,
    padding: 2,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.md,
  },
  photoGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.md,
    top: '50%',
  },
  photoActions: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  likesText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  likeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.warning,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  featuredText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderTopWidth: 1,
    borderTopColor: '#222',
    gap: SPACING.md,
  },
  cameraBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  cameraBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Cart bar
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    backgroundColor: '#1a1a24',
    borderTopWidth: 1,
    borderTopColor: '#3b3b4f',
    gap: SPACING.md,
  },
  cartInfo: {
    flex: 1,
  },
  cartCount: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '500',
  },
  cartTotal: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  cartBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
  },
  cartBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default BarLiveScreen;

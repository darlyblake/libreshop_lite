import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Share,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { storeService } from '../services/storeService';
import { barService, BarEvent } from '../services/barService';
import { orderReviewService } from '../services/orderReviewService';
import { useAuthStore } from '../store';
import { openURL } from '../utils/platformUtils';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = 260;
const FALLBACK_BANNER = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1934&auto=format&fit=crop';

interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  sort_order: number;
}

export const BarDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { fontSize } = useResponsive();
  const { user } = useAuthStore();

  const storeId = route.params?.storeId;
  const tableParam = route.params?.table;

  const [store, setStore] = useState<any>(null);
  const [events, setEvents] = useState<BarEvent[]>([]);
  const [promos, setPromos] = useState<PromoBanner[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<{ average: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // QR Scanner
  const [scannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    if (storeId) {
      loadBarData();
    }
  }, [storeId, user?.id]);

  // 🔑 Si l'URL contient ?table= (lien QR code), on redirige directement vers BarLive
  useEffect(() => {
    if (storeId && tableParam !== undefined && tableParam !== null) {
      navigation.replace('BarLive', { storeId, table: tableParam });
    }
  }, [storeId, tableParam]);

  const loadBarData = async () => {
    try {
      setLoading(true);
      const [storeData, eventsData, promosData, reviewsData] = await Promise.all([
        storeService.getById(storeId),
        barService.getEventsByStore(storeId),
        barService.getPromosByStore(storeId),
        orderReviewService.getByStore(storeId).catch(() => []),
      ]);
      setStore(storeData);
      setEvents(eventsData.filter(e => e.status === 'published'));
      setPromos(promosData);
      setReviews(reviewsData.slice(0, 5)); // show latest 5

      if (reviewsData.length > 0) {
        const avg = reviewsData.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewsData.length;
        setReviewStats({ average: Math.round(avg * 10) / 10, count: reviewsData.length });
      }

      if (user?.id) {
        const following = await barService.checkIsFollowing(storeId, user.id);
        setIsFollowing(following);
      }
    } catch (error) {
      console.error('Error loading bar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!user) {
      navigation.navigate('ClientAuth', { pendingAction: 'follow' });
      return;
    }
    try {
      setFollowLoading(true);
      if (isFollowing) {
        await barService.unfollowStore(storeId, user.id);
        setIsFollowing(false);
      } else {
        await barService.followStore(storeId, user.id);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    if (!store) return;
    try {
      const url = `https://libreshop.app/store/${store.id}`;
      await Share.share({
        message: `Découvre le bar ${store.name} sur LibreShop ! ${url}`,
        url,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleItinerary = () => {
    if (!store?.address) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(store.address)}`,
      android: `geo:0,0?q=${encodeURIComponent(store.address)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`,
    });
    openURL(url as string);
  };

  const handleCall = () => {
    if (!store?.phone) return;
    openURL(`tel:${store.phone}`);
  };

  // ── QR Scanner logic ──────────────────────────────────
  const handlePressSurPlace = () => {
    setScannerVisible(true);
  };

  /**
   * Parse the scanned QR URL and extract the table number.
   * Expected format: https://.../{slug}?table={number}  or  libreshop://store/{slug}?table={number}
   */
  const handleQRScanned = (data: string) => {
    setScannerVisible(false);

    try {
      // Try to extract ?table= param from the URL
      let tableNumber: string | null = null;
      const match = data.match(/[?&]table=([^&]+)/);
      if (match) tableNumber = decodeURIComponent(match[1]);

      navigation.navigate('BarLive', { storeId: store.id, table: tableNumber });
    } catch {
      Alert.alert('QR invalide', 'Ce QR code ne correspond pas à une table de ce bar.');
    }
  };

  const handleCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentSlide(slide);
  };

  // ───── LOADING ─────
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: '#0f0f13' }]}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: '#0f0f13' }]}>
        <Text style={{ color: '#FFF' }}>Bar introuvable.</Text>
      </View>
    );
  }

  // Build carousel slides: promos if any, else fallback banner
  const slides: PromoBanner[] =
    promos.length > 0
      ? promos
      : [{ id: 'fallback', title: store.name, subtitle: store.description || '', image_url: store.banner_url || FALLBACK_BANNER, sort_order: 0 }];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>

        {/* ═══════════════════════════════════════
            HERO BACKGROUND (IMAGE OR GRADIENT)
        ═══════════════════════════════════════ */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: store.banner_url || FALLBACK_BANNER }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(10,12,18,0.1)', 'rgba(10,12,18,0.95)']}
            style={StyleSheet.absoluteFillObject}
          />
          
          {/* Back + Share buttons */}
          <View style={[styles.headerActions, { top: insets.top + SPACING.sm }]}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
              <Ionicons name="share-social" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Hero Content */}
          <View style={styles.heroContent}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Ouvert maintenant</Text>
            </View>
            <Text style={[styles.storeName, { fontSize: fontSize.xxl }]}>{store.name}</Text>
            
            <Text style={styles.heroMeta}>★ 4.8 (128 avis) • Lounge • Musique live</Text>
            <Text style={styles.heroMeta}>📍 1,2 km • {store.address}</Text>
            
            {/* ─── ACTION BUTTONS (PILLS) ─── */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.btnGhost} onPress={handleItinerary}>
                <Ionicons name="location-outline" size={16} color="#FFF" />
                <Text style={styles.btnGhostText}>Itinéraire</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btnGhost} onPress={handleCall}>
                <Ionicons name="call-outline" size={16} color="#FFF" />
                <Text style={styles.btnGhostText}>Appeler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.btnPrimary, isFollowing && { backgroundColor: '#10b981' }]} 
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name={isFollowing ? 'checkmark' : 'add'} size={16} color="#FFF" />
                    <Text style={styles.btnPrimaryText}>{isFollowing ? 'Suivi' : 'Suivre'}</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btnGhost} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={16} color="#FFF" />
                <Text style={styles.btnGhostText}>Partager</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.contentContainer}>
          
          {/* ─── CONCOURS BANNER (If active) ─── */}
          {events.some(e => e.is_contest_active) && (
            <View style={styles.contestBanner}>
              <Text style={styles.contestBannerTitle}>🔥 Concours Photo en cours</Text>
              <Text style={styles.contestBannerDesc}>La plus belle photo gagne 1 cocktail offert</Text>
              <View style={styles.contestActions}>
                <TouchableOpacity style={styles.btnPrimaryLg} onPress={handlePressSurPlace}>
                  <Text style={styles.btnPrimaryText}>Voir le classement</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGhostLg} onPress={handlePressSurPlace}>
                  <Text style={styles.btnGhostText}>Ajouter ma photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ─── ÉVÉNEMENTS ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { fontSize: fontSize.lg }]}>Ce soir / Cette semaine</Text>
              <TouchableOpacity onPress={() => {}}>
                <Text style={styles.sectionLink}>Voir tout</Text>
              </TouchableOpacity>
            </View>

            {events.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="musical-notes-outline" size={36} color="#444" />
                <Text style={styles.emptyText}>Aucun événement prévu pour le moment</Text>
                <Text style={styles.emptySubText}>Suivez ce bar pour être notifié !</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.md, paddingRight: SPACING.md }}>
                {events.map(event => {
                  const dateObj = new Date(event.start_time);
                  const day = dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                  const time = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <View key={event.id} style={styles.eventCard}>
                      <Image
                        source={{ uri: event.cover_image || FALLBACK_BANNER }}
                        style={styles.eventImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.85)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.eventDateBadge}>
                        <Text style={styles.eventDateText}>{day}</Text>
                        <Text style={styles.eventTimeText}>{time}</Text>
                      </View>
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                        {event.description && (
                          <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                        )}
                        <TouchableOpacity style={styles.eventButton}>
                          <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                          <Text style={styles.eventButtonText}>Je viens</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* ─── INFOS PRATIQUES ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={18} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { fontSize: fontSize.lg }]}>Infos pratiques</Text>
            </View>
            <View style={styles.infoCard}>
              {store.address && (
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={18} color="#a1a1aa" />
                  <Text style={styles.infoText}>{store.address}</Text>
                </View>
              )}
              {store.phone && (
                <View style={styles.infoRow}>
                  <Ionicons name="call" size={18} color="#a1a1aa" />
                  <Text style={styles.infoText}>{store.phone}</Text>
                </View>
              )}
              {store.description && (
                <View style={styles.infoRow}>
                  <Ionicons name="reader" size={18} color="#a1a1aa" />
                  <Text style={styles.infoText}>{store.description}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ─── AVIS CLIENTS ─── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="star" size={18} color="#f59e0b" />
                <Text style={[styles.sectionTitle, { fontSize: fontSize.lg }]}>Avis clients</Text>
                {reviewStats && (
                  <Text style={styles.reviewAvgChip}>
                    {reviewStats.average} / 5 ({reviewStats.count})
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Review', { storeId, storeName: store.name, orderId: null })}>
                <Text style={styles.sectionLink}>Laisser un avis</Text>
              </TouchableOpacity>
            </View>

            {reviews.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="chatbubble-outline" size={36} color="#444" />
                <Text style={styles.emptyText}>Aucun avis pour le moment</Text>
                <Text style={styles.emptySubText}>Soyez le premier à laisser un avis !</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {reviews.map((review: any) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewAvatar}>
                        <Ionicons name="person" size={16} color="#8b5cf6" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewAuthor}>{review.author_name || 'Anonyme'}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                      <View style={styles.reviewStars}>
                        {[1,2,3,4,5].map(s => (
                          <Ionicons
                            key={s}
                            name={s <= review.rating ? 'star' : 'star-outline'}
                            size={14}
                            color={s <= review.rating ? '#f59e0b' : '#444'}
                          />
                        ))}
                      </View>
                    </View>
                    {review.comment ? (
                      <Text style={styles.reviewComment}>{review.comment}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ─── INVITATION QR CODE ─── */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.qrInviteCard}
              onPress={handlePressSurPlace}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#4c1d95', '#7c3aed', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.qrInviteIcon}>
                <Ionicons name="qr-code" size={40} color="#FFF" />
              </View>
              <View style={styles.qrInviteText}>
                <Text style={styles.qrInviteTitle}>Vous êtes sur place ? 🍻</Text>
                <Text style={styles.qrInviteSubtitle}>
                  Scannez le QR code de votre table ou du comptoir pour accéder au menu et commander vos boissons directement.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />

        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════
          BOUTON FLOTTANT QR
      ═══════════════════════════════════════ */}
      <View style={[styles.floatingAction, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity
          style={styles.qrButton}
          onPress={handlePressSurPlace}
        >
          <Ionicons name="qr-code" size={20} color="#FFF" />
          <Text style={styles.qrButtonText}>Je suis sur place</Text>
        </TouchableOpacity>
      </View>

      {/* ── MODAL SCANNER QR ── */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onScan={handleQRScanned}
        onClose={() => setScannerVisible(false)}
        hintText="Scannez le QR de votre table"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f13',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Carousel ──
  carouselContainer: {
    width,
    height: BANNER_HEIGHT,
  },
  slide: {
    width,
    height: BANNER_HEIGHT,
  },
  slideImage: {
    width,
    height: BANNER_HEIGHT,
  },
  slideGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  slideTextContainer: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
  },
  slideTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    textShadow: '0px 1px 4px rgba(0,0,0,0.8)',
  },
  slideSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  headerActions: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#8b5cf6',
    width: 22,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  // ── Hero ──
  heroContainer: {
    height: 280,
    justifyContent: 'flex-end',
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  storeName: {
    color: '#FFF',
    fontWeight: '800',
    marginBottom: 4,
  },
  heroMeta: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },

  // ── Actions Row ──
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: '#2a2d3a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  btnGhostText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Contest Banner ──
  contestBanner: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: '#8b5cf6',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  contestBannerTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  contestBannerDesc: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 12,
  },
  contestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimaryLg: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostLg: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: '#2a2d3a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Content ──
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFF',
    fontWeight: '700',
  },
  sectionLink: {
    color: '#8b5cf6',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Reviews ──
  reviewAvgChip: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  reviewCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2e2e3a',
    gap: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAuthor: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  reviewDate: {
    color: '#52525b',
    fontSize: 12,
    marginTop: 2,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
  },

  // ── Events ──
  emptyCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2e2e3a',
    gap: 8,
  },
  emptyText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptySubText: {
    color: '#52525b',
    fontSize: 12,
    textAlign: 'center',
  },
  eventCard: {
    width: 220,
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a24',
  },
  eventImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  eventDateBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  eventDateText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  eventTimeText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 1,
  },
  eventInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  eventTitle: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  eventDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  eventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    backgroundColor: '#8b5cf6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  eventButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Scanner Modal ──
  scannerModalOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  scannerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scannerTarget: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerBox: {
    width: 260,
    height: 260,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    backgroundColor: 'transparent',
    borderRadius: 24,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  webScannerFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0f0f13',
  },
  webScannerText: {
    color: '#FFF',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  webScannerInput: {
    backgroundColor: '#1a1a24',
    color: '#FFF',
    width: '100%',
    maxWidth: 300,
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#2e2e3a',
    marginBottom: 20,
  },
  webScannerBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 50,
  },
  webScannerBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // ── Info card ──
  infoCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2e2e3a',
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: {
    color: '#d4d4d8',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },

  // ── QR invite card ──
  qrInviteCard: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  qrInviteIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrInviteText: {
    flex: 1,
  },
  qrInviteTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 5,
  },
  qrInviteSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 17,
  },

  // ── Floating QR button ──
  floatingAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(15,15,19,0.92)',
    borderTopWidth: 1,
    borderTopColor: '#2e2e3a',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#8b5cf6',
    borderRadius: 50,
    paddingVertical: 15,
  },
  qrButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
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
import { BarEventPhoto } from '../services/barContestService';
import { barContestService } from '../services/barContestService';

type ContestTab = 'ranking' | 'moderate';

export const BarContestScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fontSize } = useResponsive();
  const isFocused = useIsFocused();

  const [activeTab, setActiveTab] = useState<ContestTab>('ranking');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<BarEvent | null>(null);
  const [allPhotos, setAllPhotos] = useState<BarEventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async (showLoading = true) => {
    if (!user?.id) return;
    try {
      if (showLoading) setLoading(true);
      const s = await storeService.getByUser(user.id);
      if (s) {
        setStoreId(s.id);
        const events = await barService.getEventsByStore(s.id);
        const current = events.find(e => e.is_contest_active && e.contest_phase !== 'ended') || null;
        setActiveEvent(current);

        if (current) {
          const photos = await barContestService.getPendingContestPhotos(current.id);
          setAllPhotos(photos);
        } else {
          setAllPhotos([]);
        }
      }
    } catch (e) {
      console.error('Error loading contest:', e);
      Alert.alert('Erreur', 'Impossible de charger le concours.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isFocused) loadData();
  }, [user?.id, isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleStartContest = async () => {
    if (!activeEvent) return;
    Alert.alert(
      'Lancer le concours',
      `Le concours "${activeEvent.title}" va démarrer. Les clients pourront soumettre leurs photos pendant ${activeEvent.contest_participation_duration || 30} min.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: '🚀 Lancer', onPress: async () => {
            try {
              setActionLoading('start');
              await barContestService.startContest(activeEvent.id);
              await loadData(false);
              Alert.alert('Succès', 'Le concours est maintenant ouvert aux participations !');
            } catch {
              Alert.alert('Erreur', 'Impossible de lancer le concours.');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  const handleForceVoting = async () => {
    if (!activeEvent) return;
    const approved = allPhotos.filter(p => p.status === 'approved').length;
    Alert.alert(
      'Passer aux votes',
      `${approved} photo(s) validée(s) seront soumises au vote. Les clients ne pourront plus participer.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: '🗳 Lancer les votes', onPress: async () => {
            try {
              setActionLoading('voting');
              await barContestService.startVoting(activeEvent.id);
              await loadData(false);
              Alert.alert('Succès', 'La phase de vote est maintenant ouverte !');
            } catch {
              Alert.alert('Erreur', 'Impossible de passer aux votes.');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  const handleEndContest = async () => {
    if (!activeEvent) return;
    const winner = [...allPhotos]
      .filter(p => p.status === 'approved')
      .sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0))[0];

    Alert.alert(
      'Clôturer le concours',
      winner
        ? `La photo avec ${winner.votes_count} vote(s) sera déclarée gagnante.`
        : 'Êtes-vous sûr de clôturer ce concours ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: '🏆 Clôturer', style: 'destructive', onPress: async () => {
            try {
              setActionLoading('end');
              await barContestService.endContest(activeEvent.id);
              if (winner) await barService.setPhotoFeatured(winner.id, true);
              await loadData(false);
              Alert.alert('Concours terminé !', winner ? 'Le gagnant a été déclaré et mis en avant sur les écrans.' : 'Le concours est terminé.');
            } catch {
              Alert.alert('Erreur', 'Impossible de clôturer.');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  const handleModerate = async (photo: BarEventPhoto, newStatus: 'approved' | 'rejected') => {
    try {
      setActionLoading(photo.id);
      await barContestService.moderateContestPhoto(photo.id, newStatus);
      setAllPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: newStatus } : p));
    } catch {
      Alert.alert('Erreur', 'Impossible de modérer cette photo.');
    } finally {
      setActionLoading(null);
    }
  };

  const getPhaseLabel = () => {
    if (!activeEvent) return null;
    if (!activeEvent.contest_started_at) return { label: 'Prêt à démarrer', color: COLORS.textMuted, icon: 'hourglass-outline' as const };
    if (activeEvent.contest_phase === 'participation') return { label: 'Participation en cours', color: COLORS.accent, icon: 'camera' as const };
    if (activeEvent.contest_phase === 'voting') return { label: 'Vote en cours', color: COLORS.warning, icon: 'heart' as const };
    if (activeEvent.contest_phase === 'ended') return { label: 'Terminé', color: COLORS.textMuted, icon: 'checkmark-circle' as const };
    return null;
  };

  const approvedPhotos = allPhotos.filter(p => p.status === 'approved').sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0));
  const pendingPhotos = allPhotos.filter(p => p.status === 'pending');
  const phaseInfo = getPhaseLabel();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: fontSize.xl }]}>Gestion Concours</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
        ) : !activeEvent ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={COLORS.border} />
            <Text style={styles.emptyStateTitle}>Aucun concours actif</Text>
            <Text style={styles.emptyStateDesc}>Activez le concours dans la fiche d'un événement.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('BarEventsScreen')}>
              <Text style={styles.emptyBtnText}>Gérer mes événements</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── EVENT CARD ── */}
            <View style={styles.eventCard}>
              <View style={styles.eventCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{activeEvent.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    {phaseInfo && (
                      <>
                        <Ionicons name={phaseInfo.icon} size={14} color={phaseInfo.color} />
                        <Text style={[styles.phaseLabel, { color: phaseInfo.color }]}>{phaseInfo.label}</Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statPill}>
                    <Text style={styles.statNum}>{allPhotos.length}</Text>
                    <Text style={styles.statLbl}>photos</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statNum}>{pendingPhotos.length}</Text>
                    <Text style={styles.statLbl}>en attente</Text>
                  </View>
                </View>
              </View>

              {/* ── CONTROLS ── */}
              <View style={styles.controlsRow}>
                {!activeEvent.contest_started_at && (
                  <TouchableOpacity
                    style={[styles.ctrlBtn, { backgroundColor: COLORS.success }]}
                    onPress={handleStartContest}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'start' ? <ActivityIndicator size="small" color="#FFF" /> : (
                      <>
                        <Ionicons name="play" size={16} color="#FFF" />
                        <Text style={styles.ctrlBtnText}>Démarrer</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {activeEvent.contest_phase === 'participation' && (
                  <TouchableOpacity
                    style={[styles.ctrlBtn, { backgroundColor: COLORS.warning }]}
                    onPress={handleForceVoting}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'voting' ? <ActivityIndicator size="small" color="#FFF" /> : (
                      <>
                        <Ionicons name="heart" size={16} color="#FFF" />
                        <Text style={styles.ctrlBtnText}>Lancer les votes</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {(activeEvent.contest_phase === 'voting' || activeEvent.contest_phase === 'participation') && (
                  <TouchableOpacity
                    style={[styles.ctrlBtn, { backgroundColor: COLORS.danger }]}
                    onPress={handleEndContest}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'end' ? <ActivityIndicator size="small" color="#FFF" /> : (
                      <>
                        <Ionicons name="flag" size={16} color="#FFF" />
                        <Text style={styles.ctrlBtnText}>Clôturer</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Durations */}
              <View style={styles.durationsRow}>
                <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.durationText}>
                  Participation: {activeEvent.contest_participation_duration || 30} min · Vote: {activeEvent.contest_voting_duration || 15} min · Limite: {activeEvent.contest_participant_limit || '∞'}
                </Text>
              </View>
            </View>

            {/* ── TABS ── */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'ranking' && styles.tabBtnActive]}
                onPress={() => setActiveTab('ranking')}
              >
                <Ionicons name="trophy" size={16} color={activeTab === 'ranking' ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.tabBtnText, activeTab === 'ranking' && styles.tabBtnTextActive]}>
                  Classement ({approvedPhotos.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'moderate' && styles.tabBtnActive]}
                onPress={() => setActiveTab('moderate')}
              >
                <Ionicons name="shield-checkmark" size={16} color={activeTab === 'moderate' ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.tabBtnText, activeTab === 'moderate' && styles.tabBtnTextActive]}>
                  Modération {pendingPhotos.length > 0 ? `(${pendingPhotos.length})` : ''}
                </Text>
                {pendingPhotos.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pendingPhotos.length}</Text></View>}
              </TouchableOpacity>
            </View>

            {/* ── RANKING TAB ── */}
            {activeTab === 'ranking' && (
              approvedPhotos.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="image-outline" size={48} color={COLORS.border} />
                  <Text style={styles.emptyStateTitle}>Aucune photo validée</Text>
                </View>
              ) : (
                approvedPhotos.map((photo, index) => (
                  <View key={photo.id} style={[
                    styles.rankCard,
                    index === 0 && styles.rankCardGold,
                    index === 1 && styles.rankCardSilver,
                    index === 2 && styles.rankCardBronze,
                  ]}>
                    <View style={styles.rankBadge}>
                      {index === 0 ? <Text style={styles.rankMedal}>🥇</Text> :
                        index === 1 ? <Text style={styles.rankMedal}>🥈</Text> :
                          index === 2 ? <Text style={styles.rankMedal}>🥉</Text> :
                            <Text style={styles.rankNum}>#{index + 1}</Text>}
                    </View>
                    <Image source={{ uri: photo.photo_url }} style={styles.photoThumb} />
                    <View style={styles.photoInfo}>
                      <View style={styles.votesBadge}>
                        <Ionicons name="heart" size={16} color={COLORS.danger} />
                        <Text style={styles.votesText}>{photo.votes_count || 0} votes</Text>
                      </View>
                      {photo.status === 'approved' && activeEvent.contest_phase === 'voting' && (
                        <TouchableOpacity
                          style={styles.winnerBtn}
                          onPress={handleEndContest}
                        >
                          <Ionicons name="trophy" size={14} color="#FFF" />
                          <Text style={styles.winnerBtnText}>Élire gagnant</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )
            )}

            {/* ── MODERATION TAB ── */}
            {activeTab === 'moderate' && (
              allPhotos.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="image-outline" size={48} color={COLORS.border} />
                  <Text style={styles.emptyStateTitle}>Aucune photo soumise</Text>
                </View>
              ) : (
                allPhotos.map(photo => (
                  <View key={photo.id} style={styles.moderateCard}>
                    <Image source={{ uri: photo.photo_url }} style={styles.moderateThumb} />
                    <View style={styles.moderateInfo}>
                      <View style={[styles.statusPill, {
                        backgroundColor: photo.status === 'approved' ? COLORS.success + '20' :
                          photo.status === 'rejected' ? COLORS.danger + '20' : COLORS.warning + '20'
                      }]}>
                        <Text style={[styles.statusPillText, {
                          color: photo.status === 'approved' ? COLORS.success :
                            photo.status === 'rejected' ? COLORS.danger : COLORS.warning
                        }]}>
                          {photo.status === 'approved' ? 'Validée' :
                            photo.status === 'rejected' ? 'Rejetée' : 'En attente'}
                        </Text>
                      </View>
                      <View style={styles.moderateActions}>
                        <TouchableOpacity
                          style={[styles.moderateBtn, { backgroundColor: COLORS.success }, photo.status === 'approved' && styles.moderateBtnActive]}
                          onPress={() => handleModerate(photo, 'approved')}
                          disabled={actionLoading === photo.id || photo.status === 'approved'}
                        >
                          {actionLoading === photo.id ? <ActivityIndicator size="small" color="#FFF" /> : (
                            <Ionicons name="checkmark" size={18} color="#FFF" />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.moderateBtn, { backgroundColor: COLORS.danger }, photo.status === 'rejected' && styles.moderateBtnActive]}
                          onPress={() => handleModerate(photo, 'rejected')}
                          disabled={actionLoading === photo.id || photo.status === 'rejected'}
                        >
                          <Ionicons name="close" size={18} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontWeight: 'bold' },
  scrollContent: { padding: SPACING.md, paddingBottom: 100 },

  eventCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg,
  },
  eventCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  eventTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  phaseLabel: { fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statPill: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  statLbl: { fontSize: 10, color: COLORS.textMuted },

  controlsRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.sm },
  ctrlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, minHeight: 38,
  },
  ctrlBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  durationsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  durationText: { fontSize: 12, color: COLORS.textMuted },

  tabs: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  tabBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabBtnTextActive: { color: COLORS.primary },
  badge: {
    backgroundColor: COLORS.danger, borderRadius: 10, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  rankCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm,
    borderLeftWidth: 4, borderLeftColor: 'transparent',
  },
  rankCardGold: { borderLeftColor: '#FFD700', backgroundColor: '#FFFDF0' },
  rankCardSilver: { borderLeftColor: '#C0C0C0' },
  rankCardBronze: { borderLeftColor: '#CD7F32' },
  rankBadge: { width: 44, alignItems: 'center' },
  rankMedal: { fontSize: 24 },
  rankNum: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  photoThumb: { width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: COLORS.border },
  photoInfo: { flex: 1, marginLeft: SPACING.md, gap: SPACING.xs },
  votesBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  votesText: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  winnerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md,
    paddingVertical: 6, borderRadius: RADIUS.full, alignSelf: 'flex-start',
  },
  winnerBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },

  moderateCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    padding: SPACING.sm, borderRadius: RADIUS.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  moderateThumb: { width: 80, height: 80, borderRadius: RADIUS.sm, backgroundColor: COLORS.border },
  moderateInfo: { flex: 1, marginLeft: SPACING.md, gap: SPACING.sm },
  statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  moderateActions: { flexDirection: 'row', gap: SPACING.sm },
  moderateBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', opacity: 1,
  },
  moderateBtnActive: { opacity: 0.4 },

  emptyState: { alignItems: 'center', padding: SPACING.xxl, marginTop: SPACING.xl },
  emptyStateTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginTop: SPACING.md },
  emptyStateDesc: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 },
  emptyBtn: {
    marginTop: SPACING.lg, backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.full,
  },
  emptyBtnText: { color: '#FFF', fontWeight: 'bold' },
});

export default BarContestScreen;

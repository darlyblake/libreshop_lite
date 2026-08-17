import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  StatusBar,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { barService, BarEvent } from '../services/barService';
import { DatePickerInput } from '../components/DatePickerInput';
import * as ImagePicker from 'expo-image-picker';
import { cloudinaryService } from '../services/cloudinaryService';

export const BarEventFormScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fontSize } = useResponsive();

  const eventId = route.params?.eventId;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [startTime, setStartTime] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startTimeHour, setStartTimeHour] = useState<string>('20:00');
  const [endTime, setEndTime] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'draft' | 'published' | 'ended'>('draft');
  const [isPhotoWallActive, setIsPhotoWallActive] = useState(false);
  const [isContestActive, setIsContestActive] = useState(false);
  const [contestParticipantLimit, setContestParticipantLimit] = useState<string>('50');
  const [contestParticipationDuration, setContestParticipationDuration] = useState<string>('30');
  const [contestVotingDuration, setContestVotingDuration] = useState<string>('15');
  const [contestReward, setContestReward] = useState<string>('');
  const [contestVoteType, setContestVoteType] = useState<'unique' | 'libre'>('unique');

  useEffect(() => {
    loadData();
  }, [user?.id, eventId]);

  const loadData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const s = await storeService.getByUser(user.id);
      if (s) {
        setStoreId(s.id);
        if (eventId) {
          const eventData = await barService.getEventById(eventId);
          if (eventData) {
            setTitle(eventData.title);
            setDescription(eventData.description || '');
            if (eventData.cover_image) setCoverImage(eventData.cover_image);
            
            const eventDate = new Date(eventData.start_time);
            setStartTime(eventData.start_time.split('T')[0]);
            
            const hrs = eventDate.getHours().toString().padStart(2, '0');
            const mins = eventDate.getMinutes().toString().padStart(2, '0');
            setStartTimeHour(`${hrs}:${mins}`);
            
            if (eventData.end_time) setEndTime(eventData.end_time.split('T')[0]);
            setStatus(eventData.status);
            setIsPhotoWallActive(eventData.is_photo_wall_active);
            setIsContestActive(eventData.is_contest_active);
            if (eventData.contest_participant_limit) {
              setContestParticipantLimit(eventData.contest_participant_limit.toString());
            }
            if (eventData.contest_participation_duration) {
              setContestParticipationDuration(eventData.contest_participation_duration.toString());
            }
            if (eventData.contest_voting_duration) {
              setContestVotingDuration(eventData.contest_voting_duration.toString());
            }
            if (eventData.contest_reward) setContestReward(eventData.contest_reward);
            if (eventData.contest_vote_type) setContestVoteType(eventData.contest_vote_type);
          }
        }
      }
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'événement.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!storeId) return;
    if (!title.trim()) {
      Alert.alert('Erreur', 'Le titre est requis.');
      return;
    }
    if (!startTime || !startTimeHour) {
      Alert.alert('Erreur', 'La date et l\'heure de début sont requises.');
      return;
    }

    try {
      setSaving(true);
      
      const [hour, min] = startTimeHour.split(':');
      const startD = new Date(startTime);
      if (!isNaN(parseInt(hour)) && !isNaN(parseInt(min))) {
        startD.setHours(parseInt(hour), parseInt(min), 0, 0);
      }

      const eventData: Partial<BarEvent> = {
        store_id: storeId,
        title: title.trim(),
        description: description.trim(),
        cover_image: coverImage,
        start_time: startD.toISOString(),
        end_time: endTime ? new Date(endTime + 'T00:00:00').toISOString() : undefined,
        status,
        is_photo_wall_active: isPhotoWallActive,
        is_contest_active: isContestActive,
        contest_participant_limit: parseInt(contestParticipantLimit) || 50,
        contest_participation_duration: parseInt(contestParticipationDuration) || 30,
        contest_voting_duration: parseInt(contestVotingDuration) || 15,
        contest_reward: contestReward.trim(),
        contest_vote_type: contestVoteType,
      };

      if (eventId) {
        await barService.updateEvent(eventId, eventData);
        Alert.alert('Succès', 'Événement mis à jour.');
      } else {
        await barService.createEvent(eventData);
        Alert.alert('Succès', 'Événement créé.');
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving event:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'événement.');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      try {
        setUploadingImage(true);
        const url = await cloudinaryService.uploadImage(result.assets[0].uri);
        if (url) {
          setCoverImage(url);
        }
      } catch (e) {
        Alert.alert('Erreur', 'Le téléchargement de l\'image a échoué.');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  if (loading) {
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
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: fontSize.lg }]}>
          {eventId ? 'Modifier l\'événement' : 'Nouvel événement'}
        </Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + SPACING.xxl }]}>
        <View style={styles.section}>
          <Text style={styles.label}>Image de couverture</Text>
          <TouchableOpacity style={styles.imageUploadBtn} onPress={pickImage} disabled={uploadingImage}>
            {uploadingImage ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverPreview} resizeMode="cover" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={32} color={COLORS.textMuted} />
                <Text style={styles.imageUploadText}>Ajouter une image (16:9)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Titre de l'événement *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Soirée Karaoké"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Détails de l'événement..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.section, { flex: 2, marginRight: SPACING.sm }]}>
            <Text style={styles.label}>Date de début</Text>
            <DatePickerInput
              value={startTime}
              onChange={setStartTime}
            />
          </View>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Heure</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 22:00"
              value={startTimeHour}
              onChangeText={setStartTimeHour}
              maxLength={5}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Date de fin (opt.)</Text>
            <DatePickerInput
              value={endTime || ''}
              onChange={(val) => setEndTime(val || undefined)}
              placeholder="Non défini"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Statut de l'événement</Text>
          <View style={styles.statusGroup}>
            <TouchableOpacity
              style={[styles.statusOption, status === 'draft' && styles.statusOptionActive]}
              onPress={() => setStatus('draft')}
            >
              <Text style={[styles.statusOptionText, status === 'draft' && styles.statusOptionTextActive]}>Brouillon</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusOption, status === 'published' && styles.statusOptionActive]}
              onPress={() => setStatus('published')}
            >
              <Text style={[styles.statusOptionText, status === 'published' && styles.statusOptionTextActive]}>Publié</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusOption, status === 'ended' && styles.statusOptionActive]}
              onPress={() => setStatus('ended')}
            >
              <Text style={[styles.statusOptionText, status === 'ended' && styles.statusOptionTextActive]}>Terminé</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="images" size={24} color={COLORS.accent} />
            <View style={styles.cardHeaderTexts}>
              <Text style={styles.cardTitle}>Mur Photo Interactif</Text>
              <Text style={styles.cardSubtitle}>Permet aux clients de poster des photos en direct sur l'écran du bar.</Text>
            </View>
            <Switch
              value={isPhotoWallActive}
              onValueChange={setIsPhotoWallActive}
              trackColor={{ false: COLORS.border, true: COLORS.accent + '80' }}
              thumbColor={isPhotoWallActive ? COLORS.accent : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="trophy" size={24} color={COLORS.warning} />
            <View style={styles.cardHeaderTexts}>
              <Text style={styles.cardTitle}>Concours Photo</Text>
              <Text style={styles.cardSubtitle}>Activez le vote pour élire la meilleure photo de l'événement.</Text>
            </View>
            <Switch
              value={isContestActive}
              onValueChange={setIsContestActive}
              trackColor={{ false: COLORS.border, true: COLORS.warning + '80' }}
              thumbColor={isContestActive ? COLORS.warning : '#f4f3f4'}
            />
          </View>
          {isContestActive && (
            <View style={{ marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.md, gap: SPACING.md }}>
              <View>
                <Text style={styles.label}>Récompense (opt.)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 1 Cocktail offert"
                  value={contestReward}
                  onChangeText={setContestReward}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: SPACING.sm }}>
                  <Text style={styles.label}>Type de vote</Text>
                  <View style={styles.statusGroup}>
                    <TouchableOpacity
                      style={[styles.statusOption, contestVoteType === 'unique' && styles.statusOptionActive]}
                      onPress={() => setContestVoteType('unique')}
                    >
                      <Text style={[styles.statusOptionText, contestVoteType === 'unique' && styles.statusOptionTextActive]}>Unique</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.statusOption, contestVoteType === 'libre' && styles.statusOptionActive]}
                      onPress={() => setContestVoteType('libre')}
                    >
                      <Text style={[styles.statusOptionText, contestVoteType === 'libre' && styles.statusOptionTextActive]}>Libre</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text style={styles.label}>Limite participants</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 50"
                    keyboardType="numeric"
                    value={contestParticipantLimit}
                    onChangeText={setContestParticipantLimit}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: SPACING.sm }}>
                  <Text style={styles.label}>⏱ Durée participation (min)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 30"
                    keyboardType="numeric"
                    value={contestParticipationDuration}
                    onChangeText={setContestParticipationDuration}
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Bascule en vote même si la limite n'est pas atteinte.</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text style={styles.label}>🗳 Durée du vote (min)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 15"
                    keyboardType="numeric"
                    value={contestVotingDuration}
                    onChangeText={setContestVotingDuration}
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Ferme le concours à la fin du vote.</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── BOTTOM SAVE BUTTON ── */}
        <TouchableOpacity
          style={[styles.bottomSaveButton, saving && styles.bottomSaveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFF" />
              <Text style={styles.bottomSaveButtonText}>{eventId ? 'Mettre à jour l\'événement' : 'Créer l\'événement'}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  saveButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.md,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  form: {
    padding: SPACING.md,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  imageUploadBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageUploadText: {
    marginTop: SPACING.sm,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  coverPreview: {
    width: '100%',
    height: '100%',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  statusGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  statusOption: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  statusOptionActive: {
    backgroundColor: COLORS.primary + '15',
  },
  statusOptionText: {
    color: COLORS.textMuted,
    fontWeight: 'bold',
  },
  statusOptionTextActive: {
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderTexts: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  bottomSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  bottomSaveButtonDisabled: {
    opacity: 0.6,
  },
  bottomSaveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 17,
  },
});
export default BarEventFormScreen;

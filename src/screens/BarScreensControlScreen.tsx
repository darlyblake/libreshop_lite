import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { barService } from '../services/barService';

const SCREEN_MODES = [
  { id: 'menu', title: 'Carte & Menu', icon: 'restaurant', desc: 'Affiche la carte des boissons et plats.' },
  { id: 'photo_wall', title: 'Mur Photo', icon: 'images', desc: 'Diaporama des photos postées par les clients.' },
  { id: 'contest', title: 'Classement Concours', icon: 'trophy', desc: 'Affiche en direct le classement du concours.' },
  { id: 'custom_message', title: 'Message Personnalisé', icon: 'chatbubble-ellipses', desc: 'Affiche un message en grand.' },
];

export const BarScreensControlScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fontSize } = useResponsive();
  const isFocused = useIsFocused();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<string>('menu');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [user?.id, isFocused]);

  const loadData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const s = await storeService.getByUser(user.id);
      if (s) {
        setStoreId(s.id);
        setCurrentMode(s.screen_current_mode || 'menu');
        setCustomMessage(s.screen_message || '');
      }
    } catch (e) {
      console.error('Error loading store settings:', e);
      Alert.alert('Erreur', 'Impossible de charger les paramètres des écrans.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMode = async (modeId: string) => {
    if (!storeId) return;
    try {
      setSaving(true);
      await barService.updateScreenSettings(storeId, modeId, modeId === 'custom_message' ? customMessage : undefined);
      setCurrentMode(modeId);
      Alert.alert('Succès', 'Les écrans ont été mis à jour.');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour les écrans.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = () => {
    if (!customMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un message.');
      return;
    }
    handleUpdateMode('custom_message');
  };

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
          Télécommande Écrans
        </Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Mode d'affichage actuel</Text>

          <View style={styles.grid}>
            {SCREEN_MODES.map((mode) => {
              const isActive = currentMode === mode.id;
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.modeCard, isActive && styles.modeCardActive]}
                  onPress={() => mode.id !== 'custom_message' && handleUpdateMode(mode.id)}
                  disabled={saving || (mode.id === 'custom_message')}
                >
                  <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                    <Ionicons name={mode.icon as any} size={32} color={isActive ? COLORS.primary : COLORS.textMuted} />
                  </View>
                  <Text style={[styles.modeTitle, isActive && styles.modeTitleActive]}>{mode.title}</Text>
                  <Text style={styles.modeDesc}>{mode.desc}</Text>

                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>EN DIRECT</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.messageSection}>
            <Text style={styles.sectionTitle}>Diffuser un message flash</Text>
            <View style={styles.messageInputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder="Ex: Tournée générale !"
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                numberOfLines={3}
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!customMessage.trim() || saving) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!customMessage.trim() || saving}
              >
                {saving && currentMode === 'custom_message' ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#FFF" />
                    <Text style={styles.sendButtonText}>Diffuser</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      )}
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
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  modeCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    position: 'relative',
  },
  modeCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '05',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  iconContainerActive: {
    backgroundColor: COLORS.primary + '15',
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  modeTitleActive: {
    color: COLORS.primary,
  },
  modeDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  activeBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  activeBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  messageSection: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageInputContainer: {
    gap: SPACING.md,
  },
  messageInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    height: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
export default BarScreensControlScreen;

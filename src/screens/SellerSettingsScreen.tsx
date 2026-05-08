import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '../config/theme';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { LocationPicker } from '../components/LocationPicker';

export const SellerSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [storeLocation, setStoreLocation] = useState({
    latitude: null as number | null,
    longitude: null as number | null,
    address: '',
    city: '',
  });

  useEffect(() => {
    loadStore();
  }, []);

  const loadStore = async () => {
    try {
      if (!user?.id) return;
      
      const storeData = await storeService.getByUser(user.id);
      if (storeData) {
        setStore(storeData);
        setStoreLocation({
          latitude: storeData.latitude || null,
          longitude: storeData.longitude || null,
          address: storeData.address || '',
          city: storeData.city || '',
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la boutique:', error);
      Alert.alert('Erreur', 'Impossible de charger les informations de la boutique');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationUpdate = async (location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  }) => {
    if (!store?.id) return;

    setUpdatingLocation(true);
    try {
      await storeService.updateStoreLocation(store.id, location);
      
      setStoreLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || '',
        city: location.city || '',
      });

      setShowLocationPicker(false);
      Alert.alert('Succès', 'Localisation de la boutique mise à jour avec succès');
      
      // Recharger les données de la boutique
      await loadStore();
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la localisation:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la localisation');
    } finally {
      setUpdatingLocation(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres de la boutique</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Localisation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Localisation</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowLocationPicker(true)}
          >
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="location" size={24} color={COLORS.accent} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Localisation de la boutique</Text>
                <Text style={styles.settingDescription}>
                  {storeLocation?.latitude 
                    ? (storeLocation.address || storeLocation.city || 'Localisation définie')
                    : 'Non définie - Ajoutez votre localisation pour être visible sur la carte'
                  }
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          {storeLocation?.latitude && (
            <View style={styles.locationInfo}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.locationInfoText}>
                Localisation définie le {new Date(store.location_set_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>
          )}
        </View>

        {/* Autres sections à ajouter plus tard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de contact</Text>
          
          <View style={[styles.settingItem, styles.settingItemDisabled]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, styles.iconContainerDisabled]}>
                <Ionicons name="call" size={24} color={COLORS.textMuted} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, styles.settingTitleDisabled]}>
                  Numéro de téléphone
                </Text>
                <Text style={styles.settingDescription}>
                  {store?.phone || 'Non défini'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
          </View>

          <View style={[styles.settingItem, styles.settingItemDisabled]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, styles.iconContainerDisabled]}>
                <Ionicons name="mail" size={24} color={COLORS.textMuted} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, styles.settingTitleDisabled]}>
                  Email
                </Text>
                <Text style={styles.settingDescription}>
                  {store?.email || 'Non défini'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
          </View>
        </View>
      </ScrollView>

      {/* Modal pour la sélection de localisation */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Modifier la localisation</Text>
            <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <LocationPicker
              initialLocation={
                storeLocation?.latitude && storeLocation?.longitude
                  ? { latitude: storeLocation.latitude, longitude: storeLocation.longitude }
                  : undefined
              }
              onLocationSelect={handleLocationUpdate}
            />
          </ScrollView>

          {updatingLocation && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.white} />
              <Text style={styles.loadingText}>Mise à jour en cours...</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingItemDisabled: {
    opacity: 0.5,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerDisabled: {
    backgroundColor: COLORS.border,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  settingTitleDisabled: {
    color: COLORS.textMuted,
  },
  settingDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.success + '20',
    borderRadius: RADIUS.md,
  },
  locationInfoText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalContent: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});

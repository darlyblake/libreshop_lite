import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { useTheme } from '../hooks/useTheme';
import { errorHandler } from '../utils/errorHandler';
import { locationService } from '../services/locationService';
import { supabase } from '../lib/supabase';

export const PersonalInfoScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, setUser } = useAuthStore();
  const { getColor, spacing, radius, fontSize } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    whatsapp_number: user?.whatsapp_number || '',
    address: user?.address || '',
  });
  const [locating, setLocating] = useState(false);

  // Sync formData when the user object changes (e.g., after Zustand rehydration from AsyncStorage)
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        phone: user.phone || '',
        whatsapp_number: user.whatsapp_number || '',
        address: user.address || '',
      });
    }
  }, [user]);

  // On web/PWA, the page may load before Zustand has rehydrated from AsyncStorage.
  // In that case, fetch the profile directly from Supabase using the active session.
  useEffect(() => {
    const fetchProfileFromSession = async () => {
      if (user) return; // Already have user data, no need to fetch
      setProfileLoading(true);
      try {
        const { data: sessionData } = await supabase!.auth.getSession();
        const sessionUser = sessionData?.session?.user;
        if (!sessionUser) return; // Not authenticated

        const profile = await userService.getSelfProfile(sessionUser.id);
        if (profile) {
          setFormData({
            full_name: profile.full_name || '',
            phone: profile.phone || '',
            whatsapp_number: profile.whatsapp_number || '',
            address: profile.address || '',
          });
          // Update the store so it stays in sync
          const { setUser } = useAuthStore.getState();
          setUser(profile as any);
        }
      } catch (e) {
        console.warn('[PersonalInfoScreen] Failed to fetch profile from session:', e);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfileFromSession();
  }, []);

  const handleGetCurrentLocation = async () => {
    setLocating(true);
    try {
      const position = await locationService.getCurrentPosition();
      if (!position) {
        Alert.alert('Erreur', 'Impossible de récupérer votre position actuelle. Assurez-vous d’activer le GPS.');
        return;
      }
      
      const addr = await locationService.reverseGeocode(position.latitude, position.longitude);
      if (addr && addr.street) {
        setFormData(prev => ({
          ...prev,
          address: addr.street || ''
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          address: `Lat: ${position.latitude.toFixed(5)}, Lon: ${position.longitude.toFixed(5)}`
        }));
      }
    } catch (e) {
      errorHandler.handle(e, 'Location address error');
      Alert.alert('Erreur', 'Une erreur s’est produite lors de la détection de l’adresse.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      Alert.alert('Erreur', 'Le nom complet est requis');
      return;
    }

    setLoading(true);
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      await authService.updateProfile(user.id, {
        full_name: formData.full_name,
        phone: formData.phone,
        whatsapp_number: formData.whatsapp_number,
        address: formData.address,
      });
      
      setUser({
        ...user,
        ...formData
      });

      Alert.alert('Succès', 'Vos informations ont été mises à jour');
      navigation.goBack();
    } catch (error) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Error updating profile:');
      Alert.alert('Erreur', 'Impossible de mettre à jour vos informations');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: getColor.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.lg,
      backgroundColor: getColor.card,
      borderBottomWidth: 1,
      borderBottomColor: getColor.border,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: getColor.text,
      marginLeft: spacing.md,
    },
    content: {
      flex: 1,
      padding: spacing.xl,
    },
    section: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: getColor.text,
      marginBottom: spacing.md,
    },
    inputGroup: {
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '500',
      color: getColor.text,
      marginBottom: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: getColor.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: getColor.text,
      backgroundColor: getColor.bg,
    },
    inputFocused: {
      borderColor: getColor.accent,
    },
    saveButton: {
      backgroundColor: getColor.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    saveButtonText: {
      color: getColor.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    saveButtonDisabled: {
      backgroundColor: getColor.border,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: getColor.accent + '15',
    },
    locationButtonText: {
      fontSize: fontSize.xs,
      fontWeight: '600',
      color: getColor.accent,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={getColor.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informations personnelles</Text>
      </View>

      {profileLoading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color={getColor.accent} />
          <Text style={{ color: getColor.textMuted, marginTop: 12, fontSize: fontSize.sm }}>
            Chargement du profil…
          </Text>
        </View>
      )}
      {!profileLoading && (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de base</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom complet *</Text>
            <TextInput
              style={styles.input}
              value={formData.full_name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, full_name: text }))}
              placeholder="Entrez votre nom complet"
              placeholderTextColor={getColor.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: getColor.bg + '50' }]}
              value={user?.email || ''}
              editable={false}
              placeholderTextColor={getColor.textMuted}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coordonnées</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              placeholder="+241 XX XX XX XX"
              placeholderTextColor={getColor.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>WhatsApp</Text>
            <TextInput
              style={styles.input}
              value={formData.whatsapp_number}
              onChangeText={(text) => setFormData(prev => ({ ...prev, whatsapp_number: text }))}
              placeholder="+241 XX XX XX XX"
              placeholderTextColor={getColor.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={styles.label}>Adresse</Text>
              <TouchableOpacity 
                style={styles.locationButton} 
                onPress={handleGetCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={getColor.accent} />
                ) : (
                  <>
                    <Ionicons name="location" size={14} color={getColor.accent} />
                    <Text style={styles.locationButtonText}>Ma position</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={formData.address}
              onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
              placeholder="Entrez votre adresse complète"
              placeholderTextColor={getColor.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={getColor.text} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      )}
    </View>
  );
};

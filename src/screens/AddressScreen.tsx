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
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store';
import { useTheme } from '../hooks/useTheme';
import { errorHandler } from '../utils/errorHandler';
import { locationService } from '../services/locationService';
import { addressService } from '../services/addressService';
import type { Address } from '../services/addressService';

// Address type is now imported from addressService (Supabase-backed)

export const AddressScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { getColor, spacing, radius, fontSize } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    city: '',
    address: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    note: '',
    is_default: false,
  });
  const [locating, setLocating] = useState(false);

  const handleGetCurrentLocation = async () => {
    setLocating(true);
    try {
      const position = await locationService.getCurrentPosition();
      if (!position) {
        Alert.alert('Erreur', 'Impossible de récupérer votre position actuelle. Assurez-vous d’activer le GPS.');
        return;
      }
      
      const addr = await locationService.reverseGeocode(position.latitude, position.longitude);
      if (addr) {
        setFormData(prev => ({
          ...prev,
          city: addr.city || prev.city || '',
          address: addr.street || '',
          latitude: position.latitude,
          longitude: position.longitude,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          address: `Lat: ${position.latitude.toFixed(5)}, Lon: ${position.longitude.toFixed(5)}`,
          latitude: position.latitude,
          longitude: position.longitude,
        }));
      }
    } catch (e) {
      errorHandler.handle(e, 'Location address error');
      Alert.alert('Erreur', 'Une erreur s’est produite lors de la détection de l’adresse.');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [user]);

  const loadAddresses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Migration one-shot : transfère les adresses locales vers Supabase si besoin
      await addressService.migrateFromLocal(user.id);

      // 2. Charger depuis Supabase (source de vérité) avec mise à jour du cache
      const list = await addressService.getByUser(user.id);
      setAddresses(list);
    } catch (error) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Error loading addresses:');
      Alert.alert('Erreur', 'Impossible de charger vos adresses. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async () => {
    if (!user) return;
    if (!formData.label.trim() || !formData.address.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);
    try {
      const isFirst = addresses.length === 0;
      const newAddress = await addressService.add(user.id, {
        label: formData.label,
        city: formData.city,
        address: formData.address,
        latitude: formData.latitude ?? null,
        longitude: formData.longitude ?? null,
        note: formData.note || null,
        is_default: formData.is_default || isFirst,
      });

      // Refresh from DB
      const updatedList = await addressService.getByUser(user.id);
      setAddresses(updatedList);

      setFormData({
        label: '',
        city: '',
        address: '',
        latitude: undefined,
        longitude: undefined,
        note: '',
        is_default: false,
      });
      setShowAddForm(false);
      Alert.alert('Succès', 'Adresse ajoutée et synchronisée avec votre compte !');
    } catch (error) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Error adding address:');
      Alert.alert('Erreur', 'Impossible d\'ajouter cette adresse. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    if (!user) return;
    try {
      await addressService.setDefault(addressId, user.id);
      // Refresh
      const updatedList = await addressService.getByUser(user.id);
      setAddresses(updatedList);
      Alert.alert('Succès', 'Adresse principale mise à jour');
    } catch (error) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Error setting default address:');
      Alert.alert('Erreur', 'Impossible de mettre cette adresse par défaut');
    }
  };

  const handleDeleteAddress = (addressId: string) => {
    Alert.alert(
      'Supprimer l\'adresse',
      'Êtes-vous sûr de vouloir supprimer cette adresse ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await addressService.remove(addressId, user!.id);
              const updatedList = await addressService.getByUser(user!.id);
              setAddresses(updatedList);
              Alert.alert('Succès', 'Adresse supprimée');
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de supprimer cette adresse.');
            }
          }
        }
      ]
    );
  };

  const renderAddress = ({ item }: { item: Address }) => (
    <View style={[styles.addressCard, item.is_default && styles.defaultAddress]}>
      <View style={styles.addressHeader}>
        <Text style={styles.addressLabel}>{item.label}</Text>
        {item.is_default && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Par défaut</Text>
          </View>
        )}
      </View>
      <Text style={styles.addressText}>
        {item.city ? `${item.city}, ` : ''}{item.address}
        {item.note ? `\nNote : ${item.note}` : ''}
      </Text>
      <View style={styles.addressActions}>
        {!item.is_default && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetDefault(item.id)}
          >
            <Ionicons name="star-outline" size={20} color={getColor.accent} />
            <Text style={styles.actionText}>Définir par défaut</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteAddress(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color={getColor.error} />
          <Text style={[styles.actionText, styles.deleteText]}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
    addButton: {
      backgroundColor: getColor.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      marginBottom: spacing.lg,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    addButtonText: {
      color: getColor.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    addressCard: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    defaultAddress: {
      borderColor: getColor.accent,
      borderWidth: 2,
    },
    addressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    addressLabel: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: getColor.text,
    },
    defaultBadge: {
      backgroundColor: getColor.accent + '20',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    defaultBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: '600',
      color: getColor.accent,
    },
    addressText: {
      fontSize: fontSize.sm,
      color: getColor.textSoft,
      marginBottom: spacing.md,
      lineHeight: 20,
    },
    addressActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: getColor.bg,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    deleteButton: {
      borderColor: getColor.error + '30',
      backgroundColor: getColor.error + '10',
    },
    actionText: {
      fontSize: fontSize.sm,
      fontWeight: '500',
      color: getColor.accent,
    },
    deleteText: {
      color: getColor.error,
    },
    formCard: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    formTitle: {
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
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: getColor.accent,
      borderRadius: 4,
      marginRight: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: getColor.accent,
    },
    checkboxText: {
      fontSize: fontSize.sm,
      color: getColor.text,
    },
    formActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: getColor.bg,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: getColor.border,
    },
    cancelButtonText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: getColor.text,
    },
    saveButton: {
      flex: 1,
      backgroundColor: getColor.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
    },
    saveButtonText: {
      color: getColor.text,
      fontSize: fontSize.md,
      fontWeight: '600',
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
        <Text style={styles.headerTitle}>Adresses enregistrées</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Ionicons name="add-circle-outline" size={24} color={getColor.text} />
          <Text style={styles.addButtonText}>
            {showAddForm ? 'Annuler' : 'Ajouter une adresse'}
          </Text>
        </TouchableOpacity>

        {showAddForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Nouvelle adresse</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Libellé *</Text>
              <TextInput
                style={styles.input}
                value={formData.label}
                onChangeText={(text) => setFormData(prev => ({ ...prev, label: text }))}
                placeholder="Ex: Domicile, Travail..."
                placeholderTextColor={getColor.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ville *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#f0f0f0', color: getColor.textSoft }]}
                value={formData.city}
                placeholder="Rempli via 'Ma position' ci-dessous"
                placeholderTextColor={getColor.textMuted}
                editable={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                <Text style={styles.label}>Adresse complète *</Text>
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
                style={[styles.input, styles.textArea, { backgroundColor: '#f0f0f0', color: getColor.textSoft }]}
                value={formData.address}
                placeholder="Rempli via 'Ma position' ci-dessus"
                placeholderTextColor={getColor.textMuted}
                multiline
                numberOfLines={3}
                editable={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Note / Instructions pour la livraison</Text>
              <TextInput
                style={styles.input}
                value={formData.note}
                onChangeText={(text) => setFormData(prev => ({ ...prev, note: text }))}
                placeholder="Ex: Portail bleu, à côté du supermarché..."
                placeholderTextColor={getColor.textMuted}
              />
            </View>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setFormData(prev => ({ ...prev, is_default: !prev.is_default }))}
            >
              <View style={[styles.checkbox, formData.is_default && styles.checkboxChecked]}>
                {formData.is_default && (
                  <Ionicons name="checkmark" size={14} color="white" />
                )}
              </View>
              <Text style={styles.checkboxText}>Définir comme adresse par défaut</Text>
            </TouchableOpacity>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddForm(false);
                  setFormData({
                    label: '',
                    city: '',
                    address: '',
                    latitude: undefined,
                    longitude: undefined,
                    note: '',
                    is_default: false,
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddAddress}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={getColor.text} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Ajouter</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <FlatList
          data={addresses}
          renderItem={renderAddress}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="location-outline" size={64} color={getColor.textMuted} />
              <Text style={{ fontSize: fontSize.md, color: getColor.textMuted, marginTop: spacing.md }}>
                Aucune adresse enregistrée
              </Text>
            </View>
          }
        />
      </ScrollView>
    </View>
  );
};

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
import { authService } from '../services/authService';
import { useTheme } from '../hooks/useTheme';
import { errorHandler } from '../utils/errorHandler';

interface Address {
  id: string;
  label: string;
  address: string;
  is_default: boolean;
}

export const AddressScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { getColor, spacing, radius, fontSize } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    address: '',
    is_default: false,
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      // Simuler le chargement des adresses depuis l'API
      if (user?.address) {
        setAddresses([
          {
            id: '1',
            label: 'Adresse principale',
            address: user.address,
            is_default: true,
          }
        ]);
      }
    } catch (error) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Error loading addresses:');
    }
  };

  const handleAddAddress = async () => {
    if (!formData.label.trim() || !formData.address.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      const newAddress: Address = {
        id: Date.now().toString(),
        label: formData.label,
        address: formData.address,
        is_default: formData.is_default || addresses.length === 0,
      };

      if (newAddress.is_default) {
        setAddresses(prev => prev.map(addr => ({ ...addr, is_default: false })));
      }

      setAddresses(prev => [...prev, newAddress]);
      
      // Mettre à jour l'adresse principale de l'utilisateur
      if (newAddress.is_default && user) {
        await authService.updateProfile(user.id, { address: newAddress.address });
        const { setUser } = useAuthStore.getState();
        setUser({ ...user, address: newAddress.address });
      }

      setFormData({ label: '', address: '', is_default: false });
      setShowAddForm(false);
      Alert.alert('Succès', 'Adresse ajoutée avec succès');
    } catch (error) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Error adding address:');
      Alert.alert('Erreur', 'Impossible d\'ajouter cette adresse');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      const address = addresses.find(addr => addr.id === addressId);
      if (!address) return;

      setAddresses(prev => prev.map(addr => ({
        ...addr,
        is_default: addr.id === addressId
      })));

      if (user) {
        await authService.updateProfile(user.id, { address: address.address });
        const { setUser } = useAuthStore.getState();
        setUser({ ...user, address: address.address });
      }

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
          onPress: () => {
            setAddresses(prev => prev.filter(addr => addr.id !== addressId));
            Alert.alert('Succès', 'Adresse supprimée');
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
      <Text style={styles.addressText}>{item.address}</Text>
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
              <Text style={styles.label}>Adresse complète *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.address}
                onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
                placeholder="Entrez l'adresse complète"
                placeholderTextColor={getColor.textMuted}
                multiline
                numberOfLines={3}
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
                  setFormData({ label: '', address: '', is_default: false });
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

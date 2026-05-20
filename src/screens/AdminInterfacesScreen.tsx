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
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { settingsService } from '../services/settingsService';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import * as Haptics from 'expo-haptics';

export interface StoreType {
  id: string;
  title: string;
  icon: string;
  status: 'active' | 'avenir' | 'inactive';
}

const DEFAULT_STORE_TYPES: StoreType[] = [
  { id: 'general', title: '🛍️ Boutique', icon: 'storefront-outline', status: 'active' },
  { id: 'restaurant', title: '🍳 Restaurant', icon: 'restaurant-outline', status: 'avenir' },
  { id: 'bar', title: '🍹 Bar / Lounge', icon: 'beer-outline', status: 'avenir' },
  { id: 'hotel', title: '🏨 Hôtel', icon: 'bed-outline', status: 'avenir' },
  { id: 'logement', title: '🏠 Logement', icon: 'home-outline', status: 'avenir' },
];

const PRESET_ICONS = [
  'storefront-outline',
  'restaurant-outline',
  'beer-outline',
  'bed-outline',
  'home-outline',
  'sparkles-outline',
  'shirt-outline',
  'car-outline',
  'construct-outline',
  'medkit-outline',
  'color-palette-outline',
  'barbell-outline',
];

export const AdminInterfacesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { getColor: COLORS, spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE } = useTheme();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storeTypes, setStoreTypes] = useState<StoreType[]>([]);

  // Add form states
  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState('storefront-outline');
  const [newStatus, setNewStatus] = useState<'active' | 'avenir' | 'inactive'>('active');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadStoreTypes();
  }, []);

  const loadStoreTypes = async () => {
    setLoading(true);
    try {
      const types = await settingsService.getSetting('store_types', DEFAULT_STORE_TYPES);
      setStoreTypes(types);
    } catch (e) {
      console.error('Error loading store types:', e);
      Alert.alert('Erreur', 'Impossible de charger les types de boutiques.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async (updatedTypes: StoreType[]) => {
    setSaving(true);
    try {
      await settingsService.updateSetting('store_types', updatedTypes);
      setStoreTypes(updatedTypes);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Succès', 'Configurations enregistrées avec succès !');
    } catch (e) {
      console.error('Error saving store types:', e);
      Alert.alert('Erreur', 'Impossible d\'enregistrer les modifications.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = storeTypes.map(type => {
      if (type.id === id) {
        let nextStatus: StoreType['status'] = 'active';
        if (type.status === 'active') nextStatus = 'avenir';
        else if (type.status === 'avenir') nextStatus = 'inactive';
        return { ...type, status: nextStatus };
      }
      return type;
    });
    setStoreTypes(updated);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Supprimer',
      'Voulez-vous vraiment supprimer ce type d\'activité ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const filtered = storeTypes.filter(type => type.id !== id);
            setStoreTypes(filtered);
          },
        },
      ]
    );
  };

  const handleAddStoreType = () => {
    if (!newTitle.trim()) {
      Alert.alert('Erreur', 'Le titre ne peut pas être vide.');
      return;
    }

    const newId = newTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (storeTypes.some(t => t.id === newId)) {
      Alert.alert('Erreur', 'Un type d\'activité similaire existe déjà.');
      return;
    }

    const newType: StoreType = {
      id: newId,
      title: newTitle.trim(),
      icon: newIcon,
      status: newStatus,
    };

    const updated = [...storeTypes, newType];
    setStoreTypes(updated);

    // Reset form
    setNewTitle('');
    setNewIcon('storefront-outline');
    setNewStatus('active');
    setShowAddForm(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getStatusDetails = (status: StoreType['status']) => {
    switch (status) {
      case 'active':
        return { label: 'Actif', color: COLORS.success, icon: 'checkmark-circle' };
      case 'avenir':
        return { label: 'À venir', color: COLORS.warning, icon: 'time' };
      case 'inactive':
      default:
        return { label: 'Inactif', color: COLORS.danger, icon: 'close-circle' };
    }
  };

  const styles = getStyles({ COLORS, SPACING, RADIUS, FONT_SIZE });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des interfaces</Text>
        {saving ? (
          <ActivityIndicator color={COLORS.accent} size="small" />
        ) : (
          <TouchableOpacity onPress={() => handleSaveAll(storeTypes)}>
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Configurez les types de boutiques visibles par les vendeurs lors de l'onboarding. Configurez en status "À venir" pour alerter les vendeurs que le service n'est pas encore disponible.
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : (
          <>
            {/* List of current store types */}
            <View style={styles.listContainer}>
              {storeTypes.map((type) => {
                const statusDetails = getStatusDetails(type.status);
                return (
                  <Card key={type.id} style={styles.itemCard}>
                    <View style={styles.itemRow}>
                      <View style={[styles.iconContainer, { backgroundColor: COLORS.accent + '15' }]}>
                        <Ionicons name={type.icon as any} size={24} color={COLORS.accent} />
                      </View>
                      
                      <View style={styles.itemInfo}>
                        <TextInput
                          style={styles.itemTitleInput}
                          value={type.title}
                          onChangeText={(text) => {
                            const updated = storeTypes.map(t => t.id === type.id ? { ...t, title: text } : t);
                            setStoreTypes(updated);
                          }}
                          placeholder="Titre de l'activité"
                          placeholderTextColor={COLORS.textMuted}
                        />
                        <Text style={styles.itemIdText}>ID: {type.id}</Text>
                      </View>

                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={[styles.statusBadge, { borderColor: statusDetails.color }]}
                          onPress={() => toggleStatus(type.id)}
                        >
                          <Ionicons name={statusDetails.icon as any} size={14} color={statusDetails.color} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusText, { color: statusDetails.color }]}>{statusDetails.label}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.deleteButton} 
                          onPress={() => handleDelete(type.id)}
                        >
                          <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>

            {/* Add custom store type */}
            {!showAddForm ? (
              <TouchableOpacity 
                style={styles.addTriggerButton}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowAddForm(true);
                }}
              >
                <Ionicons name="add-circle-outline" size={22} color={COLORS.accent} />
                <Text style={styles.addTriggerText}>Ajouter un type de boutique</Text>
              </TouchableOpacity>
            ) : (
              <Card style={styles.formCard}>
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>Nouveau type d'activité</Text>
                  <TouchableOpacity onPress={() => setShowAddForm(false)}>
                    <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.formInput}
                  placeholder="Titre (ex: 💅 Salon d'Esthétique)"
                  placeholderTextColor={COLORS.textMuted}
                  value={newTitle}
                  onChangeText={setNewTitle}
                />

                <Text style={styles.label}>Icône de l'activité</Text>
                <View style={styles.iconPresetGrid}>
                  {PRESET_ICONS.map((icon) => (
                    <TouchableOpacity
                      key={icon}
                      style={[
                        styles.iconPresetItem,
                        newIcon === icon && { backgroundColor: COLORS.accent + '25', borderColor: COLORS.accent }
                      ]}
                      onPress={() => setNewIcon(icon)}
                    >
                      <Ionicons name={icon as any} size={22} color={newIcon === icon ? COLORS.accent : COLORS.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Statut initial</Text>
                <View style={styles.statusRow}>
                  {(['active', 'avenir', 'inactive'] as const).map((status) => {
                    const active = newStatus === status;
                    let label = 'Actif';
                    let activeColor = COLORS.success;
                    if (status === 'avenir') { label = 'À venir'; activeColor = COLORS.warning; }
                    if (status === 'inactive') { label = 'Inactif'; activeColor = COLORS.danger; }

                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusSelector,
                          active && { backgroundColor: activeColor + '15', borderColor: activeColor }
                        ]}
                        onPress={() => setNewStatus(status)}
                      >
                        <Text style={[styles.statusSelectorText, { color: active ? activeColor : COLORS.textMuted }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Button 
                  title="Ajouter à la liste" 
                  onPress={handleAddStoreType} 
                  variant="primary"
                  style={{ marginTop: SPACING.md }}
                />
              </Card>
            )}

            <Button 
              title="Enregistrer toutes les modifications" 
              onPress={() => handleSaveAll(storeTypes)} 
              variant="primary"
              loading={saving}
              style={{ marginTop: SPACING.xl, marginBottom: SPACING.xl }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = ({ COLORS, SPACING, RADIUS, FONT_SIZE }: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: Platform.OS === 'ios' ? 50 : 20,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: FONT_SIZE.lg || 18,
      fontWeight: '700',
      color: COLORS.text,
    },
    saveButtonText: {
      fontSize: FONT_SIZE.sm || 14,
      fontWeight: '600',
      color: COLORS.accent,
    },
    scrollContent: {
      padding: SPACING.lg,
    },
    subtitle: {
      fontSize: FONT_SIZE.sm || 14,
      color: COLORS.textSoft,
      lineHeight: 20,
      marginBottom: SPACING.lg,
    },
    loadingContainer: {
      padding: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContainer: {
      gap: SPACING.md,
      marginBottom: SPACING.xl,
    },
    itemCard: {
      padding: SPACING.md,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    itemInfo: {
      flex: 1,
    },
    itemTitleInput: {
      fontSize: FONT_SIZE.md || 16,
      fontWeight: '600',
      color: COLORS.text,
      padding: 0,
    },
    itemIdText: {
      fontSize: 10,
      color: COLORS.textMuted,
      marginTop: 2,
    },
    itemActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
    },
    deleteButton: {
      padding: 6,
    },
    addTriggerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.accent + '50',
      borderStyle: 'dashed',
      borderRadius: RADIUS.md || 12,
      padding: SPACING.md,
      gap: SPACING.sm,
      marginBottom: SPACING.xl,
    },
    addTriggerText: {
      fontSize: FONT_SIZE.sm || 14,
      fontWeight: '600',
      color: COLORS.accent,
    },
    formCard: {
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: COLORS.accent + '25',
    },
    formHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    formTitle: {
      fontSize: FONT_SIZE.md || 16,
      fontWeight: '700',
      color: COLORS.text,
    },
    formInput: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: COLORS.text,
      fontSize: FONT_SIZE.sm || 14,
      marginBottom: SPACING.md,
      backgroundColor: COLORS.bg,
    },
    label: {
      fontSize: FONT_SIZE.xs || 12,
      fontWeight: '600',
      color: COLORS.textSoft,
      marginBottom: SPACING.xs,
    },
    iconPresetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    iconPresetItem: {
      width: 44,
      height: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.card,
    },
    statusRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    statusSelector: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: COLORS.card,
    },
    statusSelectorText: {
      fontSize: 12,
      fontWeight: '600',
    },
  });

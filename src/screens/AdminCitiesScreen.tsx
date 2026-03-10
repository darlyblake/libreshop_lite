import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { BackToDashboard } from '../components/BackToDashboard';
import { supabase } from '../lib/supabase';

type Country = {
  id: string;
  name: string;
  code: string;
};

type City = {
  id: string;
  country_id: string;
  name: string;
};

export const AdminCitiesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialCountryId = String(route.params?.countryId || '');

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState(initialCountryId);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  const [cities, setCities] = useState<City[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<City | null>(null);
  const [name, setName] = useState('');

  const loadCountries = async () => {
    try {
      if (!supabase) throw new Error('Supabase not initialized');
      const { data, error } = await supabase.from('countries').select('id,name,code').order('name', { ascending: true });
      if (error) throw error;
      setCountries((data || []) as Country[]);
      if (!countryId && data && data.length > 0) {
        setCountryId(data[0].id);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de charger les pays.');
    }
  };

  const loadCities = async () => {
    try {
      if (!supabase) throw new Error('Supabase not initialized');
      if (!countryId) {
        setCities([]);
        return;
      }
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('country_id', countryId)
        .order('name', { ascending: true });
      if (error) throw error;
      setCities((data || []) as City[]);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de charger les villes.');
    }
  };

  React.useEffect(() => {
    void loadCountries();
  }, []);

  React.useEffect(() => {
    void loadCities();
  }, [countryId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCountries();
    await loadCities();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, searchQuery]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setModalVisible(true);
  };

  const openEdit = (c: City) => {
    setEditing(c);
    setName(c.name);
    setModalVisible(true);
  };

  const save = async () => {
    try {
      if (!supabase) throw new Error('Supabase not initialized');
      const n = name.trim();
      if (!countryId) {
        Alert.alert('Erreur', 'Choisissez un pays');
        return;
      }
      if (!n) {
        Alert.alert('Erreur', 'Le nom est requis');
        return;
      }

      if (editing) {
        const { error } = await supabase.from('cities').update({ name: n, country_id: countryId }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cities').insert({ name: n, country_id: countryId });
        if (error) throw error;
      }

      setModalVisible(false);
      await loadCities();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de sauvegarder.');
    }
  };

  const remove = async (city: City) => {
    Alert.alert('Supprimer', `Supprimer la ville "${city.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!supabase) throw new Error('Supabase not initialized');
            const { error } = await supabase.from('cities').delete().eq('id', city.id);
            if (error) throw error;
            await loadCities();
          } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Impossible de supprimer.');
          }
        },
      },
    ]);
  };

  const selectedCountry = countries.find((c) => c.id === countryId);

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />

      <View style={styles.header}>
        <Text style={styles.title}>Villes</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.countrySelector} onPress={() => setCountryPickerVisible(!countryPickerVisible)}>
        <Ionicons name="flag-outline" size={18} color={COLORS.textMuted} />
        <Text style={[styles.countryText, !selectedCountry && { color: COLORS.textMuted }]}>
          {selectedCountry ? `${selectedCountry.name} (${selectedCountry.code})` : 'Choisir un pays'}
        </Text>
        <Ionicons name={countryPickerVisible ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
      </TouchableOpacity>

      {countryPickerVisible && (
        <View style={styles.countryDropdown}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
            {countries.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.countryItem, countryId === c.id && styles.countryItemSelected]}
                onPress={() => {
                  setCountryId(c.id);
                  setCountryPickerVisible(false);
                }}
              >
                <Text style={styles.countryItemText}>{c.name} ({c.code})</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une ville..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: SPACING.xxxl }}
      >
        {filtered.map((c) => (
          <View key={c.id} style={styles.row}>
            <View style={styles.rowMain}>
              <View style={styles.rowIcon}>
                <Ionicons name="business-outline" size={18} color={COLORS.accent2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.name}</Text>
              </View>

              <TouchableOpacity onPress={() => openEdit(c)} style={styles.actionBtn}>
                <Ionicons name="create-outline" size={18} color={COLORS.textSoft} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(c)} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucune ville</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'Modifier la ville' : 'Ajouter une ville'}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Nom (ex: Libreville)"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={save}>
                <Text style={[styles.modalBtnText, { color: COLORS.white }]}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
    paddingTop: SPACING.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accent2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  countryText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: '700',
  },
  countryDropdown: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  countryItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  countryItemSelected: {
    backgroundColor: COLORS.accent + '10',
  },
  countryItemText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  row: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent2 + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalInput: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnGhost: {
    backgroundColor: 'transparent',
  },
  modalBtnPrimary: {
    backgroundColor: COLORS.accent2,
    borderColor: COLORS.accent2,
  },
  modalBtnText: {
    color: COLORS.text,
    fontWeight: '700',
  },
});

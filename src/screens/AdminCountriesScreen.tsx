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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { BackToDashboard } from '../components/BackToDashboard';
import { supabase } from '../lib/supabase';

type Country = {
  id: string;
  name: string;
  code: string;
  created_at?: string;
};

export const AdminCountriesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [countries, setCountries] = useState<Country[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const loadCountries = async () => {
    try {
      if (!supabase) throw new Error('Supabase not initialized');
      const { data, error } = await supabase.from('countries').select('*').order('name', { ascending: true });
      if (error) throw error;
      setCountries((data || []) as Country[]);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de charger les pays.');
    }
  };

  React.useEffect(() => {
    loadCountries();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCountries();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [countries, searchQuery]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCode('');
    setModalVisible(true);
  };

  const openEdit = (c: Country) => {
    setEditing(c);
    setName(c.name);
    setCode(c.code);
    setModalVisible(true);
  };

  const save = async () => {
    try {
      if (!supabase) throw new Error('Supabase not initialized');
      const n = name.trim();
      const c = code.trim().toUpperCase();
      if (!n) {
        Alert.alert('Erreur', 'Le nom est requis');
        return;
      }
      if (!c) {
        Alert.alert('Erreur', 'Le code est requis (ex: GA)');
        return;
      }

      if (editing) {
        const { error } = await supabase.from('countries').update({ name: n, code: c }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('countries').insert({ name: n, code: c });
        if (error) throw error;
      }

      setModalVisible(false);
      await loadCountries();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de sauvegarder.');
    }
  };

  const remove = async (country: Country) => {
    Alert.alert(
      'Supprimer',
      `Supprimer le pays "${country.name}" ? (Les villes liées seront supprimées)` ,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!supabase) throw new Error('Supabase not initialized');
              const { error } = await supabase.from('countries').delete().eq('id', country.id);
              if (error) throw error;
              await loadCountries();
            } catch (e: any) {
              Alert.alert('Erreur', e.message || 'Impossible de supprimer.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />

      <View style={styles.header}>
        <Text style={styles.title}>Pays</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un pays..."
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
            <TouchableOpacity
              style={styles.rowMain}
              onPress={() => navigation.navigate('AdminCities', { countryId: c.id })}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="flag-outline" size={18} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowSubtitle}>{c.code}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <View style={styles.rowActions}>
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
            <Text style={styles.emptyText}>Aucun pays</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'Modifier le pays' : 'Ajouter un pays'}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Nom (ex: Gabon)"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Code (ex: GA)"
              placeholderTextColor={COLORS.textMuted}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
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
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  rowSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
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
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  modalBtnText: {
    color: COLORS.text,
    fontWeight: '700',
  },
});

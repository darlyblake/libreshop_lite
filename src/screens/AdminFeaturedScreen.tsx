import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { Card } from '../components/Card';
import { BackToDashboard } from '../components/BackToDashboard';

interface FeaturedEntry {
  id: string;
  storeName: string;
  types: ('main' | 'promo' | 'sponsored')[];
  startDate: string;
  endDate: string;
  active: boolean;
}

export const AdminFeaturedScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<FeaturedEntry[]>([
    {
      id: '1',
      storeName: 'TechStore',
      types: ['main'],
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      active: true,
    },
    {
      id: '2',
      storeName: 'Fresh Market',
      types: ['promo', 'sponsored'],
      startDate: '2026-02-10',
      endDate: '2026-03-10',
      active: true,
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FeaturedEntry | null>(null);
  const [storeName, setStoreName] = useState('');
  const [types, setTypes] = useState<FeaturedEntry['types']>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (editing) {
      setStoreName(editing.storeName);
      setTypes(editing.types);
      setStartDate(editing.startDate);
      setEndDate(editing.endDate);
      setActive(editing.active);
    } else {
      setStoreName('');
      setTypes([]);
      setStartDate('');
      setEndDate('');
      setActive(true);
    }
  }, [editing]);

  const openModal = (entry?: FeaturedEntry) => {
    setEditing(entry || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const saveEntry = () => {
    if (!storeName.trim() || !startDate.trim() || !endDate.trim()) {
      Alert.alert('Erreur', 'Veuillez renseigner le nom de la boutique et les dates');
      return;
    }
    if (editing) {
      setEntries(entries.map(e => (e.id === editing.id ? { ...e, storeName, types, startDate, endDate, active } : e)));
    } else {
      const newEntry: FeaturedEntry = {
        id: String(Date.now()),
        storeName: storeName.trim(),
        types,
        startDate,
        endDate,
        active,
      };
      setEntries([newEntry, ...entries]);
    }
    closeModal();
  };

  const toggleType = (type: FeaturedEntry['types'][0]) => {
    if (types.includes(type)) {
      setTypes(types.filter(t => t !== type));
    } else {
      setTypes([...types, type]);
    }
  };

  const deleteEntry = (id: string) => {
    Alert.alert('Supprimer', 'Voulez-vous retirer cette mise en avant ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => setEntries(entries.filter(e => e.id !== id)),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      <View style={styles.header}>
        <Text style={styles.title}>Mise en avant</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: SPACING.lg }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.flexRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{item.storeName}</Text>
                <Text style={styles.dateText}>
                  {item.startDate} → {item.endDate}
                </Text>
                <Text style={styles.typesText}>{item.types.map(t => {
                  switch (t) {
                    case 'main': return 'Bannière principale';
                    case 'promo': return 'Promotion spéciale';
                    case 'sponsored': return 'Boutique sponsorisée';
                  }
                }).join(', ')}</Text>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={() => openModal(item)}>
                  <Ionicons name="create-outline" size={20} color={COLORS.accent} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteEntry(item.id)} style={{ marginLeft: SPACING.md }}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucune mise en avant configurée</Text>
          </View>
        )}
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Modifier' : 'Ajouter'} mise en avant</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                placeholder="Nom de la boutique"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={storeName}
                onChangeText={setStoreName}
              />
              <Text style={styles.subLabel}>Types</Text>
              <View style={styles.typesRow}>
                {['main', 'promo', 'sponsored'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeOption, types.includes(t as any) && styles.typeOptionSelected]}
                    onPress={() => toggleType(t as any)}
                  >
                    <Text style={[styles.typeOptionText, types.includes(t as any) && { color: COLORS.white }]}> 
                      {t === 'main' ? 'Bannière principale' : t === 'promo' ? 'Promotion spéciale' : 'Boutique sponsorisée'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                placeholder="Date de début (YYYY-MM-DD)"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
              />
              <TextInput
                placeholder="Date de fin (YYYY-MM-DD)"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
              />
              <View style={styles.activeRow}>
                <Text style={styles.activeLabel}>Active</Text>
                <Switch
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ false: COLORS.border, true: COLORS.accent + '60' }}
                  thumbColor={active ? COLORS.accent : COLORS.textMuted}
                />
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={saveEntry}>
                <Text style={styles.saveButtonText}>{editing ? 'Mettre à jour' : 'Créer'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    paddingTop: SPACING.xxl,
  },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: { marginBottom: SPACING.md, padding: SPACING.lg },
  flexRow: { flexDirection: 'row', alignItems: 'center' },
  storeName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  dateText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  typesText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  actionsRow: { flexDirection: 'row' },
  emptyState: { alignItems: 'center', padding: SPACING.xxxl },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { marginTop: SPACING.xxl, flex: 1, backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  modalBody: { padding: SPACING.lg },
  input: { backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, color: COLORS.text, marginBottom: SPACING.md },
  subLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  typesRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  typeOption: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  typeOptionSelected: { backgroundColor: COLORS.accent },
  typeOptionText: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  activeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, justifyContent: 'space-between' },
  activeLabel: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  saveButton: { backgroundColor: COLORS.accent, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  saveButtonText: { color: COLORS.white, fontSize: FONT_SIZE.md, fontWeight: '700' },
});

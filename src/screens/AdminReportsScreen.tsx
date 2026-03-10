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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { Card } from '../components/Card';
import { BackToDashboard } from '../components/BackToDashboard';

interface Report {
  id: string;
  reporterType: 'client' | 'vendor';
  reporterName: string;
  reportedEntity: string;
  problemType: string;
  status: 'open' | 'in review' | 'resolved';
  adminDecision: string;
}

export const AdminReportsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      reporterType: 'client',
      reporterName: 'Jean Dupont',
      reportedEntity: 'TechStore',
      problemType: 'Produit inexistant',
      status: 'open',
      adminDecision: '',
    },
    {
      id: '2',
      reporterType: 'vendor',
      reporterName: 'Amina',
      reportedEntity: 'Client 123',
      problemType: 'Comportement inapproprié',
      status: 'in review',
      adminDecision: '',
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Report | null>(null);
  const [decision, setDecision] = useState('');
  const [status, setStatus] = useState<Report['status']>('open');

  useEffect(() => {
    if (editing) {
      setDecision(editing.adminDecision);
      setStatus(editing.status);
    } else {
      setDecision('');
      setStatus('open');
    }
  }, [editing]);

  const openModal = (report: Report) => {
    setEditing(report);
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const saveReport = () => {
    if (!editing) return;
    setReports(
      reports.map(r =>
        r.id === editing.id ? { ...r, adminDecision: decision, status } : r
      )
    );
    closeModal();
  };

  const statusColor = (s: Report['status']) => {
    switch (s) {
      case 'open':
        return COLORS.warning;
      case 'in review':
        return COLORS.accent;
      case 'resolved':
        return COLORS.success;
    }
  };

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      <View style={styles.header}>
        <Text style={styles.title}>Signalements</Text>
      </View>

      <FlatList
        data={reports}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: SPACING.lg }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reporter}>
                  {item.reporterType === 'client' ? 'Client' : 'Vendeur'}: {item.reporterName}
                </Text>
                <Text style={styles.detail}>Cible: {item.reportedEntity}</Text>
                <Text style={styles.detail}>Problème: {item.problemType}</Text>
                <Text style={[styles.status, { color: statusColor(item.status) }]}>Statut: {item.status}</Text>
              </View>
              <TouchableOpacity onPress={() => openModal(item)}>
                <Ionicons name="create-outline" size={20} color={COLORS.accent} />
              </TouchableOpacity>
            </View>
          </Card>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucun signalement</Text>
          </View>
        )}
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Décision admin</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Statut</Text>
              {(['open', 'in review', 'resolved'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, status === s && styles.statusOptionSelected]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[styles.statusOptionText, status === s && { color: COLORS.white }]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.label}>Décision / commentaire</Text>
              <TextInput
                style={[styles.input, { height: 100 }]}
                multiline
                value={decision}
                onChangeText={setDecision}
                placeholder="Ajouter un commentaire ou une décision"
                placeholderTextColor={COLORS.textMuted}
              />

              <TouchableOpacity style={styles.saveButton} onPress={saveReport}>
                <Text style={styles.saveButtonText}>Enregistrer</Text>
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
  header: { paddingTop: SPACING.xxl, padding: SPACING.lg },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  card: { marginBottom: SPACING.md, padding: SPACING.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  reporter: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  detail: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  status: { fontSize: FONT_SIZE.sm, fontWeight: '600', marginTop: 4 },
  emptyState: { alignItems: 'center', padding: SPACING.xxxl },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { marginTop: SPACING.xxl, flex: 1, backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  modalBody: { padding: SPACING.lg },
  label: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm },
  statusOption: { padding: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
  statusOptionSelected: { backgroundColor: COLORS.accent },
  statusOptionText: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  input: { backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, color: COLORS.text, marginBottom: SPACING.md, textAlignVertical: 'top' },
  saveButton: { backgroundColor: COLORS.accent, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  saveButtonText: { color: COLORS.white, fontSize: FONT_SIZE.md, fontWeight: '700' },
});

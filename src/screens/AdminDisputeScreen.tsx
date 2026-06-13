import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { disputeService } from '../services/disputeService';
import { Dispute, DisputeStatus, DisputePriority } from '../types/dispute';

export default function AdminDisputeScreen() {
  const navigation = useNavigation();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [resolution, setResolution] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadDisputes = async () => {
    try {
      const data = await disputeService.getAll();
      setDisputes(data);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les litiges');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadDisputes(); }, []);

  const onRefresh = () => { setRefreshing(true); loadDisputes(); };

  const handleUpdateStatus = async (disputeId: string, status: DisputeStatus) => {
    Alert.alert('Confirmer', `Changer le statut à "${status}"?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          setUpdating(true);
          try {
            await disputeService.update(disputeId, { status });
            await loadDisputes();
            Alert.alert('Succès', 'Statut mis à jour');
          } catch (error) {
            Alert.alert('Erreur', 'Impossible de mettre à jour');
          } finally {
            setUpdating(false);
          }
        },
      },
    ]);
  };

  const handleSaveResolution = async () => {
    if (!selectedDispute || !resolution.trim()) return;
    setUpdating(true);
    try {
      await disputeService.update(selectedDispute.id, {
        status: 'resolved',
        resolution: resolution.trim(),
        resolution_date: new Date().toISOString(),
        admin_notes: adminNotes.trim() || undefined,
      });
      await loadDisputes();
      setSelectedDispute(null);
      setAdminNotes('');
      setResolution('');
      Alert.alert('Succès', 'Litige résolu');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de résoudre');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: DisputeStatus) => {
    switch (status) {
      case 'open': return COLORS.warning;
      case 'investigating': return COLORS.accent;
      case 'resolved': return COLORS.success;
      case 'rejected': return COLORS.danger;
      case 'closed': return COLORS.textMuted;
      default: return COLORS.textMuted;
    }
  };

  const getStatusFrench = (status: DisputeStatus) => {
    const map: Record<DisputeStatus, string> = {
      open: 'Ouvert',
      investigating: 'En cours',
      resolved: 'Résolu',
      rejected: 'Rejeté',
      closed: 'Clôturé',
    };
    return map[status] || status;
  };

  const getPriorityColor = (priority: DisputePriority) => {
    switch (priority) {
      case 'low': return COLORS.success;
      case 'medium': return COLORS.warning;
      case 'high': return COLORS.danger;
      case 'urgent': return '#FF0000';
      default: return COLORS.textMuted;
    }
  };

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      order: 'Commande',
      return: 'Retour',
      payment: 'Paiement',
      delivery: 'Livraison',
      product_quality: 'Qualité',
      other: 'Autre',
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (selectedDispute) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedDispute(null)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Détails du litige</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.disputeDetailHeader}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedDispute.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(selectedDispute.status) }]}>
                  {getStatusFrench(selectedDispute.status)}
                </Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedDispute.priority) + '20' }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(selectedDispute.priority) }]}>
                  {selectedDispute.priority.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.detailTitle}>{selectedDispute.title}</Text>
            <Text style={styles.detailDescription}>{selectedDispute.description}</Text>
            <Text style={styles.detailMeta}>Type: {getTypeLabel(selectedDispute.type)}</Text>
            <Text style={styles.detailMeta}>Date: {new Date(selectedDispute.created_at).toLocaleString('fr-FR')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.accent + '20' }]} onPress={() => handleUpdateStatus(selectedDispute.id, 'investigating')} disabled={updating}>
                <Text style={[styles.actionButtonText, { color: COLORS.accent }]}>Enquêter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.success + '20' }]} onPress={() => handleUpdateStatus(selectedDispute.id, 'resolved')} disabled={updating}>
                <Text style={[styles.actionButtonText, { color: COLORS.success }]}>Résoudre</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.danger + '20' }]} onPress={() => handleUpdateStatus(selectedDispute.id, 'rejected')} disabled={updating}>
                <Text style={[styles.actionButtonText, { color: COLORS.danger }]}>Rejeter</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes admin</Text>
            <TextInput style={styles.textInput} placeholder="Notes internes..." value={adminNotes} onChangeText={setAdminNotes} multiline numberOfLines={3} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Résolution</Text>
            <TextInput style={[styles.textInput, styles.textArea]} placeholder="Résolution..." value={resolution} onChangeText={setResolution} multiline numberOfLines={5} />
            <TouchableOpacity style={styles.submitButton} onPress={handleSaveResolution} disabled={updating || !resolution.trim()}>
              {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitButtonText}>Enregistrer</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des litiges</Text>
      </View>

      <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {disputes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
            <Text style={styles.emptyStateText}>Aucun litige</Text>
          </View>
        ) : (
          <View style={styles.disputeList}>
            {disputes.map(dispute => (
              <TouchableOpacity key={dispute.id} style={styles.disputeCard} onPress={() => setSelectedDispute(dispute)}>
                <View style={styles.disputeHeader}>
                  <Text style={styles.disputeType}>{getTypeLabel(dispute.type)}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(dispute.priority) + '20' }]}>
                    <Text style={[styles.priorityText, { color: getPriorityColor(dispute.priority) }]}>{dispute.priority.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.disputeTitle}>{dispute.title}</Text>
                <Text style={styles.disputeDescription} numberOfLines={2}>{dispute.description}</Text>
                <View style={styles.disputeMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(dispute.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(dispute.status) }]}>{getStatusFrench(dispute.status)}</Text>
                  </View>
                  <Text style={styles.disputeDate}>{new Date(dispute.created_at).toLocaleDateString('fr-FR')}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  scrollView: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { marginRight: SPACING.md },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  section: { margin: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  disputeList: { padding: SPACING.md },
  disputeCard: { padding: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  disputeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  disputeType: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  priorityBadge: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm },
  priorityText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  disputeTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  disputeDescription: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.sm },
  disputeMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  disputeDate: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  disputeDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  detailTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  detailDescription: { fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md },
  detailMeta: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.xs },
  actionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  actionButton: { flex: 1, minWidth: 100, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
  actionButtonText: { fontWeight: '600' },
  textInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.text, backgroundColor: COLORS.bg },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  submitButton: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.md },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
  emptyState: { padding: SPACING.xl, alignItems: 'center' },
  emptyStateText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, marginTop: SPACING.md },
});

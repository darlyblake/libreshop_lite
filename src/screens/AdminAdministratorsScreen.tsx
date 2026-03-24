import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { Card } from '../components/Card';
import { BackToDashboard } from '../components/BackToDashboard';

interface Administrator {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'super-admin' | 'support' | 'finance' | 'moderator';
  status: 'active' | 'inactive';
  joinDate: string;
  lastActivity: string;
}

interface ActivityLog {
  id: string;
  adminName: string;
  action: string;
  timestamp: string;
  details: string;
}

export const AdminAdministratorsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [filterRole, setFilterRole] = useState<'all' | 'super-admin' | 'support' | 'finance' | 'moderator'>('all');

  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'super-admin' | 'support' | 'finance' | 'moderator'>('support');
  const [editingAdmin, setEditingAdmin] = useState<Administrator | null>(null);

  const [administrators, setAdministrators] = useState<Administrator[]>([
    {
      id: '1',
      name: 'Kofi Mensah',
      email: 'kofi@libreshop.com',
      password: 'secret',
      role: 'super-admin',
      status: 'active',
      joinDate: '2025-01-15',
      lastActivity: '2026-02-27 10:30',
    },
    {
      id: '2',
      name: 'Ama Owusu',
      email: 'ama@libreshop.com',
      password: 'finance123',
      role: 'finance',
      status: 'active',
      joinDate: '2025-06-20',
      lastActivity: '2026-02-27 09:15',
    },
    {
      id: '3',
      name: 'Kwesi Boateng',
      email: 'kwesi@libreshop.com',
      password: 'support456',
      role: 'support',
      status: 'active',
      joinDate: '2025-08-10',
      lastActivity: '2026-02-26 16:45',
    },
    {
      id: '4',
      name: 'Yaw Adomako',
      email: 'yaw@libreshop.com',
      password: 'mod789',
      role: 'moderator',
      status: 'active',
      joinDate: '2025-09-05',
      lastActivity: '2026-02-27 11:20',
    },
    {
      id: '5',
      name: 'Akosua Mensah',
      email: 'akosua@libreshop.com',
      password: 'support789',
      role: 'support',
      status: 'inactive',
      joinDate: '2025-10-12',
      lastActivity: '2026-02-20 14:30',
    },
    {
      id: '6',
      name: 'Nana Sekyere',
      email: 'nana@libreshop.com',
      password: 'mod321',
      role: 'moderator',
      status: 'active',
      joinDate: '2025-11-01',
      lastActivity: '2026-02-27 08:00',
    },
    {
      id: '7',
      name: 'Araba Owusu',
      email: 'araba@libreshop.com',
      password: 'finance456',
      role: 'finance',
      status: 'active',
      joinDate: '2025-12-15',
      lastActivity: '2026-02-27 13:00',
    },
    {
      id: '8',
      name: 'Kwame Asare',
      email: 'kwame@libreshop.com',
      password: 'support123',
      role: 'support',
      status: 'active',
      joinDate: '2026-01-08',
      lastActivity: '2026-02-27 12:15',
    },
    {
      id: '9',
      name: 'Otuo Mensah',
      email: 'otuo@libreshop.com',
      password: 'support234',
      role: 'support',
      status: 'active',
      joinDate: '2026-01-20',
      lastActivity: '2026-02-27 15:30',
    },
    {
      id: '10',
      name: 'Adebayo Okonkwo',
      email: 'adebayo@libreshop.com',
      password: 'mod654',
      role: 'moderator',
      status: 'active',
      joinDate: '2026-02-01',
      lastActivity: '2026-02-27 10:45',
    },
    {
      id: '11',
      name: 'Chioma Nwankwo',
      email: 'chioma@libreshop.com',
      password: 'finance789',
      role: 'finance',
      status: 'active',
      joinDate: '2026-02-10',
      lastActivity: '2026-02-27 14:20',
    },
  ]);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([
    {
      id: '1',
      adminName: 'Kofi Mensah',
      action: 'Création de boutique',
      timestamp: '2026-02-27 10:30',
      details: 'Boutique "TechStore Benin" créée',
    },
    {
      id: '2',
      adminName: 'Ama Owusu',
      action: 'Validation de paiement',
      timestamp: '2026-02-27 09:15',
      details: 'Paiement de 49,990 FCFA validé pour "Fresh Market"',
    },
    {
      id: '3',
      adminName: 'Kwesi Boateng',
      action: 'Support client',
      timestamp: '2026-02-26 16:45',
      details: 'Ticket de support #3425 fermé',
    },
    {
      id: '4',
      adminName: 'Yaw Adomako',
      action: 'Suppression de contenu',
      timestamp: '2026-02-27 11:20',
      details: 'Produit "Contenu interdit" supprimé',
    },
    {
      id: '5',
      adminName: 'Araba Owusu',
      action: 'Rapport financier',
      timestamp: '2026-02-27 13:00',
      details: 'Rapport mensuel de février généré',
    },
  ]);

  const filteredAdministrators = useMemo(() => {
    return administrators.filter(admin => {
      const matchesSearch =
        admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = filterRole === 'all' || admin.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [administrators, searchQuery, filterRole]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super-admin':
        return COLORS.danger;
      case 'finance':
        return COLORS.accent;
      case 'support':
        return COLORS.info;
      case 'moderator':
        return COLORS.warning;
      default:
        return COLORS.textMuted;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super-admin':
        return 'Super Admin';
      case 'finance':
        return 'Finance';
      case 'support':
        return 'Support';
      case 'moderator':
        return 'Modérateur';
      default:
        return role;
    }
  };

  const openAddModal = () => {
    setEditingAdmin(null);
    setNewAdminName('');
    setNewAdminEmail('');
    setNewAdminPassword('');
    setNewAdminRole('support');
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setEditingAdmin(null);
  };

  const submitAdmin = () => {
    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs, y compris le mot de passe');
      return;
    }

    if (editingAdmin) {
      setAdministrators(
        administrators.map(a =>
          a.id === editingAdmin.id
            ? {
                ...a,
                name: newAdminName.trim(),
                email: newAdminEmail.trim(),
                role: newAdminRole,
                password: newAdminPassword,
              }
            : a
        )
      );
      Alert.alert('Succès', `${newAdminName} a été modifié`);
    } else {
      const newAdmin: Administrator = {
        id: String(Date.now()),
        name: newAdminName.trim(),
        email: newAdminEmail.trim(),
        password: newAdminPassword,
        role: newAdminRole,
        status: 'active',
        joinDate: new Date().toISOString().split('T')[0],
        lastActivity: new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString('fr-FR'),
      };
      setAdministrators([newAdmin, ...administrators]);

      // Log activity
      const log: ActivityLog = {
        id: String(Date.now()),
        adminName: 'System',
        action: 'Création d\'administrateur',
        timestamp: new Date().toLocaleString('fr-FR'),
        details: `Administrateur "${newAdminName}" créé avec le rôle ${getRoleLabel(newAdminRole)}`,
      };
      setActivityLogs([log, ...activityLogs]);
    }
    closeAddModal();
  };

  const deleteAdmin = (adminId: string) => {
    const admin = administrators.find(a => a.id === adminId);
    Alert.alert('Supprimer administrateur', `Êtes-vous sûr de vouloir supprimer ${admin?.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          setAdministrators(administrators.filter(a => a.id !== adminId));
          Alert.alert('Succès', `${admin?.name} a été supprimé`);
        },
      },
    ]);
  };

  const toggleStatus = (adminId: string) => {
    setAdministrators(
      administrators.map(a =>
        a.id === adminId ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' } : a
      )
    );
  };

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Ionicons name="people-outline" size={28} color={COLORS.accent} />
          <View style={styles.titleText}>
            <Text style={styles.headerTitleText}>Administrateurs</Text>
            <Text style={styles.headerSubtitle}>{administrators.length} admins</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Chercher par nom ou email..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['all', 'super-admin', 'finance', 'support', 'moderator'].map(role => (
            <TouchableOpacity
              key={role}
              style={[styles.filterChip, filterRole === role && styles.filterChipActive]}
              onPress={() => setFilterRole(role as any)}
            >
              <Text
                style={[styles.filterText, filterRole === role && styles.filterTextActive]}
              >
                {role === 'all' ? 'Tous' : getRoleLabel(role)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Administrators List */}
      <ScrollView
        style={styles.adminsList}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {filteredAdministrators.map(admin => (
          <Card key={admin.id} style={styles.adminCard}>
            <View style={styles.adminHeader}>
              <View style={[styles.avatar, { backgroundColor: getRoleColor(admin.role) + '20' }]}>
                <Ionicons name="person-circle-outline" size={32} color={getRoleColor(admin.role)} />
              </View>
              <View style={styles.adminInfo}>
                <Text style={styles.adminName}>{admin.name}</Text>
                <Text style={styles.adminEmail}>{admin.email}</Text>
                <Text style={styles.lastActivity}>Actif: {admin.lastActivity}</Text>
              </View>
              <TouchableOpacity
                style={[styles.statusBadge, { backgroundColor: admin.status === 'active' ? COLORS.success + '20' : COLORS.danger + '20' }]}
              >
                <Text style={[styles.statusText, { color: admin.status === 'active' ? COLORS.success : COLORS.danger }]}> 
                  {admin.status === 'active' ? '○ Actif' : '○ Inactif'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.roleSection}>
              <View style={[styles.roleTag, { backgroundColor: getRoleColor(admin.role) + '20' }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color={getRoleColor(admin.role)} />
                <Text style={[styles.roleTagText, { color: getRoleColor(admin.role) }]}> 
                  {getRoleLabel(admin.role)}
                </Text>
              </View>
              <Text style={styles.joinDate}>Depuis {admin.joinDate}</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleStatus(admin.id)}
              >
                <Ionicons name={admin.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'} size={18} color={COLORS.warning} />
                <Text style={styles.actionText}>{admin.status === 'active' ? 'Suspendre' : 'Activer'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setEditingAdmin(admin);
                  setNewAdminName(admin.name);
                  setNewAdminEmail(admin.email);
                  setNewAdminPassword(''); // do not prefill password
                  setNewAdminRole(admin.role);
                  setShowAddModal(true);
                }}
              >
                <Ionicons name="create-outline" size={18} color={COLORS.accent} />
                <Text style={styles.actionText}>Modifier</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => deleteAdmin(admin.id)}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                <Text style={styles.actionText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {filteredAdministrators.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucun administrateur trouvé</Text>
          </View>
        )}

        {/* Activity Log Section */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle}>Activité récente</Text>
            <TouchableOpacity onPress={() => setShowActivityModal(true)}>
              <Text style={styles.viewAllLink}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {activityLogs.slice(0, 3).map(log => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logIndicator} />
              <View style={styles.logContent}>
                <Text style={styles.logAction}>{log.action}</Text>
                <Text style={styles.logDetails}>{log.details}</Text>
                <Text style={styles.logTime}>{log.timestamp} • {log.adminName}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add/Edit Admin Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={closeAddModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAdmin ? 'Modifier admin' : 'Ajouter admin'}</Text>
              <TouchableOpacity onPress={closeAddModal}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                placeholder="Nom complet"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={newAdminName}
                onChangeText={setNewAdminName}
              />

              <TextInput
                placeholder="Email"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                keyboardType="email-address"
                value={newAdminEmail}
                onChangeText={setNewAdminEmail}
              />

              <TextInput
                placeholder={editingAdmin ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe"}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                secureTextEntry
                value={newAdminPassword}
                onChangeText={setNewAdminPassword}
              />

              <Text style={styles.roleLabel}>Rôle</Text>
              {(['super-admin', 'finance', 'support', 'moderator'] as const).map(role => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleOption, newAdminRole === role && styles.roleOptionSelected]}
                  onPress={() => setNewAdminRole(role)}
                >
                  <View
                    style={[
                      styles.roleRadio,
                      newAdminRole === role && styles.roleRadioSelected,
                    ]}
                  >
                    {newAdminRole === role && <View style={styles.roleRadioDot} />}
                  </View>
                  <Text style={styles.roleOptionText}>{getRoleLabel(role)}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.submitButton} onPress={submitAdmin}>
                <Text style={styles.submitButtonText}>{editingAdmin ? 'Mettre à jour' : 'Ajouter'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Activity Log Modal */}
      <Modal visible={showActivityModal} animationType="slide" transparent onRequestClose={() => setShowActivityModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Journal d'activité</Text>
              <TouchableOpacity onPress={() => setShowActivityModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={activityLogs}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.modalBody}
              renderItem={({ item }) => (
                <View style={styles.logItemFull}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logActionFull}>{item.action}</Text>
                    <Text style={styles.logTimeFull}>{item.timestamp}</Text>
                  </View>
                  <Text style={styles.logDetailsFull}>{item.details}</Text>
                  <Text style={styles.logAdminName}>Par: {item.adminName}</Text>
                </View>
              )}
            />
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  titleText: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  filterScroll: {
    marginBottom: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.text,
  },
  adminsList: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  adminCard: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  adminEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  lastActivity: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  roleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  roleTagText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  joinDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  activitySection: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  activityTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  viewAllLink: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  logItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginRight: SPACING.md,
    marginTop: 6,
  },
  logContent: {
    flex: 1,
  },
  logAction: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  logDetails: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  logTime: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    marginTop: SPACING.xxl,
    flex: 1,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalBody: {
    padding: SPACING.lg,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  roleLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  roleOptionSelected: {
    backgroundColor: COLORS.accent + '10',
  },
  roleRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  roleRadioSelected: {
    borderColor: COLORS.accent,
  },
  roleRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  roleOptionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  submitButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  submitButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  logItemFull: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  logActionFull: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  logTimeFull: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  logDetailsFull: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  logAdminName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});

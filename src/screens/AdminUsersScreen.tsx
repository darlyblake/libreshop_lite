import React, { useState, useMemo, useCallback } from 'react';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
  SlideInRight,
} from 'react-native-reanimated';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOWS } from '../config/theme';
import { RootStackParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'client' | 'seller' | 'admin';
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  last_login?: string;
  total_orders?: number;
  total_spent?: number;
  phone?: string;
  whatsapp_number?: string;
  avatar?: string;
}

type RoleFilter = 'all' | 'client' | 'seller' | 'admin';
type StatusFilter = 'all' | 'active' | 'suspended' | 'pending';

export const AdminUsersScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'orders'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [users, setUsers] = useState<User[]>([]);

  const loadUsers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id,email,full_name,role,status,created_at,phone,whatsapp_number,avatar_url')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(
        (data || []).map((u: any) => ({
          id: String(u.id),
          email: String(u.email || ''),
          full_name: String(u.full_name || ''),
          role: (u.role || 'client') as any,
          status: (u.status || 'active') as any,
          created_at: String(u.created_at || ''),
          phone: u.phone || undefined,
          whatsapp_number: u.whatsapp_number || undefined,
          avatar: u.avatar_url || undefined,
          total_orders: 0,
          total_spent: 0,
        }))
      );
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'load users');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('❌ Impossible de charger les utilisateurs');
      } else {
        Alert.alert('Erreur', 'Impossible de charger les utilisateurs');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  // Statistiques
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    pending: users.filter(u => u.status === 'pending').length,
    clients: users.filter(u => u.role === 'client').length,
    sellers: users.filter(u => u.role === 'seller').length,
    admins: users.filter(u => u.role === 'admin').length,
  }), [users]);

  // Filtrage et tri
  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const matchesSearch = user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             (user.phone && user.phone.includes(searchQuery));
        const matchesRole = selectedRole === 'all' || user.role === selectedRole;
        const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'name':
            comparison = a.full_name.localeCompare(b.full_name);
            break;
          case 'date':
            comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            break;
          case 'orders':
            comparison = (b.total_orders || 0) - (a.total_orders || 0);
            break;
        }
        return sortOrder === 'asc' ? -comparison : comparison;
      });
  }, [users, searchQuery, selectedRole, selectedStatus, sortBy, sortOrder]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUsers();
    } finally {
      setRefreshing(false);
    }
  }, [loadUsers]);

  const handleSuspendUser = (user: User) => {
    const nextStatus: User['status'] = user.status === 'active' ? 'suspended' : 'active';
    const title = user.status === 'active' ? 'Suspendre l\'utilisateur' : 'Réactiver l\'utilisateur';
    const message = `Êtes-vous sûr de vouloir ${user.status === 'active' ? 'suspendre' : 'réactiver'} ${user.full_name} ?`;

    const run = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('users')
          .update({ status: nextStatus })
          .eq('id', user.id)
          .select('id,status')
          .single();

        if (error) throw error;

        setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, status: (data as any)?.status || nextStatus } : u)));

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(`✅ Utilisateur ${nextStatus === 'suspended' ? 'suspendu' : 'réactivé'}`);
        } else {
          Alert.alert('Succès', `Utilisateur ${nextStatus === 'suspended' ? 'suspendu' : 'réactivé'}`);
        }
      } catch (e) {
        errorHandler.handleDatabaseError(e, 'suspend user');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('❌ Impossible de modifier le statut utilisateur');
        } else {
          Alert.alert('Erreur', 'Impossible de modifier le statut utilisateur');
        }
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm(message);
      if (ok) void run();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', style: 'destructive', onPress: () => void run() },
    ]);
  };

  const normalizeWhatsappNumber = (raw?: string): string | null => {
    if (!raw) return null;
    const digits = String(raw).replace(/[^0-9]/g, '');
    if (!digits) return null;
    return digits;
  };

  const openWhatsappChat = async (user: User) => {
    const normalized = normalizeWhatsappNumber(user.whatsapp_number || user.phone);
    if (!normalized) {
      const msg = `Aucun numéro WhatsApp enregistré pour ${user.full_name}.`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Numéro manquant', msg);
      }
      return;
    }

    const text = `Bonjour ${user.full_name}`;
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'open whatsapp');
      const msg = 'Impossible d’ouvrir WhatsApp.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`❌ ${msg}`);
      } else {
        Alert.alert('Erreur', msg);
      }
    }
  };

  const handleValidateSeller = (user: User) => {
    const message = `Voulez-vous valider ${user.full_name} en tant que vendeur ?`;

    const run = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('users')
          .update({ status: 'active', role: 'seller' })
          .eq('id', user.id)
          .select('id,status,role')
          .single();

        if (error) throw error;

        setUsers(prev =>
          prev.map(u =>
            u.id === user.id
              ? { ...u, status: (data as any)?.status || 'active', role: (data as any)?.role || 'seller' }
              : u
          )
        );

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('✅ Vendeur validé avec succès');
        } else {
          Alert.alert('Succès', 'Vendeur validé avec succès');
        }
      } catch (e) {
        errorHandler.handleDatabaseError(e, 'validate seller');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('❌ Impossible de valider le vendeur');
        } else {
          Alert.alert('Erreur', 'Impossible de valider le vendeur');
        }
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm(message);
      if (ok) void run();
      return;
    }

    Alert.alert('Valider le vendeur', message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Valider', onPress: () => void run() },
    ]);
  };

  const getRoleBadge = (role: User['role']) => {
    const badges = {
      admin: { label: 'Admin', variant: 'danger' as const, icon: 'shield' },
      seller: { label: 'Vendeur', variant: 'warning' as const, icon: 'storefront' },
      client: { label: 'Client', variant: 'accent' as const, icon: 'person' },
    };
    const config = badges[role];
    return (
      <Badge 
        label={config.label} 
        variant={config.variant}
        icon={config.icon}
      />
    );
  };

  const getStatusBadge = (status: User['status']) => {
    const badges = {
      active: { label: 'Actif', variant: 'success' as const, icon: 'checkmark-circle' },
      suspended: { label: 'Suspendu', variant: 'danger' as const, icon: 'ban' },
      pending: { label: 'En attente', variant: 'warning' as const, icon: 'time' },
    };
    const config = badges[status];
    return (
      <Badge 
        label={config.label} 
        variant={config.variant}
        icon={config.icon}
      />
    );
  };

  const renderUserCard = ({ item, index }: { item: User; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(400)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          setSelectedUser(item);
          setModalVisible(true);
        }}
      >
        <Card style={styles.userCard}>
          <View style={styles.userHeader}>
            <View style={styles.userInfo}>
              <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.role) }]}>
                <Text style={styles.avatarText}>{item.full_name.charAt(0)}</Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{item.full_name}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
                <View style={styles.userMeta}>
                  <Text style={styles.userDate}>
                    <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
                    {' '}{new Date(item.created_at).toLocaleDateString()}
                  </Text>
                  {item.last_login && (
                    <Text style={styles.userDate}>
                      <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
                      {' '}{item.last_login}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.badges}>
              {getRoleBadge(item.role)}
              {getStatusBadge(item.status)}
            </View>
          </View>

          {item.role === 'client' && item.total_orders !== undefined && (
            <View style={styles.userStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{item.total_orders}</Text>
                <Text style={styles.statLabel}>Commandes</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {(item.total_spent || 0).toLocaleString()} FCFA
                </Text>
                <Text style={styles.statLabel}>Dépensé</Text>
              </View>
            </View>
          )}

          <View style={styles.userActions}>
            <View style={styles.actionButtons}>
              {item.role === 'seller' && item.status === 'pending' && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.validateButton]}
                  onPress={() => handleValidateSeller(item)}
                >
                  <Ionicons name="checkmark" size={20} color={COLORS.text} />
                  <Text style={styles.validateText}>Valider</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={() => openWhatsappChat(item)}
              >
                <Ionicons name="chatbubble-outline" size={20} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={() => handleSuspendUser(item)}
              >
                <Ionicons 
                  name={item.status === 'active' ? 'ban-outline' : 'checkmark-circle-outline'} 
                  size={20} 
                  color={item.status === 'active' ? COLORS.danger : COLORS.success} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={() => {}}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );

  const getAvatarColor = (role: User['role']) => {
    switch (role) {
      case 'admin': return COLORS.danger;
      case 'seller': return COLORS.warning;
      default: return COLORS.accent;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeInDown} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des utilisateurs</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="download-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </Animated.View>

      {/* Stats Cards */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.statsContainer}
      >
        <Animated.View entering={SlideInRight.delay(100)} style={styles.statCard}>
          <Text style={styles.statCardValue}>{stats.total}</Text>
          <Text style={styles.statCardLabel}>Total</Text>
        </Animated.View>
        <Animated.View entering={SlideInRight.delay(200)} style={[styles.statCard, { backgroundColor: COLORS.success + '15' }]}>
          <Text style={[styles.statCardValue, { color: COLORS.success }]}>{stats.active}</Text>
          <Text style={styles.statCardLabel}>Actifs</Text>
        </Animated.View>
        <Animated.View entering={SlideInRight.delay(300)} style={[styles.statCard, { backgroundColor: COLORS.warning + '15' }]}>
          <Text style={[styles.statCardValue, { color: COLORS.warning }]}>{stats.pending}</Text>
          <Text style={styles.statCardLabel}>En attente</Text>
        </Animated.View>
        <Animated.View entering={SlideInRight.delay(400)} style={[styles.statCard, { backgroundColor: COLORS.danger + '15' }]}>
          <Text style={[styles.statCardValue, { color: COLORS.danger }]}>{stats.suspended}</Text>
          <Text style={styles.statCardLabel}>Suspendus</Text>
        </Animated.View>
      </ScrollView>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par nom, email ou téléphone..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Rôle:</Text>
            {(['all', 'client', 'seller', 'admin'] as const).map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.filterChip, selectedRole === role && styles.filterChipActive]}
                onPress={() => setSelectedRole(role)}
              >
                <Text style={[styles.filterChipText, selectedRole === role && styles.filterChipTextActive]}>
                  {role === 'all' ? 'Tous' : role === 'client' ? 'Clients' : role === 'seller' ? 'Vendeurs' : 'Admins'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Statut:</Text>
            {(['all', 'active', 'suspended', 'pending'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.filterChip, selectedStatus === status && styles.filterChipActive]}
                onPress={() => setSelectedStatus(status)}
              >
                <Text style={[styles.filterChipText, selectedStatus === status && styles.filterChipTextActive]}>
                  {status === 'all' ? 'Tous' : status === 'active' ? 'Actifs' : status === 'suspended' ? 'Suspendus' : 'En attente'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Sort */}
        <View style={styles.sortContainer}>
          <TouchableOpacity 
            style={styles.sortButton}
            onPress={() => {
              if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              else setSortBy('name');
            }}
          >
            <Ionicons 
              name={sortBy === 'name' ? `arrow-${sortOrder === 'asc' ? 'up' : 'down'}` : 'arrow-up'} 
              size={16} 
              color={sortBy === 'name' ? COLORS.accent : COLORS.textMuted} 
            />
            <Text style={[styles.sortText, sortBy === 'name' && styles.sortTextActive]}>Nom</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.sortButton}
            onPress={() => {
              if (sortBy === 'date') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              else setSortBy('date');
            }}
          >
            <Ionicons 
              name={sortBy === 'date' ? `arrow-${sortOrder === 'asc' ? 'up' : 'down'}` : 'arrow-up'} 
              size={16} 
              color={sortBy === 'date' ? COLORS.accent : COLORS.textMuted} 
            />
            <Text style={[styles.sortText, sortBy === 'date' && styles.sortTextActive]}>Date</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUserCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <Text style={styles.resultCount}>
            {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
          </Text>
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Aucun utilisateur"
            description="Aucun utilisateur ne correspond à vos critères"
            actionLabel="Réinitialiser les filtres"
            onAction={() => {
              setSearchQuery('');
              setSelectedRole('all');
              setSelectedStatus('all');
            }}
          />
        }
      />

      {/* User Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails de l'utilisateur</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalAvatar}>
                  <View style={[styles.avatarLarge, { backgroundColor: getAvatarColor(selectedUser.role) }]}>
                    <Text style={styles.avatarLargeText}>{selectedUser.full_name.charAt(0)}</Text>
                  </View>
                  <Text style={styles.modalUserName}>{selectedUser.full_name}</Text>
                  <View style={styles.modalBadges}>
                    {getRoleBadge(selectedUser.role)}
                    {getStatusBadge(selectedUser.status)}
                  </View>
                </View>

                <Card style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Informations</Text>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
                    <Text style={styles.modalInfoLabel}>Email:</Text>
                    <Text style={styles.modalInfoValue}>{selectedUser.email}</Text>
                  </View>
                  {selectedUser.phone && (
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="call-outline" size={20} color={COLORS.textMuted} />
                      <Text style={styles.modalInfoLabel}>Téléphone:</Text>
                      <Text style={styles.modalInfoValue}>{selectedUser.phone}</Text>
                    </View>
                  )}
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="calendar-outline" size={20} color={COLORS.textMuted} />
                    <Text style={styles.modalInfoLabel}>Inscrit le:</Text>
                    <Text style={styles.modalInfoValue}>
                      {new Date(selectedUser.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  {selectedUser.last_login && (
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="time-outline" size={20} color={COLORS.textMuted} />
                      <Text style={styles.modalInfoLabel}>Dernière connexion:</Text>
                      <Text style={styles.modalInfoValue}>{selectedUser.last_login}</Text>
                    </View>
                  )}
                </Card>

                {selectedUser.role === 'client' && (
                  <Card style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Statistiques</Text>
                    <View style={styles.modalStats}>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatValue}>{selectedUser.total_orders}</Text>
                        <Text style={styles.modalStatLabel}>Commandes</Text>
                      </View>
                      <View style={styles.modalStatDivider} />
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatValue}>
                          {(selectedUser.total_spent || 0).toLocaleString()} FCFA
                        </Text>
                        <Text style={styles.modalStatLabel}>Dépensé</Text>
                      </View>
                    </View>
                  </Card>
                )}

                <View style={styles.modalActions}>
                  <Button
                    title="Message"
                    variant="outline"
                    onPress={() => {}}
                    icon="chatbubble-outline"
                    style={styles.modalActionButton}
                  />
                  <Button
                    title={selectedUser.status === 'active' ? 'Suspendre' : 'Réactiver'}
                    variant={selectedUser.status === 'active' ? 'danger' : 'success'}
                    onPress={() => {
                      setModalVisible(false);
                      handleSuspendUser(selectedUser);
                    }}
                    icon={selectedUser.status === 'active' ? 'ban-outline' : 'checkmark-circle-outline'}
                    style={styles.modalActionButton}
                  />
                </View>
              </ScrollView>
            )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  statCard: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginRight: SPACING.sm,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statCardValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statCardLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  filtersSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  filterLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    marginRight: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterChipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.text,
  },
  sortContainer: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  sortTextActive: {
    color: COLORS.accent,
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  resultCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  userCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  userMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  userDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  badges: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  userStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginRight: SPACING.sm,
  },
  validateButton: {
    backgroundColor: COLORS.success,
  },
  validateText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalAvatar: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarLargeText: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalUserName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalBadges: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  modalSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalInfoLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginLeft: SPACING.sm,
    marginRight: SPACING.xs,
    width: 120,
  },
  modalInfoValue: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  modalStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  modalStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  modalStatDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  modalActionButton: {
    flex: 1,
  },
});
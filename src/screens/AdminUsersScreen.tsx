import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  ActivityIndicator,
  
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
import { adminService } from '../services/adminService';
import { contactStore } from '../services/contactService';

const { width, height } = Dimensions.get('window');

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
  is_merged?: boolean;
  merged_ids?: string[];
  order_details?: Array<{
    id: string;
    order_number: string;
    user_name?: string;
    total_amount: number;
    status: string;
    created_at: string;
    items: Array<{
      quantity: number;
      price: number;
      product_name: string;
      store_name: string;
    }>;
  }>;
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
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [menuUser, setMenuUser] = useState<User | null>(null);
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendUser, setSuspendUser] = useState<User | null>(null);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '' });
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [statsUser, setStatsUser] = useState<User | null>(null);
  const [statsStoreFilter, setStatsStoreFilter] = useState<string>('all');
  const [sellerStores, setSellerStores] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'orders'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(20);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE_SIZE = 20;

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setDisplayedCount(20);
    try {
      const data = await adminService.getUsers();

      setUsers(
        (data || []).map((u: any) => ({
          id: String(u.id),
          email: String(u.email || ''),
          full_name: String(u.full_name || u.email || 'Utilisateur'),
          role: (u.role || 'client') as any,
          status: (u.status || 'active') as any,
          created_at: String(u.created_at || ''),
          phone: u.phone || undefined,
          whatsapp_number: u.whatsapp_number || undefined,
          avatar: u.avatar_url || undefined,
          total_orders: u.total_orders || 0,
          total_spent: u.total_spent || 0,
          order_details: u.order_details || [],
        }))
      );
    } catch (e: any) {
      errorHandler.handleDatabaseError(e, 'load users');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('❌ Impossible de charger les utilisateurs');
      } else {
        Alert.alert('Erreur', 'Impossible de charger les utilisateurs');
      }
    } finally {
      setLoadingUsers(false);
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
    const allFiltered = users
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
    
    return allFiltered.slice(0, displayedCount);
  }, [users, searchQuery, selectedRole, selectedStatus, sortBy, sortOrder, displayedCount]);

  const totalFilteredCount = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (user.phone && user.phone.includes(searchQuery));
      const matchesRole = selectedRole === 'all' || user.role === selectedRole;
      const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
      return matchesSearch && matchesRole && matchesStatus;
    }).length;
  }, [users, searchQuery, selectedRole, selectedStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUsers();
    } finally {
      setRefreshing(false);
    }
  }, [loadUsers]);

  const loadMore = useCallback(() => {
    if (loadingMore || displayedCount >= totalFilteredCount) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + PAGE_SIZE, totalFilteredCount));
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, displayedCount, totalFilteredCount]);

  // Reset displayedCount when filters change
  const resetDisplayedCount = useCallback(() => {
    setDisplayedCount(20);
  }, []);

  const handleSyncRoles = async () => {
    const ok = window.confirm('Synchroniser les rôles des vendeurs ?');
    if (!ok) return;
    try {
      const result = await adminService.syncUserRolesWithStores();
      window.alert(`✅ ${result.updated} utilisateurs synchronisés`);
      await loadUsers();
    } catch (e: any) {
      window.alert('❌ Erreur');
    }
  };

  const handleMenuPress = (user: User, event: any) => {
    const { nativeEvent } = event;
    setMenuUser(user);
    setMenuPosition({ x: nativeEvent.pageX, y: nativeEvent.pageY });
    setMenuVisible(true);
  };

  const handleMenuClose = () => {
    setMenuVisible(false);
    setMenuUser(null);
    setMenuPosition(null);
  };

  const handleViewStores = (user: User) => {
    handleMenuClose();
    // Navigate to AdminStores filtered by this seller
    navigation.navigate('AdminStores' as never, { sellerId: user.id, sellerName: user.full_name } as never);
  };

  const handleViewOrders = (user: User) => {
    handleMenuClose();
    // Show seller's orders (not store-specific orders which are in AdminStores)
    setSelectedUser(user);
    setModalVisible(true);
  };

  const handleViewStats = async (user: User) => {
    handleMenuClose();
    setStatsUser(user);
    
    if (user.role === 'seller') {
      try {
        const stores = await adminService.getStoresWithDetails();
        const userStores = stores.filter((s: any) => s.ownerId === user.id);
        setSellerStores(userStores);
      } catch (e) {
        console.error('Error fetching seller stores:', e);
        setSellerStores([]);
      }
    } else {
      setSellerStores([]);
    }
    
    setStatsModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    handleMenuClose();
    setEditUser(user);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    try {
      await adminService.updateUserProfile(editUser.id, editForm);
      setEditModalVisible(false);
      setEditUser(null);
      await loadUsers();
      Alert.alert('Succès', 'Profil mis à jour avec succès');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le profil');
    }
  };

  useEffect(() => {
    if (!modalVisible) {
      setOrderSearchQuery('');
      setSelectedStoreFilter('all');
    }
  }, [modalVisible]);

  useEffect(() => {
    if (!statsModalVisible) {
      setStatsStoreFilter('all');
    }
  }, [statsModalVisible]);

  useEffect(() => {
    if (selectedUser) {
      setOrderSearchQuery('');
    }
  }, [selectedUser]);

  // Reset displayedCount when search, role, or status changes
  useEffect(() => {
    resetDisplayedCount();
  }, [searchQuery, selectedRole, selectedStatus, resetDisplayedCount]);

  const handleSuspendUser = (user: User) => {
    if (user.status === 'active') {
      setSuspendUser(user);
      setSuspendReason('');
      setSuspendModalVisible(true);
    } else {
      // Reactivate without reason
      const nextStatus: User['status'] = 'active';
      const title = 'Réactiver l\'utilisateur';
      const message = `Êtes-vous sûr de vouloir réactiver ${user.full_name} ?`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const ok = window.confirm(`${title}\n${message}`);
        if (!ok) return;
        adminService.updateUserStatus(user.id, nextStatus)
          .then(() => loadUsers())
          .catch(() => window.alert('Erreur'));
      } else {
        Alert.alert(title, message, [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer',
            onPress: async () => {
              try {
                await adminService.updateUserStatus(user.id, nextStatus);
                await loadUsers();
              } catch (e) {
                Alert.alert('Erreur', 'Impossible de modifier le statut');
              }
            }
          }
        ]);
      }
    }
  };

  const handleConfirmSuspension = async () => {
    if (!suspendUser || !suspendReason.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une raison de la suspension');
      return;
    }
    try {
      await adminService.updateUserStatus(suspendUser.id, 'suspended');
      await adminService.updateUserSuspensionReason(suspendUser.id, suspendReason);
      setSuspendModalVisible(false);
      setSuspendUser(null);
      setSuspendReason('');
      await loadUsers();
      Alert.alert('Succès', 'Utilisateur suspendu avec succès');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de suspendre l\'utilisateur');
    }
  };

  const groupOrdersByDate = (orders: User['order_details']) => {
    if (!orders) return {};
    
    let filteredOrders = orderSearchQuery
      ? orders.filter(order => 
          order.order_number.toLowerCase().includes(orderSearchQuery.toLowerCase())
        )
      : orders;

    // Filter by store if not 'all'
    if (selectedStoreFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order =>
        order.items.some(item => item.store_name === selectedStoreFilter)
      );
    }
    
    const grouped: Record<string, typeof orders> = {};
    filteredOrders.forEach(order => {
      const date = new Date(order.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(order);
    });
    
    return grouped;
  };

  const getUniqueStores = (orders: User['order_details']) => {
    if (!orders) return [];
    const stores = new Set<string>();
    
    // Only include stores that belong to this seller
    const sellerStoreNames = sellerStores.map((s: any) => s.name);
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.store_name && sellerStoreNames.includes(item.store_name)) {
          stores.add(item.store_name);
        }
      });
    });
    
    return Array.from(stores).sort();
  };

  const getFilteredOrders = (orders: User['order_details'], storeFilter: string) => {
    if (!orders) return [];
    
    // Filter orders to only include those from seller's stores
    const sellerStoreNames = sellerStores.map((s: any) => s.name);
    const sellerOrders = orders.filter(order =>
      order.items.some(item => sellerStoreNames.includes(item.store_name))
    );
    
    if (storeFilter === 'all') return sellerOrders;
    return sellerOrders.filter(order =>
      order.items.some(item => item.store_name === storeFilter)
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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

    try {
      contactStore({ rawPhone: normalized, message: text });
    } catch (e: any) {
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
      try {
        const data = await adminService.validateSeller(user.id);

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
      } catch (e: any) {
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
      admin: { label: 'Admin', variant: 'error' as const, icon: 'shield' },
      seller: { label: 'Vendeur', variant: 'warning' as const, icon: 'storefront' },
      client: { label: 'Client', variant: 'info' as const, icon: 'person' },
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
      suspended: { label: 'Suspendu', variant: 'error' as const, icon: 'ban' },
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
              {item.is_merged && (
                <View style={[styles.badge, styles.mergedBadge]}>
                  <Text style={styles.badgeText}>Fusionné</Text>
                </View>
              )}
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

          {item.order_details && item.order_details.length > 0 && (
            <View style={styles.orderDetailsSection}>
              <Text style={styles.orderDetailsTitle}>Dernières commandes</Text>
              {item.order_details.slice(0, 3).map((order) => (
                <View key={order.id} style={styles.orderItem}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderNumber}>#{order.order_number.slice(0, 8)}</Text>
                    <Text style={styles.orderAmount}>
                      {order.total_amount.toLocaleString()} FCFA
                    </Text>
                    <Text style={[
                      styles.orderStatus,
                      { color: order.status === 'completed' ? COLORS.success : COLORS.warning }
                    ]}>
                      {order.status === 'completed' ? 'Terminée' : order.status}
                    </Text>
                  </View>
                  <View style={styles.orderItems}>
                    {order.items.slice(0, 2).map((item, idx) => (
                      <Text key={idx} style={styles.orderItemText}>
                        • {item.quantity}x {item.product_name} ({item.store_name})
                      </Text>
                    ))}
                    {order.items.length > 2 && (
                      <Text style={styles.orderItemText}>+ {order.items.length - 2} autres</Text>
                    )}
                  </View>
                </View>
              ))}
              {item.order_details.length > 3 && (
                <TouchableOpacity onPress={() => { setSelectedUser(item); setModalVisible(true); }}>
                  <Text style={styles.viewAllOrders}>Voir toutes les commandes</Text>
                </TouchableOpacity>
              )}
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
                onPress={(e) => handleMenuPress(item, e)}
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
        <TouchableOpacity style={styles.filterButton} onPress={handleSyncRoles}>
          <Ionicons name="sync-outline" size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </Animated.View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
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
        </View>
      </View>

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
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <Text style={styles.resultCount}>
            {filteredUsers.length} / {totalFilteredCount} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
          </Text>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.loadingMoreText}>Chargement...</Text>
            </View>
          ) : null
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
                  {selectedUser.is_merged && (
                    <View style={styles.mergedInfo}>
                      <Ionicons name="information-circle" size={16} color={COLORS.warning} />
                      <Text style={styles.mergedInfoText}>
                        Ce compte fusionne {selectedUser.merged_ids?.length || 0} comptes avec le même numéro de téléphone
                      </Text>
                    </View>
                  )}
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

                {selectedUser.order_details && selectedUser.order_details.length > 0 && (
                  <Card style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Historique des commandes</Text>
                    
                    {/* Store Filter */}
                    {selectedUser.role === 'seller' && getUniqueStores(selectedUser.order_details).length > 1 && (
                      <View style={styles.storeFilterContainer}>
                        <Text style={styles.storeFilterLabel}>Filtrer par boutique:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeFilterScroll}>
                          <TouchableOpacity
                            style={[styles.storeFilterChip, selectedStoreFilter === 'all' && styles.storeFilterChipActive]}
                            onPress={() => setSelectedStoreFilter('all')}
                          >
                            <Text style={[styles.storeFilterChipText, selectedStoreFilter === 'all' && styles.storeFilterChipTextActive]}>
                              Toutes
                            </Text>
                          </TouchableOpacity>
                          {getUniqueStores(selectedUser.order_details).map((store) => (
                            <TouchableOpacity
                              key={store}
                              style={[styles.storeFilterChip, selectedStoreFilter === store && styles.storeFilterChipActive]}
                              onPress={() => setSelectedStoreFilter(store)}
                            >
                              <Text style={[styles.storeFilterChipText, selectedStoreFilter === store && styles.storeFilterChipTextActive]}>
                                {store}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Order Search Bar */}
                    <View style={styles.orderSearchContainer}>
                      <Ionicons name="search" size={20} color={COLORS.textMuted} />
                      <TextInput
                        style={styles.orderSearchInput}
                        placeholder="Rechercher par numéro..."
                        placeholderTextColor={COLORS.textMuted}
                        value={orderSearchQuery}
                        onChangeText={setOrderSearchQuery}
                      />
                    </View>
                    {Object.entries(groupOrdersByDate(selectedUser.order_details)).map(([date, orders]) => (
                      <View key={date} style={styles.orderDateGroup}>
                        <Text style={styles.orderDateLabel}>{date}</Text>
                        {orders.map((order) => (
                          <View key={order.id} style={styles.modalOrderItem}>
                            <View style={styles.modalOrderHeader}>
                              <Text style={styles.modalOrderNumber}>#{order.order_number.slice(0, 8)}</Text>
                              {selectedUser.role === 'seller' && order.user_name && (
                                <Text style={styles.modalOrderClient}>{order.user_name}</Text>
                              )}
                              <Text style={styles.modalOrderAmount}>{order.total_amount.toLocaleString()} FCFA</Text>
                              <Text style={[styles.modalOrderStatus, { color: order.status === 'completed' ? COLORS.success : COLORS.warning }]}>
                                {order.status === 'completed' ? 'Terminée' : order.status}
                              </Text>
                            </View>
                            <View style={styles.modalOrderItems}>
                              {order.items.map((item, idx) => (
                                <View key={idx} style={styles.modalOrderProduct}>
                                  <Text style={styles.modalOrderProductQty}>{item.quantity}x</Text>
                                  <Text style={styles.modalOrderProductName}>{item.product_name}</Text>
                                  <Text style={styles.modalOrderProductStore}>{item.store_name}</Text>
                                  <Text style={styles.modalOrderProductPrice}>{item.price.toLocaleString()} FCFA</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
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

      {/* Context Menu */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleMenuClose}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={handleMenuClose}
        >
          {menuPosition && menuUser && (
            <View
              style={[
                styles.menuContainer,
                {
                  left: Math.min(menuPosition.x, width - 200),
                  top: menuPosition.y + 10,
                  maxWidth: width - 32,
                  ...(menuPosition.y > height - 250 ? { top: menuPosition.y - 250 } : {}),
                }
              ]}
            >
              {menuUser.role === 'seller' && (
                <>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleViewStores(menuUser)}
                  >
                    <Ionicons name="storefront-outline" size={20} color={COLORS.text} />
                    <Text style={styles.menuItemText}>Gérer ses boutiques</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleViewOrders(menuUser)}
                  >
                    <Ionicons name="cart-outline" size={20} color={COLORS.text} />
                    <Text style={styles.menuItemText}>Historique commandes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleViewStats(menuUser)}
                  >
                    <Ionicons name="stats-chart-outline" size={20} color={COLORS.text} />
                    <Text style={styles.menuItemText}>Stats vendeur</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                </>
              )}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleEditUser(menuUser)}
              >
                <Ionicons name="create-outline" size={20} color={COLORS.text} />
                <Text style={styles.menuItemText}>Modifier le profil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  handleMenuClose();
                  handleSuspendUser(menuUser);
                }}
              >
                <Ionicons
                  name={menuUser.status === 'active' ? 'ban-outline' : 'checkmark-circle-outline'}
                  size={20}
                  color={menuUser.status === 'active' ? COLORS.danger : COLORS.success}
                />
                <Text style={[
                  styles.menuItemText,
                  { color: menuUser.status === 'active' ? COLORS.danger : COLORS.success }
                ]}>
                  {menuUser.status === 'active' ? 'Suspendre' : 'Réactiver'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* Suspension Reason Modal */}
      <Modal
        visible={suspendModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSuspendModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Suspendre l'utilisateur</Text>
              <TouchableOpacity onPress={() => setSuspendModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>Raison de la suspension</Text>
              <TextInput
                style={styles.suspendReasonInput}
                placeholder="Expliquez pourquoi vous suspendez cet utilisateur..."
                placeholderTextColor={COLORS.textMuted}
                value={suspendReason}
                onChangeText={setSuspendReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              
              <View style={styles.modalActions}>
                <Button
                  title="Annuler"
                  variant="outline"
                  onPress={() => setSuspendModalVisible(false)}
                  style={styles.modalActionButton}
                />
                <Button
                  title="Confirmer la suspension"
                  variant="danger"
                  onPress={handleConfirmSuspension}
                  style={styles.modalActionButton}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le profil</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.editFormSection}>
                <Text style={styles.editFormLabel}>Nom complet</Text>
                <TextInput
                  style={styles.editFormInput}
                  value={editForm.full_name}
                  onChangeText={(v) => setEditForm({ ...editForm, full_name: v })}
                  placeholder="Nom complet"
                />
              </View>

              <View style={styles.editFormSection}>
                <Text style={styles.editFormLabel}>Email</Text>
                <TextInput
                  style={styles.editFormInput}
                  value={editForm.email}
                  onChangeText={(v) => setEditForm({ ...editForm, email: v })}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.editFormSection}>
                <Text style={styles.editFormLabel}>Téléphone</Text>
                <TextInput
                  style={styles.editFormInput}
                  value={editForm.phone}
                  onChangeText={(v) => setEditForm({ ...editForm, phone: v })}
                  placeholder="Numéro de téléphone"
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.modalActions}>
                <Button
                  title="Annuler"
                  variant="outline"
                  onPress={() => setEditModalVisible(false)}
                  style={styles.modalActionButton}
                />
                <Button
                  title="Enregistrer"
                  onPress={handleSaveEdit}
                  style={styles.modalActionButton}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Seller Statistics Modal */}
      <Modal
        visible={statsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Statistiques vendeur</Text>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {statsUser && (
                <>
                  <Text style={styles.modalSectionTitle}>{statsUser.full_name}</Text>
                  
                  {statsUser.role === 'seller' && sellerStores.length === 0 ? (
                    <Card style={styles.modalSection}>
                      <Text style={styles.emptyStateText}>
                        Ce vendeur n'a pas encore de boutique.
                      </Text>
                    </Card>
                  ) : (
                    <>
                      {/* Store Filter for multi-store */}
                      {statsUser.role === 'seller' && getUniqueStores(statsUser.order_details).length > 1 && (
                        <View style={styles.storeFilterContainer}>
                          <Text style={styles.storeFilterLabel}>Filtrer par boutique:</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeFilterScroll}>
                            <TouchableOpacity
                              style={[styles.storeFilterChip, statsStoreFilter === 'all' && styles.storeFilterChipActive]}
                              onPress={() => setStatsStoreFilter('all')}
                            >
                              <Text style={[styles.storeFilterChipText, statsStoreFilter === 'all' && styles.storeFilterChipTextActive]}>
                                Toutes
                              </Text>
                            </TouchableOpacity>
                            {getUniqueStores(statsUser.order_details).map((store) => (
                              <TouchableOpacity
                                key={store}
                                style={[styles.storeFilterChip, statsStoreFilter === store && styles.storeFilterChipActive]}
                                onPress={() => setStatsStoreFilter(store)}
                              >
                                <Text style={[styles.storeFilterChipText, statsStoreFilter === store && styles.storeFilterChipTextActive]}>
                                  {store}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                      
                      <Card style={styles.statsCard}>
                        <View style={styles.statRow}>
                          <View style={styles.statItem}>
                            <Text style={styles.statValue}>{getFilteredOrders(statsUser.order_details, statsStoreFilter).length}</Text>
                            <Text style={styles.statLabel}>Commandes</Text>
                          </View>
                          <View style={styles.statDivider} />
                          <View style={styles.statItem}>
                            <Text style={styles.statValue}>{formatCurrency(getFilteredOrders(statsUser.order_details, statsStoreFilter).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0))}</Text>
                            <Text style={styles.statLabel}>Chiffre d'affaires</Text>
                          </View>
                        </View>
                      </Card>

                      {getFilteredOrders(statsUser.order_details, statsStoreFilter).length === 0 ? (
                        <Card style={styles.modalSection}>
                          <Text style={styles.emptyStateText}>
                            Aucune commande trouvée pour les boutiques de ce vendeur.
                          </Text>
                        </Card>
                      ) : (
                        <Card style={styles.modalSection}>
                          <Text style={styles.modalSectionTitle}>Dernières commandes</Text>
                          {getFilteredOrders(statsUser.order_details, statsStoreFilter).slice(0, 5).map((order) => (
                            <View key={order.id} style={styles.orderSummary}>
                              <View>
                                <Text style={styles.orderNumber}>#{order.order_number.slice(0, 8)}</Text>
                                <Text style={styles.orderDate}>
                                  {new Date(order.created_at).toLocaleDateString('fr-FR')}
                                </Text>
                              </View>
                              <Text style={styles.orderAmount}>{formatCurrency(order.total_amount)}</Text>
                            </View>
                          ))}
                        </Card>
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollView>
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
  filterButton: {
    padding: SPACING.sm,
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
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statCardValue: {
    fontSize: FONT_SIZE.lg,
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
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  loadingMoreText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
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
  orderDetailsSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  orderDetailsTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  orderItem: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  orderNumber: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.accent,
  },
  orderAmount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  orderStatus: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
  },
  orderItems: {
    gap: 2,
  },
  orderItemText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  viewAllOrders: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.25)',
    elevation: 5,
    paddingVertical: SPACING.xs,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  menuItemText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    flex: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  suspendReasonInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    minHeight: 120,
    marginBottom: SPACING.lg,
  },
  editFormSection: {
    marginBottom: SPACING.md,
  },
  editFormLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  editFormInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  statsCard: {
    marginBottom: SPACING.md,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  orderSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexWrap: 'wrap',
  },
  orderNumber: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.accent,
  },
  orderDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  orderAmount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyStateText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.md,
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
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    maxHeight: '90%',
    padding: SPACING.lg,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
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
  mergedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '15',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  mergedInfoText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    flex: 1,
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
  modalOrderItem: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  modalOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalOrderAmount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalOrderStatus: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  mergedBadge: {
    backgroundColor: COLORS.warning + '30',
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    color: COLORS.text,
  },
  modalOrderDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  modalOrderNumber: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.accent,
  },
  modalOrderClient: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    color: COLORS.text,
    marginLeft: SPACING.xs,
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
  orderSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  orderSearchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  storeFilterContainer: {
    marginBottom: SPACING.md,
  },
  storeFilterLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  storeFilterScroll: {
    flexDirection: 'row',
  },
  storeFilterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.xs,
  },
  storeFilterChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  storeFilterChipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
  },
  storeFilterChipTextActive: {
    color: COLORS.textInverse,
  },
  orderDateGroup: {
    marginBottom: SPACING.md,
  },
  orderDateLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  modalOrderItems: {
    gap: SPACING.xs,
  },
  modalOrderProduct: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  modalOrderProductQty: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.accent,
    minWidth: 30,
  },
  modalOrderProductName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    flex: 1,
  },
  modalOrderProductStore: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  modalOrderProductPrice: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalOrderNumber: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.accent,
  },
  modalOrderClient: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    color: COLORS.text,
    marginLeft: SPACING.xs,
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
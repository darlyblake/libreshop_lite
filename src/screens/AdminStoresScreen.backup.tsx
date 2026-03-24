import React, { useState, useMemo, useCallback } from 'react';
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
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolate,
  Layout,
  ZoomIn,
  FadeInLeft,
  SlideInRight,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ProgressBar } from '../components/ProgressBar';

const { width, height } = Dimensions.get('window');

const STATUS_FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'Actives', color: COLORS.success },
  { id: 'pending', label: 'En attente', color: COLORS.warning },
  { id: 'suspended', label: 'Suspendues', color: COLORS.danger },
];

interface Store {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string;
  category: string;
  status: 'active' | 'pending' | 'suspended' | 'blocked';
  products: number;
  revenue: number;
  joinedAt: string;
  lastActive: string;
  address?: string;
  city?: string;
  rating?: number;
  totalOrders?: number;
  description?: string;
  verified: boolean;
  featured: boolean;
  performance: { views: number; conversion: number; satisfaction: number };
  logo?: string;
  banner?: string;
  subscription?: {
    plan: 'basic' | 'pro' | 'premium';
    startDate: string;
    endDate: string;
    status: 'active' | 'expired' | 'cancelled';
    autoRenew: boolean;
    renewalHistory: Array<{ date: string; plan: string; duration: number }>;
  };
  productsList?: Array<{
    id: string;
    name: string;
    status: 'active' | 'inactive' | 'deleted';
    stock: number;
    price: number;
    createdAt: string;
  }>;
  orders?: Array<{
    id: string;
    orderNumber: string;
    status: 'pending' | 'completed' | 'cancelled';
    amount: number;
    date: string;
    buyerName: string;
  }>;
  topProducts?: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  statistics?: {
    totalSales: number;
    totalRevenue: number;
    totalVisits: number;
    conversionRate: number;
    avgOrder: number;
    repeatCustomers: number;
  };
}

type TabType = 'info' | 'subscription' | 'products' | 'orders' | 'stats';
type SubscriptionPlan = 'basic' | 'pro' | 'premium';
type SortField = 'name' | 'date' | 'products' | 'revenue' | 'rating' | 'views';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list' | 'table';

export const AdminStoresScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [selectedPlan, setSelectedPlan] = useState<string>('all');
  const [expiringSoon, setExpiringSoon] = useState<boolean>(false);

  // ────────────────────────────────────────────────
  // Simulation de données (tes boutiques originales)
  // ────────────────────────────────────────────────
  const [stores] = useState<Store[]>([
    {
      id: '1',
      name: 'Tech Store Paris',
      owner: 'Jean Dupont',
      email: 'jean@techstore.fr',
      phone: '+221 77 123 45 67',
      category: 'Électronique',
      status: 'active',
      products: 156,
      revenue: 2500000,
      joinedAt: '2024-01-15',
      lastActive: '2024-02-20',
      address: '15 Rue de Rivoli',
      city: 'Paris',
      rating: 4.5,
      totalOrders: 342,
      description: 'Magasin spécialisé en électronique high-tech',
      verified: true,
      featured: true,
      performance: { views: 15420, conversion: 12.5, satisfaction: 94 },
    },
    {
      id: '2',
      name: 'Fashion Dakar',
      owner: 'Marie Sarr',
      email: 'marie@fashion.sn',
      phone: '+221 76 987 65 43',
      category: 'Mode',
      status: 'active',
      products: 89,
      revenue: 1800000,
      joinedAt: '2024-01-20',
      lastActive: '2024-02-19',
      address: '15 Rue Mohamed V',
      city: 'Dakar',
      rating: 4.2,
      totalOrders: 156,
      description: 'Boutique de prêt-à-porter féminin et masculin',
      verified: true,
      featured: false,
      performance: { views: 8900, conversion: 8.3, satisfaction: 88 },
    },
    {
      id: '3',
      name: 'Bio Market',
      owner: 'Ibrahim Ba',
      email: 'ibrahim@biomarket.sn',
      phone: '+221 78 456 32 10',
      category: 'Alimentaire',
      status: 'pending',
      products: 45,
      revenue: 0,
      joinedAt: '2024-02-10',
      lastActive: '2024-02-18',
      address: '45 Avenue Bourguiba',
      city: 'Dakar',
      description: 'Produits biologiques et locaux',
      verified: false,
      featured: false,
      performance: { views: 2340, conversion: 0, satisfaction: 0 },
    },
    {
      id: '4',
      name: 'Sports Plus',
      owner: 'Ousmane Diop',
      email: 'ousmane@sportsplus.sn',
      phone: '+221 77 234 56 78',
      category: 'Sport',
      status: 'suspended',
      products: 67,
      revenue: 450000,
      joinedAt: '2023-12-01',
      lastActive: '2024-01-30',
      address: '8 Rue des Sports',
      city: 'Thiès',
      rating: 3.8,
      totalOrders: 89,
      description: 'Équipements sportifs et vêtements de sport',
      verified: true,
      featured: false,
      performance: { views: 5600, conversion: 5.2, satisfaction: 76 },
    },
    {
      id: '5',
      name: 'Maison & Déco',
      owner: 'Fatou Ndiaye',
      email: 'fatou@maisondeco.sn',
      phone: '+221 78 111 22 33',
      category: 'Maison',
      status: 'pending',
      products: 112,
      revenue: 0,
      joinedAt: '2024-02-15',
      lastActive: '2024-02-17',
      city: 'Dakar',
      description: 'Décoration intérieure et mobilier',
      verified: false,
      featured: false,
      performance: { views: 1800, conversion: 0, satisfaction: 0 },
    },
    {
      id: '6',
      name: 'Librairie Papyrus',
      owner: 'Amadou Diallo',
      email: 'contact@papyrus.sn',
      phone: '+221 77 555 66 77',
      category: 'Librairie',
      status: 'active',
      products: 450,
      revenue: 380000,
      joinedAt: '2023-11-05',
      lastActive: '2024-02-20',
      address: '22 Rue Victor Hugo',
      city: 'Dakar',
      rating: 4.8,
      totalOrders: 567,
      description: 'Librairie générale et fournitures scolaires',
      verified: true,
      featured: true,
      performance: { views: 23400, conversion: 15.8, satisfaction: 96 },
    },
  ]);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(scrollY.value, [0, 100], [140, 90], Extrapolate.CLAMP);
    const opacity = interpolate(scrollY.value, [0, 100], [1, 0.92], Extrapolate.CLAMP);
    return {
      height,
      opacity,
    };
  });

  const stats = useMemo(() => {
    const total = stores.length;
    const active = stores.filter(s => s.status === 'active').length;
    const pending = stores.filter(s => s.status === 'pending').length;
    const suspended = stores.filter(s => s.status === 'suspended').length;

    return { total, active, pending, suspended };
  }, [stores]);

  const filteredStores = useMemo(() => {
    let result = stores;

    if (selectedStatus !== 'all') {
      result = result.filter(s => s.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.owner.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.city && s.city.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => {
      if (sortField === 'date') return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
      if (sortField === 'revenue') return b.revenue - a.revenue;
      if (sortField === 'products') return b.products - a.products;
      if (sortField === 'views') return b.performance.views - a.performance.views;
      if (sortField === 'rating') return (b.rating || 0) - (a.rating || 0);
      return a.name.localeCompare(b.name);
    });
  }, [stores, searchQuery, selectedStatus, sortField]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return COLORS.success;
      case 'pending': return COLORS.warning;
      case 'suspended': return COLORS.danger;
      default: return COLORS.gray;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'pending': return 'En attente';
      case 'suspended': return 'Suspendu';
      default: return status;
    }
  };

  const toggleStoreSelection = (id: string) => {
    setSelectedStores(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBatchAction = (action: 'approve' | 'suspend' | 'delete') => {
    if (selectedStores.length === 0) return;
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} ${selectedStores.length} boutique${selectedStores.length > 1 ? 's' : ''}`,
      `Confirmer l'action ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: action === 'delete' ? 'destructive' : 'default',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSelectionMode(false);
            setSelectedStores([]);
          },
        },
      ]
    );
  };

  const renderStoreGrid = ({ item, index }: { item: Store; index: number }) => (
    <Animated.View
      key={item.id}
      entering={ZoomIn.delay(index * 50).duration(320)}
      layout={Layout.springify()}
      style={styles.gridItem}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          if (selectionMode) toggleStoreSelection(item.id);
          else { setSelectedStore(item); setModalVisible(true); }
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setSelectionMode(true);
          toggleStoreSelection(item.id);
        }}
        delayLongPress={180}
      >
        <Card style={styles.gridCard}>
          {selectionMode && (
            <View style={[
              styles.selectionOverlay,
              selectedStores.includes(item.id) && styles.selectedOverlayActive
            ]}>
              {selectedStores.includes(item.id) && (
                <Ionicons name="checkmark-circle" size={32} color={COLORS.text} />
              )}
            </View>
          )}

          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />

          <View style={styles.gridHeader}>
            <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.gridBadges}>
              {item.verified && <Badge label="Vérifié" variant="success" size="small" />}
              {item.featured && <Badge label="En avant" variant="warning" size="small" />}
            </View>
          </View>

          <Text style={styles.gridOwner}>{item.owner}</Text>

          <View style={styles.gridStats}>
            <View style={styles.gridStat}>
              <Ionicons name="cube-outline" size={16} color={COLORS.textSoft} />
              <Text style={styles.gridStatValue}>{item.products}</Text>
              <Text style={styles.gridStatLabel}>produits</Text>
            </View>
            <View style={styles.gridStat}>
              <Ionicons name="cash-outline" size={16} color={COLORS.textSoft} />
              <Text style={styles.gridStatValue}>{(item.revenue / 1000000).toFixed(1)}M</Text>
              <Text style={styles.gridStatLabel}>FCFA</Text>
            </View>
          </View>

          <View style={styles.gridFooter}>
            <Text style={styles.gridCategory}>{item.category}</Text>
            <Text style={styles.gridCity}>{item.city || '—'}</Text>
          </View>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStoreList = ({ item, index }: { item: Store; index: number }) => (
    <Animated.View
      key={item.id}
      entering={FadeInLeft.delay(index * 60).duration(340)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (selectionMode) toggleStoreSelection(item.id);
          else { setSelectedStore(item); setModalVisible(true); }
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setSelectionMode(true);
          toggleStoreSelection(item.id);
        }}
      >
        <Card style={styles.listCard}>
          {selectionMode && (
            <View style={[
              styles.selectionIndicator,
              selectedStores.includes(item.id) && styles.selectionIndicatorActive
            ]}>
              {selectedStores.includes(item.id) && (
                <Ionicons name="checkmark" size={20} color={COLORS.text} />
              )}
            </View>
          )}

          <View style={styles.listHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Ionicons name="storefront" size={28} color={getStatusColor(item.status)} />
            </View>

            <View style={styles.listInfo}>
              <View style={styles.listNameRow}>
                <Text style={styles.listName}>{item.name}</Text>
                {item.verified && <Ionicons name="checkmark-circle" size={18} color={COLORS.info} style={{ marginLeft: 6 }} />}
                {item.featured && <Ionicons name="star" size={18} color={COLORS.warning} style={{ marginLeft: 6 }} />}
              </View>
              <Text style={styles.listOwner}>{item.owner}</Text>
            </View>

            <Badge
              label={getStatusLabel(item.status)}
              variant={item.status === 'active' ? 'success' : item.status === 'pending' ? 'warning' : 'danger'}
              size="medium"
            />
          </View>

          <View style={styles.listMetrics}>
            <View style={styles.metricItem}>
              <Ionicons name="cube-outline" size={18} color={COLORS.textSoft} />
              <Text style={styles.metricValue}>{item.products}</Text>
              <Text style={styles.metricLabel}>produits</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="cash-outline" size={18} color={COLORS.textSoft} />
              <Text style={styles.metricValue}>{(item.revenue / 1000000).toFixed(1)}M</Text>
              <Text style={styles.metricLabel}>FCFA</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="eye-outline" size={18} color={COLORS.textSoft} />
              <Text style={styles.metricValue}>{item.performance.views.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>visites</Text>
            </View>
          </View>

          <View style={styles.listActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('StoreDetail', { storeId: item.id })}>
              <Ionicons name="eye-outline" size={20} color={COLORS.accent} />
              <Text style={styles.actionText}>Voir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="mail-outline" size={20} color={COLORS.accent} />
              <Text style={styles.actionText}>Contacter</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStoreTable = ({ item, index }: { item: Store; index: number }) => (
    <Animated.View
      key={item.id}
      entering={FadeInLeft.delay(index * 40).duration(300)}
      layout={Layout.springify()}
      style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          if (selectionMode) toggleStoreSelection(item.id);
          else { setSelectedStore(item); setModalVisible(true); }
        }}
        style={styles.tableRowContent}
      >
        {selectionMode && (
          <View style={[
            styles.tableCheckbox,
            selectedStores.includes(item.id) && styles.tableCheckboxActive
          ]}>
            {selectedStores.includes(item.id) && (
              <Ionicons name="checkmark" size={14} color={COLORS.text} />
            )}
          </View>
        )}

        <View style={styles.tableColName}>
          <View style={styles.tableNameContent}>
            <View style={[
              styles.tableSortDot,
              { backgroundColor: getStatusColor(item.status) }
            ]} />
            <View style={styles.tableStoreInfo}>
              <Text style={styles.tableStoreName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.tableStoreOwner} numberOfLines={1}>{item.owner}</Text>
            </View>
          </View>
          {item.verified && <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} />}
        </View>

        <View style={styles.tableColViews}>
          <Ionicons name="eye-outline" size={16} color={COLORS.accent} />
          <Text style={styles.tableValue}>{item.performance.views.toLocaleString()}</Text>
        </View>

        <View style={styles.tableColProduct}>
          <Text style={styles.tableValue}>{item.products}</Text>
          <Text style={styles.tableLabel}>pdt</Text>
        </View>

        <View style={styles.tableColRevenue}>
          <Text style={[styles.tableValue, { color: COLORS.success }]}>
            {(item.revenue / 1000000).toFixed(1)}M
          </Text>
        </View>

        <View style={styles.tableColStatus}>
          <View style={[
            styles.tableStatusBadge,
            { backgroundColor: getStatusColor(item.status) + '25' }
          ]}>
            <Text style={[
              styles.tableStatusText,
              { color: getStatusColor(item.status) }
            ]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.tableRating}
          onPress={() => { setSelectedStore(item); setModalVisible(true); }}
        >
          {item.rating ? (
            <>
              <Ionicons name="star" size={14} color={COLORS.warning} />
              <Text style={styles.tableRatingValue}>{item.rating}</Text>
            </>
          ) : (
            <Text style={styles.tableRatingEmpty}>—</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View style={styles.container}>
        {/* Header */}
        <Animated.View style={[styles.header, headerAnimatedStyle]}>
          <LinearGradient colors={['#111827', '#1f2937']} style={styles.headerGradient}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Boutiques</Text>
              <View style={styles.viewModeSwitcher}>
                <TouchableOpacity
                  style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
                  onPress={() => setViewMode('grid')}
                >
                  <Ionicons name="grid" size={20} color={viewMode === 'grid' ? 'white' : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
                  onPress={() => setViewMode('list')}
                >
                  <Ionicons name="list" size={20} color={viewMode === 'list' ? 'white' : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewModeBtn, viewMode === 'table' && styles.viewModeBtnActive]}
                  onPress={() => setViewMode('table')}
                >
                  <Ionicons name="document-text" size={20} color={viewMode === 'table' ? 'white' : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChipsContainer}>
              {STATUS_FILTERS.map(f => {
                const active = selectedStatus === f.id;
                const count = f.id === 'all' ? stats.total :
                              f.id === 'active' ? stats.active :
                              f.id === 'pending' ? stats.pending : stats.suspended;

                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.statusChip, active && { backgroundColor: f.color || 'COLORS.categoryColors[5]' }]}
                    onPress={() => setSelectedStatus(f.id)}
                  >
                    <Text style={[styles.statusChipText, active && { color: COLORS.text }]}>
                      {f.label} {count > 0 && `(${count})`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </LinearGradient>
        </Animated.View>

        {/* Recherche */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={22} color={COLORS.textSoft} style={{ marginRight: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une boutique..."
              placeholderTextColor={COLORS.textSoft}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={24} color={COLORS.textSoft} />
              </TouchableOpacity>
            )}
          </View>

          {(selectedStatus !== 'all' || searchQuery) && (
            <Text style={styles.activeFilterText}>
              Filtré : {selectedStatus !== 'all' ? getStatusLabel(selectedStatus) : ''} {searchQuery ? `"${searchQuery}"` : ''}
            </Text>
          )}
        </View>

        {/* Liste */}
        <Animated.ScrollView
          style={{ flex: 1 }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTimeout(() => setRefreshing(false), 1500);
              }}
              colors={[COLORS.accent || 'COLORS.categoryColors[5]']}
            />
          }
        >
          {viewMode === 'grid' ? (
            <View style={styles.gridContainer}>
              {filteredStores.map((store, index) => renderStoreGrid({ item: store, index }))}
            </View>
          ) : viewMode === 'table' ? (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <View style={styles.tableColNameHeader}>
                  <Text style={styles.tableHeaderText}>Boutique</Text>
                </View>
                <View style={styles.tableColViewsHeader}>
                  <Text style={styles.tableHeaderText}>Visites</Text>
                </View>
                <View style={styles.tableColProductHeader}>
                  <Text style={styles.tableHeaderText}>Pdt</Text>
                </View>
                <View style={styles.tableColRevenueHeader}>
                  <Text style={styles.tableHeaderText}>Revenu</Text>
                </View>
                <View style={styles.tableColStatusHeader}>
                  <Text style={styles.tableHeaderText}>Statut</Text>
                </View>
                <View style={styles.tableColRatingHeader}>
                  <Text style={styles.tableHeaderText}>⭐</Text>
                </View>
              </View>
              {filteredStores.map((store, index) => renderStoreTable({ item: store, index }))}
            </View>
          ) : (
            <View style={styles.listContainer}>
              {filteredStores.map((store, index) => renderStoreList({ item: store, index }))}
            </View>
          )}

          {filteredStores.length === 0 && (
            <EmptyState
              icon="storefront-outline"
              title="Aucune boutique trouvée"
              description="Essayez de modifier les filtres ou la recherche"
              actionLabel="Réinitialiser"
              onAction={() => {
                setSearchQuery('');
                setSelectedStatus('all');
              }}
            />
          )}

          <View style={{ height: 100 }} />
        </Animated.ScrollView>

        {/* Barre flottante sélection */}
        {selectionMode && (
          <Animated.View entering={SlideInRight} style={styles.floatingBar}>
            <Text style={styles.floatingCount}>
              {selectedStores.length} sélectionné{selectedStores.length > 1 ? 's' : ''}
            </Text>

            <View style={styles.floatingActions}>
              <TouchableOpacity style={[styles.fabBtn, { backgroundColor: COLORS.success + '30' }]}>
                <Ionicons name="checkmark" size={24} color={COLORS.success} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fabBtn, { backgroundColor: COLORS.warning + '30' }]}>
                <Ionicons name="pause" size={24} color={COLORS.warning} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fabBtn, { backgroundColor: COLORS.danger + '30' }]}>
                <Ionicons name="trash" size={24} color={COLORS.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fabBtn, { backgroundColor: 'COLORS.danger' }]}
                onPress={() => {
                  setSelectionMode(false);
                  setSelectedStores([]);
                }}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Modal Détails Boutique */}
        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
          <BlurView intensity={90} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedStore && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <Ionicons name="close" size={28} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>{selectedStore.name}</Text>
                    <View style={{ width: 28 }} />
                  </View>

                  {/* Status + Badges */}
                  <View style={styles.modalStatusRow}>
                    <View style={[
                      styles.modalStatusBadge,
                      { backgroundColor: getStatusColor(selectedStore.status) + '20' }
                    ]}>
                      <View style={[
                        styles.modalStatusDot,
                        { backgroundColor: getStatusColor(selectedStore.status) }
                      ]} />
                      <Text style={[
                        styles.modalStatusLabel,
                        { color: getStatusColor(selectedStore.status) }
                      ]}>
                        {getStatusLabel(selectedStore.status)}
                      </Text>
                    </View>

                    <View style={styles.modalBadgesRow}>
                      {selectedStore.verified && (
                        <View style={styles.modalBadgeItem}>
                          <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                          <Text style={styles.modalBadgeText}>Vérifié</Text>
                        </View>
                      )}
                      {selectedStore.featured && (
                        <View style={styles.modalBadgeItem}>
                          <Ionicons name="star" size={18} color={COLORS.warning} />
                          <Text style={styles.modalBadgeText}>En avant</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Info Section */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Informations</Text>
                    <View style={styles.modalInfoItem}>
                      <Ionicons name="person-outline" size={20} color={COLORS.accent} />
                      <View style={styles.modalInfoContent}>
                        <Text style={styles.modalInfoLabel}>Propriétaire</Text>
                        <Text style={styles.modalInfoValue}>{selectedStore.owner}</Text>
                      </View>
                    </View>

                    <View style={styles.modalInfoItem}>
                      <Ionicons name="mail-outline" size={20} color={COLORS.accent} />
                      <View style={styles.modalInfoContent}>
                        <Text style={styles.modalInfoLabel}>Email</Text>
                        <Text style={styles.modalInfoValue}>{selectedStore.email}</Text>
                      </View>
                    </View>

                    <View style={styles.modalInfoItem}>
                      <Ionicons name="call-outline" size={20} color={COLORS.accent} />
                      <View style={styles.modalInfoContent}>
                        <Text style={styles.modalInfoLabel}>Téléphone</Text>
                        <Text style={styles.modalInfoValue}>{selectedStore.phone}</Text>
                      </View>
                    </View>

                    <View style={styles.modalInfoItem}>
                      <Ionicons name="location-outline" size={20} color={COLORS.accent} />
                      <View style={styles.modalInfoContent}>
                        <Text style={styles.modalInfoLabel}>Localisation</Text>
                        <Text style={styles.modalInfoValue}>
                          {selectedStore.address ? `${selectedStore.address}, ${selectedStore.city}` : selectedStore.city || '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.modalInfoItem}>
                      <Ionicons name="pricetag-outline" size={20} color={COLORS.accent} />
                      <View style={styles.modalInfoContent}>
                        <Text style={styles.modalInfoLabel}>Catégorie</Text>
                        <Text style={styles.modalInfoValue}>{selectedStore.category}</Text>
                      </View>
                    </View>

                    {selectedStore.description && (
                      <View style={styles.modalDescSection}>
                        <Text style={styles.modalDescTitle}>Description</Text>
                        <Text style={styles.modalDescText}>{selectedStore.description}</Text>
                      </View>
                    )}
                  </View>

                  {/* Stats Section */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Statistiques</Text>
                    <View style={styles.modalStatsGrid}>
                      <View style={styles.modalStatCard}>
                        <View style={styles.modalStatIconBox}>
                          <Ionicons name="cube-outline" size={24} color={COLORS.accent} />
                        </View>
                        <Text style={styles.modalStatValue}>{selectedStore.products}</Text>
                        <Text style={styles.modalStatLabel}>Produits</Text>
                      </View>

                      <View style={styles.modalStatCard}>
                        <View style={styles.modalStatIconBox}>
                          <Ionicons name="cash-outline" size={24} color={COLORS.success} />
                        </View>
                        <Text style={styles.modalStatValue}>{(selectedStore.revenue / 1000000).toFixed(2)}M</Text>
                        <Text style={styles.modalStatLabel}>FCFA</Text>
                      </View>

                      <View style={styles.modalStatCard}>
                        <View style={styles.modalStatIconBox}>
                          <Ionicons name="eye-outline" size={24} color={COLORS.warning} />
                        </View>
                        <Text style={styles.modalStatValue}>{selectedStore.performance.views.toLocaleString()}</Text>
                        <Text style={styles.modalStatLabel}>Visites</Text>
                      </View>

                      <View style={styles.modalStatCard}>
                        <View style={styles.modalStatIconBox}>
                          <Ionicons name="star-outline" size={24} color={COLORS.warning} />
                        </View>
                        <Text style={styles.modalStatValue}>{selectedStore.rating ? selectedStore.rating.toFixed(1) : '—'}</Text>
                        <Text style={styles.modalStatLabel}>Note</Text>
                      </View>
                    </View>
                  </View>

                  {/* Performance Section */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Performance</Text>
                    <View style={styles.modalPerformanceItem}>
                      <View style={styles.modalPerfLabel}>
                        <Text style={styles.modalPerfName}>Taux de conversion</Text>
                        <Text style={styles.modalPerfValue}>{selectedStore.performance.conversion.toFixed(1)}%</Text>
                      </View>
                      <View style={styles.modalProgressBar}>
                        <ProgressBar
                          progress={selectedStore.performance.conversion / 100}
                          color={COLORS.accent}
                          height={6}
                        />
                      </View>
                    </View>

                    <View style={styles.modalPerformanceItem}>
                      <View style={styles.modalPerfLabel}>
                        <Text style={styles.modalPerfName}>Satisfaction clients</Text>
                        <Text style={styles.modalPerfValue}>{selectedStore.performance.satisfaction}%</Text>
                      </View>
                      <View style={styles.modalProgressBar}>
                        <ProgressBar
                          progress={selectedStore.performance.satisfaction / 100}
                          color={COLORS.success}
                          height={6}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Dates Section */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Dates</Text>
                    <View style={styles.modalInfoItem}>
                      <Ionicons name="calendar-outline" size={20} color={COLORS.accent} />
                      <View style={styles.modalInfoContent}>
                        <Text style={styles.modalInfoLabel}>Date d'inscription</Text>
                        <Text style={styles.modalInfoValue}>{new Date(selectedStore.joinedAt).toLocaleDateString('fr-FR')}</Text>
                      </View>
                    </View>

                    <View style={styles.modalInfoItem}>
                      <Ionicons name="time-outline" size={20} color={COLORS.accent} />
                      <View style={styles.modalInfoContent}>
                        <Text style={styles.modalInfoLabel}>Dernier accès</Text>
                        <Text style={styles.modalInfoValue}>{new Date(selectedStore.lastActive).toLocaleDateString('fr-FR')}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <Button
                      title="✎ Éditer"
                      onPress={() => {
                        setModalVisible(false);
                        // navigation.navigate('EditStore', { storeId: selectedStore.id });
                      }}
                    />
                    <Button
                      title="⚙ Paramètres"
                      onPress={() => {
                        setModalVisible(false);
                        // navigation.navigate('StoreSettings', { storeId: selectedStore.id });
                      }}
                    />
                    <TouchableOpacity
                      style={styles.modalDeleteBtn}
                      onPress={() => {
                        Alert.alert(
                          'Supprimer la boutique',
                          `Êtes-vous sûr de vouloir supprimer "${selectedStore.name}" ?`,
                          [
                            { text: 'Annuler', style: 'cancel' },
                            {
                              text: 'Supprimer',
                              style: 'destructive',
                              onPress: () => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                setModalVisible(false);
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash-outline" size={24} color={COLORS.danger} />
                      <Text style={styles.modalDeleteText}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 24 }} />
                </ScrollView>
              )}
            </View>
          </BlurView>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'COLORS.card' },
  header: { overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerGradient: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 60, paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 30, fontWeight: '800', color: COLORS.text, letterSpacing: -0.8 },
  statusChipsContainer: { paddingVertical: 8 },
  statusChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  statusChipText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  searchSection: { padding: 16, backgroundColor: 'COLORS.card' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'COLORS.border',
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.07)',
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.textSoft, marginLeft: 8 },
  activeFilterText: { marginTop: 10, fontSize: 13, color: 'COLORS.textMuted', fontStyle: 'italic' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 12 },
  gridItem: { width: '50%', paddingHorizontal: 6, marginBottom: 16 },
  gridCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'COLORS.borderLight',
    boxShadow: '0px 3px 10px rgba(0, 0, 0, 0.08)',
    elevation: 4,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedOverlayActive: { backgroundColor: 'rgba(34,197,94,0.65)' },
  statusDot: { width: 14, height: 14, borderRadius: 7, position: 'absolute', top: 16, right: 16 },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  gridName: { fontSize: 18, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  gridBadges: { flexDirection: 'row', gap: 8 },
  gridOwner: { fontSize: 14, color: 'COLORS.textMuted', marginBottom: 12 },
  gridStats: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  gridStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gridStatValue: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  gridStatLabel: { fontSize: 12, color: 'COLORS.textMuted' },
  gridFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'COLORS.borderLight', paddingTop: 12 },
  gridCategory: { fontSize: 14, color: 'COLORS.categoryColors[5]', fontWeight: '600' },
  gridCity: { fontSize: 13, color: 'COLORS.textMuted' },
  listContainer: { padding: 16 },
  listCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'COLORS.borderLight',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.07)',
    elevation: 3,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#cbd5e1',
    borderWidth: 3,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  selectionIndicatorActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  listHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusBadge: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  listInfo: { flex: 1 },
  listNameRow: { flexDirection: 'row', alignItems: 'center' },
  listName: { fontSize: 19, fontWeight: '700', color: '#1e293b' },
  listOwner: { fontSize: 15, color: 'COLORS.textMuted', marginTop: 2 },
  listMetrics: { flexDirection: 'row', backgroundColor: 'COLORS.card', borderRadius: 16, padding: 12, marginBottom: 16 },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginTop: 4 },
  metricLabel: { fontSize: 12, color: 'COLORS.textMuted', marginTop: 2 },
  metricDivider: { width: 1, backgroundColor: 'COLORS.border' },
  listActions: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'COLORS.borderLight',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  floatingBar: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(15,23,42,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.35)',
    elevation: 12,
  },
  floatingCount: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  floatingActions: { flexDirection: 'row', gap: 16 },
  fabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: height * 0.9 },
  // ======== TABLE VIEW STYLES ========
  tableContainer: {
    paddingHorizontal: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f0f4f8',
    borderBottomWidth: 2,
    borderBottomColor: 'COLORS.border',
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.3,
  },
  tableColNameHeader: {
    flex: 2.5,
  },
  tableColViewsHeader: {
    flex: 1,
    alignItems: 'center',
  },
  tableColProductHeader: {
    flex: 0.8,
    alignItems: 'center',
  },
  tableColRevenueHeader: {
    flex: 1,
    alignItems: 'center',
  },
  tableColStatusHeader: {
    flex: 1.2,
    alignItems: 'center',
  },
  tableColRatingHeader: {
    flex: 0.7,
    alignItems: 'center',
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'COLORS.border',
    backgroundColor: COLORS.card,
  },
  tableRowAlt: {
    backgroundColor: 'COLORS.card',
  },
  tableRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 12,
  },
  tableCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCheckboxActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  tableColName: {
    flex: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tableNameContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableSortDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tableStoreInfo: {
    flex: 1,
  },
  tableStoreName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  tableStoreOwner: {
    fontSize: 12,
    color: 'COLORS.textMuted',
    marginTop: 2,
  },
  tableColViews: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tableColProduct: {
    flex: 0.8,
    alignItems: 'center',
  },
  tableColRevenue: {
    flex: 1,
    alignItems: 'center',
  },
  tableColStatus: {
    flex: 1.2,
    alignItems: 'center',
  },
  tableStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tableStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tableRating: {
    flex: 0.7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tableValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  tableLabel: {
    fontSize: 11,
    color: 'COLORS.textMuted',
    marginTop: 2,
  },
  tableRatingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  tableRatingEmpty: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  viewModeSwitcher: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 6,
    borderRadius: 12,
  },
  viewModeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  viewModeBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  // ======== MODAL STYLES ========
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'COLORS.border',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    flex: 1,
    textAlign: 'center',
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
    flexWrap: 'wrap',
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalStatusLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalBadgesRow: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  modalBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'COLORS.card',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modalSection: {
    marginTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'COLORS.borderLight',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 14,
  },
  modalInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'COLORS.card',
  },
  modalInfoContent: {
    flex: 1,
  },
  modalInfoLabel: {
    fontSize: 12,
    color: 'COLORS.textMuted',
    fontWeight: '600',
    marginBottom: 4,
  },
  modalInfoValue: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '600',
  },
  modalDescSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'COLORS.card',
  },
  modalDescTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'COLORS.textMuted',
    marginBottom: 8,
  },
  modalDescText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modalStatCard: {
    width: '48%',
    backgroundColor: 'COLORS.card',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'COLORS.borderLight',
  },
  modalStatIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 12,
    color: 'COLORS.textMuted',
    fontWeight: '600',
  },
  modalPerformanceItem: {
    marginBottom: 20,
  },
  modalPerfLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalPerfName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalPerfValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.accent,
  },
  modalProgressBar: {
    flex: 1,
  },
  modalActions: {
    gap: 12,
    marginTop: 20,
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.danger + '15',
    borderWidth: 1.5,
    borderColor: COLORS.danger + '40',
  },
  modalDeleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
  },
});

export default AdminStoresScreen;
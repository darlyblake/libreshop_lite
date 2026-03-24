import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useResponsive } from '../utils/responsive';

// Mock clients data
const CLIENTS = [
  {
    id: '1',
    name: 'Jean Dupont',
    phone: '+221 77 123 45 67',
    email: 'jean.dupont@email.com',
    ordersCount: 12,
    totalSpent: 850000,
    lastOrder: '2024-01-15',
    isActive: true,
  },
  {
    id: '2',
    name: 'Marie Diop',
    phone: '+221 76 987 65 43',
    email: 'marie.diop@email.com',
    ordersCount: 8,
    totalSpent: 450000,
    lastOrder: '2024-01-18',
    isActive: true,
  },
  {
    id: '3',
    name: 'Ahmad Ba',
    phone: '+221 78 456 78 90',
    email: 'ahmad.ba@email.com',
    ordersCount: 15,
    totalSpent: 1200000,
    lastOrder: '2024-01-10',
    isActive: false,
  },
];

export const ClientCollectionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'clients' | 'orders'>('clients');
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const handleAddClient = () => {
    if (!newClient.name.trim() || !newClient.phone.trim()) {
      Alert.alert('Erreur', 'Le nom et le téléphone sont requis');
      return;
    }
    
    // Simuler l'ajout
    Alert.alert('Succès', `Client "${newClient.name}" ajouté avec succès`);
    setNewClient({ name: '', phone: '', email: '' });
    setShowAddModal(false);
  };

  const toggleClientStatus = (id: string) => {
    Alert.alert(
      'Changer le statut',
      'Voulez-vous activer/désactiver ce client ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => {
            // Toggle client status
          }}
      ]
    );
  };

  const renderClient = (client: any) => (
    <View key={client.id} style={styles.clientCard}>
      <View style={styles.clientHeader}>
        <View style={styles.clientInfo}>
          <View style={styles.clientAvatar}>
            <Text style={styles.avatarText}>
              {client.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
            </Text>
          </View>
          <View style={styles.clientDetails}>
            <Text style={styles.clientName}>{client.name}</Text>
            <Text style={styles.clientPhone}>{client.phone}</Text>
            {client.email && <Text style={styles.clientEmail}>{client.email}</Text>}
          </View>
        </View>
        <TouchableOpacity 
          style={[
            styles.statusToggle,
            { backgroundColor: client.isActive ? COLORS.success : COLORS.textMuted }
          ]}
          onPress={() => toggleClientStatus(client.id)}
        >
          <Ionicons 
            name={client.isActive ? 'checkmark' : 'close'} 
            size={16} 
            color={COLORS.text} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.clientStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{client.ordersCount}</Text>
          <Text style={styles.statLabel}>Commandes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{client.totalSpent.toLocaleString()} F</Text>
          <Text style={styles.statLabel}>Total dépensé</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{client.lastOrder}</Text>
          <Text style={styles.statLabel}>Dernière commande</Text>
        </View>
      </View>
      
      <View style={styles.clientActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('ClientDetail', { clientId: client.id })}
        >
          <Ionicons name="eye-outline" size={20} color={COLORS.accent} />
          <Text style={styles.actionText}>Voir</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('ClientOrders', { clientId: client.id })}
        >
          <Ionicons name="receipt-outline" size={20} color={COLORS.accent} />
          <Text style={styles.actionText}>Commandes</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('ClientEdit', { clientId: client.id })}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.accent} />
          <Text style={styles.actionText}>Modifier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clients</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[
            styles.tab,
            selectedTab === 'clients' && styles.tabActive
          ]}
          onPress={() => setSelectedTab('clients')}
        >
          <Text style={[
            styles.tabText,
            selectedTab === 'clients' && styles.tabTextActive
          ]}>
            Tous les clients
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.tab,
            selectedTab === 'orders' && styles.tabActive
          ]}
          onPress={() => setSelectedTab('orders')}
        >
          <Text style={[
            styles.tabText,
            selectedTab === 'orders' && styles.tabTextActive
          ]}>
            Commandes récentes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un client..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Content based on selected tab */}
      {selectedTab === 'clients' ? (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.clientsContainer,
            isDesktop && styles.clientsContainerDesktop,
          ]}
        >
          {CLIENTS.map(renderClient)}
        </ScrollView>
      ) : (
        <View style={styles.ordersContainer}>
          <Text style={styles.emptyText}>Fonctionnalité des commandes récentes bientôt disponible</Text>
        </View>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un client</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom complet *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Jean Dupont"
                  placeholderTextColor={COLORS.textMuted}
                  value={newClient.name}
                  onChangeText={(text) => setNewClient({ ...newClient, name: text })}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Téléphone *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: +221 77 123 45 67"
                  placeholderTextColor={COLORS.textMuted}
                  value={newClient.phone}
                  onChangeText={(text) => setNewClient({ ...newClient, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: client@email.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={newClient.email}
                  onChangeText={(text) => setNewClient({ ...newClient, email: text })}
                  keyboardType="email-address"
                />
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddClient}
              >
                <Text style={styles.confirmButtonText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.accent,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  clientsContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  clientsContainerDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  clientCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  clientInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  clientPhone: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginBottom: SPACING.xs,
  },
  clientEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  statusToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  clientActions: {
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
    backgroundColor: COLORS.accent + '10',
  },
  actionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    fontWeight: '500',
  },
  ordersContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalBody: {
    padding: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSoft,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: COLORS.accent,
  },
  confirmButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
});

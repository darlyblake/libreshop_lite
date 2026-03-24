import React, { useState, useMemo } from 'react';
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
  Switch,
  Platform,
} from 'react-native';
import { planService, supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { Card } from '../components/Card';
import { BackToDashboard } from '../components/BackToDashboard';
import { showAlert, showConfirm } from '../utils/platformUtils';

interface Subscription {
  id: string;
  name: string;
  price: number;
  duration: string;
  months?: number;             // durée en mois (quantitatif)
  trialDays?: number;          // longueur de l'essai gratuit
  productLimit?: number;       // nombre max de produits
  hasCaisse?: boolean;         // vente physique active
  hasOnlineStore?: boolean;    // boutique en ligne
  features: string[];
  userCount: number;
  status: 'active' | 'inactive' | 'trial';
  revenue: number;
  createdAt: string;
}

export const AdminSubscriptionsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const blurActiveElement = () => {
    // RN Web: Blur keyboard input when closing Modal to avoid aria-hidden warnings
    // Safe no-op in React Native mobile environments
    try {
      if (typeof document !== 'undefined' && document.activeElement) {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    } catch (e) {
      // Expected in React Native mobile - silently ignore
    }
  };

  // Mock data
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // load plans from the database once
  React.useEffect(() => {
    const load = async () => {
      try {
        const plans = await planService.getAll();
        // map plan fields to our local Subscription type for display
        setSubscriptions(
          plans.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            duration: p.duration || (p.months ? `${p.months} mois` : ''),
            months: p.months,
            trialDays: p.trial_days,
            productLimit: p.product_limit,
            hasCaisse: p.has_caisse,
            hasOnlineStore: p.has_online_store,
            features: p.features || [],
            userCount: 0,
            status: p.status === 'inactive' ? 'inactive' : 'active',
            revenue: 0,
            createdAt: p.created_at || '',
          }))
        );
      } catch (err) {
        errorHandler.handleDatabaseError(err, 'fetch plans');
      }
    };
    load();
  }, []);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           sub.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = selectedStatus === 'all' || sub.status === selectedStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, searchQuery, selectedStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [statsSubscription, setStatsSubscription] = useState<Subscription | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newMonths, setNewMonths] = useState('');
  const [newProductLimit, setNewProductLimit] = useState('');
  const [newHasCaisse, setNewHasCaisse] = useState(false);
  const [newHasOnlineStore, setNewHasOnlineStore] = useState(false);
  const [newFeatures, setNewFeatures] = useState('');
  const [newTrialDays, setNewTrialDays] = useState('');
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

  const openAddModal = () => {
    setEditingSubscription(null);
    setNewName('');
    setNewPrice('');
    setNewDuration('');
    setNewFeatures('');
    setNewTrialDays('');
    setAddModalVisible(true);
  };
  const closeAddModal = () => {
    blurActiveElement();
    setAddModalVisible(false);
    setEditingSubscription(null);
  };

  const closeStatsModal = () => {
    blurActiveElement();
    setStatsModalVisible(false);
  };

  const submitSubscription = async () => {
    if (!newName.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }

    const normalizedName = newName.trim().toLowerCase();
    const duplicate = subscriptions.some(s => {
      if (editingSubscription && s.id === editingSubscription.id) return false;
      return s.name.trim().toLowerCase() === normalizedName;
    });
    if (duplicate) {
      Alert.alert('Erreur', "Un plan avec ce nom existe déjà. Choisis un autre nom.");
      return;
    }

    // Diagnostic RLS: si on n'a pas de session, Supabase est en rôle anon -> INSERT souvent bloqué.
    try {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          errorHandler.handle(new Error('[plans] No Supabase session (anon). INSERT/UPDATE may be blocked by RLS.'), 'AdminSubscriptions', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
        } else {
          const sUser: any = data.session.user;
          const email = sUser?.email;
          const uid = sUser?.id;
          const role = sUser?.user_metadata?.role || sUser?.app_metadata?.role;
        }
      }
    } catch (e) {
      errorHandler.handle(e, '[plans] Unable to read auth session', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
    }

    const featuresArr = newFeatures
      .split(',')
      .map(f => f.trim())
      .filter(f => f);
    if (editingSubscription) {
      const updated: Subscription = {
        ...editingSubscription,
        name: newName.trim(),
        price: parseInt(newPrice) || 0,
        duration: newDuration || editingSubscription.duration,
        months: parseInt(newMonths) || undefined,
        // trial days stored separately in the plans table – not part of our
        // local Subscription type (we use `trialDays` for display).
        productLimit: parseInt(newProductLimit) || undefined,
        hasCaisse: newHasCaisse,
        hasOnlineStore: newHasOnlineStore,
        features: featuresArr,
      };
      try {
        const res = await planService.update(updated.id, {
          name: updated.name,
          price: updated.price,
          duration: updated.duration,
          months: updated.months,
          trial_days: updated.trialDays,
          product_limit: updated.productLimit,
          has_caisse: updated.hasCaisse,
          has_online_store: updated.hasOnlineStore,
          features: updated.features,
        });

        setSubscriptions(prev =>
          prev.map(s =>
            s.id === updated.id
              ? {
                  ...s,
                  ...updated,
                  status: (res.status as any) ? ((res.status as any) === 'inactive' ? 'inactive' : 'active') : s.status,
                  createdAt: res.created_at || s.createdAt,
                }
              : s
          )
        );

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          showAlert(`✅ ${updated.name} a été mis à jour.`);
        } else {
          Alert.alert('Abonnement modifié', `${updated.name} a été mis à jour.`);
        }
      } catch (e) {
        errorHandler.handleDatabaseError(e, 'update plan');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          showAlert('❌ Impossible de mettre à jour le plan');
        } else {
          Alert.alert('Erreur', 'Impossible de mettre à jour le plan');
        }
      }
      closeAddModal();
      return;
    }
    const newSub: Subscription = {
      id: String(Date.now()),
      name: newName.trim(),
      price: parseInt(newPrice) || 0,
      duration: newDuration || 'mois',
      trialDays: parseInt(newTrialDays) || undefined,
      months: parseInt(newMonths) || undefined,
      productLimit: parseInt(newProductLimit) || undefined,
      hasCaisse: newHasCaisse,
      hasOnlineStore: newHasOnlineStore,
      features: featuresArr,
      userCount: 0,
      status: 'active',
      revenue: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    try {
      const payload = {
        name: newSub.name,
        price: newSub.price,
        duration: newSub.duration,
        trial_days: newSub.trialDays,
        months: newSub.months,
        product_limit: newSub.productLimit,
        has_caisse: newSub.hasCaisse,
        has_online_store: newSub.hasOnlineStore,
        features: newSub.features,
      };
      Alert.alert('Création', 'Envoi du plan à Supabase...');
      const created = await planService.create(payload);
      setSubscriptions([ { ...newSub, id: created.id, createdAt: created.created_at || '' }, ...subscriptions ]);
      closeAddModal();
      setNewName('');
      setNewPrice('');
      setNewDuration('');
      setNewMonths('');
      setNewProductLimit('');
      setNewHasCaisse(false);
      setNewHasOnlineStore(false);
      setNewFeatures('');
      setNewTrialDays('');
      Alert.alert('Abonnement ajouté', `${newSub.name} a été créé.`);
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'create plan');
      if ((e as any)?.code === '42501') {
        Alert.alert(
          'Accès refusé (RLS)',
          "Supabase a refusé l'insertion (RLS). Tu es probablement en session anon (pas connecté) ou la policy INSERT n'est pas active sur la table plans."
        );
        return;
      }
      if ((e as any)?.code === '23505') {
        Alert.alert('Nom déjà utilisé', "Un plan avec ce nom existe déjà. Change le nom puis réessaie.");
        return;
      }
      if (
        typeof e === 'object' &&
        (String(e).includes('Failed to fetch') ||
          (e as any).message?.includes('Failed to fetch'))
      ) {
        Alert.alert(
          'Erreur réseau',
          'Impossible de joindre Supabase. Vérifiez votre URL et la connexion Internet.'
        );
      } else {
        Alert.alert('Erreur', 'Impossible de créer le plan');
      }
    }
  };


  const handleSubscriptionAction = async (subscription: Subscription, action: 'edit' | 'toggle' | 'delete' | 'stats') => {
    switch (action) {
      case 'edit':
        // Ouvrir le modal en mode édition sans passer par openAddModal()
        // (openAddModal reset l'état et peut créer des comportements non fiables sur web).
        setAddModalVisible(true);
        setEditingSubscription(subscription);
        setNewName(subscription.name);
        setNewPrice(String(subscription.price));
        setNewDuration(subscription.duration);
        setNewTrialDays(subscription.trialDays ? String(subscription.trialDays) : '');
        setNewMonths(subscription.months ? String(subscription.months) : '');
        setNewProductLimit(subscription.productLimit ? String(subscription.productLimit) : '');
        setNewHasCaisse(!!subscription.hasCaisse);
        setNewHasOnlineStore(!!subscription.hasOnlineStore);
        setNewFeatures(subscription.features.join(', '));
        break;
      case 'toggle':
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const ok = await showConfirm(
            `${subscription.status === 'active' ? 'Désactiver' : 'Activer'} "${subscription.name}" ?`
          );
          if (!ok) return;

          (async () => {
            try {
              const newStatus = subscription.status === 'active' ? 'inactive' : 'active';
              const updated = await planService.update(subscription.id, { status: newStatus });
              setSubscriptions(prev =>
                prev.map(s =>
                  s.id === subscription.id
                    ? { ...s, status: ((updated.status as any) === 'inactive' ? 'inactive' : 'active') as any }
                    : s
                )
              );
            } catch (e) {
              errorHandler.handleDatabaseError(e, 'toggle plan');
              showAlert('❌ Impossible de modifier le statut');
            }
          })();

          return;
        }

        Alert.alert(
          subscription.status === 'active' ? 'Désactiver' : 'Activer',
          `${subscription.status === 'active' ? 'Désactiver' : 'Activer'} "${subscription.name}" ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: subscription.status === 'active' ? 'Désactiver' : 'Activer',
              style: 'default',
              onPress: async () => {
                try {
                  const newStatus = subscription.status === 'active' ? 'inactive' : 'active';
                  const updated = await planService.update(subscription.id, { status: newStatus });
                  setSubscriptions(prev =>
                    prev.map(s =>
                      s.id === subscription.id
                        ? { ...s, status: ((updated.status as any) === 'inactive' ? 'inactive' : 'active') as any }
                        : s
                    )
                  );
                } catch (e) {
                  errorHandler.handleDatabaseError(e, 'toggle plan');
                  Alert.alert('Erreur', 'Impossible de modifier le statut');
                }
              },
            },
          ]
        );
        break;
      case 'stats':
        setStatsSubscription(subscription);
        setStatsModalVisible(true);
        break;
      case 'delete':
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const ok = await showConfirm(
            `Voulez-vous supprimer "${subscription.name}" ? Cette action est irréversible.`
          );
          if (!ok) return;

          (async () => {
            try {
              await planService.delete(subscription.id);
              setSubscriptions(prev => prev.filter(s => s.id !== subscription.id));
            } catch (e) {
              errorHandler.handleDatabaseError(e, 'delete plan');
              showAlert('❌ Impossible de supprimer le plan');
            }
          })();

          return;
        }

        Alert.alert(
          'Supprimer l\'abonnement',
          `Voulez-vous supprimer "${subscription.name}" ? Cette action est irréversible.`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: async () => {
                try {
                  await planService.delete(subscription.id);
                  setSubscriptions(prev => prev.filter(s => s.id !== subscription.id));
                } catch (e) {
                  errorHandler.handleDatabaseError(e, 'delete plan');
                  Alert.alert('Erreur', 'Impossible de supprimer le plan');
                }
              } },
          ]
        );
        break;
    }
  };

  const getStatusColor = (status: Subscription['status']) => {
    switch (status) {
      case 'active': return COLORS.success;
      case 'trial': return COLORS.warning;
      case 'inactive': return COLORS.danger;
      default: return COLORS.textMuted;
    }
  };

  const getStatusText = (status: Subscription['status']) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'trial': return 'Essai';
      case 'inactive': return 'Inactif';
      default: return status;
    }
  };

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des abonnements</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Add subscription modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeAddModal}
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addModalContainer}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>{editingSubscription ? 'Modifier abonnement' : 'Nouvel abonnement'}</Text>
              <TouchableOpacity onPress={closeAddModal} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.addModalBody}>
              <TextInput
                placeholder="Nom"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                placeholder="Prix (en FCFA)"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={newPrice}
                onChangeText={setNewPrice}
                keyboardType="numeric"
              />
              <TextInput
                placeholder="Durée"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={newDuration}
                onChangeText={setNewDuration}
              />
              <TextInput
                placeholder="Jours d'essai gratuit"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={newTrialDays}
                onChangeText={setNewTrialDays}
                keyboardType="numeric"
              />
              <TextInput
                placeholder="Fonctionnalités (séparées par une virgule)"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { height: 80 }]}
                value={newFeatures}
                onChangeText={setNewFeatures}
                multiline
              />

              <TextInput
                placeholder="Nombre de mois"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={newMonths}
                onChangeText={setNewMonths}
                keyboardType="numeric"
              />
              <TextInput
                placeholder="Limite de produits"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                value={newProductLimit}
                onChangeText={setNewProductLimit}
                keyboardType="numeric"
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                <Text style={{ color: COLORS.text, flex: 1 }}>Caisse physique</Text>
                <Switch
                  value={newHasCaisse}
                  onValueChange={setNewHasCaisse}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                <Text style={{ color: COLORS.text, flex: 1 }}>Boutique en ligne</Text>
                <Switch
                  value={newHasOnlineStore}
                  onValueChange={setNewHasOnlineStore}
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalActionButton} onPress={closeAddModal}>
                  <Text style={styles.modalActionText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalActionButton, { backgroundColor: COLORS.accent }]} onPress={submitSubscription}>
                  <Text style={[styles.modalActionText, { color: COLORS.text }]}>{editingSubscription ? 'Mettre à jour' : 'Créer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stats modal */}
      <Modal
        visible={statsModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeStatsModal}
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statsModalContainer}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>Statistiques</Text>
              <TouchableOpacity onPress={closeStatsModal} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.addModalBody}>
              {statsSubscription ? (
                <>
                  <Text style={styles.statLine}>Nom: {statsSubscription.name}</Text>
                  <Text style={styles.statLine}>Utilisateurs: {statsSubscription.userCount}</Text>
                  <Text style={styles.statLine}>Revenus: {statsSubscription.revenue.toLocaleString()} FCFA</Text>
                  <Text style={styles.statLine}>Créé le: {statsSubscription.createdAt}</Text>
                  {statsSubscription.months !== undefined && <Text style={styles.statLine}>Durée (mois): {statsSubscription.months}</Text>}
                  {statsSubscription.productLimit !== undefined && <Text style={styles.statLine}>Limite produits: {statsSubscription.productLimit || '∞'}</Text>}
                  <Text style={styles.statLine}>Caisse physique: {statsSubscription.hasCaisse ? 'Oui' : 'Non'}</Text>
                  <Text style={styles.statLine}>Boutique en ligne: {statsSubscription.hasOnlineStore ? 'Oui' : 'Non'}</Text>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un abonnement..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {['all', 'active', 'trial', 'inactive'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                selectedStatus === status && styles.filterChipActive
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text style={[
                styles.filterText,
                selectedStatus === status && styles.filterTextActive
              ]}>
                {status === 'all' ? 'Tous' : 
                 status === 'active' ? 'Actifs' :
                 status === 'trial' ? 'Essais' : 'Inactifs'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Subscriptions List */}
      <ScrollView
        style={styles.subscriptionsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
      >
        {filteredSubscriptions.map((subscription) => (
          <Card key={subscription.id} style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionInfo}>
                <View style={styles.subscriptionNameRow}>
                  <Text style={styles.subscriptionName}>{subscription.name}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(subscription.status) + '20' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: getStatusColor(subscription.status) }
                    ]}>
                      {getStatusText(subscription.status)}
                    </Text>
                  </View>
                </View>
                <View style={styles.subscriptionPricing}>
                  <Text style={styles.subscriptionPrice}>
                    {subscription.price === 0 ? 'GRATUIT' : `${subscription.price.toLocaleString()} FCFA`}
                  </Text>
                  <Text style={styles.subscriptionDuration}>/{subscription.duration}</Text>
                </View>
              </View>
            </View>

            <View style={styles.subscriptionFeatures}>
              {subscription.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <View style={styles.subscriptionStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{subscription.userCount}</Text>
                <Text style={styles.statLabel}>Utilisateurs</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {(subscription.revenue / 1000000).toFixed(1)}M
                </Text>
                <Text style={styles.statLabel}>Revenus</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{subscription.createdAt}</Text>
                <Text style={styles.statLabel}>Créé</Text>
              </View>
            </View>

            <View style={styles.subscriptionActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleSubscriptionAction(subscription, 'stats')}
              >
                <Ionicons name="bar-chart-outline" size={18} color={COLORS.info} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleSubscriptionAction(subscription, 'edit')}
              >
                <Ionicons name="create-outline" size={18} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleSubscriptionAction(subscription, 'delete')}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  subscription.status === 'active' ? styles.deactivateButton : styles.activateButton
                ]}
                onPress={() => handleSubscriptionAction(subscription, 'toggle')}
              >
                <Ionicons 
                  name={subscription.status === 'active' ? 'pause' : 'play'} 
                  size={18} 
                  color={COLORS.text} 
                />
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {filteredSubscriptions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucun abonnement trouvé</Text>
          </View>
        )}
      </ScrollView>
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
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  filterScroll: {
    maxHeight: 40,
  },
  filterContainer: {
    paddingRight: SPACING.lg,
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
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  addModalContainer: {
    width: '100%',
    maxWidth: 820,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  addModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addModalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  addModalBody: {
    padding: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  modalActionButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
  },
  modalActionText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  statsModalContainer: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  statLine: {
    color: COLORS.text,
    marginBottom: SPACING.sm,
    fontSize: FONT_SIZE.md,
  },
  subscriptionsList: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  subscriptionCard: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  subscriptionHeader: {
    marginBottom: SPACING.md,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  subscriptionName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  subscriptionPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  subscriptionPrice: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.accent,
  },
  subscriptionDuration: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginLeft: 2,
  },
  subscriptionFeatures: {
    marginBottom: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  featureText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  subscriptionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  subscriptionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  activateButton: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  deactivateButton: {
    backgroundColor: COLORS.warning,
    borderColor: COLORS.warning,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store';
import { collectionService } from '../services/collectionService';
import { storeService } from '../services/storeService';
import type { Collection } from '../lib/supabase';

const ACCENT = '#FF6B35';
const GRADIENT: readonly [string, string] = ['#FF6B35', '#FF8C42'];

const SECTION_COLORS = [
  '#FF6B35', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
];

const SECTION_EMOJIS: Record<string, string> = {
  'Entrées': '🥗',
  'Plats': '🍽️',
  'Plats principaux': '🍽️',
  'Pizza': '🍕',
  'Pizzas': '🍕',
  'Pâtes': '🍝',
  'Pâtes & Riz': '🍝',
  'Grillade': '🥩',
  'Grillades': '🥩',
  'Desserts': '🍰',
  'Boissons': '🥤',
  'Spéciaux': '⭐',
  'default': '📋',
};

// ─── Modal Ajout / Édition ────────────────────────────────────────────────────
type CollectionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  saving: boolean;
  initial?: { name: string; description: string } | null;
};

const CollectionFormModal: React.FC<CollectionModalProps> = ({
  visible, onClose, onSave, saving, initial,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
    }
  }, [visible, initial]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Champ requis', 'Le nom de la section est obligatoire.');
      return;
    }
    onSave(name.trim(), description.trim());
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#fff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[modalStyles.header, { backgroundColor: ACCENT }]}>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={modalStyles.headerTitle}>
            {initial ? '✏️ Modifier la section' : '➕ Nouvelle section'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={modalStyles.body} keyboardShouldPersistTaps="handled">
          <Text style={modalStyles.hint}>
            Les sections organisent votre carte (ex : Entrées, Plats, Desserts, Boissons...)
          </Text>

          <Text style={modalStyles.label}>Nom de la section *</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="Ex: Entrées, Plats du jour, Desserts..."
            placeholderTextColor="#bbb"
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={60}
          />

          <Text style={modalStyles.label}>Description (optionnel)</Text>
          <TextInput
            style={[modalStyles.input, modalStyles.textArea]}
            placeholder="Ex: Nos plats préparés sur place avec des produits frais"
            placeholderTextColor="#bbb"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={200}
          />

          {/* Suggestions rapides */}
          <Text style={modalStyles.suggestTitle}>Suggestions rapides :</Text>
          <View style={modalStyles.suggestRow}>
            {['🥗 Entrées', '🍽️ Plats', '🍕 Pizzas', '🍝 Pâtes & Riz', '🥩 Grillades', '🍰 Desserts', '🥤 Boissons'].map(s => (
              <TouchableOpacity
                key={s}
                style={modalStyles.suggestChip}
                onPress={() => setName(s.replace(/^.+?\s/, ''))}
              >
                <Text style={modalStyles.suggestText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={modalStyles.footer}>
          <TouchableOpacity
            style={[modalStyles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={modalStyles.saveBtnText}>
                  {initial ? 'Enregistrer' : 'Créer la section'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  body: { padding: 20, gap: 4, paddingBottom: 120 },
  hint: {
    backgroundColor: '#FFF3ED',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#c2410c',
    lineHeight: 18,
    marginBottom: 16,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  suggestTitle: { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 20, marginBottom: 10 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF3ED',
    borderWidth: 1,
    borderColor: '#FFD0B5',
  },
  suggestText: { fontSize: 13, color: ACCENT, fontWeight: '600' },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: ACCENT,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export const RestaurantCollectionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('Mon Restaurant');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editCollection, setEditCollection] = useState<Collection | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (!store?.id) return;
      setStoreId(store.id);
      setStoreName(store.name || 'Mon Restaurant');
      const cols = await collectionService.getByStore(store.id);
      setCollections(cols || []);
    } catch (e) {
      console.warn('Error loading collections:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleOpenAdd = () => {
    setEditCollection(null);
    setShowModal(true);
  };

  const handleOpenEdit = (col: Collection) => {
    setEditCollection(col);
    setShowModal(true);
  };

  const handleSave = async (name: string, description: string) => {
    if (!storeId) return;
    setSaving(true);
    try {
      if (editCollection) {
        // Mise à jour
        const updated = await collectionService.update(editCollection.id, {
          name,
          description: description || undefined,
        } as any);
        setCollections(prev => prev.map(c => c.id === editCollection.id ? { ...c, name, description } : c));
        Alert.alert('✅ Succès', `Section "${name}" modifiée.`);
      } else {
        // Création
        const created = await collectionService.create({
          store_id: storeId,
          name,
          description: description || undefined,
          is_active: true,
        } as any);
        setCollections(prev => [created, ...prev]);
        Alert.alert('✅ Succès', `Section "${name}" créée.`);
      }
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (col: Collection) => {
    Alert.alert(
      'Supprimer la section',
      `Voulez-vous supprimer la section "${col.name}" ? Les plats ne seront pas supprimés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await collectionService.delete(col.id);
              setCollections(prev => prev.filter(c => c.id !== col.id));
              Alert.alert('✅ Supprimé', `Section "${col.name}" supprimée.`);
            } catch (e: any) {
              Alert.alert('Erreur', 'Impossible de supprimer cette section.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg ?? '#f8f8f8' }}>
      {/* Header */}
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>📋 Sections du menu</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>
            {storeName} · {collections.length} section{collections.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: 10 }}
          onPress={handleOpenAdd}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={{ color: '#888', marginTop: 12 }}>Chargement...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ACCENT]} />}
        >
          {/* Bouton d'ajout rapide si vide */}
          {collections.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
              <Text style={{ fontSize: 64 }}>📋</Text>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '700' }}>Aucune section</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                Créez des sections pour organiser votre carte{'\n'}(Entrées, Plats, Desserts, Boissons...)
              </Text>
              <TouchableOpacity
                onPress={handleOpenAdd}
                style={{ marginTop: 8, backgroundColor: ACCENT, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Créer une section</Text>
              </TouchableOpacity>
            </View>
          ) : (
            collections.map((col, idx) => {
              const emoji = SECTION_EMOJIS[col.name] ?? SECTION_EMOJIS['default'];
              const accentColor = SECTION_COLORS[idx % SECTION_COLORS.length];
              return (
                <View
                  key={col.id}
                  style={{
                    backgroundColor: COLORS.card ?? '#fff',
                    borderRadius: 16,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.07,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  {/* Bande colorée */}
                  <View style={{ height: 4, backgroundColor: accentColor }} />

                  {/* Corps */}
                  <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: accentColor + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 26 }}>{emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 16 }}>{col.name}</Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
                        {col.description || 'Section de la carte'}
                      </Text>
                    </View>
                  </View>

                  {/* Barre d'actions */}
                  <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
                    {/* Voir les plats */}
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
                      onPress={() => navigation.navigate('SellerCollectionProducts', { collectionId: col.id, collectionName: col.name })}
                    >
                      <Ionicons name="restaurant-outline" size={16} color={accentColor} />
                      <Text style={{ color: accentColor, fontWeight: '600', fontSize: 13 }}>Voir plats</Text>
                    </TouchableOpacity>

                    {/* Séparateur */}
                    <View style={{ width: 1, backgroundColor: '#f0f0f0', marginVertical: 8 }} />

                    {/* Modifier */}
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
                      onPress={() => handleOpenEdit(col)}
                    >
                      <Ionicons name="pencil" size={16} color="#3B82F6" />
                      <Text style={{ color: '#3B82F6', fontWeight: '600', fontSize: 13 }}>Modifier</Text>
                    </TouchableOpacity>

                    {/* Séparateur */}
                    <View style={{ width: 1, backgroundColor: '#f0f0f0', marginVertical: 8 }} />

                    {/* Supprimer */}
                    <TouchableOpacity
                      style={{ flex: 0.7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
                      onPress={() => handleDelete(col)}
                    >
                      <Ionicons name="trash" size={16} color="#EF4444" />
                      <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>Supr.</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* Bouton + flottant bas si des collections existent */}
          {collections.length > 0 && (
            <TouchableOpacity
              onPress={handleOpenAdd}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 2, borderColor: ACCENT, borderStyle: 'dashed' }}
            >
              <Ionicons name="add-circle-outline" size={20} color={ACCENT} />
              <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 14 }}>Ajouter une section</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Modal Ajout / Édition */}
      <CollectionFormModal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditCollection(null); }}
        onSave={handleSave}
        saving={saving}
        initial={editCollection ? { name: editCollection.name, description: editCollection.description ?? '' } : null}
      />
    </View>
  );
};

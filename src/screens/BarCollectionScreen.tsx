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

const ACCENT = '#7C3AED';
const GRADIENT: readonly [string, string] = ['#6C3483', '#8E44AD'];

const BAR_SECTION_COLORS = [
  '#8E44AD', '#6C3483', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#EF4444',
];

const BAR_EMOJIS: Record<string, string> = {
  'Cocktails': '🍹',
  'Vins': '🍷',
  'Bières': '🍺',
  'Biere': '🍺',
  'Softs': '🥤',
  'Jus': '🧃',
  'Jus & Softs': '🧃',
  'Spiritueux': '🥃',
  'Champagnes': '🥂',
  'Champagne': '🥂',
  'Chauds': '☕',
  'Boissons chaudes': '☕',
  'default': '🍸',
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
      Alert.alert('Champ requis', 'Le nom de la catégorie est obligatoire.');
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
        <View style={[s.header, { backgroundColor: ACCENT }]}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {initial ? '✏️ Modifier la catégorie' : '➕ Nouvelle catégorie'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.hint}>
            Les catégories organisent votre carte de boissons (ex : Bières, Vins, Cocktails...)
          </Text>

          <Text style={s.label}>Nom de la catégorie *</Text>
          <TextInput
            style={s.input}
            placeholder="Ex: Cocktails, Vins, Bières..."
            placeholderTextColor="#bbb"
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={60}
          />

          <Text style={s.label}>Description (optionnel)</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Ex: Notre sélection de vins locaux et importés"
            placeholderTextColor="#bbb"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={200}
          />

          <Text style={s.suggestTitle}>Suggestions rapides :</Text>
          <View style={s.suggestRow}>
            {['🍺 Bières', '🍷 Vins', '🥃 Spiritueux', '🍸 Cocktails', '🧃 Jus & Softs', '☕ Chauds', '🥂 Champagnes'].map(sug => (
              <TouchableOpacity
                key={sug}
                style={s.suggestChip}
                onPress={() => setName(sug.replace(/^.+?\s/, ''))}
              >
                <Text style={s.suggestText}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.saveBtnText}>
                  {initial ? 'Enregistrer' : 'Créer la catégorie'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  body: { padding: 20, gap: 4, paddingBottom: 120 },
  hint: { backgroundColor: '#F5F0FF', borderRadius: 10, padding: 12, fontSize: 13, color: '#6C3483', lineHeight: 18, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1a1a1a', backgroundColor: '#fafafa' },
  textArea: { height: 80, textAlignVertical: 'top' },
  suggestTitle: { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 20, marginBottom: 10 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F5F0FF', borderWidth: 1, borderColor: '#D8B4FE' },
  suggestText: { fontSize: 13, color: ACCENT, fontWeight: '600' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, backgroundColor: ACCENT },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export const BarCollectionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('Mon Bar');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editCollection, setEditCollection] = useState<Collection | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (!store?.id) return;
      setStoreId(store.id);
      setStoreName(store.name || 'Mon Bar');
      const cols = await collectionService.getByStore(store.id);
      setCollections(cols || []);
    } catch (e) {
      console.warn('Error loading bar collections:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleSave = async (name: string, description: string) => {
    if (!storeId) return;
    setSaving(true);
    try {
      if (editCollection) {
        await collectionService.update(editCollection.id, { name, description: description || undefined } as any);
        setCollections(prev => prev.map(c => c.id === editCollection.id ? { ...c, name, description } : c));
        Alert.alert('✅ Succès', `Catégorie "${name}" modifiée.`);
      } else {
        const created = await collectionService.create({ store_id: storeId, name, description: description || undefined, is_active: true } as any);
        setCollections(prev => [created, ...prev]);
        Alert.alert('✅ Succès', `Catégorie "${name}" créée.`);
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
      'Supprimer la catégorie',
      `Voulez-vous supprimer "${col.name}" ? Les boissons ne seront pas supprimées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              await collectionService.delete(col.id);
              setCollections(prev => prev.filter(c => c.id !== col.id));
              Alert.alert('✅ Supprimé', `Catégorie "${col.name}" supprimée.`);
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer cette catégorie.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg ?? '#f8f8f8' }}>
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>🍸 Catégories boissons</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>
            {storeName} · {collections.length} catégorie{collections.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: 10 }}
          onPress={() => { setEditCollection(null); setShowModal(true); }}
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
          {collections.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
              <Text style={{ fontSize: 64 }}>🍸</Text>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '700' }}>Aucune catégorie</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                Créez des catégories pour votre carte{'\n'}(Bières, Vins, Cocktails, Spiritueux...)
              </Text>
              <TouchableOpacity
                onPress={() => { setEditCollection(null); setShowModal(true); }}
                style={{ marginTop: 8, backgroundColor: ACCENT, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Créer une catégorie</Text>
              </TouchableOpacity>
            </View>
          ) : (
            collections.map((col, idx) => {
              const emoji = BAR_EMOJIS[col.name] ?? BAR_EMOJIS['default'];
              const accentColor = BAR_SECTION_COLORS[idx % BAR_SECTION_COLORS.length];
              return (
                <View
                  key={col.id}
                  style={{ backgroundColor: COLORS.card ?? '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 }}
                >
                  <View style={{ height: 4, backgroundColor: accentColor }} />
                  <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: accentColor + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 26 }}>{emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 16 }}>{col.name}</Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
                        {col.description || 'Catégorie de boissons'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
                      onPress={() => navigation.navigate('SellerCollectionProducts', { collectionId: col.id, collectionName: col.name })}
                    >
                      <Ionicons name="wine-outline" size={16} color={accentColor} />
                      <Text style={{ color: accentColor, fontWeight: '600', fontSize: 13 }}>Voir boissons</Text>
                    </TouchableOpacity>

                    <View style={{ width: 1, backgroundColor: '#f0f0f0', marginVertical: 8 }} />

                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
                      onPress={() => { setEditCollection(col); setShowModal(true); }}
                    >
                      <Ionicons name="pencil" size={16} color="#3B82F6" />
                      <Text style={{ color: '#3B82F6', fontWeight: '600', fontSize: 13 }}>Modifier</Text>
                    </TouchableOpacity>

                    <View style={{ width: 1, backgroundColor: '#f0f0f0', marginVertical: 8 }} />

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

          {collections.length > 0 && (
            <TouchableOpacity
              onPress={() => { setEditCollection(null); setShowModal(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 2, borderColor: ACCENT, borderStyle: 'dashed' }}
            >
              <Ionicons name="add-circle-outline" size={20} color={ACCENT} />
              <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 14 }}>Ajouter une catégorie</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

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

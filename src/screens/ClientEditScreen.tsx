import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { orderService, storeService, supabase } from '../lib/supabase';
import { useAuthStore } from '../store';

interface RouteParams {
  clientId: string;
}

interface FormState {
  name: string;
  phone: string;
  notes: string;
}

const FIELD_CONFIGS: { key: keyof FormState; label: string; placeholder: string; icon: string; keyboardType?: any; multiline?: boolean }[] = [
  {
    key: 'name',
    label: 'Nom du client',
    placeholder: 'Prénom Nom',
    icon: 'person-outline',
  },
  {
    key: 'phone',
    label: 'Numéro de téléphone',
    placeholder: '+241 66 12 28 52',
    icon: 'call-outline',
    keyboardType: 'phone-pad',
  },
  {
    key: 'notes',
    label: 'Notes internes',
    placeholder: 'Informations supplémentaires sur ce client…',
    icon: 'document-text-outline',
    multiline: true,
  },
];

export const ClientEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  // Support both stack params and URL query (web)
  const clientIdFromParams = (route as any)?.params?.clientId as string | undefined;
  const clientIdFromQuery =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('clientId') || undefined
      : undefined;
  const clientId = clientIdFromParams || clientIdFromQuery || '';

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [storeId, setStoreId]   = useState<string>('');
  const [orderIds, setOrderIds] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>({
    name: '',
    phone: clientId,
    notes: '',
  });
  const [initialForm, setInitialForm] = useState<FormState | null>(null);

  // ── Load existing client data from orders ──────────────────────────────────
  const loadClient = useCallback(async () => {
    if (!user?.id || !clientId) { setLoading(false); return; }
    try {
      const store = await storeService.getByUser(user.id);
      if (!store?.id) { setLoading(false); return; }
      setStoreId(store.id);

      const allOrders: any[] = await orderService.getByStore(store.id);

      // Find orders matching this clientId (phone)
      const clientOrders = allOrders.filter((o: any) => {
        const phone = String(o?.customer_phone || '').trim();
        const name  = String(o?.customer_name || '').trim();
        const uid   = String(o?.user_id || '').trim();
        const id    = phone || name || uid || o?.id || '';
        return id === clientId || phone === clientId;
      });

      setOrderIds(clientOrders.map((o: any) => o.id));

      // Extract client info from first order
      const found = clientOrders[0];
      if (found) {
        const loaded: FormState = {
          name:  String(found.customer_name || ''),
          phone: String(found.customer_phone || clientId),
          notes: String(found.notes || ''),
        };
        setForm(loaded);
        setInitialForm(loaded);
      } else {
        setInitialForm({ name: '', phone: clientId, notes: '' });
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de charger les données client');
    } finally {
      setLoading(false);
    }
  }, [user?.id, clientId]);

  useEffect(() => { loadClient(); }, [loadClient]);

  const isDirty = initialForm
    ? form.name !== initialForm.name || form.phone !== initialForm.phone || form.notes !== initialForm.notes
    : false;

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Erreur', 'Le nom du client est requis');
      return;
    }
    if (!form.phone.trim()) {
      Alert.alert('Erreur', 'Le numéro de téléphone est requis');
      return;
    }

    setSaving(true);
    try {
      if (!supabase) throw new Error('Supabase non initialisé');

      if (orderIds.length === 0) {
        Alert.alert('Aucune commande', 'Aucune commande trouvée pour ce client.');
        return;
      }

      // Bulk-update all orders for this client
      const { error } = await supabase
        .from('orders')
        .update({
          customer_name:  form.name.trim(),
          customer_phone: form.phone.trim(),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        })
        .in('id', orderIds);

      if (error) throw error;

      Alert.alert(
        'Succès ✓',
        `Les informations de ${form.name} ont été mises à jour sur ${orderIds.length} commande(s).`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de sauvegarder les modifications');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      Alert.alert(
        'Abandonner les modifications ?',
        'Vos modifications non enregistrées seront perdues.',
        [
          { text: 'Continuer l\'édition', style: 'cancel' },
          { text: 'Abandonner', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Chargement du profil…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleCancel}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Modifier le client</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{form.phone || clientId}</Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!isDirty || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isDirty || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Enregistrer</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Info banner ────────────────────────────────────────── */}
        {orderIds.length > 0 && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.accent} />
            <Text style={styles.infoBannerText}>
              Ces changements s'appliqueront aux {orderIds.length} commande(s) de ce client.
            </Text>
          </View>
        )}

        {/* ── Form ───────────────────────────────────────────────── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {FIELD_CONFIGS.map(field => (
            <View key={field.key} style={styles.fieldWrapper}>
              <View style={styles.labelRow}>
                <Ionicons name={field.icon as any} size={16} color={COLORS.textMuted} />
                <Text style={styles.label}>{field.label}</Text>
                {(field.key === 'name' || field.key === 'phone') && (
                  <Text style={styles.required}>*</Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.input,
                  field.multiline && styles.inputMultiline,
                  // highlight if changed
                  initialForm && form[field.key] !== initialForm[field.key] && styles.inputModified,
                ]}
                value={form[field.key]}
                onChangeText={text => setForm(prev => ({ ...prev, [field.key]: text }))}
                placeholder={field.placeholder}
                placeholderTextColor={COLORS.textMuted}
                keyboardType={field.keyboardType || 'default'}
                multiline={field.multiline}
                numberOfLines={field.multiline ? 4 : 1}
                textAlignVertical={field.multiline ? 'top' : 'center'}
                autoCapitalize={field.key === 'name' ? 'words' : 'none'}
              />
              {/* Show "modified" hint */}
              {initialForm && form[field.key] !== initialForm[field.key] && (
                <Text style={styles.modifiedHint}>Modifié</Text>
              )}
            </View>
          ))}

          {/* Read-only metadata section */}
          <View style={styles.metaSection}>
            <Text style={styles.metaSectionTitle}>Informations non modifiables</Text>
            <View style={styles.metaRow}>
              <Ionicons name="receipt-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.metaText}>
                {orderIds.length} commande(s) associée(s)
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="key-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>ID : {clientId}</Text>
            </View>
          </View>

          {/* Save button (bottom) */}
          <TouchableOpacity
            style={[styles.saveButtonFull, (!isDirty || saving) && styles.saveButtonFullDisabled]}
            onPress={handleSave}
            disabled={!isDirty || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.saveButtonFullText}>Enregistrer les modifications</Text>
                </>
              )
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  headerSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 1 },
  saveBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    minWidth: 90,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },

  // Info banner
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.accent + '12',
    borderBottomWidth: 1, borderBottomColor: COLORS.accent + '20',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  infoBannerText: { fontSize: FONT_SIZE.xs, color: COLORS.accent, flex: 1 },

  // Form
  formContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },

  fieldWrapper: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, flex: 1 },
  required: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '700' },

  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  inputMultiline: {
    minHeight: 90,
    paddingTop: SPACING.md,
  },
  inputModified: {
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  modifiedHint: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },

  // Meta section
  metaSection: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  metaSectionTitle: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: FONT_SIZE.sm, color: COLORS.textSoft, flex: 1 },

  // Bottom save button
  saveButtonFull: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.lg,
  },
  saveButtonFullDisabled: { opacity: 0.4 },
  saveButtonFullText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
});

export default ClientEditScreen;

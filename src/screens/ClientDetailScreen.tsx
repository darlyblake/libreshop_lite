import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { orderService, storeService } from '../lib/supabase';
import { useAuthStore } from '../store';

interface RouteParams {
  clientId: string;
}

interface Order {
  id: string;
  customer_phone: string;
  customer_name?: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  order_items?: any[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'En attente',  color: '#F59E0B', icon: 'time-outline' },
  paid:      { label: 'Payée',       color: '#3B82F6', icon: 'card-outline' },
  shipped:   { label: 'Expédiée',    color: '#8B5CF6', icon: 'cube-outline' },
  delivered: { label: 'Livrée',      color: '#10B981', icon: 'checkmark-done-circle-outline' },
  cancelled: { label: 'Annulée',     color: '#EF4444', icon: 'close-circle-outline' },
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const formatAmount = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

export const ClientDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  // Support both stack params and URL query string (web)
  const clientIdFromParams = (route as any)?.params?.clientId as string | undefined;
  const clientIdFromQuery =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('clientId') || undefined
      : undefined;
  const clientId = clientIdFromParams || clientIdFromQuery || '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (!store?.id) return;

      const allOrders: any[] = await orderService.getByStore(store.id);

      // Filter by clientId (phone or name-based id used in SellerClientsScreen)
      const clientOrders = allOrders.filter((o: any) => {
        const phone = String(o?.customer_phone || '').trim();
        const name  = String(o?.customer_name || '').trim();
        const uid   = String(o?.user_id || '').trim();
        const id    = phone || name || uid || o?.id || '';
        return id === clientId || phone === clientId;
      });

      setOrders(
        clientOrders.map((o: any) => ({
          id: String(o.id),
          customer_phone: String(o.customer_phone || ''),
          customer_name:  String(o.customer_name || o?.users?.full_name || ''),
          total_amount:   Number(o.total_amount || 0),
          status:         (o.status as Order['status']) || 'pending',
          created_at:     String(o.created_at || ''),
          order_items:    Array.isArray(o.order_items) ? o.order_items : [],
        }))
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de charger les données client');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, clientId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ── Client stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = orders.length;
    const spent     = orders.reduce((s, o) => s + o.total_amount, 0);
    const avg       = total > 0 ? spent / total : 0;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const lastDate  = orders.length > 0
      ? orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : null;
    return { total, spent, avg, delivered, lastDate };
  }, [orders]);

  const clientName = useMemo(() => {
    const found = orders.find(o => o.customer_name);
    return found?.customer_name || clientId || 'Client';
  }, [orders, clientId]);

  const clientPhone = useMemo(() => {
    const found = orders.find(o => o.customer_phone);
    return found?.customer_phone || clientId || '';
  }, [orders, clientId]);

  const initials = clientName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('');

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    const phone = clientPhone.replace(/[^\d+]/g, '');
    if (!phone) {
      Alert.alert('Erreur', 'Numéro de téléphone indisponible');
      return;
    }
    const msg = `Bonjour ${clientName} 👋 Je vous contacte depuis LibreShop concernant vos commandes.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp')
    );
  };

  const handleCall = () => {
    const phone = clientPhone.replace(/[^\d+]/g, '');
    if (!phone) { Alert.alert('Erreur', 'Numéro indisponible'); return; }
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Erreur', 'Impossible de passer l\'appel')
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders]
  );

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Chargement du profil client…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[COLORS.accent, COLORS.accent2 || COLORS.accent]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Avatar + name ─── */}
        <View style={styles.headerContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </View>
          <Text style={styles.clientName} numberOfLines={1}>{clientName}</Text>
          {!!clientPhone && (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.clientPhone}>{clientPhone}</Text>
            </View>
          )}
        </View>

        {/* Contact buttons ─── */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactBtn} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.contactBtnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactBtn, styles.contactBtnSecondary]} onPress={handleCall}>
            <Ionicons name="call" size={20} color={COLORS.accent} />
            <Text style={[styles.contactBtnText, { color: COLORS.accent }]}>Appeler</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── KPIs ────────────────────────────────────────────────── */}
        <View style={styles.kpiGrid}>
          <KpiCard
            label="Commandes"
            value={String(stats.total)}
            icon="receipt-outline"
            color={COLORS.accent}
          />
          <KpiCard
            label="Total dépensé"
            value={stats.spent >= 1000 ? `${Math.round(stats.spent / 1000)}K` : String(Math.round(stats.spent))}
            icon="wallet-outline"
            color={COLORS.success}
          />
          <KpiCard
            label="Panier moyen"
            value={stats.avg >= 1000 ? `${Math.round(stats.avg / 1000)}K` : String(Math.round(stats.avg))}
            icon="pricetag-outline"
            color="#8B5CF6"
          />
          <KpiCard
            label="Livrées"
            value={String(stats.delivered)}
            icon="checkmark-done-outline"
            color={COLORS.warning}
          />
        </View>

        {/* Last order date ─── */}
        {stats.lastDate && (
          <View style={styles.lastOrderBanner}>
            <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.lastOrderText}>
              Dernière commande le {formatDate(stats.lastDate)}
            </Text>
          </View>
        )}

        {/* ── Order history ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des commandes</Text>

          {sortedOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Aucune commande trouvée</Text>
            </View>
          ) : (
            sortedOrders.map(order => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const itemsCount = (order.order_items || []).reduce(
                (s: number, it: any) => s + Number(it?.quantity || 0), 0
              );
              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => navigation.navigate('SellerOrderDetail', { orderId: order.id })}
                  activeOpacity={0.8}
                >
                  {/* Left color bar */}
                  <View style={[styles.orderColorBar, { backgroundColor: cfg.color }]} />

                  <View style={styles.orderMain}>
                    <View style={styles.orderTopRow}>
                      <Text style={styles.orderId} numberOfLines={1}>
                        #{order.id.slice(0, 8).toUpperCase()}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                        <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
                        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>

                    <View style={styles.orderBottomRow}>
                      <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                      {itemsCount > 0 && (
                        <Text style={styles.orderMeta}>· {itemsCount} art.</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.orderRight}>
                    <Text style={styles.orderAmount}>{formatAmount(order.total_amount)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.border} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ── Sub-component ────────────────────────────────────────────────────────────
const KpiCard: React.FC<{ label: string; value: string; icon: string; color: string }> = ({
  label, value, icon, color,
}) => (
  <View style={kpiStyles.card}>
    <View style={[kpiStyles.iconWrap, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon as any} size={20} color={color} />
    </View>
    <Text style={[kpiStyles.value, { color }]}>{value}</Text>
    <Text style={kpiStyles.label}>{label}</Text>
  </View>
);

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },

  // Header
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, paddingTop: SPACING.lg },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  headerContent: { alignItems: 'center', marginBottom: SPACING.lg },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: '#fff' },
  clientName: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: '#fff', marginBottom: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clientPhone: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.8)' },

  contactRow: { flexDirection: 'row', gap: SPACING.sm },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg,
    backgroundColor: '#25D366', // WhatsApp green
  },
  contactBtnSecondary: { backgroundColor: '#fff' },
  contactBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },

  // KPIs
  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg,
  },

  lastOrderBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  lastOrderText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  // Section
  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
  sectionTitle: {
    fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text,
    marginBottom: SPACING.md,
  },

  // Order card
  orderCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.sm, overflow: 'hidden',
  },
  orderColorBar: { width: 4, alignSelf: 'stretch' },
  orderMain: { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  orderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  orderId: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  orderBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderDate: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  orderMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  orderRight: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: SPACING.md },
  orderAmount: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.accent },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl * 2, gap: 8 },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted },
});

export default ClientDetailScreen;

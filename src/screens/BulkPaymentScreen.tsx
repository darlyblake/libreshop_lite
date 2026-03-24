import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { storeService } from '../lib/supabase';

export const BulkPaymentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params || {};
  const rawCreated = params.createdOrders ?? [];
  const rawGroups = params.groups ?? {};

  const createdOrders = typeof rawCreated === 'string' ? (() => {
    try { return JSON.parse(rawCreated); } catch { return Array.isArray(rawCreated) ? rawCreated : []; }
  })() : rawCreated;

  const groups = typeof rawGroups === 'string' ? (() => {
    try { return JSON.parse(rawGroups); } catch { return typeof rawGroups === 'object' ? rawGroups : {}; }
  })() : rawGroups;

  const [amountsMap, setAmountsMap] = useState<Record<string, number>>({});

  const renderItem = ({ item }: { item: any }) => {
    const itemsForStorePreview = groups[item.store_id || 'unknown'] || [];
    const storeName = itemsForStorePreview[0]?.product?.store_name || item.store_name || 'Divers';
    return (
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.storeName}>{storeName}</Text>
          <Text style={styles.amount}>{((amountsMap[item.id] ?? Number(item.total_amount)) || 0).toLocaleString()} FCA</Text>
        </View>
        <TouchableOpacity
          style={styles.payButton}
          onPress={() => {
            const itemsForStore = groups[item.store_id || 'unknown'] || [];
            const amountToPay = amountsMap[item.id] ?? Number(item.total_amount) ?? 0;
            navigation.navigate('Payment', {
              amount: Number(amountToPay) || 0,
              orderId: item.id,
              storeId: item.store_id,
              itemsJson: JSON.stringify(itemsForStore),
              existingOrder: true,
            });
          }}
        >
          <Text style={styles.payText}>Payer</Text>
          <Ionicons name="card-outline" size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>
    );
  };

  useEffect(() => {
    let mounted = true;
    const compute = async () => {
      try {
        const map: Record<string, number> = {};
        // for each created order, compute subtotal from groups if available, otherwise fallback to total_amount
        for (const ord of (createdOrders || [])) {
          const sid = ord.store_id || 'unknown';
          const group = (groups && (groups[sid] || groups[String(sid)])) || [];
          const subtotal = Array.isArray(group)
            ? group.reduce((s: number, it: any) => s + ((it.product?.price || it.price || 0) * (it.quantity || 0)), 0)
            : Number(ord.total_amount) || 0;

          let tax = 0;
          let shipping = 0;
          try {
            if (sid && sid !== 'unknown') {
              const store = await storeService.getById(sid);
              if (store) {
                tax = store.tax_rate ? Math.round(subtotal * (store.tax_rate / 100)) : 0;
                shipping = store.shipping_price || 0;
              }
            }
          } catch (e) {
            // ignore store fetch errors
          }

          map[ord.id] = subtotal + tax + shipping;
        }
        if (mounted) setAmountsMap(map);
      } catch (e) {
        // ignore
      }
    };
    compute();
    return () => { mounted = false; };
  }, [createdOrders, groups]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Payer vos commandes</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={createdOrders}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.xl }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xxl },
  back: { width: 44 },
  title: { flex: 1, textAlign: 'center', fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  info: {},
  storeName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  amount: { fontSize: FONT_SIZE.md, color: COLORS.textMuted },
  payButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full },
  payText: { color: COLORS.text, marginRight: SPACING.sm, fontWeight: '700' },
});

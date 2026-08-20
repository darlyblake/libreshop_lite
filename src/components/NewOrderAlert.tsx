import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../lib/supabase';
import { useStoreStore, useAuthStore } from '../store';
import { notificationService } from '../services/notificationService';

interface NewOrder {
  id: string;
  customer_name: string;
  shipping_address: string;
  total_amount: number;
}

export const NewOrderAlert: React.FC = () => {
  const navigation = useNavigation<any>();
  const { store } = useStoreStore();
  const { user } = useAuthStore();

  const [pendingOrder, setPendingOrder] = useState<NewOrder | null>(null);
  const [visible, setVisible] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const channelRef = useRef<any>(null);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = useCallback(() => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoopRef.current?.stop();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const playAlert = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/new_order.mp3'),
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
    } catch (e) {
      console.warn('[NewOrderAlert] Sound error:', e);
    }
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 300, 150, 300, 150, 600]);
    }
  }, []);

  const stopAlert = useCallback(async () => {
    stopPulse();
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (_) {}
  }, [stopPulse]);

  const handleDismiss = useCallback(async () => {
    await stopAlert();
    setVisible(false);
    setPendingOrder(null);
  }, [stopAlert]);

  const handleViewOrder = useCallback(async () => {
    await handleDismiss();
    navigation.navigate('SellerTabs', { screen: 'SellerOrders' });
  }, [handleDismiss, navigation]);

  useEffect(() => {
    const storeId = store?.id;
    if (!storeId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`new_order_alert:${storeId}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        async (payload: any) => {
          const order = payload.new as NewOrder;
          if (!order?.id) return;

          setPendingOrder(order);
          setVisible(true);
          startPulse();
          await playAlert();

          if (user?.id) {
            try {
              await notificationService.create({
                user_id: user.id,
                type: 'order',
                title: '🛎️ Nouvelle commande !',
                body: `${order.customer_name || 'Client'} — ${order.shipping_address || ''} — ${Number(order.total_amount).toLocaleString('fr-FR')} FCFA`,
                data: { store_id: storeId, order_id: order.id },
              });
            } catch (e) {
              console.warn('[NewOrderAlert] Push failed:', e);
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [store?.id, user?.id, startPulse, playAlert]);

  if (!visible || !pendingOrder) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="cart" size={32} color="#FFF" />
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🛎️  NOUVELLE COMMANDE</Text>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={styles.clientName}>{pendingOrder.customer_name || 'Client'}</Text>
            {pendingOrder.shipping_address ? (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color="#94a3b8" />
                <Text style={styles.infoText}>{pendingOrder.shipping_address}</Text>
              </View>
            ) : null}
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>TOTAL</Text>
              <Text style={styles.amountValue}>
                {Number(pendingOrder.total_amount).toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnDismiss} onPress={handleDismiss}>
              <Text style={styles.btnDismissText}>Plus tard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnView} onPress={handleViewOrder}>
              <Ionicons name="receipt-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnViewText}>Voir la commande</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  header: { alignItems: 'center', marginBottom: 20 },
  iconBadge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#7c3aed22',
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: '#7c3aed',
  },
  badgeText: { color: '#a78bfa', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  body: { alignItems: 'center', marginBottom: 24 },
  clientName: { color: '#FFF', fontSize: 26, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  infoText: { color: '#94a3b8', fontSize: 14 },
  amountBox: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 32,
    alignItems: 'center', width: '100%',
  },
  amountLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  amountValue: { color: '#10b981', fontSize: 28, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 12 },
  btnDismiss: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#334155', alignItems: 'center',
  },
  btnDismissText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  btnView: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#7c3aed', alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  btnViewText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});

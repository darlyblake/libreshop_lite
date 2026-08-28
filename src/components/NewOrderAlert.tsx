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
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../lib/supabase';
import { useStoreStore, useAuthStore } from '../store';
import { notificationService } from '../services/notificationService';
import { tableService } from '../services/tableService';
import { COLORS } from '../config/theme';

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
  const [pendingCall, setPendingCall] = useState<any | null>(null);
  const [visible, setVisible] = useState(false);
  const [visibleCall, setVisibleCall] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const channelRef = useRef<any>(null);
  const callChannelRef = useRef<any>(null);
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
        { uri: 'https://cdn.freesound.org/previews/415/415763_5121236-lq.mp3' },
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
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  }, [stopPulse]);

  const handleDismiss = useCallback(async () => {
    await stopAlert();
    setVisible(false);
    setPendingOrder(null);
  }, [stopAlert]);

  const handleDismissCall = useCallback(async () => {
    await stopAlert();
    setVisibleCall(false);
    
    // Mark as resolved
    if (pendingCall?.id) {
      supabase.from('waiter_calls').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', pendingCall.id).then();
    }
    setPendingCall(null);
  }, [stopAlert, pendingCall]);

  const handleViewOrder = useCallback(async () => {
    await handleDismiss();
    navigation.navigate('SellerTabs', { screen: 'SellerOrders' });
  }, [handleDismiss, navigation]);

  useEffect(() => {
    let storeId = store?.id;
    let mounted = true;
    
    const subscribeToOrders = (sId: string) => {
      // Clean up previous channels before creating new ones
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      }

      const channel = supabase
        .channel(`new_order_alert:${sId}`)
        .on(
          'postgres_changes' as any,
          { event: 'INSERT', schema: 'public', table: 'orders', filter: `store_id=eq.${sId}` },
          async (payload: any) => {
            if (!mounted) return;
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
                  data: { store_id: sId, order_id: order.id },
                });
              } catch (e) {
                console.warn('[NewOrderAlert] Push failed:', e);
              }
            }
          }
        )
        .subscribe();

      const callChannel = supabase
        .channel(`new_waiter_call:${sId}`)
        .on(
          'postgres_changes' as any,
          { event: 'INSERT', schema: 'public', table: 'waiter_calls', filter: `store_id=eq.${sId}` },
          async (payload: any) => {
            if (!mounted) return;
            const call = payload.new;
            if (!call?.id) return;

            // Mark table as occupied in the backend
            if (call.table_number) {
              const tableId = `table_${sId}_${call.table_number}`;
              tableService.openTable(sId, tableId, 1).catch(e => console.error(e));
            }

            // Show alert
            setPendingCall(call);
            setVisibleCall(true);
            startPulse();
            await playAlert();
          }
        )
        .subscribe();

      channelRef.current = channel;
      callChannelRef.current = callChannel;
    };

    const initStore = async () => {
      // If storeId is already known (vendor selected store), subscribe directly
      if (storeId) {
        subscribeToOrders(storeId);
        return;
      }

      // Fallback: try to find the seller's store by user_id
      if (!user?.id) return;
      
      try {
        const { data } = await supabase.from('stores').select('id').eq('user_id', user.id).maybeSingle();
        if (mounted && data?.id) {
          subscribeToOrders(data.id);
        }
      } catch (e) {
        console.warn('[NewOrderAlert] Could not find store for user:', e);
      }
    };
    
    initStore();

    return () => { 
      mounted = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current); 
      if (callChannelRef.current) supabase.removeChannel(callChannelRef.current); 
    };
  }, [store?.id, user?.id, startPulse, playAlert]);

  if (!visible && !visibleCall) return null;

  return (
    <Modal visible={visible || visibleCall} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={[COLORS.primary, '#9333ea']} style={styles.header}>
            <Ionicons 
              name={visibleCall ? (pendingCall?.customer_name === 'OCCUPY_EVENT' ? "log-in" : "hand-right") : "notifications"} 
              size={32} 
              color="#FFF" 
            />
            <Text style={styles.title}>
              {visibleCall 
                ? (pendingCall?.customer_name === 'OCCUPY_EVENT' ? 'Table Occupée !' : 'Appel Serveur !') 
                : 'Nouvelle commande !'}
            </Text>
          </LinearGradient>

          {visibleCall && pendingCall ? (
            <View style={styles.content}>
              <View style={styles.row}>
                <Ionicons name="restaurant" size={20} color={COLORS.textMuted} />
                <Text style={styles.text}>Table : {pendingCall.table_number}</Text>
              </View>
              {pendingCall.customer_name !== 'OCCUPY_EVENT' && (
                <View style={styles.row}>
                  <Ionicons name="person" size={20} color={COLORS.textMuted} />
                  <Text style={styles.text}>Client : {pendingCall.customer_name || 'Inconnu'}</Text>
                </View>
              )}
              <View style={styles.row}>
                <Ionicons name="time" size={20} color={COLORS.textMuted} />
                <Text style={styles.text}>{new Date(pendingCall.created_at).toLocaleTimeString()}</Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.btnSecondary} onPress={handleDismissCall}>
                  <Text style={styles.btnSecondaryText}>Fermer & Ignorer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleDismissCall}>
                  <Text style={styles.btnPrimaryText}>J'y vais (Résolu)</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : visible && pendingOrder ? (
            <View style={styles.content}>
              <View style={styles.row}>
                <Ionicons name="person" size={20} color={COLORS.textMuted} />
                <Text style={styles.text}>{pendingOrder.customer_name || 'Client inconnu'}</Text>
              </View>
              <View style={styles.row}>
                <Ionicons name="location" size={20} color={COLORS.textMuted} />
                <Text style={styles.text}>{pendingOrder.shipping_address || 'Sur place'}</Text>
              </View>
              <View style={styles.row}>
                <Ionicons name="cash" size={20} color={COLORS.textMuted} />
                <Text style={styles.total}>{Number(pendingOrder.total_amount).toLocaleString('fr-FR')} FCFA</Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.btnSecondary} onPress={handleDismiss}>
                  <Text style={styles.btnSecondaryText}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleViewOrder}>
                  <Text style={styles.btnPrimaryText}>Voir la commande</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
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
    backgroundColor: COLORS.card,
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
  },
  header: { 
    alignItems: 'center', 
    padding: 24,
    flexDirection: 'column',
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
  },
  content: {
    padding: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  text: {
    color: COLORS.text,
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  total: {
    color: COLORS.primary,
    fontSize: 24,
    marginLeft: 12,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnSecondaryText: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFF',
    fontWeight: '700',
  },
});


import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { orderService } from '../services/orderService';

const BAR_COLORS = ['#6C3483', '#8E44AD'] as const;

const STATUS_TABS = [
  { id: 'pending', label: 'En attente', emoji: '⏳', color: '#F59E0B' },
  { id: 'accepted', label: 'En préparation', emoji: '🍸', color: '#3B82F6' },
  { id: 'paid', label: 'Servies', emoji: '✅', color: '#10B981' },
  { id: 'cancelled', label: 'Annulées', emoji: '❌', color: '#EF4444' },
];

export const BarOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;

  const [activeTab, setActiveTab] = useState('pending');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storeName, setStoreName] = useState('');

  const loadOrders = useCallback(async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (!store?.id) return;
      setStoreName(store.name || 'Mon Bar');
      const result = await orderService.getByStore(store.id, { status: activeTab as any });
      setOrders(result.items || []);
    } catch (e) {
      console.warn('Error loading orders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, activeTab]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const onRefresh = () => { setRefreshing(true); loadOrders(); };

  const activeTabConfig = STATUS_TABS.find(t => t.id === activeTab) || STATUS_TABS[0];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <LinearGradient
        colors={BAR_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 20,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>🍸 Commandes bar</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>
          {storeName} • {orders.length} commande{orders.length !== 1 ? 's' : ''}
        </Text>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: COLORS.card, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
      >
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => { setActiveTab(tab.id); setLoading(true); }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: activeTab === tab.id ? tab.color : COLORS.surface,
            }}
          >
            <Text style={{ fontSize: 16 }}>{tab.emoji}</Text>
            <Text style={{
              color: activeTab === tab.id ? '#fff' : COLORS.textSoft,
              fontWeight: activeTab === tab.id ? '700' : '500',
              fontSize: 13,
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#8E44AD" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8E44AD']} />}
        >
          {orders.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ fontSize: 48 }}>{activeTabConfig.emoji}</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 16, marginTop: 12 }}>Aucune commande {activeTabConfig.label.toLowerCase()}</Text>
            </View>
          ) : orders.map(order => (
            <TouchableOpacity
              key={order.id}
              onPress={() => navigation.navigate('SellerOrderDetail', { orderId: order.id })}
              style={{
                backgroundColor: COLORS.card,
                borderRadius: 16,
                padding: 16,
                borderLeftWidth: 4,
                borderLeftColor: activeTabConfig.color,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 16 }}>
                  #{order.id?.slice(-6).toUpperCase()}
                </Text>
                <View style={{ backgroundColor: activeTabConfig.color + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: activeTabConfig.color, fontWeight: '700', fontSize: 12 }}>
                    {activeTabConfig.emoji} {activeTabConfig.label}
                  </Text>
                </View>
              </View>
              <Text style={{ color: COLORS.textSoft, fontSize: 13, marginTop: 6 }}>
                {order.customer_name || 'Client anonyme'} • {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 18, marginTop: 8 }}>
                {Number(order.total || 0).toLocaleString()} FCFA
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

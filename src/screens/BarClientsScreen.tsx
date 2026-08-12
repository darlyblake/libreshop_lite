import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput
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

const FILTER_TABS = [
  { id: 'all', label: 'Tous', emoji: '👥' },
  { id: 'regular', label: 'Réguliers', emoji: '⭐' },
  { id: 'vip', label: 'VIP', emoji: '👑' },
];

const LOYALTY_TIERS: Record<string, { label: string; color: string; emoji: string }> = {
  Bronze: { label: 'Bronze', color: '#CD7F32', emoji: '🥉' },
  Silver: { label: 'Argent', color: '#C0C0C0', emoji: '🥈' },
  Gold: { label: 'Or', color: '#FFD700', emoji: '🥇' },
};

const getLoyaltyTier = (visits: number) => {
  if (visits >= 20) return 'Gold';
  if (visits >= 10) return 'Silver';
  return 'Bronze';
};

const getAvatarColor = (name: string) => {
  const colors = ['#8E44AD', '#6C3483', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
};

export const BarClientsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const themeContext = useTheme();
  const COLORS = themeContext.getColor;

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [storeName, setStoreName] = useState('');

  const loadClients = useCallback(async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (!store?.id) return;
      setStoreName(store.name || 'Mon Bar');
      const orders = await orderService.getByStore(store.id, {});
      if (!orders) return;
      const clientMap: Record<string, any> = {};
      (orders.items || []).forEach((order: any) => {
        const name = order.customer_name || 'Anonyme';
        const phone = order.customer_phone || '';
        const key = phone || name;
        if (!clientMap[key]) {
          clientMap[key] = { id: key, name, phone, visits: 0, totalSpent: 0, lastOrder: order.created_at };
        }
        clientMap[key].visits++;
        clientMap[key].totalSpent += Number(order.total || 0);
        if (order.created_at > clientMap[key].lastOrder) clientMap[key].lastOrder = order.created_at;
      });
      setClients(Object.values(clientMap).sort((a: any, b: any) => b.visits - a.visits));
    } catch (e) {
      console.warn('Error loading bar clients:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const onRefresh = () => { setRefreshing(true); loadClients(); };

  const filteredClients = clients.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchFilter = activeFilter === 'all' || (activeFilter === 'regular' && c.visits >= 5) || (activeFilter === 'vip' && c.visits >= 20);
    return matchSearch && matchFilter;
  });

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
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>🍸 Habitués du bar</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>
          {storeName} • {clients.length} client{clients.length !== 1 ? 's' : ''}
        </Text>
      </LinearGradient>

      <View style={{
        margin: 16, marginBottom: 8,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.card, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 10, gap: 10,
      }}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Rechercher un habitué..."
          placeholderTextColor={COLORS.textMuted}
          style={{ flex: 1, color: COLORS.text, fontSize: 15 }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity key={tab.id} onPress={() => setActiveFilter(tab.id)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
              backgroundColor: activeFilter === tab.id ? '#8E44AD' : COLORS.card,
            }}
          >
            <Text style={{ fontSize: 14 }}>{tab.emoji}</Text>
            <Text style={{
              color: activeFilter === tab.id ? '#fff' : COLORS.textSoft,
              fontWeight: activeFilter === tab.id ? '700' : '500', fontSize: 13,
            }}>{tab.label}</Text>
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
          {filteredClients.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ fontSize: 64 }}>🍸</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 16, marginTop: 12 }}>Aucun habitué trouvé</Text>
            </View>
          ) : filteredClients.map(client => {
            const tier = getLoyaltyTier(client.visits);
            const tierConfig = LOYALTY_TIERS[tier];
            const avatarColor = getAvatarColor(client.name);
            return (
              <View key={client.id} style={{
                backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
                flexDirection: 'row', alignItems: 'center', gap: 14,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
              }}>
                <View style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: avatarColor, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 22 }}>
                    {client.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 16 }}>{client.name}</Text>
                    <Text style={{ fontSize: 16 }}>{tierConfig.emoji}</Text>
                  </View>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 2 }}>{client.phone || 'Pas de téléphone'}</Text>
                  <Text style={{ color: COLORS.textSoft, fontSize: 12, marginTop: 4 }}>
                    {client.visits} visite{client.visits !== 1 ? 's' : ''} • {Number(client.totalSpent).toLocaleString()} FCFA
                  </Text>
                </View>
                <View style={{ backgroundColor: tierConfig.color + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: tierConfig.color, fontWeight: '700', fontSize: 11 }}>{tierConfig.label}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

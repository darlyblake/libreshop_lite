import React, { useEffect, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore, Notification } from '../store/notificationStore';
import { notificationService } from '../lib/notificationService';
import { useAuthStore, useStoreStore } from '../store';
import { NotificationItem } from '../components/NotificationItem';
import { EmptyState } from '../components/EmptyState';
import { COLORS, SPACING, FONT_SIZE } from '../config/theme';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { store } = useStoreStore();
  const [refreshing, setRefreshing] = useState(false);
  const {
    notifications,
    unreadCount,
    setNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotificationStore();

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => !n.read),
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await notificationService.getByUser(user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [user, setNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await notificationService.markAsRead(notification.id);
        markAsRead(notification.id);
      } catch (e) {
        console.error('mark notification as read', e);
      }
    }

    const data = (notification.data || {}) as Record<string, any>;
    const orderId = data.orderId ? String(data.orderId) : null;
    const productId = data.productId ? String(data.productId) : null;
    const storeId = data.storeId ? String(data.storeId) : null;

    const isSellerContext = Boolean(user?.id && store?.user_id && String(store.user_id) === String(user.id));

    if (orderId) {
      navigation.navigate(isSellerContext ? 'SellerOrderDetail' : 'ClientOrderDetail', { orderId });
      return;
    }

    if (productId) {
      navigation.navigate('ProductDetail', { productId });
      return;
    }

    if (storeId) {
      navigation.navigate('StoreDetail', { storeId });
      return;
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <NotificationItem
      notification={item}
      onPress={() => handleNotificationPress(item)}
    />
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!user) return;
    try {
      await notificationService.markAllAsRead(user.id);
      markAllAsRead();
    } catch (e) {
      console.error('mark all as read', e);
    }
  }, [user, markAllAsRead]);

  const handleClearAll = useCallback(() => {
    if (!user) return;
    Alert.alert(
      'Effacer',
      'Supprimer toutes les notifications ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.deleteAllByUser(user.id);
              clearAll();
            } catch (e) {
              console.error('clear notifications', e);
            }
          },
        },
      ]
    );
  }, [user, clearAll]);

  const onRefresh = useCallback(() => {
    const run = async () => {
      setRefreshing(true);
      await loadNotifications();
      setRefreshing(false);
    };
    run();
  }, [loadNotifications]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={handleMarkAllRead}
            >
              <Text style={styles.markAllText}>Tout marquer lu</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleClearAll}
          >
            <Text style={styles.markAllText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Unread Count Badge */}
      {unreadCount > 0 && (
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount} non lu(s)</Text>
          </View>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={visibleNotifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="Aucune notification"
            description="Vous n'avez pas encore de notifications"
          />
        }
      />
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
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  markAllText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  badgeContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  badge: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
});


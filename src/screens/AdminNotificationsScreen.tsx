import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { BackToDashboard } from '../components/BackToDashboard';
import { Ionicons } from '@expo/vector-icons';
import { notificationService } from '../lib/notificationService';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  time: string;
  read: boolean;
}

const mapDbTypeToUiType = (type?: string): Notification['type'] => {
  switch (type) {
    case 'payment':
      return 'success';
    case 'order':
      return 'info';
    case 'promo':
      return 'warning';
    case 'system':
    default:
      return 'info';
  }
};

const formatTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'warning':
      return 'warning-outline';
    case 'success':
      return 'checkmark-circle-outline';
    case 'error':
      return 'close-circle-outline';
    default:
      return 'information-circle-outline';
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'warning':
      return COLORS.warning;
    case 'success':
      return COLORS.success;
    case 'error':
      return COLORS.danger;
    default:
      return COLORS.info;
  }
};

export const AdminNotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) {
      setNotifications([]);
      return;
    }
    const rows = await notificationService.getByUser(userId);
    setNotifications(
      rows.map((r) => ({
        id: String(r.id),
        title: String(r.title || ''),
        message: String(r.body || ''),
        type: mapDbTypeToUiType(r.type),
        time: formatTime(r.created_at),
        read: Boolean(r.read),
      }))
    );
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications()
      .catch((e) => console.error('refresh notifications', e))
      .finally(() => setRefreshing(false));
  };

  const handleNotificationPress = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif)));
    } catch (e) {
      console.error('mark notification as read', e);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await Promise.all(notifications.map((n) => notificationService.delete(n.id)));
      setNotifications([]);
    } catch (e) {
      console.error('clear notifications', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { data } = await supabase!.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return;
      await notificationService.markAllAsRead(userId);
      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    } catch (e) {
      console.error('mark all as read', e);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      <View style={styles.headerSection}>
        <Text style={styles.title}>Notifications</Text>
        {notifications.length > 0 && (
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleMarkAllAsRead}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-all" size={18} color={COLORS.accent} />
                <Text style={styles.actionButtonText}>Lire tout</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton]}
              onPress={handleClearAllNotifications}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              <Text style={[styles.actionButtonText, styles.clearButtonText]}>Nettoyer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.notificationItem,
              !item.read && styles.notificationUnread,
            ]}
            onPress={() => handleNotificationPress(item.id)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: getNotificationColor(item.type) + '20',
                },
              ]}
            >
              <Ionicons
                name={getNotificationIcon(item.type)}
                size={20}
                color={getNotificationColor(item.type)}
              />
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucune notification</Text>
          </View>
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
  headerSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent + '10',
    gap: SPACING.xs,
  },
  clearButton: {
    backgroundColor: COLORS.danger + '10',
  },
  actionButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.accent,
  },
  clearButtonText: {
    color: COLORS.danger,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  notificationUnread: {
    backgroundColor: COLORS.accent + '08',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  time: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginLeft: SPACING.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
});

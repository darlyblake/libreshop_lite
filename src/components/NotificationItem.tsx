import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Notification } from '../store/notificationStore';
import { useTheme } from '../hooks/useTheme';

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
}) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(themeContext) : {}, [themeContext]);

  const getIcon = (type: Notification['type']): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'order':
        return 'receipt-outline';
      case 'payment':
        return 'card-outline';
      case 'promo':
        return 'pricetag-outline';
      case 'system':
        return 'information-circle-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getIconColor = (type: Notification['type']): string => {
    switch (type) {
      case 'order':
        return COLORS.accent;
      case 'payment':
        return COLORS.success;
      case 'promo':
        return COLORS.warning;
      case 'system':
        return COLORS.accent2;
      default:
        return COLORS.textMuted;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !notification.read && styles.unread,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: getIconColor(notification.type) + '20' }]}>
        <Ionicons
          name={getIcon(notification.type)}
          size={24}
          color={getIconColor(notification.type)}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.date}>
          {formatDate(notification.created_at)}
        </Text>
      </View>
      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  unread: {
    backgroundColor: COLORS.cardHover,
    borderColor: COLORS.accent + '40',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  body: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
    marginBottom: SPACING.xs,
  },
  date: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    marginLeft: SPACING.sm,
  },
});
};


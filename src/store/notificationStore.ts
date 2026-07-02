import { create } from 'zustand';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'order' | 'payment' | 'promo' | 'system' | 'comment' | 'like' | 'admin';
  read: boolean;
  created_at: string;
  data?: Record<string, any>;
}

export const isClientNotification = (n: Notification) => {
  // Primary classifier: use the targetRole field stored in notification data
  const targetRole = n.data?.targetRole as string | undefined;
  if (targetRole) return targetRole === 'client';
  // Fallback for legacy notifications without targetRole
  if (n.type === 'promo') return true;
  if (n.type === 'order') return n.data?.status !== undefined;
  return false;
};

export const isSellerNotification = (n: Notification) => {
  const targetRole = n.data?.targetRole as string | undefined;
  if (targetRole) return targetRole === 'seller';
  // Fallback for legacy notifications without targetRole
  if (n.type === 'admin') return false;
  return !isClientNotification(n);
};

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  clientUnreadCount: number;
  sellerUnreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (context?: 'client' | 'seller') => void;
  clearRead: () => void;
  clearAll: (context?: 'client' | 'seller') => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  clientUnreadCount: 0,
  sellerUnreadCount: 0,
  setNotifications: (notifications) => 
    set({ 
      notifications, 
      unreadCount: notifications.filter(n => !n.read).length,
      clientUnreadCount: notifications.filter(n => !n.read && isClientNotification(n)).length,
      sellerUnreadCount: notifications.filter(n => !n.read && isSellerNotification(n)).length,
    }),
  addNotification: (notification) => 
    set((state) => {
      const isClient = isClientNotification(notification);
      const isSeller = isSellerNotification(notification);
      return { 
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.read ? 0 : 1),
        clientUnreadCount: state.clientUnreadCount + (notification.read || !isClient ? 0 : 1),
        sellerUnreadCount: state.sellerUnreadCount + (notification.read || !isSeller ? 0 : 1),
      };
    }),
  markAsRead: (id) => 
    set((state) => {
      const nextNotifs = state.notifications.map(n => n.id === id ? { ...n, read: true } : n);
      return {
        notifications: nextNotifs,
        unreadCount: nextNotifs.filter(n => !n.read).length,
        clientUnreadCount: nextNotifs.filter(n => !n.read && isClientNotification(n)).length,
        sellerUnreadCount: nextNotifs.filter(n => !n.read && isSellerNotification(n)).length,
      };
    }),
  markAllAsRead: (context) => 
    set((state) => {
      const nextNotifs = state.notifications.map(n => {
        if (!context) return { ...n, read: true };
        if (context === 'client' && isClientNotification(n)) return { ...n, read: true };
        if (context === 'seller' && isSellerNotification(n)) return { ...n, read: true };
        return n;
      });
      return {
        notifications: nextNotifs,
        unreadCount: nextNotifs.filter(n => !n.read).length,
        clientUnreadCount: nextNotifs.filter(n => !n.read && isClientNotification(n)).length,
        sellerUnreadCount: nextNotifs.filter(n => !n.read && isSellerNotification(n)).length,
      };
    }),
  clearRead: () =>
    set((state) => {
      const next = state.notifications.filter((n) => !n.read);
      return {
        notifications: next,
        unreadCount: next.length,
        clientUnreadCount: next.filter(n => isClientNotification(n)).length,
        sellerUnreadCount: next.filter(n => isSellerNotification(n)).length,
      };
    }),
  clearAll: (context) => set((state) => {
    let nextNotifs: Notification[] = [];
    if (!context) {
      nextNotifs = [];
    } else if (context === 'client') {
      nextNotifs = state.notifications.filter(n => !isClientNotification(n));
    } else if (context === 'seller') {
      nextNotifs = state.notifications.filter(n => !isSellerNotification(n));
    }
    return { 
      notifications: nextNotifs, 
      unreadCount: nextNotifs.filter(n => !n.read).length,
      clientUnreadCount: nextNotifs.filter(n => !n.read && isClientNotification(n)).length,
      sellerUnreadCount: nextNotifs.filter(n => !n.read && isSellerNotification(n)).length,
    };
  }),
}));


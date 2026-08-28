import { create } from 'zustand';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'order' | 'payment' | 'promo' | 'system' | 'comment' | 'like' | 'admin';
  read: boolean;
  created_at: string;
  data?: Record<string, any>;
  store_id?: string;
}

export const isClientNotification = (n: Notification) => {
  // Primary classifier: use the targetRole field stored in notification data
  const targetRole = n.data?.targetRole as string | undefined;
  if (targetRole === 'client') return true;
  if (targetRole === 'seller' || targetRole === 'admin') return false;

  // Fallback for legacy notifications without targetRole:
  // Interactions (like, comment, follow) are always for the SELLER
  const originalType = (n.data?.originalType || n.type) as string;
  const SELLER_ONLY_TYPES = ['like', 'comment', 'follow', 'interaction', 'alert'];
  if (SELLER_ONLY_TYPES.includes(originalType)) return false;

  // Promos and order-status-updates go to the client
  if (n.type === 'promo') return true;
  if (n.type === 'order' && n.data?.status !== undefined) return true;

  return false;
};

export const isSellerNotification = (n: Notification) => {
  const targetRole = n.data?.targetRole as string | undefined;
  if (targetRole === 'seller') return true;
  if (targetRole === 'client' || targetRole === 'admin') return false;

  // Fallback: interactions are seller-only
  const originalType = (n.data?.originalType || n.type) as string;
  const SELLER_ONLY_TYPES = ['like', 'comment', 'follow', 'interaction', 'alert'];
  if (SELLER_ONLY_TYPES.includes(originalType)) return true;

  return !isClientNotification(n);
};

/** Count unread seller notifications scoped to the currently active store.
 *  If activeStoreId is null, counts ALL unread seller notifications. */
const countSellerUnread = (notifs: Notification[], activeStoreId: string | null) =>
  notifs.filter(
    n =>
      !n.read &&
      isSellerNotification(n) &&
      (!activeStoreId || n.store_id === activeStoreId),
  ).length;

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  clientUnreadCount: number;
  sellerUnreadCount: number;
  activeStoreId: string | null;
  setActiveStoreId: (storeId: string | null) => void;
  setNotifications: (notifications: Notification[]) => void;
  loadNotifications: (userId: string, role?: 'client' | 'seller' | 'admin', storeId?: string | null) => Promise<void>;
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
  activeStoreId: null,
  setActiveStoreId: (storeId) => set((state) => ({ 
    activeStoreId: storeId,
    sellerUnreadCount: state.notifications.filter(n => 
      !n.read && 
      isSellerNotification(n) && 
      (!storeId || n.store_id === storeId)
    ).length
  })),
  setNotifications: (notifications) =>
    set((state) => ({ 
      notifications, 
      unreadCount: notifications.filter(n => !n.read).length,
      clientUnreadCount: notifications.filter(n => !n.read && isClientNotification(n)).length,
      sellerUnreadCount: notifications.filter(n => 
        !n.read && 
        isSellerNotification(n) && 
        (!state.activeStoreId || n.store_id === state.activeStoreId)
      ).length,
    })),
  loadNotifications: async (userId, role, storeId) => {
    try {
      const { notificationService } = await import('../services/notificationService');
      const data = await notificationService.getByUser(userId, role, storeId);
      get().setNotifications(data);
    } catch (e) {
      console.error('Failed to load notifications in store', e);
    }
  },
  addNotification: (notification) =>
    set((state) => {
      const isClient = isClientNotification(notification);
      const isSeller = isSellerNotification(notification);
      // For seller badge: only count if it belongs to the active store (or no store filter)
      const countsSeller =
        isSeller &&
        !notification.read &&
        (!state.activeStoreId || notification.store_id === state.activeStoreId);
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.read ? 0 : 1),
        clientUnreadCount: state.clientUnreadCount + (notification.read || !isClient ? 0 : 1),
        sellerUnreadCount: state.sellerUnreadCount + (countsSeller ? 1 : 0),
      };
    }),
  markAsRead: (id) =>
    set((state) => {
      const nextNotifs = state.notifications.map(n => (n.id === id ? { ...n, read: true } : n));
      return {
        notifications: nextNotifs,
        unreadCount: nextNotifs.filter(n => !n.read).length,
        clientUnreadCount: nextNotifs.filter(n => !n.read && isClientNotification(n)).length,
        sellerUnreadCount: countSellerUnread(nextNotifs, state.activeStoreId),
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
        sellerUnreadCount: countSellerUnread(nextNotifs, state.activeStoreId),
      };
    }),
  clearRead: () =>
    set((state) => {
      const next = state.notifications.filter(n => !n.read);
      return {
        notifications: next,
        unreadCount: next.length,
        clientUnreadCount: next.filter(n => isClientNotification(n)).length,
        sellerUnreadCount: countSellerUnread(next, state.activeStoreId),
      };
    }),
  clearAll: (context) =>
    set((state) => {
      let nextNotifs: Notification[];
      if (!context) {
        nextNotifs = [];
      } else if (context === 'client') {
        nextNotifs = state.notifications.filter(n => !isClientNotification(n));
      } else {
        nextNotifs = state.notifications.filter(n => !isSellerNotification(n));
      }
      return {
        notifications: nextNotifs,
        unreadCount: nextNotifs.filter(n => !n.read).length,
        clientUnreadCount: nextNotifs.filter(n => !n.read && isClientNotification(n)).length,
        sellerUnreadCount: countSellerUnread(nextNotifs, state.activeStoreId),
      };
    }),
}));


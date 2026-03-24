import { create } from 'zustand';
import { wishlistService, WishlistItem } from '../lib/wishlistService';

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  setItems: (items: WishlistItem[]) => void;
  addItem: (item: WishlistItem) => void;
  removeItem: (productId: string) => void;
  loadWishlist: (userId: string) => Promise<void>;
  addToWishlist: (userId: string, productId: string) => Promise<void>;
  removeFromWishlist: (userId: string, productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  isLoading: false,

  setItems: (items) => set({ items }),

  addItem: (item) => set({ items: [item, ...get().items] }),

  removeItem: (productId) =>
    set({ items: get().items.filter((item) => item.product_id !== productId) }),

  loadWishlist: async (userId: string) => {
    set({ isLoading: true });
    try {
      const items = await wishlistService.getByUser(userId);
      set({ items, isLoading: false });
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error loading wishlist:');
      set({ isLoading: false });
    }
  },

  addToWishlist: async (userId: string, productId: string) => {
    try {
      const item = await wishlistService.add(userId, productId);
      get().addItem(item);
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error adding to wishlist:');
    }
  },

  removeFromWishlist: async (userId: string, productId: string) => {
    try {
      await wishlistService.remove(userId, productId);
      get().removeItem(productId);
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error removing from wishlist:');
    }
  },

  isInWishlist: (productId: string) =>
    get().items.some((item) => item.product_id === productId),
}));


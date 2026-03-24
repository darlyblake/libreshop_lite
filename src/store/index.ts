import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Store, Product, Order, OrderItem, authService } from '../lib/supabase';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

// Auth Store
interface AuthState {
  user: User | null;
  session: any;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: any) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: async () => {
    try {
      // Clear Supabase session
      await authService.signOut();
    } catch (error) {
      errorHandler.handle(error, 'Error signing out from Supabase:', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
    }
    
    // Clear store state
    set({ user: null, session: null, isLoading: false });
    
    // Note: Other stores will be cleared by their own logic or on app reload
    // This avoids circular import issues
  },
}));

// Store Store
interface StoreState {
  store: Store | null;
  setStore: (store: Store | null) => void;
}

export const useStoreStore = create<StoreState>((set) => ({
  store: null,
  setStore: (store) => set({ store }),
}));

// Cart Store
interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  storeId: string | null;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      storeId: null,
      addItem: (product, quantity = 1) => {
        const { items, storeId } = get();
        const productStoreId = (product as any)?.store_id as string | undefined;

        // If cart is empty, lock cart storeId to the product store_id when available.
        if (items.length === 0 && productStoreId) {
          set({ storeId: productStoreId });
        }

        // If cart already belongs to a different store, allow multi-store carts
        // by setting storeId to null to indicate a mixed cart rather than
        // resetting the previous items (preserve user expectation of multiple stores).
        if (items.length > 0 && storeId && productStoreId && storeId !== productStoreId) {
          set({ storeId: null });
        }

        const existingItem = items.find((item) => item.product.id === product.id);
        if (existingItem) {
          set({
            items: items.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
          });
        } else {
          set({ items: [...items, { product, quantity }] });
        }
      },
      removeItem: (productId) => {
        const next = get().items.filter((item) => item.product.id !== productId);
        // Recompute storeId: if all remaining items belong to same store, set it; otherwise null
        let nextStoreId: string | null = null;
        if (next.length > 0) {
          const ids = next.map((i) => (i.product as any)?.store_id).filter(Boolean) as string[];
          const unique = Array.from(new Set(ids));
          nextStoreId = unique.length === 1 ? unique[0] : null;
        }
        set({ items: next, storeId: nextStoreId });
      },
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
        } else {
          set({
            items: get().items.map((item) =>
              item.product.id === productId ? { ...item, quantity } : item
            ),
          });
        }
      },
      clearCart: () => set({ items: [], storeId: null }),
      getTotal: () => {
        return get().items.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0
        );
      },
    }),
    {
      name: '@libreshop_cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items, storeId: state.storeId }),
    }
  )
);


// Products Store
interface ProductsState {
  products: Product[];
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  removeProduct: (id: string) => void;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  setProducts: (products) => set({ products }),
  addProduct: (product) => set({ products: [...get().products, product] }),
  updateProduct: (id, productUpdate) =>
    set({
      products: get().products.map((p) =>
        p.id === id ? { ...p, ...productUpdate } : p
      ),
    }),
  removeProduct: (id) =>
    set({ products: get().products.filter((p) => p.id !== id) }),
}));

// Orders Store
interface OrdersState {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, orderUpdate: Partial<Order>) => void;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  setOrders: (orders) => set({ orders }),
  addOrder: (order) => set({ orders: [order, ...get().orders] }),
  updateOrder: (id, orderUpdate) =>
    set({
      orders: get().orders.map((o) =>
        o.id === id ? { ...o, ...orderUpdate } : o
      ),
    }),
}));

// Re-export new stores
export { useWishlistStore } from './wishlistStore';
export { useSearchStore } from './searchStore';
export { useCategoryStore } from './categoryStore';

// Default export to appease CommonJS `require` interop and
// give a fallback object if something loads before the module finishes
// initializing. This is mainly defensive; the named exports should still be
// used in most code.
const defaultExports = {
  useAuthStore,
  useStoreStore,
  useCartStore,
  useProductsStore,
  useOrdersStore,
};
export default defaultExports;


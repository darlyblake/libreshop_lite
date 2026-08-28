import AsyncStorage from '@react-native-async-storage/async-storage';
import { orderService } from './orderService';
import { useSupabase } from '../lib/supabase';
import { networkService } from './networkService';

const KEYS = {
  OFFLINE_PRODUCTS: (storeId: string) => `@libreshop_offline_products_${storeId}`,
  OFFLINE_STORE: (storeId: string) => `@libreshop_offline_store_${storeId}`,
  OFFLINE_COLLECTIONS: (storeId: string) => `@libreshop_offline_collections_${storeId}`,
  OFFLINE_CLIENTS: (storeId: string) => `@libreshop_offline_clients_${storeId}`,
  OFFLINE_DASHBOARD: (storeId: string) => `@libreshop_offline_dashboard_${storeId}`,
  PENDING_ORDERS: '@libreshop_pending_offline_orders',
  PENDING_CLIENTS: '@libreshop_pending_offline_clients',
  PENDING_MOVEMENTS: '@libreshop_pending_offline_movements',
};

export interface PendingOfflineOrder {
  id: string;
  storeId: string;
  createdAt: string;
  orderPayload: any;
  itemsPayload: Array<{
    product_id: string;
    quantity: number;
    price: number;
    cost_price?: number;
    product_name?: string;
  }>;
}

export interface PendingOfflineClient {
  id: string;
  storeId: string;
  createdAt: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface PendingOfflineMovement {
  id: string;
  storeId: string;
  createdAt: string;
  productId: string;
  quantityChanged: number;
  type: 'in' | 'out' | 'adjustment' | 'sale';
  reason?: string;
  notes?: string;
  userId?: string;
}

class OfflineSyncManager {
  private isSyncing = false;

  constructor() {
    // S'abonner aux changements de réseau pour lancer la synchronisation auto
    networkService.subscribe((isOnline) => {
      if (isOnline) {
        this.syncAllPendingData().catch(console.error);
      }
    });
  }

  // --- CACHE LOCAL DES PRODUITS, BOUTIQUE ET CLIENTS ---

  async saveOfflineProducts(storeId: string, products: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.OFFLINE_PRODUCTS(storeId), JSON.stringify(products));
    } catch (e) {
      console.warn('Erreur sauvegarde cache produits:', e);
    }
  }

  async getOfflineProducts(storeId: string): Promise<any[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_PRODUCTS(storeId));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Erreur lecture cache produits:', e);
      return [];
    }
  }

  async saveOfflineStore(storeId: string, store: any): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.OFFLINE_STORE(storeId), JSON.stringify(store));
    } catch (e) {
      console.warn('Erreur sauvegarde cache boutique:', e);
    }
  }

  async getOfflineStore(storeId: string): Promise<any | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_STORE(storeId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Erreur lecture cache boutique:', e);
      return null;
    }
  }

  async saveOfflineCollections(storeId: string, collections: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.OFFLINE_COLLECTIONS(storeId), JSON.stringify(collections));
    } catch (e) {
      console.warn('Erreur sauvegarde cache collections:', e);
    }
  }

  async getOfflineCollections(storeId: string): Promise<any[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_COLLECTIONS(storeId));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Erreur lecture cache collections:', e);
      return [];
    }
  }

  async saveOfflineClients(storeId: string, clients: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.OFFLINE_CLIENTS(storeId), JSON.stringify(clients));
    } catch (e) {
      console.warn('Erreur sauvegarde cache clients:', e);
    }
  }

  async getOfflineClients(storeId: string): Promise<any[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_CLIENTS(storeId));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Erreur lecture cache clients:', e);
      return [];
    }
  }

  async saveOfflineDashboard(storeId: string, stats: any): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.OFFLINE_DASHBOARD(storeId), JSON.stringify(stats));
    } catch (e) {
      console.warn('Erreur sauvegarde cache dashboard:', e);
    }
  }

  async getOfflineDashboard(storeId: string): Promise<any | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_DASHBOARD(storeId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Erreur lecture cache dashboard:', e);
      return null;
    }
  }

  // --- QUEUE COMMANDES HORS-LIGNE ---

  async getPendingOrders(): Promise<PendingOfflineOrder[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PENDING_ORDERS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  async queueOfflineOrder(
    storeId: string,
    orderPayload: any,
    itemsPayload: any[]
  ): Promise<PendingOfflineOrder> {
    const offlineId = `OFFLINE_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const pendingOrder: PendingOfflineOrder = {
      id: offlineId,
      storeId,
      createdAt: new Date().toISOString(),
      orderPayload,
      itemsPayload,
    };

    try {
      const pendingList = await this.getPendingOrders();
      pendingList.push(pendingOrder);
      await AsyncStorage.setItem(KEYS.PENDING_ORDERS, JSON.stringify(pendingList));
      await this.updateLocalStockCache(storeId, itemsPayload);
    } catch (e) {
      console.error('Erreur queue commande hors-ligne:', e);
    }

    return pendingOrder;
  }

  private async updateLocalStockCache(storeId: string, items: any[]) {
    const products = await this.getOfflineProducts(storeId);
    if (!products || !products.length) return;

    const updated = products.map((p) => {
      const purchased = items.find((i) => i.product_id === p.id);
      if (purchased) {
        const newStock = Math.max(0, (p.stock || 0) - purchased.quantity);
        return { ...p, stock: newStock, maxStock: newStock };
      }
      return p;
    });

    await this.saveOfflineProducts(storeId, updated);
  }

  // --- QUEUE CLIENTS HORS-LIGNE ---

  async getPendingClients(): Promise<PendingOfflineClient[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PENDING_CLIENTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  async queueOfflineClient(
    storeId: string,
    clientData: { name: string; phone: string; email?: string; notes?: string }
  ): Promise<PendingOfflineClient> {
    const offlineClient: PendingOfflineClient = {
      id: `CLIENT_${Date.now()}`,
      storeId,
      createdAt: new Date().toISOString(),
      ...clientData,
    };

    try {
      const list = await this.getPendingClients();
      list.push(offlineClient);
      await AsyncStorage.setItem(KEYS.PENDING_CLIENTS, JSON.stringify(list));

      // Ajouter aussi au cache local des clients
      const existing = await this.getOfflineClients(storeId);
      existing.unshift(offlineClient);
      await this.saveOfflineClients(storeId, existing);
    } catch (e) {
      console.error('Erreur queue client hors-ligne:', e);
    }

    return offlineClient;
  }

  // --- QUEUE MOUVEMENTS DE STOCK HORS-LIGNE ---

  async getPendingMovements(): Promise<PendingOfflineMovement[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PENDING_MOVEMENTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  async queueOfflineStockMovement(
    storeId: string,
    movement: { productId: string; quantityChanged: number; type: 'in' | 'out' | 'adjustment' | 'sale'; reason?: string; notes?: string; userId?: string }
  ): Promise<PendingOfflineMovement> {
    const pendingMov: PendingOfflineMovement = {
      id: `MOV_${Date.now()}`,
      storeId,
      createdAt: new Date().toISOString(),
      ...movement,
    };

    try {
      const list = await this.getPendingMovements();
      list.push(pendingMov);
      await AsyncStorage.setItem(KEYS.PENDING_MOVEMENTS, JSON.stringify(list));

      // Mettre à jour le stock dans le cache local produits
      const products = await this.getOfflineProducts(storeId);
      const updated = products.map((p) => {
        if (p.id === movement.productId) {
          const newStock = Math.max(0, (p.stock || 0) + movement.quantityChanged);
          return { ...p, stock: newStock, maxStock: newStock };
        }
        return p;
      });
      await this.saveOfflineProducts(storeId, updated);
    } catch (e) {
      console.error('Erreur queue mouvement stock:', e);
    }

    return pendingMov;
  }

  // --- SYNCHRONISATION GLOBALE AUTOMATIQUE VERS SUPABASE ---

  async syncAllPendingData(): Promise<{ syncedOrders: number; syncedClients: number; syncedMovements: number }> {
    if (this.isSyncing || !networkService.isOnline()) {
      return { syncedOrders: 0, syncedClients: 0, syncedMovements: 0 };
    }

    this.isSyncing = true;
    let syncedOrders = 0;
    let syncedClients = 0;
    let syncedMovements = 0;

    const client = useSupabase();

    try {
      // 1. Sync Clients Hors-Ligne
      const pendingClients = await this.getPendingClients();
      if (pendingClients.length > 0) {
        const remainingClients: PendingOfflineClient[] = [];
        for (const c of pendingClients) {
          try {
            await client.from('customers').insert({
              store_id: c.storeId,
              name: c.name,
              phone: c.phone,
              email: c.email || null,
              notes: c.notes || null,
            });
            syncedClients++;
          } catch (err) {
            console.warn('Erreur sync client:', err);
            remainingClients.push(c);
          }
        }
        await AsyncStorage.setItem(KEYS.PENDING_CLIENTS, JSON.stringify(remainingClients));
      }

      // 2. Sync Mouvements de Stock Hors-Ligne
      const pendingMovements = await this.getPendingMovements();
      if (pendingMovements.length > 0) {
        const remainingMovements: PendingOfflineMovement[] = [];
        for (const m of pendingMovements) {
          try {
            // Insérer le mouvement de stock
            await client.from('stock_movements').insert({
              product_id: m.productId,
              quantity_changed: m.quantityChanged,
              type: m.type,
              reason: m.reason || 'Ajustement Hors-Ligne',
              notes: m.notes || 'Ajustement d\'inventaire effectué hors-ligne',
              created_by: m.userId || null,
            });

            // Mettre à jour la table produits dans Supabase
            const { data: pData } = await client.from('products').select('stock').eq('id', m.productId).single();
            if (pData) {
              const newStock = Math.max(0, (pData.stock || 0) + m.quantityChanged);
              await client.from('products').update({ stock: newStock }).eq('id', m.productId);
            }
            syncedMovements++;
          } catch (err) {
            console.warn('Erreur sync mouvement stock:', err);
            remainingMovements.push(m);
          }
        }
        await AsyncStorage.setItem(KEYS.PENDING_MOVEMENTS, JSON.stringify(remainingMovements));
      }

      // 3. Sync Commandes Caisse Hors-Ligne
      const pendingOrders = await this.getPendingOrders();
      if (pendingOrders.length > 0) {
        const remainingOrders: PendingOfflineOrder[] = [];
        for (const item of pendingOrders) {
          try {
            const realOrder = await orderService.createPosOrder({
              store_id: item.orderPayload.store_id || item.storeId,
              customer_name: item.orderPayload.customer_name,
              customer_phone: item.orderPayload.customer_phone,
              payment_method: item.orderPayload.payment_method || 'cash_on_delivery',
              notes: item.orderPayload.notes,
              items: item.itemsPayload.map((it) => ({
                product_id: it.product_id,
                quantity: it.quantity,
              })),
            });

            for (const it of item.itemsPayload) {
              try {
                await client.from('stock_movements').insert({
                  product_id: it.product_id,
                  quantity_changed: -it.quantity,
                  type: 'sale',
                  reason: 'Vente caisse (Sync Auto)',
                  notes: `Vente caisse du ${new Date(item.createdAt).toLocaleString('fr-FR')}`,
                  created_by: item.orderPayload.user_id,
                });
              } catch (mErr) {
                console.warn('Erreur mvt stock sync order:', mErr);
              }
            }

            await orderService.processPayment(realOrder.order_id);
            syncedOrders++;
          } catch (err) {
            console.error(`Erreur sync commande ${item.id}:`, err);
            remainingOrders.push(item);
          }
        }
        await AsyncStorage.setItem(KEYS.PENDING_ORDERS, JSON.stringify(remainingOrders));
      }
    } catch (e) {
      console.error('Erreur globale syncAllPendingData:', e);
    } finally {
      this.isSyncing = false;
    }

    return { syncedOrders, syncedClients, syncedMovements };
  }

  // Alias rétrocompatible
  async syncPendingOrders() {
    const res = await this.syncAllPendingData();
    return { syncedCount: res.syncedOrders, errors: 0 };
  }
}

export const offlineSyncManager = new OfflineSyncManager();

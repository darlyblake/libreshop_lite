import { useSupabase } from '../lib/supabase';
import { cacheService } from './cacheService';
import { notificationService } from './notificationService';
import { pointsService } from './pointsService';
import { rpcUtils, encodeCursor, decodeCursor, withRetry } from '../utils/rpcUtils';
import type {
  Order,
  OrderStatus,
  OrderItem,
  OrderFilters,
  GetByStoreOptions,
  StoreOrderCounts,
  GetCountsByStatusResult,
  PaginationResult,
  OrderPayload,
  OrderItemPayload,
  StockMovement,
} from '../types/order';

const CACHE_TTL_MINUTES = 5; // 5 minutes cache
const CACHE_STALE_MINUTES = 4; // 4 minutes avant stale
const BATCH_SIZE = 50; // Pour les opérations batch

/**
 * Valide que l'utilisateur a accès à cette boutique (RLS explicite)
 */
async function validateStoreAccess(storeId: string, userId: string): Promise<void> {
  const client = useSupabase();
  const { data: store, error } = await client
    .from('stores')
    .select('user_id')
    .eq('id', storeId)
    .maybeSingle();

  if (error) throw error;
  if (!store || store.user_id !== userId) {
    throw new Error(`Unauthorized: user ${userId} does not own store ${storeId}`);
  }
}

/**
 * Restaure le stock physique des produits après annulation
 */
async function restoreOrderStock(order: Order): Promise<void> {
  const client = useSupabase();
  const items = order.order_items || [];

  if (items.length === 0) return;

  try {
    // Récupérer les stocks frais en batch
    const productIds = items.map(item => item.product_id).filter(Boolean);
    if (productIds.length === 0) return;

    const { data: products, error: fetchErr } = await client
      .from('products')
      .select('id, stock')
      .in('id', productIds);

    if (fetchErr) throw fetchErr;

    // Construire les updates
    const productStockMap = new Map(products?.map(p => [p.id, p.stock]) || []);

    for (const item of items) {
      const currentStock = productStockMap.get(item.product_id) || 0;
      const newStock = currentStock + item.quantity;

      // Update produit
      await client
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.product_id)
        .throwOnError();
    }
  } catch (err) {
    console.warn('Failed to restore stock during cancellation', err);
    // Ne pas lever l'erreur, continuer le cancellation
  }
}

export const orderService = {
  /**
   * Crée une nouvelle commande avec retry logic
   */
  async create(order: Partial<OrderPayload>): Promise<Order> {
    const client = useSupabase();
    return withRetry(
      async () => {
        const { data, error } = await client
          .from('orders')
          .insert(order)
          .select('*')
          .single();
        if (error) throw error;
        return data as Order;
      },
      { maxRetries: 2, backoffMs: 500 }
    );
  },

  /**
   * Met à jour une commande avec optimistic locking (version)
   */
  async update(id: string, updates: Partial<Order>): Promise<Order> {
    const client = useSupabase();
    return withRetry(
      async () => {
        const { data, error } = await client
          .from('orders')
          .update(updates)
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        
        // Invalidate cache
        await cacheService.remove(`order:${id}`);
        
        return data as Order;
      },
      { maxRetries: 2, backoffMs: 500 }
    );
  },

  /**
   * Crée les items d'une commande (batch insert)
   */
  async createItems(items: OrderItemPayload[]): Promise<OrderItem[]> {
    const client = useSupabase();
    return withRetry(
      async () => {
        const { data, error } = await client
          .from('order_items')
          .insert(items)
          .select('*');
        if (error) throw error;
        return data as OrderItem[];
      },
      { maxRetries: 2, backoffMs: 500 }
    );
  },

  /**
   * Traite le paiement d'une commande via RPC
   */
  async processPayment(orderId: string): Promise<Order> {
    const client = useSupabase();
    return rpcUtils.executeWithFallback(
      'process_order_after_payment',
      { p_order_id: orderId },
      async () => {
        // Fallback: mettre à jour directement
        const { data, error } = await client
          .from('orders')
          .update({ payment_status: 'paid', status: 'paid' })
          .eq('id', orderId)
          .select('*')
          .single();
        if (error) throw error;
        return data as Order;
      },
      { rpcName: 'process_order_after_payment' }
    );
  },

  /**
   * Récupère une commande par ID avec cache offline-first
   */
  async getById(
    orderId: string,
    options?: { includeUser?: boolean; includeStore?: boolean; forceRefresh?: boolean }
  ): Promise<Order | null> {
    const cacheKey = `order:${orderId}`;

    // 1. Lire du cache d'abord
    if (!options?.forceRefresh) {
      const cached = await cacheService.get<Order>(cacheKey);
      if (cached) return cached;
    }

    // 2. Fetch réseau
    const client = useSupabase();
    const selectParts = ['*'];
    if (options?.includeUser) selectParts.push('users(id, email, full_name)');
    if (options?.includeStore) selectParts.push('stores(id, name, user_id)');
    selectParts.push('order_items(id, product_id, quantity, price, products(*))');

    try {
      const { data, error } = await client
        .from('orders')
        .select(selectParts.join(', '))
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;

      // 3. Mettre en cache
      if (data) {
        await cacheService.set(cacheKey, data, CACHE_TTL_MINUTES, CACHE_STALE_MINUTES);
      }

      return data as any as Order | null;
    } catch (e) {
      console.warn('Failed to fetch order', e);
      return null;
    }
  },

  /**
   * Récupère les commandes d'un utilisateur avec cache
   */
  async getByUser(userId: string, forceRefresh = false): Promise<Order[]> {
    const cacheKey = `orders:user:${userId}`;

    // Forcer le rafraîchissement pour obtenir les données complètes des produits
    forceRefresh = true;

    if (!forceRefresh) {
      const cached = await cacheService.get<Order[]>(cacheKey);
      if (cached) return cached;
    }

    const client = useSupabase();
    try {
      const { data, error } = await client
        .from('orders')
        .select('id, store_id, status, total_amount, created_at, customer_name, stores(id, name), order_items(id, product_id, quantity, price, products(id, name, images))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orders = (Array.isArray(data) ? data : []) as unknown as Order[];
      await cacheService.set(cacheKey, orders, CACHE_TTL_MINUTES, CACHE_STALE_MINUTES);
      return orders;
    } catch (e) {
      console.warn('Failed to fetch user orders', e);
      return [];
    }
  },

  /**
   * Récupère les commandes d'une boutique avec pagination et cache
   * Utilise projections sélectives pour réduire le payload
   */
  async getByStore(
    storeId: string,
    optionsOrUserId?: GetByStoreOptions | string,
    legacyOptions?: GetByStoreOptions
  ): Promise<PaginationResult<Order>> {
    // Backward compatibility: gérer les deux signatures
    let options: GetByStoreOptions | undefined;
    let userId: string | undefined;

    if (typeof optionsOrUserId === 'string') {
      userId = optionsOrUserId;
      options = legacyOptions;
    } else {
      options = optionsOrUserId;
    }

    // Valider RLS explicitement si userId fourni
    if (userId) {
      await validateStoreAccess(storeId, userId);
    }

    const cacheKey = `orders:store:${storeId}:${JSON.stringify(options || {})}`;

    if (!options?.forceRefresh) {
      const cached = await cacheService.get<PaginationResult<Order>>(cacheKey);
      if (cached) return cached;
    }

    const client = useSupabase();
    const limit = options?.limit || 20;

    // Projection sélective selon les besoins
    const projection = options?.includeUser
      ? 'id, status, total_amount, created_at, customer_name, customer_phone, payment_method, payment_status, status_changed_at, stores(id, name), users(id, email, full_name), order_items(id)'
      : 'id, status, total_amount, created_at, customer_name, customer_phone, payment_method, payment_status, status_changed_at, stores(id, name), order_items(id)';

    let query = client
      .from('orders')
      .select(projection)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // +1 pour déterminer hasMore

    // Appliquer les filtres
    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status as OrderStatus);
    }

    if (options?.search) {
      const search = options.search.trim().toLowerCase();
      query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
    }

    if (options?.dateFrom) {
      query = query.gte('created_at', options.dateFrom);
    }

    if (options?.dateTo) {
      query = query.lte('created_at', options.dateTo);
    }

    // Cursor-based pagination
    if (options?.cursor) {
      try {
        const { timestamp, id } = decodeCursor(options.cursor);
        query = query.lt('created_at', timestamp);
      } catch (e) {
        console.warn('Invalid cursor format, ignoring', e);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    const ordersData = data as unknown as Order[];
    const hasMore = ordersData.length > limit;
    const orders = hasMore ? ordersData.slice(0, -1) : ordersData;
    const nextCursor = orders.length > 0
      ? encodeCursor(orders[orders.length - 1].created_at, orders[orders.length - 1].id)
      : null;

    const result: PaginationResult<Order> = {
      items: orders,
      orders, // Alias backward-compatible
      hasMore,
      nextCursor,
      count: orders.length,
    };

    // Mettre en cache
    await cacheService.set(cacheKey, result, CACHE_TTL_MINUTES, CACHE_STALE_MINUTES);

    return result;
  },

  /**
   * Alias backward compatible - retourne .orders au lieu de .items
   */
  async getByStoreCompat(storeId: string, options?: GetByStoreOptions): Promise<any> {
    const result = await this.getByStore(storeId, options);
    return {
      orders: result.items,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      count: result.count,
    };
  },

  /**
   * Récupère le total et pending orders (cache + RPC optimisée)
   */
  async getCountsByStore(storeId: string): Promise<Pick<StoreOrderCounts, 'total' | 'pending'>> {
    const cacheKey = `order-counts:store:${storeId}`;
    const cached = await cacheService.get<Pick<StoreOrderCounts, 'total' | 'pending'>>(cacheKey);
    if (cached) return cached;

    const client = useSupabase();
    try {
      // UNE SEULE requête avec HEAD et count
      const { count: totalCount, error: totalErr } = await client
        .from('orders')
        .select('id', { head: true, count: 'exact' })
        .eq('store_id', storeId);

      if (totalErr) throw totalErr;

      const { count: pendingCount, error: pendingErr } = await client
        .from('orders')
        .select('id', { head: true, count: 'exact' })
        .eq('store_id', storeId)
        .eq('status', 'pending');

      if (pendingErr) throw pendingErr;

      const result = {
        total: totalCount || 0,
        pending: pendingCount || 0,
      };

      await cacheService.set(cacheKey, result, CACHE_TTL_MINUTES, CACHE_STALE_MINUTES);
      return result;
    } catch (e) {
      console.warn('Failed to fetch order counts', e);
      return { total: 0, pending: 0 };
    }
  },

  /**
   * 🔧 CRITIQUE: Optimisé pour une SEULE requête avec GROUP BY au lieu de 8
   * AVANT: 8 requêtes COUNT séquentielles (~2s)
   * APRÈS: 1 requête GROUP BY (~100ms)
   */
  async getCountsByStoreByStatus(storeId: string): Promise<Record<string, number>> {
    const cacheKey = `order-counts-by-status:store:${storeId}`;
    const cached = await cacheService.get<Record<string, number>>(cacheKey);
    if (cached) return cached;

    // Essayer la RPC optimisée d'abord (GROUP BY SQL)
    const result = await rpcUtils.executeWithFallback(
      'get_order_counts_by_status',
      { p_store_id: storeId },
      async () => {
        // Fallback: calculer à la main (moins efficace mais marche)
        const client = useSupabase();
        const { data: orders, error } = await client
          .from('orders')
          .select('status')
          .eq('store_id', storeId);

        if (error) throw error;

        const counts: Record<string, number> = {
          total: 0,
          pending: 0,
          accepted: 0,
          paid: 0,
          shipped: 0,
          delivered: 0,
          cancelled: 0,
          refunded: 0,
        };

        (orders as any[])?.forEach((order: any) => {
          counts.total++;
          if (order.status in counts) {
            counts[order.status]++;
          }
        });

        return counts;
      },
      { rpcName: 'get_order_counts_by_status' }
    );

    await cacheService.set(cacheKey, result, CACHE_TTL_MINUTES, CACHE_STALE_MINUTES);
    return result;
  },

  /**
   * Récupère le montant total des commandes livrées
   */
  async getDeliveredTotalByStore(storeId: string): Promise<number> {
    const cacheKey = `delivered-total:store:${storeId}`;
    const cached = await cacheService.get<number>(cacheKey);
    if (cached) return cached;

    const client = useSupabase();
    try {
      const { data: orders, error } = await client
        .from('orders')
        .select('total_amount')
        .eq('store_id', storeId)
        .eq('status', 'delivered');

      if (error) throw error;

      const total = orders?.reduce((sum: number, order) => sum + (order.total_amount || 0), 0) || 0;
      await cacheService.set(cacheKey, total, CACHE_TTL_MINUTES, CACHE_STALE_MINUTES);
      return total;
    } catch (e) {
      console.error('Failed to fetch delivered total', e);
      return 0;
    }
  },

  /**
   * Met à jour le statut d'une commande et envoie notification
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const client = useSupabase();
    const updatePayload: any = { status, status_changed_at: new Date().toISOString() };
    if (status === 'delivered') {
      updatePayload.payment_status = 'paid';
    }

    const { data: order, error } = await client
      .from('orders')
      .update(updatePayload)
      .eq('id', id)
      .select('id, user_id, status, store_id, customer_name, total_amount, stores(name, user_id)')
      .single();

    if (error) throw error;

    // Invalider le cache
    await cacheService.remove(`order:${id}`);

    // Envoyer notification asynchrone (ne pas attendre)
    if (order?.user_id) {
      this.sendCustomerNotification(order as any, status).catch(e =>
        console.warn('Failed to send notification', e)
      );
    }

    // -- NOUVEAU: Attribuer des points si la commande est livrée --
    if (status === 'delivered') {
      try {
        let sellerId = (order.stores as any)?.user_id;
        if (!sellerId && order.store_id) {
          const { data: storeInfo } = await client.from('stores').select('user_id').eq('id', order.store_id).single();
          sellerId = storeInfo?.user_id;
        }
        
        if (sellerId) {
          const settings = await pointsService.getPointSettings();
          const reward = settings['SALE'] || 10;
          await client.rpc('add_points_to_user', {
            p_user_id: sellerId,
            p_amount: reward,
            p_action_type: 'SALE',
            p_reference_id: id
          });
        }
      } catch (err) {
        console.warn('Erreur lors de l attribution des points de vente:', err);
      }
    }

    return order as any;
  },

  /**
   * Accepte une commande avec vérification de stock
   */
  async acceptOrder(orderId: string, inventoryOnly: boolean = false): Promise<Order> {
    const order = await this.getById(orderId, { includeStore: true });
    if (!order) throw new Error('Commande non trouvée');

    const client = useSupabase();
    const { data, error } = await client.rpc('accept_order', {
      p_order_id: orderId,
      p_inventory_only: inventoryOnly
    });

    if (error) {
      // Si la RPC n'existe pas ou échoue, updateStatus enverra la notif lui-même
      console.warn('RPC accept_order failed, falling back to direct update', error);
      return this.updateStatus(orderId, 'accepted');
    }

    if (data && data.success === false) {
      if (data.error === 'INSUFFICIENT_STOCK') {
        const err = new Error('INSUFFICIENT_STOCK');
        (err as any).missing_items = data.missing_items;
        throw err;
      }
      throw new Error(data.error || 'Erreur inconnue lors de l\'acceptation');
    }

    // Log des mouvements stock après mise à jour réussie
    await this.logOrderStockMovementsBeforeUpdate(order, 'sale');

    await cacheService.remove(`order:${orderId}`);

    // 🔔 Notifier le client que sa commande a été acceptée
    this.sendCustomerNotification({ ...order, status: 'accepted' }, 'accepted').catch(e =>
      console.warn('Failed to send accepted notification to client', e)
    );

    return { ...order, status: 'accepted' };
  },

  /**
   * Notifie le client d'une rupture de stock sur sa commande
   */
  async notifyClientStockIssue(orderId: string, missingItems: any[], restockStatus?: 'expected' | 'no_restock'): Promise<Order> {
    const client = useSupabase();
    const order = await this.getById(orderId, { includeStore: true });
    if (!order) throw new Error('Commande non trouvée');

    const shortId = order.id.slice(0, 8).toUpperCase();
    const missingNames = missingItems.map(i => i.name).join(', ');
    const restockInfo = restockStatus === 'no_restock'
      ? ' Le vendeur nous indique qu\'aucun réapprovisionnement n\'est prévu.'
      : '';

    const { data, error } = await client
      .from('orders')
      .update({
        issue_type: 'out_of_stock',
        issue_details: missingItems,
        restock_status: restockStatus || null,
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) throw error;

    await cacheService.remove(`order:${orderId}`);

    // ✅ Send notification with deep-link data
    try {
      const { notificationService } = await import('./notificationService');
      await notificationService.create({
        user_id: order.user_id,
        type: 'order',
        title: '⚠️ Rupture de stock sur votre commande',
        body: `Produit(s) indisponible(s) dans la commande #${shortId} : ${missingNames}.${restockInfo} Ouvrez pour choisir une action.`,
        targetRole: 'client',
        data: {
          orderId: order.id,
          type: 'stock_issue',
          navigate_to: 'ClientOrderDetail',
        },
      } as any);
    } catch (e) {
      console.warn('Failed to notify client of stock issue:', e);
    }

    return data as Order;
  },

  /**
   * Le vendeur notifie les clients en attente que le stock est réapprovisionné
   * (les clients qui ont choisi "Attendre")
   */
  async notifyRestockedClients(storeId: string, productId: string, productName: string): Promise<number> {
    const client = useSupabase();
    // Chercher toutes les commandes avec issue_type = 'waiting_restock' pour ce produit
    const { data: waitingOrders, error } = await client
      .from('orders')
      .select('id, user_id, issue_details')
      .eq('store_id', storeId)
      .eq('issue_type', 'waiting_restock');

    if (error) throw error;

    const relevant = (waitingOrders || []).filter(o =>
      (o.issue_details as any[])?.some((d: any) => d.product_id === productId)
    );

    if (relevant.length === 0) return 0;

    const { notificationService } = await import('./notificationService');
    let count = 0;
    for (const o of relevant) {
      try {
        await notificationService.create({
          user_id: o.user_id,
          type: 'order',
          title: '🎉 Produit disponible !',
          body: `"${productName}" est à nouveau disponible ! Votre commande #${o.id.slice(0, 8).toUpperCase()} peut maintenant être traitée. Reconnectez-vous pour la passer.`,
          targetRole: 'client',
          data: { orderId: o.id, type: 'restock_available', navigate_to: 'ClientOrderDetail' },
        } as any);

        // Remettre la commande en attente normale
        await client
          .from('orders')
          .update({ issue_type: null, issue_details: null, restock_status: null })
          .eq('id', o.id);

        await cacheService.remove(`order:${o.id}`);
        count++;
      } catch (e) {
        console.warn(`Failed to notify client for order ${o.id}:`, e);
      }
    }
    return count;
  },

  /**
   * Le vendeur signale qu'il n'y aura pas de réapprovisionnement pour ce produit
   * (notifie les clients en attente pour qu'ils annulent ou continuent sans ce produit)
   */
  async notifyNoRestock(storeId: string, productId: string, productName: string): Promise<number> {
    const client = useSupabase();
    const { data: waitingOrders, error } = await client
      .from('orders')
      .select('id, user_id, issue_details')
      .eq('store_id', storeId)
      .eq('issue_type', 'waiting_restock');

    if (error) throw error;

    const relevant = (waitingOrders || []).filter(o =>
      (o.issue_details as any[])?.some((d: any) => d.product_id === productId)
    );

    if (relevant.length === 0) return 0;

    const { notificationService } = await import('./notificationService');
    let count = 0;
    for (const o of relevant) {
      try {
        // Mettre à jour le statut pour indiquer qu'il n'y aura pas de réappro
        await client
          .from('orders')
          .update({ restock_status: 'no_restock' })
          .eq('id', o.id);

        await cacheService.remove(`order:${o.id}`);

        await notificationService.create({
          user_id: o.user_id,
          type: 'order',
          title: '🚨 Réapprovisionnement impossible',
          body: `Le vendeur nous informe qu'il ne pourra pas réapprovisionner "${productName}". Votre commande #${o.id.slice(0, 8).toUpperCase()} nécessite une action de votre part.`,
          targetRole: 'client',
          data: { orderId: o.id, type: 'no_restock', navigate_to: 'ClientOrderDetail' },
        } as any);
        count++;
      } catch (e) {
        console.warn(`Failed to notify client no-restock for order ${o.id}:`, e);
      }
    }
    return count;
  },

  /**
   * Le client répond à une rupture de stock (annuler / continuer / attendre)
   * @param action 'cancel' | 'continue_without' | 'wait'
   */
  async respondToStockIssue(orderId: string, action: 'cancel' | 'continue_without' | 'wait'): Promise<Order> {
    const client = useSupabase();
    const order = await this.getById(orderId, { includeStore: true });
    if (!order) throw new Error('Commande non trouvée');

    let updatePayload: any = {};
    let notifTitle = '';
    let notifBody = '';

    if (action === 'cancel') {
      updatePayload = { status: 'cancelled', issue_type: null, issue_details: null };
      notifTitle = 'Commande annulée par le client';
      notifBody = `Le client a décidé d'annuler la commande #${order.id.slice(0, 8).toUpperCase()} suite à la rupture de stock.`;
    } else if (action === 'continue_without') {
      updatePayload = { issue_type: 'resolved_partial', issue_details: (order as any).issue_details };
      notifTitle = 'Client souhaite continuer';
      notifBody = `Le client souhaite continuer la commande #${order.id.slice(0, 8).toUpperCase()} sans les produits en rupture. Veuillez ajuster et accepter.`;
    } else if (action === 'wait') {
      updatePayload = { issue_type: 'waiting_restock' };
      notifTitle = 'Client en attente de réapprovisionnement';
      notifBody = `Le client a choisi d'attendre le réapprovisionnement pour la commande #${order.id.slice(0, 8).toUpperCase()}.`;
    }

    const { data, error } = await client
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) throw error;

    await cacheService.remove(`order:${orderId}`);

    // Notifier le vendeur
    try {
      const { notificationService } = await import('./notificationService');
      const storeData = (order as any).stores || (order as any).store;
      const sellerUserId = storeData?.user_id;
      if (sellerUserId) {
        await notificationService.create({
          user_id: sellerUserId,
          type: 'order',
          title: notifTitle,
          body: notifBody,
          targetRole: 'seller',
          data: { orderId: order.id, type: 'stock_response', action, navigate_to: 'SellerOrderDetail' },
        } as any);
      }
    } catch (e) {
      console.warn('Failed to notify seller of client stock response:', e);
    }

    return data as Order;
  },

  /**
   * Confirme le paiement d'une commande
   */
  async confirmOrderPayment(orderId: string): Promise<Order> {
    const order = await this.getById(orderId);
    if (!order) throw new Error('Commande non trouvée');

    return rpcUtils.executeWithFallback(
      'confirm_order_payment',
      { p_order_id: orderId },
      async () => {
        // Fallback: mise à jour directe
        const client = useSupabase();
        const { data: updated, error } = await client
          .from('orders')
          .update({
            status: 'paid',
            payment_status: 'paid',
            status_changed_at: new Date().toISOString(),
          })
          .eq('id', orderId)
          .select('*')
          .single();

        if (error) throw error;

        await cacheService.remove(`order:${orderId}`);
        await this.sendCustomerNotification(updated as Order, 'paid').catch(() => {
          /* ignore */
        });

        return updated as Order;
      },
      { rpcName: 'confirm_order_payment' }
    );
  },

  /**
   * Le client confirme la réception de sa commande
   */
  async confirmReception(orderId: string): Promise<Order> {
    const client = useSupabase();
    const order = await this.getById(orderId, { includeStore: true });
    if (!order) throw new Error('Commande non trouvée');

    const { data, error } = await client
      .from('orders')
      .update({
        status: 'delivered',
        payment_status: 'paid',
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) throw error;

    await cacheService.remove(`order:${orderId}`);
    const storeData = (order as any).stores || (order as any).store;
    const sellerUserId = storeData?.user_id;
    const storeName = storeData?.name || 'La boutique';
    const shortId = order.id.slice(0, 8).toUpperCase();

    try {
      const { notificationService } = await import('./notificationService');

      // 🔔 Notifier le vendeur
      if (sellerUserId) {
        await notificationService.create({
          user_id: sellerUserId,
          type: 'order',
          title: 'Commande reçue par le client ✅',
          body: `Le client a confirmé la réception de la commande #${shortId}. Commande terminée !`,
          targetRole: 'seller',
          data: { order_id: order.id, type: 'status_update', status: 'delivered' },
        });
      }

      // 🔔 Notifier le client lui-même
      await notificationService.create({
        user_id: order.user_id,
        type: 'order',
        title: 'Commande livrée ! 🎉',
        body: `Votre commande #${shortId} chez ${storeName} est terminée. Merci de votre confiance !`,
        targetRole: 'client',
        data: { orderId: order.id, status: 'delivered', showRating: true },
      });
    } catch (e) {
      console.warn('Failed to send delivery notifications:', e);
    }

    // 🏆 Attribuer des points XP au vendeur
    if (sellerUserId) {
      try {
        const settings = await pointsService.getPointSettings();
        const reward = settings['SALE'] || 10;
        await client.rpc('add_points_to_user', {
          p_user_id: sellerUserId,
          p_amount: reward,
          p_action_type: 'SALE',
          p_reference_id: orderId
        });
      } catch (err) {
        console.warn('Erreur XP vendeur:', err);
      }
    }

    return data as Order;
  },

  /**
   * Annule une commande avec restauration de stock et notifications
   */
  async cancelOrderRobust(orderId: string): Promise<Order> {
    const order = await this.getById(orderId);
    if (!order) throw new Error('Commande non trouvée');

    // Restaurer stock si commande était en cours
    if (['accepted', 'paid', 'shipped'].includes(order.status)) {
      await this.logOrderStockMovementsBeforeUpdate(order, 'return');
      await restoreOrderStock(order);
    }

    // Utiliser RPC avec fallback
    const result = await rpcUtils.executeWithFallback(
      'cancel_order_robust',
      { p_order_id: orderId },
      async () => {
        // Fallback: mise à jour directe
        const updated = await this.updateStatus(orderId, 'cancelled');
        return updated;
      },
      { rpcName: 'cancel_order_robust' }
    );

    // Envoyer notifications asynchrones
    this.sendCustomerNotification(result, 'cancelled').catch(() => {
      /* ignore */
    });
    this.sendSellerNotification(result, 'cancelled').catch(() => {
      /* ignore */
    });

    return result;
  },

  /**
   * Envoie notification client (asynchrone, non-blocking)
   */
  async sendCustomerNotification(order: Order, status: OrderStatus): Promise<void> {
    try {
      let title = '';
      let body = '';
      const storeName = (order.stores as any)?.name || 'La boutique';
      const orderShortId = order.id.split('-')[0].toUpperCase();

      switch (status) {
        case 'pending':
          title = 'Nouvelle commande ! 🛒';
          body = `Votre commande #${orderShortId} est en attente d'acceptation par ${storeName}.`;
          break;
        case 'accepted':
          title = 'Commande acceptée ! ✅';
          body = `${storeName} a accepté votre commande #${orderShortId}. Elle est en cours de préparation.`;
          break;
        case 'paid':
          title = 'Paiement confirmé ! 💳';
          body = `Le paiement de votre commande #${orderShortId} chez ${storeName} a été confirmé.`;
          break;
        case 'shipped':
          title = 'Commande expédiée ! 🚚';
          body = `Bonne nouvelle ! Votre commande chez ${storeName} est en route.`;
          break;
        case 'delivered':
          title = 'Commande livrée ! ✨';
          body = `Votre commande a été livrée. Merci de votre confiance !`;
          break;
        case 'cancelled':
          title = 'Commande annulée ❌';
          body = `Votre commande #${orderShortId} chez ${storeName} a été annulée.`;
          break;
        case 'refunded':
          title = 'Commande remboursée 💰';
          body = `Votre commande #${orderShortId} a été remboursée.`;
          break;
      }

      if (title && body && order.user_id) {
        await notificationService.create({
          user_id: order.user_id,
          title,
          body,
          type: 'order',
          targetRole: 'client',
          data: { orderId: order.id, status },
        } as any);
      }
    } catch (e) {
      console.warn('Failed to send customer notification', e);
    }
  },

  /**
   * Envoie notification vendeur (asynchrone)
   */
  async sendSellerNotification(order: Order, type: 'new' | 'cancelled'): Promise<void> {
    try {
      const client = useSupabase();

      // Obtenir le user_id du vendeur
      let sellerId = (order.stores as any)?.user_id;
      if (!sellerId && order.store_id) {
        const { data: store, error } = await client
          .from('stores')
          .select('user_id')
          .eq('id', order.store_id)
          .maybeSingle();
        if (error) throw error;
        sellerId = store?.user_id;
      }

      if (!sellerId) return;

      const orderShortId = order.id.split('-')[0].toUpperCase();
      let title = '';
      let body = '';

      if (type === 'new') {
        title = 'Nouvelle commande ! 🛒';
        body = `Vous avez reçu une nouvelle commande (#${orderShortId})`;

        if (order.city) {
          body += ` — Livraison à ${order.city}`;
        }
        if (order.delivery_mode === 'km' && (order.latitude || order.longitude)) {
          body += ` 📍 Position GPS disponible`;
        } else if (order.delivery_mode === 'km') {
          body += ` 🗺️ Livraison au KM`;
        } else if (order.delivery_mode === 'city' && order.city) {
          body += ` 🏙️ Tarif ville`;
        }
        body += '.';
      } else if (type === 'cancelled') {
        title = 'Commande annulée ❌';
        body = `La commande #${orderShortId} a été annulée par le client.`;
        if (order.city) body += ` (Livraison prévue à ${order.city})`;
      }

      if (title && body) {
        await notificationService.create({
          user_id: sellerId,
          title,
          body,
          type: 'order',
          targetRole: 'seller',
          data: {
            orderId: order.id,
            status: 'cancelled',
            type,
            city: order.city || null,
            deliveryMode: order.delivery_mode || 'fixed',
            latitude: order.latitude || null,
            longitude: order.longitude || null,
          },
        } as any);
      }
    } catch (e) {
      console.warn('Failed to send seller notification', e);
    }
  },

  /**
   * Met à jour les métadonnées de plusieurs commandes
   */
  async updateMetadata(orderIds: string[], updates: Partial<Order>): Promise<Order[]> {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .update(updates)
      .in('id', orderIds)
      .select('*');

    if (error) throw error;

    // Invalider cache pour chaque commande
    await Promise.all(orderIds.map(id => cacheService.remove(`order:${id}`)));

    return data as Order[];
  },

  /**
   * Met à jour les informations de tracking de livraison
   */
  async updateTrackingInfo(orderId: string, trackingInfo: {
    tracking_number?: string;
    shipping_provider?: string;
    estimated_delivery_date?: string;
  }): Promise<Order> {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .update(trackingInfo)
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) throw error;

    await cacheService.remove(`order:${orderId}`);

    // Notifier le client
    if (trackingInfo.tracking_number) {
      this.sendCustomerNotification(data as Order, 'shipped').catch(e =>
        console.warn('Failed to send tracking notification', e)
      );
    }

    return data as Order;
  },

  /**
   * Met à jour la preuve de livraison
   */
  async updateDeliveryProof(orderId: string, proofUrl: string): Promise<Order> {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .update({ 
        delivery_proof_url: proofUrl,
        actual_delivery_date: new Date().toISOString()
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) throw error;

    await cacheService.remove(`order:${orderId}`);

    return data as Order;
  },

  /**
   * Crée des commandes en bulk (groupées par boutique)
   */
  async createBulkOrders(
    userId: string,
    groups: Record<string, any[]>,
    userMetadata: any
  ): Promise<Order[]> {
    const createdOrders: Order[] = [];
    const client = useSupabase();

    for (const [storeId, items] of Object.entries(groups)) {
      const storeIdForOrder = storeId === 'unknown' ? null : storeId;
      const subtotal = items.reduce((s: number, i: any) => s + (i.product.price || 0) * (i.quantity || 0), 0);

      const tax = items[0]?.tax_amount || 0;
      const shipping = items[0]?.delivery_fee || 0;
      const total = subtotal + tax + shipping;

      const orderPayload: OrderPayload = {
        user_id: userId,
        store_id: storeIdForOrder,
        total_amount: total,
        status: 'pending',
        payment_method: 'cash_on_delivery',
        payment_status: 'pending',
        shipping_address: userMetadata?.address || null,
        customer_phone: userMetadata?.phone || null,
        customer_name: userMetadata?.full_name || 'Client',
        delivery_fee: shipping,
        tax_amount: tax,
      };

      const itemsPayload: OrderItemPayload[] = items.map((item: any) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
      }));

      let created: Order | null = null;

      try {
        // Essayer RPC atomique
        created = await rpcUtils.executeWithFallback(
          'create_order_atomic',
          {
            p_order_payload: orderPayload,
            p_items_payload: itemsPayload,
          },
          async () => {
            // Fallback: créer manuellement
            const order = await this.create(orderPayload);
            const orderItems = await this.createItems(
              itemsPayload.map(item => ({
                ...item,
                order_id: order.id,
              }))
            );
            return order;
          },
          { rpcName: 'create_order_atomic' }
        );
      } catch (e: any) {
        console.error('Failed to create order', e);
        continue;
      }

      if (created?.id) {
        createdOrders.push(created);

        // Queue notifications (asynchrone)
        this.sendSellerNotification(created, 'new').catch(() => {
          /* ignore */
        });
        this.sendCustomerNotification(created, 'pending').catch(() => {
          /* ignore */
        });
      }
    }

    return createdOrders;
  },

  /**
   * Récupère les seuils de statut pour détection des commandes bloquées
   */
  async getStatusThresholds(): Promise<any[]> {
    const cacheKey = 'order-status-thresholds';
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const client = useSupabase();
    try {
      const { data, error } = await client
        .from('order_status_thresholds')
        .select('*')
        .order('status', { ascending: true });

      if (error) throw error;

      const thresholds = data || [];
      await cacheService.set(cacheKey, thresholds, 60, 50); // Cache 1 heure
      return thresholds;
    } catch (e) {
      console.warn('Failed to fetch status thresholds', e);
      return [];
    }
  },

  /**
   * 🚀 OPTIMISATION CRITIQUE: Récupère TOUTES les métadonnées de commandes en UNE requête
   * AVANT: 5 requêtes indépendantes (~1.2-2s)
   * APRÈS: 1 RPC consolidée (~100-150ms)
   * 
   * Retourne: total, par statut, chiffre d'affaire livré, etc.
   */
  async getStoreOrdersMetadata(storeId: string): Promise<{
    total_orders: number;
    pending_orders: number;
    accepted_orders: number;
    paid_orders: number;
    shipped_orders: number;
    delivered_orders: number;
    cancelled_orders: number;
    refunded_orders: number;
    status_counts: Record<string, number>;
    delivered_revenue: number;
    total_revenue: number;
  } | null> {
    const cacheKey = `store-orders-metadata:${storeId}`;
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const result = await rpcUtils.executeWithFallback(
        'get_store_orders_metadata',
        { p_store_id: storeId },
        async () => {
          // Fallback: reconstructire les données individuellement
          const [counts, byStatus, revenue] = await Promise.all([
            this.getCountsByStore(storeId),
            this.getCountsByStoreByStatus(storeId),
            this.getDeliveredTotalByStore(storeId),
          ]);

          return {
            total_orders: counts.total,
            pending_orders: counts.pending,
            accepted_orders: byStatus.accepted || 0,
            paid_orders: byStatus.paid || 0,
            shipped_orders: byStatus.shipped || 0,
            delivered_orders: byStatus.delivered || 0,
            cancelled_orders: byStatus.cancelled || 0,
            refunded_orders: byStatus.refunded || 0,
            status_counts: byStatus,
            delivered_revenue: revenue,
            total_revenue: revenue,
          };
        },
        { rpcName: 'get_store_orders_metadata' }
      );

      // Le RPC retourne un tableau car c'est un RETURNS TABLE
      const data = Array.isArray(result) ? result[0] : result;

      if (data) {
        // Cache 5 minutes (métadonnées changent fréquemment)
        await cacheService.set(cacheKey, data, CACHE_TTL_MINUTES, CACHE_STALE_MINUTES);
      }
      return data;
    } catch (e) {
      console.error('Failed to fetch store orders metadata', e);
      return null;
    }
  },

  /**
   * Récupère les commandes bloquées pour une boutique
   */
  async getStuckOrders(storeId: string): Promise<Order[]> {
    return rpcUtils.executeWithFallback(
      'get_stuck_orders',
      { p_store_id: storeId },
      async () => {
        const thresholds = await this.getStatusThresholds();
        const { data: orders, error } = await useSupabase()
          .from('orders')
          .select('*')
          .eq('store_id', storeId)
          .in('status', ['pending', 'accepted', 'paid', 'shipped']);

        if (error) throw error;

        return (orders as any[])?.filter((order: any) => {
          const stuck = this.isOrderStuck(order, thresholds);
          const threshold = stuck.threshold;
          return stuck.isStuck && (threshold?.should_notify_vendor || threshold?.should_notify_customer);
        }) || [];
      },
      { rpcName: 'get_stuck_orders' }
    );
  },

  /**
   * Calcule le nombre de jours qu'une commande est dans son statut actuel
   */
  calculateDaysInStatus(order: Order): number {
    if (!order.status_changed_at) return 0;
    const changedAt = new Date(order.status_changed_at);
    const now = new Date();
    const diffMs = now.getTime() - changedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  },

  /**
   * Calcule le nombre d'heures qu'une commande est dans son statut actuel
   */
  calculateHoursInStatus(order: Order): number {
    if (!order.status_changed_at) return 0;
    const changedAt = new Date(order.status_changed_at);
    const now = new Date();
    const diffMs = now.getTime() - changedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  },

  /**
   * Vérifie si une commande est bloquée
   */
  isOrderStuck(order: Order, thresholds: any[]): { isStuck: boolean; threshold?: any; hoursOver?: number } {
    const threshold = thresholds.find((t) => t.status === order.status);
    if (!threshold) return { isStuck: false };

    const hoursInStatus = this.calculateHoursInStatus(order);
    const isStuck = hoursInStatus > threshold.threshold_hours;
    const hoursOver = isStuck ? hoursInStatus - threshold.threshold_hours : 0;

    return { isStuck, threshold, hoursOver };
  },

  /**
   * Récupère les commandes nécessitant une notification de statut
   */
  async getOrdersNeedingNotification(storeId: string): Promise<Order[]> {
    const thresholds = await this.getStatusThresholds();

    const client = useSupabase();
    const { data: orders, error } = await client
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
      .in('status', ['pending', 'accepted', 'paid', 'shipped'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    return orders?.filter((order: Order) => {
      const stuck = this.isOrderStuck(order, thresholds);
      if (!stuck.isStuck) return false;

      const threshold = stuck.threshold;
      return threshold?.should_notify_vendor || threshold?.should_notify_customer;
    }) || [];
  },

  /**
   * 🔧 OPTIMISÉ: Log des mouvements stock en batch (au lieu de 1 par item)
   * AVANT: 1 fetch + 1 insert par item (N requêtes)
   * APRÈS: 1 fetch batch + 1 insert batch (2 requêtes)
   */
  async logOrderStockMovementsBeforeUpdate(
    order: Order,
    type: 'sale' | 'return'
  ): Promise<void> {
    try {
      const client = useSupabase();
      const items = order.order_items || [];

      if (items.length === 0) return;

      const orderShortId = order.id.split('-')[0].toUpperCase();

      // 1️⃣ Batch fetch des stocks frais
      const productIds = items.map(item => item.product_id).filter(Boolean);
      const { data: products, error: fetchErr } = await client
        .from('products')
        .select('id, stock')
        .in('id', productIds);

      if (fetchErr) throw fetchErr;

      const productStockMap = new Map(products?.map(p => [p.id, p.stock]) || []);

      // 2️⃣ Construire les mouvements de stock
      const movements = items
        .map((item: OrderItem) => {
          const previousStock = productStockMap.get(item.product_id) || 0;
          const qtyChanged = type === 'sale' ? -item.quantity : item.quantity;

          return {
            product_id: item.product_id,
            quantity_changed: qtyChanged,
            previous_stock: previousStock,
            new_stock: previousStock + qtyChanged,
            type: type,
            reason: type === 'sale' ? 'Vente en ligne' : 'Retour client',
            notes: `${type === 'sale' ? 'Vente' : 'Retour'} - Commande #${orderShortId}`,
            created_by: order.user_id || null,
          };
        })
        .filter(Boolean);

      if (movements.length === 0) return;

      // 3️⃣ Batch insert une seule fois
      for (let i = 0; i < movements.length; i += BATCH_SIZE) {
        const batch = movements.slice(i, i + BATCH_SIZE);
        const { error: insertErr } = await client
          .from('stock_movements')
          .insert(batch);

        if (insertErr) throw insertErr;
      }
    } catch (err) {
      console.warn('Failed to log stock movements', err);
    }
  },
};

import { useSupabase } from '../lib/supabase';
import { Order, OrderStatus, Product } from '../lib/supabase';
import { storeService } from './storeService';
import { productService } from './productService';
import { notificationService } from './notificationService';

export const orderService = {
  async create(order: Partial<Order>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .insert(order)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Order>) {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async createItems(items: any[]) {
    const client = useSupabase();
    const { data, error } = await client
      .from('order_items')
      .insert(items)
      .select('*');
    if (error) throw error;
    return data;
  },

  async processPayment(orderId: string) {
    const client = useSupabase();
    const { data, error } = await client.rpc('process_order_after_payment', {
      p_order_id: orderId,
    });
    if (error) throw error;
    return data;
  },

  async getById(orderId: string, options?: { includeUser?: boolean; includeStore?: boolean }) {
    const client = useSupabase();
    const selectParts = ['*', 'order_items(*, products(*))'];
    if (options?.includeUser) selectParts.push('users(*)');
    if (options?.includeStore) selectParts.push('stores(*)');

    const { data, error } = await client
      .from('orders')
      .select(selectParts.join(', '))
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByUser(userId: string) {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .select('*, stores(*), users(*), order_items(*, products(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByStore(storeId: string, options?: { 
    includeUser?: boolean; 
    limit?: number; 
    cursor?: string;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const client = useSupabase();
    const select = options?.includeUser
      ? '*, users(*), order_items(*, products(*))'
      : '*, order_items(*, products(*))';
    
    const limit = options?.limit || 20;
    
    let query = client
      .from('orders')
      .select(select)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (options?.cursor) {
      query = query.lt('created_at', options.cursor);
    }

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      const cleanSearch = options.search.trim().toLowerCase();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSearch);
      const isHex = /^[0-9a-f]{1,8}$/i.test(cleanSearch);

      if (isUuid) {
        query = query.or(`customer_name.ilike.%${options.search}%,customer_phone.ilike.%${options.search}%,id.eq.${cleanSearch}`);
      } else if (isHex) {
        const padLength = 8 - cleanSearch.length;
        const lowerHex = cleanSearch + '0'.repeat(padLength);
        const upperHex = cleanSearch + 'f'.repeat(padLength);
        const lowerBound = `${lowerHex}-0000-0000-0000-000000000000`;
        const upperBound = `${upperHex}-ffff-ffff-ffff-ffffffffffff`;
        query = query.or(`customer_name.ilike.%${options.search}%,customer_phone.ilike.%${options.search}%,and(id.gte.${lowerBound},id.lte.${upperBound})`);
      } else {
        query = query.or(`customer_name.ilike.%${options.search}%,customer_phone.ilike.%${options.search}%`);
      }
    }

    if (options?.dateFrom) {
      query = query.gte('created_at', options.dateFrom);
    }

    if (options?.dateTo) {
      query = query.lte('created_at', options.dateTo);
    }

    const { data, error } = await (query as any);
    if (error) throw error;

    const ordersData = (data || []) as any[];
    const hasMore = ordersData.length > limit;
    const orders = hasMore ? ordersData.slice(0, -1) : ordersData;
    const nextCursor = orders.length > 0 ? orders[orders.length - 1].created_at : null;

    return {
      orders,
      hasMore,
      nextCursor,
      count: orders.length
    };
  },

  async getCountsByStore(storeId: string) {
    const client = useSupabase();
    try {
      const totalResp: any = await client
        .from('orders')
        .select('id', { head: true, count: 'exact' })
        .eq('store_id', storeId);

      const pendingResp: any = await client
        .from('orders')
        .select('id', { head: true, count: 'exact' })
        .eq('store_id', storeId)
        .eq('status', 'pending');

      const total = Number(totalResp.count || 0);
      const pending = Number(pendingResp.count || 0);

      return { total, pending };
    } catch (e) {
      // En cas d'erreur, retourner des zéros sans casser l'UI
      return { total: 0, pending: 0 };
    }
  },

  async getCountsByStoreByStatus(storeId: string) {
    const client = useSupabase();
    const statuses = ['pending', 'accepted', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];
    try {
      const promises = statuses.map((s) =>
        client
          .from('orders')
          .select('id', { head: true, count: 'exact' })
          .eq('store_id', storeId)
          .eq('status', s)
      );

      const results = await Promise.all(promises);
      const counts: Record<string, number> = {};
      statuses.forEach((s, i) => {
        counts[s] = Number(results[i].count || 0);
      });

      // total count
      const totalResp: any = await client
        .from('orders')
        .select('id', { head: true, count: 'exact' })
        .eq('store_id', storeId);
      counts.total = Number(totalResp.count || 0);
      return counts;
    } catch (e) {
      console.warn('getCountsByStoreByStatus failed', e);
      return {} as Record<string, number>;
    }
  },

  async getDeliveredTotalByStore(storeId: string) {
    const client = useSupabase();
    try {
      const { data, error } = await client
        .from('orders')
        .select('total_amount')
        .eq('store_id', storeId)
        .eq('status', 'delivered');
      if (error) throw error;
      const rows = data || [];
      const total = rows.reduce((sum: number, r: any) => sum + Number(r?.total_amount || 0), 0);
      return total;
    } catch (e) {
      console.error('Error fetching delivered total for store', e);
      return 0;
    }
  },

  async updateStatus(id: string, status: OrderStatus) {
    const client = useSupabase();
    const { data: order, error } = await client
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select('*, stores(name), order_items(*)')
      .single();
    
    if (error) throw error;

    if (order && (order as any).user_id) {
      await this.sendCustomerNotification(order, status);
    }

    return order;
  },

  async acceptOrder(orderId: string, inventoryOnly: boolean = false) {
    const order: any = await this.getById(orderId);
    if (!order) throw new Error("Commande non trouvée");

    const client = useSupabase();
    try {
      const { data, error } = await client.rpc('accept_order', {
        p_order_id: orderId,
        p_inventory_only: inventoryOnly
      });
      if (error) throw error;
      // Notification
      await this.sendCustomerNotification(order, 'accepted');
      return data;
    } catch (e: any) {
      // Fallback for environments where the RPC does not exist OR RPC fails due to constraint errors.
      const errMsg = String(e?.message || e || '').toLowerCase();
      const isMissingRpc = e?.code === 'PGRST202' || errMsg.includes('could not find the function') || errMsg.includes('accept_order');
      const isConstraintViolation = e?.code === '23514' || (errMsg.includes('violates check constraint') && errMsg.includes('orders_status_check'));

      if (isMissingRpc || isConstraintViolation) {
        console.warn('accept_order RPC missing or failed with constraint, falling back to direct status update', e?.message || e);
        try {
          const { data: updated, error: updErr } = await client
            .from('orders')
            .update({ status: 'accepted' })
            .eq('id', orderId)
            .select('*')
            .single();
          if (updErr) throw updErr;
          // Send notifications similarly to RPC
          await this.sendCustomerNotification(updated, 'accepted');
          try { await this.sendSellerNotification(updated, 'new'); } catch (_) { /* ignore */ }
          return updated;
        } catch (e2) {
          throw e2 || e;
        }
      }
      throw e;
    }
  },

  async confirmOrderPayment(orderId: string) {
    const order: any = await this.getById(orderId);
    if (!order) throw new Error("Commande non trouvée");

    const client = useSupabase();
    
    const { data, error } = await client.rpc('confirm_order_payment', {
      p_order_id: orderId
    });
    
    if (error) throw error;
    
    // Notification
    await this.sendCustomerNotification(order, 'paid');

    return data;
  },

  async cancelOrderRobust(orderId: string) {
    const client = useSupabase();
    try {
      const { data, error } = await client.rpc('cancel_order_robust', {
        p_order_id: orderId
      });
      if (error) throw error;
      // Fetch full order for notifications
      const fullOrder = Array.isArray(data) ? data[0] : data;
      if (fullOrder) {
        try {
          await this.sendCustomerNotification(fullOrder, 'cancelled');
          await this.sendSellerNotification(fullOrder, 'cancelled');
        } catch (nErr) { console.warn('Notifications failed', nErr); }
      }
      return fullOrder || data;
    } catch (e: any) {
      // If the RPC does not exist (404) or fails for other reasons, fall back to a direct update
      console.warn('cancel_order_robust RPC failed, falling back to direct update', e?.message || e);
      try {
        // Perform minimal update (avoid select) then re-fetch to get consistent object
        const { error: updErr } = await client
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', orderId);
        if (updErr) throw updErr;

        const updated = await this.getById(orderId);
        try { 
          await this.sendCustomerNotification(updated, 'cancelled'); 
          await this.sendSellerNotification(updated, 'cancelled');
        } catch (nErr) { console.warn('Notifications failed', nErr); }
        return updated;
      } catch (e2) {
        // rethrow original or fallback error
        throw e2 || e;
      }
    }
  },

  async sendCustomerNotification(order: any, status: OrderStatus) {
    try {
      let title = '';
      let body = '';
      const storeName = order.stores?.name || order.store?.name || 'La boutique';
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
          data: { orderId: order.id, status }
        });
      }
    } catch (e) {
      console.warn('Failed to send customer notification:', e);
    }
  },

  async sendSellerNotification(order: any, type: 'new' | 'cancelled') {
    try {
      const client = useSupabase();
      
      // Obtenir le user_id du vendeur
      let sellerId = order.stores?.user_id || order.store?.user_id;
      if (!sellerId && order.store_id) {
        const { data: store } = await client
          .from('stores')
          .select('user_id')
          .eq('id', order.store_id)
          .single();
        sellerId = store?.user_id;
      }

      if (!sellerId) return;

      const orderShortId = order.id.split('-')[0].toUpperCase();
      let title = '';
      let body = '';

      if (type === 'new') {
        title = 'Nouvelle commande ! 🛒';
        body = `Vous avez reçu une nouvelle commande (#${orderShortId})`;

        // 📍 Détails de livraison dynamique
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
          data: {
            orderId: order.id,
            type,
            city: order.city || null,
            deliveryMode: order.delivery_mode || 'fixed',
            latitude: order.latitude || null,
            longitude: order.longitude || null,
          }
        });
      }
    } catch (e) {
      console.warn('Failed to send seller notification:', e);
    }
  },

  async updateMetadata(orderIds: string[], updates: any) {
    const client = useSupabase();
    const { data, error } = await client
      .from('orders')
      .update(updates)
      .in('id', orderIds)
      .select('*');
    
    if (error) throw error;
    return data;
  },

  async createBulkOrders(userId: string, groups: Record<string, any[]>, userMetadata: any) {
    const createdOrders: any[] = [];
    
    for (const [sid, group] of Object.entries(groups)) {
      const storeIdForOrder = sid === 'unknown' ? null : sid;
      const subtotalByStore = group.reduce((s: number, i: any) => s + (i.product.price || 0) * (i.quantity || 0), 0);
      
      // Calculate tax and shipping based on simplified logic for now
      // ideally these would comes from storeInfo passed from UI or fetched
      const tax = group[0].tax_amount || 0; 
      const shipping = group[0].delivery_fee || 0;
      const totalForOrder = subtotalByStore + tax + shipping;

      const baseOrderPayload: any = {
        user_id: userId,
        store_id: storeIdForOrder,
        total_amount: Number(totalForOrder),
        status: 'pending',
        payment_method: 'cash_on_delivery',
        payment_status: 'pending',
        shipping_address: userMetadata?.address || null,
        customer_phone: userMetadata?.phone || null,
        customer_name: userMetadata?.full_name || 'Client',
        delivery_fee: shipping,
        tax_amount: tax,
      };

      let created: any;
      try {
        created = await this.create(baseOrderPayload);
      } catch (e: any) {
        // Fallback for missing columns if schema is not updated
        const msg = String(e?.message || '').toLowerCase();
        if (msg.includes('customer_name') || msg.includes('column')) {
          const { customer_name, ...payloadWithoutName } = baseOrderPayload;
          created = await this.create(payloadWithoutName);
        } else {
          throw e;
        }
      }

      if (created?.id) {
        const rows = group.map((it: any) => ({
          order_id: created.id,
          product_id: it.product.id,
          quantity: it.quantity,
          price: it.product.price,
        }));
        await this.createItems(rows);
        createdOrders.push(created);
        
        // Notify seller and customer
        try {
          await this.sendSellerNotification(created, 'new');
          await this.sendCustomerNotification(created, 'pending');
        } catch (nErr) {
          console.warn('Initial notifications failed', nErr);
        }
      }
    }
    return createdOrders;
  },

  // Stuck order detection and management
  async getStatusThresholds() {
    const client = useSupabase();
    const { data, error } = await client
      .from('order_status_thresholds')
      .select('*')
      .order('status', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getStuckOrders(storeId: string) {
    const client = useSupabase();
    const { data, error } = await client.rpc('get_stuck_orders', {
      p_store_id: storeId,
    });
    if (error) throw error;
    return data || [];
  },

  calculateDaysInStatus(order: any): number {
    if (!order.status_changed_at) return 0;
    const changedAt = new Date(order.status_changed_at);
    const now = new Date();
    const diffMs = now.getTime() - changedAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.floor(diffDays);
  },

  calculateHoursInStatus(order: any): number {
    if (!order.status_changed_at) return 0;
    const changedAt = new Date(order.status_changed_at);
    const now = new Date();
    const diffMs = now.getTime() - changedAt.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.floor(diffHours);
  },

  isOrderStuck(order: any, thresholds: any[]): { isStuck: boolean; threshold?: any; hoursOver?: number } {
    const threshold = thresholds.find((t) => t.status === order.status);
    if (!threshold) return { isStuck: false };

    const hoursInStatus = this.calculateHoursInStatus(order);
    const isStuck = hoursInStatus > threshold.threshold_hours;
    const hoursOver = isStuck ? hoursInStatus - threshold.threshold_hours : 0;

    return { isStuck, threshold, hoursOver };
  },

  async getOrdersNeedingNotification(storeId: string) {
    const client = useSupabase();
    const thresholds = await this.getStatusThresholds();
    
    // Get all non-terminal orders for the store
    const { data: orders, error } = await client
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
      .in('status', ['pending', 'accepted', 'paid', 'shipped'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Filter orders that are stuck and should trigger notification
    const needNotification = orders?.filter((order: any) => {
      const stuck = this.isOrderStuck(order, thresholds);
      if (!stuck.isStuck) return false;

      const threshold = stuck.threshold;
      // Only notify if past threshold and notification is enabled
      return threshold?.should_notify_vendor || threshold?.should_notify_customer;
    }) || [];

    return needNotification;
  },
};

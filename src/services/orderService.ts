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
      query = query.or(`customer_name.ilike.%${options.search}%,customer_phone.ilike.%${options.search}%`);
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
    console.log('🔄 Accepting order...', orderId);
    
    const { data, error } = await client.rpc('accept_order', {
      p_order_id: orderId,
      p_inventory_only: inventoryOnly
    });
    
    if (error) throw error;
    
    // Notification
    await this.sendCustomerNotification(order, 'accepted');

    return data;
  },

  async confirmOrderPayment(orderId: string) {
    const order: any = await this.getById(orderId);
    if (!order) throw new Error("Commande non trouvée");

    const client = useSupabase();
    console.log('💰 Confirming payment...', orderId);
    
    const { data, error } = await client.rpc('confirm_order_payment', {
      p_order_id: orderId
    });
    
    if (error) throw error;
    
    // Notification
    await this.sendCustomerNotification(order, 'paid');

    return data;
  },

  async cancelOrderRobust(orderId: string) {
    const order: any = await this.getById(orderId);
    if (!order) throw new Error("Commande non trouvée");

    const client = useSupabase();
    console.log('❌ Cancelling order robustly...', orderId);
    try {
      const { data, error } = await client.rpc('cancel_order_robust', {
        p_order_id: orderId
      });
      if (error) throw error;
      // Notification
      await this.sendCustomerNotification(order, 'cancelled');
      return data;
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
        try { await this.sendCustomerNotification(updated, 'cancelled'); } catch (nErr) { console.warn('sendCustomerNotification failed', nErr); }
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

      if (title && body) {
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
      }
    }
    return createdOrders;
  },
};

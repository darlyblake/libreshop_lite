import { supabase } from '../lib/supabase';

// Helper function to check if current user is admin
async function isAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase!.auth.getUser();
    if (!user) return false;

    // Check auth metadata first
    const authRole = user.user_metadata?.role || user.app_metadata?.role;
    if (authRole === 'admin') return true;

    // Also check users table for role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (userData?.role === 'admin') return true;

    return false;
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

// Helper function to enforce admin access
async function requireAdmin(): Promise<void> {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    throw new Error('Accès non autorisé');
  }
}

export interface DashboardStats {
  totalUsers: number;
  totalStores: number;
  totalOrders: number;
  totalRevenue: number;
  activeSubscriptions: number;
  pendingOrders: number;
  pendingPayments: number;
}

export interface Activity {
  id: string;
  type: 'user' | 'store' | 'order' | 'payment' | 'subscription';
  message: string;
  time: string;
  user?: string;
  amount?: number;
  _createdAt?: string;
}

export const adminService = {
  async getDashboardStats(): Promise<DashboardStats> {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    
    const [
      usersRes,
      storesRes,
      ordersRes,
      pendingOrdersRes,
      activeSubscriptionsRes,
      pendingPaymentsRes,
      overduePaymentsRes,
      paidStoresRes,
    ] = await Promise.all([
      supabase.from('users').select('id', { head: true, count: 'exact' }),
      supabase.from('stores').select('id', { head: true, count: 'exact' }),
      supabase.from('orders').select('id', { head: true, count: 'exact' }),
      supabase.from('orders').select('id', { head: true, count: 'exact' }).eq('status', 'pending'),
      supabase.from('stores').select('id', { head: true, count: 'exact' }).in('subscription_status', ['active', 'trial']),
      supabase.from('stores').select('id', { head: true, count: 'exact' }).eq('billing_status', 'pending'),
      supabase.from('stores').select('id', { head: true, count: 'exact' }).eq('billing_status', 'overdue'),
      supabase.from('stores').select('subscription_price').eq('billing_status', 'paid'),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (storesRes.error) throw storesRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (pendingOrdersRes.error) throw pendingOrdersRes.error;
    if (activeSubscriptionsRes.error) throw activeSubscriptionsRes.error;
    if (pendingPaymentsRes.error) throw pendingPaymentsRes.error;
    if (overduePaymentsRes.error) throw overduePaymentsRes.error;
    if (paidStoresRes.error) throw paidStoresRes.error;

    const paidRevenue = (paidStoresRes.data || []).reduce((acc: number, row: any) => {
      const v = Number(row?.subscription_price || 0);
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);

    const pendingPayments = (pendingPaymentsRes.count || 0) + (overduePaymentsRes.count || 0);

    return {
      totalUsers: usersRes.count || 0,
      totalStores: storesRes.count || 0,
      totalOrders: ordersRes.count || 0,
      totalRevenue: paidRevenue,
      activeSubscriptions: activeSubscriptionsRes.count || 0,
      pendingOrders: pendingOrdersRes.count || 0,
      pendingPayments,
    };
  },

  async getRecentActivity(): Promise<Omit<Activity, '_createdAt'>[]> {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');

    const [usersRes, storesRes, ordersRes, notificationsRes] = await Promise.all([
      supabase.from('users').select('full_name,created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('stores').select('name,created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('orders').select('total_amount,created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('notifications').select('title,type,created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (storesRes.error) throw storesRes.error;
    if (ordersRes.error) throw ordersRes.error;
    const notificationsMissing =
      (notificationsRes as any)?.error?.code === 'PGRST205' ||
      String((notificationsRes as any)?.error?.message || '').toLowerCase().includes('could not find the table');
    if (notificationsRes.error && !notificationsMissing) throw notificationsRes.error;

    const items: Array<Activity & { _createdAt: string }> = [];

    (usersRes.data || []).forEach((u: any, idx: number) => {
      const createdAt = String(u?.created_at || '');
      items.push({
        id: `user-${idx}-${createdAt}`,
        type: 'user',
        message: 'Nouvel utilisateur inscrit',
        user: u.full_name || 'Utilisateur inconnu',
        time: this.formatTimeAgo(createdAt),
        _createdAt: createdAt,
      });
    });

    (storesRes.data || []).forEach((s: any, idx: number) => {
      const createdAt = String(s?.created_at || '');
      items.push({
        id: `store-${idx}-${createdAt}`,
        type: 'store',
        message: 'Nouvelle boutique créée',
        user: s.name || 'Boutique sans nom',
        time: this.formatTimeAgo(createdAt),
        _createdAt: createdAt,
      });
    });

    (ordersRes.data || []).forEach((o: any, idx: number) => {
      const createdAt = String(o?.created_at || '');
      items.push({
        id: `order-${idx}-${createdAt}`,
        type: 'order',
        message: 'Nouvelle commande',
        amount: Number(o.total_amount) || 0,
        time: this.formatTimeAgo(createdAt),
        _createdAt: createdAt,
      });
    });

    (notificationsRes.data || []).forEach((n: any, idx: number) => {
      const createdAt = String(n?.created_at || '');
      items.push({
        id: `notif-${idx}-${createdAt}`,
        type: (n.type as Activity['type']) || 'payment',
        message: n.title || 'Notification',
        time: this.formatTimeAgo(createdAt),
        _createdAt: createdAt,
      });
    });

    items.sort((a, b) => new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime());

    // Take top 10 removing _createdAt
    return items.slice(0, 10).map((it) => {
      const { _createdAt, ...rest } = it;
      return rest;
    });
  },

  formatTimeAgo(dateString: string) {
    if (!dateString) return 'Récemment';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Récemment';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return `Il y a ${diffSeconds} sec`;
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays >= 5) {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    }
    return `Il y a ${diffDays} j`;
  },
  

  async getStoresWithDetails(): Promise<any[]> {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    
    const { data, error } = await supabase
      .from('stores')
      .select('id,user_id,name,slug,description,category,status,subscription_plan,subscription_start,subscription_end,subscription_status,product_limit,visible,created_at,phone,address,users:users!stores_user_id_fkey(id,email,full_name,phone)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Fetch orders, products, and reviews for each store individually
    const storesWithData = await Promise.all(
      (data || []).map(async (store: any) => {
        try {
          // Fetch orders for this store
          const { data: ordersData } = await supabase!
            .from('orders')
            .select('id,total_amount,status,created_at')
            .eq('store_id', store.id);
        
          // Fetch products for this store
          const { data: productsData } = await supabase!
            .from('products')
            .select('id,name,stock,is_active,price')
            .eq('store_id', store.id);
        
          // Fetch reviews for this store
          const { data: reviewsData } = await supabase!
            .from('store_reviews')
            .select('rating')
            .eq('store_id', store.id);
          
          // Calculate revenue from completed/delivered orders
          const revenue = (ordersData || [])
            .filter((o: any) => o.status === 'completed' || o.status === 'delivered')
            .reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
          
          // Calculate average rating
          const ratingCount = (reviewsData || []).length;
          const averageRating = ratingCount > 0
            ? (reviewsData || []).reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0) / ratingCount
            : 0;
          
          return {
            id: String(store.id),
            user_id: String(store.user_id),
            ownerId: String(store.user_id),
            name: String(store.name || ''),
            slug: String(store.slug || ''),
            description: store.description || '',
            category: String(store.category || ''),
            status: String(store.status || 'active'),
            address: store.address || '-',
            logo: null,
            banner: null,
            city: '-',
            plan: store.subscription_plan || '-',
            subStart: store.subscription_start ? String(store.subscription_start) : '-',
            subEnd: store.subscription_end ? String(store.subscription_end) : '-',
            subStatus: store.subscription_status || '-',
            subDuration: store.subscription_start && store.subscription_end ? 
              Math.ceil(new Date(store.subscription_end).getTime() - new Date(store.subscription_start).getTime()) / (1000 * 60 * 60 * 24 * 30) : '-',
            productLimit: store.product_limit ?? undefined,
            visible: store.visible ?? true,
            joinDate: store.created_at ? String(store.created_at) : '-',
            owner: store.users?.full_name || '-',
            email: store.users?.email || '-',
            phone: store.phone || store.users?.phone || '-',
            revenue: revenue,
            orders: (ordersData || []).length,
            rating: Number(averageRating.toFixed(1)),
            products: (productsData || []).length,
            productList: (productsData || []).map((p: any) => ({
              id: p.id,
              name: p.name || 'Produit',
              status: p.is_active ? 'active' : 'inactive',
              stock: p.stock || 0,
              price: p.price || 0,
            })),
            orderList: (ordersData || []).map((o: any) => ({
              id: o.id,
              order_number: o.id,
              status: o.status,
              total_amount: o.total_amount,
              created_at: o.created_at,
            })),
          };
        } catch (err) {
          // If fetching data fails, return store with default values
          console.error(`Error fetching data for store ${store.id}:`, err);
          return {
            id: String(store.id),
            user_id: String(store.user_id),
            ownerId: String(store.user_id),
            name: String(store.name || ''),
            slug: String(store.slug || ''),
            description: store.description || '',
            category: String(store.category || ''),
            status: String(store.status || 'active'),
            address: store.address || '-',
            logo: null,
            banner: null,
            city: '-',
            plan: store.subscription_plan || '-',
            subStart: store.subscription_start ? String(store.subscription_start) : '-',
            subEnd: store.subscription_end ? String(store.subscription_end) : '-',
            subStatus: store.subscription_status || '-',
            subDuration: store.subscription_start && store.subscription_end ? 
              Math.ceil(new Date(store.subscription_end).getTime() - new Date(store.subscription_start).getTime()) / (1000 * 60 * 60 * 24 * 30) : '-',
            productLimit: store.product_limit ?? undefined,
            visible: store.visible ?? true,
            joinDate: store.created_at ? String(store.created_at) : '-',
            owner: store.users?.full_name || '-',
            email: store.users?.email || '-',
            phone: store.phone || store.users?.phone || '-',
            revenue: 0,
            orders: 0,
            rating: 0,
            products: 0,
            productList: [],
            orderList: [],
          };
        }
      })
    );
    
    return storesWithData;
  },
  
  async updateStoreStatus(storeId: string, nextStatus: 'active' | 'suspended' | 'pending') {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('stores')
      .update({ status: nextStatus })
      .eq('id', storeId)
      .select('id,status,user_id,name')
      .single();
      
    if (error) throw error;

    // 🔔 Notifier le vendeur du changement de statut de sa boutique
    if (data?.user_id) {
      const { notificationService } = await import('./notificationService');
      const isApproved = nextStatus === 'active';
      const isSuspended = nextStatus === 'suspended';
      if (isApproved || isSuspended) {
        await notificationService.create({
          user_id: data.user_id,
          title: isApproved
            ? '✅ Boutique approuvée !'
            : isSuspended
            ? '⚠️ Boutique suspendue'
            : '📋 Statut de boutique mis à jour',
          body: isApproved
            ? `Votre boutique "${data.name || ''}" a été approuvée par l'administration. Elle est maintenant visible.`
            : `Votre boutique "${data.name || ''}" a été suspendue. Contactez le support pour plus d'informations.`,
          type: 'system',
          data: { storeId, status: nextStatus },
        }).catch(console.warn);
      }
    }

    return data;
  },
  
  async deleteStore(storeId: string) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    if (error) throw error;
  },

  async getUsers() {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');

    // First, fetch users with basic info
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id,email,full_name,role,status,created_at,phone,whatsapp_number,avatar_url')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    console.log('Fetched users:', users?.length || 0);

    // Then fetch orders for all users
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id,user_id,total_amount,status,created_at')
      .in('user_id', (users || []).map((u: any) => u.id));

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    console.log('Fetched orders:', orders?.length || 0);

    // Then fetch order items for all orders
    const orderIds = (orders || []).map((o: any) => o.id);
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id,order_id,quantity,price,products!inner(name,stores!inner(name))')
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      throw itemsError;
    }

    console.log('Fetched order items:', orderItems?.length || 0);
    
    // Group orders by user
    const ordersByUser: Record<string, any[]> = {};
    (orders || []).forEach((order: any) => {
      if (!ordersByUser[order.user_id]) {
        ordersByUser[order.user_id] = [];
      }
      ordersByUser[order.user_id].push({
        ...order,
        order_number: order.id,
        user_name: (users || []).find((u: any) => u.id === order.user_id)?.full_name || 'Client inconnu',
        items: (orderItems || []).filter((item: any) => item.order_id === order.id).map((item: any) => ({
          quantity: item.quantity,
          price: item.price,
          product_name: item.products?.name || 'Produit inconnu',
          store_name: item.products?.stores?.name || 'Boutique inconnue',
        }))
      });
    });
    
    // Merge users with same phone number (for clients only)
    const mergedUsers: Record<string, any> = {};
    (users || []).forEach((u: any) => {
      if (u.role !== 'client') {
        // Non-clients are not merged
        mergedUsers[u.id] = u;
      } else {
        const phone = u.phone || u.whatsapp_number;
        if (!phone) {
          // No phone, use id as key
          mergedUsers[u.id] = u;
        } else {
          // Use phone as key to merge duplicates
          if (!mergedUsers[phone]) {
            mergedUsers[phone] = { ...u, merged_ids: [u.id], is_merged: false };
          } else {
            // Merge with existing user
            mergedUsers[phone].merged_ids.push(u.id);
            mergedUsers[phone].is_merged = true;
            // Keep the most recent data
            if (new Date(u.created_at) > new Date(mergedUsers[phone].created_at)) {
              mergedUsers[phone] = { ...u, merged_ids: mergedUsers[phone].merged_ids, is_merged: true };
            }
            // Keep the most complete email
            if (!mergedUsers[phone].email && u.email) {
              mergedUsers[phone].email = u.email;
            }
          }
        }
      }
    });
    
    // Create user ID map for orders
    const userIdMap: Record<string, string> = {};
    (users || []).forEach((u: any) => {
      if (u.role === 'client') {
        const phone = u.phone || u.whatsapp_number;
        if (phone) {
          userIdMap[u.id] = phone;
        }
      }
    });
    
    // Re-map orders to merged users
    const ordersByMergedUser: Record<string, any[]> = {};
    (orders || []).forEach((order: any) => {
      const userId = order.user_id;
      const user = (users || []).find((u: any) => u.id === userId);
      const mergedKey = (user?.role === 'client' && (user?.phone || user?.whatsapp_number)) 
        ? (user.phone || user.whatsapp_number) 
        : userId;
      if (!ordersByMergedUser[mergedKey]) {
        ordersByMergedUser[mergedKey] = [];
      }
      ordersByMergedUser[mergedKey].push({
        ...order,
        order_number: order.id,
        user_name: (users || []).find((u: any) => u.id === order.user_id)?.full_name || 'Client inconnu',
        items: (orderItems || []).filter((item: any) => item.order_id === order.id).map((item: any) => ({
          quantity: item.quantity,
          price: item.price,
          product_name: item.products?.name || 'Produit inconnu',
          store_name: item.products?.stores?.name || 'Boutique inconnue',
        }))
      });
    });
    
    // Calculate total orders and spent for each merged user
    return Object.values(mergedUsers).map((u: any) => {
      const key = u.phone || u.whatsapp_number || u.id;
      const userOrders = ordersByMergedUser[key] || [];
      const totalOrders = userOrders.length;
      const totalSpent = userOrders.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
      
      return {
        ...u,
        id: u.merged_ids?.[0] || u.id, // Use the first merged user's actual UUID as the ID
        order_details: userOrders,
        total_orders: totalOrders,
        total_spent: totalSpent,
      };
    });
  },

  async updateUserStatus(userId: string, status: string) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', userId)
      .select('id,status,full_name,role')
      .single();
    if (error) throw error;

    // 🔔 Notifier le vendeur si son compte est approuvé ou suspendu
    if (data?.role === 'seller' || data?.role === 'client') {
      const { notificationService } = await import('./notificationService');
      if (status === 'active') {
        await notificationService.create({
          user_id: userId,
          title: '✅ Compte activé',
          body: `Votre compte a été activé par l'administration. Vous pouvez maintenant accéder à toutes les fonctionnalités.`,
          type: 'system',
          data: { userId, status },
        }).catch(console.warn);
      } else if (status === 'suspended' || status === 'banned') {
        await notificationService.create({
          user_id: userId,
          title: '🚫 Compte suspendu',
          body: `Votre compte a été suspendu par l'administration. Contactez le support pour plus d'informations.`,
          type: 'system',
          data: { userId, status },
        }).catch(console.warn);
      }
    }

    return data;
  },

  async updateUserSuspensionReason(userId: string, reason: string) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase
      .from('users')
      .update({ suspension_reason: reason, suspended_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  },

  async updateUserProfile(userId: string, data: { full_name: string; email: string; phone: string }) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase
      .from('users')
      .update({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
      })
      .eq('id', userId);
    if (error) throw error;
  },

  async validateSeller(userId: string) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('users')
      .update({ status: 'active', role: 'seller' })
      .eq('id', userId)
      .select('id,status,role,full_name')
      .single();
    if (error) throw error;

    // 🔔 Notifier le vendeur que son compte a été approuvé
    try {
      const { notificationService } = await import('./notificationService');
      await notificationService.create({
        user_id: userId,
        title: '🎉 Compte vendeur approuvé !',
        body: `Bienvenue ${data?.full_name || ''} ! Votre compte vendeur a été validé par l'administration. Vous pouvez maintenant créer votre boutique et commencer à vendre.`,
        type: 'system',
        data: { userId, role: 'seller' },
      });
    } catch (e) {
      console.warn('Failed to send seller validation notification:', e);
    }

    return data;
  },

  async getPaymentsStores() {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('stores')
      .select(
        'id,name,product_limit,subscription_plan,subscription_price,subscription_status,subscription_end,cashier_active,online_store_active,analytics_active,billing_status,last_payment_date,next_billing_date,users:users!stores_user_id_fkey(full_name)'
      )
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getStorePaymentHistory(storeId: string) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('store_id', storeId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  async addPaymentHistory(storeId: string, payment: any) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('payment_history')
      .insert({
        store_id: storeId,
        amount: payment.amount,
        status: payment.status,
        payment_date: payment.date,
        method: payment.method,
        plan: payment.plan,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateStoreBilling(storeId: string, updates: any) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', storeId)
      .select('id,billing_status,last_payment_date,subscription_status,cashier_active,online_store_active,analytics_active')
      .single();
    if (error) throw error;
    return data;
  },

  async syncUserRolesWithStores() {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    
    // Get all users with stores
    const { data: storeOwners, error } = await supabase
      .from('stores')
      .select('user_id')
      .not('user_id', 'is', null);
    
    if (error) throw error;
    
    const userIds = [...new Set(storeOwners?.map(s => s.user_id) || [])];
    
    if (userIds.length === 0) {
      console.log('[AdminService] No store owners to sync');
      return { updated: 0 };
    }
    
    // Update all store owners to have 'seller' role
    const { data: updatedUsers, error: updateError } = await supabase
      .from('users')
      .update({ role: 'seller' })
      .in('id', userIds)
      .select('id,full_name,role');
    
    if (updateError) throw updateError;
    
    console.log(`[AdminService] Synced ${updatedUsers?.length || 0} users to seller role`);
    return { updated: updatedUsers?.length || 0, users: updatedUsers };
  },

  async fixAnonymousUsers() {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    
    // Get all users with 'Anonyme' as full_name
    const { data: anonymousUsers, error } = await supabase
      .from('users')
      .select('id,email,full_name')
      .eq('full_name', 'Anonyme');
    
    if (error) throw error;
    
    if (!anonymousUsers || anonymousUsers.length === 0) {
      console.log('[AdminService] No anonymous users to fix');
      return { fixed: 0 };
    }
    
    // Update anonymous users with their email as name
    const updatedUsers = await Promise.all(
      anonymousUsers.map(async (u: any) => {
        const newName = u.email || u.full_name;
        const { data, error } = await supabase!
          .from('users')
          .update({ full_name: newName })
          .eq('id', u.id)
          .select('id,full_name')
          .single();
        if (error) throw error;
        return data;
      })
    );
    
    console.log(`[AdminService] Fixed ${updatedUsers?.length || 0} anonymous users`);
    return { fixed: updatedUsers?.length || 0, users: updatedUsers };
  },

  // Administrator management methods
  async getAdministrators() {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('administrators')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addAdministrator(admin: any) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('administrators')
      .insert({
        name: admin.name,
        email: admin.email,
        password: admin.password,
        role: admin.role,
        status: admin.status || 'active',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAdministrator(id: string, updates: any) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('administrators')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAdministrator(id: string) {
    await requireAdmin();
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase
      .from('administrators')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },
};

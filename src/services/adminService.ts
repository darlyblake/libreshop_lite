import { supabase } from '../lib/supabase';

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
    if (!supabase) throw new Error('Supabase client not initialized');
    
    const { data, error } = await supabase
      .from('stores')
      .select('id,user_id,name,slug,description,category,status,subscription_plan,subscription_start,subscription_end,subscription_status,product_limit,visible,created_at,users:users!stores_user_id_fkey(id,email,full_name,phone)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return (data || []).map((s: any) => ({
      id: String(s.id),
      user_id: String(s.user_id),
      name: String(s.name || ''),
      slug: String(s.slug || ''),
      description: s.description || '',
      category: String(s.category || ''),
      status: String(s.status || 'active'),
      address: '-',
      plan: s.subscription_plan || '-',
      subStart: s.subscription_start ? String(s.subscription_start) : '-',
      subEnd: s.subscription_end ? String(s.subscription_end) : '-',
      subStatus: s.subscription_status || '-',
      productLimit: s.product_limit ?? undefined,
      visible: s.visible ?? true,
      joinDate: s.created_at ? String(s.created_at) : '-',
      owner: s.users?.full_name || '-',
      email: s.users?.email || '-',
      phone: s.users?.phone || '-',
      revenue: 0,
      orders: 0,
      rating: 0,
      products: 0,
      productList: [],
      orderList: [],
    }));
  },
  
  async updateStoreStatus(storeId: string, nextStatus: 'active' | 'suspended' | 'pending') {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('stores')
      .update({ status: nextStatus })
      .eq('id', storeId)
      .select('id,status')
      .single();
      
    if (error) throw error;
    return data;
  },
  
  async deleteStore(storeId: string) {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    if (error) throw error;
  },

  async getUsers() {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('users')
      .select('id,email,full_name,role,status,created_at,phone,whatsapp_number,avatar_url')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateUserStatus(userId: string, status: string) {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', userId)
      .select('id,status')
      .single();
    if (error) throw error;
    return data;
  },

  async validateSeller(userId: string) {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('users')
      .update({ status: 'active', role: 'seller' })
      .eq('id', userId)
      .select('id,status,role')
      .single();
    if (error) throw error;
    return data;
  },

  async getPaymentsStores() {
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

  async updateStoreBilling(storeId: string, updates: any) {
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
};

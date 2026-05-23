import { supabase } from '../lib/supabase';

// Types pour les rapports
export interface DailySalesReport {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalItemsSold: number;
}

export interface MonthlySalesReport {
  month: string;
  year: number;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalItemsSold: number;
}

export interface CollectionSalesReport {
  collectionName: string;
  collectionId: string;
  totalRevenue: number;
  totalOrders: number;
  totalItemsSold: number;
  percentage: number;
}

export interface MarginReport {
  productId: string;
  productName: string;
  costPrice: number;
  sellingPrice: number;
  margin: number;
  marginPercentage: number;
  quantitySold: number;
  totalMargin: number;
}

export interface ReturnReport {
  orderId: string;
  orderDate: string;
  productName: string;
  quantity: number;
  reason: string;
  refundAmount: number;
  status: 'requested' | 'approved' | 'rejected' | 'shipped' | 'received' | 'completed' | 'cancelled';
}

export interface InventoryReport {
  productId: string;
  productName: string;
  category: string;
  currentStock: number;
  lowStockThreshold: number;
  value: number;
  lastRestocked: string;
  status: 'ok' | 'low' | 'out';
}

export interface ClientReport {
  clientId: string;
  clientName: string;
  clientPhone: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string;
  status: 'active' | 'inactive';
}

export interface ReportData {
  dailySales: DailySalesReport[];
  monthlySales: MonthlySalesReport[];
  collectionSales: CollectionSalesReport[];
  margins: MarginReport[];
  returns: ReturnReport[];
  inventory: InventoryReport[];
  clients: ClientReport[];
}

export const reportsService = {
  // Rapport des ventes par jour
  async getDailySalesReport(storeId: string, startDate: Date, endDate: Date): Promise<DailySalesReport[]> {
    // We use the manual calculation directly to avoid 404 errors from missing RPC functions
    return this.calculateDailySalesManually(storeId, startDate, endDate);
  },

  async calculateDailySalesManually(storeId: string, startDate: Date, endDate: Date): Promise<DailySalesReport[]> {
    try {
      if (!supabase) return [];
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, total_amount, order_items(quantity)')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      if (error) throw error;

      const dailyMap = new Map<string, DailySalesReport>();

      orders?.forEach((order: any) => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        const existing = dailyMap.get(date) || {
          date,
          totalRevenue: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          totalItemsSold: 0,
        };

        existing.totalRevenue += order.total_amount || 0;
        existing.totalOrders += 1;
        existing.totalItemsSold += (order.order_items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        existing.averageOrderValue = existing.totalRevenue / existing.totalOrders;

        dailyMap.set(date, existing);
      });

      return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('Error calculating daily sales manually:', error);
      return [];
    }
  },

  // Rapport des ventes par mois
  async getMonthlySalesReport(storeId: string, year: number): Promise<MonthlySalesReport[]> {
    try {
      if (!supabase) return [];
      
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, total_amount, order_items(quantity)')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      if (error) throw error;

      const monthlyMap = new Map<number, MonthlySalesReport>();

      orders?.forEach((order: any) => {
        const date = new Date(order.created_at);
        const month = date.getMonth();
        const existing = monthlyMap.get(month) || {
          month: date.toLocaleString('fr-FR', { month: 'long' }),
          year,
          totalRevenue: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          totalItemsSold: 0,
        };

        existing.totalRevenue += order.total_amount || 0;
        existing.totalOrders += 1;
        existing.totalItemsSold += (order.order_items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        existing.averageOrderValue = existing.totalRevenue / existing.totalOrders;

        monthlyMap.set(month, existing);
      });

      return Array.from(monthlyMap.values()).sort((a, b) => {
        const monthIndexA = new Date(`${a.month} 1, ${a.year}`).getMonth();
        const monthIndexB = new Date(`${b.month} 1, ${b.year}`).getMonth();
        return monthIndexA - monthIndexB;
      });
    } catch (error) {
      console.error('Error fetching monthly sales report:', error);
      return [];
    }
  },

  // Rapport des ventes par collection
  async getCollectionSalesReport(storeId: string, startDate: Date, endDate: Date): Promise<CollectionSalesReport[]> {
    try {
      if (!supabase) return [];
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_amount, order_items(quantity, price, products(collection_id, collections(name)))')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      if (error) throw error;

      const collectionMap = new Map<string, CollectionSalesReport>();
      let totalRevenue = 0;

      orders?.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          const collectionId = item.products?.collection_id || 'unassigned';
          const collectionName = item.products?.collections?.name || 'Sans collection';
          
          const existing = collectionMap.get(collectionId) || {
            collectionName: collectionName,
            collectionId: collectionId,
            totalRevenue: 0,
            totalOrders: 0,
            totalItemsSold: 0,
            percentage: 0,
          };

          const itemTotal = (item.price || 0) * (item.quantity || 0);
          existing.totalRevenue += itemTotal;
          existing.totalOrders += 1;
          existing.totalItemsSold += item.quantity || 0;

          collectionMap.set(collectionId, existing);
          totalRevenue += itemTotal;
        });
      });

      const reports = Array.from(collectionMap.values());
      reports.forEach(report => {
        report.percentage = totalRevenue > 0 ? Number(((report.totalRevenue / totalRevenue) * 100).toFixed(2)) : 0;
      });

      return reports.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
      console.error('Error fetching collection sales report:', error);
      return [];
    }
  },

  // Rapport des marges
  async getMarginReport(storeId: string, startDate: Date, endDate: Date): Promise<MarginReport[]> {
    try {
      if (!supabase) return [];
      
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, cost_price, price')
        .eq('store_id', storeId);

      if (productsError) throw productsError;

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('order_items(product_id, quantity, price)')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      if (ordersError) throw ordersError;

      const productSales = new Map<string, { quantity: number; totalRevenue: number }>();

      orders?.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          const existing = productSales.get(item.product_id) || { quantity: 0, totalRevenue: 0 };
          existing.quantity += item.quantity || 0;
          existing.totalRevenue += (item.price || 0) * (item.quantity || 0);
          productSales.set(item.product_id, existing);
        });
      });

      const marginReports: MarginReport[] = [];

      products?.forEach((product: any) => {
        const sales = productSales.get(product.id) || { quantity: 0, totalRevenue: 0 };
        const costPrice = product.cost_price || 0;
        const sellingPrice = product.price || 0;
        const margin = sellingPrice - costPrice;
        const marginPercentage = costPrice > 0 ? (margin / costPrice) * 100 : 0;

        if (sales.quantity > 0) {
          marginReports.push({
            productId: product.id,
            productName: product.name,
            costPrice,
            sellingPrice,
            margin,
            marginPercentage,
            quantitySold: sales.quantity,
            totalMargin: margin * sales.quantity,
          });
        }
      });

      return marginReports.sort((a, b) => b.totalMargin - a.totalMargin);
    } catch (error) {
      console.error('Error fetching margin report:', error);
      return [];
    }
  },

  // Rapport des retours
  async getReturnReport(storeId: string, startDate: Date, endDate: Date): Promise<ReturnReport[]> {
    try {
      if (!supabase) return [];
      
      const { data, error } = await supabase
        .from('returns')
        .select('id, order_id, created_at, reason, refund_amount, status, products(name), quantity')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const reports: ReturnReport[] = (data || []).map((item: any) => ({
        orderId: item.order_id,
        orderDate: item.created_at,
        productName: item.products?.name || 'Produit inconnu',
        quantity: item.quantity || 1,
        reason: item.reason || 'Non spécifié',
        refundAmount: item.refund_amount || 0,
        status: item.status || 'requested',
      }));

      return reports.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    } catch (error) {
      console.error('Error fetching return report:', error);
      return [];
    }
  },

  // Rapport de l'inventaire
  async getInventoryReport(storeId: string): Promise<InventoryReport[]> {
    try {
      if (!supabase) return [];
      
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, category, stock, low_stock_threshold, price, updated_at')
        .eq('store_id', storeId);

      if (error) throw error;

      const reports: InventoryReport[] = [];

      products?.forEach((product: any) => {
        const stock = product.stock || 0;
        const lowStockThreshold = product.low_stock_threshold || 5;
        let status: 'ok' | 'low' | 'out' = 'ok';

        if (stock === 0) {
          status = 'out';
        } else if (stock <= lowStockThreshold) {
          status = 'low';
        }

        reports.push({
          productId: product.id,
          productName: product.name,
          category: product.category || 'Non catégorisé',
          currentStock: stock,
          lowStockThreshold,
          value: stock * (product.price || 0),
          lastRestocked: product.updated_at,
          status,
        });
      });

      return reports.sort((a, b) => a.currentStock - b.currentStock);
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      return [];
    }
  },

  // Rapport des clients
  async getClientReport(storeId: string): Promise<ClientReport[]> {
    try {
      if (!supabase) return [];
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('customer_name, customer_phone, total_amount, created_at')
        .eq('store_id', storeId)
        .in('status', ['paid', 'delivered']);

      if (error) throw error;

      const clientMap = new Map<string, ClientReport>();

      orders?.forEach((order: any) => {
        const phone = order.customer_phone || 'Inconnu';
        const existing = clientMap.get(phone) || {
          clientId: phone,
          clientName: order.customer_name || 'Client inconnu',
          clientPhone: phone,
          totalOrders: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          lastOrderDate: '',
          status: 'active',
        };

        existing.totalOrders += 1;
        existing.totalSpent += order.total_amount || 0;
        existing.lastOrderDate = order.created_at;
        existing.averageOrderValue = existing.totalSpent / existing.totalOrders;

        clientMap.set(phone, existing);
      });

      const reports = Array.from(clientMap.values());

      // Determine active/inactive status (no orders in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      reports.forEach(report => {
        if (report.lastOrderDate && new Date(report.lastOrderDate) < thirtyDaysAgo) {
          report.status = 'inactive';
        }
      });

      return reports.sort((a, b) => b.totalSpent - a.totalSpent);
    } catch (error) {
      console.error('Error fetching client report:', error);
      return [];
    }
  },

  // Obtenir tous les rapports
  async getAllReports(storeId: string, startDate: Date, endDate: Date): Promise<ReportData> {
    try {
      const [dailySales, monthlySales, collectionSales, margins, returns, inventory, clients] =
        await Promise.all([
          this.getDailySalesReport(storeId, startDate, endDate),
          this.getMonthlySalesReport(storeId, startDate.getFullYear()),
          this.getCollectionSalesReport(storeId, startDate, endDate),
          this.getMarginReport(storeId, startDate, endDate),
          this.getReturnReport(storeId, startDate, endDate),
          this.getInventoryReport(storeId),
          this.getClientReport(storeId),
        ]);

      return {
        dailySales,
        monthlySales,
        collectionSales,
        margins,
        returns,
        inventory,
        clients,
      };
    } catch (error) {
      console.error('Error fetching all reports:', error);
      return {
        dailySales: [],
        monthlySales: [],
        collectionSales: [],
        margins: [],
        returns: [],
        inventory: [],
        clients: [],
      };
    }
  },

  // Exporter un rapport en CSV
  exportToCSV(data: any[], filename: string): string {
    if (data.length === 0) return '';

    // Mappage des en-têtes anglais -> français
    const headerMap: Record<string, string> = {
      'collectionName': 'Collection',
      'collectionId': 'ID_Collection',
      'totalRevenue': 'Revenu_Total',
      'totalOrders': 'Nb_Commandes',
      'totalItemsSold': 'Articles_Vendus',
      'percentage': 'Pourcentage',
      'date': 'Date',
      'month': 'Mois',
      'year': 'Année',
      'averageOrderValue': 'Panier_Moyen',
      'productName': 'Produit',
      'costPrice': 'Prix_Achat',
      'sellingPrice': 'Prix_Vente',
      'margin': 'Marge_Unitaire',
      'marginPercentage': 'Marge_%',
      'totalMargin': 'Marge_Totale',
      'quantitySold': 'Qté_Vendue',
      'orderId': 'ID_Commande',
      'reason': 'Raison',
      'refundAmount': 'Montant_Remboursé',
      'status': 'Statut',
      'currentStock': 'Stock_Actuel',
      'clientName': 'Client',
      'clientPhone': 'Téléphone',
      'totalSpent': 'Total_Dépensé'
    };

    const keys = Object.keys(data[0]);
    const headers = keys.map(k => headerMap[k] || k).join(',');
    
    const rows = data.map(row => {
      return keys.map(k => {
        let val = row[k];
        // Formatage spécial pour les nombres
        if (typeof val === 'number') {
          if (k.toLowerCase().includes('percentage') || k === 'percentage') {
            return val.toFixed(2);
          }
          return val;
        }
        return `"${val}"`; // On entoure les strings de guillemets pour éviter les problèmes avec les virgules
      }).join(',');
    }).join('\n');

    return `${headers}\n${rows}`;
  },
};

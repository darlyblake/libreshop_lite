import { supabase } from '../lib/supabase';

// Types pour l'intégration comptable
export interface AccountingExport {
  id: string;
  type: 'sales' | 'purchases' | 'inventory' | 'expenses' | 'taxes';
  format: 'csv' | 'excel' | 'pdf';
  startDate: string;
  endDate: string;
  status: 'pending' | 'completed' | 'failed';
  fileUrl?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AccountingRecord {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  category: string;
  accountCode?: string;
}

export interface SalesRecord {
  date: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  category: string;
}

export interface PurchaseRecord {
  date: string;
  reference: string;
  supplier?: string;
  description: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  category: string;
}

export const accountingService = {
  // Exporter les ventes en format comptable
  async exportSalesToCSV(storeId: string, startDate: Date, endDate: Date): Promise<string> {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, id, customer_name, customer_phone, total, tax_amount, payment_method, items')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      if (error) throw error;

      const records: SalesRecord[] = (orders || []).map((order: any) => ({
        date: new Date(order.created_at).toLocaleDateString('fr-FR'),
        invoiceNumber: `FAC-${order.id.slice(0, 8)}`,
        customerName: order.customer_name || 'Client inconnu',
        customerPhone: order.customer_phone || '',
        amount: order.total - (order.tax_amount || 0),
        taxAmount: order.tax_amount || 0,
        totalAmount: order.total,
        paymentMethod: order.payment_method || 'Non spécifié',
        category: 'Ventes',
      }));

      return this.convertToCSV(records);
    } catch (error) {
      console.error('Error exporting sales to CSV:', error);
      throw error;
    }
  },

  // Exporter l'inventaire en format comptable
  async exportInventoryToCSV(storeId: string): Promise<string> {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('name, category, stock, price, cost_price, created_at')
        .eq('store_id', storeId);

      if (error) throw error;

      const records = (products || []).map((product: any) => ({
        reference: product.name,
        category: product.category || 'Non catégorisé',
        quantity: product.stock,
        unitPrice: product.price,
        costPrice: product.cost_price || 0,
        totalValue: product.stock * product.price,
        totalCost: product.stock * (product.cost_price || 0),
        date: new Date(product.created_at).toLocaleDateString('fr-FR'),
      }));

      return this.convertToCSV(records);
    } catch (error) {
      console.error('Error exporting inventory to CSV:', error);
      throw error;
    }
  },

  // Exporter les dépenses en format comptable
  async exportExpensesToCSV(storeId: string, startDate: Date, endDate: Date): Promise<string> {
    try {
      // Pour l'instant, on simule les dépenses avec les remboursements
      const { data: refunds, error } = await supabase
        .from('refunds')
        .select('created_at, order_id, amount, reason')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['approved', 'processed']);

      if (error) throw error;

      const records = (refunds || []).map((refund: any) => ({
        date: new Date(refund.created_at).toLocaleDateString('fr-FR'),
        reference: `REM-${refund.order_id.slice(0, 8)}`,
        description: refund.reason,
        amount: refund.amount,
        category: 'Remboursements',
        accountCode: '708',
      }));

      return this.convertToCSV(records);
    } catch (error) {
      console.error('Error exporting expenses to CSV:', error);
      throw error;
    }
  },

  // Générer un rapport de TVA
  async exportTaxReport(storeId: string, startDate: Date, endDate: Date): Promise<string> {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, total, tax_amount')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      if (error) throw error;

      const totalSales = (orders || []).reduce((sum: number, order: any) => sum + order.total, 0);
      const totalTax = (orders || []).reduce((sum: number, order: any) => sum + (order.tax_amount || 0), 0);
      const netSales = totalSales - totalTax;

      const records = [{
        period: `${startDate.toLocaleDateString('fr-FR')} - ${endDate.toLocaleDateString('fr-FR')}`,
        totalSales,
        totalTax,
        netSales,
        taxRate: totalSales > 0 ? ((totalTax / totalSales) * 100).toFixed(2) + '%' : '0%',
      }];

      return this.convertToCSV(records);
    } catch (error) {
      console.error('Error exporting tax report:', error);
      throw error;
    }
  },

  // Générer un grand livre (General Ledger)
  async generateGeneralLedger(storeId: string, startDate: Date, endDate: Date): Promise<AccountingRecord[]> {
    try {
      const records: AccountingRecord[] = [];
      let balance = 0;

      // Ajouter les ventes
      const { data: orders } = await supabase
        .from('orders')
        .select('created_at, id, total')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      (orders || []).forEach((order: any) => {
        balance += order.total;
        records.push({
          date: new Date(order.created_at).toLocaleDateString('fr-FR'),
          reference: `FAC-${order.id.slice(0, 8)}`,
          description: 'Vente client',
          debit: 0,
          credit: order.total,
          balance,
          category: 'Ventes',
          accountCode: '701',
        });
      });

      // Ajouter les remboursements
      const { data: refunds } = await supabase
        .from('refunds')
        .select('created_at, order_id, amount')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['approved', 'processed']);

      (refunds || []).forEach((refund: any) => {
        balance -= refund.amount;
        records.push({
          date: new Date(refund.created_at).toLocaleDateString('fr-FR'),
          reference: `REM-${refund.order_id.slice(0, 8)}`,
          description: 'Remboursement',
          debit: refund.amount,
          credit: 0,
          balance,
          category: 'Remboursements',
          accountCode: '708',
        });
      });

      return records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('Error generating general ledger:', error);
      return [];
    }
  },

  // Générer un bilan (Balance Sheet)
  async generateBalanceSheet(storeId: string, asOfDate: Date): Promise<{
    assets: { name: string; amount: number }[];
    liabilities: { name: string; amount: number }[];
    equity: { name: string; amount: number }[];
  }> {
    try {
      // Actifs: valeur du stock
      const { data: products } = await supabase
        .from('products')
        .select('name, stock, cost_price')
        .eq('store_id', storeId);

      const inventoryValue = (products || []).reduce((sum: number, p: any) => sum + (p.stock * (p.cost_price || 0)), 0);

      // Passifs: remboursements en attente
      const { data: pendingRefunds } = await supabase
        .from('refunds')
        .select('amount')
        .eq('store_id', storeId)
        .eq('status', 'approved');

      const pendingRefundsAmount = (pendingRefunds || []).reduce((sum: number, r: any) => sum + r.amount, 0);

      return {
        assets: [
          { name: 'Stock de marchandises', amount: inventoryValue },
          { name: 'Créances clients', amount: 0 }, // À implémenter
          { name: 'Trésorerie', amount: 0 }, // À implémenter avec intégration bancaire
        ],
        liabilities: [
          { name: 'Dettes fournisseurs', amount: 0 }, // À implémenter
          { name: 'Remboursements en attente', amount: pendingRefundsAmount },
        ],
        equity: [
          { name: 'Capital', amount: inventoryValue - pendingRefundsAmount },
        ],
      };
    } catch (error) {
      console.error('Error generating balance sheet:', error);
      return { assets: [], liabilities: [], equity: [] };
    }
  },

  // Générer un compte de résultat (Income Statement)
  async generateIncomeStatement(storeId: string, startDate: Date, endDate: Date): Promise<{
    revenue: { name: string; amount: number }[];
    expenses: { name: string; amount: number }[];
    netProfit: number;
  }> {
    try {
      // Revenus: ventes
      const { data: orders } = await supabase
        .from('orders')
        .select('total, tax_amount')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      const totalRevenue = (orders || []).reduce((sum: number, o: any) => sum + o.total, 0);
      const totalTax = (orders || []).reduce((sum: number, o: any) => sum + (o.tax_amount || 0), 0);
      const netRevenue = totalRevenue - totalTax;

      // Dépenses: remboursements
      const { data: refunds } = await supabase
        .from('refunds')
        .select('amount')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['approved', 'processed']);

      const totalRefunds = (refunds || []).reduce((sum: number, r: any) => sum + r.amount, 0);

      // Coût des ventes (estimation basée sur le coût des produits)
      const { data: products } = await supabase
        .from('products')
        .select('cost_price, price')
        .eq('store_id', storeId);

      const averageCostRatio = products && products.length > 0
        ? products.reduce((sum: number, p: any) => sum + (p.cost_price || 0), 0) / products.reduce((sum: number, p: any) => sum + p.price, 0)
        : 0.5;

      const costOfGoodsSold = netRevenue * averageCostRatio;

      const expenses = [
        { name: 'Coût des ventes', amount: costOfGoodsSold },
        { name: 'Remboursements', amount: totalRefunds },
      ];

      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const netProfit = netRevenue - totalExpenses;

      return {
        revenue: [
          { name: 'Ventes nettes', amount: netRevenue },
        ],
        expenses,
        netProfit,
      };
    } catch (error) {
      console.error('Error generating income statement:', error);
      return { revenue: [], expenses: [], netProfit: 0 };
    }
  },

  // Helper: Convertir un tableau en CSV
  convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        const escaped = ('' + (value ?? '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  },

  // Télécharger un fichier CSV
  downloadCSV(csv: string, filename: string): void {
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },
};

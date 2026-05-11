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
        .select('created_at, id, customer_name, customer_phone, total_amount, payment_method')
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
        amount: order.total_amount,
        taxAmount: 0,
        totalAmount: order.total_amount,
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
        .select('name, category, stock, price, created_at')
        .eq('store_id', storeId);

      if (error) throw error;

      const records = (products || []).map((product: any) => ({
        reference: product.name,
        category: product.category || 'Non catégorisé',
        quantity: product.stock,
        unitPrice: product.price,
        totalValue: product.stock * product.price,
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
      // Note: La table refunds n'existe pas encore, on retourne un CSV vide
      const records = [{
        date: '-',
        reference: '-',
        description: 'Aucune dépense enregistrée',
        amount: 0,
        category: 'Dépenses',
        accountCode: '-',
      }];

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
        .select('created_at, total_amount')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      if (error) throw error;

      const totalSales = (orders || []).reduce((sum: number, order: any) => sum + order.total_amount, 0);
      const totalTax = 0; // Pas de colonne tax_amount dans la base
      const netSales = totalSales - totalTax;

      const records = [{
        period: `${startDate.toLocaleDateString('fr-FR')} - ${endDate.toLocaleDateString('fr-FR')}`,
        totalSales,
        totalTax,
        netSales,
        taxRate: '0%', // Pas de TVA séparée
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
        .select('created_at, id, total_amount')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      (orders || []).forEach((order: any) => {
        balance += order.total_amount;
        records.push({
          date: new Date(order.created_at).toLocaleDateString('fr-FR'),
          reference: `FAC-${order.id.slice(0, 8)}`,
          description: 'Vente client',
          debit: 0,
          credit: order.total_amount,
          balance,
          category: 'Ventes',
          accountCode: '701',
        });
      });

      // Note: La table refunds n'existe pas encore, on ignore les remboursements

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
      // Actifs: valeur du stock (sans coût car la colonne n'existe pas)
      const { data: products } = await supabase
        .from('products')
        .select('name, stock, price')
        .eq('store_id', storeId);

      const inventoryValue = (products || []).reduce((sum: number, p: any) => sum + (p.stock * p.price), 0);

      // Note: La table refunds n'existe pas encore, pas de passifs de remboursements

      return {
        assets: [
          { name: 'Stock de marchandises', amount: inventoryValue },
          { name: 'Créances clients', amount: 0 }, // À implémenter
          { name: 'Trésorerie', amount: 0 }, // À implémenter avec intégration bancaire
        ],
        liabilities: [
          { name: 'Dettes fournisseurs', amount: 0 }, // À implémenter
          { name: 'Remboursements en attente', amount: 0 },
        ],
        equity: [
          { name: 'Capital', amount: inventoryValue },
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
        .select('total_amount')
        .eq('store_id', storeId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['paid', 'delivered']);

      const totalRevenue = (orders || []).reduce((sum: number, o: any) => sum + o.total_amount, 0);
      const totalTax = 0; // Pas de colonne tax_amount dans la base
      const netRevenue = totalRevenue - totalTax;

      // Note: La table refunds n'existe pas encore, pas de remboursements
      // Note: La colonne cost_price n'existe pas dans products, on utilise une estimation simple
      const totalRefunds = 0;
      const costOfGoodsSold = netRevenue * 0.5; // Estimation: 50% du revenu net

      const expenses = [
        { name: 'Coût des ventes (estimé)', amount: costOfGoodsSold },
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

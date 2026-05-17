import { useSupabase } from '../lib/supabase';

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

export interface Expense {
  id?: string;
  store_id: string;
  description: string;
  amount: number;
  category: string;
  created_at?: string;
}

export interface Refund {
  id?: string;
  order_id?: string;
  store_id: string;
  amount: number;
  reason?: string;
  created_at?: string;
}

export const accountingService = {
  // Valider et normaliser les dates
  validateDateRange(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
    const now = new Date();
    const maxStartDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    const normalizedStartDate = startDate < maxStartDate ? maxStartDate : startDate;
    const normalizedEndDate = endDate > now ? now : endDate;
    if (normalizedStartDate > normalizedEndDate) {
      return { startDate: normalizedEndDate, endDate: normalizedEndDate };
    }
    return { startDate: normalizedStartDate, endDate: normalizedEndDate };
  },

  // --- Gestion des Dépenses ---
  async recordExpense(expense: Expense) {
    const { data, error } = await useSupabase().from('expenses').insert(expense).select().single();
    if (error) throw error;
    return data;
  },

  async getExpenses(storeId: string, startDate: Date, endDate: Date) {
    const { startDate: s, endDate: e } = this.validateDateRange(startDate, endDate);
    const { data, error } = await useSupabase()
      .from('expenses')
      .select('*')
      .eq('store_id', storeId)
      .gte('created_at', s.toISOString())
      .lte('created_at', e.toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // --- Gestion des Remboursements ---
  async recordRefund(refund: Refund) {
    const { data, error } = await useSupabase().from('refunds').insert(refund).select().single();
    if (error) throw error;
    return data;
  },

  async getRefunds(storeId: string, startDate: Date, endDate: Date) {
    const { startDate: s, endDate: e } = this.validateDateRange(startDate, endDate);
    const { data, error } = await useSupabase()
      .from('refunds')
      .select('*')
      .eq('store_id', storeId)
      .gte('created_at', s.toISOString())
      .lte('created_at', e.toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // --- Exports ---
  async exportSalesToCSV(storeId: string, startDate: Date, endDate: Date): Promise<string> {
    try {
      const { startDate: s, endDate: e } = this.validateDateRange(startDate, endDate);
      const { data: orders, error } = await useSupabase()
        .from('orders')
        .select('created_at, id, customer_name, customer_phone, total_amount, payment_method, users(full_name, phone)')
        .eq('store_id', storeId)
        .gte('created_at', s.toISOString())
        .lte('created_at', e.toISOString())
        .in('status', ['paid', 'delivered']);
      if (error) throw error;

      const records = (orders || []).map((o: any) => ({
        date: new Date(o.created_at).toLocaleDateString('fr-FR'),
        invoiceNumber: `FAC-${o.id.slice(0, 8)}`,
        customerName: o.customer_name || o.users?.full_name || 'Client inconnu',
        customerPhone: o.customer_phone || o.users?.phone || '',
        amount: o.total_amount,
        taxAmount: 0,
        totalAmount: o.total_amount,
        paymentMethod: o.payment_method || 'Non spécifié',
        category: 'Ventes',
      }));
      return this.convertToCSV(records);
    } catch (error) {
      throw error;
    }
  },

  async exportInventoryToCSV(storeId: string): Promise<string> {
    const { data: products, error } = await useSupabase()
      .from('products')
      .select('name, stock, price, created_at, collections(name)')
      .eq('store_id', storeId);
    if (error) throw error;

    const records = (products || []).map((p: any) => ({
      reference: p.name,
      collection: p.collections?.name || 'Sans collection',
      quantity: p.stock,
      unitPrice: p.price,
      totalValue: p.stock * p.price,
      date: new Date(p.created_at).toLocaleDateString('fr-FR'),
    }));
    return this.convertToCSV(records);
  },

  async exportExpensesToCSV(storeId: string, startDate: Date, endDate: Date): Promise<string> {
    const expenses = await this.getExpenses(storeId, startDate, endDate);
    const records = expenses.length > 0 ? expenses.map(ex => ({
      date: new Date(ex.created_at).toLocaleDateString('fr-FR'),
      description: ex.description,
      amount: ex.amount,
      category: ex.category,
    })) : [{ date: '-', description: 'Aucune dépense', amount: 0, category: '-' }];
    return this.convertToCSV(records);
  },

  async generateGeneralLedger(storeId: string, startDate: Date, endDate: Date, productId?: string): Promise<AccountingRecord[]> {
    const { startDate: s, endDate: e } = this.validateDateRange(startDate, endDate);
    let balance = 0;
    const timeline: any[] = [];

    // 1. Ventes Détaillées (Argent + Stock)
    let ordersQuery = useSupabase()
      .from('orders')
      .select('created_at, id, total_amount, order_items(quantity, price, product_id, products(name))')
      .eq('store_id', storeId)
      .gte('created_at', s.toISOString())
      .lte('created_at', e.toISOString())
      .in('status', ['paid', 'delivered']);
    
    const { data: orders } = await ordersQuery;

    (orders || []).forEach(o => {
      o.order_items?.forEach((item: any) => {
        // Filtrer par produit si spécifié
        if (productId && item.product_id !== productId) return;

        timeline.push({
          date: o.created_at,
          ref: `VTE-${o.id.slice(0, 5)}`,
          desc: `Vente: ${item.products?.name || 'Produit'}`,
          debit: 0,
          credit: item.quantity * item.price,
          stockQty: -item.quantity, // Sortie de stock
          category: 'Ventes'
        });
      });
    });

    // 2. Réapprovisionnements (Stock)
    let restocksQuery = useSupabase()
      .from('restock_history')
      .select('*, products(name, store_id, id)')
      .gte('created_at', s.toISOString())
      .lte('created_at', e.toISOString());
    
    if (productId) {
      restocksQuery = restocksQuery.eq('product_id', productId);
    }

    const { data: restocks } = await restocksQuery;

    // Filtrer par store_id via le produit car restock_history n'a pas toujours le store_id direct
    const filteredRestocks = (restocks || []).filter((r: any) => r.products?.store_id === storeId);
    
    filteredRestocks.forEach((r: any) => {
      timeline.push({
        date: r.created_at,
        ref: `REAP-${r.id.slice(0, 5)}`,
        desc: `Réappro: ${r.products?.name || 'Produit'}`,
        debit: 0,
        credit: 0,
        stockQty: r.quantity_added, // Entrée de stock
        category: 'Stock'
      });
    });

    // 3. Dépenses (Uniquement si pas de filtre produit)
    if (!productId) {
      const expenses = await this.getExpenses(storeId, s, e);
      expenses.forEach(ex => timeline.push({
        date: ex.created_at,
        ref: `DEP-${ex.id?.slice(0, 5)}`,
        desc: ex.description,
        debit: ex.amount,
        credit: 0,
        stockQty: 0,
        category: 'Charges'
      }));

      // 4. Retours (Argent + Stock)
      const { data: returns } = await useSupabase()
        .from('returns')
        .select('*, products(name)')
        .eq('store_id', storeId)
        .gte('created_at', s.toISOString())
        .lte('created_at', e.toISOString())
        .in('status', ['received', 'completed']);

      (returns || []).forEach(re => timeline.push({
        date: re.created_at,
        ref: `RET-${re.id?.slice(0, 5)}`,
        desc: `Retour: ${re.products?.name || 'Produit'}`,
        debit: re.refund_amount || 0,
        credit: 0,
        stockQty: re.quantity || 1, // Retour en stock
        category: 'Retours'
      }));
    }

    // Trier chronologiquement
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const records = timeline.map(item => {
      balance += (item.credit - item.debit);
      return {
        date: new Date(item.date).toLocaleDateString('fr-FR'),
        reference: item.ref,
        description: item.desc,
        debit: item.debit,
        credit: item.credit,
        balance,
        stockQty: item.stockQty,
        category: item.category
      };
    });

    return records.reverse();
  },

  async generateIncomeStatement(storeId: string, startDate: Date, endDate: Date) {
    const { startDate: s, endDate: e } = this.validateDateRange(startDate, endDate);
    
    // 1. Revenus (Ventes)
    const { data: orders } = await useSupabase().from('orders').select('total_amount, tax_amount, delivery_fee, discount_amount, order_items(quantity, price, cost_price)')
      .eq('store_id', storeId).gte('created_at', s.toISOString()).lte('created_at', e.toISOString())
      .in('status', ['paid', 'delivered']);

    let productRevenue = 0;
    let cogs = 0;
    let taxes = 0;
    let delivery = 0;
    let totalDiscounts = 0;

    (orders || []).forEach(o => {
      taxes += Number(o.tax_amount || 0);
      delivery += Number(o.delivery_fee || 0);
      totalDiscounts += Number(o.discount_amount || 0);
      (o.order_items || []).forEach((i: any) => {
        productRevenue += (i.price * i.quantity);
        cogs += ((i.cost_price || 0) * i.quantity);
      });
    });

    // 2. Charges (Dépenses réelles + Remboursements + Réductions)
    const dbExpenses = await this.getExpenses(storeId, startDate, endDate);
    const dbRefunds = await this.getRefunds(storeId, startDate, endDate);
    const totalRefunds = dbRefunds.reduce((sum, r) => sum + Number(r.amount), 0);

    const expenseCategories: any = { 
      'Coût des ventes': cogs, 
      'Remboursements': totalRefunds,
      'Réductions offertes': totalDiscounts 
    };
    dbExpenses.forEach(ex => {
      expenseCategories[ex.category] = (expenseCategories[ex.category] || 0) + Number(ex.amount);
    });

    const revenue = [
      { name: 'Chiffre d\'affaires net', amount: productRevenue },
      { name: 'TVA collectée', amount: taxes },
      { name: 'Frais de livraison', amount: delivery }
    ].filter(r => r.amount > 0);

    const expensesList = Object.keys(expenseCategories).map(cat => ({
      name: cat,
      amount: expenseCategories[cat]
    })).filter(ex => ex.amount > 0);

    const totalIncome = productRevenue + taxes + delivery;
    const totalExp = expensesList.reduce((sum, ex) => sum + ex.amount, 0);

    return {
      revenue,
      expenses: expensesList,
      netProfit: totalIncome - totalExp
    };
  },

  // Générer un rapport de TVA
  async exportTaxReport(storeId: string, startDate: Date, endDate: Date): Promise<string> {
    try {
      const { startDate: validStartDate, endDate: validEndDate } = this.validateDateRange(startDate, endDate);
      const { data: orders, error } = await useSupabase()
        .from('orders')
        .select('created_at, total_amount, tax_amount')
        .eq('store_id', storeId)
        .gte('created_at', validStartDate.toISOString())
        .lte('created_at', validEndDate.toISOString())
        .in('status', ['paid', 'delivered']);

      if (error) throw error;

      const totalSales = (orders || []).reduce((sum: number, order: any) => sum + order.total_amount, 0);
      const totalTax = (orders || []).reduce((sum: number, order: any) => sum + (order.tax_amount || 0), 0);
      const netSales = totalSales - totalTax;

      const records = [{
        period: `${validStartDate.toLocaleDateString('fr-FR')} - ${validEndDate.toLocaleDateString('fr-FR')}`,
        totalSales,
        totalTax,
        netSales,
        taxRate: totalTax > 0 ? 'Variable' : '0%',
      }];

      return this.convertToCSV(records);
    } catch (error) {
      console.error('Error exporting tax report:', error);
      throw error;
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
      const { data: products } = await useSupabase()
        .from('products')
        .select('name, stock, price, cost_price')
        .eq('store_id', storeId);

      const inventoryValue = (products || []).reduce((sum: number, p: any) => sum + (p.stock * (p.cost_price || p.price)), 0);

      // Passifs: Remboursements en attente
      const refunds = await this.getRefunds(storeId, new Date(0), asOfDate);
      const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

      return {
        assets: [
          { name: 'Stock de marchandises', amount: inventoryValue },
          { name: 'Trésorerie estimée', amount: 0 },
        ],
        liabilities: [
          { name: 'Dettes fournisseurs', amount: 0 },
          { name: 'Remboursements effectués', amount: totalRefunds },
        ],
        equity: [
          { name: 'Capital net estimé', amount: inventoryValue - totalRefunds },
        ],
      };
    } catch (error) {
      console.error('Error generating balance sheet:', error);
      return { assets: [], liabilities: [], equity: [] };
    }
  },

  convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    data.forEach(row => {
      const values = headers.map(header => {
        const escaped = ('' + (row[header] ?? '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  },

  downloadCSV(csv: string, filename: string): void {
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
};

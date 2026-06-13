import { WithdrawalRequest, KYCDocument, KYCStatus, WithdrawalStatus } from '../lib/supabase';
import { orderService } from './orderService';

// Mock data since tables don't exist yet
let mockKycStatus: KYCDocument | null = null;
const mockWithdrawals: WithdrawalRequest[] = [
  {
    id: 'w-1',
    store_id: 'mock-store',
    amount: 50000,
    method: 'Orange Money',
    details: { phone: '+22500000000' },
    status: 'completed',
    created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    processed_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'w-2',
    store_id: 'mock-store',
    amount: 15000,
    method: 'MTN MoMo',
    details: { phone: '+22500000001' },
    status: 'pending',
    created_at: new Date().toISOString(),
  }
];

export interface WalletStats {
  availableBalance: number;
  pendingBalance: number;
  totalWithdrawn: number;
}

export interface Transaction {
  id: string;
  type: 'sale' | 'withdrawal' | 'refund';
  amount: number;
  date: string;
  status: string;
  description: string;
}

export const financeService = {
  /**
   * Get overall wallet statistics
   */
  async getWalletStats(storeId: string): Promise<WalletStats> {
    try {
      // In a real scenario, this would be computed on the backend (e.g. from a wallet table or sum of orders)
      const result = await orderService.getByStore(storeId);
      const orders = result.orders || [];
      
      let available = 0;
      let pending = 0;

      // Simplistic calculation for demonstration
      orders.forEach((o: any) => {
        if (o.status === 'delivered') available += o.total_amount;
        else if (o.status === 'paid' || o.status === 'shipped') pending += o.total_amount;
      });

      let totalWithdrawn = 0;
      mockWithdrawals.filter(w => w.status === 'completed').forEach(w => {
        totalWithdrawn += w.amount;
      });

      // Adjust available balance by subtracting withdrawn
      available = Math.max(0, available - totalWithdrawn);

      return {
        availableBalance: available,
        pendingBalance: pending,
        totalWithdrawn
      };
    } catch (e) {
      console.error('Error getting wallet stats', e);
      return { availableBalance: 0, pendingBalance: 0, totalWithdrawn: 0 };
    }
  },

  /**
   * Get recent transactions (sales, withdrawals)
   */
  async getRecentTransactions(storeId: string): Promise<Transaction[]> {
    try {
      const result = await orderService.getByStore(storeId);
      const orders = result.orders || [];
      const txs: Transaction[] = [];

      orders.slice(0, 10).forEach((o: any) => {
        txs.push({
          id: o.id,
          type: 'sale',
          amount: o.total_amount,
          date: o.created_at,
          status: o.status === 'delivered' ? 'completed' : 'pending',
          description: `Vente #${o.id.slice(0, 8)}`,
        });
      });

      mockWithdrawals.forEach(w => {
        txs.push({
          id: w.id,
          type: 'withdrawal',
          amount: -w.amount, // negative for withdrawal
          date: w.created_at,
          status: w.status,
          description: `Retrait vers ${w.method}`,
        });
      });

      return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    } catch (e) {
      console.error('Error getting transactions', e);
      return [];
    }
  },

  /**
   * Get withdrawal history
   */
  async getWithdrawals(storeId: string): Promise<WithdrawalRequest[]> {
    // Return mock data for now
    return Promise.resolve(mockWithdrawals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  },

  /**
   * Request a new withdrawal
   */
  async requestWithdrawal(storeId: string, amount: number, method: string, details: any): Promise<WithdrawalRequest> {
    const newReq: WithdrawalRequest = {
      id: `w-${Date.now()}`,
      store_id: storeId,
      amount,
      method,
      details,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    mockWithdrawals.push(newReq);
    return Promise.resolve(newReq);
  },

  /**
   * Check KYC Status
   */
  async getKYCStatus(storeId: string): Promise<KYCStatus> {
    if (!mockKycStatus) return 'unverified';
    return mockKycStatus.status;
  },

  /**
   * Submit KYC Documents
   */
  async submitKYC(storeId: string, data: Partial<KYCDocument>): Promise<KYCStatus> {
    mockKycStatus = {
      id: `kyc-${Date.now()}`,
      store_id: storeId,
      full_name: data.full_name || '',
      phone: data.phone || '',
      id_type: data.id_type || 'cni',
      id_number: data.id_number || '',
      id_front_url: data.id_front_url || '',
      id_back_url: data.id_back_url || '',
      video_selfie_url: data.video_selfie_url || '',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    return 'pending';
  }
};

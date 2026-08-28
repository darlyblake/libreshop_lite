/**
 * tableService.ts
 * Connecté à Supabase avec UI optimiste.
 */

import { supabase } from '../lib/supabase';
import { type PosTable, type TableStatus } from '../components/pos/PosTableManager';

class TableService {
  private getCacheKey(storeId: string) {
    return `libreshop_tables_cache_${storeId}`;
  }

  async getTables(storeId: string): Promise<PosTable[]> {
    if (!supabase) return [];
    
    try {
      const { data, error } = await supabase
        .from('pos_tables')
        .select('*')
        .eq('store_id', storeId)
        .order('table_number', { ascending: true });
        
      if (error) throw error;
      
      const tables = data.map((t: any) => ({
        id: t.id,
        number: t.table_number,
        capacity: t.capacity,
        status: t.status || 'free',
        qr_token: t.qr_token ?? '',
      })) as PosTable[];

      // Mettre en cache
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.getCacheKey(storeId), JSON.stringify(tables));
      }

      return tables;
    } catch (error) {
      console.warn('Erreur getTables (fetch réseau), tentative de lecture du cache:', error);
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(this.getCacheKey(storeId));
        if (cached) return JSON.parse(cached);
      }
      throw error;
    }
  }

  // --- Actions asynchrones (Supabase) ---

  async openTable(storeId: string, tableId: string, guestCount?: number): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('pos_tables')
      .update({ status: 'occupied' }).eq('id', tableId).eq('store_id', storeId);
    if (error) throw error;
  }

  async closeTable(storeId: string, tableId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('pos_tables')
      .update({ status: 'free' }).eq('id', tableId).eq('store_id', storeId);
    if (error) throw error;
  }

  async addTable(storeId: string, number: number | string, capacity: number): Promise<PosTable> {
    if (!supabase) throw new Error('No supabase');
    const { data, error } = await supabase.rpc('create_pos_table', {
      p_store_id: storeId, p_table_number: String(number), p_capacity: capacity
    });
    if (error) throw error;
    return {
      id: data.id,
      number: data.table_number,
      capacity: data.capacity,
      status: data.status || 'free',
      qr_token: data.qr_token ?? '',
    };
  }

  // --- Helpers pour UI Optimiste (Synchrones, retournent le nouveau tableau) ---

  optimisticOpen(tables: PosTable[], tableId: string, guestCount?: number): PosTable[] {
    return tables.map(t => t.id === tableId ? { ...t, status: 'occupied', openedAt: new Date(), guestCount } : t);
  }

  optimisticClose(tables: PosTable[], tableId: string): PosTable[] {
    return tables.map(t => t.id === tableId ? { ...t, status: 'free', openedAt: undefined, guestCount: undefined, currentAmount: undefined } : t);
  }
  
  optimisticAmount(tables: PosTable[], tableId: string, amount: number): PosTable[] {
    return tables.map(t => t.id === tableId ? { ...t, currentAmount: amount } : t);
  }
}

export const tableService = new TableService();

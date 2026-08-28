/**
 * tableService.ts
 * Connecté à Supabase avec UI optimiste.
 */

import { supabase } from '../lib/supabase';
import { type PosTable, type TableStatus } from '../components/pos/PosTableManager';

class TableService {
  async getTables(storeId: string): Promise<PosTable[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('pos_tables')
      .select('*')
      .eq('store_id', storeId)
      .order('table_number', { ascending: true });
      
    if (error) {
      console.error('Erreur getTables:', error);
      throw error;
    }
    
    return data.map((t: any) => ({
      id: t.id,
      number: t.table_number,
      capacity: t.capacity,
      status: t.status || 'free',
    })) as PosTable[];
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

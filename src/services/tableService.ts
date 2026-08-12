/**
 * tableService.ts
 * Service de gestion des tables (Restaurant & Bar)
 * Gestion de l'état local + persistance optionnelle Supabase
 *
 * Architecture : les tables sont gérées localement en session
 * (pas besoin de DB pour démarrer — les statuts sont volatiles).
 * La persistance Supabase est optionnelle et activable si la table
 * `pos_tables` existe dans le projet.
 */

import { type PosTable, type TableStatus } from '../components/pos/PosTableManager';

const DEFAULT_RESTAURANT_TABLES: Omit<PosTable, 'id'>[] = [
  { number: 1, capacity: 2, status: 'free' },
  { number: 2, capacity: 2, status: 'free' },
  { number: 3, capacity: 4, status: 'free' },
  { number: 4, capacity: 4, status: 'free' },
  { number: 5, capacity: 4, status: 'free' },
  { number: 6, capacity: 6, status: 'free' },
  { number: 7, capacity: 6, status: 'free' },
  { number: 8, capacity: 8, status: 'free' },
];

const DEFAULT_BAR_TABLES: Omit<PosTable, 'id'>[] = [
  { number: 'A', capacity: 2, status: 'free' },
  { number: 'B', capacity: 2, status: 'free' },
  { number: 'C', capacity: 4, status: 'free' },
  { number: 'D', capacity: 4, status: 'free' },
  { number: 'Bar', capacity: 6, status: 'free' },
  { number: 'Terrasse', capacity: 8, status: 'free' },
];

/**
 * Génère un ID stable pour une table donnée d'un store
 */
const makeTableId = (storeId: string, tableNumber: number | string) =>
  `table_${storeId}_${tableNumber}`;

class TableService {
  /** Clé de stockage local par store */
  private getStorageKey(storeId: string) {
    return `libreshop_tables_${storeId}`;
  }

  /**
   * Charge les tables d'un store depuis le stockage local.
   * Si aucune table n'existe, initialise avec les tables par défaut selon le type.
   */
  getTables(storeId: string, type: 'restaurant' | 'bar' = 'restaurant'): PosTable[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.getStorageKey(storeId));
        if (raw) return JSON.parse(raw) as PosTable[];
      }
    } catch {}
    return this.initDefaultTables(storeId, type);
  }

  /**
   * Sauvegarde les tables dans le stockage local
   */
  saveTables(storeId: string, tables: PosTable[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.getStorageKey(storeId), JSON.stringify(tables));
      }
    } catch {}
  }

  /**
   * Initialise les tables par défaut selon le type d'établissement
   */
  initDefaultTables(storeId: string, type: 'restaurant' | 'bar'): PosTable[] {
    const defaults = type === 'bar' ? DEFAULT_BAR_TABLES : DEFAULT_RESTAURANT_TABLES;
    const tables: PosTable[] = defaults.map(t => ({
      ...t,
      id: makeTableId(storeId, t.number),
    }));
    this.saveTables(storeId, tables);
    return tables;
  }

  /**
   * Ouvre une table (la marque comme occupée)
   */
  openTable(
    storeId: string,
    tableId: string,
    guestCount?: number
  ): PosTable[] {
    const tables = this.getTables(storeId);
    const updated = tables.map(t =>
      t.id === tableId
        ? { ...t, status: 'occupied' as TableStatus, openedAt: new Date(), guestCount }
        : t
    );
    this.saveTables(storeId, updated);
    return updated;
  }

  /**
   * Ferme une table (la remet à libre)
   */
  closeTable(storeId: string, tableId: string): PosTable[] {
    const tables = this.getTables(storeId);
    const updated = tables.map(t =>
      t.id === tableId
        ? {
            ...t,
            status: 'free' as TableStatus,
            openedAt: undefined,
            guestCount: undefined,
            currentAmount: undefined,
          }
        : t
    );
    this.saveTables(storeId, updated);
    return updated;
  }

  /**
   * Met à jour le montant en cours d'une table
   */
  updateTableAmount(storeId: string, tableId: string, amount: number): PosTable[] {
    const tables = this.getTables(storeId);
    const updated = tables.map(t =>
      t.id === tableId ? { ...t, currentAmount: amount } : t
    );
    this.saveTables(storeId, updated);
    return updated;
  }

  /**
   * Demande d'addition pour une table
   */
  requestBill(storeId: string, tableId: string): PosTable[] {
    const tables = this.getTables(storeId);
    const updated = tables.map(t =>
      t.id === tableId ? { ...t, status: 'bill_requested' as TableStatus } : t
    );
    this.saveTables(storeId, updated);
    return updated;
  }

  /**
   * Transfère les articles d'une table à une autre
   */
  transferTable(
    storeId: string,
    fromTableId: string,
    toTableId: string
  ): PosTable[] {
    const tables = this.getTables(storeId);
    const fromTable = tables.find(t => t.id === fromTableId);
    const updated = tables.map(t => {
      if (t.id === toTableId && fromTable) {
        return {
          ...t,
          status: 'occupied' as TableStatus,
          openedAt: fromTable.openedAt,
          guestCount: fromTable.guestCount,
          currentAmount: fromTable.currentAmount,
        };
      }
      if (t.id === fromTableId) {
        return {
          ...t,
          status: 'free' as TableStatus,
          openedAt: undefined,
          guestCount: undefined,
          currentAmount: undefined,
        };
      }
      return t;
    });
    this.saveTables(storeId, updated);
    return updated;
  }

  /**
   * Ajoute une nouvelle table
   */
  addTable(
    storeId: string,
    number: number | string,
    capacity: number
  ): PosTable[] {
    const tables = this.getTables(storeId);
    const newTable: PosTable = {
      id: makeTableId(storeId, number),
      number,
      capacity,
      status: 'free',
    };
    const updated = [...tables, newTable];
    this.saveTables(storeId, updated);
    return updated;
  }

  /**
   * Supprime une table (uniquement si libre)
   */
  removeTable(storeId: string, tableId: string): PosTable[] {
    const tables = this.getTables(storeId);
    const table = tables.find(t => t.id === tableId);
    if (table && table.status !== 'free') {
      throw new Error('Impossible de supprimer une table occupée');
    }
    const updated = tables.filter(t => t.id !== tableId);
    this.saveTables(storeId, updated);
    return updated;
  }

  /**
   * Réinitialise toutes les tables à libre (fin de service)
   */
  resetAllTables(storeId: string): PosTable[] {
    const tables = this.getTables(storeId);
    const updated = tables.map(t => ({
      ...t,
      status: 'free' as TableStatus,
      openedAt: undefined,
      guestCount: undefined,
      currentAmount: undefined,
    }));
    this.saveTables(storeId, updated);
    return updated;
  }
}

export const tableService = new TableService();

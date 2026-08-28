/**
 * src/features/onsite/types.ts
 * Types partagés pour le système de commande sur place via QR.
 */

export interface OnsiteTableContext {
  token: string;
  storeId: string;
  storeName: string;
  tableId: string;
  tableNumber: string;
  active: boolean;
}

export type OrderContext =
  | { mode: 'online'; authenticated: true; storeId: string }
  | { mode: 'onsite'; authenticated: false; storeId: string; tableId: string; tableNumber: string; qrToken: string };

export interface CartContext {
  storeId: string;
  tableId?: string;
  qrToken?: string;
  mode: 'online' | 'onsite';
}

export interface QrTokenValidationResult {
  valid: boolean;
  store_id: string | null;
  store_name: string | null;
  table_id: string | null;
  table_number: string | null;
  active: boolean;
  error?: 'invalid_token' | 'table_disabled' | 'store_disabled';
}

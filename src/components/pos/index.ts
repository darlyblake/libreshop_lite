/**
 * components/pos/index.ts
 * Barrel exports pour les composants POS partagés
 */

export { PosMenuGrid } from './PosMenuGrid';
export type { PosProduct, PosCartItem } from './PosMenuGrid';

export { PosCartPanel } from './PosCartPanel';

export { PosCheckoutModal } from './PosCheckoutModal';
export type { PaymentMethod } from './PosCheckoutModal';

export { PosReceiptModal } from './PosReceiptModal';

export { PosTableManager } from './PosTableManager';
export type { PosTable, TableStatus } from './PosTableManager';

export { PosOrderTicket, generateTicketHtml } from './PosOrderTicket';

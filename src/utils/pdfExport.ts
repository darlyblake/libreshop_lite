import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

// Types
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderData {
  id: string;
  customerName: string;
  customerPhone: string;
  shippingAddress?: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
  storeName?: string;
  storePhone?: string;
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('fr-FR') + ' FCA';
};

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'En attente',
    paid: 'Payée',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée',
  };
  return labels[status] || status;
};

const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    mobile_money: 'Mobile Money',
    card: 'Carte bancaire',
    cash_on_delivery: 'Paiement à la livraison',
    cash: 'Espèces',
    transfer: 'Virement',
  };
  return labels[method] || method;
};

// Generate HTML for order invoice
const generateOrderInvoiceHTML = (order: OrderData): string => {
  const itemsHTML = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${item.name}
          <br><small style="color: #666;">${item.quantity} × ${formatCurrency(item.price)}</small>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
          ${formatCurrency(item.price * item.quantity)}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Commande #${order.id.slice(0, 8)}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
          color: #333;
          padding: 20px;
        }
        .invoice-container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #8b5cf6, #06b6d4);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          font-size: 24px;
          margin-bottom: 5px;
        }
        .header p {
          opacity: 0.9;
          font-size: 14px;
        }
        .order-info {
          padding: 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #eee;
        }
        .order-info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .order-info-label {
          color: #666;
        }
        .order-info-value {
          font-weight: 600;
        }
        .customer-info {
          padding: 20px;
          border-bottom: 1px solid #eee;
        }
        .customer-info h3 {
          font-size: 14px;
          color: #666;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
        }
        .items-table th {
          background: #f8f9fa;
          padding: 12px;
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
        }
        .items-table th:last-child {
          text-align: right;
        }
        .totals {
          padding: 20px;
          background: #f8f9fa;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 16px;
        }
        .grand-total {
          font-size: 20px;
          font-weight: 700;
          color: #8b5cf6;
          border-top: 2px solid #ddd;
          padding-top: 12px;
          margin-top: 8px;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-paid { background: #d1fae5; color: #065f46; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-shipped { background: #dbeafe; color: #1e40af; }
        .status-delivered { background: #d1fae5; color: #065f46; }
        .status-cancelled { background: #fee2e2; color: #991b1b; }
        .footer {
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <h1>📦 Bon de Commande</h1>
          <p>${order.storeName || 'LibreShop'}</p>
        </div>
        
        <div class="order-info">
          <div class="order-info-row">
            <span class="order-info-label">N° Commande</span>
            <span class="order-info-value">#${order.id.slice(0, 8)}</span>
          </div>
          <div class="order-info-row">
            <span class="order-info-label">Date</span>
            <span class="order-info-value">${formatDate(order.createdAt)}</span>
          </div>
          <div class="order-info-row">
            <span class="order-info-label">Statut</span>
            <span class="order-info-value">
              <span class="status-badge status-${order.status}">${getStatusLabel(order.status)}</span>
            </span>
          </div>
          <div class="order-info-row">
            <span class="order-info-label">Paiement</span>
            <span class="order-info-value">${getPaymentMethodLabel(order.paymentMethod)}</span>
          </div>
        </div>
        
        <div class="customer-info">
          <h3>Informations Client</h3>
          <div class="order-info-row">
            <span class="order-info-label">Nom</span>
            <span class="order-info-value">${order.customerName || 'Client'}</span>
          </div>
          <div class="order-info-row">
            <span class="order-info-label">Téléphone</span>
            <span class="order-info-value">${order.customerPhone || 'N/A'}</span>
          </div>
          ${
            order.shippingAddress
              ? `
          <div class="order-info-row">
            <span class="order-info-label">Adresse</span>
            <span class="order-info-value">${order.shippingAddress}</span>
          </div>
          `
              : ''
          }
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="total-row">
            <span>Sous-total</span>
            <span>${formatCurrency(order.totalAmount)}</span>
          </div>
          <div class="total-row grand-total">
            <span>Total</span>
            <span>${formatCurrency(order.totalAmount)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Merci pour votre confiance !</p>
          <p style="margin-top: 5px;">Généré par LibreShop</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Export order as PDF
export const exportOrderToPDF = async (order: OrderData): Promise<void> => {
  try {
    const html = generateOrderInvoiceHTML(order);
    
    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Share or save
    const isShareAvailable = await Sharing.isAvailableAsync();
    
    if (isShareAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Partager le bon de commande',
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Succès', `PDF saved to: ${uri}`);
    }
  } catch (error) {
    console.error('Error exporting PDF:', error);
    Alert.alert('Erreur', 'Impossible de générer le PDF');
  }
};

// Export multiple orders as PDF
export const exportOrdersToPDF = async (
  orders: OrderData[],
  title: string = 'Liste des commandes'
): Promise<void> => {
  try {
    const ordersHTML = orders
      .map(
        (order) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">#${order.id.slice(0, 8)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${order.customerName || 'Client'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${formatDate(order.createdAt)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">
            <span class="status-badge status-${order.status}">${getStatusLabel(order.status)}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(order.totalAmount)}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
          h1 { color: #333; margin-bottom: 20px; text-align: center; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #8b5cf6; color: white; padding: 12px; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
          }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-paid { background: #d1fae5; color: #065f46; }
          .status-shipped { background: #dbeafe; color: #1e40af; }
          .status-delivered { background: #d1fae5; color: #065f46; }
          .status-cancelled { background: #fee2e2; color: #991b1b; }
          .total-row { font-weight: 700; background: #f8f9fa; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>
              <th>N° Commande</th>
              <th>Client</th>
              <th>Date</th>
              <th>Statut</th>
              <th style="text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${ordersHTML}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">Total</td>
              <td style="text-align: right;">${formatCurrency(orders.reduce((sum, o) => sum + o.totalAmount, 0))}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html, base64: false });
    
    const isShareAvailable = await Sharing.isAvailableAsync();
    if (isShareAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: title,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Succès', `PDF saved to: ${uri}`);
    }
  } catch (error) {
    console.error('Error exporting orders PDF:', error);
    Alert.alert('Erreur', 'Impossible de générer le PDF');
  }
};

export default {
  exportOrderToPDF,
  exportOrdersToPDF,
};


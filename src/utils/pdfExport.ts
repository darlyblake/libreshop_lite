import * as Print from 'expo-print';
import { formatCurrency } from './currencyUtils';
import { errorHandler } from './errorHandler';
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

// Uses imported formatCurrency

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
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
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
          color: #4f46e5;
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

// Web-specific: print HTML in a hidden iframe instead of window.print()
const printHTMLOnWeb = (html: string): void => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    
    // Wait for content to load then print
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        // Clean up after print dialog closes
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 250);
    };
    
    // Fallback if onload doesn't fire (already loaded)
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch (e) { /* already printed */ }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (e) { /* already removed */ }
      }, 1000);
    }, 500);
  }
};

// Export order as PDF
export const exportOrderToPDF = async (order: OrderData): Promise<void> => {
  try {
    const html = generateOrderInvoiceHTML(order);
    
    if (Platform.OS === 'web') {
      printHTMLOnWeb(html);
      return;
    }

    // Native: Generate PDF file
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
    errorHandler.handleDatabaseError(error, 'Error exporting PDF:');
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
          th { background: #4f46e5; color: white; padding: 12px; text-align: left; }
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

    if (Platform.OS === 'web') {
      printHTMLOnWeb(html);
      return;
    }

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
    errorHandler.handleDatabaseError(error, 'Error exporting orders PDF:');
    Alert.alert('Erreur', 'Impossible de générer le PDF');
  }
};

// ==========================================
// BATCH PRINT: individual slips side by side
// Generates one PDF with full invoice per order, separated by page breaks
// ==========================================
export const exportBatchOrdersToPDF = async (
  orders: OrderData[],
  storeName: string = 'Ma Boutique'
): Promise<void> => {
  try {
    if (orders.length === 0) {
      Alert.alert('Info', 'Aucune commande sélectionnée');
      return;
    }

    const allSlipsHTML = orders.map((order, index) => `
      <div class="slip-page" style="${index < orders.length - 1 ? 'page-break-after: always;' : ''}">
        <div class="slip-header">
          <div class="slip-store">${storeName}</div>
          <div class="slip-badge">BORDEREAU D'EXPÉDITION</div>
          <div class="slip-ref">#${order.id.slice(0, 8).toUpperCase()}</div>
        </div>

        <div class="slip-body">
          <div class="slip-section">
            <div class="slip-section-title">📦 Commande</div>
            <div class="slip-row"><span>Date</span><strong>${formatDate(order.createdAt)}</strong></div>
            <div class="slip-row"><span>Statut</span><strong class="status-badge status-${order.status}">${getStatusLabel(order.status)}</strong></div>
            <div class="slip-row"><span>Paiement</span><strong>${getPaymentMethodLabel(order.paymentMethod)}</strong></div>
          </div>

          <div class="slip-section">
            <div class="slip-section-title">👤 Client</div>
            <div class="slip-row"><span>Nom</span><strong>${order.customerName || 'Client'}</strong></div>
            <div class="slip-row"><span>Téléphone</span><strong>${order.customerPhone || 'N/A'}</strong></div>
            ${order.shippingAddress ? `<div class="slip-row"><span>Adresse</span><strong>${order.shippingAddress}</strong></div>` : ''}
          </div>

          <div class="slip-section">
            <div class="slip-section-title">🛒 Articles</div>
            ${order.items.map(item => `
              <div class="slip-item">
                <span>${item.name}</span>
                <span>x${item.quantity} &nbsp; ${formatCurrency(item.price * item.quantity)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="slip-footer">
          <div class="slip-total">TOTAL : ${formatCurrency(order.totalAmount)}</div>
          <div class="slip-note">Généré par LibreShop • ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Impression en masse — ${storeName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f0f0; color: #222; }
          .slip-page {
            max-width: 680px;
            margin: 30px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          }
          @media print {
            body { background: white; }
            .slip-page { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; border: 1px solid #ddd; }
          }
          .slip-header {
            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            color: white;
            padding: 24px 28px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .slip-store { font-size: 18px; font-weight: 800; }
          .slip-badge { font-size: 11px; font-weight: 700; letter-spacing: 1px; opacity: 0.9; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; }
          .slip-ref { font-size: 20px; font-weight: 900; font-family: monospace; }
          .slip-body { padding: 20px 28px; }
          .slip-section { margin-bottom: 18px; }
          .slip-section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #4f46e5; margin-bottom: 8px; border-bottom: 2px solid #ede9fe; padding-bottom: 4px; }
          .slip-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; color: #444; border-bottom: 1px dashed #f0f0f0; }
          .slip-row span:first-child { color: #888; }
          .slip-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px dashed #f0f0f0; }
          .slip-footer { background: #f8f7ff; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #ede9fe; }
          .slip-total { font-size: 22px; font-weight: 900; color: #4f46e5; }
          .slip-note { font-size: 10px; color: #aaa; }
          .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-accepted { background: #ede9fe; color: #5b21b6; }
          .status-paid { background: #d1fae5; color: #065f46; }
          .status-shipped { background: #dbeafe; color: #1e40af; }
          .status-delivered { background: #d1fae5; color: #065f46; }
          .status-cancelled { background: #fee2e2; color: #991b1b; }
        </style>
      </head>
      <body>
        ${allSlipsHTML}
      </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      printHTMLOnWeb(html);
      return;
    }

    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const isShareAvailable = await Sharing.isAvailableAsync();
    if (isShareAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Bordereaux — ${orders.length} commande(s)`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Succès', `PDF sauvegardé: ${uri}`);
    }
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'Error batch printing:');
    Alert.alert('Erreur', 'Impossible de générer les bordereaux');
  }
};

// Export consolidated Picking List / Bordereau de préparation
export const exportPickingListPDF = async (
  orders: OrderData[],
  storeName: string = 'Ma Boutique'
): Promise<void> => {
  try {
    if (orders.length === 0) {
      Alert.alert('Info', 'Aucune commande sélectionnée');
      return;
    }

    // Consolidated item calculation
    const itemMap: Record<string, { quantity: number; price: number }> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (itemMap[item.name]) {
          itemMap[item.name].quantity += item.quantity;
        } else {
          itemMap[item.name] = { quantity: item.quantity, price: item.price };
        }
      });
    });

    const consolidatedItemsHTML = Object.entries(itemMap)
      .map(([name, data]) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; font-weight: 700; color: #1e293b;">
            ${name}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; font-size: 16px; font-weight: 800; color: #4f46e5; background-color: #f5f3ff;">
            ${data.quantity}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-size: 14px; color: #64748b;">
            ${formatCurrency(data.price)}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-size: 14px; font-weight: 700; color: #1e293b;">
            ${formatCurrency(data.price * data.quantity)}
          </td>
        </tr>
      `)
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Liste de Préparation Consolidée — ${storeName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 30px; background: #fafafa; color: #1e293b; }
          .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .header { text-align: center; border-bottom: 3px double #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
          .header h1 { font-size: 24px; color: #4f46e5; font-weight: 800; margin-bottom: 5px; }
          .header p { color: #64748b; font-size: 14px; }
          .meta-info { display: flex; justify-content: space-between; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 25px; font-size: 13px; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #f1f5f9; color: #475569; font-weight: 700; font-size: 12px; text-transform: uppercase; padding: 12px; border-bottom: 2px solid #e2e8f0; }
          td { padding: 12px; }
          .total-row { background: #f8fafc; font-weight: 800; font-size: 16px; border-top: 2px solid #e2e8f0; }
          .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Bordereau de Préparation Global</h1>
            <p>${storeName}</p>
          </div>
          
          <div class="meta-info">
            <div>
              <strong>Commandes incluses :</strong> ${orders.length} commandes<br>
              <strong>Références :</strong> ${orders.map(o => '#' + o.id.slice(0, 8).toUpperCase()).join(', ')}
            </div>
            <div style="text-align: right;">
              <strong>Date d'édition :</strong> ${new Date().toLocaleDateString('fr-FR')}<br>
              <strong>Heure :</strong> ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Article</th>
                <th style="text-align: center; width: 100px;">Quantité Totale</th>
                <th style="text-align: right; width: 120px;">Prix unitaire</th>
                <th style="text-align: right; width: 150px;">Sous-total</th>
              </tr>
            </thead>
            <tbody>
              ${consolidatedItemsHTML}
              <tr class="total-row">
                <td colspan="3" style="text-align: right; padding: 15px;">Valeur totale de la préparation</td>
                <td style="text-align: right; padding: 15px; color: #4f46e5;">
                  ${formatCurrency(orders.reduce((sum, o) => sum + o.totalAmount, 0))}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>Ce bordereau regroupe tous les articles à rassembler dans les rayons pour honorer les commandes sélectionnées.</p>
            <p style="margin-top: 5px;">Généré avec succès par LibreShop</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      printHTMLOnWeb(html);
      return;
    }

    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const isShareAvailable = await Sharing.isAvailableAsync();
    if (isShareAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Picking List — ${orders.length} commande(s)`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Succès', `Picking list enregistrée: ${uri}`);
    }
  } catch (error) {
    errorHandler.handleDatabaseError(error, 'Error exporting picking list PDF:');
    Alert.alert('Erreur', 'Impossible de générer le bordereau de préparation');
  }
};


export default {
  exportOrderToPDF,
  exportOrdersToPDF,
  exportBatchOrdersToPDF,
  exportPickingListPDF,
};

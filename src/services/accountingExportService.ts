import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { formatCurrency } from '../utils/currencyUtils';

export const accountingExportService = {
  // Styles CSS professionnels pour l'impression
  getCommonStyles: () => `
    <style>
      @media print {
        @page { margin: 2cm; }
        body { padding: 0; }
        .no-print { display: none; }
      }
      body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        padding: 40px; 
        color: #1a202c;
        max-width: 1000px;
        margin: 0 auto;
        background-color: white;
      }
      .header { 
        display: flex; 
        justify-content: space-between; 
        border-bottom: 3px solid #4a5568; 
        padding-bottom: 20px; 
        margin-bottom: 30px; 
      }
      .store-name { font-size: 28px; font-weight: bold; color: #2d3748; text-transform: uppercase; }
      .doc-type { font-size: 20px; color: #718096; text-align: right; }
      
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { 
        background-color: #edf2f7; 
        color: #4a5568; 
        text-align: left; 
        padding: 12px; 
        border: 1px solid #cbd5e0;
        font-size: 13px;
      }
      td { 
        padding: 12px; 
        border: 1px solid #cbd5e0; 
        font-size: 14px; 
      }
      tr:nth-child(even) { background-color: #f7fafc; }
      
      .amount { text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; }
      .total-row { background-color: #2d3748 !important; color: white; font-weight: bold; }
      .total-row td { border-color: #2d3748; }
      
      .positive { color: #38a169; }
      .negative { color: #e53e3e; }
      
      .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 20px; }
      h3 { border-left: 5px solid #2d3748; padding-left: 15px; margin-top: 40px; margin-bottom: 15px; }
      
      .print-btn {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2d3748;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        text-decoration: none;
      }
    </style>
  `,

  async exportGrandLivre(storeName: string, records: any[], period: string) {
    const rows = records.map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.reference}</td>
        <td>${r.description}</td>
        <td class="amount">${r.debit > 0 ? formatCurrency(r.debit) : '-'}</td>
        <td class="amount">${r.credit > 0 ? formatCurrency(r.credit) : '-'}</td>
        <td class="amount"><b>${formatCurrency(r.balance)}</b></td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Grand Livre - ${storeName}</title>
        ${this.getCommonStyles()}
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">Imprimer / Sauvegarder PDF</button>
        <div class="header">
          <div>
            <div class="store-name">${storeName}</div>
            <div>LibreShop - Rapport Comptable</div>
          </div>
          <div class="doc-type">
            <div>GRAND LIVRE</div>
            <div style="font-size: 14px;">Période : ${period}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Référence</th>
              <th>Description</th>
              <th class="amount">Débit</th>
              <th class="amount">Crédit</th>
              <th class="amount">Solde</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        
        <div class="footer">
          Document officiel généré par LibreShop le ${new Date().toLocaleDateString('fr-FR')}
        </div>
      </body>
      </html>
    `;
    const fileName = `Grand_Livre_${storeName.replace(/\s+/g, '_')}`;
    await this.openReport(html, fileName);
  },

  async exportIncomeStatement(storeName: string, data: any, period: string) {
    const revenueRows = data.revenue.map((r: any) => `
      <tr>
        <td>${r.name}</td>
        <td class="amount positive">${formatCurrency(r.amount)}</td>
      </tr>
    `).join('');

    const expenseRows = data.expenses.map((e: any) => `
      <tr>
        <td>${e.name}</td>
        <td class="amount negative">(${formatCurrency(e.amount)})</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Compte de Résultat - ${storeName}</title>
        ${this.getCommonStyles()}
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">Imprimer / Sauvegarder PDF</button>
        <div class="header">
          <div>
            <div class="store-name">${storeName}</div>
            <div>LibreShop - Rapport de Gestion</div>
          </div>
          <div class="doc-type">
            <div>COMPTE DE RÉSULTAT</div>
            <div style="font-size: 14px;">Période : ${period}</div>
          </div>
        </div>
        
        <h3>1. PRODUITS (REVENUS)</h3>
        <table>
          <thead><tr><th>Désignation</th><th class="amount">Montant</th></tr></thead>
          <tbody>${revenueRows}</tbody>
        </table>

        <h3>2. CHARGES (DÉPENSES)</h3>
        <table>
          <thead><tr><th>Désignation</th><th class="amount">Montant</th></tr></thead>
          <tbody>${expenseRows}</tbody>
        </table>

        <table style="margin-top: 40px;">
          <tr class="total-row">
            <td style="font-size: 18px;">RÉSULTAT NET (BÉNÉFICE)</td>
            <td class="amount" style="font-size: 18px;">
              ${formatCurrency(data.netProfit)}
            </td>
          </tr>
        </table>

        <div class="footer">
          Rapport généré automatiquement par LibreShop
        </div>
      </body>
      </html>
    `;
    const fileName = `Compte_Resultat_${storeName.replace(/\s+/g, '_')}`;
    await this.openReport(html, fileName);
  },

  async openReport(html: string, fileName: string) {
    if (Platform.OS === 'web') {
      // Création d'un lien de téléchargement automatique (infaillible sur Web)
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Sur mobile, on garde le PDF car il fonctionne mieux
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }
  }
};

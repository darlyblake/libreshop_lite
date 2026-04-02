/**
 * Utility functions for formatting values
 */

/**
 * Formats a number as a currency string (XOF/KCFA)
 * @param value Amount in native currency units (e.g. FCA)
 * @returns Formatted string (e.g. "1 000 FCFA")
 */
export const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0 FCFA';
  
  // Format with space separator or custom KCFA logic if needed
  // For now, consistent with existing app patterns:
  if (num >= 1000 && num < 1000000) {
    return (num / 1000).toFixed(0) + ' KCFA';
  }
  
  return num.toLocaleString('fr-FR') + ' FCFA';
};

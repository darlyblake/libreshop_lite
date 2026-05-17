/**
 * Utility functions for formatting values
 */

/**
 * Formats a number as a currency string (FCFA)
 * @param value Amount in native currency units (e.g. FCA)
 * @returns Formatted string (e.g. "1 000 FCFA")
 */
export const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0 FCFA';
  
  return num.toLocaleString('fr-FR') + ' FCFA';
};

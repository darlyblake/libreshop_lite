/**
 * Fonctions utilitaires pour la sanitization des entrées
 * Prévention des attaques XSS et injection
 */

/**
 * Échappe les caractères HTML spéciaux pour prévenir XSS
 * @param unsafe - Chaîne non sécurisée
 * @returns Chaîne sécurisée
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Échappe les caractères pour les attributs HTML
 * @param unsafe - Chaîne non sécurisée
 * @returns Chaîne sécurisée
 */
export function escapeHtmlAttr(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Valide si une chaîne est un UUID valide
 * @param uuid - Chaîne à valider
 * @returns true si c'est un UUID valide
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Nettoie une chaîne pour l'utilisation dans les URLs
 * @param unsafe - Chaîne non sécurisée
 * @returns Chaîne sécurisée pour URL
 */
export function sanitizeForUrl(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/[^a-zA-Z0-9-_~]/g, '')
    .substring(0, 200);
}

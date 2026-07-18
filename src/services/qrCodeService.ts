/**
 * qrCodeService.ts
 * Service centralisé pour la génération des URLs et QR codes.
 * Utilisé par : SellerCaisseScreen (reçu) et SellerSettingsScreen (paramètres boutique).
 */

export const qrCodeService = {
  /**
   * URL publique d'une commande (pour le client).
   * Ex: https://monsite.com/order/abc123
   */
  getOrderUrl(orderId: string): string {
    // Prefer explicit environment variable, else try to use window origin on web,
    // otherwise fallback to deep-link scheme.
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin.replace(/\/+$/, '')}/order/${orderId}`;
    }
    const envBase = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    if (envBase) return `${envBase}/order/${orderId}`;
    return `libreshop://order/${orderId}`;
  },

  /**
   * URL publique d'une boutique.
   * Ex: https://monsite.com/store/fred-shop
   */
  getStoreUrl(storeSlug: string): string {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin.replace(/\/+$/, '')}/store/${storeSlug}`;
    }
    const envBase = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    if (envBase) return `${envBase}/store/${storeSlug}`;
    return `libreshop://store/${storeSlug}`;
  },

  /**
   * URL de l'image QR code (via api.qrserver.com).
   * @param data  La donnée à encoder (URL, texte, etc.)
   * @param size  Taille en pixels (défaut: 200)
   */
  getQrImageUrl(data: string, size = 200): string {
    const encoded = encodeURIComponent(data);
    return `https://quickchart.io/qr?text=${encoded}&size=${size}`;
  },
  /**
   * Récupère l'image QR code en base64 (pour une intégration fiable dans le HTML du reçu).
   * @param data  La donnée à encoder
   * @param size  Taille en pixels (défaut: 200)
   */
  async getQrImageBase64(data: string, size = 200): Promise<string> {
    const url = this.getQrImageUrl(data, size);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // Fallback: retourner l'URL directe si le fetch échoue
      return url;
    }
  },
};

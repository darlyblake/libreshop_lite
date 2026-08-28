/**
 * useCanAddToCart.ts
 *
 * Politique d'accès au panier :
 *
 *  ✅ Utilisateur authentifié (auth.uid() non null)
 *  ✅ Contexte onsite QR valide (token présent dans onsiteStore)
 *  ❌ Visiteur anonyme normal (pas de compte, pas de QR)
 *
 * Usage :
 *   const { canAdd, reason } = useCanAddToCart();
 *   if (!canAdd) showAlert(reason);
 */

import { useAuthStore } from '../store';
import { useOnsiteStore } from '../store/onsiteStore';

export function useCanAddToCart(): { canAdd: boolean; reason: string } {
  const { user } = useAuthStore();
  const { context: onsiteContext } = useOnsiteStore();

  // Utilisateur authentifié
  if (user?.id) {
    return { canAdd: true, reason: '' };
  }

  // Contexte onsite QR valide (token présent et non vide)
  if (onsiteContext?.token) {
    return { canAdd: true, reason: '' };
  }

  // Visiteur anonyme sans QR
  return {
    canAdd: false,
    reason: 'Connectez-vous ou scannez le QR code de votre table pour ajouter des produits au panier.',
  };
}

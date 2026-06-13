# Améliorations du système de commandes - Par priorité

> Document généré après analyse du système de commandes LibreShop
> Date: 11 Juin 2026

---

## 🔴 Priorité CRITIQUE - À faire immédiatement

### 1. Standardiser le workflow des statuts de commande

**Problème**: Incohérence entre `accepted` et `paid` dans le code

**Statut**: ✅ FAIT (workflow standardisé: pending → accepted → paid → shipped → delivered)

**Localisation**:
- `SellerOrderDetailScreen.tsx` ligne 524: utilise `handleUpdateStatus('paid')` pour accepter
- `orderService.ts`: `acceptOrder()` met le statut à `'accepted'`
- `confirmOrderPayment()` met le statut à `'paid'`

**Action requise**:
```typescript
// Définir un workflow clair dans orderService.ts
const ORDER_STATUS_WORKFLOW = {
  PENDING: 'pending',           // En attente de validation vendeur
  ACCEPTED: 'accepted',         // Commande acceptée, stock réservé
  PAID: 'paid',                 // Paiement confirmé
  PROCESSING: 'processing',     // En préparation
  SHIPPED: 'shipped',           // Expédiée
  DELIVERED: 'delivered',       // Livrée
  CANCELLED: 'cancelled',       // Annulée
  REFUNDED: 'refunded',         // Remboursée
} as const;

// Mettre à jour SellerOrderDetailScreen.tsx
// Ligne 524: Changer 'paid' en 'accepted' pour le bouton "Accepter"
handleUpdateStatus('accepted')  // Au lieu de 'paid'

// Ajouter un bouton séparé pour confirmer le paiement
handleConfirmPayment()  // Nouvelle fonction
```

**Fichiers à modifier**:
- `src/services/orderService.ts`
- `src/screens/SellerOrderDetailScreen.tsx`
- `src/screens/SellerOrdersScreen.tsx`

**Impact**: Évite la confusion entre acceptation et paiement

---

### 2. Ajouter un écran de gestion des retours côté vendeur

**Problème**: Le client peut demander un retour mais le vendeur n'a pas d'interface pour les gérer

**Statut**: ✅ DÉJÀ FAIT (SellerReturnsScreen.tsx existe et est fonctionnel)

**Localisation**:
- `ClientOrderDetailScreen.tsx` ligne 543: bouton "Demander un retour"
- `refundService.createRefund()` existe mais pas d'UI vendeur

**Action requise**:
```typescript
// Créer src/screens/SellerReturnsScreen.tsx
export const SellerReturnsScreen: React.FC = () => {
  // Liste des retours en attente
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  
  const loadReturns = async () => {
    const data = await refundService.getReturnsByStore(storeId);
    setReturns(data.filter(r => r.status === 'pending'));
  };
  
  const handleApprove = async (returnId: string) => {
    await refundService.updateReturnStatus(returnId, 'approved');
    // Notifier le client
  };
  
  const handleReject = async (returnId: string, reason: string) => {
    await refundService.updateReturnStatus(returnId, 'rejected', reason);
    // Notifier le client
  };
  
  // ... UI de liste avec actions
};
```

**Fichiers à créer**:
- `src/screens/SellerReturnsScreen.tsx`

**Fichiers à modifier**:
- `src/navigation/types.ts` (ajouter la route)
- `src/services/refundService.ts` (ajouter `getReturnsByStore`, `updateReturnStatus`)

**Impact**: Permet au vendeur de gérer les retours de manière structurée

---

### 3. Ajouter des champs de tracking de livraison

**Problème**: Pas de numéro de suivi ni de preuve de livraison

**Statut**: ✅ FAIT (champs ajoutés + UI vendeur + UI client)

**Action requise**:
```typescript
// Modifier src/types/order.ts
interface Order {
  // ... champs existants
  tracking_number?: string;
  shipping_provider?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  delivery_proof_url?: string;  // Photo/signature
}

// Ajouter dans SellerOrderDetailScreen.tsx
// Section "Livraison" avec champs pour saisir:
// - Numéro de suivi
// - Transporteur
// - Date estimée
```

**Fichiers à modifier**:
- `src/types/order.ts`
- `src/services/orderService.ts` (méthodes update pour ces champs)
- `src/screens/SellerOrderDetailScreen.tsx` (UI pour saisir tracking)
- `src/screens/ClientOrderDetailScreen.tsx` (affichage tracking)

**Impact**: Améliore le suivi et la transparence pour le client

---

## 🟡 Priorité HAUTE - À faire dans les 2 semaines

### 4. Implémenter un système de preuve de réception

**Problème**: Le client peut marquer "Reçu" sans preuve

**Statut**: ✅ FAIT (DeliveryProofScreen.tsx créé + bouton ajouté dans SellerOrderDetailScreen)

**Action requise**:
```typescript
// Créer src/screens/DeliveryProofScreen.tsx
export const DeliveryProofScreen: React.FC = () => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  
  const handleTakePhoto = async () => {
    // Utiliser expo-camera pour prendre photo
  };
  
  const handleSign = async () => {
    // Utiliser react-native-signature-canvas
  };
  
  const submitProof = async () => {
    await orderService.submitDeliveryProof(orderId, {
      photo,
      signature,
      submitted_at: new Date().toISOString(),
    });
  };
};
```

**Fichiers à créer**:
- `src/screens/DeliveryProofScreen.tsx`
- `src/components/SignatureCanvas.tsx`

**Fichiers à modifier**:
- `src/services/orderService.ts` (ajouter `submitDeliveryProof`)
- `src/screens/ClientOrderDetailScreen.tsx` (ajouter bouton "Preuve de réception")

**Impact**: Protège le vendeur contre les faux retours

---

### 5. Ajouter un système d'évaluation après livraison

**Problème**: Pas de feedback sur la qualité du service

**Statut**: ✅ FAIT (types créés + service créé + écran créé + bouton ajouté dans ClientOrderDetailScreen)

**Action requise**:
```typescript
// Créer src/types/review.ts
export interface OrderReview {
  id: string;
  order_id: string;
  user_id: string;
  store_id: string;
  rating: number;  // 1-5
  comment?: string;
  seller_response?: string;
  created_at: string;
}

// Créer src/services/reviewService.ts
export const reviewService = {
  async create(review: Partial<OrderReview>): Promise<OrderReview> {
    // Créer review
  },
  
  async getByStore(storeId: string): Promise<OrderReview[]> {
    // Récupérer reviews d'une boutique
  },
  
  async respond(reviewId: string, response: string): Promise<OrderReview> {
    // Répondre à une review
  },
};

// Créer src/screens/ReviewScreen.tsx
export const ReviewScreen: React.FC = () => {
  // UI pour noter et commenter
};
```

**Fichiers à créer**:
- `src/types/review.ts`
- `src/services/reviewService.ts`
- `src/screens/ReviewScreen.tsx`

**Fichiers à modifier**:
- `src/screens/ClientOrderDetailScreen.tsx` (ajouter bouton "Noter" après livraison)
- `src/screens/SellerOrderDetailScreen.tsx` (afficher reviews)

**Impact**: Améliore la confiance et la qualité du service

---

### 6. Créer un tableau de bord vendeur avancé

**Problème**: Le vendeur n'a pas de vue d'ensemble de ses performances

**Statut**: ✅ DÉJÀ FAIT (SellerDashboardScreen.tsx existe déjà avec statistiques complètes, graphiques, commandes récentes, alertes stock, revenus par période)

**Action requise**:
```typescript
// Créer src/screens/SellerDashboardScreen.tsx
export const SellerDashboardScreen: React.FC = () => {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    pendingOrders: 0,
    stuckOrders: 0,
    topProducts: [],
    recentReviews: [],
  });
  
  const loadDashboard = async () => {
    const [revenue, orders, products, reviews] = await Promise.all([
      orderService.getRevenueByPeriod(storeId, 'today'),
      orderService.getCountsByStore(storeId),
      productService.getTopSelling(storeId, 5),
      reviewService.getByStore(storeId),
    ]);
    // ... calculer stats
  };
  
  // ... UI avec cartes, graphiques, listes
};
```

**Fichiers à créer**:
- `src/screens/SellerDashboardScreen.tsx`
- `src/services/analyticsService.ts` (métriques vendeur)

**Fichiers à modifier**:
- `src/navigation/types.ts` (ajouter route)
- `src/services/orderService.ts` (ajouter `getRevenueByPeriod`)

**Impact**: Aide le vendeur à prendre des décisions business

---

## 🟢 Priorité MOYENNE - À faire dans le mois

### 7. Ajouter des notifications SMS de fallback

**Problème**: Les notifications push ne sont pas fiables

**Statut**: ✅ FAIT (méthode createWithFallback ajoutée avec placeholders pour Twilio/SendGrid)

**Action requise**:
```typescript
// Modifier src/services/notificationService.ts
export const notificationService = {
  async createWithFallback(notification: Notification): Promise<void> {
    const channels = ['push', 'sms', 'email'];
    
    for (const channel of channels) {
      try {
        await this.sendViaChannel(notification, channel);
        return; // Succès, arrêter
      } catch (error) {
        console.warn(`${channel} failed, trying next...`);
      }
    }
    
    // Tous les canaux ont échoué
    throw new Error('All notification channels failed');
  },
  
  async sendViaChannel(notification: Notification, channel: string): Promise<void> {
    switch (channel) {
      case 'push':
        return this.sendPush(notification);
      case 'sms':
        return this.sendSMS(notification);
      case 'email':
        return this.sendEmail(notification);
    }
  },
};
```

**Fichiers à modifier**:
- `src/services/notificationService.ts`
- Configuration Twilio/SendGrid pour SMS/Email

**Impact**: Garantit que les notifications importantes arrivent

---

### 8. Ajouter un système de litiges avec intervention admin

**Problème**: Pas de médiation en cas de conflit

**Statut**: ✅ FAIT (types créés + service créé + écrans DisputeScreen et AdminDisputeScreen créés)

**Action requise**:
```typescript
// Créer src/types/dispute.ts
export interface Dispute {
  id: string;
  order_id: string;
  opened_by: 'client' | 'seller';
  reason: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string;
  admin_notes?: string;
  created_at: string;
  resolved_at?: string;
}

// Créer src/services/disputeService.ts
export const disputeService = {
  async open(dispute: Partial<Dispute>): Promise<Dispute> {
    // Ouvrir un litige
  },
  
  async escalate(disputeId: string): Promise<Dispute> {
    // Escalader à l'admin
  },
  
  async resolve(disputeId: string, resolution: string): Promise<Dispute> {
    // Résoudre le litige
  },
};

// Créer src/screens/DisputeScreen.tsx
export const DisputeScreen: React.FC = () => {
  // UI pour ouvrir et suivre un litige
};
```

**Fichiers à créer**:
- `src/types/dispute.ts`
- `src/services/disputeService.ts`
- `src/screens/DisputeScreen.tsx`

**Impact**: Résout les conflits de manière équitable

---

### 9. Logger les communications WhatsApp

**Problème**: Pas de traçabilité des communications

**Statut**: ✅ FAIT (types créés + service communicationLogService créé avec méthodes pour log WhatsApp, SMS, Email) hors app

**Action requise**:
```typescript
// Créer src/types/communicationLog.ts
export interface CommunicationLog {
  id: string;
  order_id: string;
  initiated_by: 'client' | 'seller';
  channel: 'whatsapp' | 'phone' | 'email';
  phone_number: string;
  message_preview: string;
  timestamp: string;
}

// Modifier src/services/contactService.ts
export const contactService = {
  async logCommunication(log: Partial<CommunicationLog>): Promise<void> {
    // Logger la communication
  },
  
  async contactStore(options: ContactOptions): Promise<void> {
    // Logger avant d'ouvrir WhatsApp
    await this.logCommunication({
      order_id: options.orderId,
      initiated_by: 'client',
      channel: 'whatsapp',
      phone_number: options.rawPhone,
      message_preview: options.message.substring(0, 100),
      timestamp: new Date().toISOString(),
    });
    
    // Ouvrir WhatsApp
    Linking.openURL(whatsappUrl);
  },
};
```

**Fichiers à créer**:
- `src/types/communicationLog.ts`

**Fichiers à modifier**:
- `src/services/contactService.ts`
- `src/screens/ClientOrderDetailScreen.tsx` (afficher historique)
- `src/screens/SellerOrderDetailScreen.tsx` (afficher historique)

**Impact**: Trace complète des communications

---

## 🔵 Priorité FAIBLE - Améliorations optionnelles

### 10. Ajouter des graphiques de performance vendeur

**Action requise**:
- Utiliser `react-native-chart-kit` ou `victory-native`
- Graphiques: revenus mensuels, commandes par jour, top produits

---

### 11. Ajouter un système de recommandation de produits

**Action requise**:
- Basé sur l'historique d'achat
- "Les clients qui ont acheté ceci ont aussi acheté..."

---

### 12. Ajouter des templates de messages WhatsApp

**Action requise**:
- Templates prédéfinis pour:
  - Confirmation de commande
  - Notification d'expédition
  - Demande de disponibilité
  - Problème de livraison

---

## 📋 Checklist d'implémentation

### Phase 1 (Cette semaine)
- [ ] Standardiser les statuts de commande
- [ ] Créer SellerReturnsScreen
- [ ] Ajouter champs tracking livraison

### Phase 2 (Semaine prochaine)
- [ ] Implémenter preuve de réception
- [ ] Ajouter système d'évaluation
- [ ] Créer tableau de bord vendeur

### Phase 3 (Dans 2 semaines)
- [ ] Ajouter notifications SMS fallback
- [ ] Créer système de litiges
- [ ] Logger communications WhatsApp

### Phase 4 (Optionnel)
- [ ] Graphiques de performance
- [ ] Système de recommandation
- [ ] Templates WhatsApp

---

## 📝 Notes importantes

- **Service de messagerie intégré**: Exclu par demande du client
- **Tests**: Ajouter des tests unitaires pour chaque nouvelle fonctionnalité
- **Documentation**: Mettre à jour la documentation API après chaque modification
- **Migration**: Prévoir une migration de base de données pour les nouveaux champs
- **Performance**: Tester l'impact des nouvelles fonctionnalités sur les performances

---

## 🔗 Liens vers les fichiers concernés

- `src/services/orderService.ts` - Service principal des commandes
- `src/screens/SellerOrderDetailScreen.tsx` - Détails commande vendeur
- `src/screens/ClientOrderDetailScreen.tsx` - Détails commande client
- `src/services/refundService.ts` - Service des remboursements
- `src/services/notificationService.ts` - Service des notifications
- `src/services/contactService.ts` - Service de contact WhatsApp

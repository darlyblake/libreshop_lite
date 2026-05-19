import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { orderService } from '../services/orderService';
import { refundService } from '../services/refundService';
import { returnService } from '../services/returnService';
import { OrderItem } from '../lib/supabase';

interface PosReturnModalProps {
  visible: boolean;
  onClose: () => void;
  storeId: string;
  userId: string;
}

export const PosReturnModal: React.FC<PosReturnModalProps> = ({
  visible,
  onClose,
  storeId,
  userId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any | null>(null);
  const [returnableItems, setReturnableItems] = useState<(OrderItem & { availableToReturn: number, product: any })[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});

  const [processing, setProcessing] = useState(false);

  const resetState = () => {
    setSearchQuery('');
    setOrder(null);
    setReturnableItems([]);
    setReturnQuantities({});
  };

  const handleClose = () => {
    resetState();
    setShowCamera(false);
    onClose();
  };

  const handleScanClick = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Permission requise', "L'accès à la caméra est nécessaire pour scanner le QR Code.");
        return;
      }
    }
    setShowCamera(true);
  };

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    setShowCamera(false);
    
    // Le QR code généré sur le ticket est de format URL (ex: https://libreshop.shop/api/order?id=ORDER_ID)
    // On extrait l'ID si c'est une URL
    let scannedId = data;
    try {
      if (data.includes('id=')) {
        const url = new URL(data);
        const id = url.searchParams.get('id');
        if (id) scannedId = id;
      } else {
        // Fallback pour les anciens QR codes ou autres formats
        const parts = data.split('/');
        scannedId = parts[parts.length - 1] || data;
      }
    } catch (e) {
      // Si ce n'est pas une URL valide, on garde le texte brut
    }
    
    setSearchQuery(scannedId);
    searchOrder(scannedId);
  }, []);

  const searchOrder = async (orderId: string) => {
    if (!orderId.trim()) return;
    
    setLoading(true);
    try {
      // 1. Récupérer la commande
      const fetchedOrder = await orderService.getById(orderId);
      if (!fetchedOrder) {
        Alert.alert('Introuvable', 'Aucune commande trouvée avec cet identifiant.');
        setLoading(false);
        return;
      }
      
      if (fetchedOrder.store_id !== storeId) {
        Alert.alert('Non autorisé', 'Cette commande n\'appartient pas à votre boutique.');
        setLoading(false);
        return;
      }

      // 2. Vérifier les remboursements précédents
      const previousRefunds = await refundService.getRefundsByOrder(orderId);
      const refundedItemsMap: Record<string, number> = {};
      
      previousRefunds.forEach(ref => {
        if (ref.status === 'approved' || ref.status === 'processed') {
          (ref.items || []).forEach(item => {
            const pid = item.productId || (item as any).product_id;
            if (pid) {
              refundedItemsMap[pid] = (refundedItemsMap[pid] || 0) + item.quantity;
            }
          });
        }
      });

      // 3. Calculer les quantités retournables
      const orderItems = (fetchedOrder.order_items || []) as any[];
      const itemsWithAvailability = orderItems.map(item => {
        const pid = item.product_id;
        const alreadyReturned = refundedItemsMap[pid] || 0;
        const availableToReturn = Math.max(0, item.quantity - alreadyReturned);
        return {
          ...item,
          product: item.product || item.products,
          availableToReturn
        };
      });

      const validItems = itemsWithAvailability.filter(item => item.availableToReturn > 0);

      if (validItems.length === 0) {
        Alert.alert('Information', 'Cette commande a déjà été totalement remboursée ou annulée.');
      }

      setOrder(fetchedOrder);
      setReturnableItems(validItems);
      
      // Initialize return quantities to 0
      const initialQs: Record<string, number> = {};
      validItems.forEach(item => {
        initialQs[item.id] = 0;
      });
      setReturnQuantities(initialQs);

    } catch (error) {
      console.error('Error fetching order for return:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de cette commande.');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setReturnQuantities(prev => {
      const item = returnableItems.find(i => i.id === itemId);
      if (!item) return prev;
      const current = prev[itemId] || 0;
      const newVal = Math.max(0, Math.min(item.availableToReturn, current + delta));
      return { ...prev, [itemId]: newVal };
    });
  };

  const totalRefundAmount = useMemo(() => {
    let total = 0;
    returnableItems.forEach(item => {
      total += (returnQuantities[item.id] || 0) * item.price;
    });
    return total;
  }, [returnableItems, returnQuantities]);

  const confirmReturn = async () => {
    if (totalRefundAmount <= 0) {
      Alert.alert('Action requise', 'Veuillez sélectionner au moins un article à retourner.');
      return;
    }

    Alert.alert(
      'Confirmer le retour en caisse',
      `Voulez-vous valider un retour immédiat pour un montant de ${totalRefundAmount.toLocaleString()} FCFA ?\n\nLes articles seront remis en stock automatiquement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: processReturn
        }
      ]
    );
  };

  const processReturn = async () => {
    setProcessing(true);
    try {
      const itemsToReturn = returnableItems
        .filter(item => (returnQuantities[item.id] || 0) > 0)
        .map(item => ({
          productId: item.product_id,
          productName: item.product?.name || 'Produit',
          quantity: returnQuantities[item.id],
          price: item.price,
          refundAmount: returnQuantities[item.id] * item.price,
        }));

      // Créer la demande
      const isFullRefund = itemsToReturn.length === returnableItems.length && 
                           itemsToReturn.every(i => {
                             const orig = returnableItems.find(r => r.product_id === i.productId);
                             return orig && orig.availableToReturn === i.quantity;
                           });

      const refundReq = await refundService.createRefund({
        orderId: order.id,
        amount: totalRefundAmount,
        reason: 'Retour en Caisse / Rétractation client',
        type: isFullRefund ? 'full' : 'partial',
        status: 'pending',
        items: itemsToReturn,
      });

      // Approuver immédiatement pour un retour POS (déclenche stockMovement + accounting)
      await refundService.approveRefund(
        refundReq.id,
        userId,
        'Approbation automatique : Retour physique en caisse'
      );

      // Créer également les entrées dans la table returns pour l'historique SellerReturnsScreen
      for (const item of itemsToReturn) {
        await returnService.createPosReturn({
          order_id: order.id,
          store_id: storeId,
          product_id: item.productId,
          quantity: item.quantity,
          reason: 'Retour direct en caisse (POS)',
          refund_amount: item.refundAmount,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
        });
      }

      Alert.alert(
        'Succès ✓',
        `Le retour a été validé. Les articles ont été remis en stock et ${totalRefundAmount.toLocaleString()} FCFA ont été enregistrés en remboursement.`,
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (error) {
      console.error('Error processing POS return:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la validation du retour.');
    } finally {
      setProcessing(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const qty = returnQuantities[item.id] || 0;
    
    return (
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.product?.name || 'Produit'}</Text>
          <Text style={styles.itemMeta}>
            {item.price.toLocaleString()} FCFA/U • {item.availableToReturn} disponible(s)
          </Text>
        </View>
        <View style={styles.quantityControls}>
          <TouchableOpacity 
            style={[styles.qtyBtn, qty === 0 && styles.qtyBtnDisabled]} 
            onPress={() => updateQuantity(item.id, -1)}
            disabled={qty === 0}
          >
            <Ionicons name="remove" size={16} color={qty === 0 ? COLORS.textMuted : COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{qty}</Text>
          <TouchableOpacity 
            style={[styles.qtyBtn, qty >= item.availableToReturn && styles.qtyBtnDisabled]} 
            onPress={() => updateQuantity(item.id, 1)}
            disabled={qty >= item.availableToReturn}
          >
            <Ionicons name="add" size={16} color={qty >= item.availableToReturn ? COLORS.textMuted : COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          
          <View style={styles.header}>
            <Text style={styles.title}>Retour de Marchandise</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {showCamera ? (
            <View style={styles.cameraContainer}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr"],
                }}
                onBarcodeScanned={handleBarcodeScanned}
              />
              <TouchableOpacity style={styles.cancelCameraBtn} onPress={() => setShowCamera(false)}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Annuler le scan</Text>
              </TouchableOpacity>
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerTarget} />
                <Text style={styles.scannerText}>Visez le QR Code du reçu</Text>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Recherche */}
              <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={20} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Numéro de reçu ou ID Commande"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => searchOrder(searchQuery)}
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.scanBtn}
                  onPress={handleScanClick}
                >
                  <Ionicons name="qr-code-outline" size={24} color={COLORS.card} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.searchSubmitBtn}
                onPress={() => searchOrder(searchQuery)}
                disabled={loading || !searchQuery.trim()}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchSubmitText}>Rechercher le reçu</Text>}
              </TouchableOpacity>

              {/* Résultat */}
              {order && (
                <View style={styles.resultSection}>
                  <View style={styles.orderSummary}>
                    <Text style={styles.orderSummaryTitle}>Ticket #{order.id.slice(0, 8)}</Text>
                    <Text style={styles.orderSummaryDate}>{new Date(order.created_at).toLocaleString('fr-FR')}</Text>
                    {order.customer_name && (
                      <Text style={styles.orderSummaryClient}>Client: {order.customer_name}</Text>
                    )}
                  </View>

                  <Text style={styles.selectInstructions}>Sélectionnez les quantités à retourner :</Text>
                  
                  <FlatList
                    data={returnableItems}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    style={styles.itemsList}
                    contentContainerStyle={{ paddingBottom: 20 }}
                  />

                  <View style={styles.footer}>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Montant à rembourser :</Text>
                      <Text style={styles.totalAmount}>{totalRefundAmount.toLocaleString()} FCFA</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.confirmBtn, totalRefundAmount === 0 && styles.confirmBtnDisabled]}
                      disabled={totalRefundAmount === 0 || processing}
                      onPress={confirmReturn}
                    >
                      {processing ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.confirmBtnText}>Valider le retour</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    height: '85%',
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    outlineStyle: 'none',
  },
  scanBtn: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSubmitBtn: {
    backgroundColor: COLORS.info,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  searchSubmitText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  resultSection: {
    flex: 1,
  },
  orderSummary: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderSummaryTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  orderSummaryDate: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  orderSummaryClient: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginTop: 6,
    fontWeight: '600',
  },
  selectInstructions: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  itemsList: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  itemName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  qtyBtnDisabled: {
    opacity: 0.5,
  },
  qtyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    width: 24,
    textAlign: 'center',
  },
  footer: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  totalLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalAmount: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.danger,
  },
  confirmBtn: {
    backgroundColor: COLORS.danger,
    height: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZE.lg,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cancelCameraBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 10,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  scannerTarget: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    backgroundColor: 'transparent',
  },
  scannerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
});

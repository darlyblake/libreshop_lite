import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { returnService, ProductReturn, ReturnStatus } from '../services/returnService';
import { PosReturnModal } from '../components/PosReturnModal';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';

export default function SellerReturnsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState<ProductReturn[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ProductReturn | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showPosReturn, setShowPosReturn] = useState(false);

  useEffect(() => {
    loadStoreAndReturns();
  }, [user]);

  const loadStoreAndReturns = async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (store?.id) {
        if (!storeService.isSubscriptionActive(store)) {
          Alert.alert(
            'Abonnement expiré',
            `Votre abonnement pour "${store.name}" a expiré. Veuillez le renouveler pour accéder aux retours.`,
            [
              {
                text: 'Renouveler',
                onPress: () => navigation.replace('SubscriptionExpired'),
              },
            ]
          );
          return;
        }
        setStoreId(store.id);
        const data = await returnService.getStoreReturns(store.id);
        setReturns(data);
      }
    } catch (error) {
      console.error('Error loading returns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: ReturnStatus) => {
    if (!selectedReturn) return;
    try {
      setLoading(true);
      await returnService.updateReturnStatus(selectedReturn.id, status);
      Alert.alert('Succès', `Le statut a été mis à jour : ${status}`);
      setModalVisible(false);
      loadStoreAndReturns();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ReturnStatus) => {
    switch (status) {
      case 'requested': return COLORS.warning;
      case 'approved': return COLORS.primary;
      case 'received': return COLORS.info || '#2196F3';
      case 'completed': return COLORS.success;
      case 'rejected':
      case 'cancelled': return COLORS.danger;
      default: return COLORS.textMuted;
    }
  };

  const getStatusLabel = (status: ReturnStatus) => {
    switch (status) {
      case 'requested': return 'En attente';
      case 'approved': return 'Accepté';
      case 'shipped': return 'En transit';
      case 'received': return 'Produit reçu';
      case 'completed': return 'Remboursé';
      case 'rejected': return 'Refusé';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  const contactClient = (item: ProductReturn) => {
    const phone = item.customer_phone || (item as any).orders?.customer_phone;
    if (!phone) {
      Alert.alert('Erreur', 'Numéro de téléphone du client introuvable');
      return;
    }
    const message = `Bonjour, je vous contacte concernant votre demande de retour pour le produit ${item.products?.name} (Commande #${item.order_id.slice(0, 8)}).`;
    const url = `whatsapp://send?phone=${phone.replace(/\+/g, '')}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', 'WhatsApp n\'est pas installé sur cet appareil');
    });
  };

  const isPosReturn = (item: ProductReturn) => {
    const isCaisseReason = item.reason?.toLowerCase().includes('caisse');
    const isPosMethod = (item as any).orders?.payment_method === 'cash_on_delivery' && (item as any).orders?.notes?.includes('caisse');
    return isCaisseReason || isPosMethod;
  };

  const renderReturnItem = ({ item }: { item: ProductReturn }) => {
    const productData = item.products || (item as any).product;

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => {
          setSelectedReturn(item);
          setModalVisible(true);
        }}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderId}>Commande #{item.order_id.slice(0, 8)}</Text>
            <View style={[styles.sourceBadge, { backgroundColor: isPosReturn(item) ? COLORS.accent + '20' : COLORS.primary + '20' }]}>
              <Text style={[styles.sourceText, { color: isPosReturn(item) ? COLORS.accent : COLORS.primary }]}>
                {isPosReturn(item) ? 'En boutique' : 'En ligne'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Image 
            source={{ uri: productData?.images?.[0] || 'https://libreshop.app/placeholder.png' }} 
            style={styles.productImage} 
            defaultSource={{ uri: 'https://via.placeholder.com/100' }}
          />
          <View style={styles.details}>
            <Text style={styles.productName}>{productData?.name || 'Produit inconnu'}</Text>
            <Text style={styles.quantity}>Quantité: {item.quantity}</Text>
            <Text style={styles.customerName}>Client: {item.customer_name || (item as any).orders?.customer_name || 'Inconnu'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.whatsappIcon}
            onPress={() => contactClient(item)}
          >
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
          <Text style={styles.amount}>{item.refund_amount.toLocaleString()} FCFA</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !returns.length) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Gestion des Retours</Text>
          <Text style={styles.subtitle}>{returns.length} demande(s) enregistrée(s)</Text>
        </View>
        <TouchableOpacity 
          style={styles.posReturnBtn}
          onPress={() => setShowPosReturn(true)}
        >
          <Ionicons name="scan" size={20} color="#fff" />
          <Text style={styles.posReturnBtnText}>Scanner un retour</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={returns}
        keyExtractor={(item) => item.id}
        renderItem={renderReturnItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="refresh-circle-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucune demande de retour pour le moment</Text>
          </View>
        }
      />

      {/* Modal d'Action */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.modalTitle}>Détails du Retour</Text>
                <TouchableOpacity onPress={() => selectedReturn && contactClient(selectedReturn)}>
                  <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedReturn && (() => {
              const productData = selectedReturn.products || (selectedReturn as any).product;
              return (
              <View>
                {/* Bloc produit retourné — même pattern que SellerOrderDetailScreen */}
                {productData && (
                  <View style={styles.productPreview}>
                    <Image
                      source={{ uri: productData.images?.[0] }}
                      style={styles.productPreviewImage}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productPreviewName}>{productData.name}</Text>
                      {productData.reference && (
                        <Text style={styles.productPreviewRef}>Réf: {productData.reference}</Text>
                      )}
                      <Text style={styles.productPreviewPrice}>
                        {(selectedReturn.refund_amount / selectedReturn.quantity).toLocaleString()} FCFA × {selectedReturn.quantity}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.modalSubTitle}>Motif du client :</Text>
                <Text style={styles.modalReason}>{selectedReturn.reason}</Text>

                <View style={styles.actionSection}>
                  <Text style={styles.actionTitle}>Changer le statut :</Text>
                  
                  {selectedReturn.status === 'requested' && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                        onPress={() => handleUpdateStatus('approved')}
                      >
                        <Text style={styles.actionButtonText}>Accepter la demande</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: COLORS.danger }]}
                        onPress={() => handleUpdateStatus('rejected')}
                      >
                        <Text style={styles.actionButtonText}>Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {selectedReturn.status === 'approved' && (
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                      onPress={() => handleUpdateStatus('received')}
                    >
                      <Ionicons name="cube-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
                      <Text style={styles.actionButtonText}>Confirmer la Réception (Stock+)</Text>
                    </TouchableOpacity>
                  )}

                  {selectedReturn.status === 'received' && (
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                      onPress={() => handleUpdateStatus('completed')}
                    >
                      <Ionicons name="cash-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
                      <Text style={styles.actionButtonText}>Confirmer le Remboursement</Text>
                    </TouchableOpacity>
                  )}

                  {selectedReturn.status === 'completed' && (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                      <Text style={styles.completedText}>Ce retour est terminé et remboursé.</Text>
                    </View>
                  )}
                </View>

                {/* Bouton Voir la commande */}
                <TouchableOpacity 
                  style={styles.viewOrderBtn}
                  onPress={() => {
                    setModalVisible(false);
                    navigation.navigate('SellerOrderDetail', { orderId: selectedReturn.order_id });
                  }}
                >
                  <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.viewOrderBtnText}>Voir la commande originale</Text>
                </TouchableOpacity>
              </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {showPosReturn && storeId && user?.id && (
        <PosReturnModal
          visible={showPosReturn}
          onClose={() => {
            setShowPosReturn(false);
            loadStoreAndReturns(); // Recharger pour voir les nouveaux retours
          }}
          storeId={storeId}
          userId={user.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  posReturnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.info,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  posReturnBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  list: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderId: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
  },
  details: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  productName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  quantity: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  customerName: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 2,
    fontWeight: '500',
  },
  whatsappIcon: {
    padding: 8,
    backgroundColor: '#25D36615',
    borderRadius: 20,
    marginLeft: 10,
  },
  reason: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  date: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  amount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: SPACING.md,
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  modalSubTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  modalReason: {
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xl,
  },
  actionSection: {
    marginTop: SPACING.md,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}10`,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 12,
  },
  completedText: {
    color: COLORS.success,
    fontWeight: '600',
  },
  viewOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}15`,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    gap: 8,
  },
  viewOrderBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  productPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}08`,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  productPreviewImage: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.border,
  },
  productPreviewName: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
    marginBottom: 2,
  },
  productPreviewRef: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    marginBottom: 2,
  },
  productPreviewPrice: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONT_SIZE.sm,
  },
});

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../store';
import { productService, Product } from '../lib/supabase';
import { errorHandler } from '../utils/errorHandler';
import { useTheme } from '../hooks/useTheme';
import { useResponsive } from '../utils/useResponsive';

type RouteParams = {
  productId: string;
};

export const SellerProductActionsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { productId } = (route.params as RouteParams) || {};
  const { user } = useAuthStore();
  const { theme, getColor, spacing, radius, fontSize, isDesktop } = useTheme();
  const { width: windowWidth } = useResponsive();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [stats, setStats] = useState({ views: 0, likes: 0, sales: 0 });

  // Load product
  const loadProduct = useCallback(async () => {
    if (!productId) return;
    try {
      const [data, productStats] = await Promise.all([
        productService.getById(productId),
        productService.getProductStats(productId)
      ]);
      setProduct(data);
      setStats(productStats);
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'load product');
      Alert.alert('Erreur', 'Impossible de charger le produit');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [productId, navigation]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct])
  );

  const triggerHaptic = (type: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(type);
    }
  };

  const handleToggleActive = async () => {
    if (!product) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const newState = !product.is_active;
      await productService.update(product.id, { is_active: newState });
      setProduct((prev) => prev ? { ...prev, is_active: newState } : null);
      Alert.alert('Succès', `Produit ${newState ? 'activé' : 'désactivé'} avec succès`);
    } catch (e) {
      errorHandler.handleDatabaseError(e, 'toggle active');
      Alert.alert('Erreur', "Impossible de modifier l'état du produit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!product) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Supprimer ce produit ?',
      'Cette action est irréversible. Toutes les données associées seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await productService.delete(product.id);
              Alert.alert('Succès', 'Produit supprimé');
              navigation.navigate('SellerProducts');
            } catch (e) {
              errorHandler.handleDatabaseError(e, 'delete product');
              Alert.alert('Erreur', 'Impossible de supprimer le produit');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!product) return;
    triggerHaptic();
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
    const url = webBaseUrl 
      ? `${webBaseUrl}/product/${product.id}` 
      : Linking.createURL(`/product/${product.id}`);

    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        Alert.alert('✅ Lien copié', 'Le lien du produit a été copié dans le presse-papier.');
      } else {
        await Share.share({
          title: product.name,
          message: `Découvrez ${product.name} sur LibreShop : ${url}`,
          url: url,
        });
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDuplicate = async () => {
    if (!product) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Dupliquer ce produit ?',
      'Une copie de ce produit sera créée avec les mêmes caractéristiques (prix, stock, images).',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Dupliquer',
          onPress: async () => {
            setSaving(true);
            try {
              const { id, created_at, ...cleanProduct } = product as any;
              await productService.create({
                ...cleanProduct,
                name: `${product.name} (copie)`,
                is_active: false,
              });
              Alert.alert('✅ Succès', 'Produit dupliqué avec succès (inactif par défaut).', [
                { text: 'OK', onPress: () => navigation.navigate('SellerProducts') }
              ]);
            } catch (e) {
              errorHandler.handleDatabaseError(e, 'duplicate product');
              Alert.alert('Erreur', 'Impossible de dupliquer le produit');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const goToEdit = () => {
    triggerHaptic();
    navigation.navigate('SellerEditProduct', { productId: product?.id });
  };

  const goToClientView = () => {
    triggerHaptic();
    navigation.navigate('ProductDetail', { productId: product?.id });
  };

  const handlePromotion = () => {
    triggerHaptic();
    navigation.navigate('SellerSale', { productId: product?.id });
  };

  const handleRestock = () => {
    triggerHaptic();
    navigation.navigate('SellerRestock', { productId: product?.id });
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: getColor.bg }]}>
        <ActivityIndicator size="large" color={getColor.accent} />
        <Text style={[styles.loadingText, { color: getColor.text }]}>Chargement...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.centered, { backgroundColor: getColor.bg }]}>
        <Ionicons name="alert-circle-outline" size={60} color={getColor.danger} />
        <Text style={[styles.errorText, { color: getColor.text }]}>Produit introuvable</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const firstImage = product.images && product.images[0];

  return (
    <View style={[styles.container, { backgroundColor: getColor.bg }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Visual Header */}
      <View style={styles.headerContainer}>
        {firstImage ? (
          <Image source={{ uri: firstImage }} style={styles.headerImage} />
        ) : (
          <View style={[styles.headerImage, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={60} color={getColor.textMuted} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.headerOverlay}
        />
        
        <TouchableOpacity 
          style={[styles.backButton, { top: Platform.OS === 'ios' ? 50 : 20 }]} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.productPrice}>{product.price.toLocaleString()} FCFA</Text>
            {product.compare_price && (
              <Text style={styles.comparePrice}>{product.compare_price.toLocaleString()} FCFA</Text>
            )}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Info Bar */}
        <View style={[styles.infoBar, { backgroundColor: getColor.card, borderColor: getColor.border }]}>
          <View style={styles.infoItem}>
            <Ionicons name="cube-outline" size={20} color={getColor.accent} />
            <Text style={[styles.infoLabel, { color: getColor.textMuted }]}>Stock</Text>
            <Text style={[styles.infoValue, { color: getColor.text }]}>{product.stock}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: getColor.border }]} />
          <View style={styles.infoItem}>
            <Ionicons 
              name={product.is_active ? "checkmark-circle" : "pause-circle"} 
              size={20} 
              color={product.is_active ? getColor.success : getColor.danger} 
            />
            <Text style={[styles.infoLabel, { color: getColor.textMuted }]}>État</Text>
            <Text style={[styles.infoValue, { color: getColor.text }]}>
              {product.is_active ? 'Actif' : 'Inactif'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: getColor.border }]} />
          <View style={styles.infoItem}>
            <Ionicons name="flash-outline" size={20} color={getColor.warning} />
            <Text style={[styles.infoLabel, { color: getColor.textMuted }]}>Ventes</Text>
            <Text style={[styles.infoValue, { color: getColor.text }]}>{stats.sales}</Text>
          </View>
        </View>

        {/* Actions Grid */}
        <Text style={[styles.sectionTitle, { color: getColor.text, marginHorizontal: spacing.lg }]}>Actions</Text>
        
        <View style={styles.grid}>
          <ActionCard 
            title="Promotion" 
            desc="Réduction / Solde" 
            icon="pricetag" 
            color={getColor.accent}
            onPress={handlePromotion}
          />
          <ActionCard 
            title="Sponsorisation" 
            desc="Fonctionnalité à venir" 
            icon="rocket" 
            color={getColor.textMuted}
            onPress={() => Alert.alert('À venir', 'La sponsorisation (Ads) sera disponible prochainement.')}
          />
          <ActionCard 
            title="Réassort" 
            desc="Gérer le stock" 
            icon="add-circle" 
            color="#4ECDC4"
            onPress={handleRestock}
          />
          <ActionCard 
            title={product.is_active ? "Désactiver" : "Activer"} 
            desc={product.is_active ? "Mettre en pause" : "Mettre en ligne"} 
            icon={product.is_active ? "pause-circle" : "play-circle"} 
            color={product.is_active ? "#f39c12" : "#2ecc71"}
            onPress={handleToggleActive}
          />
          <ActionCard 
            title="Modifier" 
            desc="Éditer les infos" 
            icon="create" 
            color="#3498db"
            onPress={goToEdit}
          />
          <ActionCard 
            title="Aperçu Client" 
            desc="Voir en boutique" 
            icon="eye" 
            color="#9b59b6"
            onPress={goToClientView}
          />
          <ActionCard 
            title="Partager" 
            desc="Lien direct" 
            icon="share-social" 
            color="#1abc9c"
            onPress={handleShare}
          />
          <ActionCard 
            title="Dupliquer" 
            desc="Copier le produit" 
            icon="copy" 
            color="#34495e"
            onPress={handleDuplicate}
          />
          <ActionCard 
            title="Plus de détails" 
            desc="Stats & Infos" 
            icon="ellipsis-horizontal-circle" 
            color={getColor.accent}
            onPress={() => { triggerHaptic(); setShowStatsModal(true); }}
          />
        </View>

        <TouchableOpacity 
          style={[styles.deleteButton, { backgroundColor: getColor.danger + '15' }]} 
          onPress={handleDelete}
        >
          <Ionicons name="trash" size={20} color={getColor.danger} />
          <Text style={[styles.deleteButtonText, { color: getColor.danger }]}>Supprimer le produit</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Statistics & Info Modal */}
      <Modal
        visible={showStatsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: getColor.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: getColor.border }]}>
              <Text style={[styles.modalTitle, { color: getColor.text }]}>Informations Détaillées</Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={28} color={getColor.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <StatRow label="ID Produit" value={product.id} color={getColor.textMuted} />
              <StatRow label="Référence" value={product.reference || 'Non définie'} color={getColor.text} />
              <StatRow label="Prix de base" value={`${product.price.toLocaleString()} FCFA`} color={getColor.text} />
              <StatRow label="Prix barré" value={product.compare_price ? `${product.compare_price.toLocaleString()} FCFA` : 'Aucun'} color={getColor.text} />
              <StatRow label="Stock total" value={String(product.stock)} color={product.stock < 5 ? getColor.danger : getColor.success} />
              <StatRow label="Vente en ligne" value={product.is_online_sale ? 'Activée' : 'Désactivée'} color={getColor.text} />
              <StatRow label="Vente physique" value={product.is_physical_sale ? 'Activée' : 'Désactivée'} color={getColor.text} />
              <StatRow label="Créé le" value={new Date(product.created_at).toLocaleDateString('fr-FR')} color={getColor.text} />
              
              <View style={[styles.statsCard, { backgroundColor: getColor.card, borderColor: getColor.border }]}>
                <Text style={[styles.statsCardTitle, { color: getColor.text }]}>Performance</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statBoxValue, { color: getColor.accent }]}>{stats.views}</Text>
                    <Text style={[styles.statBoxLabel, { color: getColor.textMuted }]}>Vues</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statBoxValue, { color: getColor.success }]}>{stats.sales}</Text>
                    <Text style={[styles.statBoxLabel, { color: getColor.textMuted }]}>Vendus</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statBoxValue, { color: getColor.warning }]}>{stats.likes}</Text>
                    <Text style={[styles.statBoxLabel, { color: getColor.textMuted }]}>Favoris</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.modalCloseButton, { backgroundColor: getColor.accent }]}
              onPress={() => setShowStatsModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const ActionCard = ({ title, desc, icon, color, onPress }: any) => {
  const { getColor, spacing, radius, fontSize } = useTheme();
  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: getColor.card, borderColor: getColor.border }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardTitle, { color: getColor.text }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: getColor.textMuted }]} numberOfLines={1}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
};

const StatRow = ({ label, value, color }: any) => {
  const { getColor, spacing, fontSize } = useTheme();
  return (
    <View style={[styles.statRow, { borderBottomColor: getColor.border }]}>
      <Text style={[styles.statLabel, { color: getColor.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 15, fontSize: 16, fontWeight: '500' },
  errorText: { fontSize: 18, fontWeight: '700', marginTop: 15, marginBottom: 20 },
  retryButton: { backgroundColor: '#3498db', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25 },
  retryButtonText: { color: '#FFF', fontWeight: '700' },
  
  headerContainer: { height: 280, width: '100%', position: 'relative' },
  headerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  headerOverlay: { ...StyleSheet.absoluteFillObject },
  backButton: { position: 'absolute', left: 20, zIndex: 10, width: 45, height: 45, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  headerInfo: { position: 'absolute', bottom: 25, left: 20, right: 20 },
  productName: { fontSize: 26, fontWeight: '800', color: '#FFF', marginBottom: 5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  productPrice: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  comparePrice: { fontSize: 14, color: '#DDD', textDecorationLine: 'line-through' },
  
  scrollContent: { paddingTop: 20 },
  infoBar: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 25, borderRadius: 15, padding: 15, borderWidth: 1, elevation: 2 },
  infoItem: { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: 12, marginTop: 4, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '700' },
  divider: { width: 1, height: '100%', marginHorizontal: 5 },
  
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 },
  card: { width: '48%', borderRadius: 18, padding: 15, borderWidth: 1, marginBottom: 5 },
  iconContainer: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardDesc: { fontSize: 11, marginTop: 2 },
  
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginTop: 30, paddingVertical: 15, borderRadius: 15, gap: 10 },
  deleteButtonText: { fontWeight: '700', fontSize: 15 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalBody: { paddingBottom: 20 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1 },
  statLabel: { fontSize: 14, fontWeight: '500' },
  statValue: { fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 20 },
  statsCard: { marginTop: 20, borderRadius: 20, padding: 15, borderWidth: 1 },
  statsCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { flex: 1, alignItems: 'center' },
  statBoxValue: { fontSize: 18, fontWeight: '800' },
  statBoxLabel: { fontSize: 11, marginTop: 4 },
  modalCloseButton: { marginTop: 20, paddingVertical: 15, borderRadius: 15, alignItems: 'center' },
  modalCloseButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { productService, Product } from '../lib/supabase';

type RouteParams = {
  productId: string;
};

export const SellerProductActionsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { productId } = (route.params as RouteParams) || {};
  const { user } = useAuthStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load product
  useEffect(() => {
    if (!productId) {
      Alert.alert('Erreur', 'Aucun produit sélectionné');
      navigation.goBack();
      return;
    }
    const load = async () => {
      try {
        const data = await productService.getById(productId);
        setProduct(data);
      } catch (e) {
        console.error('load product', e);
        Alert.alert('Erreur', 'Impossible de charger le produit');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productId, navigation]);

  const handleToggleActive = async () => {
    if (!product) return;
    setSaving(true);
    try {
      await productService.update(product.id, { is_active: !product.is_active });
      setProduct((prev: Product | null) => prev ? { ...prev, is_active: !prev.is_active } : null);
      Alert.alert('Succès', `Produit ${product.is_active ? 'désactivé' : 'activé'} avec succès`);
    } catch (e) {
      console.error('toggle active', e);
      Alert.alert('Erreur', "Impossible de modifier l'état du produit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!product) return;
    Alert.alert(
      'Supprimer ce produit ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await productService.delete(product.id);
              Alert.alert('Succès', 'Produit supprimé');
              navigation.goBack();
            } catch (e) {
              console.error('delete product', e);
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
    const url = `https://libreshop.app/product/${product.id}`;
    try {
      await Share.share({ message: `Découvrez ${product.name} - ${url}`, url });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDuplicate = async () => {
    if (!product) return;
    Alert.alert(
      'Dupliquer ce produit ?',
      'Une copie de ce produit sera créée avec les mêmes caractéristiques.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Dupliquer',
          onPress: async () => {
            setSaving(true);
            try {
              const duplicated = await productService.create({
                ...product,
                name: `${product.name} (copie)`,
                is_active: false, // Start as inactive
              });
              Alert.alert('Succès', 'Produit dupliqué avec succès');
              navigation.goBack();
            } catch (e) {
              console.error('duplicate product', e);
              Alert.alert('Erreur', 'Impossible de dupliquer le produit');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleViewStats = () => {
    if (!product) return;
    Alert.alert(
      'Statistiques du produit',
      `\n📊 Nom: ${product.name}\n💰 Prix: ${product.price.toLocaleString()} FCA\n📦 Stock: ${product.stock}\n👁️ État: ${product.is_active ? 'Actif' : 'Inactif'}\n🛒 Vente en ligne: ${product.is_online_sale ? 'Oui' : 'Non'}\n🏪 Vente physique: ${product.is_physical_sale ? 'Oui' : 'Non'}`,
      [{ text: 'OK' }]
    );
  };

  const goToEdit = () => {
    if (!product) return;
    navigation.navigate('SellerEditProduct', { productId: product.id });
  };

  const goToClientView = () => {
    if (!product) return;
    navigation.navigate('ProductDetail', { productId: product.id });
  };

  // Navigation actions
  const handlePromotion = () => {
    Alert.alert('Bientôt', 'La gestion des promotions arrive dans la prochaine étape (Promotions + Coupons).');
  };
  const handleSponsorship = () => {
    Alert.alert('Bientôt', 'La sponsorisation (Ads) arrive dans une prochaine étape.');
  };
  const handleSale = () => {
    if (!product) return;
    navigation.navigate('SellerSale', { productId: product.id });
  };
  const handleRestock = () => {
    if (!product) return;
    navigation.navigate('SellerRestock', { productId: product.id });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Chargement du produit...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Produit introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.accent, COLORS.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Actions produit</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{product.name}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Product preview card */}
        <View style={styles.productPreview}>
          <Text style={styles.productPreviewTitle}>Aperçu</Text>
          <View style={styles.productCard}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productPrice}>{product.price} FCFA</Text>
            <Text style={styles.productStock}>Stock : {product.stock}</Text>
            <Text style={[styles.productStatus, { color: product.is_active ? COLORS.success : COLORS.textMuted }]}>
              {product.is_active ? 'Actif' : 'Inactif'}
            </Text>
          </View>
        </View>

        {/* Actions grid */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={handlePromotion}>
            <Ionicons name="pricetag" size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>Promotion</Text>
            <Text style={styles.actionDesc}>Créer une promotion</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleSponsorship}>
            <Ionicons name="rocket" size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>Sponsorisation</Text>
            <Text style={styles.actionDesc}>Mettre en avant</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleSale}>
            <Ionicons name="pricetag-outline" size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>Solde / Réduction</Text>
            <Text style={styles.actionDesc}>Appliquer un rabais</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleRestock}>
            <Ionicons name="cube" size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>Réassort</Text>
            <Text style={styles.actionDesc}>Gérer le stock</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleToggleActive} disabled={saving}>
            <Ionicons name={product.is_active ? 'pause-circle' : 'play-circle'} size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>{product.is_active ? 'Désactiver' : 'Activer'}</Text>
            <Text style={styles.actionDesc}>{product.is_active ? 'Mettre en pause' : 'Mettre en ligne'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={goToEdit}>
            <Ionicons name="create" size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>Modifier</Text>
            <Text style={styles.actionDesc}>Éditer les infos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={goToClientView}>
            <Ionicons name="eye" size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>Voir (client)</Text>
            <Text style={styles.actionDesc}>Aperçu client</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleShare}>
            <Ionicons name="share" size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>Partager</Text>
            <Text style={styles.actionDesc}>Copier le lien</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleDuplicate} disabled={saving}>
            <Ionicons name="copy" size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>Dupliquer</Text>
            <Text style={styles.actionDesc}>Créer une copie</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleViewStats}>
            <Ionicons name="stats-chart" size={28} color={COLORS.accent} />
            <Text style={styles.actionTitle}>Statistiques</Text>
            <Text style={styles.actionDesc}>Voir les détails</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, styles.actionCardDanger]} onPress={handleDelete} disabled={saving}>
            <Ionicons name="trash" size={28} color={COLORS.danger} />
            <Text style={[styles.actionTitle, { color: COLORS.danger }]}>Supprimer</Text>
            <Text style={[styles.actionDesc, { color: COLORS.textMuted }]}>Supprimer ce produit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: SPACING.md, color: COLORS.text, fontSize: FONT_SIZE.md },
  errorText: { color: COLORS.danger, fontSize: FONT_SIZE.md },
  headerGradient: { paddingTop: SPACING.xl, paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg },
  header: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: SPACING.md },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.white },
  headerSubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.white + 'CC', marginTop: 2 },
  scrollContent: { padding: SPACING.lg },
  productPreview: { marginBottom: SPACING.xl },
  productPreviewTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  productCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  productName: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  productPrice: { fontSize: FONT_SIZE.md, color: COLORS.accent, marginBottom: SPACING.xs },
  productStock: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.xs },
  productStatus: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.md },
  actionCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  actionCardDanger: { borderColor: COLORS.danger },
  actionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginTop: SPACING.sm, textAlign: 'center' },
  actionDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },
});

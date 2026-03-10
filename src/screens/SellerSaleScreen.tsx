import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { productService, Product } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { DatePickerInput } from '../components/DatePickerInput';

type RouteParams = {
  productId: string;
};

export const SellerSaleScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { productId } = (route.params as RouteParams) || {};

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saleActive, setSaleActive] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [saleStartDate, setSaleStartDate] = useState('');
  const [saleEndDate, setSaleEndDate] = useState('');

  useEffect(() => {
    const loadProduct = async () => {
      if (!productId) {
        Alert.alert('Erreur', 'Produit non trouvé');
        navigation.goBack();
        return;
      }
      try {
        const data = await productService.getById(productId);
        setProduct(data);
        // Load sale info if exists
        if ((data as any).sale_active) {
          setSaleActive(true);
          setSalePrice((data as any).sale_price || '');
          setDiscountPercent((data as any).discount_percent || '');
          setSaleStartDate((data as any).sale_start_date || '');
          setSaleEndDate((data as any).sale_end_date || '');
        }
      } catch (e) {
        console.error('load product', e);
        Alert.alert('Erreur', 'Impossible de charger le produit');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [productId, navigation]);

  const calculateDiscountPrice = (percent: string) => {
    const price = parseFloat(product?.price || '0');
    const percent_val = parseFloat(percent);
    if (price && percent_val) {
      const discounted = price - (price * percent_val) / 100;
      setSalePrice(Math.round(discounted).toString());
      setDiscountPercent(percent);
    }
  };

  const calculateDiscountPercent = (price: string) => {
    const original = parseFloat(product?.price || '0');
    const sale = parseFloat(price);
    if (original && sale) {
      const percent = Math.round(((original - sale) / original) * 100);
      setDiscountPercent(percent.toString());
      setSalePrice(price);
    }
  };

  const handleSaveSale = async () => {
    if (!product) return;

    if (saleActive) {
      if (!salePrice || parseFloat(salePrice) <= 0) {
        Alert.alert('Erreur', 'Prix de vente requis');
        return;
      }
      if (parseFloat(salePrice) >= parseFloat(product.price.toString())) {
        Alert.alert('Erreur', 'Le prix de vente doit être inférieur au prix régulier');
        return;
      }
    }

    setSaving(true);
    try {
      await productService.update(product.id, {
        sale_active: saleActive,
        sale_price: saleActive ? parseFloat(salePrice) : null,
        discount_percent: saleActive ? parseFloat(discountPercent) : null,
        sale_start_date: saleActive ? (saleStartDate || undefined) : null,
        sale_end_date: saleActive ? (saleEndDate || undefined) : null,
      } as any);

      Alert.alert('Succès', saleActive ? 'Solde/réduction activé' : 'Solde/réduction désactivé', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error('save sale', e);
      Alert.alert('Erreur', 'Impossible de sauvegarder la solde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
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
            <Text style={styles.headerTitle}>Solde / Réduction</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{product.name}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Product info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prix actuel</Text>
          <View style={styles.infoCard}>
            <Text style={styles.priceLabel}>Prix régulier</Text>
            <Text style={styles.priceValue}>{product.price.toLocaleString()} FCFA</Text>
          </View>
        </View>

        {/* Sale toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.sectionTitle}>Activer une solde</Text>
              <Text style={styles.description}>Appliquer une réduction sur ce produit</Text>
            </View>
            <Switch
              value={saleActive}
              onValueChange={setSaleActive}
              trackColor={{ false: COLORS.border, true: COLORS.accent }}
            />
          </View>
        </View>

        {saleActive && (
          <>
            {/* Sale price input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prix de solde</Text>
              <Input
                label="Nouveau prix (FCFA)"
                value={salePrice}
                onChangeText={calculateDiscountPercent}
                placeholder="0"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Réduction : {discountPercent ? `${discountPercent}%` : '-'}
              </Text>
            </View>

            {/* Discount by percent */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ou réduction en %</Text>
              <Input
                label="Pourcentage de réduction"
                value={discountPercent}
                onChangeText={calculateDiscountPrice}
                placeholder="0"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Prix final : {salePrice ? `${salePrice} FCFA` : '-'}
              </Text>
            </View>

            {/* Dates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Période de solde</Text>
              <DatePickerInput
                label="Date de début (optionnel)"
                value={saleStartDate}
                onChange={setSaleStartDate}
                placeholder="Sélectionner une date"
              />
              <DatePickerInput
                label="Date de fin (optionnel)"
                value={saleEndDate}
                onChange={setSaleEndDate}
                placeholder="Sélectionner une date"
              />
            </View>

            {/* Preview */}
            {salePrice && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aperçu</Text>
                <View style={styles.previewCard}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Prix régulier</Text>
                    <Text style={[styles.previewPrice, { textDecorationLine: 'line-through' }]}>
                      {product.price.toLocaleString()} FCFA
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Prix de solde</Text>
                    <Text style={[styles.previewPrice, { color: COLORS.success }]}>
                      {salePrice} FCFA
                    </Text>
                  </View>
                  {discountPercent && (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Économies</Text>
                      <Text style={[styles.previewPrice, { color: COLORS.accent }]}>
                        -{discountPercent}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="Annuler"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.button}
          />
          <Button
            title={saving ? 'Enregistrement...' : 'Sauvegarder'}
            onPress={handleSaveSale}
            disabled={saving}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </View>
  );
};

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
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.lg,
  },
  headerGradient: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  backButton: {
    marginRight: SPACING.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
    opacity: 0.8,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priceLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  priceValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  hint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    marginTop: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  previewCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  previewLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
  previewPrice: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  button: {
    flex: 1,
  },
});

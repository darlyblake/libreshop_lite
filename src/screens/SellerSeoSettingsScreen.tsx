import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { errorHandler } from '../utils/errorHandler';

export const SellerSeoSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [seoOgImage, setSeoOgImage] = useState('');

  useEffect(() => {
    const loadStore = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const store = await storeService.getByUser(user.id);
        if (store?.id) {
          setStoreId(store.id);
          setSeoTitle(store.seo_title || '');
          setSeoDescription(store.seo_description || '');
          setSeoKeywords(store.seo_keywords || '');
          setSeoOgImage(store.seo_og_image || '');
        }
      } catch (e) {
        errorHandler.handleDatabaseError(e as Error, 'Error loading store');
      } finally {
        setLoading(false);
      }
    };
    loadStore();
  }, [user?.id]);

  const handleSave = async () => {
    if (!storeId) return;

    // Validation
    if (seoTitle.length > 60) {
      Alert.alert('Erreur', 'Le titre SEO ne doit pas dépasser 60 caractères');
      return;
    }
    if (seoDescription.length > 160) {
      Alert.alert('Erreur', 'La description SEO ne doit pas dépasser 160 caractères');
      return;
    }

    try {
      setSaving(true);
      await storeService.update(storeId, {
        seo_title: seoTitle,
        seo_description: seoDescription,
        seo_keywords: seoKeywords,
        seo_og_image: seoOgImage,
      });
      Alert.alert('Succès', 'Paramètres SEO enregistrés avec succès');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error saving SEO settings');
      Alert.alert('Erreur', 'Impossible d\'enregistrer les paramètres SEO');
    } finally {
      setSaving(false);
    }
  };

  const SeoTip = ({ title, content }: { title: string; content: string }) => (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} />
        <Text style={styles.tipTitle}>{title}</Text>
      </View>
      <Text style={styles.tipContent}>{content}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres SEO</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres SEO</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.saveButton}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <SeoTip
          title="Pourquoi le SEO est important?"
          content="Le SEO (Search Engine Optimization) aide votre boutique à apparaître dans les résultats de recherche de Google et d'autres moteurs de recherche, attirant ainsi plus de trafic organique."
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Titre SEO</Text>
          <TextInput
            style={styles.input}
            placeholder="Titre de votre boutique (max 60 caractères)"
            placeholderTextColor={COLORS.textMuted}
            value={seoTitle}
            onChangeText={setSeoTitle}
            maxLength={60}
          />
          <Text style={styles.charCount}>{seoTitle.length}/60</Text>
          <Text style={styles.helper}>
            Ce titre apparaît dans les résultats de recherche. Il doit être accrocheur et contenir vos mots-clés principaux.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description SEO</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description de votre boutique (max 160 caractères)"
            placeholderTextColor={COLORS.textMuted}
            value={seoDescription}
            onChangeText={setSeoDescription}
            maxLength={160}
            multiline
            numberOfLines={4}
          />
          <Text style={styles.charCount}>{seoDescription.length}/160</Text>
          <Text style={styles.helper}>
            Cette description apparaît sous le titre dans les résultats de recherche. Elle doit être concise et inciter au clic.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mots-clés</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="mots-clés séparés par des virgules"
            placeholderTextColor={COLORS.textMuted}
            value={seoKeywords}
            onChangeText={setSeoKeywords}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.helper}>
            Séparez les mots-clés par des virgules. Ex: mode, vêtements, afrique, commerce en ligne
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Image Open Graph</Text>
          <TextInput
            style={styles.input}
            placeholder="URL de l'image pour les réseaux sociaux"
            placeholderTextColor={COLORS.textMuted}
            value={seoOgImage}
            onChangeText={setSeoOgImage}
          />
          <Text style={styles.helper}>
            Cette image apparaît lorsque votre boutique est partagée sur Facebook, Twitter, WhatsApp, etc. (1200x630px recommandé)
          </Text>
        </View>

        <SeoTip
          title="Conseils pour un bon SEO"
          content="• Utilisez des mots-clés pertinents pour votre activité\n• Écrivez un titre unique et descriptif\n• Incluez votre localisation si pertinent\n• Mettez à jour régulièrement vos métadonnées\n• Utilisez des images de haute qualité"
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aperçu Google</Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewUrl}>libreshop.shop/store/{storeId?.slice(0, 8)}...</Text>
            <Text style={styles.previewTitle}>
              {seoTitle || 'Votre Boutique | LibreShop'}
            </Text>
            <Text style={styles.previewDescription}>
              {seoDescription || 'Description de votre boutique...'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.card },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  saveButton: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  content: { flex: 1, padding: SPACING.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tipCard: { backgroundColor: COLORS.accent + '10', padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.accent + '30' },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  tipTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  tipContent: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 22 },
  section: { backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'right', marginTop: SPACING.xs },
  helper: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.sm, lineHeight: 20 },
  previewCard: { backgroundColor: COLORS.bg, padding: SPACING.md, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
  previewUrl: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.xs },
  previewTitle: { fontSize: FONT_SIZE.md, color: '#1a0dab', fontWeight: '600', marginBottom: SPACING.xs },
  previewDescription: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

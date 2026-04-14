import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../config/theme';
import { ProductReview } from '../lib/supabase';
import { cloudinaryService } from '../services/cloudinaryService';

interface TabContentProps {
  activeTab: 'description' | 'characteristics' | 'reviews' | 'similar';
  productDescription?: string;
  productCategory?: string;
  optionsList?: Array<{ id: string; name: string; values: string[] }>;
  reviewsList?: ProductReview[];
  reviewsLoading?: boolean;
  reviewForm?: {
    name: string;
    comment: string;
    rating: number;
    onNameChange: (text: string) => void;
    onCommentChange: (text: string) => void;
    onRatingChange: (rating: number) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
  };
  similiarProducts?: Array<{
    id: string;
    name: string;
    price: number;
    images: string[];
  }>;
  onProductPress?: (productId: string) => void;
}

export const TabContent: React.FC<TabContentProps> = ({
  activeTab,
  productDescription,
  productCategory,
  optionsList = [],
  reviewsList = [],
  reviewsLoading = false,
  reviewForm,
  similiarProducts = [],
  onProductPress,
}) => {
  if (activeTab === 'description') {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.tabSectionLabel}>Description complète</Text>
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>
            {productDescription?.trim() ? productDescription : 'Aucune description disponible.'}
          </Text>
        </View>
        {!!productCategory && (
          <View style={styles.categoryBadge}>
            <Ionicons name="folder-outline" size={14} color={COLORS.accent} />
            <Text style={styles.categoryText}>{productCategory}</Text>
          </View>
        )}
      </View>
    );
  }

  if (activeTab === 'characteristics') {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.tabSectionLabel}>Caractéristiques</Text>
        {optionsList.length > 0 ? (
          <View style={styles.characteristicsGrid}>
            {optionsList.map((opt) => (
              <View key={opt.id} style={styles.characteristicItem}>
                <Text style={styles.characteristicName}>{opt.name}</Text>
                <Text style={styles.characteristicValues}>{opt.values?.join(', ') || 'N/A'}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Aucune caractéristique disponible</Text>
        )}
      </View>
    );
  }

  if (activeTab === 'reviews') {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.tabSectionLabel}>Avis clients</Text>
        {reviewsLoading ? (
          <View style={styles.reviewsLoading}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : reviewsList.length === 0 ? (
          <Text style={styles.emptyText}>Aucun avis pour le moment</Text>
        ) : (
          <View style={styles.reviewsList}>
            {reviewsList.map((review) => (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>
                      {(review.user_name || '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.reviewInfo}>
                    <Text style={styles.reviewAuthor}>{review.user_name}</Text>
                    <Text style={styles.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                </View>
                <View style={styles.reviewRatingRow}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Ionicons
                      key={i}
                      name={i <= review.rating ? 'star' : 'star-outline'}
                      size={14}
                      color={COLORS.star}
                    />
                  ))}
                </View>
                <Text style={styles.reviewText}>{review.comment}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  if (activeTab === 'similar') {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.tabSectionLabel}>Produits similaires</Text>
        {similiarProducts.length === 0 ? (
          <Text style={styles.emptyText}>Aucun produit similaire</Text>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={similiarProducts}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.productsGridRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.similarProductCard}
                onPress={() => onProductPress?.(item.id)}
                activeOpacity={0.85}
              >
                {item.images && item.images.length > 0 ? (
                  <Image
                    source={{ uri: cloudinaryService.getOptimizedUrl(item.images[0], 300) }}
                    style={styles.similarProductImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.similarProductImagePlaceholder}>
                    <Ionicons name="image-outline" size={32} color={COLORS.textMuted} />
                  </View>
                )}
                <Text style={styles.similarProductName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.similarProductPrice}>
                  {(item.price || 0).toLocaleString()} FCFA
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  tabContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.lg,
  },
  tabSectionLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '900',
    color: COLORS.text,
  },
  descriptionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  descriptionText: {
    color: COLORS.textSoft,
    lineHeight: 24,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accent + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
  },
  categoryText: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: FONT_SIZE.xs,
  },
  characteristicsGrid: {
    gap: SPACING.md,
  },
  characteristicItem: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  characteristicName: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: FONT_SIZE.xs,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  characteristicValues: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  reviewsLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  reviewsList: {
    gap: SPACING.md,
  },
  reviewItem: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  reviewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    color: COLORS.accent,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewAuthor: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
  },
  reviewDate: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  reviewRatingRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: SPACING.md,
  },
  reviewText: {
    color: COLORS.textSoft,
    lineHeight: 20,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  productsGridRow: {
    gap: SPACING.md,
    paddingHorizontal: 0,
  },
  similarProductCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  similarProductImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  similarProductImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarProductName: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  similarProductPrice: {
    color: COLORS.accent2,
    fontWeight: '800',
    fontSize: FONT_SIZE.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    textAlign: 'center',
  },
});

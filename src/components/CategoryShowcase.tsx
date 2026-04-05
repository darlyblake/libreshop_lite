import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useLegacyPalette } from '../hooks/useLegacyPalette';
import { SkeletonLoader } from './SkeletonLoader';
import { productService } from '../services/productService';
import { storeService } from '../services/storeService';
import { useNavigation } from '@react-navigation/native';

interface ShowcaseItem {
  id: string;
  name: string;
  imageUrl?: string;
  subtitle?: string;
}

interface CategoryShowcaseSection {
  title: string;
  category: string;
  items: ShowcaseItem[];
  onSeeMore: () => void;
  onItemPress?: (item: ShowcaseItem) => void;
}

interface CategoryShowcaseSectionCardProps {
  section: CategoryShowcaseSection;
}

const PLACEHOLDER_COLORS = ['#f8e8fa', '#fef3c7', '#e0f2fe', '#f0fdf4', '#fce7f3'];

const CategoryShowcaseSectionCard: React.FC<CategoryShowcaseSectionCardProps> = ({ section }) => {
  const theme = useTheme();
  const palette = useLegacyPalette();
  const { spacing: S, radius: R, fontSize: F } = theme;

  const items = section.items.slice(0, 4);
  const hasImages = items.some(i => i.imageUrl);

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.cardTitle, { color: palette.text, fontSize: F.lg }]}>
        {section.title}
      </Text>

      {/* Row 1 */}
      <View style={styles.gridRow}>
        {[0, 1].map((idx) => {
          const item = items[idx];
          return (
            <TouchableOpacity 
              key={idx} 
              style={styles.gridCell}
              activeOpacity={0.7}
              onPress={() => item && section.onItemPress && section.onItemPress(item)}
            >
              <View style={[styles.gridItem, { backgroundColor: item?.imageUrl ? 'transparent' : PLACEHOLDER_COLORS[idx % PLACEHOLDER_COLORS.length] }]}>
                {item?.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.gridItemImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.gridItemEmoji}>🛍️</Text>
                )}
              </View>
              <Text style={[styles.gridItemLabel, { color: palette.textSoft, fontSize: F.xs }]} numberOfLines={2}>
                {item?.name || ''}
              </Text>
              {item?.subtitle ? (
                <Text style={[styles.gridItemPrice, { color: palette.text, fontSize: F.xs, fontWeight: '700' }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Row 2 */}
      <View style={[styles.gridRow, { marginTop: 6 }]}>
        {[2, 3].map((idx) => {
          const item = items[idx];
          return (
            <TouchableOpacity 
              key={idx} 
              style={styles.gridCell}
              activeOpacity={0.7}
              onPress={() => item && section.onItemPress && section.onItemPress(item)}
            >
              <View style={[styles.gridItem, { backgroundColor: item?.imageUrl ? 'transparent' : PLACEHOLDER_COLORS[idx % PLACEHOLDER_COLORS.length] }]}>
                {item?.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.gridItemImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.gridItemEmoji}>🛍️</Text>
                )}
              </View>
              <Text style={[styles.gridItemLabel, { color: palette.textSoft, fontSize: F.xs }]} numberOfLines={2}>
                {item?.name || ''}
              </Text>
              {item?.subtitle ? (
                <Text style={[styles.gridItemPrice, { color: palette.text, fontSize: F.xs, fontWeight: '700' }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity onPress={section.onSeeMore} style={styles.seeMoreBtn}>
        <Text style={[styles.seeMoreText, { color: palette.accent, fontSize: F.sm }]}>
          Voir plus
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Skeleton ───────────────────────────────────────────────────────────────

const CategoryShowcaseSkeleton: React.FC = () => {
  const palette = useLegacyPalette();
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <SkeletonLoader width="60%" height={18} style={{ marginBottom: 12 }} />
      <View style={styles.gridRow}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.gridCell}>
            <SkeletonLoader width={76} height={76} borderRadius={8} />
            <SkeletonLoader width={64} height={10} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
      <View style={[styles.gridRow, { marginTop: 6 }]}>
        {[2, 3].map((i) => (
          <View key={i} style={styles.gridCell}>
            <SkeletonLoader width={76} height={76} borderRadius={8} />
            <SkeletonLoader width={64} height={10} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
      <SkeletonLoader width={60} height={14} style={{ marginTop: 12 }} />
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

interface CategoryShowcaseProps {
  categories: string[];
  onNavigate: (category: string) => void;
}

interface CategoryProducts {
  category: string;
  items: ShowcaseItem[];
}

export const CategoryShowcase: React.FC<CategoryShowcaseProps> = ({ categories, onNavigate }) => {
  const [data, setData] = useState<CategoryProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const palette = useLegacyPalette();

  const navigation = useNavigation<any>();

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        setLoading(true);
        const results: CategoryProducts[] = [];
        
        // 1. Les plus vendus (Products)
        const topProducts = await productService.getAll(0, 4, 'sales');
        results.push({
          category: 'products_sales',
          items: (topProducts || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            subtitle: `${p.price} FCFA`,
            imageUrl: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : undefined,
          })),
        });

        // 2. Boutiques les plus visitées (Stores)
        const popularStores = await storeService.getPopularStores(4);
        results.push({
          category: 'stores_popular',
          items: (popularStores || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            subtitle: 'Populaire',
            imageUrl: s.logo_url || s.banner_url || undefined,
          })),
        });

        // 3. Nouvelles boutiques (Stores)
        const newStores = await storeService.getNewStores(4);
        results.push({
          category: 'stores_newest',
          items: (newStores || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            subtitle: 'Nouveau',
            imageUrl: s.logo_url || s.banner_url || undefined,
          })),
        });

        if (!cancelled) setData(results);
      } catch (err) {
        console.error('Highlights fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [categories.join(',')]);

  if (data.length === 0 && !loading) return null;

  const getTitle = (cat: string) => {
    switch (cat) {
      case 'products_sales': return 'Les plus vendus';
      case 'stores_popular': return 'Boutiques les plus visitées';
      case 'stores_newest': return 'Nouvelles boutiques';
      default: return 'Sélection';
    }
  };

  const handleSeeMore = (cat: string) => {
    if (cat === 'products_sales') {
      navigation.navigate('ClientAllProducts', { sort: 'sales' });
    } else if (cat === 'stores_popular') {
      navigation.navigate('ClientAllStores', { sort: 'score' });
    } else if (cat === 'stores_newest') {
      navigation.navigate('ClientAllStores', { sort: 'newest' });
    }
  };

  const handleItemPress = (cat: string, item: ShowcaseItem) => {
    if (cat === 'products_sales') {
      navigation.navigate('ProductDetail', { productId: item.id });
    } else {
      navigation.navigate('StoreDetail', { storeId: item.id });
    }
  };

  return (
    <View style={[styles.row, { backgroundColor: palette.bg }]}>
      {loading
        ? [0, 1, 2].map((i) => <CategoryShowcaseSkeleton key={i} />)
        : data.map((section, index) => (
          <CategoryShowcaseSectionCard
            key={section.category}
            section={{
              title: getTitle(section.category),
              category: section.category,
              items: section.items,
              onSeeMore: () => handleSeeMore(section.category),
              onItemPress: (item) => handleItemPress(section.category, item),
            }}
          />
        ))}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  card: {
    flex: 1,
    minWidth: 220,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
      : { elevation: 2 }),
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gridCell: {
    flex: 1,
  },
  gridItem: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemImage: {
    width: '100%',
    height: '100%',
  },
  gridItemEmoji: {
    fontSize: 22,
  },
  gridItemLabel: {
    marginTop: 3,
    fontWeight: '500',
  },
  gridItemPrice: {
    marginTop: 1,
  },
  seeMoreBtn: {
    marginTop: 10,
  },
  seeMoreText: {
    fontWeight: '600',
  },
});

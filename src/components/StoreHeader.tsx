import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useTheme } from '../hooks/useTheme';
import { openURL } from '../utils/platformUtils';

interface StoreHeaderProps {
  store: {
    id: string;
    name: string;
    category: string;
    logo_url?: string;
    banner_url?: string;
    description?: string;
    verified?: boolean;
    rating?: number;
    rating_count?: number;
    phone?: string;
    address?: string;
  };
  isFollowing?: boolean;
  onShare?: () => void;
  onContact?: () => void;
  onFollow?: () => void;
  onReport?: () => void;
  onDirections?: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  store,
  isFollowing,
  onShare,
  onContact,
  onFollow,
  onReport,
  onDirections,
}) => {
  const { getColor: COLORS, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(COLORS, isDark), [COLORS, isDark]);
  const rating = store.rating || 0;
  const ratingCount = store.rating_count || 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerTopRow}>
        {!!store.logo_url && (
          <Image
            source={{ uri: store.logo_url }}
            style={styles.logo}
            resizeMode="cover"
          />
        )}
        <View style={styles.storeInfo}>
          <Text style={styles.storeName}>{store.name}</Text>
          <View style={styles.storeMeta}>
            {rating > 0 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaText}>⭐ {rating.toFixed(1)} · {ratingCount} avis</Text>
              </View>
            )}
            <View style={styles.badgeOpen}>
              <Text style={styles.badgeOpenText}>🟢 Ouvert maintenant</Text>
            </View>
            {!!store.address && (
              <View style={styles.metaItem}>
                <Text style={styles.metaText}>📍 {store.address}</Text>
              </View>
            )}
            {!!store.phone && (
              <View style={styles.metaItem}>
                <Text style={styles.metaText}>📞 {store.phone}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onContact}>
          <Text style={styles.btnPrimaryText}>📩 Contacter</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.btn} onPress={onFollow}>
          <Text style={styles.btnText}>{isFollowing ? '✅ Suivi' : '➕ Suivre'}</Text>
        </TouchableOpacity>
        
        {onShare && (
          <TouchableOpacity style={styles.btn} onPress={onShare}>
            <Text style={styles.btnText}>↗️ Partager</Text>
          </TouchableOpacity>
        )}
        
        {onReport && (
          <TouchableOpacity style={styles.btn} onPress={onReport}>
            <Text style={styles.btnText}>🚩 Signaler</Text>
          </TouchableOpacity>
        )}
        
        {onDirections && store.address && (
          <TouchableOpacity style={styles.btn} onPress={onDirections}>
            <Text style={styles.btnText}>📍 Itinéraire</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const getStyles = (COLORS: any, isDark: boolean) => StyleSheet.create({
  container: {
    padding: SPACING.xl,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.xl,
    ...Platform.select({
      web: {
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.04)',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      }
    })
  },
  headerTopRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xl,
    minWidth: 280,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  storeMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: COLORS.textSoft,
    fontSize: 15,
  },
  badgeOpen: {
    backgroundColor: isDark ? 'rgba(21, 128, 61, 0.2)' : '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeOpenText: {
    color: isDark ? '#4ade80' : '#15803d',
    fontWeight: '600',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  btnText: {
    color: COLORS.text,
    fontWeight: '500',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    borderWidth: 0,
    ...Platform.select({
      web: {
        boxShadow: `0 4px 12px ${COLORS.accent}40`,
      }
    })
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});

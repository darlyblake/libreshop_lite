import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type Product } from '../../types/product';

type Props = {
  item: Product;
  accentColor: string;
  onEdit: (item: Product) => void;
  onToggleAvailable: (item: Product) => void;
  onDelete: (item: Product) => void;
};

export const MenuItemCard: React.FC<Props> = ({
  item,
  accentColor,
  onEdit,
  onToggleAvailable,
  onDelete,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const cardBg = isDark ? '#1e1e1e' : '#fff';
  const nameTxtColor = isDark ? '#f1f1f1' : '#1a1a1a';
  const descTxtColor = isDark ? '#aaa' : '#888';

  const imageUrl = item.images?.[0] ?? null;
  const isAvailable = item.is_active;

  const handleDelete = () => {
    Alert.alert(
      'Supprimer ce plat ?',
      `"${item.name}" sera retiré de la carte.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(item) },
      ]
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Photo */}
      <View style={styles.imageBox}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: accentColor + '20' }]}>
            <Text style={styles.imagePlaceholderEmoji}>🍽️</Text>
          </View>
        )}
        {/* Badge disponibilité */}
        <View style={[styles.availBadge, { backgroundColor: isAvailable ? '#22c55e' : '#ef4444' }]}>
          <Text style={styles.availBadgeText}>{isAvailable ? 'Dispo' : 'Épuisé'}</Text>
        </View>
      </View>

      {/* Infos */}
      <View style={styles.info}>
        <Text style={[styles.name, { color: nameTxtColor }]} numberOfLines={2}>{item.name}</Text>
        {item.description ? (
          <Text style={[styles.description, { color: descTxtColor }]} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: accentColor }]}>
            {Number(item.price).toLocaleString('fr-FR')} FCFA
          </Text>
          {item.attributes?.prep_time ? (
            <View style={styles.prepTime}>
              <Ionicons name="time-outline" size={11} color="#888" />
              <Text style={styles.prepTimeText}>{item.attributes.prep_time} min</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: accentColor + '15' }]}
          onPress={() => onEdit(item)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="pencil" size={16} color={accentColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isAvailable ? '#22c55e15' : '#f9731615' },
          ]}
          onPress={() => onToggleAvailable(item)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name={isAvailable ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={isAvailable ? '#22c55e' : '#f97316'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#ef444415' }]}
          onPress={handleDelete}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="trash" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  imageBox: {
    width: 90,
    height: 90,
    position: 'relative',
  },
  image: {
    width: 90,
    height: 90,
  },
  imagePlaceholder: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderEmoji: {
    fontSize: 32,
  },
  availBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  availBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 18,
  },
  description: {
    fontSize: 11,
    color: '#888',
    lineHeight: 15,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
  },
  prepTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  prepTimeText: {
    fontSize: 10,
    color: '#888',
  },
  actions: {
    flexDirection: 'column',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingRight: 10,
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

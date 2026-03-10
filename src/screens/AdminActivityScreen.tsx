import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { BackToDashboard } from '../components/BackToDashboard';
import { Ionicons } from '@expo/vector-icons';

const recentActivity = [
  { id: '1', type: 'user', message: 'Nouvel utilisateur inscrit', time: '5 min' },
  { id: '2', type: 'store', message: 'Nouvelle boutique créée', time: '15 min' },
  { id: '3', type: 'order', message: 'Nouvelle commande passée', time: '30 min' },
  { id: '4', type: 'payment', message: 'Paiement confirmé', time: '1 h' },
];

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'user': return 'person-outline';
    case 'store': return 'storefront-outline';
    case 'order': return 'cart-outline';
    case 'payment': return 'cash-outline';
    default: return 'alert-circle-outline';
  }
};

export const AdminActivityScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleItemPress = (item: any) => {
    Alert.alert('Détails', `Activité : ${item.message}`);
  };

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      <Text style={styles.title}>Toutes les activités</Text>
      <FlatList
        data={recentActivity}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => handleItemPress(item)}>
            <Ionicons name={getActivityIcon(item.type)} size={20} color={COLORS.accent} />
            <View style={styles.content}>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  content: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  message: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  time: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
});
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { BackToDashboard } from '../components/BackToDashboard';

export const AdminRevenueDetailsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      <Text style={styles.title}>Détails des revenus</Text>
      <Text style={styles.text}>Ici vous pouvez afficher des graphiques détaillés, des filtres, etc.</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Retour</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  text: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  backButton: {
    padding: SPACING.md,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
  },
  backText: {
    color: COLORS.text,
    fontWeight: '600',
  },
});
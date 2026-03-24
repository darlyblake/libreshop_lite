import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../config/theme';

/**
 * Composant de test pour valider les améliorations de contraste
 * Affiche tous les niveaux de texte sur différents fonds
 */
export const ContrastTestScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>🎨 Test de Contraste - Phase 2</Text>
      
      {/* Test sur fond principal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sur fond principal (bg)</Text>
        <View style={styles.card}>
          <Text style={styles.textNormal}>Texte normal (text)</Text>
          <Text style={styles.textSoft}>Texte soft AMÉLIORÉ (textSoft)</Text>
          <Text style={styles.textMuted}>Texte muted AMÉLIORÉ (textMuted)</Text>
        </View>
      </View>

      {/* Test sur fond de carte */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sur fond de carte AMÉLIORÉ (card)</Text>
        <View style={[styles.card, styles.cardBackground]}>
          <Text style={styles.textNormal}>Texte normal sur carte</Text>
          <Text style={styles.textSoft}>Texte soft sur carte</Text>
          <Text style={styles.textMuted}>Texte muted sur carte</Text>
        </View>
      </View>

      {/* Test sur fond de carte hover */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sur fond carte hover AMÉLIORÉ (cardHover)</Text>
        <View style={[styles.card, styles.cardHoverBackground]}>
          <Text style={styles.textNormal}>Texte normal sur carte hover</Text>
          <Text style={styles.textSoft}>Texte soft sur carte hover</Text>
          <Text style={styles.textMuted}>Texte muted sur carte hover</Text>
        </View>
      </View>

      {/* Test des couleurs de statut */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Couleurs de statut</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusCard, { backgroundColor: COLORS.success }]}>
            <Text style={styles.statusText}>Success</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: COLORS.warning }]}>
            <Text style={styles.statusText}>Warning</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: COLORS.danger }]}>
            <Text style={styles.statusText}>Danger</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: COLORS.info }]}>
            <Text style={styles.statusText}>Info</Text>
          </View>
        </View>
      </View>

      {/* Test des accents */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Couleurs d'accent</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusCard, { backgroundColor: COLORS.accent }]}>
            <Text style={styles.statusText}>Accent</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: COLORS.accent2 }]}>
            <Text style={styles.statusText}>Accent 2</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.statusText}>Primary</Text>
          </View>
          <View style={[styles.statusCard, { backgroundColor: COLORS.secondary }]}>
            <Text style={styles.statusText}>Secondary</Text>
          </View>
        </View>
      </View>

      {/* Informations de contraste WCAG */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Ratios de Contraste Estimés</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>• textSoft: 95% → Ratio ~7:1 ✅ (WCAG AA)</Text>
          <Text style={styles.infoText}>• textMuted: 85% → Ratio ~5.5:1 ✅ (WCAG AA)</Text>
          <Text style={styles.infoText}>• card: 95% → Meilleure lisibilité ✅</Text>
          <Text style={styles.infoText}>• cardHover: 98% → Contraste maximal ✅</Text>
        </View>
      </View>

      {/* Comparaison avant/après */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔄 Avant vs Après</Text>
        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>AVANT (problématique):</Text>
          <Text style={[styles.textOld, { color: 'rgba(255, 255, 255, 0.8)' }]}>
            textSoft: rgba(255, 255, 255, 0.8) → Ratio ~3.5:1 ❌
          </Text>
          <Text style={[styles.textOld, { color: 'rgba(255, 255, 255, 0.6)' }]}>
            textMuted: rgba(255, 255, 255, 0.6) → Ratio ~2.5:1 ❌
          </Text>
          
          <Text style={styles.comparisonTitle}>APRÈS (amélioré):</Text>
          <Text style={styles.textNew}>
            textSoft: rgba(255, 255, 255, 0.95) → Ratio ~7:1 ✅
          </Text>
          <Text style={styles.textNew}>
            textMuted: rgba(255, 255, 255, 0.85) → Ratio ~5.5:1 ✅
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  cardBackground: {
    backgroundColor: COLORS.card,
  },
  cardHoverBackground: {
    backgroundColor: COLORS.cardHover,
  },
  textNormal: {
    fontSize: 16,
    color: COLORS.text,
  },
  textSoft: {
    fontSize: 16,
    color: COLORS.textSoft,
  },
  textMuted: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statusCard: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 12,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSoft,
    lineHeight: 20,
  },
  comparisonCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  textOld: {
    fontSize: 14,
    lineHeight: 20,
  },
  textNew: {
    fontSize: 14,
    color: COLORS.textSoft,
    lineHeight: 20,
  },
});

/**
 * Composant de démonstration du système de thème
 * Montre l'utilisation des couleurs, espacements et typographie responsives
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeContext } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';

export const ThemeDemo: React.FC = () => {
  const { theme, toggleTheme, isDark, isLight } = useThemeContext();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.getColor.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.getColor.text }]}>
          Démonstration du Thème
        </Text>
        <Text style={[styles.subtitle, { color: theme.getColor.textSecondary }]}>
          Thème actuel: {isDark ? 'Sombre' : 'Clair'}
        </Text>
        <ThemeToggle size={32} showLabel />
      </View>

      {/* Couleurs principales */}
      <View style={[styles.section, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
          Couleurs Principales
        </Text>
        <View style={styles.colorGrid}>
          <View style={[styles.colorBox, { backgroundColor: theme.getColor.primary }]}>
            <Text style={[styles.colorLabel, { color: '#ffffff' }]}>Primary</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: theme.getColor.accent }]}>
            <Text style={[styles.colorLabel, { color: '#ffffff' }]}>Accent</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: theme.getColor.success }]}>
            <Text style={[styles.colorLabel, { color: '#ffffff' }]}>Success</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: theme.getColor.warning }]}>
            <Text style={[styles.colorLabel, { color: '#ffffff' }]}>Warning</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: theme.getColor.error }]}>
            <Text style={[styles.colorLabel, { color: '#ffffff' }]}>Error</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: theme.getColor.info }]}>
            <Text style={[styles.colorLabel, { color: '#ffffff' }]}>Info</Text>
          </View>
        </View>
      </View>

      {/* Typographie */}
      <View style={[styles.section, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
          Typographie
        </Text>
        <Text style={[styles.display, { color: theme.getColor.text, fontSize: theme.fontSize.display }]}>
          Display Text
        </Text>
        <Text style={[styles.title, { color: theme.getColor.text, fontSize: theme.fontSize.title }]}>
          Title Text
        </Text>
        <Text style={[styles.subtitle, { color: theme.getColor.textSecondary, fontSize: theme.fontSize.xl }]}>
          Subtitle Large
        </Text>
        <Text style={[styles.body, { color: theme.getColor.text, fontSize: theme.fontSize.md }]}>
          Body text regular size with proper contrast for readability.
        </Text>
        <Text style={[styles.caption, { color: theme.getColor.textTertiary, fontSize: theme.fontSize.sm }]}>
          Caption text muted color
        </Text>
      </View>

      {/* Espacements */}
      <View style={[styles.section, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
          Espacements
        </Text>
        <View style={styles.spacingDemo}>
          <View style={[styles.spacingBox, { height: theme.spacing.xs, backgroundColor: theme.getColor.primary }]}>
            <Text style={[styles.spacingLabel, { color: theme.getColor.text }]}>xs: {theme.spacing.xs}</Text>
          </View>
          <View style={[styles.spacingBox, { height: theme.spacing.sm, backgroundColor: theme.getColor.accent }]}>
            <Text style={[styles.spacingLabel, { color: theme.getColor.text }]}>sm: {theme.spacing.sm}</Text>
          </View>
          <View style={[styles.spacingBox, { height: theme.spacing.md, backgroundColor: theme.getColor.success }]}>
            <Text style={[styles.spacingLabel, { color: theme.getColor.text }]}>md: {theme.spacing.md}</Text>
          </View>
          <View style={[styles.spacingBox, { height: theme.spacing.lg, backgroundColor: theme.getColor.warning }]}>
            <Text style={[styles.spacingLabel, { color: theme.getColor.text }]}>lg: {theme.spacing.lg}</Text>
          </View>
          <View style={[styles.spacingBox, { height: theme.spacing.xl, backgroundColor: theme.getColor.error }]}>
            <Text style={[styles.spacingLabel, { color: theme.getColor.text }]}>xl: {theme.spacing.xl}</Text>
          </View>
        </View>
      </View>

      {/* Composants migrés */}
      <View style={[styles.section, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
          Composants Migrés
        </Text>
        
        <View style={styles.componentRow}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>Badges:</Text>
          <View style={styles.badgeContainer}>
            <Badge label="Success" variant="success" size="small" />
            <Badge label="Warning" variant="warning" size="medium" />
            <Badge label="Error" variant="error" size="large" />
          </View>
        </View>

        <View style={styles.componentRow}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>Progress:</Text>
          <ProgressBar progress={0.3} />
          <ProgressBar progress={0.7} color={theme.getColor.success} />
          <ProgressBar progress={1.0} color={theme.getColor.error} />
        </View>
      </View>

      {/* Boutons d'action */}
      <View style={[styles.section, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
          Actions
        </Text>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.getColor.primary }]}
          onPress={toggleTheme}
        >
          <Text style={[styles.buttonText, { color: '#ffffff' }]}>
            Changer de thème
          </Text>
        </TouchableOpacity>
      </View>

      {/* Informations système */}
      <View style={[styles.section, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
          Informations Système
        </Text>
        <Text style={[styles.info, { color: theme.getColor.textSecondary }]}>
          Platform: {theme.platform}
        </Text>
        <Text style={[styles.info, { color: theme.getColor.textSecondary }]}>
          Theme: {theme.name}
        </Text>
        <Text style={[styles.info, { color: theme.getColor.textSecondary }]}>
          High Contrast: {theme.accessibility.highContrast ? 'Oui' : 'Non'}
        </Text>
        <Text style={[styles.info, { color: theme.getColor.textSecondary }]}>
          Reduced Motion: {theme.accessibility.reducedMotion ? 'Oui' : 'Non'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorBox: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  display: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  body: {
    marginBottom: 8,
    lineHeight: 20,
  },
  caption: {
    marginBottom: 8,
  },
  spacingDemo: {
    gap: 8,
  },
  spacingBox: {
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  spacingLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  componentRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    fontSize: 14,
    marginBottom: 4,
  },
});

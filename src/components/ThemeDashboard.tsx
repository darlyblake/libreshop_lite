/**
 * Composant de tableau de bord avancé pour les thèmes
 * Affiche les métriques de performance, l'état de l'IA et la synchronisation cloud
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useThemeContext } from '../context/ThemeContext';
import { useIntegratedTheme } from '../hooks/useIntegratedTheme';
import { ThemeToggle } from './ThemeToggle';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';

interface ThemeDashboardProps {
  userId: string;
  onClose?: () => void;
}

export const ThemeDashboard: React.FC<ThemeDashboardProps> = ({ userId, onClose }) => {
  const { theme } = useThemeContext();
  const integratedTheme = useIntegratedTheme(userId);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'ai' | 'sync'>('overview');
  const [isExpanded, setIsExpanded] = useState(false);

  // Rafraîchir les données
  useEffect(() => {
    const interval = setInterval(() => {
      // Mettre à jour les métriques
      integratedTheme.performance.updateFPS();
    }, 1000);

    return () => clearInterval(interval);
  }, [integratedTheme.performance]);

  // Appliquer une suggestion IA
  const handleApplyAISuggestion = async () => {
    if (integratedTheme.ai.suggestion) {
      const success = integratedTheme.ai.applySuggestion();
      if (success) {
        Alert.alert('Succès', 'Suggestion IA appliquée avec succès!');
      } else {
        Alert.alert('Erreur', 'Impossible d\'appliquer la suggestion');
      }
    }
  };

  // Forcer la synchronisation
  const handleForceSync = async () => {
    try {
      const success = await integratedTheme.sync.forceSync();
      Alert.alert(
        success ? 'Succès' : 'Erreur',
        success ? 'Synchronisation réussie!' : 'Échec de la synchronisation'
      );
    } catch (error) {
      Alert.alert('Erreur', 'Erreur lors de la synchronisation');
    }
  };

  // Effacer les données
  const handleClearData = () => {
    Alert.alert(
      'Confirmation',
      'Voulez-vous effacer toutes les données de thème?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: () => {
            integratedTheme.sync.clearData();
            Alert.alert('Succès', 'Données effacées');
          },
        },
      ]
    );
  };

  // Rendre l'onglet Vue d'ensemble
  const renderOverview = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
        Vue d'ensemble
      </Text>
      
      <View style={[styles.card, { backgroundColor: theme.getColor.card }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            Thème actuel:
          </Text>
          <Text style={[styles.value, { color: theme.getColor.text }]}>
            {integratedTheme.themeName.toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            Plateforme:
          </Text>
          <Text style={[styles.value, { color: theme.getColor.text }]}>
            {integratedTheme.theme.platform}
          </Text>
        </View>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            Synchronisation:
          </Text>
          <Badge 
            label={integratedTheme.sync.isOnline ? 'En ligne' : 'Hors ligne'} 
            variant={integratedTheme.sync.isOnline ? 'success' : 'error'}
            size="small"
          />
        </View>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            IA:
          </Text>
          <Badge 
            label={integratedTheme.ai.isLearning ? 'Apprentissage' : 'Inactif'} 
            variant={integratedTheme.ai.isLearning ? 'info' : 'default'}
            size="small"
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.cardTitle, { color: theme.getColor.text }]}>
          Actions rapides
        </Text>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.getColor.primary }]}
          onPress={() => integratedTheme.toggleTheme()}
        >
          <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
            Changer de thème
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.getColor.accent }]}
          onPress={handleForceSync}
        >
          <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
            Synchroniser maintenant
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.getColor.warning }]}
          onPress={handleClearData}
        >
          <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
            Effacer les données
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Rendre l'onglet Performance
  const renderPerformance = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
        Performance
      </Text>
      
      <View style={[styles.card, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.cardTitle, { color: theme.getColor.text }]}>
          Métriques en temps réel
        </Text>
        
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: theme.getColor.textSecondary }]}>
            FPS:
          </Text>
          <Text style={[styles.metricValue, { color: theme.getColor.text }]}>
            {integratedTheme.performance.metrics.fps}
          </Text>
          <ProgressBar 
            progress={integratedTheme.performance.metrics.fps / 60}
            color={integratedTheme.performance.metrics.fps >= 55 ? theme.getColor.success : theme.getColor.error}
          />
        </View>
        
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: theme.getColor.textSecondary }]}>
            Temps de rendu:
          </Text>
          <Text style={[styles.metricValue, { color: theme.getColor.text }]}>
            {integratedTheme.performance.metrics.renderTime.toFixed(2)}ms
          </Text>
        </View>
        
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: theme.getColor.textSecondary }]}>
            Cache hit rate:
          </Text>
          <Text style={[styles.metricValue, { color: theme.getColor.text }]}>
            {integratedTheme.performance.metrics.cacheHitRate.toFixed(1)}%
          </Text>
          <ProgressBar 
            progress={integratedTheme.performance.metrics.cacheHitRate / 100}
            color={theme.getColor.info}
          />
        </View>
        
        <View style={styles.metricRow}>
          <Text style={[styles.metricLabel, { color: theme.getColor.textSecondary }]}>
            Mémoire:
          </Text>
          <Text style={[styles.metricValue, { color: theme.getColor.text }]}>
            {integratedTheme.performance.metrics.memoryUsage}MB
          </Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: theme.getColor.info }]}
        onPress={() => {
          const report = integratedTheme.performance.report();
          Alert.alert('Rapport de Performance', report);
        }}
      >
        <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
          Voir le rapport complet
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Rendre l'onglet IA
  const renderAI = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
        Intelligence Artificielle
      </Text>
      
      <View style={[styles.card, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.cardTitle, { color: theme.getColor.text }]}>
          Statistiques d'apprentissage
        </Text>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            Points de données:
          </Text>
          <Text style={[styles.value, { color: theme.getColor.text }]}>
            {integratedTheme.ai.stats.dataPoints}
          </Text>
        </View>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            Précision:
          </Text>
          <Text style={[styles.value, { color: theme.getColor.text }]}>
            {integratedTheme.ai.stats.accuracy ? `${(integratedTheme.ai.stats.accuracy * 100).toFixed(1)}%` : 'N/A'}
          </Text>
        </View>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            Adaptations:
          </Text>
          <Text style={[styles.value, { color: theme.getColor.text }]}>
            {integratedTheme.ai.stats.adaptationCount}
          </Text>
        </View>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            Modèle prêt:
          </Text>
          <Badge 
            label={integratedTheme.ai.isModelReady ? 'Oui' : 'Non'} 
            variant={integratedTheme.ai.isModelReady ? 'success' : 'warning'}
            size="small"
          />
        </View>
      </View>
      
      {integratedTheme.ai.suggestion && (
        <View style={[styles.card, { backgroundColor: theme.getColor.card }]}>
          <Text style={[styles.cardTitle, { color: theme.getColor.text }]}>
            Suggestion actuelle
          </Text>
          
          <View style={styles.suggestionBox}>
            <Text style={[styles.suggestionText, { color: theme.getColor.text }]}>
              Thème recommandé: {integratedTheme.ai.suggestion.recommendedTheme.toUpperCase()}
            </Text>
            <Text style={[styles.suggestionReason, { color: theme.getColor.textSecondary }]}>
              {integratedTheme.ai.suggestion.reason}
            </Text>
            <Text style={[styles.suggestionConfidence, { color: theme.getColor.info }]}>
              Confiance: {(integratedTheme.ai.suggestion.confidence * 100).toFixed(1)}%
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.getColor.success }]}
            onPress={handleApplyAISuggestion}
            disabled={!integratedTheme.ai.canApplySuggestion}
          >
            <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
              Appliquer la suggestion
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: theme.getColor.accent }]}
        onPress={() => integratedTheme.ai.predict()}
      >
        <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
          Nouvelle prédiction
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Rendre l'onglet Synchronisation
  const renderSync = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.getColor.text }]}>
        Synchronisation Cloud
      </Text>
      
      <View style={[styles.card, { backgroundColor: theme.getColor.card }]}>
        <Text style={[styles.cardTitle, { color: theme.getColor.text }]}>
          État de la synchronisation
        </Text>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            Statut:
          </Text>
          <Badge 
            label={integratedTheme.sync.isSyncing ? 'En cours' : 'Inactif'} 
            variant={integratedTheme.sync.isSyncing ? 'warning' : 'default'}
            size="small"
          />
        </View>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            Dernière sync:
          </Text>
          <Text style={[styles.value, { color: theme.getColor.text }]}>
            {integratedTheme.sync.lastSync 
              ? new Date(integratedTheme.sync.lastSync).toLocaleString()
              : 'Jamais'
            }
          </Text>
        </View>
        
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.getColor.textSecondary }]}>
            En attente:
          </Text>
          <Text style={[styles.value, { color: theme.getColor.text }]}>
            {integratedTheme.sync.status.pendingChanges}
          </Text>
        </View>
        
        {integratedTheme.sync.hasError && (
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.getColor.error }]}>
              Erreur:
            </Text>
            <Text style={[styles.value, { color: theme.getColor.error }]}>
              {integratedTheme.sync.error}
            </Text>
          </View>
        )}
      </View>
      
      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: theme.getColor.primary }]}
        onPress={handleForceSync}
        disabled={integratedTheme.sync.isSyncing}
      >
        <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
          {integratedTheme.sync.isSyncing ? 'Synchronisation...' : 'Forcer la synchronisation'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.getColor.background }]}>
      <View style={[styles.header, { backgroundColor: theme.getColor.card }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: theme.getColor.text }]}>
            Tableau de Bord Thème
          </Text>
          <ThemeToggle size={24} />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer}>
          {(['overview', 'performance', 'ai', 'sync'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                { 
                  backgroundColor: activeTab === tab ? theme.getColor.primary : theme.getColor.border,
                  borderColor: theme.getColor.border,
                }
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === tab ? '#ffffff' : theme.getColor.text }
              ]}>
                {tab === 'overview' && 'Vue d\'ensemble'}
                {tab === 'performance' && 'Performance'}
                {tab === 'ai' && 'IA'}
                {tab === 'sync' && 'Cloud'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'performance' && renderPerformance()}
        {activeTab === 'ai' && renderAI()}
        {activeTab === 'sync' && renderSync()}
      </ScrollView>
      
      {onClose && (
        <TouchableOpacity 
          style={[styles.closeButton, { backgroundColor: theme.getColor.error }]}
          onPress={onClose}
        >
          <Text style={[styles.closeButtonText, { color: '#ffffff' }]}>
            Fermer
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricRow: {
    marginBottom: 16,
  },
  metricLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  suggestionBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 12,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  suggestionReason: {
    fontSize: 12,
    marginBottom: 4,
  },
  suggestionConfidence: {
    fontSize: 12,
    fontWeight: '500',
  },
  closeButton: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

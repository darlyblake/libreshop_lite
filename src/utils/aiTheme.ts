/**
 * Hook d'intelligence artificielle pour les thèmes
 * Apprentissage des préférences utilisateur et suggestions intelligentes
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useThemeContext } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

interface UserPattern {
  timeOfDay: number;
  dayOfWeek: number;
  location?: { lat: number; lng: number };
  weather?: string;
  batteryLevel?: number;
  ambientLight?: number;
  userActivity: 'active' | 'idle';
  themeChoice: 'light' | 'dark' | 'amoled';
  timestamp: number;
}

interface ThemeSuggestion {
  recommendedTheme: 'light' | 'dark' | 'amoled';
  confidence: number;
  reason: string;
  factors: {
    timeOfDay: number;
    userActivity: number;
    ambientLight: number;
    batteryLevel: number;
    usagePattern: number;
  };
}

interface LearningConfig {
  enableLearning: boolean;
  minDataPoints: number;
  confidenceThreshold: number;
  adaptationRate: number;
  forgetFactor: number;
}

export const useAITheme = (config: LearningConfig = {
  enableLearning: true,
  minDataPoints: 10,
  confidenceThreshold: 0.7,
  adaptationRate: 0.1,
  forgetFactor: 0.95,
}) => {
  const { theme, toggleTheme, setThemeMode } = useThemeContext();
  const deviceTheme = useColorScheme();
  
  const [userPatterns, setUserPatterns] = useState<UserPattern[]>([]);
  const [suggestion, setSuggestion] = useState<ThemeSuggestion | null>(null);
  const [isLearning, setIsLearning] = useState(false);
  const [learningStats, setLearningStats] = useState({
    totalPatterns: 0,
    accuracy: 0,
    lastPrediction: null as string | null,
    adaptationCount: 0,
  });

  // Charger les patterns utilisateur depuis le stockage
  useEffect(() => {
    const loadUserPatterns = async () => {
      try {
        const stored = await AsyncStorage.getItem('@libreshop_theme_patterns');
        if (stored) {
          const patterns = JSON.parse(stored);
          setUserPatterns(patterns);
          setLearningStats(prev => ({ ...prev, totalPatterns: patterns.length }));
        }
      } catch (error) {
        console.error('Erreur chargement patterns:', error);
      }
    };

    if (config.enableLearning) {
      loadUserPatterns();
    }
  }, [config.enableLearning]);

  // Sauvegarder les patterns utilisateur
  const saveUserPatterns = useCallback(async (patterns: UserPattern[]) => {
    try {
      await AsyncStorage.setItem('@libreshop_theme_patterns', JSON.stringify(patterns));
    } catch (error) {
      console.error('Erreur sauvegarde patterns:', error);
    }
  }, []);

  // Enregistrer une action utilisateur
  const recordUserAction = useCallback((themeChoice: 'light' | 'dark' | 'amoled', context?: Partial<UserPattern>) => {
    if (!config.enableLearning) return;

    const now = new Date();
    const pattern: UserPattern = {
      timeOfDay: now.getHours() + now.getMinutes() / 60,
      dayOfWeek: now.getDay(),
      themeChoice,
      timestamp: Date.now(),
      userActivity: 'active',
      ...context,
    };

    setUserPatterns(prev => {
      const updated = [...prev, pattern];
      
      // Limiter la taille du stockage (garder les 1000 plus récents)
      if (updated.length > 1000) {
        return updated.slice(-1000);
      }
      
      saveUserPatterns(updated);
      setLearningStats(prev => ({ 
        ...prev, 
        totalPatterns: updated.length,
        adaptationCount: prev.adaptationCount + 1 
      }));
      
      return updated;
    });
  }, [config.enableLearning, saveUserPatterns]);

  // Analyser les patterns pour générer une suggestion
  const analyzePatterns = useCallback((): ThemeSuggestion | null => {
    if (!config.enableLearning || userPatterns.length < config.minDataPoints) {
      return null;
    }

    setIsLearning(true);

    try {
      const now = new Date();
      const currentTimeOfDay = now.getHours() + now.getMinutes() / 60;
      const currentDayOfWeek = now.getDay();

      // Filtrer les patterns similaires (même heure, même jour)
      const similarPatterns = userPatterns.filter(pattern => {
        const timeDiff = Math.abs(pattern.timeOfDay - currentTimeOfDay);
        const dayMatch = pattern.dayOfWeek === currentDayOfWeek;
        return timeDiff <= 2 && dayMatch;
      });

      if (similarPatterns.length === 0) {
        return null;
      }

      // Analyser les préférences pour ce contexte
      const themeCounts = similarPatterns.reduce((acc, pattern) => {
        acc[pattern.themeChoice] = (acc[pattern.themeChoice] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalSimilar = similarPatterns.length;
      const maxCount = Math.max(...Object.values(themeCounts));
      const recommendedTheme = Object.keys(themeCounts).find(
        theme => themeCounts[theme] === maxCount
      ) as 'light' | 'dark' | 'amoled';

      if (!recommendedTheme) {
        return null;
      }

      // Calculer la confiance
      const confidence = maxCount / totalSimilar;
      
      // Calculer les facteurs d'influence
      const factors = {
        timeOfDay: Math.max(0, 1 - Math.abs(currentTimeOfDay - 12) / 12), // Pic à midi
        userActivity: 0.8, // Supposer que l'utilisateur est actif
        ambientLight: 0.7, // Valeur par défaut
        batteryLevel: 0.5, // Valeur par défaut
        usagePattern: confidence,
      };

      // Générer une raison
      const reasons = [
        `Basé sur ${similarPatterns.length} utilisations similaires`,
        `Préférence de ${Math.round(confidence * 100)}% pour cette situation`,
        `Analyse des patterns de ${userPatterns.length} jours`,
      ];

      const suggestion: ThemeSuggestion = {
        recommendedTheme,
        confidence,
        reason: reasons.join('. '),
        factors,
      };

      setSuggestion(suggestion);
      return suggestion;

    } catch (error) {
      console.error('Erreur analyse patterns:', error);
      return null;
    } finally {
      setIsLearning(false);
    }
  }, [config.enableLearning, config.minDataPoints, userPatterns]);

  // Prédire le thème optimal
  const predictOptimalTheme = useCallback((): ThemeSuggestion | null => {
    if (!config.enableLearning) return null;

    // Analyser les patterns existants
    const suggestion = analyzePatterns();
    
    if (suggestion && suggestion.confidence >= config.confidenceThreshold) {
      setLearningStats(prev => ({ 
        ...prev, 
        lastPrediction: suggestion.recommendedTheme,
        accuracy: suggestion.confidence 
      }));
      return suggestion;
    }

    // Fallback vers des heuristiques simples
    const hour = new Date().getHours();
    let recommendedTheme: 'light' | 'dark' | 'amoled';
    let reason: string;
    let confidence: number;

    if (hour >= 19 || hour <= 6) {
      recommendedTheme = 'dark';
      reason = 'Heure nocturne détectée';
      confidence = 0.8;
    } else if (hour >= 6 && hour <= 18) {
      recommendedTheme = 'light';
      reason = 'Heure diurne détectée';
      confidence = 0.8;
    } else {
      recommendedTheme = deviceTheme || 'light';
      reason = 'Préférence système';
      confidence = 0.6;
    }

    const fallbackSuggestion: ThemeSuggestion = {
      recommendedTheme,
      confidence,
      reason,
      factors: {
        timeOfDay: 0.9,
        userActivity: 0.5,
        ambientLight: 0.5,
        batteryLevel: 0.3,
        usagePattern: 0.2,
      },
    };

    setSuggestion(fallbackSuggestion);
    return fallbackSuggestion;
  }, [config.enableLearning, config.confidenceThreshold, analyzePatterns, deviceTheme]);

  // Appliquer automatiquement la suggestion
  const applySuggestion = useCallback(() => {
    if (!suggestion || suggestion.confidence < config.confidenceThreshold) {
      return false;
    }

    setThemeMode(suggestion.recommendedTheme);
    recordUserAction(suggestion.recommendedTheme);
    return true;
  }, [suggestion, config.confidenceThreshold, setThemeMode, recordUserAction]);

  // Entraîner le modèle avec les données récentes
  const trainModel = useCallback(() => {
    if (!config.enableLearning || userPatterns.length < config.minDataPoints) {
      return false;
    }

    setIsLearning(true);

    try {
      // Simuler l'entraînement du modèle
      // Dans une vraie implémentation, ceci utiliserait un vrai ML
      const updatedPatterns = userPatterns.map(pattern => ({
        ...pattern,
        // Appliquer le facteur d'oubli pour les anciennes données
        weight: pattern.timestamp > Date.now() - (7 * 24 * 60 * 60 * 1000) ? 1 : config.forgetFactor,
      }));

      setUserPatterns(updatedPatterns);
      setLearningStats(prev => ({ ...prev, adaptationCount: prev.adaptationCount + 1 }));

      return true;
    } catch (error) {
      console.error('Erreur entraînement modèle:', error);
      return false;
    } finally {
      setIsLearning(false);
    }
  }, [config.enableLearning, config.minDataPoints, userPatterns, config.forgetFactor]);

  // Obtenir des statistiques d'apprentissage
  const getLearningStats = useMemo(() => ({
    ...learningStats,
    isLearning,
    hasEnoughData: userPatterns.length >= config.minDataPoints,
    dataPoints: userPatterns.length,
    learningEnabled: config.enableLearning,
  }), [learningStats, isLearning, userPatterns.length, config.minDataPoints, config.enableLearning]);

  // Effacer les données d'apprentissage
  const clearLearningData = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('@libreshop_theme_patterns');
      setUserPatterns([]);
      setSuggestion(null);
      setLearningStats({
        totalPatterns: 0,
        accuracy: 0,
        lastPrediction: null,
        adaptationCount: 0,
      });
    } catch (error) {
      console.error('Erreur suppression données:', error);
    }
  }, []);

  // Analyser automatiquement et suggérer
  useEffect(() => {
    if (config.enableLearning && userPatterns.length >= config.minDataPoints) {
      const timer = setTimeout(() => {
        predictOptimalTheme();
      }, 1000); // Délai pour éviter les calculs excessifs

      return () => clearTimeout(timer);
    }
  }, [config.enableLearning, userPatterns.length, config.minDataPoints, predictOptimalTheme]);

  return {
    // État
    suggestion,
    isLearning,
    learningStats: getLearningStats,
    
    // Actions
    recordUserAction,
    predictOptimalTheme,
    applySuggestion,
    trainModel,
    clearLearningData,
    
    // Utilitaires
    hasSuggestion: !!suggestion,
    canApplySuggestion: suggestion?.confidence >= config.confidenceThreshold,
    isModelReady: userPatterns.length >= config.minDataPoints,
  };
};

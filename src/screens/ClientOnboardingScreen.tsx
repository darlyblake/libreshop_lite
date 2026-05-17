import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { onboardingStorage } from '../lib/storage';

const { width, height } = Dimensions.get('window');

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  gradient: [string, string];
}

const SLIDES: Slide[] = [
  {
    icon: 'heart-half-outline',
    title: 'Soutenir le commerce local',
    description: 'Découvrez et encouragez les producteurs, créateurs et artisans près de chez vous en Afrique Centrale.',
    gradient: ['#6D28D9', '#4C1D95'], // Deep violet
  },
  {
    icon: 'bicycle-outline',
    title: 'Livraison rapide',
    description: 'Profitez d’une expédition simplifiée, rapide et abordable de la boutique directement à votre porte.',
    gradient: ['#EC4899', '#BE185D'], // Deep pink
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Achetez en toute confiance',
    description: 'Sécurité totale des transactions mobile money et profil de boutiques rigoureusement certifiées.',
    gradient: ['#06B6D4', '#0891B2'], // Vivid cyan
  },
];

export const ClientOnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const handleNext = async () => {
    if (currentSlideIndex < SLIDES.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    try {
      await onboardingStorage.setOnboardingCompleted(true);
    } catch (e) {
      console.warn('Failed to save onboarding completed status:', e);
    }
    navigation.replace('ClientTabs');
  };

  const currentSlide = SLIDES[currentSlideIndex];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Background Gradient matching current slide theme */}
      <LinearGradient
        colors={currentSlide.gradient}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative background glow circles */}
      <View style={styles.glowCircle1} />
      <View style={styles.glowCircle2} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header Bar */}
        <View style={styles.header}>
          <Text style={styles.brandText}>LibreShop</Text>
          <TouchableOpacity onPress={handleFinish} style={styles.skipButton} activeOpacity={0.8}>
            <Text style={styles.skipText}>Passer</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>
        </View>

        {/* Content Box (Glassmorphic) */}
        <View style={styles.cardContainer}>
          <View style={styles.glassCard}>
            <View style={styles.iconContainer}>
              <Ionicons name={currentSlide.icon} size={64} color="#FFFFFF" />
            </View>

            <Text style={styles.title}>{currentSlide.title}</Text>
            <Text style={styles.description}>{currentSlide.description}</Text>
          </View>
        </View>

        {/* Footer Area */}
        <View style={styles.footer}>
          {/* Pagination Indicators */}
          <View style={styles.indicatorsContainer}>
            {SLIDES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  index === currentSlideIndex && styles.indicatorActive,
                ]}
              />
            ))}
          </View>

          {/* Action Button */}
          <TouchableOpacity onPress={handleNext} style={styles.actionButton} activeOpacity={0.9}>
            <LinearGradient
              colors={['#FFFFFF', '#F3F4F6']}
              style={styles.actionButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Text style={styles.actionButtonText}>
                {currentSlideIndex === SLIDES.length - 1 ? 'Commencer' : 'Suivant'}
              </Text>
              <Ionicons
                name={currentSlideIndex === SLIDES.length - 1 ? 'rocket' : 'arrow-forward'}
                size={18}
                color="#4C1D95"
                style={styles.actionButtonIcon}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1B4B',
    overflow: 'hidden', // Empêche tout débordement ou barre de défilement horizontal sur PC
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'android' ? 40 : SPACING.md,
    width: '100%',
    maxWidth: 600, // Limite la largeur sur PC pour garder le header élégant
  },
  brandText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  skipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 2,
  },
  glowCircle1: {
    position: 'absolute',
    top: 100,
    left: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  glowCircle2: {
    position: 'absolute',
    bottom: 150,
    right: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    width: '100%',
  },
  glassCard: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
    borderRadius: 32,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 28,
  },
  description: {
    fontSize: FONT_SIZE.md,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.lg,
    width: '100%',
    maxWidth: 600, // Limite la largeur sur PC pour garder le footer élégant
  },
  indicatorsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  indicatorActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  actionButton: {
    width: '100%',
    maxWidth: 450,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  actionButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  actionButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#4C1D95',
  },
  actionButtonIcon: {
    marginLeft: SPACING.xs,
  },
});

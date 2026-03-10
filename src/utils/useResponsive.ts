import { Dimensions, Platform, PixelRatio, StatusBar } from 'react-native';
import { useMemo, useEffect, useState } from 'react';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Points de rupture pour tous les appareils
const BREAKPOINTS = {
  // Mobile
  xs: 0,      // 0-375px (iPhone SE)
  sm: 376,    // 376-414px (iPhone 12/13)
  md: 415,    // 415-480px (iPhone Plus/Max)
  lg: 481,    // 481-600px (Petits mobiles Android)
  xl: 601,    // 601-768px (Grands mobiles Android)
  // Tablet
  tablet: 769, // 769-1024px (Petites tablettes)
  largeTablet: 1025, // 1025-1366px (Grandes tablettes)
  // Desktop
  desktop: 1367, // 1366-1920px (Desktop standard)
  largeDesktop: 1921, // 1920px+ (Grands écrans)
};

// Types d'orientation
const ORIENTATION = {
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
} as const;

// Facteurs d'échelle de base par type d'appareil
const SCALE_FACTORS = {
  xs: 0.8,
  sm: 0.85,
  md: 0.9,
  lg: 0.95,
  xl: 1.0,
  tablet: 1.1,
  largeTablet: 1.2,
  desktop: 1.3,
  largeDesktop: 1.4,
};

// Configuration des grilles par type d'appareil
const GRID_CONFIG = {
  xs: { columns: 1, gutter: 12 },
  sm: { columns: 1, gutter: 12 },
  md: { columns: 1, gutter: 16 },
  lg: { columns: 1, gutter: 16 },
  xl: { columns: 2, gutter: 16 },
  tablet: { columns: 2, gutter: 20 },
  largeTablet: { columns: 3, gutter: 20 },
  desktop: { columns: 4, gutter: 24 },
  largeDesktop: { columns: 6, gutter: 24 },
};

// Espacements de base
const BASE_SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
};

// Tailles de police de base
const BASE_FONT_SIZES = {
  xxs: 8,
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  title: 28,
  titleLarge: 32,
  heading: 36,
  display: 48,
};

export const useResponsive = () => {
  const [dimensions, setDimensions] = useState({
    width: screenWidth,
    height: screenHeight,
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height,
      });
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;

  // Détection du type d'appareil
  const getDeviceType = (screenWidth: number) => {
    if (screenWidth >= BREAKPOINTS.largeDesktop) return 'largeDesktop';
    if (screenWidth >= BREAKPOINTS.desktop) return 'desktop';
    if (screenWidth >= BREAKPOINTS.largeTablet) return 'largeTablet';
    if (screenWidth >= BREAKPOINTS.tablet) return 'tablet';
    if (screenWidth >= BREAKPOINTS.xl) return 'xl';
    if (screenWidth >= BREAKPOINTS.lg) return 'lg';
    if (screenWidth >= BREAKPOINTS.md) return 'md';
    if (screenWidth >= BREAKPOINTS.sm) return 'sm';
    return 'xs';
  };

  const deviceType = getDeviceType(width);
  
  // Détection de l'orientation
  const getOrientation = () => {
    return width > height ? ORIENTATION.LANDSCAPE : ORIENTATION.PORTRAIT;
  };

  const orientation = getOrientation();
  const isLandscape = orientation === ORIENTATION.LANDSCAPE;
  const isPortrait = orientation === ORIENTATION.PORTRAIT;
  
  // Booléens pour faciliter les conditions
  const isMobile = ['xs', 'sm', 'md', 'lg', 'xl'].includes(deviceType);
  const isTablet = ['tablet', 'largeTablet'].includes(deviceType);
  const isDesktop = ['desktop', 'largeDesktop'].includes(deviceType);
  const isSmallMobile = ['xs', 'sm'].includes(deviceType);
  const isLargeMobile = ['md', 'lg', 'xl'].includes(deviceType);
  const isSmallTablet = deviceType === 'tablet';
  const isLargeTablet = deviceType === 'largeTablet';
  const isStandardDesktop = deviceType === 'desktop';
  const isLargeDesktop = deviceType === 'largeDesktop';
  
  // Facteurs d'échelle
  const getScaleFactor = () => {
    let factor = SCALE_FACTORS[deviceType as keyof typeof SCALE_FACTORS] || 1.0;
    
    // Ajustement pour l'orientation
    if (isLandscape && isMobile) {
      factor *= 0.9; // Réduire légèrement en paysage sur mobile
    }
    
    // Ajustement pour la densité de pixels
    const pixelDensity = PixelRatio.get();
    if (pixelDensity > 3) {
      factor *= 1.1; // Augmenter pour les écrans haute densité
    }
    
    return factor;
  };

  const scaleFactor = getScaleFactor();
  
  // Fonctions pour calculer les tailles responsive
  const responsiveSize = (baseSize: number) => {
    const scaled = Math.round(baseSize * scaleFactor);
    return Math.max(scaled, baseSize * 0.5); // Ne jamais descendre en dessous de 50%
  };
  
  const responsiveWidth = (percentage: number) => Math.round(width * (percentage / 100));
  
  const responsiveHeight = (percentage: number) => Math.round(height * (percentage / 100));
  
  // Espacements responsive
  const spacing = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(BASE_SPACING).forEach(([key, value]) => {
      result[key] = responsiveSize(value);
    });
    return result as typeof BASE_SPACING;
  }, [scaleFactor]);
  
  // Tailles de police responsive
  const fontSize = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(BASE_FONT_SIZES).forEach(([key, value]) => {
      result[key] = responsiveSize(value);
    });
    return result as typeof BASE_FONT_SIZES;
  }, [scaleFactor]);
  
  // Dimensions des composants
  const component = useMemo(() => ({
    // Header
    headerHeight: responsiveSize(60),
    headerPadding: spacing.md,
    
    // Navigation
    tabBarHeight: responsiveSize(isMobile ? 70 : 80),
    tabBarPadding: spacing.sm,
    
    // Cards
    cardPadding: spacing.md,
    cardBorderRadius: responsiveSize(12),
    cardElevation: isMobile ? 2 : 4,
    
    // Buttons
    buttonHeight: responsiveSize(48),
    buttonPadding: spacing.lg,
    buttonBorderRadius: responsiveSize(8),
    buttonIconSize: responsiveSize(20),
    
    // FAB
    fabSize: responsiveSize(56),
    fabBorderRadius: responsiveSize(28),
    
    // Inputs
    inputHeight: responsiveSize(48),
    inputPadding: spacing.md,
    inputBorderRadius: responsiveSize(8),
    
    // Modals
    modalPadding: spacing.xl,
    modalBorderRadius: responsiveSize(16),
    modalWidth: isMobile ? '90%' : isTablet ? '70%' : '50%',
    modalMaxWidth: responsiveSize(600),
    
    // Lists
    listItemPadding: spacing.md,
    listItemHeight: responsiveSize(72),
    listItemGap: spacing.sm,
    
    // Icons
    iconSize: {
      xs: responsiveSize(16),
      sm: responsiveSize(20),
      md: responsiveSize(24),
      lg: responsiveSize(28),
      xl: responsiveSize(32),
    },
    
    // Images
    imageSize: {
      thumbnail: responsiveSize(60),
      small: responsiveSize(100),
      medium: responsiveSize(150),
      large: responsiveSize(200),
      cover: '100%',
    },
    
    // Status bar
    statusBarHeight: Platform.OS === 'ios' 
      ? (isLandscape ? 0 : responsiveSize(44))
      : StatusBar.currentHeight || 0,
    
    // Bottom bar
    bottomBarHeight: Platform.OS === 'ios'
      ? (isLandscape ? responsiveSize(40) : responsiveSize(80))
      : responsiveSize(60),
  }), [scaleFactor, spacing, isMobile, isTablet, isLandscape]);
  
  // Grilles pour layouts
  const grid = useMemo(() => {
    const config = GRID_CONFIG[deviceType as keyof typeof GRID_CONFIG] || GRID_CONFIG.tablet;
    const gutter = spacing[config.gutter === 12 ? 'md' : config.gutter === 16 ? 'lg' : 'xl'];
    
    // Calcul de la largeur des colonnes
    const columnWidth = (width - (gutter * (config.columns - 1))) / config.columns;
    
    return {
      ...config,
      gutter,
      columnWidth,
      // Fonctions utilitaires pour les grilles
      getColumnWidth: (colSpan: number) => (colSpan * columnWidth) + ((colSpan - 1) * gutter),
      getRowHeight: (rowSpan: number, baseHeight: number) => (rowSpan * baseHeight) + ((rowSpan - 1) * gutter),
    };
  }, [deviceType, width, spacing]);
  
  // État de l'appareil
  const device = useMemo(() => ({
    type: deviceType,
    os: Platform.OS,
    version: Platform.Version,
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    isWeb: Platform.OS === 'web',
    pixelRatio: PixelRatio.get(),
    fontScale: PixelRatio.getFontScale(),
  }), [deviceType]);
  
  // Status de l'interface
  const ui = useMemo(() => ({
    showSidebar: isDesktop || (isTablet && isLandscape),
    showLabels: !isSmallMobile || isLandscape,
    showIcons: true,
    showBadges: true,
    compactMode: isSmallMobile && isPortrait,
    denseMode: isSmallMobile || (isMobile && isLandscape),
  }), [isDesktop, isTablet, isSmallMobile, isLandscape, isPortrait]);
  
  return {
    // Dimensions de base
    width,
    height,
    screenWidth,
    screenHeight,
    
    // Type d'appareil
    deviceType,
    scaleFactor,
    
    // Orientation
    orientation,
    isLandscape,
    isPortrait,
    
    // Booléens par type
    isMobile,
    isTablet,
    isDesktop,
    isSmallMobile,
    isLargeMobile,
    isSmallTablet,
    isLargeTablet,
    isStandardDesktop,
    isLargeDesktop,
    
    // Informations appareil
    device,
    
    // État UI
    ui,
    
    // Fonctions utilitaires
    responsiveSize,
    responsiveWidth,
    responsiveHeight,
    
    // Systèmes de design responsive
    spacing,
    fontSize,
    component,
    grid,
    
    // Points de rupture
    breakpoints: BREAKPOINTS,
    
    // Utilitaires additionnels
    isSmallScreen: width < BREAKPOINTS.tablet,
    isMediumScreen: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
    isLargeScreen: width >= BREAKPOINTS.desktop,
    
    // Ratio d'aspect
    aspectRatio: width / height,
    
    // Safe area (à utiliser avec useSafeAreaInsets)
    safeArea: {
      top: Platform.OS === 'ios' ? (isLandscape ? 0 : 44) : StatusBar.currentHeight || 0,
      bottom: Platform.OS === 'ios' ? (isLandscape ? 21 : 34) : 0,
    },
  };
};

// Hook séparé pour les animations responsives
export const useResponsiveAnimation = () => {
  const { isMobile, isTablet, isDesktop, scaleFactor } = useResponsive();
  
  return {
    // Durées d'animation
    duration: {
      fast: isMobile ? 200 : 250,
      normal: isMobile ? 300 : 350,
      slow: isMobile ? 400 : 450,
    },
    
    // Facteurs d'échelle pour les animations
    scale: {
      pressIn: 0.95,
      pressOut: 1,
      hover: 1.02,
    },
    
    // Transitions
    transition: {
      default: {
        duration: 300,
        easing: 'ease-in-out',
      },
      smooth: {
        duration: 400,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      bounce: {
        duration: 500,
        easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
    
    // Seuils pour les animations
    threshold: {
      swipe: isMobile ? 50 : 80,
      drag: isMobile ? 20 : 30,
      scroll: isMobile ? 10 : 15,
    },
  };
};

// Hook pour les couleurs responsives (thème clair/sombre)
export const useResponsiveTheme = () => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  return {
    // Contraste adaptatif
    contrast: {
      high: isMobile ? 1 : 0.9,
      medium: isMobile ? 0.8 : 0.7,
      low: isMobile ? 0.6 : 0.5,
    },
    
    // Tailles des éléments visuels
    visual: {
      shadowOpacity: isMobile ? 0.1 : 0.15,
      shadowRadius: isMobile ? 3 : 5,
      elevation: isMobile ? 2 : 3,
      blurRadius: isMobile ? 5 : 8,
    },
    
    // Adaptations UI
    cardStyle: isMobile ? 'elevated' : 'outlined',
    inputStyle: isMobile ? 'filled' : 'outlined',
    buttonStyle: isMobile ? 'contained' : 'elevated',
  };
};

// Export du hook principal par défaut
export default useResponsive;
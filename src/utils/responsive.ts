import { Dimensions, StyleSheet } from 'react-native';

// Responsive breakpoints
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1440,
};

// Get device type based on screen width
export const getDeviceType = (width: number): 'mobile' | 'tablet' | 'desktop' | 'largeDesktop' => {
  if (width >= BREAKPOINTS.largeDesktop) return 'largeDesktop';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};

// Responsive utility for styles
export const responsive = <T extends StyleSheet.NamedStyles<T>>(
  styles: T,
  width: number
): T => {
  const deviceType = getDeviceType(width);
  
  return Object.keys(styles).reduce((acc, key) => {
    const styleKey = key as keyof T;
    const style = styles[styleKey] as any;
    
    if (style && typeof style === 'object' && style.responsive) {
      acc[styleKey] = {
        ...style,
        ...style.responsive[deviceType],
      };
    } else {
      acc[styleKey] = style;
    }
    
    return acc;
  }, {} as T);
};

// Hook for responsive design
export const useResponsive = () => {
  const { width, height } = Dimensions.get('window');
  const deviceType = getDeviceType(width);
  
  return {
    width,
    height,
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isLargeDesktop: deviceType === 'largeDesktop',
  };
};

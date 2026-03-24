/**
 * Breakpoints responsive pour LibreShop
 * Adaptation tablette, desktop et grand écran
 */

export const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  desktop: 1024,
  large: 1280,
  xlarge: 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export const getBreakpoint = (width: number): Breakpoint => {
  if (width >= BREAKPOINTS.xlarge) return 'xlarge';
  if (width >= BREAKPOINTS.large) return 'large';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
};

export const getResponsiveSpacing = (width: number) => {
  const breakpoint = getBreakpoint(width);
  
  const baseSpacing = {
    phone: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
    tablet: { xs: 6, sm: 12, md: 24, lg: 32, xl: 40, xxl: 64 },
    desktop: { xs: 8, sm: 16, md: 32, lg: 40, xl: 48, xxl: 80 },
    large: { xs: 10, sm: 20, md: 40, lg: 48, xl: 64, xxl: 96 },
    xlarge: { xs: 12, sm: 24, md: 48, lg: 64, xl: 80, xxl: 128 },
  };
  
  return baseSpacing[breakpoint];
};

export const getResponsiveFontSize = (width: number) => {
  const breakpoint = getBreakpoint(width);
  
  const baseFontSizes = {
    phone: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24 },
    tablet: { xs: 14, sm: 16, md: 18, lg: 20, xl: 22, xxl: 28 },
    desktop: { xs: 16, sm: 18, md: 20, lg: 22, xl: 24, xxl: 32 },
    large: { xs: 18, sm: 20, md: 22, lg: 24, xl: 28, xxl: 36 },
    xlarge: { xs: 20, sm: 22, md: 24, lg: 28, xl: 32, xxl: 40 },
  };
  
  return baseFontSizes[breakpoint];
};

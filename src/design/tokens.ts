/**
 * Fairway design tokens.
 *
 * Single source of truth for colours, typography, spacing, radii, shadows,
 * and motion. Tailwind / NativeWind utility classes are derived from these
 * values in `tailwind.config.js`, so the visual language stays consistent
 * whether you reach for a className or for `style={{...tokens.colors...}}`.
 */

export const colors = {
  /** Masters-inspired primary green. */
  primary: "#1F4D3F",
  primaryDark: "#163831",
  /** Warm gold accent. */
  accent: "#B8965A",
  /** Cream surface. */
  surface: "#FAF6EE",
  surfaceDeep: "#F0EBE0",
  surfaceElevated: "#FFFFFF",
  text: "#1A1A1A",
  textMuted: "#6B6862",
  textOnPrimary: "#FAF6EE",
  positive: "#2D5F4A",
  /** Glassy translucent fill used by GlassCard. */
  glass: "rgba(255, 255, 255, 0.72)",
} as const;

export type ColorToken = keyof typeof colors;

export const fontFamilies = {
  /** Fraunces (serif). Used for Display + Title. */
  serif: "Fraunces_400Regular",
  serifLight: "Fraunces_300Light",
  serifMedium: "Fraunces_500Medium",
  /** Inter (sans). Used for body, headings, caption, micro. */
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
} as const;

/** Type scale. Everything here is in pixels. */
export const typography = {
  display: {
    fontFamily: fontFamilies.serifLight,
    fontSize: 96,
    lineHeight: 100,
    letterSpacing: -1.92, // -2% of 96
  },
  title: {
    fontFamily: fontFamilies.serif,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
  },
  heading: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  micro: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88, // 8% of 11
    textTransform: "uppercase" as const,
  },
} as const;

export type TypographyToken = keyof typeof typography;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  hero: 96,
} as const;

export const radii = {
  sm: 12,
  md: 20,
  lg: 28,
  button: 14,
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  elevated: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  hero: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export const motion = {
  /** 280ms ease-out. The default for most transitions. */
  standard: { duration: 280, easing: "ease-out" as const },
  /** 480ms ease-out. For larger or hero transitions. */
  slow: { duration: 480, easing: "ease-out" as const },
  /** Vertical lift used by lifts/parallax. */
  liftPx: 12,
} as const;

export const tokens = {
  colors,
  fontFamilies,
  typography,
  spacing,
  radii,
  shadows,
  motion,
} as const;

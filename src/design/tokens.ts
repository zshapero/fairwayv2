/**
 * Fairway design tokens.
 *
 * Single source of truth for colours, typography, spacing, radii, shadows,
 * and motion. Tailwind / NativeWind utility classes are derived from these
 * values in `tailwind.config.js`. This file is the *premium* iteration: type
 * scaled up for hero moments, shadows layered for depth, glass and aura
 * blends added so the visual language has texture rather than reading like
 * a default RN template.
 */

import type { TextStyle, ViewStyle } from "react-native";

export const colors = {
  /** Masters-inspired primary green. */
  primary: "#1F4D3F",
  primaryDark: "#163831",
  /** Mid-sage used for depth gradients. */
  primarySoft: "#4A7C68",
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
  warning: "#9B6A2E",
  danger: "#9B2D2D",
  /** Glassy translucent fill used by GlassCard. */
  glass: "rgba(255, 255, 255, 0.76)",
  /** Soft inset highlight on the top edge of glass surfaces. */
  glassHighlight: "rgba(255, 255, 255, 0.12)",
  /** Card inner border for definition against cream. */
  cardBorder: "rgba(0, 0, 0, 0.08)",
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

/** Lock numbers to monospaced figures so columns line up cleanly. */
export const TABULAR: TextStyle = {
  fontVariant: ["tabular-nums"],
};

/**
 * Editorial type scale. Hero moments now read like magazine covers.
 *
 * - hero: 112pt Fraunces light, -2% letterspacing. The handicap index.
 * - display: 64pt Fraunces light. Smaller-but-still-bold numbers.
 * - title: 32pt Fraunces regular.
 * - heading: 20pt Inter medium.
 * - body: 17pt Inter regular (primary).
 * - bodySm: 15pt Inter regular (secondary).
 * - serifBody: 18pt Fraunces medium. Used for course names on cards.
 * - caption: 13pt Inter regular muted.
 * - micro: 11pt Inter medium uppercase 12% letterspacing in muted gold.
 */
export const typography = {
  hero: {
    fontFamily: fontFamilies.serifLight,
    fontSize: 112,
    lineHeight: 116,
    letterSpacing: -2.24,
  },
  display: {
    fontFamily: fontFamilies.serifLight,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -1.0,
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
  serifBody: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: 17,
    lineHeight: 25,
    letterSpacing: 0,
  },
  bodySm: {
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
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
    letterSpacing: 1.32, // 12% of 11
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
  xl: 36,
  button: 14,
} as const;

/**
 * Layered shadows. Each card gets two:
 *   - a tight `card` shadow for crispness against the surface,
 *   - a wide `ambient` shadow for the room-light depth feeling.
 *
 * Pair them with `applyShadow(card, ambient)` (see helper below).
 */
export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ambient: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 4,
  },
  hero: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 24 },
    elevation: 8,
  },
} as const;

/**
 * Native shadow props can only describe one drop shadow per view, so we
 * approximate the layered look by flattening the ambient onto the wider
 * radius and accepting the tight one as the iOS shadow. Most callers use
 * the inner-border (`borderColor: cardBorder`) plus this pair to read as
 * two-layer; the helper below exposes both shadows merged into one style
 * object for the rare case where one is enough.
 */
export function flattenShadow(
  ...layers: Array<typeof shadows.card | typeof shadows.ambient | typeof shadows.hero>
): ViewStyle {
  if (layers.length === 0) return {};
  // Use the widest layer for ambient depth on iOS; sum the elevations on Android.
  const widest = layers.reduce((a, b) => (a.shadowRadius > b.shadowRadius ? a : b));
  const elevation = layers.reduce((sum, l) => sum + (l.elevation ?? 0), 0);
  return { ...widest, elevation };
}

export const motion = {
  /** 280ms ease-out. The default for most transitions. */
  standard: { duration: 280, easing: "ease-out" as const },
  /** 320ms ease-out. Used for screen-mount fades. */
  enter: { duration: 320, easing: "ease-out" as const },
  /** 480ms ease-out. For larger or hero transitions. */
  slow: { duration: 480, easing: "ease-out" as const },
  /** 600ms count-up for animated numbers. */
  countUp: { duration: 600, easing: "ease-out" as const },
  /** 120ms press scale. */
  press: { duration: 120, easing: "ease-out" as const },
  /** Stagger between staggered children on screen mount. */
  staggerMs: 40,
  /** Vertical lift used by lifts/parallax. */
  liftPx: 12,
  /** Pressed-state scale for buttons / cards. */
  pressedScale: 0.97,
  /** Tappable card lift on press. */
  cardLiftPx: 2,
  /** Mount lift used with FadeInDown. */
  mountLiftPx: 16,
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

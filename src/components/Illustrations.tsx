import { useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/design/tokens";

interface IllustrationProps {
  size?: number;
  primary?: string;
  muted?: string;
}

const DEFAULT_PRIMARY = colors.primary;
const DEFAULT_MUTED = "#A8A29A";

/**
 * A small flag on a hill. Used as the empty state for "no rounds yet" and the
 * onboarding finish hero. Two-color line drawing with a journal-y feel.
 */
export function FlagIllustration({
  size = 96,
  primary = DEFAULT_PRIMARY,
  muted = DEFAULT_MUTED,
}: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      {/* Hill */}
      <Path
        d="M4 76 C 24 64, 50 70, 92 60"
        stroke={muted}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Flag pole */}
      <Line x1={50} y1={76} x2={50} y2={20} stroke={primary} strokeWidth={1.5} strokeLinecap="round" />
      {/* Flag */}
      <Path
        d="M50 22 L 76 28 L 50 36 Z"
        fill={primary}
        stroke={primary}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Ball */}
      <Circle cx={64} cy={68} r={3.5} stroke={primary} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

/** A small golf bag silhouette for the empty recommendations state. */
export function BagIllustration({
  size = 96,
  primary = DEFAULT_PRIMARY,
  muted = DEFAULT_MUTED,
}: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      {/* Bag body */}
      <Path
        d="M30 30 C 30 22, 38 18, 48 18 C 58 18, 66 22, 66 30 L 64 80 C 64 82, 62 84, 60 84 L 36 84 C 34 84, 32 82, 32 80 Z"
        stroke={primary}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Strap */}
      <Path d="M30 40 L 28 56" stroke={muted} strokeWidth={1.5} strokeLinecap="round" />
      {/* Club shafts */}
      <Line x1={42} y1={20} x2={42} y2={6} stroke={muted} strokeWidth={1.25} strokeLinecap="round" />
      <Line x1={50} y1={20} x2={50} y2={4} stroke={muted} strokeWidth={1.25} strokeLinecap="round" />
      <Line x1={58} y1={20} x2={58} y2={8} stroke={muted} strokeWidth={1.25} strokeLinecap="round" />
      {/* Club heads */}
      <Circle cx={42} cy={6} r={2} fill={primary} />
      <Circle cx={50} cy={4} r={2} fill={primary} />
      <Circle cx={58} cy={8} r={2} fill={primary} />
      {/* Pocket line */}
      <Line x1={36} y1={56} x2={60} y2={56} stroke={muted} strokeWidth={1.25} strokeLinecap="round" />
    </Svg>
  );
}

/** A simple golf tee + ball, used on "no rounds" / generic empty states. */
export function TeeIllustration({
  size = 80,
  primary = DEFAULT_PRIMARY,
  muted = DEFAULT_MUTED,
}: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      {/* Ball */}
      <Circle cx={40} cy={28} r={10} stroke={primary} strokeWidth={1.5} fill="none" />
      {/* Tee */}
      <Path
        d="M30 38 L 50 38 L 42 50 L 38 50 Z"
        stroke={primary}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
      />
      <Line x1={40} y1={50} x2={40} y2={66} stroke={muted} strokeWidth={1.5} strokeLinecap="round" />
      {/* Ground */}
      <Path d="M14 70 C 30 64, 50 64, 66 70" stroke={muted} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Magnifying glass over a tiny green, used for empty search results. */
export function MagnifierIllustration({
  size = 96,
  primary = DEFAULT_PRIMARY,
  muted = DEFAULT_MUTED,
}: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      {/* Tiny course green */}
      <Circle cx={42} cy={42} r={20} stroke={muted} strokeWidth={1.25} fill="none" />
      <Path d="M30 50 C 36 42, 48 42, 54 36" stroke={muted} strokeWidth={1.25} strokeLinecap="round" />
      {/* Tiny flag inside */}
      <Line x1={48} y1={36} x2={48} y2={28} stroke={primary} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M48 28 L 56 30 L 48 32 Z" fill={primary} />
      {/* Lens ring */}
      <Circle cx={42} cy={42} r={28} stroke={primary} strokeWidth={1.5} fill="none" />
      {/* Handle */}
      <Line
        x1={62}
        y1={62}
        x2={80}
        y2={80}
        stroke={primary}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Subtle pulsing dot in primary green. Used as a quiet loading affordance
 * (e.g. above the search input while the API resolves).
 */
export function PulsingDot({ size = 8, color = colors.primary }: { size?: number; color?: string }) {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

interface ShimmerCardProps {
  /** Card height. Defaults to 76 (matches recent-round row). */
  height?: number;
  /** Show two stacked shimmer rows inside (for richer cards). */
  rows?: 1 | 2;
}

/**
 * A shimmer placeholder card sized like the recent-round row. Pulses opacity
 * gently rather than running a moving gradient — quieter, matches the
 * journal aesthetic better than a flashy skeleton loader.
 */
export function ShimmerCard({ height = 76, rows = 2 }: ShimmerCardProps) {
  const pulse = useSharedValue(0.6);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius: 20,
          backgroundColor: "#FFFFFF",
          borderWidth: 0.5,
          borderColor: colors.cardBorder,
          padding: 16,
          justifyContent: "center",
          gap: 8,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{ height: 10, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.06)", width: "55%" }}
      />
      {rows === 2 ? (
        <View
          style={{
            height: 8,
            borderRadius: 5,
            backgroundColor: "rgba(0,0,0,0.04)",
            width: "30%",
          }}
        />
      ) : null}
    </Animated.View>
  );
}

/**
 * Generic empty-state SVG slot. Centred small SVG over a quiet caption.
 * Shared layout so every empty state on every screen reads the same.
 */
export function IllustrationSlot({
  illustration,
  align = "center",
}: {
  illustration: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <View style={{ alignItems: align === "center" ? "center" : "flex-start", paddingVertical: 8 }}>
      {illustration}
    </View>
  );
}

/** Re-export expo-image's Image for caller convenience. */
export { Image as ExpoImage } from "expo-image";

export const ILLUSTRATION_PALETTE = {
  primary: DEFAULT_PRIMARY,
  muted: DEFAULT_MUTED,
} as const;

// Avoid "unused" warnings for the helper imports above when callers don't use them.
void Rect;

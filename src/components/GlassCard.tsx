import type { ReactNode } from "react";
import { Platform, type StyleProp, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

import { colors, flattenShadow, radii, shadows, spacing } from "@/design/tokens";

interface GlassCardProps {
  children: ReactNode;
  /** Defaults to `spacing.lg` (24). Hero glass cards use `spacing.xl` (32). */
  padding?: number;
  /** BlurView intensity 0-100. Defaults to 80 (≈40px backdrop blur). */
  intensity?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hero card with a frosted-glass background.
 *
 * Layers:
 *   1. BlurView (intensity 80 ≈ 40px backdrop blur on iOS).
 *   2. 76% white tint.
 *   3. 1px white-12% inset highlight on the top edge to suggest light hitting
 *      the glass — the difference between "white card" and "glass card."
 *   4. Soft layered shadow (card + hero) for depth.
 */
export function GlassCard({
  children,
  padding = spacing.xl,
  intensity = 80,
  className,
  style,
}: GlassCardProps) {
  return (
    <View
      className={className}
      style={[
        {
          borderRadius: radii.lg,
          overflow: "hidden",
          borderWidth: 0.5,
          borderColor: colors.cardBorder,
          ...flattenShadow(shadows.card, shadows.hero),
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint="light"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        style={{
          padding,
          backgroundColor: Platform.select({
            ios: colors.glass,
            default: "rgba(255,255,255,0.92)",
          }),
        }}
      >
        {children}
      </View>
      {/* Top-edge inset highlight, masked into the rounded corners. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: colors.glassHighlight,
        }}
      />
    </View>
  );
}

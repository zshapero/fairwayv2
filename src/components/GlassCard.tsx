import type { ReactNode } from "react";
import { Platform, type StyleProp, type ViewStyle, View } from "react-native";
import { BlurView } from "expo-blur";

import { colors, radii, shadows, spacing } from "@/design/tokens";

interface GlassCardProps {
  children: ReactNode;
  /** Defaults to `spacing.lg` (24). */
  padding?: number;
  /** BlurView intensity 0-100. Defaults to 40. */
  intensity?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hero card with a frosted-glass background. Layers BlurView (iOS-strong,
 * Android-best-effort) under a 72% white tint so colour and contrast stay
 * predictable across platforms.
 */
export function GlassCard({
  children,
  padding = spacing.lg,
  intensity = 40,
  className,
  style,
}: GlassCardProps) {
  return (
    <View
      className={className}
      style={[
        {
          borderRadius: radii.md,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.08)",
          ...shadows.elevated,
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
    </View>
  );
}

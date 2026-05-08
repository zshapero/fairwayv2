import type { ReactNode } from "react";
import { Pressable, type StyleProp, View, type ViewStyle } from "react-native";

import { colors, radii, shadows, spacing } from "@/design/tokens";

interface CardProps {
  children: ReactNode;
  padding?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Adds a thin gold-on-cream left border. Used by strength cards. */
  accent?: boolean;
}

export function Card({ children, padding = spacing.lg, className, style, onPress, accent }: CardProps) {
  const containerStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.md,
      padding,
      ...shadows.card,
      ...(accent
        ? {
            borderLeftWidth: 3,
            borderLeftColor: colors.accent,
            paddingLeft: padding - 3,
          }
        : {}),
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={className} style={containerStyle}>
        {children}
      </Pressable>
    );
  }
  return (
    <View className={className} style={containerStyle}>
      {children}
    </View>
  );
}

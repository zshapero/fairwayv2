import type { ReactNode } from "react";
import { View } from "react-native";

import { colors, radii, spacing } from "@/design/tokens";
import { Micro } from "./Typography";

export type PillVariant = "positive" | "neutral" | "attention";

interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  /** Outline style (transparent fill). */
  outline?: boolean;
}

const VARIANT_STYLES: Record<PillVariant, { bg: string; fg: string; border: string }> = {
  positive: { bg: colors.positive, fg: colors.textOnPrimary, border: colors.positive },
  neutral: { bg: colors.surfaceDeep, fg: colors.textMuted, border: "rgba(0,0,0,0.18)" },
  attention: { bg: colors.accent, fg: "#1A1A1A", border: colors.accent },
};

export function Pill({ children, variant = "neutral", outline }: PillProps) {
  const style = VARIANT_STYLES[variant];
  const fg = outline ? style.border : style.fg;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: 5,
        borderRadius: radii.sm,
        backgroundColor: outline ? "transparent" : style.bg,
        borderWidth: outline ? 1 : 0,
        borderColor: style.border,
      }}
    >
      <Micro style={{ color: fg }}>{children}</Micro>
    </View>
  );
}

import { View } from "react-native";

import { spacing, typography } from "@/design/tokens";
import { Caption, Display, Title } from "./Typography";

interface NumberDisplayProps {
  /** The big number itself. */
  value: string | number;
  /** Caption shown above the number (eyebrow). */
  eyebrow?: string;
  /** Smaller text shown below. */
  subtitle?: string;
  /** Use the smaller `Title` (32) variant rather than `Display` (96). */
  size?: "display" | "title";
  align?: "left" | "center";
}

export function NumberDisplay({
  value,
  eyebrow,
  subtitle,
  size = "display",
  align = "center",
}: NumberDisplayProps) {
  return (
    <View style={{ alignItems: align === "center" ? "center" : "flex-start", gap: spacing.xs }}>
      {eyebrow ? <Caption color="accent">{eyebrow}</Caption> : null}
      {size === "display" ? (
        <Display color="primary" style={{ letterSpacing: typography.display.letterSpacing }}>
          {value}
        </Display>
      ) : (
        <Title color="primary">{value}</Title>
      )}
      {subtitle ? <Caption>{subtitle}</Caption> : null}
    </View>
  );
}

import type { ReactNode } from "react";
import { View } from "react-native";

import { spacing } from "@/design/tokens";
import { Micro } from "./Typography";

interface SectionProps {
  /** Section eyebrow label (rendered in the Micro variant). */
  label?: string;
  children: ReactNode;
  /** Optional right-aligned slot beside the label (link, count, etc). */
  trailing?: ReactNode;
  /** Override gap between the label and the content. Defaults to 16. */
  gap?: number;
}

export function Section({ label, children, trailing, gap = spacing.md }: SectionProps) {
  return (
    <View style={{ gap }}>
      {label || trailing ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {label ? <Micro color="accent">{label}</Micro> : <View />}
          {trailing}
        </View>
      ) : null}
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

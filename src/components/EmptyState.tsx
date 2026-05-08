import type { ReactNode } from "react";
import { View } from "react-native";

import { spacing } from "@/design/tokens";
import { Body, Caption, Heading } from "./Typography";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description: ReactNode;
  /** Optional CTA. Renders the primary button below the description. */
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.xl,
      }}
    >
      <Heading>{title}</Heading>
      {typeof description === "string" ? (
        <Caption style={{ textAlign: "center" }}>{description}</Caption>
      ) : (
        <Body color="textMuted" style={{ textAlign: "center" }}>
          {description}
        </Body>
      )}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button onPress={onAction}>{actionLabel}</Button>
        </View>
      ) : null}
    </View>
  );
}

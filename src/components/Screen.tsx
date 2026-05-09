import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/design/tokens";
import { PaperGrain } from "./PaperGrain";

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default). */
  scroll?: boolean;
  /** Extra horizontal padding override. Defaults to spacing.lg (24). */
  padding?: number;
  className?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Hide the global paper-grain texture (e.g. for full-bleed hero screens). */
  grain?: boolean;
}

/**
 * Cream-surfaced screen wrapper. Layers a barely-perceptible paper-grain
 * texture beneath every screen so the cream surface never reads as flat.
 * Default state is a vertically scrollable column with 24px gutter and a
 * generous bottom padding for breathing room.
 */
export function Screen({
  children,
  scroll = true,
  padding = spacing.lg,
  className,
  contentContainerStyle,
  grain = true,
}: ScreenProps) {
  const horizontal = { paddingHorizontal: padding } as const;
  if (!scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
        {grain ? <PaperGrain /> : null}
        <View className={className} style={[{ flex: 1 }, horizontal]}>
          {children}
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      {grain ? <PaperGrain /> : null}
      <ScrollView
        className={className}
        contentContainerStyle={[
          { paddingTop: spacing.md, paddingBottom: spacing.hero, gap: spacing.xl },
          horizontal,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

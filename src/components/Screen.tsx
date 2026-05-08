import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/design/tokens";

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default). */
  scroll?: boolean;
  /** Extra horizontal padding override. Defaults to spacing.lg (24). */
  padding?: number;
  className?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Cream-surfaced screen wrapper with safe-area insets and a 24px gutter.
 * The default state is a vertically-scrollable column; pass `scroll={false}`
 * for screens that fully control their own scroll behaviour (e.g. score
 * entry that needs a fixed footer).
 */
export function Screen({
  children,
  scroll = true,
  padding = spacing.lg,
  className,
  contentContainerStyle,
}: ScreenProps) {
  const horizontal = { paddingHorizontal: padding } as const;
  if (!scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
        <View className={className} style={[{ flex: 1 }, horizontal]}>
          {children}
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <ScrollView
        className={className}
        contentContainerStyle={[
          { paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
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

import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, spacing, typography } from "@/design/tokens";
import { Body } from "./Typography";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Stretches the button to the available width. */
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_STYLES: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
};

const VARIANT_TEXT: Record<ButtonVariant, keyof typeof colors> = {
  primary: "textOnPrimary",
  secondary: "primary",
  ghost: "primary",
};

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  full,
  style,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.button,
          opacity: disabled ? 0.5 : 1,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: full ? "stretch" : "flex-start",
        },
        VARIANT_STYLES[variant],
        style,
      ]}
    >
      <View>
        <Body
          color={VARIANT_TEXT[variant]}
          style={{
            fontFamily: typography.heading.fontFamily,
            fontSize: 15,
            letterSpacing: 0,
          }}
        >
          {children}
        </Body>
      </View>
    </Pressable>
  );
}

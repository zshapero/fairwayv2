import type { ReactNode } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native";

import { typography, colors } from "@/design/tokens";

type TypographyVariant = keyof typeof typography;

interface TypographyProps {
  children: ReactNode;
  /** Tailwind className for layout / colour overrides. */
  className?: string;
  style?: StyleProp<TextStyle>;
  /** Convenience colour override. Defaults to ink (`#1A1A1A`). */
  color?: keyof typeof colors;
  /** Number of lines before truncation. */
  numberOfLines?: number;
}

function variantStyle(variant: TypographyVariant): TextStyle {
  const t = typography[variant];
  return {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    ...("textTransform" in t ? { textTransform: t.textTransform } : {}),
  };
}

function makeComponent(variant: TypographyVariant, defaultColor: keyof typeof colors = "text") {
  return function TypographyComponent({
    children,
    className,
    style,
    color,
    numberOfLines,
  }: TypographyProps) {
    const resolvedColor = color ? colors[color] : colors[defaultColor];
    return (
      <Text
        className={className}
        numberOfLines={numberOfLines}
        style={[variantStyle(variant), { color: resolvedColor }, style]}
      >
        {children}
      </Text>
    );
  };
}

export const Display = makeComponent("display");
export const Title = makeComponent("title");
export const Heading = makeComponent("heading");
export const Body = makeComponent("body");
export const Caption = makeComponent("caption", "textMuted");
export const Micro = makeComponent("micro", "textMuted");

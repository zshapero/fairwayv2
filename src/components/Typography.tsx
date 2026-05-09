import type { ReactNode } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native";

import { TABULAR, colors, typography } from "@/design/tokens";

type TypographyVariant = keyof typeof typography;

interface TypographyProps {
  children: ReactNode;
  /** Tailwind className for layout / colour overrides. */
  className?: string;
  style?: StyleProp<TextStyle>;
  /** Convenience colour override. Defaults vary by variant. */
  color?: keyof typeof colors;
  /** Number of lines before truncation. */
  numberOfLines?: number;
  /**
   * Use OpenType tabular figures so columns of numbers line up. Defaults to
   * true for Display + Title + Hero (the variants that hold big numbers).
   */
  tabular?: boolean;
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

function makeComponent(
  variant: TypographyVariant,
  defaultColor: keyof typeof colors = "text",
  defaultTabular = false,
) {
  return function TypographyComponent({
    children,
    className,
    style,
    color,
    numberOfLines,
    tabular,
  }: TypographyProps) {
    const resolvedColor = color ? colors[color] : colors[defaultColor];
    const tabularStyle = (tabular ?? defaultTabular) ? TABULAR : null;
    return (
      <Text
        className={className}
        numberOfLines={numberOfLines}
        style={[variantStyle(variant), { color: resolvedColor }, tabularStyle, style]}
      >
        {children}
      </Text>
    );
  };
}

/** 112pt Fraunces light. The handicap index. */
export const Hero = makeComponent("hero", "primary", true);
/** 64pt Fraunces light. Round totals, course handicap. */
export const Display = makeComponent("display", "primary", true);
/** 32pt Fraunces regular. Page-level titles. */
export const Title = makeComponent("title", "text", true);
/** 20pt Inter medium. Card / section headlines. */
export const Heading = makeComponent("heading", "text");
/** 18pt Fraunces medium. Course names on round cards. */
export const SerifBody = makeComponent("serifBody", "text");
/** 17pt Inter regular. Primary body copy. */
export const Body = makeComponent("body", "text");
/** 15pt Inter regular. Secondary body / supporting copy. */
export const BodySm = makeComponent("bodySm", "textMuted");
/** 13pt Inter regular muted. Captions, dates, helper text. */
export const Caption = makeComponent("caption", "textMuted");
/** 11pt Inter medium uppercase 12% letterspacing. Eyebrow labels. */
export const Micro = makeComponent("micro", "textMuted");

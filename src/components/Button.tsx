import type { ReactNode } from "react";
import { Pressable, type StyleProp, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, motion, radii, spacing, typography } from "@/design/tokens";
import { Body } from "./Typography";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Stretches the button to the available width. */
  full?: boolean;
  /** Trigger a light haptic on press. Defaults to true for primary. */
  haptic?: boolean;
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  full,
  haptic,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const wantsHaptic = haptic ?? variant === "primary";

  const handlePress = () => {
    if (wantsHaptic && !disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withTiming(motion.pressedScale, { duration: motion.press.duration });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: motion.press.duration });
      }}
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
        animatedStyle,
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
    </AnimatedPressable>
  );
}

import type { ReactNode } from "react";
import { Pressable, type StyleProp, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, flattenShadow, motion, radii, shadows, spacing } from "@/design/tokens";

interface CardProps {
  children: ReactNode;
  padding?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Adds a thin gold-on-cream left border. Used by strength cards. */
  accent?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Cream-on-cream card with two stacked shadow layers (tight + ambient) plus
 * a 0.5px inner border. Tappable cards lift -2px on press and scale to 0.98
 * for a subtle haptic-without-haptic.
 */
export function Card({ children, padding = spacing.lg, className, style, onPress, accent }: CardProps) {
  const containerStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.md,
      padding,
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      ...flattenShadow(shadows.card, shadows.ambient),
      ...(accent
        ? {
            borderLeftWidth: 3,
            borderLeftColor: colors.accent,
            paddingLeft: padding - 3,
          }
        : {}),
    },
    style,
  ];

  if (onPress) {
    return <PressableCard onPress={onPress} containerStyle={containerStyle} className={className}>{children}</PressableCard>;
  }
  return (
    <View className={className} style={containerStyle}>
      {children}
    </View>
  );
}

function PressableCard({
  children,
  onPress,
  containerStyle,
  className,
}: {
  children: ReactNode;
  onPress: () => void;
  containerStyle: StyleProp<ViewStyle>;
  className?: string;
}) {
  const lift = useSharedValue(0);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      className={className}
      onPress={onPress}
      onPressIn={() => {
        lift.value = withTiming(-motion.cardLiftPx, { duration: motion.press.duration });
        scale.value = withTiming(0.985, { duration: motion.press.duration });
      }}
      onPressOut={() => {
        lift.value = withTiming(0, { duration: motion.press.duration });
        scale.value = withTiming(1, { duration: motion.press.duration });
      }}
      style={[containerStyle, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

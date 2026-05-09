import type { ReactNode } from "react";
import { Children } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";

import { motion } from "@/design/tokens";

interface StaggerEntryProps {
  children: ReactNode;
  /** Stagger between children, in ms. Defaults to 40. */
  stagger?: number;
  /** Initial delay before the first child starts, in ms. */
  initialDelay?: number;
}

/**
 * Wrap a list of children so they fade up from below on mount, staggered.
 * Each child eases in with a 16px lift over 320ms; siblings start 40ms after
 * the previous one for the "screen unfolding" feel.
 */
export function StaggerEntry({
  children,
  stagger = motion.staggerMs,
  initialDelay = 0,
}: StaggerEntryProps) {
  return (
    <>
      {Children.map(children, (child, index) => (
        <Animated.View
          entering={FadeInDown.duration(motion.enter.duration)
            .delay(initialDelay + index * stagger)
            .springify()
            .damping(18)}
        >
          {child}
        </Animated.View>
      ))}
    </>
  );
}

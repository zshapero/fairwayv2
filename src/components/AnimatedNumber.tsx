import { useEffect, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";

import { motion } from "@/design/tokens";
import { Hero } from "./Typography";

interface AnimatedNumberProps {
  /** Target value. Pass null to render the placeholder string. */
  value: number | null;
  /** Decimal places. Default 1. */
  decimals?: number;
  /** Placeholder when value is null. */
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

/**
 * Counts up (or down) from the previous value to the new one over the
 * configured duration. Uses ease-out so the change starts fast and settles
 * gently — same feel as Apple Fitness ring updates.
 */
export function AnimatedNumber({
  value,
  decimals = 1,
  placeholder = "—",
  style,
  duration = motion.countUp.duration,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState<number | null>(value);

  useEffect(() => {
    if (value === null) {
      setDisplay(null);
      return;
    }
    const from = display ?? value;
    if (from === value) {
      setDisplay(value);
      return;
    }
    const start = Date.now();
    let raf: number | null = null;
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (value - from) * eased;
      setDisplay(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick) as unknown as number;
      } else {
        setDisplay(value);
      }
    };
    raf = requestAnimationFrame(tick) as unknown as number;
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const label =
    display === null ? placeholder : display.toFixed(decimals);

  return <Hero style={style}>{label}</Hero>;
}

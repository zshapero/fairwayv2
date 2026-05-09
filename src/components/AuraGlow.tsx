import { View } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";

import { colors } from "@/design/tokens";

interface AuraGlowProps {
  /** Diameter of the glow circle in pixels. Default 480. */
  size?: number;
  /** 0..1 maximum opacity at the centre. */
  opacity?: number;
  /** Hex colour at centre. Defaults to the primary masters green. */
  color?: string;
}

/**
 * The "wet enamel" effect: a very large, very soft circular gradient placed
 * behind hero numbers to give them a glow without lighting up the background
 * or drawing attention to itself. Inspired by Apple Fitness's Activity tab.
 */
export function AuraGlow({ size = 480, opacity = 0.3, color = colors.primary }: AuraGlowProps) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: size,
        alignItems: "center",
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="aura" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.25} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#aura)" />
      </Svg>
    </View>
  );
}

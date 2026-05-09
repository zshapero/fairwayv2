import Svg, { Defs, Filter, FeTurbulence, Rect } from "react-native-svg";

import { colors } from "@/design/tokens";

interface PaperGrainProps {
  /** 0..1 opacity. The default is intentionally on the edge of perception. */
  opacity?: number;
}

/**
 * Barely-perceptible noise overlay that breaks up the flat cream surface and
 * gives the page a paper-grain texture. Lives behind everything via absolute
 * positioning at the screen root (so individual screens don't have to know
 * about it).
 */
export function PaperGrain({ opacity = 0.03 }: PaperGrainProps) {
  return (
    <Svg
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity,
      }}
      pointerEvents="none"
    >
      <Defs>
        <Filter id="grain">
          <FeTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves={2} seed={4} />
        </Filter>
      </Defs>
      <Rect width="100%" height="100%" fill={colors.text} filter="url(#grain)" />
    </Svg>
  );
}

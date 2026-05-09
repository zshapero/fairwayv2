import type { ReactNode } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { AuraGlow } from "./AuraGlow";
import { colors } from "@/design/tokens";

const HERO_SOURCE = require("../../assets/images/home-hero.png");

interface HomeHeroProps {
  /** Total height of the hero block. */
  height?: number;
  /** Centred content rendered on top of the imagery + aura. */
  children: ReactNode;
}

/**
 * The cinematic backdrop behind the home-screen index number.
 *
 * Stack (bottom to top):
 *   1. Cream surface base.
 *   2. Hero photograph at 18% opacity, blurred, masked top-to-bottom into
 *      cream so it reads as a memory rather than a print.
 *   3. AuraGlow — a 480px soft masters-green radial gradient.
 *   4. Caller-provided centred content.
 */
export function HomeHero({ height = 420, children }: HomeHeroProps) {
  return (
    <View style={{ height, marginHorizontal: -24 }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Image
          source={HERO_SOURCE}
          style={{ width: "100%", height: "100%", opacity: 0.18 }}
          contentFit="cover"
          blurRadius={24}
          transition={400}
        />
        {/* Soft vertical mask: fade the photo into cream at top + bottom. */}
        <LinearGradient
          colors={[colors.surface, "rgba(250,246,238,0.0)", "rgba(250,246,238,0.0)", colors.surface]}
          locations={[0, 0.25, 0.65, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
      <AuraGlow size={Math.min(height, 480)} opacity={0.3} />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        {children}
      </View>
    </View>
  );
}

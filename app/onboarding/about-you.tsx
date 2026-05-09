import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import {
  BodySm,
  Button,
  Display,
  Micro,
  Screen,
  Slider,
  Title,
} from "@/components";
import { colors, fontFamilies, radii, spacing } from "@/design/tokens";
import type { TeePreference } from "@/core/db/types";

const TEE_OPTIONS: { value: TeePreference; label: string }[] = [
  { value: "forward", label: "Forward" },
  { value: "middle", label: "Middle" },
  { value: "back", label: "Back" },
  { value: "tournament", label: "Tournament" },
];

export default function AboutYouScreen() {
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState(18);
  const [tee, setTee] = useState<TeePreference>("middle");

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: "/onboarding/finish",
      params: {
        name: name.trim(),
        handicap: String(handicap),
        tee,
      },
    });
  }, [handicap, name, tee]);

  const handicapLabel = handicap > 0 ? handicap.toString() : handicap === 0 ? "0" : `+${Math.abs(handicap)}`;

  return (
    <Screen>
      <Animated.View entering={FadeIn.duration(400)}>
        <View style={{ paddingTop: spacing.lg, gap: spacing.xs }}>
          <Title
            color="primary"
            style={{
              fontFamily: fontFamilies.serifLight,
              fontSize: 32,
              lineHeight: 38,
              letterSpacing: -0.4,
            }}
          >
            Tell us about your game
          </Title>
          <BodySm>
            We use this to compare your stats to typical golfers at your level. You can change it
            anytime.
          </BodySm>
        </View>

        <View style={{ marginTop: spacing.xxl, gap: spacing.xxl }}>
          {/* Name field — journal style: thin underline, no border. */}
          <View style={{ gap: spacing.xs }}>
            <Micro color="accent" style={{ opacity: 0.7 }}>
              YOUR NAME
            </Micro>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Type it in"
              placeholderTextColor="rgba(0,0,0,0.25)"
              autoCorrect={false}
              autoCapitalize="words"
              style={{
                fontFamily: fontFamilies.serif,
                fontSize: 24,
                lineHeight: 30,
                color: colors.text,
                paddingVertical: spacing.xs,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(0,0,0,0.15)",
              }}
              returnKeyType="next"
            />
          </View>

          {/* Handicap slider */}
          <View style={{ gap: spacing.sm }}>
            <Micro color="accent" style={{ opacity: 0.7 }}>
              ESTIMATED HANDICAP
            </Micro>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
              <Display color="primary" style={{ fontSize: 56, lineHeight: 60, letterSpacing: -0.8 }}>
                {handicapLabel}
              </Display>
              <BodySm>{handicap < 0 ? "scratch player territory" : ""}</BodySm>
            </View>
            <Slider min={-2} max={36} value={handicap} onChange={setHandicap} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <BodySm>+2</BodySm>
              <BodySm>36</BodySm>
            </View>
          </View>

          {/* Tee preference segmented control */}
          <View style={{ gap: spacing.sm }}>
            <Micro color="accent" style={{ opacity: 0.7 }}>
              TEE PREFERENCE
            </Micro>
            <View
              style={{
                flexDirection: "row",
                borderRadius: radii.button,
                backgroundColor: colors.surfaceDeep,
                padding: 3,
                gap: 3,
              }}
            >
              {TEE_OPTIONS.map((opt) => {
                const selected = tee === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setTee(opt.value);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.xs + 2,
                      borderRadius: radii.button - 3,
                      backgroundColor: selected ? colors.surfaceElevated : "transparent",
                      alignItems: "center",
                      shadowColor: selected ? "#000" : undefined,
                      shadowOpacity: selected ? 0.06 : 0,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 1 },
                    }}
                  >
                    <BodySm
                      color={selected ? "primary" : "textMuted"}
                      style={{
                        fontFamily: selected ? fontFamilies.sansMedium : fontFamilies.sans,
                      }}
                    >
                      {opt.label}
                    </BodySm>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ marginTop: spacing.xxxl, alignItems: "stretch" }}>
          <Button onPress={handleContinue} full>
            Continue
          </Button>
        </View>

        <View style={{ height: spacing.xl }} />
      </Animated.View>
    </Screen>
  );
}

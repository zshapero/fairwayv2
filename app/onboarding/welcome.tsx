import { router } from "expo-router";
import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { Body, Button, Caption, Title } from "@/components";
import { colors, fontFamilies, spacing } from "@/design/tokens";

const WELCOME_BG = require("../../assets/images/welcome-bg.png");

export default function WelcomeScreen() {
  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push("/onboarding/about-you");
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Cross-fading background image */}
      <Animated.View
        entering={FadeIn.duration(600)}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <Image
          source={WELCOME_BG}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          blurRadius={30}
          transition={500}
        />
        {/* Vertical fade so the bottom resolves to solid cream. */}
        <LinearGradient
          colors={["rgba(250,246,238,0.05)", "rgba(250,246,238,0.45)", colors.surface]}
          locations={[0, 0.55, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </Animated.View>

      <View
        style={{
          flex: 1,
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xxl,
          paddingBottom: spacing.xl,
        }}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.sm }}>
          <Animated.View entering={FadeInDown.duration(700).delay(120).springify().damping(20)}>
            <Title
              color="primary"
              style={{
                fontFamily: fontFamilies.serifLight,
                fontSize: 56,
                lineHeight: 60,
                letterSpacing: -0.8,
              }}
            >
              Fairway
            </Title>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(700).delay(280).springify().damping(20)}>
            <Body color="textMuted" style={{ fontSize: 18, lineHeight: 26 }}>
              A quiet place for your game.
            </Body>
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeInDown.duration(700).delay(440).springify().damping(20)}
          style={{ alignItems: "center", gap: spacing.md }}
        >
          <Button onPress={handleStart} full>
            Get started
          </Button>
          <Pressable onPress={() => {}} hitSlop={8}>
            <Caption color="textMuted">I already have an account</Caption>
          </Pressable>
        </Animated.View>
      </View>

    </SafeAreaView>
  );
}

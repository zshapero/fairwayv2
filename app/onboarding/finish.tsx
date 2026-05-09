import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import {
  BodySm,
  Button,
  FlagIllustration,
  Screen,
  Title,
} from "@/components";
import { fontFamilies, spacing } from "@/design/tokens";
import { createOnboardedPlayer } from "@/core/db/repositories/players";
import type { TeePreference } from "@/core/db/types";

export default function FinishScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    handicap?: string;
    tee?: string;
  }>();
  const name = (Array.isArray(params.name) ? params.name[0] : params.name) ?? "";
  const handicap = Number(
    (Array.isArray(params.handicap) ? params.handicap[0] : params.handicap) ?? "18",
  );
  const teeRaw = (Array.isArray(params.tee) ? params.tee[0] : params.tee) ?? "middle";
  const tee = (
    ["forward", "middle", "back", "tournament"].includes(teeRaw) ? teeRaw : "middle"
  ) as TeePreference;

  const [saving, setSaving] = useState(false);

  // Persist + soft success haptic on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await createOnboardedPlayer({
          name: name || "You",
          estimatedHandicap: handicap,
          preferredTee: tee,
        });
      } catch (err) {
        if (!cancelled) {
          Alert.alert(
            "Couldn't save",
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name, handicap, tee]);

  const handleFindCourse = useCallback(() => {
    if (saving) return;
    setSaving(true);
    router.replace("/search");
  }, [saving]);

  const handleSkip = useCallback(() => {
    if (saving) return;
    setSaving(true);
    router.replace("/");
  }, [saving]);

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <Animated.View entering={FadeIn.duration(700).delay(80)}>
          <FlagIllustration size={120} />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(700).delay(220).springify().damping(20)}>
          <Title
            color="primary"
            style={{
              fontFamily: fontFamilies.serifLight,
              fontSize: 32,
              lineHeight: 38,
              letterSpacing: -0.4,
              textAlign: "center",
            }}
          >
            You&apos;re set.
          </Title>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(700).delay(340).springify().damping(20)}>
          <BodySm style={{ textAlign: "center", maxWidth: 320 }}>
            Add your home course or jump in with a round.
          </BodySm>
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeInDown.duration(700).delay(460).springify().damping(20)}
        style={{ gap: spacing.sm, paddingBottom: spacing.lg }}
      >
        <Button onPress={handleFindCourse} full disabled={saving}>
          Find my course
        </Button>
        <Button onPress={handleSkip} variant="ghost" full disabled={saving}>
          Maybe later
        </Button>
      </Animated.View>
    </Screen>
  );
}

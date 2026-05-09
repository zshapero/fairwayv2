import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { ArrowDown, ArrowUp, Sparkle } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { calculateMovement, type MovementResult } from "@/core/handicap";
import { loadRoundMovementInputs } from "@/services/roundMovement";
import { GlassCard } from "./GlassCard";
import { BodySm, Caption, Display, Hero, Micro } from "./Typography";
import { colors, spacing } from "@/design/tokens";

interface BaseProps {
  onPress?: () => void;
}

interface PreviewProps extends BaseProps {
  /** Differentials of every prior round (chronological, oldest first). */
  priorDifferentials: readonly number[];
  /** This round's differential. */
  newDifferential: number;
  roundId?: undefined;
}

interface RoundProps extends BaseProps {
  /** Renders the movement caused by a saved round. Loads its prior differentials. */
  roundId: number;
  priorDifferentials?: undefined;
  newDifferential?: undefined;
}

export type HandicapMovementCardProps = PreviewProps | RoundProps;

interface ResolvedInputs {
  priorDifferentials: readonly number[];
  newDifferential: number;
}

export function HandicapMovementCard(props: HandicapMovementCardProps) {
  const [resolved, setResolved] = useState<ResolvedInputs | null>(
    props.roundId === undefined
      ? {
          priorDifferentials: props.priorDifferentials,
          newDifferential: props.newDifferential,
        }
      : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.roundId === undefined) {
      setResolved({
        priorDifferentials: props.priorDifferentials,
        newDifferential: props.newDifferential,
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await loadRoundMovementInputs(props.roundId);
        if (cancelled) return;
        if (!data) {
          setError("Round has no recorded differential yet.");
          return;
        }
        setResolved({
          priorDifferentials: data.priorDifferentials,
          newDifferential: data.newDifferential,
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    props.roundId,
    props.roundId === undefined ? props.priorDifferentials : null,
    props.roundId === undefined ? props.newDifferential : null,
  ]);

  const movement = useMemo<MovementResult | null>(
    () =>
      resolved
        ? calculateMovement(resolved.priorDifferentials, resolved.newDifferential)
        : null,
    [resolved],
  );

  const Wrapper = props.onPress ? Pressable : View;
  const wrapperProps: Record<string, unknown> = props.onPress ? { onPress: props.onPress } : {};

  return (
    <Wrapper {...wrapperProps}>
      <GlassCard padding={spacing.xl}>
        {error ? (
          <BodySm color="primary">{error}</BodySm>
        ) : !movement || !resolved ? (
          <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <CardBody
            movement={movement}
            newDifferential={resolved.newDifferential}
            windowSize={Math.min(20, resolved.priorDifferentials.length + 1)}
          />
        )}
      </GlassCard>
    </Wrapper>
  );
}

function CardBody({
  movement,
  newDifferential,
  windowSize,
}: {
  movement: MovementResult;
  newDifferential: number;
  windowSize: number;
}) {
  const {
    oldIndex,
    newIndex,
    newDifferentialRank,
    isCounting,
    droppedDifferential,
    triggeredEsr,
  } = movement;

  if (oldIndex === null && newIndex === null) {
    return (
      <View style={{ gap: spacing.xs }}>
        <Micro color="accent" style={{ opacity: 0.8 }}>
          NEW HERE
        </Micro>
        <Display color="primary" style={{ fontSize: 36, lineHeight: 40 }}>
          One more round
        </Display>
        <BodySm>
          Three rounds in and we can give you a Handicap Index. Keep posting.
        </BodySm>
      </View>
    );
  }

  const direction =
    oldIndex !== null && newIndex !== null
      ? newIndex < oldIndex
        ? "down"
        : newIndex > oldIndex
          ? "up"
          : "flat"
      : "new";

  const isWin = direction === "down";
  const numberColor = isWin ? colors.positive : direction === "up" ? colors.danger : colors.text;

  const oldLabel = oldIndex === null ? "—" : oldIndex.toFixed(1);
  const newLabel = newIndex === null ? "—" : newIndex.toFixed(1);
  const moveAmount =
    oldIndex !== null && newIndex !== null
      ? Math.abs(newIndex - oldIndex).toFixed(1)
      : null;
  const verb =
    direction === "down" ? "Down" : direction === "up" ? "Up" : direction === "flat" ? "Flat" : "Now";

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Micro color="accent" style={{ opacity: 0.85 }}>
          YOUR INDEX
        </Micro>
        {isWin ? (
          <Animated.View entering={FadeIn.duration(360).delay(120)}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "rgba(184, 150, 90, 0.18)",
                paddingHorizontal: spacing.xs,
                paddingVertical: 3,
                borderRadius: 999,
              }}
            >
              <Sparkle color={colors.accent} size={11} strokeWidth={1.75} />
              <Caption style={{ color: colors.accent, fontFamily: "Inter_500Medium" }}>
                Win
              </Caption>
            </View>
          </Animated.View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
        {direction !== "new" && moveAmount ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {direction === "down" ? (
              <ArrowDown color={numberColor} size={20} strokeWidth={1.75} />
            ) : direction === "up" ? (
              <ArrowUp color={numberColor} size={20} strokeWidth={1.75} />
            ) : null}
            <BodySm style={{ color: numberColor, fontFamily: "Inter_500Medium" }} tabular>
              {moveAmount}
            </BodySm>
          </View>
        ) : null}
        <Hero style={{ color: numberColor, fontSize: 88, lineHeight: 92 }}>{newLabel}</Hero>
      </View>

      {direction !== "new" ? (
        <Caption>was {oldLabel}</Caption>
      ) : null}

      <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginVertical: spacing.xxs }} />

      <BodySm>
        That round counted as your{" "}
        <BodySm style={{ fontFamily: "Inter_500Medium" }}>{ordinal(newDifferentialRank)}</BodySm>
        {" "}best of the last {windowSize}.{" "}
        {isCounting
          ? "It's one of the rounds we use to compute your index, so it's helping pull the number where it is."
          : "It doesn't land in the rounds we use, so it didn't move the needle directly."}
      </BodySm>

      {droppedDifferential !== null ? (
        <BodySm color="textMuted">
          It bumped a previous{" "}
          <BodySm color="text" style={{ fontFamily: "Inter_500Medium" }}>
            {droppedDifferential.toFixed(1)}
          </BodySm>{" "}
          out of the calculation.
        </BodySm>
      ) : null}

      <View style={{ marginTop: spacing.xxs }}>
        <Caption color="textMuted">
          The differential we counted: {newDifferential.toFixed(1)}.
        </Caption>
      </View>

      {triggeredEsr > 0 ? (
        <View
          style={{
            marginTop: spacing.xxs,
            backgroundColor: "rgba(184, 150, 90, 0.16)",
            borderRadius: 12,
            padding: spacing.md,
            gap: spacing.xxs,
          }}
        >
          <Micro color="accent">EXCEPTIONAL ROUND</Micro>
          <BodySm>
            Your index also got an extra {triggeredEsr.toFixed(1)}-stroke trim for posting{" "}
            {triggeredEsr === 2 ? "10 or more" : "7 to 10"} strokes under your old number.
          </BodySm>
        </View>
      ) : null}
    </View>
  );
}

function ordinal(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

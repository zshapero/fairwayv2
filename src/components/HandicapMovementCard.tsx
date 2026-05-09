import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { calculateMovement, type MovementResult } from "@/core/handicap";
import { loadRoundMovementInputs } from "@/services/roundMovement";

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
  const wrapperProps: Record<string, unknown> = props.onPress
    ? { onPress: props.onPress }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="rounded-2xl bg-white p-5 shadow-md shadow-gray-300"
      style={{ elevation: 3 }}
    >
      {error ? (
        <Text className="text-sm text-red-700">{error}</Text>
      ) : !movement || !resolved ? (
        <View className="items-center py-4">
          <ActivityIndicator />
        </View>
      ) : (
        <CardBody
          movement={movement}
          newDifferential={resolved.newDifferential}
          windowSize={Math.min(20, resolved.priorDifferentials.length + 1)}
        />
      )}
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
      <View className="gap-1">
        <Text className="text-base font-semibold text-fairway-700">
          One more round and you&apos;ll have a number
        </Text>
        <Text className="text-sm text-gray-600">
          Three rounds in and we can give you a Handicap Index. Keep posting.
        </Text>
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

  const newColor =
    direction === "down"
      ? "text-green-600"
      : direction === "up"
        ? "text-red-600"
        : "text-gray-900";

  const oldLabel = oldIndex === null ? "—" : oldIndex.toFixed(1);
  const newLabel = newIndex === null ? "—" : newIndex.toFixed(1);
  const movementWord =
    direction === "down" ? "Down" : direction === "up" ? "Up" : direction === "flat" ? "Flat" : "New";
  const moveAmount =
    oldIndex !== null && newIndex !== null
      ? Math.abs(newIndex - oldIndex).toFixed(1)
      : null;

  return (
    <View className="gap-3">
      <View>
        <Text className="text-xs uppercase tracking-wide text-gray-500">
          {direction === "new"
            ? "Your number"
            : moveAmount
              ? `${movementWord} ${moveAmount} to`
              : "Your number"}
        </Text>
        <View className="flex-row items-baseline gap-3">
          <Text className={`text-5xl font-bold ${newColor}`}>{newLabel}</Text>
          {direction !== "new" ? (
            <Text className="text-base text-gray-500">
              was {oldLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <Text className="text-base text-gray-800">
        That round counted as your{" "}
        <Text className="font-semibold">{ordinal(newDifferentialRank)}</Text>{" "}
        best of the last {windowSize}.{" "}
        {isCounting
          ? "It's one of the rounds we use to compute your index, so it's helping pull the number where it is."
          : "It doesn't land in the rounds we use to compute your index, so it didn't move the needle directly."}
      </Text>

      {droppedDifferential !== null ? (
        <Text className="text-sm text-gray-700">
          It bumped a previous{" "}
          <Text className="font-semibold">{droppedDifferential.toFixed(1)}</Text>{" "}
          out of the calculation.
        </Text>
      ) : null}

      {triggeredEsr > 0 ? (
        <View className="rounded-lg bg-amber-50 p-3">
          <Text className="text-sm font-semibold text-amber-800">
            Exceptional round!
          </Text>
          <Text className="text-sm text-amber-800">
            Your index also got an extra {triggeredEsr.toFixed(1)}-stroke trim
            for posting{" "}
            {triggeredEsr === 2 ? "10 or more" : "7 to 10"} strokes under your
            old number.
          </Text>
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

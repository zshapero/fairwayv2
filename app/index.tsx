import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import * as coursesRepo from "@/core/db/repositories/courses";
import * as recommendationsRepo from "@/core/db/repositories/recommendations";
import * as roundsRepo from "@/core/db/repositories/rounds";
import type { Course, Round } from "@/core/db/types";
import { getCurrentPlayer } from "@/services/currentPlayer";
import { loadRoundDeltasForPlayer, type RoundIndexBadge } from "@/services/roundMovement";
import {
  Body,
  Button,
  Card,
  Caption,
  Display,
  Heading,
  Micro,
  NumberDisplay,
  Pill,
  Screen,
  Section,
} from "@/components";
import { colors, spacing } from "@/design/tokens";

interface RecentRound {
  round: Round;
  course: Course | null;
  delta: number | null;
}

export default function HomeScreen() {
  const [handicapIndex, setHandicapIndex] = useState<number | null | undefined>(undefined);
  const [recent, setRecent] = useState<RecentRound[]>([]);
  const [recCounts, setRecCounts] = useState<{ wins: number; opportunities: number }>({
    wins: 0,
    opportunities: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const player = await getCurrentPlayer();
          if (!cancelled) setHandicapIndex(player?.handicap_index ?? null);
          if (!player) {
            if (!cancelled) {
              setRecent([]);
              setRecCounts({ wins: 0, opportunities: 0 });
            }
            return;
          }
          const [allRounds, deltas, allCourses, recsByType] = await Promise.all([
            roundsRepo.listCompletedRoundsForPlayer(player.id),
            loadRoundDeltasForPlayer(player.id),
            coursesRepo.listCourses(),
            recommendationsRepo.countActiveByTypeForPlayer(player.id),
          ]);
          if (!cancelled) {
            setRecCounts({
              wins: (recsByType.strength ?? 0) + (recsByType.milestone ?? 0),
              opportunities: recsByType.opportunity ?? 0,
            });
          }
          const courseById = new Map(allCourses.map((c) => [c.id, c]));
          const deltaById = new Map<number, RoundIndexBadge>(deltas.map((d) => [d.roundId, d]));
          const sorted = [...allRounds].sort((a, b) => b.played_at.localeCompare(a.played_at));
          const recentRows: RecentRound[] = sorted.slice(0, 5).map((r) => ({
            round: r,
            course: courseById.get(r.course_id) ?? null,
            delta: deltaById.get(r.id)?.delta ?? null,
          }));
          if (!cancelled) setRecent(recentRows);
        } catch {
          if (!cancelled) {
            setHandicapIndex(null);
            setRecent([]);
            setRecCounts({ wins: 0, opportunities: 0 });
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const indexLabel =
    handicapIndex === undefined ? "—" : handicapIndex === null ? "—" : handicapIndex.toFixed(1);

  return (
    <Screen>
      <View style={{ alignItems: "center", paddingTop: spacing.xl, gap: spacing.xs }}>
        <Micro color="accent">YOUR INDEX</Micro>
        <Display color="primary">{indexLabel}</Display>
        <Caption style={{ textAlign: "center" }}>
          {handicapIndex === null
            ? "Three rounds in and we'll have a number for you."
            : "Your best 8 of 20."}
        </Caption>
      </View>

      <View style={{ alignItems: "center", marginTop: spacing.md }}>
        <Button onPress={() => router.push("/play/select-course")}>Start a Round</Button>
      </View>

      {recCounts.wins + recCounts.opportunities > 0 ? (
        <Section label="NOTES ON YOUR GAME">
          <Card onPress={() => router.push("/recommendations")}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Heading>{formatRecHeadline(recCounts.wins, recCounts.opportunities)}</Heading>
                <Caption>{formatRecSubtitle(recCounts.wins, recCounts.opportunities)}</Caption>
              </View>
              <Body color="primary">›</Body>
            </View>
          </Card>
        </Section>
      ) : null}

      {recent.length > 0 ? (
        <Section label="LATELY">
          {recent.map(({ round, course, delta }) => (
            <RecentRoundRow
              key={round.id}
              round={round}
              course={course}
              delta={delta}
              onPress={() =>
                router.push({ pathname: "/rounds/[id]", params: { id: String(round.id) } })
              }
            />
          ))}
        </Section>
      ) : null}

      <View style={{ alignItems: "center", marginTop: spacing.lg, gap: spacing.xs }}>
        <Link href="/search">
          <Caption color="primary">Find a course</Caption>
        </Link>
        <Link href="/debug">
          <Caption>Debug</Caption>
        </Link>
      </View>
    </Screen>
  );
}

function formatRecHeadline(wins: number, opportunities: number): string {
  if (wins > 0 && opportunities > 0) {
    return `A few things we've noticed (${opportunities} to work on, ${wins} going well)`;
  }
  if (wins > 0) return `Some things going well (${wins})`;
  return `A few things to work on (${opportunities})`;
}

function formatRecSubtitle(wins: number, opportunities: number): string {
  if (wins > 0 && opportunities > 0) return "Patterns from your last few rounds.";
  if (wins > 0) return "Patterns worth protecting.";
  return "Patterns from your last few rounds.";
}

function RecentRoundRow({
  round,
  course,
  delta,
  onPress,
}: {
  round: Round;
  course: Course | null;
  delta: number | null;
  onPress: () => void;
}) {
  const playedDate = new Date(round.played_at).toLocaleDateString();
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading numberOfLines={1}>{course?.name ?? "Course"}</Heading>
          <Caption>{playedDate}</Caption>
        </View>
        <View style={{ alignItems: "flex-end", gap: spacing.xxs }}>
          <Caption>
            {round.differential != null
              ? `Counted ${round.differential.toFixed(1)}`
              : "Didn't count"}
          </Caption>
          <DeltaBadge delta={delta} />
        </View>
      </View>
    </Card>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <Pill variant="neutral" outline>—</Pill>;
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return <Pill variant="neutral">No change</Pill>;
  const arrow = rounded < 0 ? "↓" : "↑";
  const variant: "positive" | "attention" = rounded < 0 ? "positive" : "attention";
  void colors;
  return (
    <Pill variant={variant}>
      {arrow} {Math.abs(rounded).toFixed(1)}
    </Pill>
  );
}

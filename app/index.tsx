import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { ChevronRight, ArrowDown, ArrowUp, Minus } from "lucide-react-native";

import * as coursesRepo from "@/core/db/repositories/courses";
import * as recommendationsRepo from "@/core/db/repositories/recommendations";
import * as roundsRepo from "@/core/db/repositories/rounds";
import type { Course, Round } from "@/core/db/types";
import { getCurrentPlayer } from "@/services/currentPlayer";
import { loadRoundDeltasForPlayer, type RoundIndexBadge } from "@/services/roundMovement";
import {
  AnimatedNumber,
  Body,
  BodySm,
  Button,
  Card,
  Caption,
  HomeHero,
  Heading,
  Micro,
  Pill,
  Screen,
  Section,
  SerifBody,
  StaggerEntry,
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

  const value = handicapIndex ?? null;

  return (
    <Screen>
      <StaggerEntry>
        <HomeHero height={420}>
          <Micro color="accent" style={{ opacity: 0.8 }}>
            YOUR INDEX
          </Micro>
          <View style={{ marginTop: spacing.sm }}>
            <AnimatedNumber value={value} placeholder="—" />
          </View>
          <Caption style={{ marginTop: spacing.sm, textAlign: "center" }}>
            {handicapIndex === null
              ? "Three rounds in and we'll have a number for you."
              : "Your best 8 of 20."}
          </Caption>
        </HomeHero>

        <View style={{ alignItems: "center" }}>
          <Button onPress={() => router.push("/play/select-course")}>Start a round</Button>
        </View>

        {recCounts.wins + recCounts.opportunities > 0 ? (
          <Section label="NOTES ON YOUR GAME">
            <Card onPress={() => router.push("/recommendations")}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, gap: spacing.xxs, paddingRight: spacing.md }}>
                  <Heading>{formatRecHeadline(recCounts.wins, recCounts.opportunities)}</Heading>
                  <Caption>{formatRecSubtitle(recCounts.wins, recCounts.opportunities)}</Caption>
                </View>
                <ChevronRight color={colors.primary} size={22} strokeWidth={1.5} />
              </View>
            </Card>
          </Section>
        ) : null}

        {recent.length > 0 ? (
          <Section label="LATELY">
            <View style={{ gap: spacing.sm }}>
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
            </View>
          </Section>
        ) : null}

        <View style={{ alignItems: "center", marginTop: spacing.md, gap: spacing.sm }}>
          <Link href="/search">
            <BodySm color="primary">Find a course</BodySm>
          </Link>
          <Link href="/debug">
            <BodySm>Debug</BodySm>
          </Link>
        </View>
      </StaggerEntry>
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
    <Card onPress={onPress} padding={spacing.md + spacing.xs}>
      <View
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <View style={{ flex: 1, gap: 2, paddingRight: spacing.md }}>
          <SerifBody numberOfLines={1}>{course?.name ?? "Course"}</SerifBody>
          <Caption>{playedDate}</Caption>
        </View>
        <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
          <Body color="text" tabular>
            {round.differential != null ? round.differential.toFixed(1) : "—"}
          </Body>
          <DeltaBadge delta={delta} />
        </View>
      </View>
    </Card>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <Pill variant="neutral" outline>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Minus color={colors.textMuted} size={11} strokeWidth={1.75} />
        </View>
      </Pill>
    );
  }
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) {
    return <Pill variant="neutral">No change</Pill>;
  }
  const isDown = rounded < 0;
  const Icon = isDown ? ArrowDown : ArrowUp;
  const variant: "positive" | "attention" = isDown ? "positive" : "attention";
  return (
    <Pill variant={variant}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon color={isDown ? colors.textOnPrimary : "#1A1A1A"} size={11} strokeWidth={2} />
        <View style={{ marginTop: -1 }}>
          <Caption
            color={isDown ? "textOnPrimary" : "text"}
            style={{ fontSize: 11, lineHeight: 14, fontFamily: "Inter_500Medium", letterSpacing: 1.32 }}
            tabular
          >
            {Math.abs(rounded).toFixed(1)}
          </Caption>
        </View>
      </View>
    </Pill>
  );
}

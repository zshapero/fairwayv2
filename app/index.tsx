import { Link, Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ChevronRight, ArrowDown, ArrowUp, Minus } from "lucide-react-native";

import * as coursesRepo from "@/core/db/repositories/courses";
import * as recommendationsRepo from "@/core/db/repositories/recommendations";
import * as roundsRepo from "@/core/db/repositories/rounds";
import type { Course, Player, Round } from "@/core/db/types";
import { getCurrentPlayer } from "@/services/currentPlayer";
import { loadRoundDeltasForPlayer, type RoundIndexBadge } from "@/services/roundMovement";
import {
  AnimatedNumber,
  Body,
  BodySm,
  Button,
  Card,
  Caption,
  FlagIllustration,
  HomeHero,
  Heading,
  Micro,
  Pill,
  Screen,
  Section,
  SerifBody,
  ShimmerCard,
  StaggerEntry,
} from "@/components";
import { colors, fontFamilies, spacing } from "@/design/tokens";

interface RecentRound {
  round: Round;
  course: Course | null;
  delta: number | null;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "needs_onboarding" }
  | {
      kind: "ready";
      player: Player;
      recent: RecentRound[];
      totalRounds: number;
      counts: { wins: number; opportunities: number };
    };

export default function HomeScreen() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const player = await getCurrentPlayer();
          if (!player) {
            if (!cancelled) setState({ kind: "needs_onboarding" });
            return;
          }
          const [allRounds, deltas, allCourses, recsByType] = await Promise.all([
            roundsRepo.listCompletedRoundsForPlayer(player.id),
            loadRoundDeltasForPlayer(player.id),
            coursesRepo.listCourses(),
            recommendationsRepo.countActiveByTypeForPlayer(player.id),
          ]);
          const courseById = new Map(allCourses.map((c) => [c.id, c]));
          const deltaById = new Map<number, RoundIndexBadge>(deltas.map((d) => [d.roundId, d]));
          const sorted = [...allRounds].sort((a, b) => b.played_at.localeCompare(a.played_at));
          const recent: RecentRound[] = sorted.slice(0, 5).map((r) => ({
            round: r,
            course: courseById.get(r.course_id) ?? null,
            delta: deltaById.get(r.id)?.delta ?? null,
          }));
          if (cancelled) return;
          setState({
            kind: "ready",
            player,
            recent,
            totalRounds: allRounds.length,
            counts: {
              wins: (recsByType.strength ?? 0) + (recsByType.milestone ?? 0),
              opportunities: recsByType.opportunity ?? 0,
            },
          });
        } catch {
          if (!cancelled) {
            setState({
              kind: "ready",
              player: { id: 0, name: "", handicap_index: null, preferred_tee: null, created_at: "" },
              recent: [],
              totalRounds: 0,
              counts: { wins: 0, opportunities: 0 },
            });
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (state.kind === "needs_onboarding") {
    return <Redirect href="/onboarding/welcome" />;
  }

  if (state.kind === "loading") {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return <ReadyHome state={state} />;
}

function ReadyHome({ state }: { state: Extract<LoadState, { kind: "ready" }> }) {
  const { player, recent, counts, totalRounds } = state;

  return (
    <Screen>
      <StaggerEntry>
        <Greeting player={player} />

        <HeroBlock player={player} totalRounds={totalRounds} />

        <ContextualLine recent={recent} />

        {totalRounds > 0 ? (
          <View style={{ alignItems: "center" }}>
            <Button onPress={() => router.push("/play/select-course")}>Start a round</Button>
          </View>
        ) : null}

        {counts.wins + counts.opportunities > 0 ? (
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
                  <Heading>{formatRecHeadline(counts.wins, counts.opportunities)}</Heading>
                  <Caption>{formatRecSubtitle(counts.wins, counts.opportunities)}</Caption>
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

function Greeting({ player }: { player: Player }) {
  const hour = new Date().getHours();
  const name = player.name && player.name !== "You" ? player.name.split(" ")[0] : "";
  let phrase: string;
  if (hour >= 21 || hour < 5) {
    phrase = "Late night practice?";
  } else if (hour < 11) {
    phrase = name ? `Good morning, ${name}.` : "Good morning.";
  } else if (hour < 17) {
    phrase = name ? `Hey ${name}.` : "Hey there.";
  } else {
    phrase = name ? `Evening, ${name}.` : "Evening.";
  }
  return (
    <View style={{ paddingTop: spacing.lg }}>
      <SerifBody color="text" style={{ fontSize: 22, lineHeight: 28 }}>
        {phrase}
      </SerifBody>
    </View>
  );
}

function HeroBlock({ player, totalRounds }: { player: Player; totalRounds: number }) {
  const handicap = player.handicap_index;
  if (totalRounds === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md }}>
        <FlagIllustration size={96} />
        <View style={{ alignItems: "center", gap: spacing.xs }}>
          <SerifBody style={{ textAlign: "center" }}>No rounds yet.</SerifBody>
          <BodySm style={{ textAlign: "center" }}>Your first one shows up here.</BodySm>
        </View>
        <Button onPress={() => router.push("/play/select-course")}>Start a round</Button>
      </View>
    );
  }
  if (totalRounds < 3) {
    const remaining = 3 - totalRounds;
    return (
      <HomeHero height={420}>
        <Micro color="accent" style={{ opacity: 0.8 }}>
          YOUR INDEX
        </Micro>
        <View style={{ marginTop: spacing.sm }}>
          <HeroPlaceholder />
        </View>
        <BodySm style={{ marginTop: spacing.sm, textAlign: "center" }}>
          Post 3 rounds to see your index. {remaining === 1 ? "One more" : `${remaining} more`} to go.
        </BodySm>
      </HomeHero>
    );
  }
  return (
    <HomeHero height={420}>
      <Micro color="accent" style={{ opacity: 0.8 }}>
        YOUR INDEX
      </Micro>
      <View style={{ marginTop: spacing.sm }}>
        <AnimatedNumber value={handicap ?? null} placeholder="—" />
      </View>
      <Caption style={{ marginTop: spacing.sm, textAlign: "center" }}>
        {handicap === null ? "We'll have a number after a few more rounds." : "Your best 8 of 20."}
      </Caption>
    </HomeHero>
  );
}

function HeroPlaceholder() {
  return (
    <SerifBody
      style={{
        fontFamily: fontFamilies.serifLight,
        fontSize: 112,
        lineHeight: 116,
        color: colors.primary,
        letterSpacing: -2.24,
      }}
    >
      —
    </SerifBody>
  );
}

function ContextualLine({ recent }: { recent: RecentRound[] }) {
  if (recent.length === 0) return null;
  const last = recent[0]!;
  const ageMs = Date.now() - new Date(last.round.played_at).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  let line: string | null = null;
  if (ageMs > 30 * dayMs) {
    line = "Welcome back. Time for a fresh start?";
  } else if (ageMs > 7 * dayMs) {
    line = "Been a minute since your last round. Get out there?";
  } else if (ageMs < dayMs) {
    line = `Solid round at ${last.course?.name ?? "the course"} yesterday.`;
  }
  if (!line) return null;
  return (
    <Card padding={spacing.md + 2}>
      <BodySm color="text">{line}</BodySm>
    </Card>
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
        <Caption
          color={isDown ? "textOnPrimary" : "text"}
          style={{ fontSize: 11, lineHeight: 14, fontFamily: "Inter_500Medium", letterSpacing: 1.32 }}
          tabular
        >
          {Math.abs(rounded).toFixed(1)}
        </Caption>
      </View>
    </Pill>
  );
}

// Keep Heading + ShimmerCard reachable from the type-checker even though
// they're used conditionally.
void Heading;
void ShimmerCard;

import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import * as Haptics from "expo-haptics";

import * as holeScoresRepo from "@/core/db/repositories/holeScores";
import * as roundsRepo from "@/core/db/repositories/rounds";
import * as teeHolesRepo from "@/core/db/repositories/teeHoles";
import * as teesRepo from "@/core/db/repositories/tees";
import * as coursesRepo from "@/core/db/repositories/courses";
import { getOrCreateCurrentPlayer } from "@/services/currentPlayer";
import {
  computeRoundSummary,
  saveCompletedRound,
  type SummaryInput,
  type SummaryResult,
} from "@/services/roundCompletion";
import { HandicapMovementCard } from "@/components/HandicapMovementCard";
import { runEngine } from "@/services/recommendationsRunner";
import {
  Body,
  BodySm,
  Button,
  Card,
  Caption,
  Display,
  Micro,
  Screen,
  Section,
  StaggerEntry,
} from "@/components";
import { colors, spacing } from "@/design/tokens";

export default function SummaryScreen() {
  const params = useLocalSearchParams<{ roundId?: string }>();
  const roundIdRaw = Array.isArray(params.roundId) ? params.roundId[0] : params.roundId;
  const roundId = roundIdRaw ? Number(roundIdRaw) : NaN;

  const [input, setInput] = useState<SummaryInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSummary, setSavedSummary] = useState<SummaryResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!Number.isFinite(roundId)) throw new Error("Missing roundId");
        const round = await roundsRepo.getRound(roundId);
        if (!round) throw new Error(`Round ${roundId} not found`);

        const [course, teesList, teeHoles, holeScores, player] = await Promise.all([
          coursesRepo.getCourse(round.course_id),
          teesRepo.listTeesForCourse(round.course_id),
          teeHolesRepo.listTeeHoles(round.tee_id),
          holeScoresRepo.listHoleScoresForRound(roundId),
          getOrCreateCurrentPlayer(),
        ]);
        const tee = teesList.find((t) => t.id === round.tee_id);
        if (!course || !tee) throw new Error("Round metadata missing");

        const priorRounds = await roundsRepo.listCompletedRoundsForPlayer(player.id);
        const priorDifferentials = priorRounds
          .map((r) => r.differential)
          .filter((d): d is number => typeof d === "number");

        if (cancelled) return;
        setInput({
          playerId: player.id,
          roundId,
          teeHoles,
          courseRating: tee.course_rating,
          slopeRating: tee.slope_rating,
          par: course.par,
          pcc: round.pcc,
          handicapIndexBefore: player.handicap_index,
          perHole: holeScores.map((row) => ({
            hole_number: row.hole_number,
            gross_score: row.gross_score,
            putts: row.putts,
            fairway_hit: row.fairway_hit,
            green_in_regulation: row.green_in_regulation,
            penalty_strokes: row.penalty_strokes,
            fairway_miss_direction: row.fairway_miss_direction,
            gir_miss_direction: row.gir_miss_direction,
            hit_from_sand: row.hit_from_sand ?? 0,
          })),
          priorDifferentials,
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  const projection = useMemo(() => (input ? computeRoundSummary(input) : null), [input]);

  const handleSave = useCallback(async () => {
    if (!input) return;
    setSaving(true);
    try {
      const result = await saveCompletedRound(input);
      setSavedSummary(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void runEngine(input.playerId).catch((err) => {
        if (__DEV__) console.warn("recommendation engine failed", err);
      });
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [input]);

  const handleDiscard = useCallback(() => {
    Alert.alert(
      "Throw out this round?",
      "Hole scores get deleted. Your other rounds stay.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Throw out",
          style: "destructive",
          onPress: async () => {
            try {
              if (Number.isFinite(roundId)) {
                await roundsRepo.deleteRound(roundId);
              }
              router.replace("/");
            } catch (err) {
              Alert.alert("Discard failed", err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
    );
  }, [roundId]);

  if (error) {
    return (
      <Screen>
        <Body color="primary">{error}</Body>
        <Button onPress={() => router.replace("/")}>Home</Button>
      </Screen>
    );
  }

  if (!input || !projection) {
    return (
      <Screen>
        <View style={{ alignItems: "center", paddingTop: spacing.hero }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const summary = savedSummary ?? projection;

  return (
    <Screen>
      <StaggerEntry>
        <Section label="HOW IT COUNTED">
          <HandicapMovementCard
            priorDifferentials={input.priorDifferentials}
            newDifferential={summary.scoreDifferential}
            onPress={
              savedSummary
                ? () =>
                    router.push({ pathname: "/rounds/[id]", params: { id: String(input.roundId) } })
                : undefined
            }
          />
        </Section>

        <Section label="HOW YOU PLAYED">
          <Card padding={spacing.lg + spacing.xs}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <Stat label="Score" value={summary.grossScore} />
              <Stat label="Counted as" value={summary.adjustedGrossScore} />
              <Stat label="Differential" value={summary.scoreDifferential.toFixed(1)} />
              <Stat label="Strokes given" value={summary.courseHandicap} />
            </View>
          </Card>
        </Section>

        {savedSummary ? (
          <Card>
            <BodySm>Saved. Tap the card above for the full story.</BodySm>
            <View style={{ marginTop: spacing.md, alignItems: "flex-start" }}>
              <Button onPress={() => router.replace("/")}>Done</Button>
            </View>
          </Card>
        ) : (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button variant="secondary" onPress={handleDiscard} style={{ flex: 1 }} haptic>
              Don&apos;t save
            </Button>
            <Button onPress={handleSave} disabled={saving} style={{ flex: 2 }}>
              {saving ? "Saving…" : "Save round"}
            </Button>
          </View>
        )}
      </StaggerEntry>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ alignItems: "flex-start", gap: spacing.xxs, flexShrink: 1 }}>
      <Micro style={{ opacity: 0.7 }}>{label}</Micro>
      <Display
        color="primary"
        tabular
        style={{ fontSize: 32, lineHeight: 36, letterSpacing: -0.4 }}
      >
        {value}
      </Display>
    </View>
  );
}

// keep imports tidy (reference for the linter)
void Body;

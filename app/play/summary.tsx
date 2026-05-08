import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

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
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [input]);

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="p-6 gap-3">
          <Text className="text-base text-red-700">{error}</Text>
          <Pressable
            onPress={() => router.replace("/")}
            className="rounded-lg bg-fairway-500 px-4 py-3"
          >
            <Text className="text-center text-base font-semibold text-white">Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!input || !projection) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const summary = savedSummary ?? projection;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6 gap-4">
        <Text className="text-2xl font-bold text-fairway-700">Round summary</Text>

        <SummaryRow label="Gross score" value={summary.grossScore} />
        <SummaryRow
          label="Adjusted gross score"
          value={summary.adjustedGrossScore}
          hint="Net Double Bogey caps applied"
        />
        <SummaryRow label="Score differential" value={summary.scoreDifferential.toFixed(1)} />
        <SummaryRow label="Course handicap" value={summary.courseHandicap} />
        <SummaryRow
          label="Handicap index (before)"
          value={summary.handicapIndexBefore?.toFixed(1) ?? "—"}
        />
        <SummaryRow
          label={savedSummary ? "Handicap index (now)" : "Projected handicap index"}
          value={summary.projectedHandicapIndex?.toFixed(1) ?? "—"}
          highlight
        />

        {savedSummary ? (
          <View className="gap-2">
            <View className="rounded-lg bg-fairway-50 p-3">
              <Text className="text-sm text-fairway-700">
                Round saved. Your handicap index has been updated.
              </Text>
            </View>
            <Pressable
              onPress={() => router.replace("/")}
              className="rounded-lg bg-fairway-500 px-4 py-3"
            >
              <Text className="text-center text-base font-semibold text-white">Done</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`rounded-lg bg-fairway-500 px-4 py-3 ${saving ? "opacity-50" : ""}`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {saving ? "Saving…" : "Save round"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string | number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <View
      className={`rounded-lg border p-3 ${
        highlight ? "border-fairway-500 bg-fairway-50" : "border-gray-200 bg-white"
      }`}
    >
      <Text className="text-xs uppercase tracking-wide text-gray-500">{label}</Text>
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      {hint ? <Text className="mt-1 text-xs text-gray-500">{hint}</Text> : null}
    </View>
  );
}

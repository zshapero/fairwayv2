import { Link, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import * as coursesRepo from "@/core/db/repositories/courses";
import * as holeScoresRepo from "@/core/db/repositories/holeScores";
import * as roundsRepo from "@/core/db/repositories/rounds";
import * as teeHolesRepo from "@/core/db/repositories/teeHoles";
import * as teesRepo from "@/core/db/repositories/tees";
import type { Course, HoleScore, Round, Tee, TeeHole } from "@/core/db/types";
import { adjustedGrossScore, strokesReceivedOnHole } from "@/core/handicap";
import { HandicapMovementCard } from "@/components/HandicapMovementCard";

interface Loaded {
  round: Round;
  course: Course;
  tee: Tee;
  teeHoles: TeeHole[];
  holeScores: HoleScore[];
}

export default function RoundDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idRaw = Array.isArray(params.id) ? params.id[0] : params.id;
  const roundId = idRaw ? Number(idRaw) : NaN;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!Number.isFinite(roundId)) throw new Error("Missing round id");
      const round = await roundsRepo.getRound(roundId);
      if (!round) throw new Error(`Round ${roundId} not found`);
      const [course, teesList, teeHoles, holeScores] = await Promise.all([
        coursesRepo.getCourse(round.course_id),
        teesRepo.listTeesForCourse(round.course_id),
        teeHolesRepo.listTeeHoles(round.tee_id),
        holeScoresRepo.listHoleScoresForRound(roundId),
      ]);
      const tee = teesList.find((t) => t.id === round.tee_id);
      if (!course || !tee) throw new Error("Round metadata missing");
      setLoaded({
        round,
        course,
        tee,
        teeHoles: [...teeHoles].sort((a, b) => a.hole_number - b.hole_number),
        holeScores,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [roundId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete this round?",
      "This will remove the round and its scores. Your handicap snapshots stay in history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await roundsRepo.deleteRound(roundId);
              router.replace("/");
            } catch (err) {
              Alert.alert("Delete failed", err instanceof Error ? err.message : String(err));
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [roundId]);

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="p-6 gap-3">
          <Text className="text-base text-red-700">{error}</Text>
          <Link href="/" className="text-sm text-fairway-700 underline">
            Back to home
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  if (!loaded) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const { round, course, tee, teeHoles, holeScores } = loaded;
  const scoresByHole = new Map(holeScores.map((s) => [s.hole_number, s]));
  const grossScores = teeHoles.map((h) => scoresByHole.get(h.hole_number)?.gross_score ?? h.par);
  const pars = teeHoles.map((h) => h.par);
  const totalGross = grossScores.reduce((a, b) => a + b, 0);

  // Reproduce AGS using a CH of 0 here as a fallback when the round has no
  // recorded course handicap; the differential we display is what was saved.
  const strokesReceivedPerHole = teeHoles.map((h) => strokesReceivedOnHole(0, h.stroke_index));
  const ags = adjustedGrossScore({ grossScores, pars, strokesReceivedPerHole });

  const playedDate = new Date(round.played_at).toLocaleDateString();

  return (
    <SafeAreaView className="flex-1 bg-fairway-50">
      <ScrollView contentContainerClassName="p-5 gap-4 pb-10">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-fairway-700">{course.name}</Text>
            <Text className="text-sm text-gray-600">
              {playedDate} · {tee.name} tee
            </Text>
          </View>
          <Link href="/" className="text-sm text-fairway-700 underline">
            Home
          </Link>
        </View>

        <View className="rounded-xl border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <Stat label="Gross" value={totalGross} />
            <Stat label="AGS" value={ags} />
            <Stat
              label="Differential"
              value={round.differential != null ? round.differential.toFixed(1) : "—"}
            />
          </View>
        </View>

        <HandicapMovementCard roundId={round.id} />

        <View className="rounded-xl border border-gray-200 bg-white">
          <View className="flex-row border-b border-gray-200 p-3">
            <Text className="w-10 text-xs uppercase tracking-wide text-gray-500">Hole</Text>
            <Text className="flex-1 text-xs uppercase tracking-wide text-gray-500">Par</Text>
            <Text className="flex-1 text-xs uppercase tracking-wide text-gray-500">Score</Text>
            <Text className="flex-1 text-right text-xs uppercase tracking-wide text-gray-500">
              ± Par
            </Text>
          </View>
          {teeHoles.map((hole) => {
            const score = scoresByHole.get(hole.hole_number);
            const gross = score?.gross_score ?? null;
            const diff = gross !== null ? gross - hole.par : null;
            return (
              <View
                key={hole.hole_number}
                className="flex-row border-b border-gray-100 p-3 last:border-b-0"
              >
                <Text className="w-10 text-sm text-gray-800">{hole.hole_number}</Text>
                <Text className="flex-1 text-sm text-gray-800">{hole.par}</Text>
                <Text className="flex-1 text-sm font-semibold text-gray-900">
                  {gross ?? "—"}
                </Text>
                <Text
                  className={`flex-1 text-right text-sm font-semibold ${
                    diff === null
                      ? "text-gray-400"
                      : diff < 0
                        ? "text-green-700"
                        : diff > 0
                          ? "text-red-700"
                          : "text-gray-800"
                  }`}
                >
                  {diff === null ? "—" : diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff}
                </Text>
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={handleDelete}
          disabled={busy}
          className={`rounded-lg border border-red-300 bg-red-50 px-4 py-3 ${busy ? "opacity-50" : ""}`}
        >
          <Text className="text-center text-base font-semibold text-red-700">
            Delete round
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View>
      <Text className="text-xs uppercase tracking-wide text-gray-500">{label}</Text>
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
    </View>
  );
}

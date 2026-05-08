import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import * as coursesRepo from "@/core/db/repositories/courses";
import * as roundsRepo from "@/core/db/repositories/rounds";
import type { Course, Round } from "@/core/db/types";
import { getCurrentPlayer } from "@/services/currentPlayer";
import { loadRoundDeltasForPlayer, type RoundIndexBadge } from "@/services/roundMovement";

interface RecentRound {
  round: Round;
  course: Course | null;
  delta: number | null;
}

export default function HomeScreen() {
  const [handicapIndex, setHandicapIndex] = useState<number | null | undefined>(undefined);
  const [recent, setRecent] = useState<RecentRound[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const player = await getCurrentPlayer();
          if (!cancelled) setHandicapIndex(player?.handicap_index ?? null);
          if (!player) {
            if (!cancelled) setRecent([]);
            return;
          }
          const [allRounds, deltas, allCourses] = await Promise.all([
            roundsRepo.listCompletedRoundsForPlayer(player.id),
            loadRoundDeltasForPlayer(player.id),
            coursesRepo.listCourses(),
          ]);
          const courseById = new Map(allCourses.map((c) => [c.id, c]));
          const deltaById = new Map<number, RoundIndexBadge>(
            deltas.map((d) => [d.roundId, d]),
          );
          const sorted = [...allRounds].sort((a, b) =>
            b.played_at.localeCompare(a.played_at),
          );
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
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const indexLabel =
    handicapIndex === undefined ? "…" : handicapIndex === null ? "—" : handicapIndex.toFixed(1);

  return (
    <SafeAreaView className="flex-1 bg-fairway-50">
      <ScrollView contentContainerClassName="p-5 gap-5 pb-10">
        <View className="items-center pt-8 gap-1">
          <Text className="text-4xl font-bold text-fairway-700">Fairway</Text>
          <Text className="mt-2 text-xs uppercase tracking-wide text-fairway-700/70">
            Handicap Index
          </Text>
          <Text className="text-5xl font-semibold text-fairway-700">{indexLabel}</Text>
          {handicapIndex === null ? (
            <Text className="mt-1 text-xs text-fairway-700/70">
              Play 3 rounds to establish your index.
            </Text>
          ) : null}
        </View>

        <View className="items-center gap-2">
          <Link
            href="/play/select-course"
            className="rounded-lg bg-fairway-500 px-5 py-3 text-base font-semibold text-white"
          >
            Start a round
          </Link>
          <Link href="/search" className="text-base font-semibold text-fairway-700 underline">
            Search Courses
          </Link>
          <Link href="/debug" className="text-sm text-fairway-700 underline">
            Debug
          </Link>
        </View>

        {recent.length > 0 ? (
          <View className="gap-2">
            <Text className="px-1 text-xs uppercase tracking-wide text-fairway-700/70">
              Recent rounds
            </Text>
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
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
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
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-xl bg-white p-3"
      style={{ elevation: 1 }}
    >
      <View className="flex-1 pr-3">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {course?.name ?? "Course"}
        </Text>
        <Text className="text-xs text-gray-500">{playedDate}</Text>
      </View>
      <View className="items-end">
        <Text className="text-sm text-gray-700">
          Diff{" "}
          <Text className="font-semibold">
            {round.differential != null ? round.differential.toFixed(1) : "—"}
          </Text>
        </Text>
        <DeltaBadge delta={delta} />
      </View>
    </Pressable>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <Text className="text-xs text-gray-400">No change</Text>;
  }
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) {
    return (
      <Text className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">No change</Text>
    );
  }
  const isDown = rounded < 0;
  const color = isDown ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
  const arrow = isDown ? "↓" : "↑";
  const label = `${arrow} ${Math.abs(rounded).toFixed(1)}`;
  return <Text className={`rounded px-2 py-0.5 text-xs font-semibold ${color}`}>{label}</Text>;
}

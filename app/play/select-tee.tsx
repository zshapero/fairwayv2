import { Link, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import * as coursesRepo from "@/core/db/repositories/courses";
import * as roundsRepo from "@/core/db/repositories/rounds";
import * as teesRepo from "@/core/db/repositories/tees";
import type { Course, Tee } from "@/core/db/types";
import { getOrCreateCurrentPlayer } from "@/services/currentPlayer";

export default function SelectTeeScreen() {
  const params = useLocalSearchParams<{ courseId?: string }>();
  const courseIdRaw = Array.isArray(params.courseId) ? params.courseId[0] : params.courseId;
  const courseId = courseIdRaw ? Number(courseIdRaw) : NaN;

  const [course, setCourse] = useState<Course | null>(null);
  const [tees, setTees] = useState<Tee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(courseId)) {
      setError("Missing courseId");
      return;
    }
    try {
      setError(null);
      const [c, t] = await Promise.all([
        coursesRepo.getCourse(courseId),
        teesRepo.listTeesForCourse(courseId),
      ]);
      setCourse(c);
      setTees(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = useCallback(
    async (tee: Tee) => {
      setStarting(tee.id);
      try {
        const player = await getOrCreateCurrentPlayer();
        const roundId = await roundsRepo.createDraftRound(player.id, courseId, tee.id);
        router.replace({
          pathname: "/play/score",
          params: { roundId: String(roundId) },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStarting(null);
      }
    },
    [courseId],
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between p-4 pb-2">
        <View>
          <Text className="text-2xl font-bold text-fairway-700">Choose a tee</Text>
          {course ? (
            <Text className="text-sm text-gray-600">{course.name}</Text>
          ) : null}
        </View>
        <Link href="/play/select-course" className="text-sm text-fairway-700 underline">
          Back
        </Link>
      </View>

      <ScrollView contentContainerClassName="p-4 gap-3">
        {tees === null ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator />
            <Text className="text-sm text-gray-600">Loading tees…</Text>
          </View>
        ) : null}

        {error ? (
          <View className="rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {tees && tees.length === 0 ? (
          <Text className="py-4 text-center text-sm text-gray-500">
            This course has no tee data. Try importing a different course.
          </Text>
        ) : null}

        {tees?.map((tee) => {
          const isStarting = starting === tee.id;
          return (
            <Pressable
              key={tee.id}
              onPress={() => handleSelect(tee)}
              disabled={starting !== null}
              className={`rounded-lg border border-gray-200 bg-white p-3 ${
                starting !== null && !isStarting ? "opacity-50" : ""
              }`}
            >
              <Text className="text-base font-semibold text-gray-900">{tee.name}</Text>
              <Text className="text-xs text-gray-600">
                Course rating {tee.course_rating} · Slope {tee.slope_rating}
                {tee.yardage ? ` · ${tee.yardage} yds` : ""}
              </Text>
              {isStarting ? (
                <Text className="mt-1 text-xs text-fairway-700">Starting round…</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

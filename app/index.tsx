import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { SafeAreaView, Text, View } from "react-native";

import { getCurrentPlayer } from "@/services/currentPlayer";

export default function HomeScreen() {
  const [handicapIndex, setHandicapIndex] = useState<number | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const player = await getCurrentPlayer();
          if (!cancelled) setHandicapIndex(player?.handicap_index ?? null);
        } catch {
          if (!cancelled) setHandicapIndex(null);
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
      <View className="flex-1 items-center justify-center gap-4">
        <Text className="text-5xl font-bold text-fairway-700">Fairway</Text>
        <View className="items-center">
          <Text className="text-xs uppercase tracking-wide text-fairway-700/70">
            Handicap Index
          </Text>
          <Text className="text-4xl font-semibold text-fairway-700">{indexLabel}</Text>
          {handicapIndex === null ? (
            <Text className="mt-1 text-xs text-fairway-700/70">
              Play 3 rounds to establish your index.
            </Text>
          ) : null}
        </View>
      </View>
      <View className="items-center pb-8 gap-2">
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
    </SafeAreaView>
  );
}

import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import * as recommendationsRepo from "@/core/db/repositories/recommendations";
import type { Recommendation } from "@/core/db/types";
import { getCurrentPlayer } from "@/services/currentPlayer";

export default function RecommendationsScreen() {
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const player = await getCurrentPlayer();
      if (!player) {
        setItems([]);
        return;
      }
      const recs = await recommendationsRepo.listActiveForPlayer(player.id);
      setItems(recs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleDismiss = useCallback(
    (rec: Recommendation) => {
      Alert.alert(
        "Dismiss this recommendation?",
        "We'll stop showing it unless the pattern keeps showing up in future rounds.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Dismiss",
            style: "destructive",
            onPress: async () => {
              try {
                await recommendationsRepo.dismissRecommendation(rec.id);
                setItems((prev) => prev?.filter((r) => r.id !== rec.id) ?? []);
              } catch (err) {
                Alert.alert("Dismiss failed", err instanceof Error ? err.message : String(err));
              }
            },
          },
        ],
      );
    },
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-fairway-50">
      <ScrollView contentContainerClassName="p-5 gap-4 pb-10">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-fairway-700">Recommendations</Text>
          <Link href="/" className="text-sm text-fairway-700 underline">
            Home
          </Link>
        </View>

        {error ? (
          <View className="rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {items === null ? (
          <View className="items-center py-8">
            <ActivityIndicator />
          </View>
        ) : null}

        {items && items.length === 0 && !error ? (
          <View className="rounded-2xl bg-white p-5">
            <Text className="text-base font-semibold text-fairway-700">
              No patterns yet
            </Text>
            <Text className="mt-1 text-sm text-gray-700">
              Post 5 to 10 rounds and we&apos;ll spot patterns. Every recommendation
              will explain the math that triggered it.
            </Text>
          </View>
        ) : null}

        {items?.map((rec) => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            expanded={expanded === rec.id}
            onToggle={() => setExpanded((id) => (id === rec.id ? null : rec.id))}
            onDismiss={() => handleDismiss(rec)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecommendationCard({
  rec,
  expanded,
  onToggle,
  onDismiss,
}: {
  rec: Recommendation;
  expanded: boolean;
  onToggle: () => void;
  onDismiss: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      className="rounded-2xl bg-white p-5"
      style={{ elevation: 2 }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900">{rec.title}</Text>
          <Text className="mt-1 text-sm text-gray-700">{rec.summary}</Text>
          {rec.threshold_label ? (
            <Text className="mt-1 text-xs uppercase tracking-wide text-fairway-700/80">
              {rec.threshold_label}
            </Text>
          ) : null}
        </View>
        <Text className="text-sm text-fairway-700">{expanded ? "Hide" : "Why"}</Text>
      </View>
      {expanded ? (
        <View className="mt-3 gap-3">
          <View className="rounded-lg bg-gray-50 p-3">
            <Text className="text-xs uppercase tracking-wide text-gray-500">The math</Text>
            <Text className="mt-1 text-sm text-gray-800">{rec.detail}</Text>
          </View>
          <View className="rounded-lg bg-fairway-50 p-3">
            <Text className="text-xs uppercase tracking-wide text-fairway-700/80">Drill</Text>
            <Text className="mt-1 text-sm text-gray-800">{rec.drill}</Text>
          </View>
          <Pressable
            onPress={onDismiss}
            className="self-start rounded-md border border-red-300 bg-red-50 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-red-700">Dismiss</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

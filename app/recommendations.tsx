import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import * as drillLogRepo from "@/core/db/repositories/drillLog";
import * as recommendationsRepo from "@/core/db/repositories/recommendations";
import type { ConfidenceLevel, Recommendation } from "@/core/db/types";
import { getCurrentPlayer } from "@/services/currentPlayer";

const TOP_OPPORTUNITIES = 3;

export default function RecommendationsScreen() {
  const [items, setItems] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAllOpportunities, setShowAllOpportunities] = useState(false);
  const [practiceFlash, setPracticeFlash] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const player = await getCurrentPlayer();
      if (!player) {
        setItems([]);
        setPlayerId(null);
        return;
      }
      setPlayerId(player.id);
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

  const sections = useMemo(() => {
    if (!items) return null;
    const positives = items
      .filter((r) => r.recommendation_type === "strength" || r.recommendation_type === "milestone")
      .sort((a, b) => b.created_at - a.created_at);
    const opportunities = items
      .filter((r) => r.recommendation_type === "opportunity")
      .sort((a, b) => b.priority_score - a.priority_score);
    return {
      positives,
      topOpportunities: opportunities.slice(0, TOP_OPPORTUNITIES),
      moreOpportunities: opportunities.slice(TOP_OPPORTUNITIES),
    };
  }, [items]);

  const handleDismiss = useCallback((rec: Recommendation) => {
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
  }, []);

  const handlePracticed = useCallback(
    async (rec: Recommendation) => {
      if (playerId === null) return;
      try {
        await drillLogRepo.logPractice({
          id: `drill_${rec.id}_${Date.now()}`,
          player_id: playerId,
          recommendation_id: rec.id,
          practiced_at: Date.now(),
        });
        setPracticeFlash(rec.id);
        setTimeout(() => {
          setPracticeFlash((current) => (current === rec.id ? null : current));
        }, 1800);
      } catch (err) {
        Alert.alert("Logging failed", err instanceof Error ? err.message : String(err));
      }
    },
    [playerId],
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
              Post 5 to 10 rounds and we&apos;ll spot patterns and strengths in
              your game.
            </Text>
          </View>
        ) : null}

        {sections && sections.positives.length > 0 ? (
          <View className="gap-2">
            <Text className="px-1 text-xs uppercase tracking-wide text-green-700">
              What&apos;s working
            </Text>
            {sections.positives.map((rec) => (
              <PositiveCard
                key={rec.id}
                rec={rec}
                expanded={expanded === rec.id}
                onToggle={() => setExpanded((id) => (id === rec.id ? null : rec.id))}
                onDismiss={() => handleDismiss(rec)}
              />
            ))}
          </View>
        ) : null}

        {sections && sections.topOpportunities.length > 0 ? (
          <View className="gap-2">
            <Text className="px-1 text-xs uppercase tracking-wide text-fairway-700/70">
              Top opportunities
            </Text>
            {sections.topOpportunities.map((rec) => (
              <OpportunityCard
                key={rec.id}
                rec={rec}
                expanded={expanded === rec.id}
                practiced={practiceFlash === rec.id}
                onToggle={() => setExpanded((id) => (id === rec.id ? null : rec.id))}
                onPracticed={() => handlePracticed(rec)}
                onDismiss={() => handleDismiss(rec)}
              />
            ))}
          </View>
        ) : null}

        {sections && sections.moreOpportunities.length > 0 ? (
          <View className="gap-2">
            <Pressable
              onPress={() => setShowAllOpportunities((v) => !v)}
              className="rounded-lg bg-white p-3"
            >
              <Text className="text-center text-sm font-semibold text-fairway-700">
                {showAllOpportunities
                  ? "Hide other opportunities"
                  : `Show more opportunities (${sections.moreOpportunities.length})`}
              </Text>
            </Pressable>
            {showAllOpportunities
              ? sections.moreOpportunities.map((rec) => (
                  <OpportunityCard
                    key={rec.id}
                    rec={rec}
                    expanded={expanded === rec.id}
                    practiced={practiceFlash === rec.id}
                    onToggle={() => setExpanded((id) => (id === rec.id ? null : rec.id))}
                    onPracticed={() => handlePracticed(rec)}
                    onDismiss={() => handleDismiss(rec)}
                  />
                ))
              : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const styles: Record<ConfidenceLevel, { bg: string; text: string; label: string }> = {
    high: { bg: "bg-green-600", text: "text-white", label: "High confidence" },
    moderate: { bg: "bg-amber-500", text: "text-white", label: "Moderate confidence" },
    emerging: { bg: "border border-gray-400", text: "text-gray-700", label: "Emerging" },
  };
  const s = styles[level];
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${s.bg}`}>
      <Text className={`text-xs font-semibold ${s.text}`}>{s.label}</Text>
    </View>
  );
}

function PositiveCard({
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
      className="rounded-2xl border border-green-300 bg-white p-4"
      style={{ elevation: 2 }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-bold text-green-700">{rec.title}</Text>
          <Text className="mt-1 text-sm text-gray-700">{rec.summary}</Text>
        </View>
        <Text className="text-sm text-green-700">{expanded ? "Hide" : "Why"}</Text>
      </View>
      {expanded ? (
        <View className="mt-3 gap-2">
          <View className="rounded-lg bg-green-50 p-3">
            <Text className="text-xs uppercase tracking-wide text-green-800">The math</Text>
            <Text className="mt-1 text-sm text-gray-800">{rec.detail}</Text>
          </View>
          {rec.drill ? (
            <View className="rounded-lg bg-fairway-50 p-3">
              <Text className="text-xs uppercase tracking-wide text-fairway-700/80">
                Keep going
              </Text>
              <Text className="mt-1 text-sm text-gray-800">{rec.drill}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={onDismiss}
            className="self-start rounded-md border border-gray-300 bg-white px-3 py-2"
          >
            <Text className="text-xs font-semibold text-gray-700">Dismiss</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

function OpportunityCard({
  rec,
  expanded,
  practiced,
  onToggle,
  onPracticed,
  onDismiss,
}: {
  rec: Recommendation;
  expanded: boolean;
  practiced: boolean;
  onToggle: () => void;
  onPracticed: () => void;
  onDismiss: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      className="rounded-2xl bg-white p-4"
      style={{ elevation: 2 }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-bold text-gray-900">{rec.title}</Text>
          <ConfidenceBadge level={rec.confidence} />
          <Text className="mt-1 text-sm text-gray-700">{rec.summary}</Text>
        </View>
        <Text className="text-sm text-fairway-700">{expanded ? "Hide" : "Why"}</Text>
      </View>
      {expanded ? (
        <View className="mt-3 gap-2">
          <View className="rounded-lg bg-gray-50 p-3">
            <Text className="text-xs uppercase tracking-wide text-gray-500">The math</Text>
            <Text className="mt-1 text-sm text-gray-800">{rec.detail}</Text>
          </View>
          {rec.drill ? (
            <View className="rounded-lg bg-fairway-50 p-3">
              <Text className="text-xs uppercase tracking-wide text-fairway-700/80">Drill</Text>
              <Text className="mt-1 text-sm text-gray-800">{rec.drill}</Text>
            </View>
          ) : null}
          <View className="flex-row gap-2">
            <Pressable
              onPress={onPracticed}
              className={`rounded-md px-3 py-2 ${practiced ? "bg-green-500" : "bg-fairway-500"}`}
            >
              <Text className="text-xs font-semibold text-white">
                {practiced ? "Logged ✓" : "Practiced today"}
              </Text>
            </Pressable>
            <Pressable
              onPress={onDismiss}
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2"
            >
              <Text className="text-xs font-semibold text-red-700">Dismiss</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

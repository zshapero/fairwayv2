import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";

import * as drillLogRepo from "@/core/db/repositories/drillLog";
import * as recommendationsRepo from "@/core/db/repositories/recommendations";
import type { ConfidenceLevel, Recommendation } from "@/core/db/types";
import { getCurrentPlayer } from "@/services/currentPlayer";
import {
  Body,
  Button,
  Card,
  Caption,
  EmptyState,
  GlassCard,
  Heading,
  Micro,
  Pill,
  Screen,
  Section,
  Title,
} from "@/components";
import { colors, spacing } from "@/design/tokens";

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
      "Hide this one?",
      "We'll stop showing it unless the pattern shows up again.",
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
    <Screen>
      <Title color="primary">Notes on your game</Title>

      {error ? (
        <Card>
          <Caption color="primary">{error}</Caption>
        </Card>
      ) : null}

      {items === null ? (
        <View style={{ alignItems: "center", paddingTop: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {items && items.length === 0 && !error ? (
        <EmptyState
          title="Nothing to flag yet"
          description="Play a few more rounds and we'll start spotting patterns."
        />
      ) : null}

      {sections && sections.positives.length > 0 ? (
        <Section label="GOING WELL">
          {sections.positives.map((rec) => (
            <PositiveCard
              key={rec.id}
              rec={rec}
              expanded={expanded === rec.id}
              onToggle={() => setExpanded((id) => (id === rec.id ? null : rec.id))}
              onDismiss={() => handleDismiss(rec)}
            />
          ))}
        </Section>
      ) : null}

      {sections && sections.topOpportunities.length > 0 ? (
        <Section label="THINGS TO WORK ON">
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
        </Section>
      ) : null}

      {sections && sections.moreOpportunities.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => setShowAllOpportunities((v) => !v)}
            style={{
              backgroundColor: colors.surfaceElevated,
              borderRadius: 14,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              alignItems: "center",
            }}
          >
            <Caption color="primary">
              {showAllOpportunities
                ? "Hide the rest"
                : `Show ${sections.moreOpportunities.length} more`}
            </Caption>
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
    </Screen>
  );
}

function ConfidencePill({ level }: { level: ConfidenceLevel }) {
  if (level === "high") return <Pill variant="positive">Strong signal</Pill>;
  if (level === "moderate") return <Pill variant="attention">Worth watching</Pill>;
  return (
    <Pill variant="neutral" outline>
      Early signal
    </Pill>
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
    <Card accent onPress={onToggle}>
      <View style={{ gap: spacing.sm }}>
        <Heading color="positive">{rec.title}</Heading>
        <Body color="textMuted">{rec.summary}</Body>
        {expanded ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <View
              style={{
                backgroundColor: colors.surfaceDeep,
                borderRadius: 14,
                padding: spacing.md,
              }}
            >
              <Micro color="accent">WHY WE THINK SO</Micro>
              <Body style={{ marginTop: 4 }}>{rec.detail}</Body>
            </View>
            {rec.drill ? (
              <View
                style={{ backgroundColor: colors.surfaceDeep, borderRadius: 14, padding: spacing.md }}
              >
                <Micro color="accent">KEEP IT UP</Micro>
                <Body style={{ marginTop: 4 }}>{rec.drill}</Body>
              </View>
            ) : null}
            <View style={{ alignItems: "flex-start" }}>
              <Button variant="ghost" onPress={onDismiss}>
                Dismiss
              </Button>
            </View>
          </View>
        ) : null}
      </View>
    </Card>
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
    <Pressable onPress={onToggle}>
      <GlassCard>
        <View style={{ gap: spacing.sm }}>
          <Heading>{rec.title}</Heading>
          <ConfidencePill level={rec.confidence} />
          <Body color="textMuted">{rec.summary}</Body>
          {expanded ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <View
                style={{
                  backgroundColor: colors.surfaceDeep,
                  borderRadius: 14,
                  padding: spacing.md,
                }}
              >
                <Micro color="accent">WHY WE THINK SO</Micro>
                <Body style={{ marginTop: 4 }}>{rec.detail}</Body>
              </View>
              {rec.drill ? (
                <View
                  style={{
                    backgroundColor: colors.surfaceDeep,
                    borderRadius: 14,
                    padding: spacing.md,
                  }}
                >
                  <Micro color="accent">TRY THIS</Micro>
                  <Body style={{ marginTop: 4 }}>{rec.drill}</Body>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", gap: spacing.xs }}>
                <Button onPress={onPracticed}>
                  {practiced ? "Logged ✓" : "Did this today"}
                </Button>
                <Button variant="ghost" onPress={onDismiss}>
                  Dismiss
                </Button>
              </View>
            </View>
          ) : null}
        </View>
      </GlassCard>
    </Pressable>
  );
}

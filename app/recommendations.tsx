import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Check, Sparkle, X } from "lucide-react-native";

import * as drillLogRepo from "@/core/db/repositories/drillLog";
import * as recommendationsRepo from "@/core/db/repositories/recommendations";
import type { ConfidenceLevel, Recommendation } from "@/core/db/types";
import { getCurrentPlayer } from "@/services/currentPlayer";
import {
  Body,
  BodySm,
  Card,
  Caption,
  EmptyState,
  GlassCard,
  Heading,
  Micro,
  Pill,
  Screen,
  Section,
  SerifBody,
  StaggerEntry,
  Title,
} from "@/components";
import { colors, radii, spacing } from "@/design/tokens";

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
          text: "Hide",
          style: "destructive",
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              await recommendationsRepo.dismissRecommendation(rec.id);
              setItems((prev) => prev?.filter((r) => r.id !== rec.id) ?? []);
            } catch (err) {
              Alert.alert("Couldn't hide", err instanceof Error ? err.message : String(err));
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
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
        Alert.alert("Couldn't log it", err instanceof Error ? err.message : String(err));
      }
    },
    [playerId],
  );

  return (
    <Screen>
      <StaggerEntry>
        <Title color="primary">Notes on your game</Title>

        {error ? (
          <Card>
            <BodySm color="primary">{error}</BodySm>
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
                borderRadius: radii.button,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                alignItems: "center",
                borderWidth: 0.5,
                borderColor: colors.cardBorder,
              }}
            >
              <BodySm color="primary">
                {showAllOpportunities
                  ? "Hide the rest"
                  : `Show ${sections.moreOpportunities.length} more`}
              </BodySm>
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
      </StaggerEntry>
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
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Sparkle color={colors.accent} size={16} strokeWidth={1.5} />
            <SerifBody color="positive">{rec.title}</SerifBody>
          </View>
          <Body color="textMuted">{rec.summary}</Body>
        </View>
      </View>
      {expanded ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <DetailBlock label="WHY WE THINK SO" body={rec.detail} />
          {rec.drill ? <DetailBlock label="KEEP IT UP" body={rec.drill} /> : null}
          <Pressable
            onPress={onDismiss}
            style={{ alignSelf: "flex-start", paddingVertical: spacing.xs }}
          >
            <Caption color="textMuted">Hide</Caption>
          </Pressable>
        </View>
      ) : null}
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
      <GlassCard padding={spacing.lg + spacing.xs}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <SerifBody>{rec.title}</SerifBody>
            <Body color="textMuted">{rec.summary}</Body>
          </View>
          <ConfidencePill level={rec.confidence} />
        </View>
        {expanded ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <DetailBlock label="WHY WE THINK SO" body={rec.detail} />
            {rec.drill ? <DetailBlock label="TRY THIS" body={rec.drill} /> : null}
            <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.xxs }}>
              <PracticedButton practiced={practiced} onPress={onPracticed} />
              <Pressable
                onPress={onDismiss}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                  borderRadius: radii.button,
                  borderWidth: 1,
                  borderColor: "rgba(155, 45, 45, 0.35)",
                }}
              >
                <X color={colors.danger} size={15} strokeWidth={1.5} />
                <Caption style={{ color: colors.danger, fontFamily: "Inter_500Medium" }}>Hide</Caption>
              </Pressable>
            </View>
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

function DetailBlock({ label, body }: { label: string; body: string }) {
  return (
    <View
      style={{
        backgroundColor: "rgba(240, 235, 224, 0.7)",
        borderRadius: radii.sm,
        padding: spacing.md,
        gap: spacing.xxs,
      }}
    >
      <Micro color="accent" style={{ opacity: 0.75 }}>
        {label}
      </Micro>
      <BodySm color="text">{body}</BodySm>
    </View>
  );
}

function PracticedButton({ practiced, onPress }: { practiced: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radii.button,
        backgroundColor: practiced ? colors.positive : colors.primary,
      }}
    >
      <Check color={colors.textOnPrimary} size={15} strokeWidth={2} />
      <Caption color="textOnPrimary" style={{ fontFamily: "Inter_500Medium" }}>
        {practiced ? "Logged" : "Did this today"}
      </Caption>
    </Pressable>
  );
}

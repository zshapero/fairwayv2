import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInRight, FadeOut } from "react-native-reanimated";

import * as holeScoresRepo from "@/core/db/repositories/holeScores";
import * as roundsRepo from "@/core/db/repositories/rounds";
import * as teeHolesRepo from "@/core/db/repositories/teeHoles";
import * as teesRepo from "@/core/db/repositories/tees";
import type {
  FairwayMissDirection,
  GirMissDirection,
  HoleScore,
  Round,
  Tee,
  TeeHole,
} from "@/core/db/types";
import {
  Body,
  Button,
  Card,
  Caption,
  Display,
  GlassCard,
  Heading,
  Micro,
  Screen,
  Title,
} from "@/components";
import { colors, radii, spacing, typography } from "@/design/tokens";

interface HoleEntry {
  gross_score: number;
  putts: number | null;
  fairway_hit: number | null;
  green_in_regulation: number | null;
  penalty_strokes: number | null;
  fairway_miss_direction: FairwayMissDirection;
  gir_miss_direction: GirMissDirection;
  hit_from_sand: number;
}

type FairwayState = "hit" | "left" | "right" | null;
type GirState = "hit" | "left" | "right" | "short" | "long" | null;

function defaultEntry(par: number): HoleEntry {
  return {
    gross_score: par,
    putts: null,
    fairway_hit: null,
    green_in_regulation: null,
    penalty_strokes: null,
    fairway_miss_direction: null,
    gir_miss_direction: null,
    hit_from_sand: 0,
  };
}

function entryFromRow(row: HoleScore): HoleEntry {
  return {
    gross_score: row.gross_score,
    putts: row.putts,
    fairway_hit: row.fairway_hit,
    green_in_regulation: row.green_in_regulation,
    penalty_strokes: row.penalty_strokes,
    fairway_miss_direction: row.fairway_miss_direction,
    gir_miss_direction: row.gir_miss_direction,
    hit_from_sand: row.hit_from_sand ?? 0,
  };
}

function fairwayStateOf(entry: HoleEntry): FairwayState {
  if (entry.fairway_hit === 1) return "hit";
  if (entry.fairway_miss_direction === "left") return "left";
  if (entry.fairway_miss_direction === "right") return "right";
  return null;
}

function applyFairwayState(state: FairwayState): Pick<HoleEntry, "fairway_hit" | "fairway_miss_direction"> {
  switch (state) {
    case "hit":
      return { fairway_hit: 1, fairway_miss_direction: null };
    case "left":
      return { fairway_hit: 0, fairway_miss_direction: "left" };
    case "right":
      return { fairway_hit: 0, fairway_miss_direction: "right" };
    default:
      return { fairway_hit: null, fairway_miss_direction: null };
  }
}

function girStateOf(entry: HoleEntry): GirState {
  if (entry.green_in_regulation === 1) return "hit";
  const dir = entry.gir_miss_direction;
  if (dir === "left" || dir === "right" || dir === "short" || dir === "long") return dir;
  return null;
}

function applyGirState(state: GirState): Pick<HoleEntry, "green_in_regulation" | "gir_miss_direction"> {
  switch (state) {
    case "hit":
      return { green_in_regulation: 1, gir_miss_direction: null };
    case "left":
    case "right":
    case "short":
    case "long":
      return { green_in_regulation: 0, gir_miss_direction: state };
    default:
      return { green_in_regulation: null, gir_miss_direction: null };
  }
}

export default function ScoreScreen() {
  const params = useLocalSearchParams<{ roundId?: string }>();
  const roundIdRaw = Array.isArray(params.roundId) ? params.roundId[0] : params.roundId;
  const roundId = roundIdRaw ? Number(roundIdRaw) : NaN;

  const [round, setRound] = useState<Round | null>(null);
  const [tee, setTee] = useState<Tee | null>(null);
  const [teeHoles, setTeeHoles] = useState<TeeHole[] | null>(null);
  const [entries, setEntries] = useState<Record<number, HoleEntry>>({});
  const [holeIndex, setHoleIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!Number.isFinite(roundId)) throw new Error("Missing roundId");
        const r = await roundsRepo.getRound(roundId);
        if (!r) throw new Error(`Round ${roundId} not found`);
        const teesList = await teesRepo.listTeesForCourse(r.course_id);
        const t = teesList.find((row) => row.id === r.tee_id) ?? null;
        if (!t) throw new Error("Tee not found");
        const holes = await teeHolesRepo.listTeeHoles(r.tee_id);
        const sortedHoles = [...holes].sort((a, b) => a.hole_number - b.hole_number);
        const existing = await holeScoresRepo.listHoleScoresForRound(roundId);

        const initial: Record<number, HoleEntry> = {};
        for (const hole of sortedHoles) {
          initial[hole.hole_number] = defaultEntry(hole.par);
        }
        for (const row of existing) {
          initial[row.hole_number] = entryFromRow(row);
        }

        if (cancelled) return;
        setRound(r);
        setTee(t);
        setTeeHoles(sortedHoles);
        setEntries(initial);
        const nextHoleIdx = sortedHoles.findIndex(
          (hole) => !existing.find((row) => row.hole_number === hole.hole_number),
        );
        setHoleIndex(nextHoleIdx === -1 ? sortedHoles.length - 1 : nextHoleIdx);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  const totalHoles = teeHoles?.length ?? 0;
  const currentHole = teeHoles?.[holeIndex] ?? null;
  const currentEntry = currentHole ? entries[currentHole.hole_number] : null;

  const totals = useMemo(() => {
    if (!teeHoles) return { strokes: 0, par: 0 };
    let strokes = 0, par = 0;
    for (let i = 0; i < holeIndex; i++) {
      const hole = teeHoles[i];
      if (!hole) continue;
      const entry = entries[hole.hole_number];
      if (!entry) continue;
      strokes += entry.gross_score;
      par += hole.par;
    }
    return { strokes, par };
  }, [teeHoles, entries, holeIndex]);

  const updateEntry = useCallback((holeNumber: number, partial: Partial<HoleEntry>) => {
    setEntries((prev) => {
      const existing = prev[holeNumber];
      if (!existing) return prev;
      return { ...prev, [holeNumber]: { ...existing, ...partial } };
    });
  }, []);

  const persistCurrentHole = useCallback(async () => {
    if (!currentHole || !currentEntry) return;
    await holeScoresRepo.upsertHoleScore({
      round_id: roundId,
      hole_number: currentHole.hole_number,
      gross_score: currentEntry.gross_score,
      par: currentHole.par,
      putts: currentEntry.putts,
      fairway_hit: currentEntry.fairway_hit,
      green_in_regulation: currentEntry.green_in_regulation,
      penalty_strokes: currentEntry.penalty_strokes,
      fairway_miss_direction: currentEntry.fairway_miss_direction,
      gir_miss_direction: currentEntry.gir_miss_direction,
      hit_from_sand: currentEntry.hit_from_sand,
    });
  }, [currentEntry, currentHole, roundId]);

  const handleNext = useCallback(async () => {
    if (!teeHoles || !currentHole) return;
    setSaving(true);
    try {
      await persistCurrentHole();
      if (holeIndex >= teeHoles.length - 1) {
        router.replace({ pathname: "/play/summary", params: { roundId: String(roundId) } });
      } else {
        Haptics.selectionAsync().catch(() => {});
        setHoleIndex((idx) => idx + 1);
      }
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [currentHole, holeIndex, persistCurrentHole, roundId, teeHoles]);

  const handlePrev = useCallback(async () => {
    if (holeIndex === 0) return;
    setSaving(true);
    try {
      await persistCurrentHole();
      setHoleIndex((idx) => idx - 1);
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [holeIndex, persistCurrentHole]);

  const handleSaveAndExit = useCallback(async () => {
    setSaving(true);
    try {
      await persistCurrentHole();
      router.replace("/");
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [persistCurrentHole]);

  if (error) {
    return (
      <Screen>
        <Body color="primary">{error}</Body>
        <Button variant="ghost" onPress={() => router.replace("/")}>
          Back to home
        </Button>
      </Screen>
    );
  }

  if (!round || !tee || !teeHoles || !currentHole || !currentEntry) {
    return (
      <Screen>
        <View style={{ alignItems: "center", paddingTop: spacing.hero }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const currentTotal = totals.strokes + currentEntry.gross_score;
  const currentTotalPar = totals.par + currentHole.par;
  const relative = currentTotal - currentTotalPar;
  const par = currentHole.par;
  const isPar4Or5 = par >= 4;

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Caption>
          Through this hole {currentTotal} ·{" "}
          <Caption color="primary">
            {relative === 0 ? "E" : relative > 0 ? `+${relative}` : relative}
          </Caption>
        </Caption>
        <Pressable onPress={handleSaveAndExit} disabled={saving}>
          <Caption color="primary">Pick this up later</Caption>
        </Pressable>
      </View>

      <Animated.View
        key={`hole-${currentHole.hole_number}`}
        entering={FadeInRight.duration(300).springify().damping(20)}
        exiting={FadeOut.duration(180)}
      >
        <GlassCard>
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <Micro color="accent" style={{ opacity: 0.85 }}>
              HOLE {currentHole.hole_number}
            </Micro>
            <Display color="primary" style={{ fontSize: 96, lineHeight: 100 }}>
              {currentHole.hole_number}
            </Display>
            <Heading color="text">Par {par}</Heading>
            <Caption>
              {currentHole.yardage ? `${currentHole.yardage}y · ` : ""}of {totalHoles} · HCP{" "}
              {currentHole.stroke_index}
            </Caption>
          </View>
        </GlassCard>
      </Animated.View>

      <Card>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Micro>SCORE</Micro>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xl }}>
            <StepperButton
              label="−"
              onPress={() =>
                updateEntry(currentHole.hole_number, {
                  gross_score: Math.max(1, currentEntry.gross_score - 1),
                })
              }
            />
            <Title color="primary" style={{ fontSize: 64, lineHeight: 72, minWidth: 80, textAlign: "center" }}>
              {currentEntry.gross_score}
            </Title>
            <StepperButton
              label="+"
              onPress={() =>
                updateEntry(currentHole.hole_number, {
                  gross_score: Math.min(20, currentEntry.gross_score + 1),
                })
              }
            />
          </View>
        </View>
      </Card>

      <Pressable
        onPress={() => setDetailsExpanded((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: spacing.md,
          borderRadius: radii.sm,
          backgroundColor: colors.surfaceDeep,
        }}
      >
        <Heading>How it played</Heading>
        <Caption color="primary">{detailsExpanded ? "Hide" : "Show"}</Caption>
      </Pressable>

      {detailsExpanded ? (
        <View style={{ gap: spacing.md }}>
          {isPar4Or5 ? (
            <PillRow
              label="Fairway?"
              options={[
                { value: "hit", label: "Hit", tone: "good" },
                { value: "left", label: "Left", tone: "miss" },
                { value: "right", label: "Right", tone: "miss" },
              ]}
              selected={fairwayStateOf(currentEntry)}
              onSelect={(next) =>
                updateEntry(currentHole.hole_number, applyFairwayState(next))
              }
            />
          ) : null}

          <PillRow
            label={par >= 5 ? "Green in 3?" : par === 3 ? "Green?" : "Green in 2?"}
            options={[
              { value: "hit", label: "Yes", tone: "good" },
              { value: "left", label: "Left", tone: "miss" },
              { value: "right", label: "Right", tone: "miss" },
              { value: "short", label: "Short", tone: "miss" },
              { value: "long", label: "Long", tone: "miss" },
            ]}
            selected={girStateOf(currentEntry)}
            onSelect={(next) => updateEntry(currentHole.hole_number, applyGirState(next))}
          />

          <PillRow
            label="Bunker shot?"
            options={[
              { value: "no", label: "No", tone: "neutral" },
              { value: "yes", label: "Yes", tone: "sand" },
            ]}
            selected={currentEntry.hit_from_sand === 1 ? "yes" : "no"}
            onSelect={(next) =>
              updateEntry(currentHole.hole_number, { hit_from_sand: next === "yes" ? 1 : 0 })
            }
            alwaysSelected
          />

          <OptionalNumber
            label="Putts"
            value={currentEntry.putts}
            min={0}
            max={10}
            onChange={(v) => updateEntry(currentHole.hole_number, { putts: v })}
          />
          <OptionalNumber
            label="Penalties"
            value={currentEntry.penalty_strokes}
            min={0}
            max={10}
            onChange={(v) => updateEntry(currentHole.hole_number, { penalty_strokes: v })}
          />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button
          variant="secondary"
          onPress={handlePrev}
          disabled={saving || holeIndex === 0}
          style={{ flex: 1 }}
        >
          Back
        </Button>
        <Button onPress={handleNext} disabled={saving} style={{ flex: 2 }}>
          {holeIndex >= totalHoles - 1 ? "Done" : "Next hole"}
        </Button>
      </View>
    </Screen>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 56,
        width: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Title color="textOnPrimary" style={{ fontSize: 28, lineHeight: 32 }}>
        {label}
      </Title>
    </Pressable>
  );
}

interface OptionalNumberProps {
  label: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (next: number | null) => void;
}

function OptionalNumber({ label, value, min, max, onChange }: OptionalNumberProps) {
  const enabled = value !== null;
  return (
    <View
      style={{
        backgroundColor: colors.surfaceElevated,
        padding: spacing.md,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Body>{label}</Body>
        <Pressable
          onPress={() => onChange(enabled ? null : 0)}
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.sm,
            backgroundColor: enabled ? colors.primary : colors.surfaceDeep,
          }}
        >
          <Micro style={{ color: enabled ? colors.textOnPrimary : colors.textMuted }}>
            {enabled ? "Tracking" : "Skip"}
          </Micro>
        </Pressable>
      </View>
      {enabled ? (
        <View
          style={{
            marginTop: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <SmallStepper label="−" onPress={() => onChange(Math.max(min, (value ?? 0) - 1))} />
          <Title color="text" style={{ fontSize: 28, lineHeight: 32, minWidth: 48, textAlign: "center" }}>
            {value}
          </Title>
          <SmallStepper label="+" onPress={() => onChange(Math.min(max, (value ?? 0) + 1))} />
        </View>
      ) : null}
    </View>
  );
}

function SmallStepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 36,
        width: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Body color="textOnPrimary" style={{ fontFamily: typography.heading.fontFamily }}>
        {label}
      </Body>
    </Pressable>
  );
}

type PillTone = "good" | "miss" | "neutral" | "sand";
interface PillOption<T extends string> {
  value: T;
  label: string;
  tone: PillTone;
}
interface PillRowProps<T extends string> {
  label: string;
  options: ReadonlyArray<PillOption<T>>;
  selected: T | null;
  onSelect: (next: T | null) => void;
  alwaysSelected?: boolean;
}

function pillStyle(tone: PillTone, selected: boolean) {
  if (!selected) return { bg: colors.surfaceDeep, fg: colors.textMuted };
  switch (tone) {
    case "good":
      return { bg: colors.primary, fg: colors.textOnPrimary };
    case "miss":
      return { bg: colors.accent, fg: "#1A1A1A" };
    case "sand":
      return { bg: "#D4B886", fg: "#1A1A1A" };
    case "neutral":
      return { bg: colors.text, fg: colors.surface };
  }
}

function PillRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
  alwaysSelected,
}: PillRowProps<T>) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceElevated,
        padding: spacing.md,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <Heading style={{ fontSize: 15, marginBottom: spacing.sm }}>{label}</Heading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        {options.map((opt) => {
          const isSelected = selected === opt.value;
          const style = pillStyle(opt.tone, isSelected);
          const onPress = () => {
            Haptics.selectionAsync().catch(() => {});
            if (isSelected && !alwaysSelected) onSelect(null);
            else onSelect(opt.value);
          };
          return (
            <Pressable
              key={opt.value}
              onPress={onPress}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: 999,
                backgroundColor: style.bg,
              }}
            >
              <Body style={{ color: style.fg, fontFamily: typography.heading.fontFamily, fontSize: 14 }}>
                {opt.label}
              </Body>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

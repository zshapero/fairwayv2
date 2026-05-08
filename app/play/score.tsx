import { Link, router, useLocalSearchParams } from "expo-router";
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
import type {
  FairwayMissDirection,
  GirMissDirection,
  HoleScore,
  Round,
  Tee,
  TeeHole,
} from "@/core/db/types";

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
    let strokes = 0;
    let par = 0;
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

  const updateEntry = useCallback(
    (holeNumber: number, partial: Partial<HoleEntry>) => {
      setEntries((prev) => {
        const existing = prev[holeNumber];
        if (!existing) return prev;
        return { ...prev, [holeNumber]: { ...existing, ...partial } };
      });
    },
    [],
  );

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
        router.replace({
          pathname: "/play/summary",
          params: { roundId: String(roundId) },
        });
      } else {
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

  if (!round || !tee || !teeHoles || !currentHole || !currentEntry) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const currentTotal = totals.strokes + currentEntry.gross_score;
  const currentTotalPar = totals.par + currentHole.par;
  const relative = currentTotal - currentTotalPar;
  const par = currentHole.par;
  const isPar4Or5 = par >= 4;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6 gap-5 pb-10">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600">
            Total {currentTotal} · {relative === 0 ? "E" : relative > 0 ? `+${relative}` : relative}
          </Text>
          <Pressable onPress={handleSaveAndExit} disabled={saving}>
            <Text className="text-sm text-fairway-700 underline">Save and continue later</Text>
          </Pressable>
        </View>

        <View className="items-center gap-1">
          <Text className="text-sm uppercase tracking-wide text-gray-500">
            Hole {currentHole.hole_number} of {totalHoles}
          </Text>
          <Text className="text-6xl font-bold text-fairway-700">{currentHole.hole_number}</Text>
          <Text className="text-base text-gray-700">
            Par {par}
            {currentHole.yardage ? ` · ${currentHole.yardage} yds` : ""} · HCP {currentHole.stroke_index}
          </Text>
        </View>

        <View className="items-center gap-3 rounded-xl border border-gray-200 p-4">
          <Text className="text-sm text-gray-600">Strokes</Text>
          <View className="flex-row items-center gap-6">
            <StepperButton
              label="−"
              onPress={() =>
                updateEntry(currentHole.hole_number, {
                  gross_score: Math.max(1, currentEntry.gross_score - 1),
                })
              }
            />
            <Text className="w-16 text-center text-5xl font-bold text-gray-900">
              {currentEntry.gross_score}
            </Text>
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

        <Pressable
          onPress={() => setDetailsExpanded((v) => !v)}
          className="flex-row items-center justify-between rounded-xl border border-gray-200 p-3"
        >
          <Text className="text-base font-semibold text-gray-800">Hole details</Text>
          <Text className="text-sm text-fairway-700">{detailsExpanded ? "Hide" : "Show"}</Text>
        </Pressable>

        {detailsExpanded ? (
          <View className="gap-4">
            {isPar4Or5 ? (
              <PillRow
                label="Fairway"
                options={[
                  { value: "hit", label: "Hit", tone: "good" },
                  { value: "left", label: "Missed Left", tone: "miss" },
                  { value: "right", label: "Missed Right", tone: "miss" },
                ]}
                selected={fairwayStateOf(currentEntry)}
                onSelect={(next) =>
                  updateEntry(currentHole.hole_number, applyFairwayState(next))
                }
              />
            ) : null}

            <PillRow
              label="Green in regulation"
              options={[
                { value: "hit", label: "Hit", tone: "good" },
                { value: "left", label: "Left", tone: "miss" },
                { value: "right", label: "Right", tone: "miss" },
                { value: "short", label: "Short", tone: "miss" },
                { value: "long", label: "Long", tone: "miss" },
              ]}
              selected={girStateOf(currentEntry)}
              onSelect={(next) =>
                updateEntry(currentHole.hole_number, applyGirState(next))
              }
            />

            <PillRow
              label="Sand"
              options={[
                { value: "no", label: "No sand", tone: "neutral" },
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
              label="Penalty strokes"
              value={currentEntry.penalty_strokes}
              min={0}
              max={10}
              onChange={(v) => updateEntry(currentHole.hole_number, { penalty_strokes: v })}
            />
          </View>
        ) : null}

        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handlePrev}
            disabled={saving || holeIndex === 0}
            className={`flex-1 rounded-lg border border-gray-300 px-4 py-3 ${
              saving || holeIndex === 0 ? "opacity-50" : ""
            }`}
          >
            <Text className="text-center text-base font-semibold text-gray-700">Back</Text>
          </Pressable>
          <Pressable
            onPress={handleNext}
            disabled={saving}
            className={`flex-[2] rounded-lg bg-fairway-500 px-4 py-3 ${saving ? "opacity-50" : ""}`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {holeIndex >= totalHoles - 1 ? "Finish round" : "Next hole"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-14 w-14 items-center justify-center rounded-full bg-fairway-500"
    >
      <Text className="text-3xl font-bold text-white">{label}</Text>
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
    <View className="rounded-xl border border-gray-200 p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base text-gray-800">{label}</Text>
        <Pressable
          onPress={() => onChange(enabled ? null : 0)}
          className={`rounded-md px-3 py-1 ${enabled ? "bg-fairway-500" : "bg-gray-200"}`}
        >
          <Text className={`text-xs font-semibold ${enabled ? "text-white" : "text-gray-700"}`}>
            {enabled ? "Track" : "Off"}
          </Text>
        </Pressable>
      </View>
      {enabled ? (
        <View className="mt-3 flex-row items-center gap-4">
          <StepperSmall label="−" onPress={() => onChange(Math.max(min, (value ?? 0) - 1))} />
          <Text className="w-12 text-center text-2xl font-semibold text-gray-900">{value}</Text>
          <StepperSmall label="+" onPress={() => onChange(Math.min(max, (value ?? 0) + 1))} />
        </View>
      ) : null}
    </View>
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
  /** When true, tapping the selected pill keeps it selected (no toggle-off). */
  alwaysSelected?: boolean;
}

function pillClasses(tone: PillTone, selected: boolean): string {
  if (!selected) return "bg-gray-100";
  switch (tone) {
    case "good":
      return "bg-green-500";
    case "miss":
      return "bg-orange-500";
    case "sand":
      // Sand-colored chip; #d4b886 in tailwind is closest to amber-300/yellow-300.
      return "bg-amber-300";
    case "neutral":
      return "bg-gray-400";
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
    <View className="rounded-xl border border-gray-200 p-3">
      <Text className="mb-2 text-sm font-semibold text-gray-800">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected === opt.value;
          const onPress = () => {
            if (isSelected && !alwaysSelected) {
              onSelect(null);
            } else {
              onSelect(opt.value);
            }
          };
          const textColor =
            isSelected && opt.tone !== "sand" ? "text-white" : "text-gray-800";
          return (
            <Pressable
              key={opt.value}
              onPress={onPress}
              className={`rounded-full px-4 py-2 ${pillClasses(opt.tone, isSelected)}`}
            >
              <Text className={`text-sm font-semibold ${textColor}`}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StepperSmall({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full bg-fairway-500"
    >
      <Text className="text-lg font-bold text-white">{label}</Text>
    </Pressable>
  );
}

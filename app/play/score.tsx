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
import type { HoleScore, Round, Tee, TeeHole } from "@/core/db/types";

interface HoleEntry {
  gross_score: number;
  putts: number | null;
  fairway_hit: number | null;
  green_in_regulation: number | null;
  penalty_strokes: number | null;
}

function defaultEntry(par: number): HoleEntry {
  return {
    gross_score: par,
    putts: null,
    fairway_hit: null,
    green_in_regulation: null,
    penalty_strokes: null,
  };
}

function entryFromRow(row: HoleScore): HoleEntry {
  return {
    gross_score: row.gross_score,
    putts: row.putts,
    fairway_hit: row.fairway_hit,
    green_in_regulation: row.green_in_regulation,
    penalty_strokes: row.penalty_strokes,
  };
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!Number.isFinite(roundId)) {
          throw new Error("Missing roundId");
        }
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
        // Resume on the first hole that hasn't been recorded yet.
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
      putts: currentEntry.putts,
      fairway_hit: currentEntry.fairway_hit,
      green_in_regulation: currentEntry.green_in_regulation,
      penalty_strokes: currentEntry.penalty_strokes,
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
  const allowFairwayToggle = par >= 4;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6 gap-5">
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

        <OptionalNumber
          label="Putts"
          value={currentEntry.putts}
          min={0}
          max={10}
          onChange={(v) => updateEntry(currentHole.hole_number, { putts: v })}
        />
        {allowFairwayToggle ? (
          <OptionalToggle
            label="Fairway hit"
            value={currentEntry.fairway_hit}
            onChange={(v) => updateEntry(currentHole.hole_number, { fairway_hit: v })}
          />
        ) : null}
        <OptionalToggle
          label="Green in regulation"
          value={currentEntry.green_in_regulation}
          onChange={(v) => updateEntry(currentHole.hole_number, { green_in_regulation: v })}
        />
        <OptionalNumber
          label="Penalty strokes"
          value={currentEntry.penalty_strokes}
          min={0}
          max={10}
          onChange={(v) => updateEntry(currentHole.hole_number, { penalty_strokes: v })}
        />

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

interface OptionalToggleProps {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
}

function OptionalToggle({ label, value, onChange }: OptionalToggleProps) {
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
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => onChange(1)}
            className={`flex-1 rounded-md px-3 py-2 ${value === 1 ? "bg-fairway-500" : "bg-gray-100"}`}
          >
            <Text
              className={`text-center text-sm font-semibold ${value === 1 ? "text-white" : "text-gray-700"}`}
            >
              Yes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onChange(0)}
            className={`flex-1 rounded-md px-3 py-2 ${value === 0 ? "bg-gray-700" : "bg-gray-100"}`}
          >
            <Text
              className={`text-center text-sm font-semibold ${value === 0 ? "text-white" : "text-gray-700"}`}
            >
              No
            </Text>
          </Pressable>
        </View>
      ) : null}
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

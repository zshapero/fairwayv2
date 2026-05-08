import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import { clearAllData, getDatabase, getSchemaVersion } from "@/core/db/database";
import { ALL_TABLES, type TableName } from "@/core/db/types";
import { seedDemoData } from "@/core/db/seed";
import {
  adjustedGrossScore,
  courseHandicap,
  scoreDifferential,
  strokesReceivedOnHole,
} from "@/core/handicap";
import { GolfCourseApiError, hasApiKey, searchClubs } from "@/services/golfCourseApi";
import { generateSampleRound } from "@/services/sampleRound";

interface Status {
  connected: boolean;
  schemaVersion: number | null;
  counts: Record<TableName, number>;
  error: string | null;
}

const EMPTY_COUNTS = ALL_TABLES.reduce(
  (acc, t) => ({ ...acc, [t]: 0 }),
  {} as Record<TableName, number>,
);

async function loadStatus(): Promise<Status> {
  try {
    const db = await getDatabase();
    const schemaVersion = await getSchemaVersion();
    const counts = { ...EMPTY_COUNTS };
    for (const table of ALL_TABLES) {
      const row = await db.getFirstAsync<{ c: number }>(
        `SELECT COUNT(*) AS c FROM ${table};`,
      );
      counts[table] = row?.c ?? 0;
    }
    return { connected: true, schemaVersion, counts, error: null };
  } catch (err) {
    return {
      connected: false,
      schemaVersion: null,
      counts: EMPTY_COUNTS,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default function DebugScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [handicapResult, setHandicapResult] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [apiTesting, setApiTesting] = useState(false);
  const [sampleResult, setSampleResult] = useState<string | null>(null);
  const apiKeyPresent = hasApiKey();

  const refresh = useCallback(async () => {
    setStatus(await loadStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSeed = useCallback(async () => {
    setBusy(true);
    try {
      const result = await seedDemoData();
      Alert.alert(
        "Seeded",
        `Inserted ${result.courses} courses, ${result.tees} tees, ${result.teeHoles} holes.`,
      );
      await refresh();
    } catch (err) {
      Alert.alert("Seed failed", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleClear = useCallback(() => {
    Alert.alert("Clear all data?", "This will delete every row from every table.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await clearAllData();
            await refresh();
          } catch (err) {
            Alert.alert("Clear failed", err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [refresh]);

  const handleRunHandicapTest = useCallback(() => {
    // Sample inputs based on the USGA Rule 5.1 worked example.
    const pars = Array.from({ length: 18 }, () => 4);
    const grossScores = [5, 6, 4, 7, 5, 6, 4, 5, 6, 5, 7, 4, 6, 5, 4, 6, 5, 5];
    const ch = 12;
    const strokesPerHole = pars.map((_, idx) => strokesReceivedOnHole(ch, idx + 1));
    const ags = adjustedGrossScore({ grossScores, pars, strokesReceivedPerHole: strokesPerHole });
    const diff = scoreDifferential({
      adjustedGrossScore: ags,
      courseRating: 71.2,
      slopeRating: 131,
    });
    const ch14 = courseHandicap({
      handicapIndex: 12.5,
      slopeRating: 131,
      courseRating: 71.2,
      par: 72,
    });
    setHandicapResult(`AGS=${ags}, differential=${diff}, course handicap (12.5 idx)=${ch14}`);
  }, []);

  const handleGenerateSample = useCallback(async () => {
    setBusy(true);
    setSampleResult(null);
    try {
      const result = await generateSampleRound();
      setSampleResult(
        `Generated round at ${result.courseName} (${result.teeName}) — gross ${result.grossScore}.`,
      );
      await refresh();
    } catch (err) {
      Alert.alert(
        "Sample round failed",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleTestApi = useCallback(async () => {
    setApiTesting(true);
    setApiResult(null);
    try {
      const clubs = await searchClubs("Pebble Beach");
      const first = clubs[0];
      setApiResult(
        `Found ${clubs.length} club(s)${first ? ` — first: ${first.name}` : ""}`,
      );
    } catch (err) {
      const message =
        err instanceof GolfCourseApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      setApiResult(`Error: ${message}`);
    } finally {
      setApiTesting(false);
    }
  }, []);

  const indicatorColor = status?.connected ? "bg-green-500" : "bg-red-500";

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6 gap-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-fairway-700">Debug</Text>
          <Link href="/" className="text-sm text-fairway-700 underline">
            Home
          </Link>
        </View>

        <View className="flex-row items-center gap-2">
          <View className={`h-3 w-3 rounded-full ${indicatorColor}`} />
          <Text className="text-base">
            {status?.connected ? "Database connected" : "Database not connected"}
          </Text>
        </View>

        {status?.error ? (
          <Text className="text-sm text-red-600">{status.error}</Text>
        ) : null}

        <Text className="text-base">Schema version: {status?.schemaVersion ?? "—"}</Text>

        <View className="rounded-lg border border-gray-200 p-3">
          <Text className="mb-2 text-base font-semibold">Row counts</Text>
          {ALL_TABLES.map((table) => (
            <View key={table} className="flex-row justify-between py-0.5">
              <Text className="text-sm text-gray-700">{table}</Text>
              <Text className="text-sm font-medium">{status?.counts[table] ?? 0}</Text>
            </View>
          ))}
        </View>

        <View className="gap-2">
          <DebugButton label="Seed demo data" disabled={busy} onPress={handleSeed} />
          <DebugButton
            label="Clear all data"
            disabled={busy}
            onPress={handleClear}
            destructive
          />
          <DebugButton label="Run handicap test" disabled={busy} onPress={handleRunHandicapTest} />
          <DebugButton
            label="Generate sample round"
            disabled={busy}
            onPress={handleGenerateSample}
          />
        </View>

        {sampleResult ? (
          <View className="rounded-lg bg-fairway-50 p-3">
            <Text className="text-sm text-fairway-700">{sampleResult}</Text>
          </View>
        ) : null}

        {handicapResult ? (
          <View className="rounded-lg bg-fairway-50 p-3">
            <Text className="text-sm text-fairway-700">{handicapResult}</Text>
          </View>
        ) : null}

        <View className="rounded-lg border border-gray-200 p-3 gap-2">
          <Text className="text-base font-semibold">GolfCourseAPI</Text>
          <View className="flex-row items-center gap-2">
            <View
              className={`h-3 w-3 rounded-full ${apiKeyPresent ? "bg-green-500" : "bg-red-500"}`}
            />
            <Text className="text-sm">
              API key {apiKeyPresent ? "present" : "missing"}
            </Text>
          </View>
          <Text className="text-sm text-gray-700">
            Imported courses: {status?.counts.courses ?? 0}
          </Text>
          <DebugButton
            label={apiTesting ? "Testing…" : "Test API connection"}
            disabled={apiTesting || !apiKeyPresent}
            onPress={handleTestApi}
          />
          {apiResult ? (
            <Text className="text-sm text-gray-800">{apiResult}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface DebugButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function DebugButton({ label, onPress, disabled, destructive }: DebugButtonProps) {
  const base = destructive ? "bg-red-600" : "bg-fairway-500";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`${base} rounded-lg px-4 py-3 ${disabled ? "opacity-50" : ""}`}
    >
      <Text className="text-center text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

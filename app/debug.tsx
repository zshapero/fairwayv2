import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, TextInput, View } from "react-native";

import {
  Body,
  Button,
  Card,
  Caption,
  Heading,
  Micro,
  Pill,
  Screen,
  Section,
  Title,
} from "@/components";
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
import {
  clearAllRoundData,
  runScenario,
  type RunScenarioResult,
} from "@/services/roundGeneratorRunner";
import type { ScenarioKind } from "@/services/roundGenerator";
import { colors, radii, spacing } from "@/design/tokens";

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

interface ScenarioPreset {
  kind: ScenarioKind;
  label: string;
  count: number;
  description: string;
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  { kind: "slicer", label: "Slicer", count: 10, description: "65% of fairway misses right" },
  { kind: "puller", label: "Pulling", count: 10, description: "65% of fairway misses left" },
  {
    kind: "putting_trouble",
    label: "Putting trouble",
    count: 10,
    description: "~3 three-putts/round",
  },
  {
    kind: "declining",
    label: "Declining trend",
    count: 15,
    description: "last 5 rounds 4 strokes worse",
  },
  {
    kind: "improving",
    label: "Improving trend",
    count: 15,
    description: "last 5 rounds 4 strokes better",
  },
  { kind: "sand_trouble", label: "Sand trouble", count: 10, description: "30%+ holes from sand" },
  {
    kind: "approach_short",
    label: "Approach short",
    count: 10,
    description: "Most GIR misses short",
  },
];

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
  const [generating, setGenerating] = useState<string | null>(null);
  const [generationToast, setGenerationToast] = useState<string | null>(null);
  const [handicapResult, setHandicapResult] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [apiTesting, setApiTesting] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customCount, setCustomCount] = useState("10");
  const [customHandicap, setCustomHandicap] = useState(18);
  const apiKeyPresent = hasApiKey();

  const refresh = useCallback(async () => {
    setStatus(await loadStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const showResult = useCallback((result: RunScenarioResult) => {
    const indexLabel =
      result.finalHandicapIndex === null ? "—" : result.finalHandicapIndex.toFixed(1);
    setGenerationToast(
      `Generated ${result.roundsCreated} rounds. Index updated to ${indexLabel}. Engine surfaced ${result.recommendationsTriggered} recommendation${result.recommendationsTriggered === 1 ? "" : "s"}.`,
    );
    setTimeout(() => setGenerationToast(null), 5000);
  }, []);

  const runWithLabel = useCallback(
    async (label: string, fn: () => Promise<RunScenarioResult>) => {
      setGenerating(label);
      try {
        const result = await fn();
        showResult(result);
        await refresh();
      } catch (err) {
        Alert.alert("Generation failed", err instanceof Error ? err.message : String(err));
      } finally {
        setGenerating(null);
      }
    },
    [refresh, showResult],
  );

  const handleGenerate20 = useCallback(
    () =>
      runWithLabel("random", () => runScenario({ scenario: "random", count: 20 })),
    [runWithLabel],
  );

  const handlePreset = useCallback(
    (preset: ScenarioPreset) =>
      runWithLabel(preset.kind, () =>
        runScenario({ scenario: preset.kind, count: preset.count }),
      ),
    [runWithLabel],
  );

  const handleCustomGenerate = useCallback(async () => {
    const parsedCount = Math.max(1, Math.min(50, parseInt(customCount, 10) || 0));
    setCustomOpen(false);
    await runWithLabel("custom", () =>
      runScenario({
        scenario: "custom",
        count: parsedCount,
        targetHandicap: customHandicap,
      }),
    );
  }, [customCount, customHandicap, runWithLabel]);

  const handleClearRounds = useCallback(() => {
    Alert.alert(
      "Clear rounds, snapshots, and recommendations?",
      "Courses, tees, and players stay. Round history and any active recommendations will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await clearAllRoundData();
              setGenerationToast("Cleared rounds and recommendations.");
              setTimeout(() => setGenerationToast(null), 3000);
              await refresh();
            } catch (err) {
              Alert.alert("Clear failed", err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
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

  const handleClearAll = useCallback(() => {
    Alert.alert(
      "Clear all data?",
      "This deletes every row from every table — including imported courses.",
      [
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
      ],
    );
  }, [refresh]);

  const handleRunHandicapTest = useCallback(() => {
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

  const handleTestApi = useCallback(async () => {
    setApiTesting(true);
    setApiResult(null);
    try {
      const clubs = await searchClubs("Pebble Beach");
      const first = clubs[0];
      setApiResult(`Found ${clubs.length} club(s)${first ? ` — first: ${first.name}` : ""}`);
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

  const isGenerating = generating !== null;
  const disableAllGen = isGenerating || busy;

  const presetGrid = useMemo(() => SCENARIO_PRESETS, []);

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Title color="primary">Debug</Title>
        <Link href="/">
          <Caption color="primary">Home</Caption>
        </Link>
      </View>

      {status?.error ? (
        <Card>
          <Caption color="primary">{status.error}</Caption>
        </Card>
      ) : null}

      {generationToast ? (
        <Card style={{ borderLeftWidth: 3, borderLeftColor: colors.positive, paddingLeft: spacing.lg - 3 }}>
          <Body>{generationToast}</Body>
        </Card>
      ) : null}

      <Section
        label="GENERATE TEST DATA"
        trailing={status ? <Caption>{status.counts.rounds} rounds in DB</Caption> : null}
      >
        <Card>
          <Body>
            One-click data sets to exercise the recommendation engine. Rounds spread across the
            last 90 days on a random imported course.
          </Body>
          <View style={{ marginTop: spacing.md }}>
            <Button onPress={handleGenerate20} disabled={disableAllGen} full>
              {generating === "random" ? "Generating…" : "Generate 20 random rounds"}
            </Button>
          </View>
        </Card>

        <Card>
          <Micro>SCENARIO PRESETS</Micro>
          <View
            style={{
              marginTop: spacing.sm,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.xs,
            }}
          >
            {presetGrid.map((preset) => (
              <ScenarioChip
                key={preset.kind}
                label={preset.label}
                description={preset.description}
                count={preset.count}
                running={generating === preset.kind}
                disabled={disableAllGen}
                onPress={() => handlePreset(preset)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <Micro>CUSTOM</Micro>
          <Body style={{ marginTop: spacing.xxs }}>
            Generate a custom number of rounds at a target handicap.
          </Body>
          <View style={{ marginTop: spacing.sm, alignItems: "flex-start" }}>
            <Button onPress={() => setCustomOpen(true)} disabled={disableAllGen} variant="secondary">
              Custom…
            </Button>
          </View>
        </Card>

        <View style={{ alignItems: "flex-start" }}>
          <Pressable
            onPress={handleClearRounds}
            disabled={disableAllGen}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radii.button,
              borderWidth: 1,
              borderColor: "rgba(184, 60, 60, 0.4)",
              opacity: disableAllGen ? 0.5 : 1,
            }}
          >
            <Body style={{ color: "#9B2D2D" }}>Clear rounds and recommendations</Body>
          </Pressable>
        </View>
      </Section>

      <Section label="DATABASE">
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: status?.connected ? colors.positive : "#9B2D2D",
              }}
            />
            <Body>{status?.connected ? "Connected" : "Not connected"}</Body>
          </View>
          <Caption style={{ marginTop: spacing.xxs }}>
            Schema version: {status?.schemaVersion ?? "—"}
          </Caption>
        </Card>

        <Card>
          <Micro>ROW COUNTS</Micro>
          <View style={{ marginTop: spacing.sm }}>
            {ALL_TABLES.map((table) => (
              <View
                key={table}
                style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}
              >
                <Caption>{table}</Caption>
                <Caption color="text">{status?.counts[table] ?? 0}</Caption>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          <Button onPress={handleSeed} disabled={busy} variant="secondary">
            Seed demo data
          </Button>
          <Button onPress={handleClearAll} disabled={busy} variant="ghost">
            Clear all data
          </Button>
        </View>
      </Section>

      <Section label="ENGINE">
        <Card>
          <Body>Sanity-check the WHS engine with the USGA Rule 5.1 inputs.</Body>
          <View style={{ marginTop: spacing.sm, alignItems: "flex-start" }}>
            <Button onPress={handleRunHandicapTest} variant="secondary">
              Run handicap test
            </Button>
          </View>
          {handicapResult ? (
            <Caption style={{ marginTop: spacing.sm }}>{handicapResult}</Caption>
          ) : null}
        </Card>
      </Section>

      <Section label="GOLFCOURSEAPI">
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: apiKeyPresent ? colors.positive : "#9B2D2D",
              }}
            />
            <Body>{apiKeyPresent ? "API key present" : "API key missing"}</Body>
          </View>
          <Caption style={{ marginTop: spacing.xxs }}>
            Imported courses: {status?.counts.courses ?? 0}
          </Caption>
          <View style={{ marginTop: spacing.sm, alignItems: "flex-start" }}>
            <Button
              onPress={handleTestApi}
              disabled={apiTesting || !apiKeyPresent}
              variant="secondary"
            >
              {apiTesting ? "Testing…" : "Test API connection"}
            </Button>
          </View>
          {apiResult ? <Caption style={{ marginTop: spacing.sm }}>{apiResult}</Caption> : null}
        </Card>
      </Section>

      <CustomGenerationModal
        open={customOpen}
        count={customCount}
        handicap={customHandicap}
        onClose={() => setCustomOpen(false)}
        onCountChange={setCustomCount}
        onHandicapChange={setCustomHandicap}
        onGenerate={handleCustomGenerate}
      />
    </Screen>
  );
}

interface ScenarioChipProps {
  label: string;
  description: string;
  count: number;
  running: boolean;
  disabled: boolean;
  onPress: () => void;
}

function ScenarioChip({
  label,
  description,
  count,
  running,
  disabled,
  onPress,
}: ScenarioChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexBasis: "48%",
        flexGrow: 1,
        backgroundColor: colors.surfaceElevated,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.06)",
        padding: spacing.sm,
        opacity: disabled ? 0.5 : 1,
        gap: 4,
      }}
    >
      <Heading style={{ fontSize: 16 }}>{label}</Heading>
      <Caption>{description}</Caption>
      <View style={{ marginTop: spacing.xxs, flexDirection: "row", justifyContent: "space-between" }}>
        <Caption color="primary">{running ? "Generating…" : `Generate ${count}`}</Caption>
        {running ? <Pill variant="positive">running</Pill> : null}
      </View>
    </Pressable>
  );
}

interface CustomModalProps {
  open: boolean;
  count: string;
  handicap: number;
  onClose: () => void;
  onCountChange: (next: string) => void;
  onHandicapChange: (next: number) => void;
  onGenerate: () => void;
}

function CustomGenerationModal({
  open,
  count,
  handicap,
  onClose,
  onCountChange,
  onHandicapChange,
  onGenerate,
}: CustomModalProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(22,56,49,0.45)",
          justifyContent: "center",
          paddingHorizontal: spacing.lg,
        }}
      >
        <Card>
          <Heading>Custom generation</Heading>
          <Caption style={{ marginTop: spacing.xxs }}>
            Tune count and target handicap, then run.
          </Caption>

          <View style={{ marginTop: spacing.md, gap: spacing.xxs }}>
            <Micro>NUMBER OF ROUNDS</Micro>
            <TextInput
              value={count}
              onChangeText={onCountChange}
              keyboardType="number-pad"
              maxLength={2}
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.12)",
                borderRadius: radii.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                fontSize: 18,
                color: colors.text,
                backgroundColor: colors.surface,
              }}
            />
            <Caption>1 to 50 rounds.</Caption>
          </View>

          <View style={{ marginTop: spacing.md, gap: spacing.xxs }}>
            <Micro>TARGET HANDICAP · {handicap.toFixed(0)}</Micro>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Stepper
                label="−"
                onPress={() => onHandicapChange(Math.max(5, handicap - 1))}
              />
              <View style={{ flex: 1, height: 4, backgroundColor: colors.surfaceDeep, borderRadius: 2 }}>
                <View
                  style={{
                    height: 4,
                    width: `${((handicap - 5) / 25) * 100}%`,
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                  }}
                />
              </View>
              <Stepper
                label="+"
                onPress={() => onHandicapChange(Math.min(30, handicap + 1))}
              />
            </View>
            <Caption>Range 5 to 30.</Caption>
          </View>

          <View style={{ marginTop: spacing.lg, flexDirection: "row", gap: spacing.xs }}>
            <Button onPress={onClose} variant="ghost">
              Cancel
            </Button>
            <Button onPress={onGenerate} full>
              Generate
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
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
      <Body color="textOnPrimary">{label}</Body>
    </Pressable>
  );
}

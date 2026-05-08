import { Link } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  GOLF_COURSE_STALE_TIME_MS,
  GolfCourseApiError,
  golfCourseQueryKeys,
  hasApiKey,
  searchClubs,
  type ApiCourseSummary,
  type Club,
} from "@/services/golfCourseApi";
import { importCourseFromApi, type ImportResult } from "@/services/courseImport";

interface ImportState {
  status: "idle" | "success";
  result?: ImportResult;
  course?: ApiCourseSummary;
}

export default function SearchScreen() {
  const [text, setText] = useState("");
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);
  const [importByCourseId, setImportByCourseId] = useState<Record<string, ImportState>>({});

  const debounced = useDebouncedValue(text, 300);
  const apiKeyPresent = hasApiKey();
  const queryClient = useQueryClient();

  const search = useQuery({
    queryKey: golfCourseQueryKeys.search(debounced),
    queryFn: () => searchClubs(debounced),
    enabled: apiKeyPresent && debounced.trim().length > 0,
    staleTime: GOLF_COURSE_STALE_TIME_MS,
  });

  const importMutation = useMutation({
    mutationFn: (course: ApiCourseSummary) => importCourseFromApi(String(course.id)),
    onSuccess: (result, course) => {
      setImportByCourseId((prev) => ({
        ...prev,
        [String(course.id)]: { status: "success", result, course },
      }));
    },
  });

  const handleImport = useCallback(
    (course: ApiCourseSummary) => {
      importMutation.mutate(course);
    },
    [importMutation],
  );

  const errorMessage = useMemo(() => {
    if (!apiKeyPresent) {
      return "API key missing. Set EXPO_PUBLIC_GOLF_COURSE_API_KEY in your environment.";
    }
    if (search.error instanceof GolfCourseApiError) return search.error.message;
    if (search.error) return search.error.message ?? "Search failed.";
    return null;
  }, [apiKeyPresent, search.error]);

  const clubs = search.data ?? [];
  const showLoading = search.isFetching && debounced.trim().length > 0;
  const showEmpty =
    !showLoading && debounced.trim().length > 0 && clubs.length === 0 && !search.error;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between p-4 pb-2">
        <Text className="text-2xl font-bold text-fairway-700">Search Courses</Text>
        <Link href="/" className="text-sm text-fairway-700 underline">
          Home
        </Link>
      </View>

      <View className="px-4">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Search by club or course name…"
          autoCorrect={false}
          autoCapitalize="words"
          className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
        />
      </View>

      <ScrollView contentContainerClassName="p-4 gap-3">
        {errorMessage ? (
          <View className="rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{errorMessage}</Text>
          </View>
        ) : null}

        {showLoading ? (
          <View className="flex-row items-center gap-2 py-2">
            <ActivityIndicator />
            <Text className="text-sm text-gray-600">Searching…</Text>
          </View>
        ) : null}

        {showEmpty ? (
          <Text className="py-4 text-center text-sm text-gray-500">
            No clubs match “{debounced}”.
          </Text>
        ) : null}

        {!apiKeyPresent || debounced.trim().length === 0 ? (
          <Text className="py-4 text-center text-sm text-gray-500">
            Type a club or course name to search.
          </Text>
        ) : null}

        {clubs.map((club) => (
          <ClubRow
            key={club.id}
            club={club}
            expanded={expandedClubId === club.id}
            onToggle={() => setExpandedClubId((id) => (id === club.id ? null : club.id))}
            onImport={handleImport}
            importing={importMutation.isPending ? importMutation.variables : undefined}
            importStateByCourseId={importByCourseId}
            onResetImport={(courseId) => {
              setImportByCourseId((prev) => {
                const next = { ...prev };
                delete next[courseId];
                return next;
              });
              queryClient.invalidateQueries({ queryKey: ["fairway", "courses"] });
            }}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

interface ClubRowProps {
  club: Club;
  expanded: boolean;
  onToggle: () => void;
  onImport: (course: ApiCourseSummary) => void;
  importing?: ApiCourseSummary;
  importStateByCourseId: Record<string, ImportState>;
  onResetImport: (courseId: string) => void;
}

function ClubRow({
  club,
  expanded,
  onToggle,
  onImport,
  importing,
  importStateByCourseId,
  onResetImport,
}: ClubRowProps) {
  return (
    <View className="rounded-lg border border-gray-200 bg-white">
      <Pressable onPress={onToggle} className="p-3">
        <Text className="text-base font-semibold text-gray-900">{club.name}</Text>
        {club.location?.city || club.location?.state ? (
          <Text className="text-xs text-gray-500">
            {[club.location?.city, club.location?.state].filter(Boolean).join(", ")}
          </Text>
        ) : null}
        <Text className="mt-1 text-xs text-fairway-700">
          {expanded ? "Hide courses" : `${club.courses.length} course(s) — tap to view`}
        </Text>
      </Pressable>

      {expanded ? (
        <View className="border-t border-gray-100 p-3 gap-2">
          {club.courses.map((course) => {
            const id = String(course.id);
            const importState = importStateByCourseId[id];
            const isImporting = importing && String(importing.id) === id;
            return (
              <View key={id} className="rounded-md bg-gray-50 p-3">
                <Text className="text-sm font-medium text-gray-900">{course.course_name}</Text>
                {importState?.status === "success" && importState.result ? (
                  <View className="mt-2 gap-2">
                    <Text className="text-xs text-green-700">
                      {importState.result.updated ? "Updated" : "Imported"} — {importState.result.teesImported}{" "}
                      tees, {importState.result.holesImported} holes.
                    </Text>
                    <View className="flex-row gap-2">
                      <Link
                        href={{ pathname: "/debug" }}
                        className="rounded-md bg-fairway-500 px-3 py-2 text-xs font-semibold text-white"
                      >
                        View in Debug
                      </Link>
                      <Pressable
                        onPress={() => onResetImport(id)}
                        className="rounded-md border border-gray-300 px-3 py-2"
                      >
                        <Text className="text-xs">Import again</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => onImport(course)}
                    disabled={isImporting}
                    className={`mt-2 self-start rounded-md bg-fairway-500 px-3 py-2 ${
                      isImporting ? "opacity-50" : ""
                    }`}
                  >
                    <Text className="text-xs font-semibold text-white">
                      {isImporting ? "Importing…" : "Import to Fairway"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

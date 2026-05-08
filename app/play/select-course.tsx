import { Link, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import * as coursesRepo from "@/core/db/repositories/courses";
import type { Course } from "@/core/db/types";

export default function SelectCourseScreen() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setCourses(await coursesRepo.listCourses());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCourses([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = (courseId: number) => {
    router.push({ pathname: "/play/select-tee", params: { courseId: String(courseId) } });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between p-4 pb-2">
        <Text className="text-2xl font-bold text-fairway-700">Choose a course</Text>
        <Link href="/" className="text-sm text-fairway-700 underline">
          Home
        </Link>
      </View>

      <ScrollView contentContainerClassName="p-4 gap-3">
        {courses === null ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator />
            <Text className="text-sm text-gray-600">Loading courses…</Text>
          </View>
        ) : null}

        {error ? (
          <View className="rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {courses && courses.length === 0 ? (
          <View className="items-center gap-3 py-8">
            <Text className="text-center text-base text-gray-700">
              No courses yet. Search and import one first.
            </Text>
            <Link
              href="/search"
              className="rounded-lg bg-fairway-500 px-4 py-3 text-base font-semibold text-white"
            >
              Search Courses
            </Link>
          </View>
        ) : null}

        {courses?.map((course) => (
          <Pressable
            key={course.id}
            onPress={() => handleSelect(course.id)}
            className="rounded-lg border border-gray-200 bg-white p-3"
          >
            <Text className="text-base font-semibold text-gray-900">{course.name}</Text>
            {course.city || course.state ? (
              <Text className="text-xs text-gray-500">
                {[course.city, course.state].filter(Boolean).join(", ")}
              </Text>
            ) : null}
            <Text className="mt-1 text-xs text-gray-500">Par {course.par}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

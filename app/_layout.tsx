import "../global.css";

import { Stack } from "expo-router";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { asyncStoragePersister, queryClient } from "@/services/queryClient";
import { GOLF_COURSE_STALE_TIME_MS } from "@/services/golfCourseApi";

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        buster: `staleTime-${GOLF_COURSE_STALE_TIME_MS}`,
      }}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </PersistQueryClientProvider>
  );
}

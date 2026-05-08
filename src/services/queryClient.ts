import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

import { GOLF_COURSE_STALE_TIME_MS } from "./golfCourseApi";

/**
 * Single shared QueryClient. Course data rarely changes, so we set a 24h
 * staleTime by default and a 7-day gcTime so the persister has time to write
 * cached responses to AsyncStorage.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: GOLF_COURSE_STALE_TIME_MS,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "fairway:react-query-cache",
  throttleTime: 1000,
});

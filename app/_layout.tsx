import "../global.css";

import { Stack } from "expo-router";
import {
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_500Medium,
} from "@expo-google-fonts/fraunces";
import { Inter_400Regular, Inter_500Medium } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ActivityIndicator, View } from "react-native";

import { asyncStoragePersister, queryClient } from "@/services/queryClient";
import { GOLF_COURSE_STALE_TIME_MS } from "@/services/golfCourseApi";
import { colors } from "@/design/tokens";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_500Medium,
    Inter_400Regular,
    Inter_500Medium,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        buster: `staleTime-${GOLF_COURSE_STALE_TIME_MS}`,
      }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: "slide_from_right",
          animationDuration: 280,
        }}
      />
    </PersistQueryClientProvider>
  );
}

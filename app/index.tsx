import { Link } from "expo-router";
import { SafeAreaView, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-fairway-50">
      <View className="flex-1 items-center justify-center">
        <Text className="text-5xl font-bold text-fairway-700">Fairway</Text>
      </View>
      <View className="items-center pb-8">
        <Link href="/debug" className="text-sm text-fairway-700 underline">
          Debug
        </Link>
      </View>
    </SafeAreaView>
  );
}

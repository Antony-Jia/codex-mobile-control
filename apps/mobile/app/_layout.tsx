import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTheme } from "../src/theme";

export default function RootLayout() {
  const t = useTheme();
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.appBg }}><SafeAreaProvider><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.appBg } }} /></SafeAreaProvider></GestureHandlerRootView>;
}

import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { appleColors } from "../theme/appleTokens";
import { StartupVideoSplash } from "../components/StartupVideoSplash";

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const pathname = usePathname();
  const isShareScreen = pathname === "/share";

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar
        style="light"
        backgroundColor="#000000"
        translucent={true}
        hidden={false}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: appleColors.canvas },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen
          name="share"
          options={{
            headerShown: false,
            animation: "none",
            presentation: "transparentModal",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </Stack>
      {showSplash && !isShareScreen && (
        <StartupVideoSplash onFinish={() => setShowSplash(false)} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appleColors.canvas,
  },
});


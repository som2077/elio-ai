import React from "react";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { appleColors } from "../theme/appleTokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar
        style="light"
        backgroundColor={appleColors.canvas}
        translucent={true}
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
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appleColors.canvas,
  },
});

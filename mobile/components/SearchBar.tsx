import React from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

interface SearchBarProps {
  query: string;
  selectedPlatform: string;
  onChangeQuery: (text: string) => void;
  onSelectPlatform: (platform: string) => void;
  onClear: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  selectedPlatform,
  onChangeQuery,
  onSelectPlatform,
  onClear,
}) => {
  const platforms = [
    { key: "all", label: "All Clips", icon: "sparkles" as const },
    { key: "youtube", label: "YouTube", icon: "logo-youtube" as const, color: "#FF0033" },
    { key: "instagram", label: "Instagram", icon: "logo-instagram" as const, color: "#E1306C" },
    { key: "twitter", label: "𝕏", icon: "logo-twitter" as const, color: "#1DA1F2" },
    { key: "tiktok", label: "TikTok", icon: "videocam-outline" as const, color: "#00F2FE" },
    { key: "reddit", label: "Reddit", icon: "logo-reddit" as const, color: "#FF4500" },
  ];

  return (
    <View style={styles.container}>
      {/* Search Input Box */}
      <View style={styles.inputBox}>
        <Ionicons name="search" size={17} color={appleColors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search clips, creators, topics..."
          placeholderTextColor={appleColors.textTertiary}
          style={styles.textInput}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              haptics.selection();
              onClear();
            }}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={16} color={appleColors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Platform Quick Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.platformScroll}
      >
        {platforms.map((p) => {
          const isSelected = selectedPlatform === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              activeOpacity={0.8}
              style={[styles.platformPill, isSelected && styles.platformPillActive]}
              onPress={() => {
                haptics.selection();
                onSelectPlatform(p.key);
              }}
            >
              <Ionicons
                name={p.icon}
                size={12}
                color={
                  isSelected
                    ? "#070A11"
                    : p.color || appleColors.textSecondary
                }
              />
              <Text
                style={[
                  styles.platformPillText,
                  isSelected && styles.platformPillTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  textInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
    marginRight: 6,
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  platformScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
  },
  platformPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 0.8,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 5,
  },
  platformPillActive: {
    backgroundColor: appleColors.accentLight,
    borderColor: appleColors.accentLight,
  },
  platformPillText: {
    color: appleColors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  platformPillTextActive: {
    color: "#070A11",
    fontWeight: "800",
  },
});

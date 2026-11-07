import React from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

interface SearchBarProps {
  query: string;
  selectedPlatform: string;
  searchMode?: "title" | "inside_video";
  onChangeQuery: (text: string) => void;
  onSelectPlatform: (platform: string) => void;
  onToggleSearchMode?: (mode: "title" | "inside_video") => void;
  onClear: () => void;
  onBack?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  selectedPlatform,
  searchMode = "title",
  onChangeQuery,
  onSelectPlatform,
  onToggleSearchMode,
  onClear,
  onBack,
}) => {
  const platforms = [
    { key: "all", label: "All Clips", icon: "sparkles" as const },
    {
      key: "youtube",
      label: "YouTube",
      icon: "logo-youtube" as const,
      color: "#FF0033",
    },
    {
      key: "instagram",
      label: "Instagram",
      icon: "logo-instagram" as const,
      color: "#E1306C",
    },
    {
      key: "twitter",
      label: "𝕏",
      icon: "logo-twitter" as const,
      color: "#1DA1F2",
    },
    {
      key: "tiktok",
      label: "TikTok",
      icon: "videocam-outline" as const,
      color: "#00F2FE",
    },
    {
      key: "reddit",
      label: "Reddit",
      icon: "logo-reddit" as const,
      color: "#FF4500",
    },
  ];

  return (
    <View style={styles.container}>
      {/* Search Input Box */}
      <View style={styles.inputRow}>
        {onBack && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              haptics.selection();
              onBack();
            }}
            style={styles.backBtn}
          >
            <PikaIcon name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={styles.inputBox}>
          <PikaIcon
            name={searchMode === "inside_video" ? "sparkles" : "search"}
            size={17}
            color={searchMode === "inside_video" ? "#A78BFA" : appleColors.textTertiary}
          />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder={
              searchMode === "inside_video"
                ? "Search what was spoken inside videos..."
                : "Search clips, creators, topics..."
            }
            placeholderTextColor={appleColors.textTertiary}
            style={styles.textInput}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={true}
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
              <PikaIcon
                name="close-circle"
                size={16}
                color={appleColors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mode Switcher: Titles vs Inside-Video ✦ */}
      {onToggleSearchMode && (
        <View style={styles.modeSwitcherRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.modeTab, searchMode === "title" && styles.modeTabActive]}
            onPress={() => {
              haptics.selection();
              onToggleSearchMode("title");
            }}
          >
            <Text
              style={[
                styles.modeTabText,
                searchMode === "title" && styles.modeTabTextActive,
              ]}
            >
              Titles & Tags
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.modeTab,
              searchMode === "inside_video" && styles.modeTabActiveAi,
            ]}
            onPress={() => {
              haptics.selection();
              onToggleSearchMode("inside_video");
            }}
          >
            <PikaIcon
              name="sparkles"
              size={12}
              color={searchMode === "inside_video" ? "#A78BFA" : "#71767B"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.modeTabText,
                searchMode === "inside_video" && styles.modeTabTextActiveAi,
              ]}
            >
              ✦ Inside Video (Spoken)
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
              style={[
                styles.platformPill,
                isSelected && styles.platformPillActive,
              ]}
              onPress={() => {
                haptics.selection();
                onSelectPlatform(p.key);
              }}
            >
              <PikaIcon
                name={p.icon}
                size={12}
                color={
                  isSelected ? "#070A11" : p.color || appleColors.textSecondary
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 36,
    height: 42,
    alignItems: "flex-start",
    justifyContent: "center",
    marginRight: 4,
  },
  inputBox: {
    flex: 1,
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
  modeSwitcherRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    padding: 2.5,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5.5,
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: "#1C1C1E",
  },
  modeTabActiveAi: {
    backgroundColor: "rgba(167, 139, 250, 0.16)",
    borderWidth: 0.5,
    borderColor: "rgba(167, 139, 250, 0.4)",
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71767B",
  },
  modeTabTextActive: {
    color: "#FFFFFF",
  },
  modeTabTextActiveAi: {
    color: "#C4B5FD",
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

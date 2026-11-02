import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SavedVideo } from "../types/video";
import { ActivityCalendar } from "./ActivityCalendar";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

interface InsightsViewProps {
  videos: SavedVideo[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  videos,
  selectedDate,
  onSelectDate,
}) => {
  const totalCount = videos.length;
  const unreadCount = videos.filter((v) => v.status === "unread").length;
  const watchedCount = totalCount - unreadCount;

  // Platform breakdown
  const ytCount = videos.filter((v) => (v.platform || "").toLowerCase() === "youtube").length;
  const igCount = videos.filter((v) => (v.platform || "").toLowerCase() === "instagram").length;
  const ttCount = videos.filter((v) => (v.platform || "").toLowerCase() === "tiktok").length;
  const twCount = videos.filter((v) => (v.platform || "").toLowerCase() === "twitter").length;
  const rdCount = videos.filter((v) => (v.platform || "").toLowerCase() === "reddit").length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* View Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity & Insights</Text>
        <Text style={styles.headerSubtitle}>
          Track your learning trajectory and video bookmarks across the web.
        </Text>
      </View>

      {/* KPI Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIconBox}>
            <Ionicons name="bookmark" size={16} color={appleColors.accentLight} />
          </View>
          <Text style={styles.statValue}>{totalCount}</Text>
          <Text style={styles.statLabel}>Saved Clips</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: "rgba(255, 159, 10, 0.15)" }]}>
            <Ionicons name="time" size={16} color="#FF9F0A" />
          </View>
          <Text style={styles.statValue}>{unreadCount}</Text>
          <Text style={styles.statLabel}>In Watchlist</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: "rgba(48, 209, 88, 0.15)" }]}>
            <Ionicons name="checkmark-done" size={16} color="#30D158" />
          </View>
          <Text style={styles.statValue}>{watchedCount}</Text>
          <Text style={styles.statLabel}>Watched</Text>
        </View>
      </View>

      {/* Platform Distribution Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Platform Sources</Text>
        <View style={styles.platformPillsRow}>
          {ytCount > 0 && (
            <View style={styles.platformItem}>
              <Ionicons name="logo-youtube" size={14} color="#FF0033" />
              <Text style={styles.platformItemText}>YouTube ({ytCount})</Text>
            </View>
          )}
          {igCount > 0 && (
            <View style={styles.platformItem}>
              <Ionicons name="logo-instagram" size={14} color="#E1306C" />
              <Text style={styles.platformItemText}>Instagram ({igCount})</Text>
            </View>
          )}
          {ttCount > 0 && (
            <View style={styles.platformItem}>
              <Ionicons name="videocam-outline" size={14} color="#00F2FE" />
              <Text style={styles.platformItemText}>TikTok ({ttCount})</Text>
            </View>
          )}
          {twCount > 0 && (
            <View style={styles.platformItem}>
              <Ionicons name="logo-twitter" size={14} color="#1DA1F2" />
              <Text style={styles.platformItemText}>𝕏 / Twitter ({twCount})</Text>
            </View>
          )}
          {rdCount > 0 && (
            <View style={styles.platformItem}>
              <Ionicons name="logo-reddit" size={14} color="#FF4500" />
              <Text style={styles.platformItemText}>Reddit ({rdCount})</Text>
            </View>
          )}
        </View>
      </View>

      {/* Activity Heatmap Section */}
      <View style={styles.calendarSection}>
        <ActivityCalendar
          videos={videos}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      </View>

      {/* Spacing for floating bottom dock */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appleColors.canvas,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: appleColors.textSecondary,
    fontSize: 12,
    fontWeight: "400",
    marginTop: 4,
    lineHeight: 16,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0D111E",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statLabel: {
    color: appleColors.textTertiary,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: "#0D111E",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  platformPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 6,
  },
  platformItemText: {
    color: appleColors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  calendarSection: {
    marginBottom: 16,
  },
});

import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { PikaIcon } from "./PikaIcon";
import { SavedVideo } from "../types/video";
import { appleColors, appleRadii, appleTypography } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

interface BentoStatsStripProps {
  totalCount: number;
  unreadCount: number;
  videos: SavedVideo[];
  onPressUnread?: () => void;
}

export const BentoStatsStrip: React.FC<BentoStatsStripProps> = ({
  totalCount,
  unreadCount,
  videos,
  onPressUnread,
}) => {
  const watchedCount = Math.max(0, totalCount - unreadCount);

  // Compute dominant platform
  const { topPlatform, topPercentage } = useMemo(() => {
    if (videos.length === 0) return { topPlatform: "None", topPercentage: 0 };
    const counts: Record<string, number> = {};
    videos.forEach((v) => {
      const p = v.platform || "other";
      counts[p] = (counts[p] || 0) + 1;
    });

    let topP = "other";
    let maxC = 0;
    Object.entries(counts).forEach(([p, c]) => {
      if (c > maxC) {
        maxC = c;
        topP = p;
      }
    });

    const pct = Math.round((maxC / videos.length) * 100);
    const capitalized = topP.charAt(0).toUpperCase() + topP.slice(1);
    return { topPlatform: capitalized, topPercentage: pct };
  }, [videos]);

  return (
    <View style={styles.container}>
      {/* Bento Block 1: Total Saved */}
      <View style={styles.bentoBlock}>
        <View style={styles.blockHeader}>
          <PikaIcon
            name="film-outline"
            size={13}
            color={appleColors.accentLight}
          />
          <Text style={styles.blockLabel}>Vault</Text>
        </View>
        <Text style={styles.metricNumber}>{totalCount}</Text>
        <Text style={styles.metricSub}>{watchedCount} completed</Text>
      </View>

      {/* Bento Block 2: Unread Queue (Clickable) */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.bentoBlock, unreadCount > 0 && styles.bentoBlockActive]}
        onPress={() => {
          if (onPressUnread) {
            haptics.selection();
            onPressUnread();
          }
        }}
      >
        <View style={styles.blockHeader}>
          <View
            style={[
              styles.pulseDot,
              {
                backgroundColor:
                  unreadCount > 0 ? "#30D158" : appleColors.textTertiary,
              },
            ]}
          />
          <Text style={styles.blockLabel}>In Queue</Text>
        </View>
        <Text
          style={[
            styles.metricNumber,
            unreadCount > 0 && styles.metricNumberActive,
          ]}
        >
          {unreadCount}
        </Text>
        <Text style={styles.metricSub}>
          {unreadCount > 0 ? "Ready to play" : "All caught up"}
        </Text>
      </TouchableOpacity>

      {/* Bento Block 3: Top Source */}
      <View style={styles.bentoBlock}>
        <View style={styles.blockHeader}>
          <PikaIcon name="sparkles-outline" size={13} color="#FF9F0A" />
          <Text style={styles.blockLabel}>Top Source</Text>
        </View>
        <Text style={styles.metricPlatform} numberOfLines={1}>
          {topPlatform}
        </Text>
        <Text style={styles.metricSub}>{topPercentage}% of clips</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
    marginTop: 2,
  },
  bentoBlock: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 11,
    paddingVertical: 9,
    justifyContent: "space-between",
  },
  bentoBlockActive: {
    borderColor: "rgba(48, 209, 88, 0.3)",
    backgroundColor: "rgba(48, 209, 88, 0.05)",
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  blockLabel: {
    color: appleColors.textSecondary,
    fontSize: 10.5,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metricNumber: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    ...appleTypography.tabularNums,
  },
  metricNumberActive: {
    color: "#30D158",
  },
  metricPlatform: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
  },
  metricSub: {
    color: appleColors.textTertiary,
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
});

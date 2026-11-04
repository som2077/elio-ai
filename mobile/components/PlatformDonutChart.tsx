import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface PlatformStatItem {
  key: string;
  label: string;
  count: number;
  pct: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface PlatformDonutChartProps {
  data: PlatformStatItem[];
  totalClips: number;
}

/**
 * Pure React Native Platform Distribution Bar & Breakdown
 * (100% Native-Module-Free, Zero Dependency on react-native-svg)
 * Features:
 * - Proportional Multi-Segmented Brand Progress Track
 * - Platform Share Breakdown with Icons and Percentage Badges
 * - Twitter Lights-Out Dark Palette (#16181C, #2F3336)
 */
export const PlatformDonutChart: React.FC<PlatformDonutChartProps> = ({
  data,
  totalClips,
}) => {
  if (!data || data.length === 0 || totalClips === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="pie-chart-outline" size={28} color="#71767B" />
        <Text style={styles.emptyText}>No platform data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>Platform Distribution</Text>
          <Text style={styles.cardSub}>Content source breakdown</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeNum}>{totalClips}</Text>
          <Text style={styles.totalBadgeText}>Total Clips</Text>
        </View>
      </View>

      {/* Proportional Segmented Progress Track */}
      <View style={styles.segmentedTrack}>
        {data.map((item) => (
          <View
            key={item.key}
            style={[
              styles.trackSegment,
              {
                flex: item.count,
                backgroundColor: item.color,
              },
            ]}
          />
        ))}
      </View>

      {/* Platform Breakdown Cards Grid */}
      <View style={styles.legendGrid}>
        {data.map((item) => (
          <View key={item.key} style={styles.legendItemCard}>
            <View style={styles.legendItemLeft}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: `${item.color}20` },
                ]}
              >
                <Ionicons name={item.icon} size={15} color={item.color} />
              </View>
              <View>
                <Text style={styles.platformName} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.clipCountSub}>
                  {item.count} {item.count === 1 ? "clip" : "clips"}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.pctPill,
                { backgroundColor: `${item.color}1C` },
              ]}
            >
              <Text style={[styles.pctText, { color: item.color }]}>
                {item.pct}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#16181C",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2F3336",
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cardSub: {
    color: "#71767B",
    fontSize: 12,
    marginTop: 2,
  },
  totalBadge: {
    alignItems: "flex-end",
  },
  totalBadgeNum: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  totalBadgeText: {
    color: "#71767B",
    fontSize: 11,
    fontWeight: "500",
  },
  segmentedTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: "#202327",
    marginBottom: 16,
    gap: 2,
  },
  trackSegment: {
    height: "100%",
    borderRadius: 2,
  },
  legendGrid: {
    gap: 8,
  },
  legendItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#000000",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2F3336",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  legendItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  platformName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  clipCountSub: {
    color: "#71767B",
    fontSize: 11,
    marginTop: 1,
  },
  pctPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pctText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyCard: {
    height: 140,
    backgroundColor: "#16181C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2F3336",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 6,
  },
  emptyText: {
    color: "#71767B",
    fontSize: 13,
  },
});

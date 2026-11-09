import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PikaIcon } from "./PikaIcon";

interface PlatformStatItem {
  key: string;
  label: string;
  count: number;
  pct: number;
  icon: string;
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
        <PikaIcon name="pie-chart-outline" size={28} color="#71767B" />
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
                <PikaIcon name={item.icon} size={15} color={item.color} />
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
              style={[styles.pctPill, { backgroundColor: `${item.color}1C` }]}
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
    backgroundColor: "#16161A",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.15)",
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
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  totalBadge: {
    alignItems: "flex-end",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  totalBadgeNum: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  totalBadgeText: {
    color: "#64748B",
    fontSize: 10.5,
    fontWeight: "600",
  },
  segmentedTrack: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: 16,
    gap: 3,
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
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  legendItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  platformName: {
    color: "#F8FAFC",
    fontSize: 13.5,
    fontWeight: "600",
  },
  clipCountSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  pctPill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  pctText: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  emptyCard: {
    height: 140,
    backgroundColor: "#16161A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 6,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 13,
  },
});

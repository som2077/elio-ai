import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PieChart, pieDataItem } from "react-native-gifted-charts";
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
 * Industry-Grade Content Source Donut Chart
 * Features:
 * - Sleek Donut Ring with platform-specific branding accents
 * - Center Metric displaying total clip volume
 * - High-contrast legend pills with percentages and counts
 * - Twitter Lights-Out dark mode palette (#16181C, #2F3336)
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

  const pieData: pieDataItem[] = data.map((item) => ({
    value: item.count,
    color: item.color,
    text: `${item.pct}%`,
  }));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Platform Distribution</Text>
        <Text style={styles.cardSub}>{data.length} Sources</Text>
      </View>

      <View style={styles.chartLayoutRow}>
        {/* Donut Ring with Center Summary */}
        <View style={styles.donutWrap}>
          <PieChart
            donut
            data={pieData}
            radius={65}
            innerRadius={46}
            innerCircleColor="#16181C"
            centerLabelComponent={() => (
              <View style={styles.centerLabel}>
                <Text style={styles.centerNumber}>{totalClips}</Text>
                <Text style={styles.centerText}>Clips</Text>
              </View>
            )}
          />
        </View>

        {/* Platform Breakdown Legend */}
        <View style={styles.legendCol}>
          {data.map((item) => (
            <View key={item.key} style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={item.color}
                  style={styles.platformIcon}
                />
                <Text style={styles.platformName} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>

              <View style={styles.legendRight}>
                <Text style={styles.platformCount}>{item.count}</Text>
                <View
                  style={[
                    styles.pctPill,
                    { backgroundColor: `${item.color}22` },
                  ]}
                >
                  <Text style={[styles.pctText, { color: item.color }]}>
                    {item.pct}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
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
  },
  chartLayoutRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  donutWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 140,
  },
  centerLabel: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerNumber: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  centerText: {
    color: "#71767B",
    fontSize: 11,
    fontWeight: "500",
  },
  legendCol: {
    flex: 1,
    paddingLeft: 12,
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  platformIcon: {
    marginRight: 6,
  },
  platformName: {
    color: "#E7E9EA",
    fontSize: 13,
    fontWeight: "500",
  },
  legendRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  platformCount: {
    color: "#71767B",
    fontSize: 12,
    fontWeight: "600",
  },
  pctPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pctText: {
    fontSize: 11,
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

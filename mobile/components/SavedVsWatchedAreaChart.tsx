import React, { useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart, lineDataItem } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { haptics } from "../utils/haptics";

import { TimeRange } from "./TimeRangeMenu";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface DailyPoint {
  dateKey: string;
  displayDate: string;
  saved: number;
  watched: number;
}

interface SavedVsWatchedAreaChartProps {
  data: DailyPoint[];
  timeRange: TimeRange;
}

/**
 * Industry-Grade Curved Area Chart (Saved vs Watched)
 * Features:
 * - Smooth Cubic-Bezier Area Curves
 * - Translucent Dual-Gradient Fills (Cyan for Saved, Emerald for Watched)
 * - Interactive Touch Pointer with Dynamic Tooltip Bubble & Haptics
 * - Pure OLED Twitter Dark Palette (#000000, #2F3336, #16181C)
 */
export const SavedVsWatchedAreaChart: React.FC<SavedVsWatchedAreaChartProps> = ({
  data,
  timeRange,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<DailyPoint | null>(null);

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bar-chart-outline" size={32} color="#71767B" />
        <Text style={styles.emptyText}>No activity in this time period</Text>
      </View>
    );
  }

  // Calculate maximum value for Y-axis scale
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.saved, d.watched)),
    3
  );

  // Spacing based on time range
  const chartWidth = SCREEN_WIDTH - 64;
  const pointSpacing = Math.max(
    Math.floor((chartWidth - 20) / Math.max(data.length - 1, 1)),
    14
  );

  // Label frequency: for 7d show all, for 14d show every 2nd, for 30d show every 5th, for 90d show every 14th
  const step =
    timeRange === "7d"
      ? 1
      : timeRange === "14d"
      ? 2
      : timeRange === "30d"
      ? 5
      : 14;

  const line1Data: lineDataItem[] = data.map((d, index) => {
    const showLabel = index % step === 0 || index === data.length - 1;
    return {
      value: d.saved,
      label: showLabel ? d.displayDate : "",
      labelTextStyle: styles.axisLabelText,
      dataPointText: "",
    };
  });

  const line2Data: lineDataItem[] = data.map((d) => ({
    value: d.watched,
  }));

  const totalSaved = data.reduce((acc, d) => acc + d.saved, 0);
  const totalWatched = data.reduce((acc, d) => acc + d.watched, 0);

  return (
    <View style={styles.card}>
      {/* Header with KPI & Legend */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.chartTitle}>Consumption & Queue Trend</Text>
          <Text style={styles.chartSub}>
            {totalSaved} saved • {totalWatched} watched
          </Text>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#1D9BF0" }]} />
            <Text style={styles.legendText}>Saved</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#00BA7C" }]} />
            <Text style={styles.legendText}>Watched</Text>
          </View>
        </View>
      </View>

      {/* Interactive Tooltip Callout */}
      {activeTooltip && (
        <View style={styles.tooltipBubble}>
          <Text style={styles.tooltipDate}>{activeTooltip.dateKey}</Text>
          <View style={styles.tooltipStatsRow}>
            <Text style={[styles.tooltipStat, { color: "#1D9BF0" }]}>
              📥 {activeTooltip.saved} Saved
            </Text>
            <Text style={[styles.tooltipStat, { color: "#00BA7C" }]}>
              ✅ {activeTooltip.watched} Watched
            </Text>
          </View>
        </View>
      )}

      {/* Gifted Charts Line/Area Canvas */}
      <View style={styles.chartWrapper}>
        <LineChart
          data={line1Data}
          data2={line2Data}
          height={160}
          width={chartWidth}
          spacing={pointSpacing}
          initialSpacing={12}
          endSpacing={12}
          color1="#1D9BF0"
          color2="#00BA7C"
          thickness1={2.5}
          thickness2={2.2}
          curved
          areaChart
          startFillColor1="rgba(29, 155, 240, 0.32)"
          endFillColor1="rgba(29, 155, 240, 0.0)"
          startFillColor2="rgba(0, 186, 124, 0.28)"
          endFillColor2="rgba(0, 186, 124, 0.0)"
          startOpacity={0.8}
          endOpacity={0.05}
          noOfSections={3}
          maxValue={Math.ceil(maxVal * 1.15)}
          rulesColor="#2F3336"
          rulesType="solid"
          yAxisColor="transparent"
          xAxisColor="#2F3336"
          yAxisTextStyle={styles.yAxisText}
          backgroundColor="transparent"
          hideDataPoints={data.length > 14}
          dataPointsColor1="#1D9BF0"
          dataPointsColor2="#00BA7C"
          dataPointsRadius={3.5}
          pointerConfig={{
            pointerStripHeight: 155,
            pointerStripColor: "rgba(255, 255, 255, 0.2)",
            pointerStripWidth: 1.5,
            pointerColor: "#FFFFFF",
            radius: 5,
            pointerLabelWidth: 100,
            pointerLabelHeight: 90,
            activatePointersOnLongPress: false,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: any) => {
              const item = items[0];
              const idx = line1Data.findIndex((p) => p.value === item.value);
              const point = idx >= 0 && idx < data.length ? data[idx] : null;
              if (point) {
                haptics.selection();
              }
              return (
                <View style={styles.pointerBubble}>
                  <Text style={styles.pointerDate}>
                    {point ? point.dateKey : ""}
                  </Text>
                  <Text style={styles.pointerValSaved}>
                    📥 {items[0]?.value || 0} Saved
                  </Text>
                  <Text style={styles.pointerValWatched}>
                    ✅ {items[1]?.value || 0} Watched
                  </Text>
                </View>
              );
            },
          }}
        />
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
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  chartTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  chartSub: {
    color: "#71767B",
    fontSize: 12.5,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: "#71767B",
    fontSize: 12,
    fontWeight: "500",
  },
  tooltipBubble: {
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#2F3336",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  tooltipDate: {
    color: "#71767B",
    fontSize: 11,
    fontWeight: "500",
  },
  tooltipStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  tooltipStat: {
    fontSize: 12,
    fontWeight: "600",
  },
  chartWrapper: {
    marginLeft: -10,
    marginRight: -10,
    paddingTop: 8,
  },
  axisLabelText: {
    color: "#71767B",
    fontSize: 10,
    fontWeight: "500",
  },
  yAxisText: {
    color: "#71767B",
    fontSize: 10,
  },
  pointerBubble: {
    backgroundColor: "#000000",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#2F3336",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  pointerDate: {
    color: "#71767B",
    fontSize: 10.5,
    marginBottom: 3,
  },
  pointerValSaved: {
    color: "#1D9BF0",
    fontSize: 11.5,
    fontWeight: "700",
  },
  pointerValWatched: {
    color: "#00BA7C",
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 1,
  },
  emptyContainer: {
    height: 180,
    backgroundColor: "#16181C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2F3336",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 8,
  },
  emptyText: {
    color: "#71767B",
    fontSize: 13,
  },
});

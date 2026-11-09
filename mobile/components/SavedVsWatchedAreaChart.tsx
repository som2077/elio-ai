import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PikaIcon } from "./PikaIcon";
import { TimeRange } from "./TimeRangeMenu";
import { haptics } from "../utils/haptics";

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
 * Pure React Native Dual Trend & Area Chart
 * (100% Native-Module-Free, Zero Dependency on react-native-svg)
 * Features:
 * - Dual Gradient Area Fills (Cyan for Saved, Emerald for Watched)
 * - Dynamic Interactive Touch Scrubbing with Haptics
 * - High-Precision Gridlines and Y-axis scaling
 * - Twitter Lights-Out Dark Mode Palette (#16181C, #2F3336)
 */
export const SavedVsWatchedAreaChart: React.FC<
  SavedVsWatchedAreaChartProps
> = ({ data, timeRange }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <PikaIcon name="bar-chart-outline" size={32} color="#71767B" />
        <Text style={styles.emptyText}>No activity in this time period</Text>
      </View>
    );
  }

  // Maximum value for scaling (at least 3 to maintain baseline)
  const maxVal = Math.max(...data.map((d) => Math.max(d.saved, d.watched)), 3);
  const midVal = Math.ceil(maxVal / 2);

  const totalSaved = data.reduce((acc, d) => acc + d.saved, 0);
  const totalWatched = data.reduce((acc, d) => acc + d.watched, 0);

  // Label frequency step
  const step =
    timeRange === "7d"
      ? 1
      : timeRange === "14d"
        ? 2
        : timeRange === "30d"
          ? 5
          : 14;

  const activePoint =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < data.length
      ? data[selectedIndex]
      : null;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.chartTitle}>Consumption & Queue Trend</Text>
          <Text style={styles.chartSub}>
            {totalSaved} saved • {totalWatched} watched
          </Text>
        </View>

        {/* Legend */}
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

      {/* Interactive Tooltip Bubble */}
      {activePoint ? (
        <View style={styles.tooltipBubble}>
          <Text style={styles.tooltipDate}>{activePoint.dateKey}</Text>
          <View style={styles.tooltipStatsRow}>
            <Text style={[styles.tooltipStat, { color: "#1D9BF0" }]}>
              📥 {activePoint.saved} Saved
            </Text>
            <Text style={[styles.tooltipStat, { color: "#00BA7C" }]}>
              ✅ {activePoint.watched} Watched
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.scrubHintText}>Tap any day to inspect</Text>
      )}

      {/* Canvas Area with Gridlines & Columns */}
      <View style={styles.canvasContainer}>
        {/* Y-Axis Gridlines */}
        <View style={styles.gridOverlay}>
          <View style={styles.gridLineRow}>
            <Text style={styles.yAxisText}>{maxVal}</Text>
            <View style={styles.gridLine} />
          </View>
          <View style={styles.gridLineRow}>
            <Text style={styles.yAxisText}>{midVal}</Text>
            <View style={styles.gridLine} />
          </View>
          <View style={styles.gridLineRow}>
            <Text style={styles.yAxisText}>0</Text>
            <View style={styles.gridLine} />
          </View>
        </View>

        {/* Data Columns */}
        <View style={styles.columnsRow}>
          {data.map((item, index) => {
            const isSelected = selectedIndex === index;
            const savedHeightPct = Math.max((item.saved / maxVal) * 100, 0);
            const watchedHeightPct = Math.max((item.watched / maxVal) * 100, 0);
            const showLabel = index % step === 0 || index === data.length - 1;

            return (
              <TouchableOpacity
                key={item.dateKey || index}
                activeOpacity={0.8}
                style={[
                  styles.dataColumn,
                  isSelected && styles.dataColumnSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSelectedIndex(isSelected ? null : index);
                }}
              >
                {/* Column Bars with Linear Gradient */}
                <View style={styles.barsContainer}>
                  {/* 1. Saved Gradient Bar */}
                  {item.saved > 0 ? (
                    <View
                      style={[
                        styles.barTrack,
                        { height: `${Math.max(savedHeightPct, 8)}%` },
                      ]}
                    >
                      <LinearGradient
                        colors={[
                          "#1D9BF0",
                          "rgba(29, 155, 240, 0.45)",
                          "rgba(29, 155, 240, 0.05)",
                        ]}
                        style={styles.gradientFill}
                      />
                      <View
                        style={[
                          styles.barCapDot,
                          { backgroundColor: "#1D9BF0" },
                        ]}
                      />
                    </View>
                  ) : (
                    <View style={styles.emptyPointDot} />
                  )}

                  {/* 2. Watched Gradient Bar */}
                  {item.watched > 0 && (
                    <View
                      style={[
                        styles.barTrack,
                        { height: `${Math.max(watchedHeightPct, 8)}%` },
                      ]}
                    >
                      <LinearGradient
                        colors={[
                          "#00BA7C",
                          "rgba(0, 186, 124, 0.45)",
                          "rgba(0, 186, 124, 0.05)",
                        ]}
                        style={styles.gradientFill}
                      />
                      <View
                        style={[
                          styles.barCapDot,
                          { backgroundColor: "#00BA7C" },
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* X-Axis Date Label */}
                <View style={styles.xAxisLabelBox}>
                  {showLabel && (
                    <Text
                      style={[
                        styles.xAxisText,
                        isSelected && styles.xAxisTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.displayDate}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
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
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  chartTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  chartSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "600",
  },
  scrubHintText: {
    color: "#64748B",
    fontSize: 11,
    marginBottom: 8,
  },
  tooltipBubble: {
    backgroundColor: "#1F2026",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  tooltipDate: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "600",
  },
  tooltipStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  tooltipStat: {
    fontSize: 12,
    fontWeight: "700",
  },
  canvasContainer: {
    height: 160,
    position: "relative",
    paddingLeft: 20,
    justifyContent: "flex-end",
  },
  gridOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 22,
    justifyContent: "space-between",
  },
  gridLineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  yAxisText: {
    width: 20,
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    textAlign: "right",
    marginRight: 6,
    fontVariant: ["tabular-nums"],
  },
  gridLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  columnsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 22,
  },
  dataColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 1,
  },
  dataColumnSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 6,
  },
  barsContainer: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  barTrack: {
    flex: 1,
    maxWidth: 8,
    borderRadius: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  gradientFill: {
    ...StyleSheet.absoluteFillObject,
  },
  barCapDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    marginTop: 1,
  },
  emptyPointDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(113, 118, 123, 0.3)",
    marginBottom: 2,
  },
  xAxisLabelBox: {
    position: "absolute",
    bottom: -20,
    left: -12,
    right: -12,
    alignItems: "center",
  },
  xAxisText: {
    color: "#64748B",
    fontSize: 9.5,
    fontWeight: "600",
  },
  xAxisTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  emptyContainer: {
    height: 180,
    backgroundColor: "#16161A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 8,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 13,
  },
});

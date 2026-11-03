import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { threadsTokens } from "../theme/appleTokens";

interface TrendDataPoint {
  dateKey: string;
  count: number;
}

interface InsightsTrendChartProps {
  data: TrendDataPoint[];
  daysCount: number;
}

/**
 * Authentic Instagram Threads Minimalist Trend Chart
 * Calibrated directly from Screenshots 15-59-01.png & 15-59-21.png:
 * Left Y-axis labels with hairline horizontal reference lines and plotted points
 */
export const InsightsTrendChart: React.FC<InsightsTrendChartProps> = ({
  data,
  daysCount,
}) => {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const midVal = Math.ceil(maxVal / 2);

  return (
    <View style={styles.chartContainer}>
      {/* Chart Canvas with Gridlines */}
      <View style={styles.canvasArea}>
        {/* Top Gridline */}
        <View style={styles.gridRow}>
          <Text style={styles.axisLabel}>{maxVal}</Text>
          <View style={styles.gridLine} />
        </View>

        {/* Mid Gridline */}
        <View style={styles.gridRow}>
          <Text style={styles.axisLabel}>{midVal}</Text>
          <View style={styles.gridLine} />
        </View>

        {/* Bottom Baseline (0) */}
        <View style={styles.gridRow}>
          <Text style={styles.axisLabel}>0</Text>
          <View style={styles.gridLine} />
        </View>

        {/* Plotted Bars / Points Layer */}
        <View style={styles.dataPlotOverlay}>
          {data.map((item, index) => {
            const heightPct = (item.count / maxVal) * 100;
            const hasActivity = item.count > 0;
            return (
              <View key={item.dateKey || index} style={styles.dataCol}>
                {hasActivity ? (
                  <View
                    style={[
                      styles.activityBar,
                      {
                        height: `${Math.max(heightPct, 8)}%`,
                      },
                    ]}
                  >
                    <View style={styles.activeDot} />
                  </View>
                ) : (
                  <View style={styles.emptyColPoint} />
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    height: 140,
    paddingTop: 8,
    paddingBottom: 4,
    marginBottom: 20,
  },
  canvasArea: {
    flex: 1,
    justifyContent: "space-between",
    position: "relative",
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  axisLabel: {
    width: 22,
    fontSize: 12,
    color: threadsTokens.colors.textSecondary,
    fontWeight: "400",
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1C1C1E",
    marginLeft: 6,
  },
  dataPlotOverlay: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: 28,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  dataCol: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 1,
  },
  activityBar: {
    width: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 1.5,
    alignItems: "center",
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FFFFFF",
    position: "absolute",
    top: -2.5,
  },
  emptyColPoint: {
    width: 1,
    height: 2,
    backgroundColor: "transparent",
  },
});

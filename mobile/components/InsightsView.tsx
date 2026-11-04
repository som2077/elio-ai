import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SavedVideo } from "../types/video";
import { ActivityCalendar } from "./ActivityCalendar";
import { TimeRangeMenu, TimeRange } from "./TimeRangeMenu";
import {
  SavedVsWatchedAreaChart,
  DailyPoint,
} from "./SavedVsWatchedAreaChart";
import { PlatformDonutChart } from "./PlatformDonutChart";
import { ActivityStreakGrid } from "./ActivityStreakGrid";
import {
  toDateKey,
  formatDisplayDate,
} from "../services/dateAnalytics";
import { haptics } from "../utils/haptics";

export type InsightsTab = "overview" | "sources";
export type ClipFilterOption = "all" | "in_queue" | "watched" | "favorites";

interface InsightsViewProps {
  videos: SavedVideo[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
  onVideoPress?: (video: SavedVideo) => void;
  onBack?: () => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  videos,
  selectedDate,
  onSelectDate,
  onVideoPress,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<InsightsTab>("overview");
  const [profileRange, setProfileRange] = useState<TimeRange>("30d");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [clipFilter, setClipFilter] = useState<ClipFilterOption>("all");

  const getDaysCount = (r: TimeRange): number => {
    switch (r) {
      case "7d":
        return 7;
      case "14d":
        return 14;
      case "30d":
        return 30;
      case "90d":
        return 90;
      default:
        return 30;
    }
  };

  const getRangeLabel = (r: TimeRange): string => {
    switch (r) {
      case "7d":
        return "7 days";
      case "14d":
        return "14 days";
      case "30d":
        return "30 days";
      case "90d":
        return "90 days";
      default:
        return "30 days";
    }
  };

  // Video Vault metrics for selected Profile Range
  const metrics = useMemo(() => {
    const days = getDaysCount(profileRange);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = toDateKey(cutoff);

    const inRange = videos.filter((v) => toDateKey(v.created_at) >= cutoffKey);
    const totalSaved = inRange.length;
    const watched = inRange.filter((v) => v.status === "watched").length;
    const inQueue = inRange.filter((v) => v.status === "unread").length;
    const completionRate =
      totalSaved > 0 ? Math.round((watched / totalSaved) * 100) : 0;
    const favorites = inRange.filter((v) => v.is_favorite).length;

    return {
      totalSaved,
      watched,
      inQueue,
      completionRate,
      favorites,
    };
  }, [videos, profileRange]);

  // Dual Daily Trend Data Points for Saved vs Watched Area Chart
  const trendData: DailyPoint[] = useMemo(() => {
    const days = getDaysCount(profileRange);
    const savedCounts: Record<string, number> = {};
    const watchedCounts: Record<string, number> = {};

    for (const v of videos) {
      if (!v.created_at) continue;
      const k = toDateKey(v.created_at);
      savedCounts[k] = (savedCounts[k] || 0) + 1;

      if (v.status === "watched") {
        const watchedKey = toDateKey(v.updated_at || v.created_at);
        watchedCounts[watchedKey] = (watchedCounts[watchedKey] || 0) + 1;
      }
    }

    const points: DailyPoint[] = [];
    const curr = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(curr);
      d.setDate(d.getDate() - i);
      const k = toDateKey(d);

      // Compact display date: "4 Nov" or "Wed" for 7d
      const dayNum = d.getDate();
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const displayDate =
        days === 7
          ? weekdayNames[d.getDay()]
          : `${dayNum} ${monthNames[d.getMonth()]}`;

      points.push({
        dateKey: k,
        displayDate,
        saved: savedCounts[k] || 0,
        watched: watchedCounts[k] || 0,
      });
    }

    return points;
  }, [videos, profileRange]);

  // Platform Distribution Stats
  const platformStats = useMemo(() => {
    const counts: Record<string, number> = {
      youtube: 0,
      instagram: 0,
      twitter: 0,
      tiktok: 0,
      reddit: 0,
    };

    for (const v of videos) {
      const p = (v.platform || "").toLowerCase();
      if (counts[p] !== undefined) counts[p]++;
    }

    const meta: Record<
      string,
      { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
    > = {
      youtube: { label: "YouTube", icon: "logo-youtube", color: "#FF0033" },
      instagram: { label: "Instagram", icon: "logo-instagram", color: "#E1306C" },
      twitter: { label: "X / Twitter", icon: "logo-twitter", color: "#1D9BF0" },
      tiktok: { label: "TikTok", icon: "musical-notes", color: "#00F2FE" },
      reddit: { label: "Reddit", icon: "logo-reddit", color: "#FF4500" },
    };

    const total = videos.length;
    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
        ...(meta[key] || {
          label: key,
          icon: "film-outline" as keyof typeof Ionicons.glyphMap,
          color: "#8E8E93",
        }),
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [videos]);

  // Filtered Clips List
  const filteredClips = useMemo(() => {
    let list = [...videos];
    if (clipFilter === "in_queue") {
      list = list.filter((v) => v.status === "unread");
    } else if (clipFilter === "watched") {
      list = list.filter((v) => v.status === "watched");
    } else if (clipFilter === "favorites") {
      list = list.filter((v) => v.is_favorite);
    }
    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [videos, clipFilter]);

  const getRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      return `${Math.floor(days / 30)}mo ago`;
    } catch {
      return "now";
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.backBtn}
          onPress={() => {
            haptics.light();
            if (onBack) onBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Analytics & Insights</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.rangeDropdownBtn}
          onPress={() => {
            haptics.selection();
            setShowProfileMenu(true);
          }}
        >
          <Text style={styles.rangeDropdownText}>
            {getRangeLabel(profileRange)}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color="#71767B"
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
      </View>

      {/* Top Segmented Navigation Tabs */}
      <View style={styles.segmentedTabsRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.segmentTab,
            activeTab === "overview" && styles.segmentTabActive,
          ]}
          onPress={() => {
            haptics.selection();
            setActiveTab("overview");
          }}
        >
          <Text
            style={[
              styles.segmentTabText,
              activeTab === "overview" && styles.segmentTabTextActive,
            ]}
          >
            Overview & Trends
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.segmentTab,
            activeTab === "sources" && styles.segmentTabActive,
          ]}
          onPress={() => {
            haptics.selection();
            setActiveTab("sources");
          }}
        >
          <Text
            style={[
              styles.segmentTabText,
              activeTab === "sources" && styles.segmentTabTextActive,
            ]}
          >
            Sources & Heatmap
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Body */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* KPI Summary Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiContainer}
        >
          <View style={styles.metricCard}>
            <Text style={styles.metricCardLabel}>Saved</Text>
            <Text style={styles.metricCardValue}>{metrics.totalSaved}</Text>
            <Text style={styles.metricCardSub}>In {getRangeLabel(profileRange)}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricCardLabel}>In Queue</Text>
            <Text style={[styles.metricCardValue, { color: "#1D9BF0" }]}>
              {metrics.inQueue}
            </Text>
            <Text style={styles.metricCardSub}>To watch</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricCardLabel}>Watched</Text>
            <Text style={[styles.metricCardValue, { color: "#00BA7C" }]}>
              {metrics.watched}
            </Text>
            <Text style={styles.metricCardSub}>Completed</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricCardLabel}>Watch Rate</Text>
            <Text style={[styles.metricCardValue, { color: "#F91880" }]}>
              {metrics.completionRate}%
            </Text>
            <Text style={styles.metricCardSub}>Completion</Text>
          </View>
        </ScrollView>

        {activeTab === "overview" ? (
          <>
            {/* 1. Industry-Grade Dual Area Trend Chart */}
            <SavedVsWatchedAreaChart
              data={trendData}
              timeRange={profileRange}
            />

            {/* 2. Platform Distribution Donut Ring */}
            <PlatformDonutChart
              data={platformStats}
              totalClips={videos.length}
            />

            {/* 3. Consistency Heatmap Matrix */}
            <ActivityStreakGrid
              videos={videos}
              onSelectDate={(k) => onSelectDate(k)}
            />

            {/* 4. Clips Activity History */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Library Activity</Text>
              <Text style={styles.clipsCountText}>
                {filteredClips.length} Clips
              </Text>
            </View>

            {/* Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}
            >
              {[
                { id: "all", label: "All Clips" },
                { id: "in_queue", label: "In Queue" },
                { id: "watched", label: "Watched" },
                { id: "favorites", label: "Favorites" },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  activeOpacity={0.7}
                  style={[
                    styles.filterPill,
                    clipFilter === tab.id && styles.filterPillActive,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setClipFilter(tab.id as ClipFilterOption);
                  }}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      clipFilter === tab.id && styles.filterPillTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Clip List Rows */}
            <View style={styles.clipsList}>
              {filteredClips.length === 0 ? (
                <View style={styles.emptyClipsBox}>
                  <Ionicons name="film-outline" size={28} color="#71767B" />
                  <Text style={styles.emptyClipsText}>
                    No clips found for this filter
                  </Text>
                </View>
              ) : (
                filteredClips.slice(0, 15).map((item) => {
                  const isWatched = item.status === "watched";
                  const p = (item.platform || "youtube").toLowerCase();
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      style={styles.clipItemRow}
                      onPress={() => {
                        haptics.light();
                        if (onVideoPress) onVideoPress(item);
                      }}
                    >
                      {item.thumbnail_url ? (
                        <Image
                          source={{ uri: item.thumbnail_url }}
                          style={styles.clipItemThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.emptyThumbSquare}>
                          <Ionicons
                            name="videocam-outline"
                            size={20}
                            color="#71767B"
                          />
                        </View>
                      )}

                      <View style={styles.clipItemCenter}>
                        <Text style={styles.clipItemTitle} numberOfLines={1}>
                          {item.title || "Untitled Clip"}
                        </Text>
                        <View style={styles.clipSubRow}>
                          <Text style={styles.clipPlatformText}>
                            {item.platform || "Video"}
                          </Text>
                          <Text style={styles.clipDot}>•</Text>
                          <Text style={styles.clipTimeText}>
                            {getRelativeTime(item.created_at)}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          isWatched
                            ? styles.statusBadgeWatched
                            : styles.statusBadgeQueue,
                        ]}
                      >
                        <Ionicons
                          name={
                            isWatched
                              ? "checkmark-circle"
                              : "ellipse-outline"
                          }
                          size={11}
                          color={isWatched ? "#00BA7C" : "#1D9BF0"}
                          style={{ marginRight: 3 }}
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isWatched
                              ? styles.statusBadgeTextWatched
                              : styles.statusBadgeTextQueue,
                          ]}
                        >
                          {isWatched ? "Watched" : "Queue"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        ) : (
          /* TAB 2: SOURCES & HEATMAP */
          <View style={styles.sourcesContainer}>
            {/* Donut Chart */}
            <PlatformDonutChart
              data={platformStats}
              totalClips={videos.length}
            />

            {/* 12-Week Rolling Matrix */}
            <ActivityStreakGrid
              videos={videos}
              onSelectDate={(k) => onSelectDate(k)}
            />

            {/* Monthly Calendar View */}
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
                Monthly Activity Calendar
              </Text>
              <ActivityCalendar
                videos={videos}
                selectedDate={selectedDate}
                onSelectDate={onSelectDate}
              />
            </View>
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Floating Time Range Modal */}
      <TimeRangeMenu
        visible={showProfileMenu}
        selectedRange={profileRange}
        onSelect={(r) => setProfileRange(r)}
        onClose={() => setShowProfileMenu(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  headerBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2F3336",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  rangeDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#16181C",
    borderWidth: 1,
    borderColor: "#2F3336",
  },
  rangeDropdownText: {
    fontSize: 12.5,
    color: "#E7E9EA",
    fontWeight: "600",
  },
  segmentedTabsRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2F3336",
    paddingHorizontal: 16,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  segmentTabActive: {
    borderBottomColor: "#FFFFFF",
  },
  segmentTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#71767B",
  },
  segmentTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  kpiContainer: {
    gap: 10,
    paddingBottom: 18,
  },
  metricCard: {
    width: 124,
    backgroundColor: "#16181C",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2F3336",
  },
  metricCardLabel: {
    fontSize: 12,
    color: "#71767B",
    fontWeight: "500",
    marginBottom: 6,
  },
  metricCardValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  metricCardSub: {
    fontSize: 11,
    color: "#71767B",
    fontWeight: "500",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  clipsCountText: {
    fontSize: 12,
    color: "#71767B",
    fontWeight: "500",
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#16181C",
    borderWidth: 1,
    borderColor: "#2F3336",
  },
  filterPillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  filterPillText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#71767B",
  },
  filterPillTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  clipsList: {
    gap: 8,
  },
  emptyClipsBox: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16181C",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2F3336",
    gap: 6,
  },
  emptyClipsText: {
    color: "#71767B",
    fontSize: 13,
  },
  clipItemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#16181C",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2F3336",
  },
  clipItemThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#000000",
    marginRight: 10,
  },
  emptyThumbSquare: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#202327",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  clipItemCenter: {
    flex: 1,
    marginRight: 8,
  },
  clipItemTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  clipSubRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  clipPlatformText: {
    fontSize: 11.5,
    color: "#71767B",
    textTransform: "capitalize",
  },
  clipDot: {
    fontSize: 10,
    color: "#71767B",
    marginHorizontal: 4,
  },
  clipTimeText: {
    fontSize: 11.5,
    color: "#71767B",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeQueue: {
    backgroundColor: "rgba(29, 155, 240, 0.10)",
    borderColor: "rgba(29, 155, 240, 0.28)",
  },
  statusBadgeWatched: {
    backgroundColor: "rgba(0, 186, 124, 0.10)",
    borderColor: "rgba(0, 186, 124, 0.28)",
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  statusBadgeTextQueue: {
    color: "#1D9BF0",
  },
  statusBadgeTextWatched: {
    color: "#00BA7C",
  },
  sourcesContainer: {
    paddingTop: 4,
  },
});

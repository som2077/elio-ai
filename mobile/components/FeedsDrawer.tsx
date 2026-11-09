import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { PikaIcon } from "./PikaIcon";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import { SavedVideo } from "../types/video";
import {
  calculateActivityStats,
  getDailyActivityMap,
  getMonthDaysGrid,
  formatDisplayDate,
  toDateKey,
} from "../services/dateAnalytics";
import { triggerLayoutMotion } from "../utils/motion";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

export type FeedFilterType =
  | "for_you"
  | "productive"
  | "following"
  | "saved"
  | "favorites"
  | string;

interface FeedsDrawerProps {
  visible: boolean;
  activeFeed: FeedFilterType;
  onClose: () => void;
  onSelectFeed: (feedKey: FeedFilterType) => void;
  onCreateFeedPress: () => void;
  videos?: SavedVideo[];
  selectedDate?: string | null;
  onSelectDate?: (dateKey: string | null) => void;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export const FeedsDrawer: React.FC<FeedsDrawerProps> = ({
  visible,
  activeFeed,
  onClose,
  onSelectFeed,
  onCreateFeedPress,
  videos = [],
  selectedDate = null,
  onSelectDate,
}) => {
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.85)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Calendar State
  const today = new Date();
  const [calYear, setCalYear] = useState<number>(today.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(today.getMonth() + 1);

  // Selected date preview (defaults to selectedDate or today)
  const todayKey = toDateKey(today);
  const [previewDate, setPreviewDate] = useState<string>(selectedDate || todayKey);

  useEffect(() => {
    if (selectedDate) {
      setPreviewDate(selectedDate);
    }
  }, [selectedDate]);

  const safeVideos = videos || [];
  const activityMap = useMemo(() => getDailyActivityMap(safeVideos), [safeVideos]);
  const stats = useMemo(() => calculateActivityStats(safeVideos), [safeVideos]);
  const daysGrid = useMemo(
    () => getMonthDaysGrid(calYear, calMonth, activityMap),
    [calYear, calMonth, activityMap]
  );

  const activeDateClips = useMemo(() => {
    return safeVideos.filter((v) => toDateKey(v.created_at) === previewDate);
  }, [safeVideos, previewDate]);

  const handlePrevMonth = () => {
    haptics.selection();
    triggerLayoutMotion(180);
    if (calMonth === 1) {
      setCalMonth(12);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    haptics.selection();
    triggerLayoutMotion(180);
    if (calMonth === 12) {
      setCalMonth(1);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
  };

  const handleDatePress = (dateKey: string) => {
    haptics.selection();
    triggerLayoutMotion(180);
    setPreviewDate(dateKey);
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          stiffness: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_WIDTH * 0.85,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: overlayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.7],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Drawer Panel */}
        <Animated.View
          style={[
            styles.drawerPanel,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.drawerHeader}>
            <Text style={styles.headerTitle}>Feeds</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.headerIconBtn}
                onPress={() => {
                  haptics.selection();
                  onClose();
                  onCreateFeedPress();
                }}
              >
                <PikaIcon name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.headerIconBtn}
                onPress={() => haptics.light()}
              >
                <PikaIcon name="pencil-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Filter Tabs: Heart & Bookmark */}
          <View style={styles.quickTabsRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              style={[
                styles.quickTabBtn,
                activeFeed === "favorites" && styles.quickTabBtnActive,
              ]}
              onPress={() => {
                haptics.selection();
                onSelectFeed("favorites");
                onClose();
              }}
            >
              <PikaIcon
                name={activeFeed === "favorites" ? "heart" : "heart-outline"}
                size={22}
                color={
                  activeFeed === "favorites"
                    ? threadsTokens.colors.likeRed
                    : "#FFFFFF"
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              style={[
                styles.quickTabBtn,
                activeFeed === "saved" && styles.quickTabBtnActive,
              ]}
              onPress={() => {
                haptics.selection();
                onSelectFeed("saved");
                onClose();
              }}
            >
              <PikaIcon
                name={activeFeed === "saved" ? "bookmark" : "bookmark-outline"}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          {/* Feeds List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.feedsCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.feedListItem,
                  activeFeed === "for_you" && styles.feedListItemActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  onSelectFeed("for_you");
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.feedItemTitle,
                    activeFeed === "for_you" && styles.feedItemTitleActive,
                  ]}
                >
                  For you
                </Text>
                {activeFeed === "for_you" && (
                  <View style={styles.activeCheckDot} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.feedListItem,
                  activeFeed === "productive" && styles.feedListItemActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  onSelectFeed("productive");
                  onClose();
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text
                    style={[
                      styles.feedItemTitle,
                      activeFeed === "productive" && styles.feedItemTitleActive,
                      { color: activeFeed === "productive" ? "#FFFFFF" : "#818CF8" },
                    ]}
                  >
                    ⚡ Productive & Learning
                  </Text>
                  <View
                    style={{
                      backgroundColor: "rgba(99, 102, 241, 0.2)",
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: "rgba(99, 102, 241, 0.4)",
                    }}
                  >
                    <Text
                      style={{
                        color: "#818CF8",
                        fontSize: 9.5,
                        fontWeight: "700",
                      }}
                    >
                      AI FILTER
                    </Text>
                  </View>
                </View>
                {activeFeed === "productive" && (
                  <View style={styles.activeCheckDot} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.feedListItem,
                  activeFeed === "following" && styles.feedListItemActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  onSelectFeed("following");
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.feedItemTitle,
                    activeFeed === "following" && styles.feedItemTitleActive,
                  ]}
                >
                  Following
                </Text>
                {activeFeed === "following" && (
                  <View style={styles.activeCheckDot} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.feedListItem,
                  activeFeed === "ghost_posts" && styles.feedListItemActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  onSelectFeed("ghost_posts");
                  onClose();
                }}
              >
                <View style={styles.ghostItemLeft}>
                  <Text
                    style={[
                      styles.feedItemTitle,
                      activeFeed === "ghost_posts" &&
                        styles.feedItemTitleActive,
                    ]}
                  >
                    Ghost posts
                  </Text>
                </View>
                <PikaIcon
                  name="chatbubble-ellipses-outline"
                  size={18}
                  color={threadsTokens.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Calendar Card */}
            <View style={styles.calendarCard}>
              {/* Month Navigator Header inside card */}
              <View style={styles.calMonthNavRow}>
                <Text style={styles.calMonthLabel}>
                  {MONTH_NAMES[calMonth - 1]} {calYear}
                </Text>
                <View style={styles.calNavControls}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.calNavBtn}
                    onPress={handlePrevMonth}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <PikaIcon name="chevron-back" size={14} color="#D4D4D8" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.calNavBtn}
                    onPress={handleNextMonth}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <PikaIcon name="chevron-forward" size={14} color="#D4D4D8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Day of week labels */}
              <View style={styles.weekDaysRow}>
                {WEEK_DAYS.map((day, idx) => (
                  <View key={idx} style={styles.weekDayCol}>
                    <Text style={styles.weekDayText}>{day}</Text>
                  </View>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {daysGrid.map((day, idx) => {
                  const isSelected = previewDate === day.dateKey;
                  const hasSaves = day.saveCount > 0;

                  return (
                    <TouchableOpacity
                      key={`${day.dateKey}_${idx}`}
                      activeOpacity={0.7}
                      style={styles.dayCell}
                      onPress={() => handleDatePress(day.dateKey)}
                    >
                      <View
                        style={[
                          styles.dayInnerCircle,
                          isSelected && styles.dayInnerCircleSelected,
                          day.isToday && !isSelected && styles.dayInnerCircleToday,
                          hasSaves && !isSelected && !day.isToday && styles.dayInnerCircleActiveSave,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumberText,
                            !day.isCurrentMonth && styles.dayNumberDim,
                            isSelected && styles.dayNumberSelected,
                            day.isToday && !isSelected && styles.dayNumberToday,
                          ]}
                        >
                          {day.dayNumber}
                        </Text>
                        {hasSaves && (
                          <View
                            style={[
                              styles.saveDot,
                              isSelected && { backgroundColor: "#FFFFFF" },
                            ]}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selected Date Clip Preview Banner */}
              <View style={styles.selectedDateBanner}>
                <View style={styles.selectedDateLeft}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <PikaIcon name="film" size={13} color="#818CF8" />
                    <Text style={styles.selectedDateTitle}>
                      {previewDate === todayKey ? "Today, " : ""}
                      {formatDisplayDate(previewDate)}
                    </Text>
                  </View>
                  <Text style={styles.selectedDateSub}>
                    {activeDateClips.length > 0
                      ? `${activeDateClips.length} ${activeDateClips.length === 1 ? "clip" : "clips"} saved`
                      : "No clips saved on this day"}
                  </Text>
                </View>

                {activeDateClips.length > 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.filterFeedActionBtn}
                    onPress={() => {
                      haptics.success();
                      if (onSelectDate) onSelectDate(previewDate);
                      onClose();
                    }}
                  >
                    <Text style={styles.filterFeedActionText}>View Clips →</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noClipsBadge}>
                    <Text style={styles.noClipsBadgeText}>0 clips</Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000",
  },
  drawerPanel: {
    width: "82%",
    maxWidth: 360,
    height: "100%",
    backgroundColor: "#000000",
    borderRightWidth: 1,
    borderRightColor: "#1A1A1A",
    paddingTop: 54,
    paddingHorizontal: 20,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTabsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  quickTabBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  quickTabBtnActive: {
    backgroundColor: "#1C1C1E",
    borderColor: "#333333",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  feedsCard: {
    backgroundColor: "#0A0A0A",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E1E1E",
    marginBottom: 28,
  },
  feedListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#181818",
  },
  feedListItemActive: {
    backgroundColor: "#141414",
  },
  feedItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  feedItemTitleActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  activeCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: threadsTokens.colors.verifiedBlue,
  },
  ghostItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  streakBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#F59E0B",
  },
  calMonthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  calMonthLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  calNavControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  calNavBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#141416",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarCard: {
    backgroundColor: "#000000",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    padding: 12,
  },
  weekDaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekDayCol: {
    width: "14.28%",
    alignItems: "center",
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#71717A",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 1,
  },
  dayInnerCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  dayInnerCircleSelected: {
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  dayInnerCircleToday: {
    borderWidth: 1.5,
    borderColor: "#818CF8",
  },
  dayInnerCircleActiveSave: {
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E4E4E7",
  },
  dayNumberDim: {
    color: "#52525B",
  },
  dayNumberSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  dayNumberToday: {
    color: "#818CF8",
    fontWeight: "700",
  },
  saveDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#818CF8",
    marginTop: 1,
  },
  selectedDateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0C0C0E",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1E1E24",
  },
  selectedDateLeft: {
    flex: 1,
    marginRight: 10,
  },
  selectedDateTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  selectedDateSub: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  filterFeedActionBtn: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterFeedActionText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  noClipsBadge: {
    backgroundColor: "#161618",
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 7,
  },
  noClipsBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#71717A",
  },
  clearDateBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#161618",
    alignItems: "center",
    justifyContent: "center",
  },
});

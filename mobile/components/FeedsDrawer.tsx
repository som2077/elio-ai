import React, { useRef, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { threadsTokens } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

export type FeedFilterType = "for_you" | "following" | "saved" | "favorites" | string;

interface FeedsDrawerProps {
  visible: boolean;
  activeFeed: FeedFilterType;
  onClose: () => void;
  onSelectFeed: (feedKey: FeedFilterType) => void;
  onCreateFeedPress: () => void;
}

const COMMUNITIES = [
  {
    id: "youtube",
    name: "YouTube Threads",
    members: "1.2M members",
    activity: "420 recent clips",
    icon: "logo-youtube",
    iconColor: "#FF0033",
  },
  {
    id: "instagram",
    name: "Instagram Threads",
    members: "980K members",
    activity: "315 recent clips",
    icon: "logo-instagram",
    iconColor: "#E1306C",
  },
  {
    id: "twitter",
    name: "X / Twitter Threads",
    members: "850K members",
    activity: "188 recent clips",
    icon: "logo-twitter",
    iconColor: "#1D9BF0",
  },
  {
    id: "tiktok",
    name: "TikTok Threads",
    members: "1.5M members",
    activity: "620 recent clips",
    icon: "musical-notes",
    iconColor: "#00F2FE",
  },
  {
    id: "reddit",
    name: "Reddit Threads",
    members: "640K members",
    activity: "94 recent clips",
    icon: "logo-reddit",
    iconColor: "#FF4500",
  },
];

export const FeedsDrawer: React.FC<FeedsDrawerProps> = ({
  visible,
  activeFeed,
  onClose,
  onSelectFeed,
  onCreateFeedPress,
}) => {
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.85)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

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
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.headerIconBtn}
                onPress={() => haptics.light()}
              >
                <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
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
              <Ionicons
                name={activeFeed === "favorites" ? "heart" : "heart-outline"}
                size={22}
                color={activeFeed === "favorites" ? threadsTokens.colors.likeRed : "#FFFFFF"}
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
              <Ionicons
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
                      activeFeed === "ghost_posts" && styles.feedItemTitleActive,
                    ]}
                  >
                    Ghost posts
                  </Text>
                </View>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={18}
                  color={threadsTokens.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Popular Communities Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Popular communities</Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => haptics.light()}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.communitiesList}>
              {COMMUNITIES.map((comm) => {
                const isSelected = activeFeed === comm.id;
                return (
                  <TouchableOpacity
                    key={comm.id}
                    activeOpacity={0.7}
                    style={[
                      styles.communityItem,
                      isSelected && styles.communityItemActive,
                    ]}
                    onPress={() => {
                      haptics.selection();
                      onSelectFeed(comm.id);
                      onClose();
                    }}
                  >
                    <View style={styles.communityInfo}>
                      <Text style={styles.communityName}>{comm.name}</Text>
                      <Text style={styles.communitySub}>
                        {comm.members} • {comm.activity}
                      </Text>
                    </View>

                    {/* Stacked Avatars / Icons */}
                    <View style={styles.avatarStack}>
                      <View
                        style={[
                          styles.avatarStackCircle,
                          { backgroundColor: comm.iconColor },
                        ]}
                      >
                        <Ionicons name={comm.icon as any} size={14} color="#FFFFFF" />
                      </View>
                      <View
                        style={[
                          styles.avatarStackCircle,
                          styles.avatarStackOverlap,
                          { backgroundColor: "#333333" },
                        ]}
                      >
                        <Ionicons name="videocam-outline" size={12} color="#FFFFFF" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
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
    backgroundColor: "#121212",
    borderRightWidth: 1,
    borderRightColor: "#222222",
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
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  quickTabBtnActive: {
    backgroundColor: "#2C2C2E",
    borderColor: "#444444",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  feedsCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#262626",
    marginBottom: 28,
  },
  feedListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  feedListItemActive: {
    backgroundColor: "#222222",
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
    fontWeight: "600",
    color: threadsTokens.colors.textSecondary,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "500",
    color: threadsTokens.colors.textSecondary,
  },
  communitiesList: {
    gap: 4,
  },
  communityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222222",
  },
  communityItemActive: {
    opacity: 0.8,
  },
  communityInfo: {
    flex: 1,
    marginRight: 12,
  },
  communityName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  communitySub: {
    fontSize: 12,
    color: threadsTokens.colors.textSecondary,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarStackCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#121212",
  },
  avatarStackOverlap: {
    marginLeft: -8,
  },
});

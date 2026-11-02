import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../services/supabase";
import { SavedVideo } from "../types/video";
import { VideoCard } from "../components/VideoCard";
import { VideoGridCard } from "../components/VideoGridCard";
import { HeroSpotlightCard } from "../components/HeroSpotlightCard";
import { FloatingTabBar, TabKey } from "../components/FloatingTabBar";
import { SearchBar } from "../components/SearchBar";
import { InsightsView } from "../components/InsightsView";
import { DevicesView } from "../components/DevicesView";
import { SkeletonCard } from "../components/SkeletonCard";
import { GridSkeletonCard } from "../components/GridSkeletonCard";
import { VideoDetailSheet } from "../components/VideoDetailSheet";
import { ToastHUD, ToastConfig } from "../components/ToastHUD";
import { BentoStatsStrip } from "../components/BentoStatsStrip";
import { openVideoDirectly } from "../services/deepLink";
import { AuthScreen } from "../components/AuthScreen";
import { QRScannerModal } from "../components/QRScannerModal";
import { LinkedDevicesModal } from "../components/LinkedDevicesModal";
import { AppleHeader } from "../components/AppleHeader";
import { AppleFilterPills, FilterCategory } from "../components/AppleFilterPills";
import { EmptyState } from "../components/EmptyState";
import { triggerLayoutMotion } from "../utils/motion";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";

export default function HomeScreen() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  // Tab & Layout states
  const [activeTab, setActiveTab] = useState<TabKey>("feed");
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");
  const [spotlightDismissed, setSpotlightDismissed] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPlatform, setSearchPlatform] = useState("all");

  // Video data & filter states
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Dynamic Island Toast HUD & Detail Modal states
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [detailVideo, setDetailVideo] = useState<SavedVideo | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);

  // Auth session listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthLoading(false);
      if (currentSession) {
        fetchVideos(currentSession.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        fetchVideos(newSession.user.id);
      } else {
        setVideos([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchVideos = async (userId?: string) => {
    try {
      const targetUserId = userId || session?.user?.id;
      let query = supabase
        .from("saved_videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (targetUserId) {
        query = query.eq("user_id", targetUserId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn("Supabase fetch notice:", error.message);
      } else if (data) {
        setVideos(data as SavedVideo[]);
      }
    } catch (err: any) {
      console.warn("Network issue:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Realtime Supabase listener
  useEffect(() => {
    if (!session?.user?.id) return;

    try {
      const channel = supabase
        .channel("saved_videos_realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "saved_videos",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            fetchVideos(session.user.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn("Realtime subscription warning:", err);
    }
  }, [session?.user?.id]);

  const toggleStatus = async (video: SavedVideo) => {
    const newStatus = video.status === "unread" ? "watched" : "unread";
    haptics.success();
    triggerLayoutMotion();

    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, status: newStatus } : v))
    );

    if (detailVideo && detailVideo.id === video.id) {
      setDetailVideo((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    setToast({
      message: newStatus === "watched" ? "Marked as Watched" : "Moved back to In Queue",
      type: "success",
    });

    await supabase
      .from("saved_videos")
      .update({ status: newStatus })
      .eq("id", video.id);
  };

  const handleDeleteVideo = async (video: SavedVideo) => {
    haptics.warning();
    triggerLayoutMotion();

    // Optimistic UI removal
    setVideos((prev) => prev.filter((v) => v.id !== video.id));
    if (detailVideo && detailVideo.id === video.id) {
      setShowDetailSheet(false);
      setDetailVideo(null);
    }

    setToast({
      message: "Clip removed from vault",
      type: "delete",
    });

    const { error } = await supabase
      .from("saved_videos")
      .delete()
      .eq("id", video.id);

    if (error) {
      console.warn("Failed to delete video:", error.message);
      fetchVideos();
    }
  };

  const handleCopyLink = (_url: string) => {
    haptics.light();
    setToast({
      message: "Link copied to clipboard",
      type: "link",
    });
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of Elio AI?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          haptics.warning();
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const unreadCount = useMemo(
    () => videos.filter((v) => v.status === "unread").length,
    [videos]
  );

  // Spotlight video (top unread clip)
  const spotlightVideo = useMemo(() => {
    if (spotlightDismissed) return null;
    return videos.find((v) => v.status === "unread") || null;
  }, [videos, spotlightDismissed]);

  // Feed filtered videos
  const feedVideos = useMemo(() => {
    return videos.filter((v) => {
      if (filter === "youtube") return v.platform === "youtube";
      if (filter === "instagram") return v.platform === "instagram";
      if (filter === "twitter") return v.platform === "twitter";
      if (filter === "tiktok") return v.platform === "tiktok";
      if (filter === "unread") return v.status === "unread";
      return true;
    });
  }, [videos, filter]);

  // Search filtered videos
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return videos.filter((v) => {
      // Platform filter
      if (searchPlatform !== "all" && v.platform !== searchPlatform) {
        return false;
      }
      if (!q) return true;
      const titleMatch = (v.title || "").toLowerCase().includes(q);
      const creatorMatch = (v.creator_name || "").toLowerCase().includes(q);
      const notesMatch = (v.user_notes || "").toLowerCase().includes(q);
      return titleMatch || creatorMatch || notesMatch;
    });
  }, [videos, searchQuery, searchPlatform]);

  if (authLoading) {
    return (
      <SafeAreaView
        style={[styles.safeContainer, styles.centerContainer]}
        edges={["top", "left", "right"]}
      >
        <StatusBar style="light" backgroundColor="#000000" translucent={true} />
        <ActivityIndicator size="large" color={appleColors.accent} />
        <Text style={styles.loadingText}>Syncing Elio AI...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen onAuthSuccess={() => fetchVideos()} />;
  }

  return (
    <SafeAreaView style={styles.safeContainer} edges={["top", "left", "right"]}>
      <StatusBar style="light" backgroundColor="#000000" translucent={true} />

      {/* VIEW: WATCHLIST FEED */}
      {activeTab === "feed" && (
        <View style={styles.tabContentContainer}>
          {/* Top Apple Header */}
          <AppleHeader
            userEmail={session?.user?.email}
            totalCount={videos.length}
            unreadCount={unreadCount}
            layoutMode={layoutMode}
            onToggleLayout={() => {
              triggerLayoutMotion();
              setLayoutMode((prev) => (prev === "grid" ? "list" : "grid"));
            }}
            onOpenScanner={() => setShowScanner(true)}
          />

          {/* Bento Stats Telemetry Strip */}
          <BentoStatsStrip
            totalCount={videos.length}
            unreadCount={unreadCount}
            videos={videos}
            onPressUnread={() => {
              triggerLayoutMotion();
              setFilter("unread");
            }}
          />

          {/* Horizontal Filter Bar */}
          <AppleFilterPills
            filter={filter}
            videos={videos}
            onSelectFilter={(newFilter) => {
              triggerLayoutMotion();
              setFilter(newFilter);
            }}
          />

          {loading ? (
            layoutMode === "grid" ? (
              <View style={styles.gridLoadingContainer}>
                <View style={styles.gridSkeletonRow}>
                  <GridSkeletonCard />
                  <GridSkeletonCard />
                </View>
                <View style={styles.gridSkeletonRow}>
                  <GridSkeletonCard />
                  <GridSkeletonCard />
                </View>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.listContent}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </ScrollView>
            )
          ) : layoutMode === "grid" ? (
            /* 2-COLUMN COSMOS POSTER GRID */
            <FlatList
              key="grid-view-2-col"
              data={feedVideos}
              numColumns={2}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                spotlightVideo ? (
                  <HeroSpotlightCard
                    video={spotlightVideo}
                    onPress={() =>
                      openVideoDirectly(
                        spotlightVideo.clean_url,
                        spotlightVideo.platform as any,
                        spotlightVideo.platform_video_id
                      )
                    }
                    onDismiss={() => setSpotlightDismissed(true)}
                  />
                ) : null
              }
              renderItem={({ item }) => (
                <VideoGridCard
                  video={item}
                  onPress={() => {
                    setDetailVideo(item);
                    setShowDetailSheet(true);
                  }}
                  onLongPress={() => {
                    setDetailVideo(item);
                    setShowDetailSheet(true);
                  }}
                  onToggleStatus={() => toggleStatus(item)}
                />
              )}
              contentContainerStyle={styles.gridContent}
              ListEmptyComponent={
                <EmptyState onLinkPress={() => setShowScanner(true)} />
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    haptics.light();
                    setRefreshing(true);
                    fetchVideos();
                  }}
                  tintColor={appleColors.accent}
                  colors={[appleColors.accent]}
                />
              }
            />
          ) : (
            /* 1-COLUMN EDITORIAL LIST */
            <FlatList
              key="list-view-1-col"
              data={feedVideos}
              numColumns={1}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                spotlightVideo ? (
                  <HeroSpotlightCard
                    video={spotlightVideo}
                    onPress={() =>
                      openVideoDirectly(
                        spotlightVideo.clean_url,
                        spotlightVideo.platform as any,
                        spotlightVideo.platform_video_id
                      )
                    }
                    onDismiss={() => setSpotlightDismissed(true)}
                  />
                ) : null
              }
              renderItem={({ item }) => (
                <VideoCard
                  video={item}
                  onPress={() => {
                    setDetailVideo(item);
                    setShowDetailSheet(true);
                  }}
                  onLongPress={() => {
                    setDetailVideo(item);
                    setShowDetailSheet(true);
                  }}
                  onToggleStatus={() => toggleStatus(item)}
                />
              )}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <EmptyState onLinkPress={() => setShowScanner(true)} />
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    haptics.light();
                    setRefreshing(true);
                    fetchVideos();
                  }}
                  tintColor={appleColors.accent}
                  colors={[appleColors.accent]}
                />
              }
            />
          )}
        </View>
      )}

      {/* VIEW: SEARCH & DISCOVER */}
      {activeTab === "search" && (
        <View style={styles.tabContentContainer}>
          <SearchBar
            query={searchQuery}
            selectedPlatform={searchPlatform}
            onChangeQuery={setSearchQuery}
            onSelectPlatform={setSearchPlatform}
            onClear={() => setSearchQuery("")}
          />

          <FlatList
            key="search-grid-2-col"
            data={searchResults}
            numColumns={2}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <VideoGridCard
                video={item}
                onPress={() => {
                  setDetailVideo(item);
                  setShowDetailSheet(true);
                }}
                onLongPress={() => {
                  setDetailVideo(item);
                  setShowDetailSheet(true);
                }}
                onToggleStatus={() => toggleStatus(item)}
              />
            )}
            contentContainerStyle={styles.gridContent}
            ListEmptyComponent={
              <View style={styles.emptySearchBox}>
                <Ionicons
                  name={searchQuery ? "search-outline" : "compass-outline"}
                  size={28}
                  color={appleColors.accentLight}
                  style={{ marginBottom: 10 }}
                />
                <Text style={styles.emptySearchTitle}>
                  {searchQuery ? "No matching clips" : "Discover & Search"}
                </Text>
                <Text style={styles.emptySearchText}>
                  {searchQuery
                    ? `No clips found matching "${searchQuery}". Try searching for creator, title or platform.`
                    : "Search titles, creators, platforms, and AI transcript notes."}
                </Text>
                {!searchQuery && (
                  <View style={styles.suggestedTagsRow}>
                    {["Podcasts", "Design", "Shorts", "Tech", "Tutorials"].map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={styles.suggestedTagPill}
                        onPress={() => {
                          haptics.selection();
                          setSearchQuery(tag);
                        }}
                      >
                        <Text style={styles.suggestedTagText}>#{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            }
          />
        </View>
      )}

      {/* VIEW: ACTIVITY & INSIGHTS */}
      {activeTab === "insights" && (
        <InsightsView
          videos={videos}
          selectedDate={selectedDate}
          onSelectDate={(date) => setSelectedDate(date)}
        />
      )}

      {/* VIEW: DEVICES & PC SYNC */}
      {activeTab === "devices" && (
        <DevicesView
          userEmail={session?.user?.email}
          onOpenScanner={() => setShowScanner(true)}
          onLogout={handleLogout}
        />
      )}

      {/* FLOATING GLASS BOTTOM NAVIGATION DOCK */}
      <FloatingTabBar
        activeTab={activeTab}
        unreadCount={unreadCount}
        onTabSelect={(tab) => {
          triggerLayoutMotion();
          setActiveTab(tab);
        }}
      />

      {/* QR Scanner Camera Modal */}
      <QRScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onSuccess={() => {
          fetchVideos();
        }}
      />

      {/* Secondary Linked Devices Modal */}
      <LinkedDevicesModal
        visible={showDevicesModal}
        onClose={() => setShowDevicesModal(false)}
      />

      {/* Dynamic Island Floating Toast HUD */}
      <ToastHUD toast={toast} onDismiss={() => setToast(null)} />

      {/* Interactive Video Detail & Action Sheet */}
      <VideoDetailSheet
        video={detailVideo}
        visible={showDetailSheet}
        onClose={() => setShowDetailSheet(false)}
        onPlay={(v) =>
          openVideoDirectly(v.clean_url, v.platform as any, v.platform_video_id)
        }
        onToggleStatus={toggleStatus}
        onCopyLink={handleCopyLink}
        onDelete={handleDeleteVideo}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centerContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  tabContentContainer: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    color: appleColors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  gridLoadingContainer: {
    paddingHorizontal: 8,
    paddingTop: 6,
    gap: 12,
  },
  gridSkeletonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 110,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 110,
  },
  emptySearchBox: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySearchTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySearchText: {
    color: appleColors.textTertiary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  suggestedTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  suggestedTagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  suggestedTagText: {
    color: appleColors.accentLight,
    fontSize: 12,
    fontWeight: "600",
  },
});

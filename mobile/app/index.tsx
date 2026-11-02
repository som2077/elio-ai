import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
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

    await supabase
      .from("saved_videos")
      .update({ status: newStatus })
      .eq("id", video.id);
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
        <StatusBar style="light" backgroundColor={appleColors.canvas} translucent={true} />
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
      <StatusBar style="light" backgroundColor={appleColors.canvas} translucent={true} />

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
            <ScrollView contentContainerStyle={styles.listContent}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </ScrollView>
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
                  onPress={() =>
                    openVideoDirectly(
                      item.clean_url,
                      item.platform as any,
                      item.platform_video_id
                    )
                  }
                  onToggleStatus={() => toggleStatus(item)}
                />
              )}
              contentContainerStyle={styles.gridContent}
              ListEmptyComponent={
                <EmptyState
                  filter={filter}
                  onOpenScanner={() => setShowScanner(true)}
                />
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
                  onPress={() =>
                    openVideoDirectly(
                      item.clean_url,
                      item.platform as any,
                      item.platform_video_id
                    )
                  }
                  onToggleStatus={() => toggleStatus(item)}
                />
              )}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <EmptyState
                  filter={filter}
                  onOpenScanner={() => setShowScanner(true)}
                />
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
                onPress={() =>
                  openVideoDirectly(
                    item.clean_url,
                    item.platform as any,
                    item.platform_video_id
                  )
                }
                onToggleStatus={() => toggleStatus(item)}
              />
            )}
            contentContainerStyle={styles.gridContent}
            ListEmptyComponent={
              <View style={styles.emptySearchBox}>
                <Text style={styles.emptySearchText}>
                  {searchQuery
                    ? `No clips found matching "${searchQuery}"`
                    : "Start typing to search your saved video collection"}
                </Text>
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
        onScanSuccess={() => {
          fetchVideos();
        }}
      />

      {/* Secondary Linked Devices Modal */}
      <LinkedDevicesModal
        visible={showDevicesModal}
        onClose={() => setShowDevicesModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: appleColors.canvas,
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
  gridContent: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 110,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 110,
  },
  emptySearchBox: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySearchText: {
    color: appleColors.textTertiary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});

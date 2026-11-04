import React, { useEffect, useState, useMemo, useRef } from "react";
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
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../services/supabase";
import { SavedVideo } from "../types/video";
import { VideoCard } from "../components/VideoCard";
import { VideoGridCard } from "../components/VideoGridCard";
import { FloatingTabBar, TabKey } from "../components/FloatingTabBar";
import { SearchBar } from "../components/SearchBar";
import { InsightsView } from "../components/InsightsView";
import { DevicesView } from "../components/DevicesView";
import { SkeletonCard } from "../components/SkeletonCard";
import { GridSkeletonCard } from "../components/GridSkeletonCard";
import { VideoDetailSheet } from "../components/VideoDetailSheet";
import { ToastHUD, ToastConfig } from "../components/ToastHUD";
import { openVideoDirectly } from "../services/deepLink";
import { AuthScreen } from "../components/AuthScreen";
import { QRScannerModal } from "../components/QRScannerModal";
import { LinkedDevicesModal } from "../components/LinkedDevicesModal";
import { AppleHeader } from "../components/AppleHeader";
import { EmptyState } from "../components/EmptyState";
import { FeedsDrawer, FeedFilterType } from "../components/FeedsDrawer";
import { CreateFeedModal } from "../components/CreateFeedModal";
import { QuickClipModal } from "../components/QuickClipModal";
import { triggerLayoutMotion } from "../utils/motion";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import {
  processSharedContent,
  flushPendingShares,
} from "../services/shareHandler";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 48;
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  // Threads modals & drawers
  const [showFeedsDrawer, setShowFeedsDrawer] = useState(false);
  const [showCreateFeedModal, setShowCreateFeedModal] = useState(false);
  const [showQuickClipModal, setShowQuickClipModal] = useState(false);
  const [feedDrawerFilter, setFeedDrawerFilter] =
    useState<FeedFilterType>("for_you");

  // Tab states
  const [activeTab, setActiveTab] = useState<TabKey>("feed");

  // Twitter Collapsible Header on Scroll
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isHeaderVisible = useRef(true);
  const lastScrollY = useRef(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    if (currentY <= 15) {
      // Near top of feed -> always show full header
      if (!isHeaderVisible.current) {
        isHeaderVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    } else if (diff > 8 && currentY > 50) {
      // Scrolling down -> smoothly slide header bar up
      if (isHeaderVisible.current) {
        isHeaderVisible.current = false;
        Animated.timing(headerTranslateY, {
          toValue: -48,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    } else if (diff < -12) {
      // Scrolling up -> smoothly slide header bar back down
      if (!isHeaderVisible.current) {
        isHeaderVisible.current = true;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    }
    lastScrollY.current = currentY;
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPlatform, setSearchPlatform] = useState("all");

  // Video data & states
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Dynamic Island Toast HUD & Detail Modal states
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [detailVideo, setDetailVideo] = useState<SavedVideo | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);

  // Deep Link & Native Share Target deduplication
  const lastProcessedUrl = useRef<string>("");

  const handleIncomingDeepLink = async (incomingUrl: string | null) => {
    if (!incomingUrl) return;

    // Prevent duplicate triggers if URL was processed in last 2.5 seconds
    if (lastProcessedUrl.current === incomingUrl) return;
    lastProcessedUrl.current = incomingUrl;
    setTimeout(() => {
      lastProcessedUrl.current = "";
    }, 2500);

    try {
      const parsed = Linking.parse(incomingUrl);
      let sharedText = "";

      if (parsed.scheme === "elio-ai" && parsed.hostname === "share") {
        sharedText = (parsed.queryParams?.text as string) || "";
      } else if (incomingUrl.includes("elio-ai://share?text=")) {
        const rawQuery = incomingUrl.split("text=")[1];
        sharedText = rawQuery ? decodeURIComponent(rawQuery) : "";
      }

      if (!sharedText) return;

      haptics.selection();

      const result = await processSharedContent(sharedText, session?.user?.id);

      if (result.success) {
        if (result.isDuplicate) {
          haptics.warning();
          setToast({
            message: "Already in your Watchlist! 📌",
            type: "info",
          });
        } else {
          haptics.success();
          triggerLayoutMotion();
          const platformLabel = result.platform
            ? result.platform.toUpperCase()
            : "CLIP";

          setToast({
            message: `Saved from ${platformLabel}! ⚡`,
            type: "success",
          });

          // Refresh video watchlist
          if (session?.user?.id) {
            fetchVideos(session.user.id);
          }
        }
      } else if (result.error) {
        console.warn("[Share Handler] Notice:", result.error);
      }
    } catch (err: any) {
      console.warn("[Share Handler] Error processing link:", err.message);
    }
  };

  // Listen for native Android/iOS share target intents and deep links
  useEffect(() => {
    // 1. Cold start check (App launched via Share Sheet)
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleIncomingDeepLink(initialUrl);
      }
    });

    // 2. Warm start listener (App was already open in background)
    const subscription = Linking.addEventListener("url", (event) => {
      if (event.url) {
        handleIncomingDeepLink(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [session?.user?.id]);

  // Auth session listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthLoading(false);
      if (currentSession) {
        fetchVideos(currentSession.user.id);
        // Sync any pending clips shared while unauthenticated
        flushPendingShares(currentSession.user.id).then((synced) => {
          if (synced > 0) {
            fetchVideos(currentSession.user.id);
            setToast({
              message: `Synced ${synced} shared clip${synced > 1 ? "s" : ""}! ⚡`,
              type: "success",
            });
          }
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        fetchVideos(newSession.user.id);
        flushPendingShares(newSession.user.id);
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
          },
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
      prev.map((v) => (v.id === video.id ? { ...v, status: newStatus } : v)),
    );

    if (detailVideo && detailVideo.id === video.id) {
      setDetailVideo((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    setToast({
      message:
        newStatus === "watched"
          ? "Marked as Watched"
          : "Moved back to In Queue",
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
    [videos],
  );

  // Feed filtered videos
  const feedVideos = useMemo(() => {
    return videos.filter((v) => {
      // Feed drawer filter
      if (feedDrawerFilter === "following") return v.status === "unread";
      if (
        feedDrawerFilter === "saved" ||
        feedDrawerFilter === "favorites" ||
        feedDrawerFilter === "ghost_posts"
      ) {
        return v.status === "watched";
      }
      if (
        ["youtube", "instagram", "twitter", "tiktok", "reddit"].includes(
          feedDrawerFilter,
        )
      ) {
        return v.platform === feedDrawerFilter;
      }
      return true;
    });
  }, [videos, feedDrawerFilter]);

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

  // Split search videos into two balanced columns for Pinterest-style staggered masonry
  const { searchMasonryCol1, searchMasonryCol2 } = useMemo(() => {
    const col1: SavedVideo[] = [];
    const col2: SavedVideo[] = [];
    let h1 = 0;
    let h2 = 0;

    searchResults.forEach((v) => {
      const p = (v.platform || "").toLowerCase();
      const cat = (v.category || "").toLowerCase();
      const title = (v.title || "").toLowerCase();
      const isTall =
        cat === "reel" ||
        cat === "short" ||
        p === "tiktok" ||
        p === "instagram" ||
        title.includes("short") ||
        title.includes("reel");
      const estHeight = isTall
        ? 240
        : p === "youtube" && !title.includes("short")
          ? 165
          : 190;

      if (h1 <= h2) {
        col1.push(v);
        h1 += estHeight + 60;
      } else {
        col2.push(v);
        h2 += estHeight + 60;
      }
    });

    return { searchMasonryCol1: col1, searchMasonryCol2: col2 };
  }, [searchResults]);

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
    <SafeAreaView style={styles.safeContainer} edges={[]}>
      <StatusBar
        style="light"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* VIEW: WATCHLIST FEED */}
      {activeTab === "feed" && (
        <View style={styles.tabContentContainer}>
          {loading ? (
            <ScrollView
              contentContainerStyle={[
                styles.listContent,
                {
                  paddingTop: headerHeight,
                  paddingBottom: Math.max(insets.bottom, 12) + 60,
                },
              ]}
            >
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </ScrollView>
          ) : (
            /* 1-COLUMN FEED LIST (CLASSIC POST VIEW) */
            <FlatList
              key="list-view-1-col"
              data={feedVideos}
              numColumns={1}
              keyExtractor={(item) => item.id}
              onScroll={handleScroll}
              scrollEventThrottle={16}
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
              contentContainerStyle={[
                styles.listContent,
                {
                  paddingTop: headerHeight,
                  paddingBottom: Math.max(insets.bottom, 12) + 60,
                },
              ]}
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
                  progressViewOffset={headerHeight}
                />
              }
            />
          )}

          {/* Top Apple / Threads Header (Floating Translucent Frosted Glass) */}
          <AppleHeader
            userEmail={session?.user?.email}
            totalCount={videos.length}
            unreadCount={unreadCount}
            translateY={headerTranslateY}
            onOpenScanner={() => setShowScanner(true)}
            onOpenSearch={() => {
              triggerLayoutMotion();
              setActiveTab("search");
            }}
            onOpenFeedsDrawer={() => setShowFeedsDrawer(true)}
          />
        </View>
      )}

      {/* VIEW: SEARCH & DISCOVER */}
      {activeTab === "search" && (
        <View style={[styles.tabContentContainer, { paddingTop: insets.top }]}>
          <SearchBar
            query={searchQuery}
            selectedPlatform={searchPlatform}
            onChangeQuery={setSearchQuery}
            onSelectPlatform={setSearchPlatform}
            onClear={() => setSearchQuery("")}
            onBack={() => {
              triggerLayoutMotion();
              setActiveTab("feed");
            }}
          />

          <ScrollView
            contentContainerStyle={styles.masonryScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {searchResults.length === 0 ? (
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
                    {["Podcasts", "Design", "Shorts", "Tech", "Tutorials"].map(
                      (tag) => (
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
                      ),
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.masonryRow}>
                <View style={styles.masonryColumn}>
                  {searchMasonryCol1.map((item, idx) => (
                    <VideoGridCard
                      key={item.id}
                      video={item}
                      index={idx * 2}
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
                  ))}
                </View>
                <View style={styles.masonryColumn}>
                  {searchMasonryCol2.map((item, idx) => (
                    <VideoGridCard
                      key={item.id}
                      video={item}
                      index={idx * 2 + 1}
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
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* VIEW: ACTIVITY & INSIGHTS (ALL DATA TELEMETRY) */}
      {activeTab === "insights" && (
        <View style={[styles.tabContentContainer, { paddingTop: insets.top }]}>
          <InsightsView
            videos={videos}
            selectedDate={selectedDate}
            onSelectDate={(date) => setSelectedDate(date)}
            onVideoPress={(video) => {
              setDetailVideo(video);
              setShowDetailSheet(true);
            }}
            onBack={() => {
              triggerLayoutMotion();
              setActiveTab("feed");
            }}
          />
        </View>
      )}

      {/* VIEW: DEVICES & PC SYNC */}
      {activeTab === "devices" && (
        <View style={[styles.tabContentContainer, { paddingTop: insets.top }]}>
          <DevicesView
            userEmail={session?.user?.email}
            onOpenScanner={() => setShowScanner(true)}
            onLogout={handleLogout}
          />
        </View>
      )}

      {/* THREADS 5-TAB BOTTOM NAVIGATION DOCK */}
      <FloatingTabBar
        activeTab={activeTab}
        unreadCount={unreadCount}
        onTabSelect={(tab) => {
          triggerLayoutMotion();
          setActiveTab(tab);
        }}
        onComposePress={() => setShowQuickClipModal(true)}
      />

      {/* Threads Feeds Switcher Drawer */}
      <FeedsDrawer
        visible={showFeedsDrawer}
        activeFeed={feedDrawerFilter}
        onClose={() => setShowFeedsDrawer(false)}
        onSelectFeed={(feedKey) => {
          setFeedDrawerFilter(feedKey);
          triggerLayoutMotion();
        }}
        onCreateFeedPress={() => setShowCreateFeedModal(true)}
      />

      {/* Threads Create Feed Modal */}
      <CreateFeedModal
        visible={showCreateFeedModal}
        onClose={() => setShowCreateFeedModal(false)}
        onCreateFeed={(feedName) => {
          setToast({
            message: `Feed "${feedName}" created`,
            type: "success",
          });
        }}
      />

      {/* Threads Quick Clip Composer Modal */}
      <QuickClipModal
        visible={showQuickClipModal}
        userEmail={session?.user?.email}
        onClose={() => setShowQuickClipModal(false)}
        onClipSaved={() => {
          fetchVideos();
          setToast({
            message: "Clip saved to vault",
            type: "success",
          });
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
  masonryScrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 110,
  },
  masonryRow: {
    flexDirection: "row",
    gap: 10,
  },
  masonryColumn: {
    flex: 1,
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

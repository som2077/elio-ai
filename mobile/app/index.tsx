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
  Easing,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Keyboard,
  useWindowDimensions,
  Platform,
} from "react-native";
import * as Linking from "expo-linking";
import { PikaIcon } from "../components/PikaIcon";
import { BlurView } from "expo-blur";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../services/supabase";
import { SavedVideo, WatchStatus } from "../types/video";
import { VideoCard } from "../components/VideoCard";
import { VideoGridCard } from "../components/VideoGridCard";
import { FloatingTabBar, TabKey } from "../components/FloatingTabBar";
import { SearchBar } from "../components/SearchBar";
import { InsightsView } from "../components/InsightsView";
import { DevicesView } from "../components/DevicesView";
import { SkeletonCard } from "../components/SkeletonCard";
import { GridSkeletonCard } from "../components/GridSkeletonCard";
import { VideoDetailSheet } from "../components/VideoDetailSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ToastHUD, ToastConfig } from "../components/ToastHUD";
import { openVideoDirectly } from "../services/deepLink";
import { AuthScreen } from "../components/AuthScreen";
import { QRScannerModal } from "../components/QRScannerModal";
import { LinkedDevicesModal } from "../components/LinkedDevicesModal";
import {
  AppleHeader,
  HEADER_COLLAPSIBLE_HEIGHT,
} from "../components/AppleHeader";
import { PlatformFilterModal } from "../components/PlatformFilterModal";
import { EmptyState } from "../components/EmptyState";
import type { FeedFilterType } from "../components/FeedsDrawer";
import { CreateFeedModal } from "../components/CreateFeedModal";
import { QuickClipModal } from "../components/QuickClipModal";
import { AskElioModal, AskElioView } from "../components/AskElioModal";
import { searchInsideVideosSemantic } from "../services/aiService";
import type { SemanticSearchResult } from "../types/ai";
import { triggerLayoutMotion } from "../utils/motion";
import { appleColors } from "../theme/appleTokens";
import { haptics } from "../utils/haptics";
import {
  processSharedContent,
  flushPendingShares,
} from "../services/shareHandler";
import { syncWidgetsData } from "../services/widgetSync";
import { toDateKey, formatDisplayDate } from "../services/dateAnalytics";

interface ScrollToTopButtonProps {
  onPress: () => void;
  opacity: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
  headerTranslateY: Animated.Value;
  headerHeight: number;
  bottomInset: number;
}

const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = React.memo(
  ({ onPress, opacity, scale, headerTranslateY, headerHeight, bottomInset }) => {
    const [canTouch, setCanTouch] = useState(false);

    useEffect(() => {
      const listenerId = headerTranslateY.addListener(({ value }) => {
        const isHidden = value <= -headerHeight * 0.55;
        setCanTouch((prev) => (prev !== isHidden ? isHidden : prev));
      });
      return () => {
        headerTranslateY.removeListener(listenerId);
      };
    }, [headerTranslateY, headerHeight]);

    return (
      <Animated.View
        pointerEvents={canTouch ? "auto" : "none"}
        style={[
          styles.scrollToTopBtnContainer,
          {
            bottom: bottomInset,
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.scrollToTopBtn}
          onPress={onPress}
          disabled={!canTouch}
        >
          <BlurView
            intensity={45}
            tint="systemUltraThinMaterialDark"
            blurReductionFactor={2}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <PikaIcon name="arrow-up" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + HEADER_COLLAPSIBLE_HEIGHT;
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  // Threads modals & drawers
  const [showCreateFeedModal, setShowCreateFeedModal] = useState(false);
  const [showQuickClipModal, setShowQuickClipModal] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [feedDrawerFilter, setFeedDrawerFilter] =
    useState<FeedFilterType>("for_you");

  // Filter Bar state: Platforms
  const [pinnedPlatforms, setPinnedPlatforms] = useState<string[]>([
    "youtube",
    "instagram",
    "twitter",
    "reddit",
  ]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [showPlatformModal, setShowPlatformModal] = useState(false);

  // Tab states
  const [activeTab, setActiveTab] = useState<TabKey>("feed");

  // AI features states
  const [showAskElioModal, setShowAskElioModal] = useState(false);
  const [searchMode, setSearchMode] = useState<"title" | "inside_video">("title");
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);

  // Twitter Collapsible Header & Bottom Navbar on Scroll
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isHeaderVisible = useRef(true);
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);
  const flatListRef = useRef<FlatList<SavedVideo>>(null);

  // TabBar slides down out of view when header hides
  const tabBarTranslateY = headerTranslateY.interpolate({
    inputRange: [-headerHeight, 0],
    outputRange: [120, 0],
    extrapolate: "clamp",
  });

  const tabBarOpacity = headerTranslateY.interpolate({
    inputRange: [-headerHeight, -headerHeight * 0.4, 0],
    outputRange: [0, 0.75, 1],
    extrapolate: "clamp",
  });

  // Floating "Scroll to Top" button pops in at bottom-right when navbar is hidden
  const scrollToTopOpacity = headerTranslateY.interpolate({
    inputRange: [-headerHeight, -headerHeight * 0.5, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: "clamp",
  });

  const scrollToTopScale = headerTranslateY.interpolate({
    inputRange: [-headerHeight, -headerHeight * 0.5, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });

  // Industry-Grade Horizontal Pager (WhatsApp / Telegram / Twitter Style)
  const { width: screenWidth } = useWindowDimensions();
  const horizontalPagerRef = useRef<ScrollView>(null);
  const isProgrammaticScrollRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const isModalOpen = Boolean(
    showDetailSheet ||
      showPlatformModal ||
      showAskElioModal ||
      showScanner ||
      showQuickClipModal ||
      showDevicesModal,
  );

  const TABS: TabKey[] = ["feed", "ai", "insights", "devices"];

  const getTabIndex = (tab: TabKey): number => {
    switch (tab) {
      case "feed":
        return 0;
      case "ai":
        return 1;
      case "insights":
        return 2;
      case "devices":
        return 3;
      default:
        return 0;
    }
  };

  const handleTabSelect = (tab: TabKey) => {
    Keyboard.dismiss();
    if (tab === "search") {
      setActiveTab("search");
      return;
    }

    const targetIndex = getTabIndex(tab);
    isProgrammaticScrollRef.current = true;
    activeTabRef.current = tab;
    setActiveTab(tab);

    horizontalPagerRef.current?.scrollTo({
      x: targetIndex * screenWidth,
      animated: false,
    });

    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  };

  const handlePagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isProgrammaticScrollRef.current) return;
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / screenWidth);
    const candidateTab = TABS[pageIndex];
    if (candidateTab && candidateTab !== activeTabRef.current) {
      activeTabRef.current = candidateTab;
      setActiveTab(candidateTab);
    }
  };

  const handlePagerMomentumScrollEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    isProgrammaticScrollRef.current = false;
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / screenWidth);
    const finalTab = TABS[pageIndex];
    if (finalTab && finalTab !== activeTabRef.current) {
      haptics.selection();
      activeTabRef.current = finalTab;
      setActiveTab(finalTab);
    }
  };

  const showHeaderAndNavbar = () => {
    if (isHeaderVisible.current) return;
    isHeaderVisible.current = true;
    headerTranslateY.stopAnimation();
    Animated.timing(headerTranslateY, {
      toValue: 0,
      duration: 250,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  };

  const hideHeaderAndNavbar = () => {
    if (!isHeaderVisible.current) return;
    isHeaderVisible.current = false;
    headerTranslateY.stopAnimation();
    Animated.timing(headerTranslateY, {
      toValue: -headerHeight,
      duration: 260,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();
  };

  const scrollToTop = () => {
    haptics.medium();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    accumulatedDelta.current = 0;
    showHeaderAndNavbar();
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    // 1. Top of feed / bounce protection: always show header & navbar immediately
    if (currentY <= 15) {
      accumulatedDelta.current = 0;
      if (!isHeaderVisible.current) {
        showHeaderAndNavbar();
      }
      lastScrollY.current = Math.max(0, currentY);
      return;
    }

    // 2. Track accumulated directional delta (resets on direction inversion)
    if ((diff > 0 && accumulatedDelta.current < 0) || (diff < 0 && accumulatedDelta.current > 0)) {
      accumulatedDelta.current = diff;
    } else {
      accumulatedDelta.current += diff;
    }

    // 3. Twitter-style responsive hide/show with visible smooth animation:
    // - Scrolling Down: Hide smoothly when thumb moves down > 24px and past top buffer
    if (accumulatedDelta.current > 24 && currentY > 40) {
      hideHeaderAndNavbar();
    }
    // - Scrolling Up: Show immediately with smooth animation when thumb reverses by > 14px
    else if (accumulatedDelta.current < -14) {
      showHeaderAndNavbar();
    }

    lastScrollY.current = currentY;
  };

  // Always keep header & tab bar visible when navigating to AI, Insights, or Devices
  useEffect(() => {
    if (activeTab !== "feed") {
      headerTranslateY.stopAnimation();
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 250,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }).start();
      isHeaderVisible.current = true;
      accumulatedDelta.current = 0;
    }
  }, [activeTab]);

  // Load pinned platforms from AsyncStorage on startup
  useEffect(() => {
    AsyncStorage.getItem("@clipper_pinned_platforms").then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPinnedPlatforms(parsed);
          }
        } catch (e) {
          console.warn("Failed to load pinned platforms:", e);
        }
      }
    });
  }, []);

  const togglePinnedPlatform = (key: string) => {
    setPinnedPlatforms((prev) => {
      let next: string[];
      if (prev.includes(key)) {
        next = prev.filter((p) => p !== key);
        if (selectedPlatform === key) {
          setSelectedPlatform("all");
        }
      } else {
        next = [...prev, key];
      }
      AsyncStorage.setItem("@clipper_pinned_platforms", JSON.stringify(next));
      return next;
    });
  };

  const handleSelectPlatform = (platformKey: string) => {
    if (platformKey === selectedPlatform) {
      haptics.light();
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    haptics.selection();
    triggerLayoutMotion(200);
    setSelectedPlatform(platformKey);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
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
        const list = data as SavedVideo[];
        setVideos(list);
        syncWidgetsData(list);
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
    const newStatus: WatchStatus = video.status === "unread" ? "watched" : "unread";
    haptics.success();
    triggerLayoutMotion();

    setVideos((prev) => {
      const updated = prev.map((v) =>
        v.id === video.id ? { ...v, status: newStatus } : v,
      );
      syncWidgetsData(updated);
      return updated;
    });

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

  const toggleFavorite = async (video: SavedVideo) => {
    const newFav = !video.is_favorite;
    haptics.selection();
    triggerLayoutMotion();

    setVideos((prev) => {
      const updated = prev.map((v) =>
        v.id === video.id ? { ...v, is_favorite: newFav } : v,
      );
      syncWidgetsData(updated);
      return updated;
    });

    if (detailVideo && detailVideo.id === video.id) {
      setDetailVideo((prev) => (prev ? { ...prev, is_favorite: newFav } : null));
    }

    setToast({
      message: newFav ? "Saved to Favorites ❤️" : "Removed from Favorites",
      type: "success",
    });

    await supabase
      .from("saved_videos")
      .update({ is_favorite: newFav })
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

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: videos.length,
    };
    videos.forEach((v) => {
      const p = (v.platform || "").toLowerCase();
      if (p) {
        counts[p] = (counts[p] || 0) + 1;
      }
    });
    return counts;
  }, [videos]);

  // Feed filtered videos (Platform Tabs + Feed Drawer + Calendar Date)
  const feedVideos = useMemo(() => {
    return videos.filter((v) => {
      // 0. Calendar Date filter
      if (selectedDate) {
        const videoDateKey = toDateKey(v.created_at);
        if (videoDateKey !== selectedDate) {
          return false;
        }
      }

      // 1. Top platform horizontal tab filter
      if (selectedPlatform !== "all" && v.platform !== selectedPlatform) {
        return false;
      }

      // 2. Feed drawer filter
      if (feedDrawerFilter === "productive") {
        // AI Productive Filter: only high-value educational, skill-building, and tutorial clips
        if (v.ai_metadata?.is_educational === false) return false;
        if (v.ai_metadata?.is_educational === true) return true;
        
        // Keyword & category evaluation for clips pending AI metadata
        const lowerTitle = (v.title || "").toLowerCase();
        const lowerNotes = (v.user_notes || "").toLowerCase();
        const productiveKeywords = [
          "tutorial", "guide", "how to", "explained", "course", "learn",
          "code", "coding", "react", "python", "ai", "llm", "developer",
          "business", "startup", "finance", "invest", "money", "productivity",
          "habit", "system", "deep work", "book", "summary", "framework",
          "podcast", "interview", "tips", "hacks", "fitness", "workout", "recipe"
        ];
        return productiveKeywords.some((kw) => lowerTitle.includes(kw) || lowerNotes.includes(kw));
      }
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
  }, [videos, feedDrawerFilter, selectedPlatform, selectedDate]);

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

  // Inside-Video Semantic Search Trigger
  useEffect(() => {
    if (searchMode !== "inside_video" || searchQuery.trim().length < 2) {
      setSemanticResults([]);
      setIsSearchingSemantic(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSemantic(true);
      try {
        const res = await searchInsideVideosSemantic(searchQuery.trim());
        setSemanticResults(res);
      } catch (e) {
        console.warn("Inside-video search issue:", e);
      } finally {
        setIsSearchingSemantic(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode]);

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
        <StatusBar
          style="light"
          backgroundColor={appleColors.canvas}
          translucent={true}
        />
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

      {/* Industry-Grade Native Horizontal Pager (Home ⟷ AI ⟷ Insights ⟷ Devices) */}
      <ScrollView
        ref={horizontalPagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handlePagerScroll}
        onMomentumScrollEnd={handlePagerMomentumScrollEnd}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isModalOpen}
        style={styles.pagerScrollView}
        contentContainerStyle={{ width: screenWidth * 4, height: "100%" }}
      >
        {/* PAGE 0: WATCHLIST FEED */}
        <View style={{ width: screenWidth, height: "100%" }}>
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
                ref={flatListRef}
                key="list-view-1-col"
                data={feedVideos}
                numColumns={1}
                keyExtractor={(item) => item.id}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                ListHeaderComponent={
                  selectedDate ? (
                    <View style={styles.activeDateFilterHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                        <PikaIcon name="film" size={13} color="#818CF8" />
                        <Text style={styles.activeDateFilterHeaderText}>
                          Filtered by {formatDisplayDate(selectedDate)}
                        </Text>
                        <View style={styles.activeDateCountBadge}>
                          <Text style={styles.activeDateCountText}>
                            {feedVideos.length} {feedVideos.length === 1 ? "clip" : "clips"}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.clearDateFilterBtn}
                        onPress={() => {
                          haptics.selection();
                          setSelectedDate(null);
                          triggerLayoutMotion();
                        }}
                      >
                        <Text style={styles.clearDateFilterBtnText}>Show All</Text>
                        <PikaIcon name="close" size={11} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
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
                contentContainerStyle={[
                  styles.listContent,
                  {
                    paddingTop: headerHeight,
                    paddingBottom: Math.max(insets.bottom, 12) + 60,
                  },
                ]}
                ListEmptyComponent={
                  <EmptyState
                    platform={selectedPlatform}
                    onLinkPress={() => setShowScanner(true)}
                    onResetPlatform={() => handleSelectPlatform("all")}
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
              selectedPlatform={selectedPlatform}
              onSelectPlatform={handleSelectPlatform}
              onPressActiveTab={() => {
                haptics.light();
                flatListRef.current?.scrollToOffset({
                  offset: 0,
                  animated: true,
                });
              }}
              pinnedPlatforms={pinnedPlatforms}
              platformCounts={platformCounts}
              onOpenPlatformModal={() => setShowPlatformModal(true)}
              onOpenSearch={() => {
                setActiveTab("search");
              }}
            />
          </View>
        </View>

        {/* PAGE 1: ASK ELIO AI SCREEN */}
        <View style={{ width: screenWidth, height: "100%" }}>
          <View style={[styles.tabContentContainer, { paddingTop: insets.top }]}>
            <AskElioView
              onBack={() => {
                handleTabSelect("feed");
              }}
              isTab={true}
            />
          </View>
        </View>

        {/* PAGE 2: ACTIVITY & INSIGHTS (ALL DATA TELEMETRY) */}
        <View style={{ width: screenWidth, height: "100%" }}>
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
                handleTabSelect("feed");
              }}
            />
          </View>
        </View>

        {/* PAGE 3: DEVICES & PC SYNC */}
        <View style={{ width: screenWidth, height: "100%" }}>
          <View style={[styles.tabContentContainer, { paddingTop: insets.top }]}>
            <DevicesView
              userEmail={session?.user?.email}
              totalClips={videos.length}
              aiSummarizedCount={
                videos.filter(
                  (v) =>
                    Boolean(
                      v.ai_metadata?.tldw ||
                        v.ai_metadata?.processing_status === "completed",
                    ),
                ).length
              }
              onOpenScanner={() => setShowScanner(true)}
              onLogout={handleLogout}
              onOpenPlatformModal={() => setShowPlatformModal(true)}
            />
          </View>
        </View>
      </ScrollView>

      {/* OVERLAY: SEARCH & DISCOVER */}
      {activeTab === "search" && (
        <View style={[styles.searchOverlay, { paddingTop: insets.top }]}>
          <SearchBar
            query={searchQuery}
            selectedPlatform={searchPlatform}
            searchMode={searchMode}
            onToggleSearchMode={(mode) => setSearchMode(mode)}
            onChangeQuery={setSearchQuery}
            onSelectPlatform={setSearchPlatform}
            onClear={() => setSearchQuery("")}
            onBack={() => {
              handleTabSelect("feed");
            }}
          />

          <ScrollView
            contentContainerStyle={styles.masonryScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {searchMode === "inside_video" ? (
              <View style={styles.semanticSearchContainer}>
                {isSearchingSemantic ? (
                  <View style={styles.semanticLoadingBox}>
                    <ActivityIndicator size="small" color="#A78BFA" />
                    <Text style={styles.semanticLoadingText}>
                      Scanning video transcripts with AI...
                    </Text>
                  </View>
                ) : semanticResults.length > 0 ? (
                  <View style={styles.semanticResultsList}>
                    {semanticResults.map((item) => {
                      const mins = Math.floor(item.start_seconds / 60);
                      const secs = item.start_seconds % 60;
                      const timeStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
                      return (
                        <TouchableOpacity
                          key={item.chunk_id}
                          activeOpacity={0.8}
                          style={styles.semanticResultCard}
                          onPress={() => {
                            haptics.selection();
                            openVideoDirectly(
                              item.clean_url,
                              item.platform || "other",
                              undefined,
                              item.start_seconds
                            );
                          }}
                        >
                          <View style={styles.semanticCardHeader}>
                            <Text style={styles.semanticVideoTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <View style={styles.semanticJumpPill}>
                              <PikaIcon name="play" size={10} color="#A78BFA" />
                              <Text style={styles.semanticJumpText}>▶ {timeStr}</Text>
                            </View>
                          </View>
                          <Text style={styles.semanticExcerptText} numberOfLines={3}>
                            "{item.chunk_text}"
                          </Text>
                          <Text style={styles.semanticMatchRate}>
                            ✦ Match score: {Math.round(item.similarity * 100)}%
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptySearchBox}>
                    <PikaIcon name="sparkles" size={28} color="#A78BFA" style={{ marginBottom: 10 }} />
                    <Text style={styles.emptySearchTitle}>
                      {searchQuery ? "No matching moments" : "Search Spoken Words Inside Videos"}
                    </Text>
                    <Text style={styles.emptySearchText}>
                      {searchQuery
                        ? `No exact sentences spoken in your saved clips matched "${searchQuery}".`
                        : "Type any concept, recipe step, command, or topic to jump to the exact second in the video."}
                    </Text>
                  </View>
                )}
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptySearchBox}>
                <PikaIcon
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

      {/* FLOATING SCROLL TO TOP BUTTON (BOTTOM RIGHT) */}
      {activeTab === "feed" && (
        <ScrollToTopButton
          onPress={scrollToTop}
          opacity={scrollToTopOpacity}
          scale={scrollToTopScale}
          headerTranslateY={headerTranslateY}
          headerHeight={headerHeight}
          bottomInset={Math.max(insets.bottom, 14) + 16}
        />
      )}

      {/* THREADS 4-TAB BOTTOM NAVIGATION DOCK */}
      <FloatingTabBar
        activeTab={activeTab}
        isAIActive={activeTab === "ai" || showAskElioModal}
        unreadCount={unreadCount}
        translateY={tabBarTranslateY}
        opacity={tabBarOpacity}
        onTabSelect={handleTabSelect}
        onOpenAskElio={() => handleTabSelect("ai")}
        onComposePress={() => setShowQuickClipModal(true)}
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

      {/* Platform Filter Bottom Sheet Modal */}
      <PlatformFilterModal
        visible={showPlatformModal}
        selectedPlatform={selectedPlatform}
        pinnedPlatforms={pinnedPlatforms}
        platformCounts={platformCounts}
        onSelectPlatform={handleSelectPlatform}
        onTogglePlatform={togglePinnedPlatform}
        onClose={() => setShowPlatformModal(false)}
      />

      {/* Interactive Video Detail & Action Sheet */}
      <VideoDetailSheet
        video={detailVideo}
        visible={showDetailSheet}
        onClose={() => setShowDetailSheet(false)}
        onPlay={(v) =>
          openVideoDirectly(v.clean_url, v.platform as any, v.platform_video_id)
        }
        onToggleStatus={toggleStatus}
        onToggleFavorite={toggleFavorite}
        onCopyLink={handleCopyLink}
        onDelete={handleDeleteVideo}
      />

      {/* Ask Elio Conversational RAG Modal */}
      <AskElioModal
        visible={showAskElioModal}
        onClose={() => setShowAskElioModal(false)}
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
  pagerScrollView: {
    flex: 1,
  },
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 100,
  },
  swipeContainer: {
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
  scrollToTopBtnContainer: {
    position: "absolute",
    right: 20,
    zIndex: 999,
    elevation: 20,
  },
  scrollToTopBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(22, 24, 28, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    elevation: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  semanticSearchContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  semanticLoadingBox: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  semanticLoadingText: {
    color: "#A78BFA",
    fontSize: 13,
    fontWeight: "500",
  },
  semanticResultsList: {
    gap: 10,
    paddingBottom: 24,
  },
  semanticResultCard: {
    backgroundColor: "#161720",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
  },
  semanticCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  semanticVideoTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginRight: 8,
  },
  semanticJumpPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(167, 139, 250, 0.16)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(167, 139, 250, 0.4)",
    gap: 4,
  },
  semanticJumpText: {
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: "700",
  },
  semanticExcerptText: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  },
  semanticMatchRate: {
    color: "#71767B",
    fontSize: 11,
    marginTop: 6,
    fontWeight: "500",
  },
  activeDateFilterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  activeDateFilterHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  activeDateCountBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeDateCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#818CF8",
  },
  clearDateFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#27272A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearDateFilterBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D4D4D8",
  },
});

import React from "react";
import {
  Image,
  ImageStyle,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PikaIcon } from "./PikaIcon";

export interface PlatformIconProps {
  platform: string;
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle | TextStyle | ViewStyle>;
}

export const PLATFORM_BRAND_COLORS: Record<string, string> = {
  youtube: "#FF0033",
  instagram: "#E1306C",
  twitter: "#FFFFFF",
  x: "#FFFFFF",
  threads: "#FFFFFF",
  tiktok: "#00F2FE",
  reddit: "#FF4500",
  snapchat: "#FFFC00",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  pinterest: "#E60023",
  all: "#FFFFFF",
};

export const PLATFORM_IMAGES: Record<string, any> = {
  youtube: require("../assets/social-icons/youtube.png"),
  instagram: require("../assets/social-icons/instagram.png"),
  twitter: require("../assets/social-icons/twitter.png"),
  x: require("../assets/social-icons/twitter.png"),
  tiktok: require("../assets/social-icons/tiktok.png"),
  reddit: require("../assets/social-icons/reddit.png"),
  facebook: require("../assets/social-icons/facebook.png"),
  linkedin: require("../assets/social-icons/linkedin.png"),
  pinterest: require("../assets/social-icons/pinterest.png"),
};

/**
 * Authentic Official Social Platform Brand Icon
 * Uses official high-res app icons:
 * - YouTube (official authentic red play button rectangle with white triangle)
 * - Instagram (official vibrant gradient squircle)
 * - X / Twitter (official 𝕏 icon)
 * - TikTok (official neon cyan/magenta note)
 * - Reddit (official orange Snoo icon)
 * - Facebook (official blue circle with white 'f')
 * - LinkedIn (official blue square with white 'in')
 * - Pinterest (official red circle with white 'P')
 */
export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  size = 16,
  color,
  style,
}) => {
  const p = (platform || "").toLowerCase().trim();
  const iconSource = PLATFORM_IMAGES[p];

  if (p === "all" || p === "queue") {
    return (
      <Ionicons
        name="layers-outline"
        size={size}
        color={color || PLATFORM_BRAND_COLORS.all || "#FFFFFF"}
        style={style as any}
      />
    );
  }

  if (p === "snapchat") {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.22),
            backgroundColor: "#FFFC00",
            alignItems: "center",
            justifyContent: "center",
          },
          style as any,
        ]}
      >
        <Ionicons
          name="logo-snapchat"
          size={Math.max(10, Math.round(size * 0.76))}
          color="#000000"
        />
      </View>
    );
  }

  if (p === "threads") {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.22),
            backgroundColor: "#16181C",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.18)",
            alignItems: "center",
            justifyContent: "center",
          },
          style as any,
        ]}
      >
        <Ionicons
          name="at"
          size={Math.max(10, Math.round(size * 0.78))}
          color="#FFFFFF"
        />
      </View>
    );
  }

  if (iconSource) {
    const isYouTube = p === "youtube";
    // YouTube's official play rectangle has an authentic 1.428 aspect ratio
    const iconWidth = isYouTube ? Math.round(size * 1.35) : size;
    const iconHeight = isYouTube ? Math.round(size * 0.94) : size;

    // Apply squircle border radius only to icons that need it (not YouTube or round Facebook)
    const radius =
      isYouTube || p === "facebook"
        ? undefined
        : size > 20
          ? Math.round(size * 0.22)
          : Math.max(2, Math.round(size * 0.2));

    return (
      <Image
        source={iconSource}
        style={[
          {
            width: iconWidth,
            height: iconHeight,
            borderRadius: radius,
            overflow: radius ? "hidden" : undefined,
          },
          style as any,
        ]}
        resizeMode="contain"
      />
    );
  }

  // Fallback for custom or unknown platform
  const iconColor = color || PLATFORM_BRAND_COLORS[p] || "#FFFFFF";
  return (
    <PikaIcon
      name="play-circle-outline"
      size={size}
      color={iconColor}
      style={style as any}
    />
  );
};

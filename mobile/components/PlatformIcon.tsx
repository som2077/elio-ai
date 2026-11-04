import React from "react";
import { StyleProp, TextStyle } from "react-native";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";

export interface PlatformIconProps {
  platform: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export const PLATFORM_BRAND_COLORS: Record<string, string> = {
  youtube: "#FF0033",
  instagram: "#E1306C",
  twitter: "#FFFFFF",
  x: "#FFFFFF",
  tiktok: "#00F2FE",
  reddit: "#FF4500",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  pinterest: "#E60023",
  all: "#FFFFFF",
};

/**
 * Authentic Official Social Platform Brand Icon
 * Uses official FontAwesome6 brand vector glyphs:
 * - 𝕏 (x-twitter)
 * - TikTok (official musical note glyph)
 * - YouTube (official play rectangle)
 * - Instagram (official camera outline glyph)
 * - Reddit (official alien glyph)
 * - Facebook & LinkedIn & Pinterest
 */
export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  size = 16,
  color,
  style,
}) => {
  const p = (platform || "").toLowerCase().trim();
  const iconColor = color || PLATFORM_BRAND_COLORS[p] || "#FFFFFF";

  switch (p) {
    case "youtube":
      return (
        <FontAwesome6
          name="youtube"
          size={size}
          color={iconColor}
          style={style}
        />
      );
    case "instagram":
      return (
        <FontAwesome6
          name="instagram"
          size={size}
          color={iconColor}
          style={style}
        />
      );
    case "twitter":
    case "x":
      return (
        <FontAwesome6
          name="x-twitter"
          size={size}
          color={iconColor}
          style={style}
        />
      );
    case "tiktok":
      return (
        <FontAwesome6
          name="tiktok"
          size={size}
          color={iconColor}
          style={style}
        />
      );
    case "reddit":
      return (
        <FontAwesome6
          name="reddit"
          size={size}
          color={iconColor}
          style={style}
        />
      );
    case "facebook":
      return (
        <FontAwesome6
          name="facebook"
          size={size}
          color={iconColor}
          style={style}
        />
      );
    case "linkedin":
      return (
        <FontAwesome6
          name="linkedin"
          size={size}
          color={iconColor}
          style={style}
        />
      );
    case "pinterest":
      return (
        <FontAwesome6
          name="pinterest"
          size={size}
          color={iconColor}
          style={style}
        />
      );
    default:
      return (
        <Ionicons
          name="play-circle-outline"
          size={size}
          color={iconColor}
          style={style}
        />
      );
  }
};

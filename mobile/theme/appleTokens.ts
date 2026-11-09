/**
 * Apple Human Interface Guidelines (HIG) & Liquid Glass Design Tokens
 * Calibrated for Elio AI Mobile App
 */

export const appleColors = {
  // Pure OLED Black background hierarchy (#000000)
  canvas: "#000000", // Root OLED pure black background
  canvasElevated: "#0A0A0A", // Scroll / header blend
  surfaceGlass: "rgba(255, 255, 255, 0.04)", // Base frosted glass
  surfaceGlassStrong: "rgba(255, 255, 255, 0.08)", // Active/highlight glass
  surfaceSecondary: "#181818", // Opaque card layer
  surfaceTertiary: "#202020", // Inner chip / pressed layer

  // Specular lighting & borders
  borderGlass: "rgba(255, 255, 255, 0.08)",
  borderSpecularTop: "rgba(255, 255, 255, 0.15)", // Catches light from above
  borderSubtle: "rgba(255, 255, 255, 0.06)",

  // Primary brand accent (Electric Indigo / Apple Purple-Blue)
  accent: "#6366F1",
  accentGlow: "rgba(99, 102, 241, 0.35)",
  accentLight: "#818CF8",

  // Twitter (X) & Telegram accents
  twitterBlue: "#1D9BF0",
  twitterGreen: "#00BA7C",
  twitterBorder: "#2F3336",
  twitterMuted: "#71767B",
  telegramCyan: "#2AABEE",
  telegramDark: "#17212B",

  // Status & semantic colors
  success: "#10B981",
  successGlow: "rgba(16, 185, 129, 0.3)",
  warning: "#F59E0B",
  destructive: "#EF4444",

  // High contrast optical typography
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textTertiary: "#64748B",
  textMuted: "#475569",

  // Platform identity colors with balanced translucency
  platforms: {
    youtube: {
      color: "#FF0033",
      bg: "rgba(255, 0, 51, 0.12)",
      border: "rgba(255, 0, 51, 0.25)",
      label: "YouTube",
    },
    instagram: {
      color: "#E1306C",
      bg: "rgba(225, 48, 108, 0.12)",
      border: "rgba(225, 48, 108, 0.25)",
      label: "Instagram",
    },
    twitter: {
      color: "#38BDF8",
      bg: "rgba(56, 189, 248, 0.12)",
      border: "rgba(56, 189, 248, 0.25)",
      label: "Twitter / 𝕏",
    },
    facebook: {
      color: "#1877F2",
      bg: "rgba(24, 119, 242, 0.12)",
      border: "rgba(24, 119, 242, 0.25)",
      label: "Facebook",
    },
    reddit: {
      color: "#FF4500",
      bg: "rgba(255, 69, 0, 0.12)",
      border: "rgba(255, 69, 0, 0.25)",
      label: "Reddit",
    },
    linkedin: {
      color: "#0A66C2",
      bg: "rgba(10, 102, 194, 0.12)",
      border: "rgba(10, 102, 194, 0.25)",
      label: "LinkedIn",
    },
    pinterest: {
      color: "#E60023",
      bg: "rgba(230, 0, 35, 0.12)",
      border: "rgba(230, 0, 35, 0.25)",
      label: "Pinterest",
    },
    tiktok: {
      color: "#00F2FE",
      bg: "rgba(0, 242, 254, 0.12)",
      border: "rgba(0, 242, 254, 0.25)",
      label: "TikTok",
    },
  },
};

/**
 * Concentric Radius Rules (Apple HIG):
 * outer radius = inner radius + padding
 */
export const appleRadii = {
  card: 20,
  cardInner: 14,
  pill: 999,
  sheet: 32,
  control: 12,
  icon: 10,
};

export const appleTypography = {
  largeTitle: {
    fontSize: 32,
    fontWeight: "800" as const,
    letterSpacing: -0.8,
    color: appleColors.textPrimary,
  },
  title2: {
    fontSize: 20,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
    color: appleColors.textPrimary,
  },
  headline: {
    fontSize: 16,
    fontWeight: "600" as const,
    letterSpacing: -0.2,
    lineHeight: 22,
    color: appleColors.textPrimary,
  },
  subhead: {
    fontSize: 13,
    fontWeight: "500" as const,
    letterSpacing: -0.1,
    color: appleColors.textSecondary,
  },
  footnote: {
    fontSize: 12,
    fontWeight: "400" as const,
    letterSpacing: 0,
    color: appleColors.textTertiary,
  },
  caption: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.2,
    color: appleColors.textSecondary,
  },
  tabularNums: {
    fontVariant: ["tabular-nums" as const],
  },
};

export const appleShadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 4,
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 8,
  },
  accentPill: {
    shadowColor: appleColors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
};

/**
 * Instagram Threads OLED Dark Design Tokens
 * Calibrated directly from reference screenshots
 */
export const threadsTokens = {
  colors: {
    canvas: "#000000",
    card: "#000000",
    surfaceElevated: "#0D0D0D",
    surfaceCard: "#121212",
    surfaceInput: "#0F0F0F",
    border: "#1F1F1F",
    borderSubtle: "#18181A",
    borderStrong: "#2A2A2A",
    textPrimary: "#F3F5F7",
    textSecondary: "#777777",
    textTertiary: "#555555",
    verifiedBlue: "#0095F6",
    likeRed: "#FF3040",
    repostGreen: "#00BA7C",
    destructive: "#FF3B30",
    actionMuted: "#777777",
    actionActive: "#FFFFFF",
  },
  radii: {
    avatar: 999,
    card: 16,
    input: 14,
    pill: 999,
    sheet: 24,
    button: 12,
  },
};

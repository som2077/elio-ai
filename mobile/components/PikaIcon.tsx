/**
 * PikaIcon — Unified Pikaicons wrapper for Clipper app
 * Replaces all @expo/vector-icons Ionicons usage
 * Uses @pikaicons/core-free icon data + react-native-svg renderer
 */
import React from "react";
import Svg, {
  Path,
  G,
  Circle,
  Rect,
  Ellipse,
  Line,
  Polyline,
  Polygon,
  ClipPath,
  Defs,
  LinearGradient,
  Stop,
  Use,
} from "react-native-svg";
import {
  SearchIcon,
  SearchSolidIcon,
  Ai01SolidIcon,
  Ai01DuoSolidIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MultipleCrossCancelCircleIcon, // close / close-circle
  PlusIcon,
  DeleteDustbin01Icon, // trash
  HeartIcon,
  HeartSolidIcon,
  StarIcon,
  StarSolidIcon,
  CheckTickCircleIcon,
  CheckTickCircleSolidIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  EyeOffIcon,
  LinkChainHorizontalIcon, // link
  QrIcon, // qr-code
  PlayCircleIcon, // play
  VideoCallIcon,
  Share01Icon,
  PencilEditIcon,
  LogOutRightIcon, // log-out
  UserCircleIcon,
  UserPlusIcon,
  GraphBarLineIcon, // bar-chart
  Piechart01Icon, // pie-chart
  LayoutGridStackDownIcon, // layout-grid
  SidebarMenuIcon, // list / reorder
  SparkleAi01Icon,
  BotIcon,
  RefreshIcon,
  LaptopIcon,
  TvIcon, // monitor/desktop fallback
  ThreeDotsMenuHorizontalIcon,
  Settings01Icon,
  UploadUpIcon,
  TvIcon as MonitorTvIcon,
  YoutubeIcon,
  TwitterIcon,
  TiktokIcon,
  ThreadsIcon,
  LinkedinIcon,
  PinterestIcon,
  FacebookIcon,
  RedditNewIcon, // reddit
  BookmarkIcon,
  BookmarkSolidIcon,
  FireIcon, // flame
  LightningThunderElectricOnIcon, // zap/flash
  LightningThunderElectricOnSolidIcon,
  TagIcon,
  UserIcon,
  UserSolidIcon,
  UserContrastIcon,
  GraphTrendLineIcon,
  ExternalLinkSquareIcon,
  HomeSimpleSolidIcon,
  HomeSimpleContrastIcon,
  HomeIcon,
  HomeSolidIcon,
  UserCircleSolidIcon,
  Piechart01SolidIcon,
  GraphBarLineDuoStrokeIcon,
  GraphTrendLineUpwardIcon,
  GraphTrendLineUpwardDuoStrokeIcon,
  SparkleAi01SolidIcon,
  PlusCircleIcon,
  PlusCircleSolidIcon,
  ArrowUpIcon,
  HomeSimpleIcon,
  CopyIcon,
  CopySolidIcon,
  CameraIcon,
  GlobeIcon,
  KeyLeftIcon,
  LockCloseIcon,
  FilterFunnelIcon,
} from "@pikaicons/core-free";

// Simple geometric circle icon for status dots / unread markers
const CircleOutlineIcon = [
  [
    "circle",
    {
      cx: "12",
      cy: "12",
      r: "8",
      stroke: "currentColor",
      strokeWidth: "2",
      fill: "none",
    },
  ],
];
const CircleSolidIcon = [
  ["circle", { cx: "12", cy: "12", r: "8", fill: "currentColor" }],
];

// --- Icon Map: Ionicons name → Pikaicons icon object ---
export const PIKA_MAP: Record<string, any> = {
  // Home (Navbar Feed)
  home: HomeIcon,
  "home-outline": HomeIcon,
  "home-solid": HomeSolidIcon,
  "home-simple-solid": HomeSimpleSolidIcon,
  "home-simple-contrast": HomeSimpleIcon,
  HomeSimpleSolidIcon: HomeSimpleSolidIcon,
  HomeSimpleContrastIcon: HomeSimpleIcon,

  // Navigation
  "arrow-back": ArrowLeftIcon,
  "arrow-up": ArrowUpIcon,
  "arrow-up-outline": ArrowUpIcon,
  "chevron-back": ChevronLeftIcon,
  "chevron-forward": ChevronRightIcon,
  "chevron-down": ChevronDownIcon,
  "reorder-two-outline": SidebarMenuIcon,

  // Actions
  add: PlusIcon,
  "add-outline": PlusIcon,
  "add-circle": PlusCircleIcon,
  "add-circle-solid": PlusCircleSolidIcon,
  close: MultipleCrossCancelCircleIcon,
  "close-circle": MultipleCrossCancelCircleIcon,
  search: SearchIcon,
  "search-outline": SearchIcon,
  "search-solid": SearchSolidIcon,
  SearchIcon: SearchIcon,
  SearchSolidIcon: SearchSolidIcon,
  refresh: RefreshIcon,
  "open-outline": ExternalLinkSquareIcon,
  "link-outline": LinkChainHorizontalIcon,
  "pencil-outline": PencilEditIcon,
  "trash-outline": DeleteDustbin01Icon,
  "trash-bin-outline": DeleteDustbin01Icon,
  trash: DeleteDustbin01Icon,
  "log-out-outline": LogOutRightIcon,
  share: Share01Icon,
  "share-outline": Share01Icon,
  "share-social-outline": Share01Icon,
  copy: CopyIcon,
  "copy-outline": CopyIcon,
  "copy-solid": CopySolidIcon,
  CopyIcon: CopyIcon,
  CopySolidIcon: CopySolidIcon,
  "eye-off-outline": EyeOffIcon,
  "camera-outline": CameraIcon,
  camera: CameraIcon,
  "globe-outline": GlobeIcon,
  globe: GlobeIcon,
  "key-outline": KeyLeftIcon,
  key: KeyLeftIcon,
  "lock-closed": LockCloseIcon,
  "lock-closed-outline": LockCloseIcon,
  "options-outline": FilterFunnelIcon,
  options: FilterFunnelIcon,
  "compass-outline": SearchIcon,
  compass: SearchIcon,

  // Status / Feedback
  checkmark: CheckTickCircleIcon,
  "checkmark-circle": CheckTickCircleSolidIcon,
  "checkmark-done": CheckTickCircleSolidIcon,
  "checkmark-done-outline": CheckTickCircleIcon,
  "ellipse-outline": CircleOutlineIcon,
  "circle-outline": CircleOutlineIcon,
  ellipse: CircleSolidIcon,
  circle: CircleSolidIcon,
  alert: AlertCircleIcon,
  "alert-circle-outline": AlertCircleIcon,
  "alert-triangle-outline": AlertTriangleIcon,
  flame: FireIcon,
  flash: LightningThunderElectricOnIcon,
  "flash-solid": LightningThunderElectricOnSolidIcon,
  LightningThunderElectricOnIcon: LightningThunderElectricOnIcon,
  LightningThunderElectricOnSolidIcon: LightningThunderElectricOnSolidIcon,
  sparkles: SparkleAi01Icon,
  "sparkles-outline": SparkleAi01Icon,
  "sparkles-solid": SparkleAi01SolidIcon,
  Ai01SolidIcon: Ai01SolidIcon,
  Ai01DuoSolidIcon: Ai01DuoSolidIcon,
  "ai-solid": Ai01SolidIcon,
  "ai-duo-solid": Ai01DuoSolidIcon,

  // Media / Content
  play: PlayCircleIcon,
  "play-circle": PlayCircleIcon,
  "play-circle-outline": PlayCircleIcon,
  film: TvIcon,
  "film-outline": TvIcon,
  "videocam-outline": VideoCallIcon,
  "volume-mute-outline": EyeOffIcon,
  "musical-notes": TiktokIcon,

  // User / Profile
  person: UserCircleIcon,
  "person-outline": UserCircleIcon,
  "person-solid": UserCircleSolidIcon,
  "person-circle": UserCircleIcon,
  "person-circle-solid": UserCircleSolidIcon,
  user: UserIcon,
  "user-solid": UserSolidIcon,
  "user-contrast": UserIcon,
  UserSolidIcon: UserSolidIcon,
  UserContrastIcon: UserIcon,
  "person-remove-outline": UserIcon,
  "user-plus": UserPlusIcon,

  // Devices / Tech
  "qr-code-outline": QrIcon,
  "desktop-outline": MonitorTvIcon,
  "laptop-outline": LaptopIcon,
  "layers-outline": LayoutGridStackDownIcon,

  // Analytics
  "bar-chart": GraphBarLineIcon,
  "bar-chart-outline": GraphBarLineIcon,
  "bar-chart-solid": GraphBarLineDuoStrokeIcon,
  "pie-chart": Piechart01Icon,
  "pie-chart-outline": Piechart01Icon,
  "pie-chart-solid": Piechart01SolidIcon,
  "trend-up": GraphTrendLineUpwardIcon,
  "trend-up-solid": GraphTrendLineUpwardDuoStrokeIcon,
  "trending-up": GraphTrendLineUpwardIcon,
  "trending-up-outline": GraphTrendLineUpwardIcon,

  // Social Platforms
  youtube: YoutubeIcon,
  "logo-youtube": YoutubeIcon,
  instagram: ThreadsIcon,
  "logo-instagram": ThreadsIcon,
  twitter: TwitterIcon,
  "logo-twitter": TwitterIcon,
  "x-twitter": TwitterIcon,
  tiktok: TiktokIcon,
  reddit: RedditNewIcon,
  "logo-reddit": RedditNewIcon,
  linkedin: LinkedinIcon,
  "logo-linkedin": LinkedinIcon,
  facebook: FacebookIcon,
  "logo-facebook": FacebookIcon,
  pinterest: PinterestIcon,
  "logo-pinterest": PinterestIcon,

  // Google
  "logo-google": UserCircleIcon,

  // Misc
  "chatbubble-ellipses-outline": BotIcon,
  "ellipsis-horizontal": ThreeDotsMenuHorizontalIcon,
  heart: HeartIcon,
  "heart-outline": HeartIcon,
  "heart-solid": HeartSolidIcon,
  HeartIcon: HeartIcon,
  HeartSolidIcon: HeartSolidIcon,
  star: StarIcon,
  "star-outline": StarIcon,
  "star-solid": StarSolidIcon,
  StarIcon: StarIcon,
  StarSolidIcon: StarSolidIcon,
  bookmark: BookmarkIcon,
  "bookmark-outline": BookmarkIcon,
  "bookmark-solid": BookmarkSolidIcon,
  tag: TagIcon,
  "graph-trend": GraphTrendLineIcon,
};

// Maps Pikaicon node tag names → react-native-svg components
const SVG_COMPONENTS: Record<string, any> = {
  path: Path,
  g: G,
  circle: Circle,
  rect: Rect,
  ellipse: Ellipse,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
  clipPath: ClipPath,
  defs: Defs,
  linearGradient: LinearGradient,
  stop: Stop,
  use: Use,
};

/** Recursively renders Pikaicon node arrays using react-native-svg */
function renderPikaNode(
  node: any,
  key: number | string,
  color: string,
  strokeWidth?: number,
): React.ReactElement | null {
  if (!Array.isArray(node)) return null;
  const [tag, attrs, children] = node;

  // Handle nested arrays (DuoStroke icons wrap nodes in arrays)
  if (Array.isArray(tag)) {
    return (
      <G key={key}>
        {(tag as any[]).map((n: any, i: number) =>
          renderPikaNode(n, i, color, strokeWidth),
        )}
      </G>
    );
  }

  const Component = SVG_COMPONENTS[tag];
  if (!Component) return null;

  // Resolve attrs: replace "currentColor", normalize kebab-case → camelCase
  const resolved: Record<string, any> = {};
  for (const [k, v] of Object.entries(attrs || {})) {
    const camel = k.replace(/-([a-z])/g, (_: string, c: string) =>
      c.toUpperCase(),
    );
    if (typeof v === "string" && v === "currentColor") {
      resolved[camel] = color;
    } else if (camel === "strokeWidth" && strokeWidth !== undefined) {
      resolved[camel] = strokeWidth;
    } else if (camel === "opacity") {
      // Ensure opacity is a valid float number and boosted for dark mode visibility (at least 0.6)
      const parsed = parseFloat(String(v));
      resolved[camel] = isNaN(parsed) ? 1 : Math.max(parsed, 0.6);
    } else {
      resolved[camel] = v;
    }
  }

  const kids = Array.isArray(children)
    ? children.map((child: any, i: number) =>
        renderPikaNode(child, i, color, strokeWidth),
      )
    : undefined;

  return (
    <Component key={key} {...resolved}>
      {kids}
    </Component>
  );
}

interface PikaIconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: any;
}

/**
 * Drop-in replacement for <Ionicons name="..." size={} color={} />
 * Usage: <PikaIcon name="search" size={20} color="#fff" />
 */
export const PikaIcon: React.FC<PikaIconProps> = ({
  name,
  size = 24,
  color = "#FFFFFF",
  strokeWidth,
  style,
}) => {
  const iconData = PIKA_MAP[name];

  if (!iconData) {
    console.warn(`[PikaIcon] No mapping for icon: "${name}"`);
    return null;
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
    >
      {iconData.map((node: any, i: number) =>
        renderPikaNode(node, i, color, strokeWidth),
      )}
    </Svg>
  );
};

export default PikaIcon;

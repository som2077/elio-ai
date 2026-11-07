// Multi-Platform Social Media Content & Caption Scraper for Elio AI
// Extracts high-signal captions, author info, engagement, and metadata for non-YouTube platforms:
// Instagram Reels/Posts, Twitter/X Posts, TikTok Clips, Reddit Discussions, Facebook Reels, and LinkedIn.

export interface SocialScrapedContent {
  platform: string;
  title?: string;
  creator?: string;
  caption: string;
  keywords?: string[];
  thumbnailUrl?: string;
  extraContext?: string;
}

/**
 * Decodes common HTML entities found in scraped social media meta tags
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2019;/g, "'")
    .replace(/&#x2018;/g, "'")
    .replace(/&#x201C;/g, '"')
    .replace(/&#x201D;/g, '"')
    .replace(/&#064;/g, "@")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x1f92f;/g, "🤯")
    .replace(/&#x2728;/g, "✨")
    .replace(/&#x1f680;/g, "🚀")
    .replace(/&#x2764;&#xfe0f;/g, "❤️")
    .replace(/&#x1f447;/g, "👇")
    .replace(/&#x2014;/g, "—")
    .replace(/&#x2022;/g, "•")
    .trim();
}

/**
 * Clean Instagram Reel / Post Scraper
 * Uses Facebook/Instagram crawler headers which return rich meta tags without login walls
 */
export async function scrapeInstagramContent(
  url: string,
): Promise<SocialScrapedContent | null> {
  try {
    const cleanUrl = url.split("?")[0].replace(/\/+$/, "");
    const res = await fetch(cleanUrl + "/", {
      headers: {
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn(
        `[socialScraper] Instagram fetch failed with status: ${res.status}`,
      );
      return null;
    }

    const html = await res.text();

    const descMatch =
      html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
      html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
    const titleMatch =
      html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
      html.match(/<meta\s+name="twitter:title"\s+content="([^"]*)"/i);
    const keywordsMatch = html.match(
      /<meta\s+name="keywords"\s+content="([^"]*)"/i,
    );
    const imageMatch = html.match(
      /<meta\s+property="og:image"\s+content="([^"]*)"/i,
    );

    let rawDesc = descMatch ? decodeHtmlEntities(descMatch[1]) : "";
    let creator = "";
    let caption = rawDesc;

    // Pattern 1: "9,521 likes, 2,639 comments - growwithcheema on September 25, 2026: \"Caption...\""
    const parsedEngagement = rawDesc.match(
      /^[0-9,KMkm.]+\s+likes,\s+[0-9,KMkm.]+\s+comments\s+-\s+([^\s]+)\s+on\s+[^:]+:\s*"(.*)"/s,
    );

    if (parsedEngagement) {
      creator = parsedEngagement[1];
      caption = parsedEngagement[2];
    } else {
      // Pattern 2: "Starter Story on Instagram: \"Bro's AI video editor makes $11,200 per month...\""
      const parsedOg = (
        titleMatch ? decodeHtmlEntities(titleMatch[1]) : ""
      ).match(/^(.+?)\s+on\s+Instagram:\s*"(.*)"/s);
      if (parsedOg) {
        creator = parsedOg[1];
        if (!caption || caption.length < parsedOg[2].length) {
          caption = parsedOg[2];
        }
      }
    }

    // Extract creator handle from twitter:title e.g. "Starter Story (@starter_story) • Instagram reel"
    if (!creator) {
      const twitterTitle = html.match(
        /<meta\s+name="twitter:title"\s+content="([^"]*)"/i,
      );
      if (twitterTitle) {
        const decoded = decodeHtmlEntities(twitterTitle[1]);
        const m = decoded.match(/^(.+?)\s*\((@[^)]+)\)/);
        if (m) {
          creator = `${m[1]} (${m[2]})`;
        }
      }
    }

    const keywords = keywordsMatch
      ? keywordsMatch[1]
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : [];

    const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : "";
    const cleanTitle = caption
      ? caption.split("\n")[0].slice(0, 120)
      : rawTitle.slice(0, 120);

    return {
      platform: "instagram",
      title: cleanTitle || undefined,
      creator: creator || undefined,
      caption: caption || rawDesc,
      keywords,
      thumbnailUrl: imageMatch ? decodeHtmlEntities(imageMatch[1]) : undefined,
      extraContext:
        keywords.length > 0
          ? `Tags & Keywords: ${keywords.join(", ")}`
          : undefined,
    };
  } catch (err) {
    console.warn("[socialScraper] Instagram scraping error:", err);
    return null;
  }
}

/**
 * Twitter / X Tweet Scraper
 * Uses vxtwitter API which returns complete tweet body, author, media and engagement metrics
 */
export async function scrapeTwitterContent(
  url: string,
): Promise<SocialScrapedContent | null> {
  try {
    const statusMatch = url.match(/\/status(?:es)?\/(\d+)/i);
    if (!statusMatch || !statusMatch[1]) {
      return null;
    }
    const tweetId = statusMatch[1];

    // Primary: vxtwitter API (fast, returns full multi-line text and video info)
    try {
      const res = await fetch(
        `https://api.vxtwitter.com/Twitter/status/${tweetId}`,
        {
          signal: AbortSignal.timeout(5000),
        },
      );

      if (res.ok) {
        const data = await res.json();
        if (data && data.text) {
          const author =
            `${data.user_name || ""} (@${data.user_screen_name || ""})`.trim();
          const firstLine = data.text.split("\n")[0].trim();

          return {
            platform: "twitter",
            title: firstLine.slice(0, 120),
            creator: author || undefined,
            caption: data.text,
            thumbnailUrl:
              data.media_extended?.[0]?.thumbnail_url ||
              data.mediaURLs?.[0] ||
              undefined,
            extraContext: `Engagement: ${data.likes || 0} likes, ${data.retweets || 0} retweets, ${data.replies || 0} replies`,
          };
        }
      }
    } catch (vxErr) {
      console.warn(
        "[socialScraper] vxtwitter request failed, trying publish oembed:",
        vxErr,
      );
    }

    // Secondary: Twitter Publish oEmbed API
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
    const oembedRes = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      if (oembedData && oembedData.html) {
        // Strip HTML tags from embed block
        const textContent = oembedData.html
          .replace(/<blockquote[^>]*>/i, "")
          .replace(/<\/blockquote>/i, "")
          .replace(/<p[^>]*>/gi, "")
          .replace(/<\/p>/gi, "\n")
          .replace(/<a[^>]*>(.*?)<\/a>/gi, "$1")
          .replace(/<[^>]+>/g, " ")
          .replace(/&mdash;.*$/s, "") // strip footer
          .trim();

        return {
          platform: "twitter",
          title: textContent.split("\n")[0].slice(0, 120),
          creator: oembedData.author_name || undefined,
          caption: decodeHtmlEntities(textContent),
        };
      }
    }

    return null;
  } catch (err) {
    console.warn("[socialScraper] Twitter scraping error:", err);
    return null;
  }
}

/**
 * TikTok Video Scraper
 * Uses official public oEmbed and meta tag inspection
 */
export async function scrapeTikTokContent(
  url: string,
): Promise<SocialScrapedContent | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });

    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        return {
          platform: "tiktok",
          title: data.title.split("\n")[0].slice(0, 120),
          creator: data.author_name
            ? `${data.author_name} (${data.author_unique_id || ""})`.trim()
            : undefined,
          caption: data.title,
          thumbnailUrl: data.thumbnail_url || undefined,
        };
      }
    }

    // Fallback: fetch page meta description
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (pageRes.ok) {
      const html = await pageRes.text();
      const descMatch =
        html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
        html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
      const titleMatch = html.match(
        /<meta\s+property="og:title"\s+content="([^"]*)"/i,
      );
      const imgMatch = html.match(
        /<meta\s+property="og:image"\s+content="([^"]*)"/i,
      );

      if (descMatch) {
        const decoded = decodeHtmlEntities(descMatch[1]);
        return {
          platform: "tiktok",
          title: titleMatch
            ? decodeHtmlEntities(titleMatch[1]).slice(0, 120)
            : decoded.slice(0, 120),
          caption: decoded,
          thumbnailUrl: imgMatch ? decodeHtmlEntities(imgMatch[1]) : undefined,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn("[socialScraper] TikTok scraping error:", err);
    return null;
  }
}

/**
 * Reddit Post / Discussion Scraper
 * Uses Reddit public oEmbed, OpenGraph meta tags, and user notes
 */
export async function scrapeRedditContent(
  url: string,
  userNotes?: string,
): Promise<SocialScrapedContent | null> {
  try {
    // If rich post text was already captured client-side by browser extension
    if (userNotes && userNotes.trim().length > 30) {
      return {
        platform: "reddit",
        caption: userNotes,
      };
    }

    const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });

    let oembedTitle = "";
    let oembedAuthor = "";

    if (res.ok) {
      const data = await res.json();
      if (data) {
        oembedTitle = data.title || "";
        oembedAuthor = data.author_name ? `u/${data.author_name}` : "";
      }
    }

    // Also fetch page with crawler user agent for description & image
    let pageDesc = "";
    let imgUrl = "";

    try {
      const pageRes = await fetch(url, {
        headers: {
          "User-Agent":
            "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        const descMatch =
          html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
          html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
        const imgMatch = html.match(
          /<meta\s+property="og:image"\s+content="([^"]*)"/i,
        );

        if (descMatch) pageDesc = decodeHtmlEntities(descMatch[1]);
        if (imgMatch) imgUrl = decodeHtmlEntities(imgMatch[1]);
      }
    } catch {}

    const fullContent = [oembedTitle, pageDesc, userNotes]
      .filter(Boolean)
      .join("\n\n");

    return {
      platform: "reddit",
      title: oembedTitle || undefined,
      creator: oembedAuthor || undefined,
      caption: fullContent || oembedTitle,
      thumbnailUrl: imgUrl || undefined,
    };
  } catch (err) {
    console.warn("[socialScraper] Reddit scraping error:", err);
    return null;
  }
}

/**
 * Generic Social Scraper (Facebook, LinkedIn, Pinterest, Other)
 * Extracts OpenGraph and Meta tags
 */
export async function scrapeGenericSocialContent(
  url: string,
): Promise<SocialScrapedContent | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch =
      html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
      html.match(/<meta\s+name="twitter:title"\s+content="([^"]*)"/i) ||
      html.match(/<title>([^<]*)<\/title>/i);

    const descMatch =
      html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i) ||
      html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
      html.match(/<meta\s+name="twitter:description"\s+content="([^"]*)"/i);

    const imgMatch =
      html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i) ||
      html.match(/<meta\s+name="twitter:image"\s+content="([^"]*)"/i);

    const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : "";
    const rawDesc = descMatch ? decodeHtmlEntities(descMatch[1]) : "";

    if (!rawTitle && !rawDesc) return null;

    return {
      platform: "social",
      title: rawTitle.slice(0, 120),
      caption: rawDesc || rawTitle,
      thumbnailUrl: imgMatch ? decodeHtmlEntities(imgMatch[1]) : undefined,
    };
  } catch (err) {
    console.warn("[socialScraper] Generic scraping error:", err);
    return null;
  }
}

/**
 * Unified Dispatcher: Extracts content for any social platform
 */
export async function extractSocialContent(
  url: string,
  platform: string,
  videoRecord?: any,
): Promise<SocialScrapedContent | null> {
  const targetUrl = url || videoRecord?.clean_url || videoRecord?.original_url;
  if (!targetUrl) return null;

  const lowerPlatform = (platform || "").toLowerCase();
  const lowerUrl = targetUrl.toLowerCase();

  if (lowerPlatform === "instagram" || lowerUrl.includes("instagram.com")) {
    return await scrapeInstagramContent(targetUrl);
  }

  if (
    lowerPlatform === "twitter" ||
    lowerPlatform === "x" ||
    lowerUrl.includes("twitter.com") ||
    lowerUrl.includes("x.com")
  ) {
    return await scrapeTwitterContent(targetUrl);
  }

  if (lowerPlatform === "tiktok" || lowerUrl.includes("tiktok.com")) {
    return await scrapeTikTokContent(targetUrl);
  }

  if (
    lowerPlatform === "reddit" ||
    lowerUrl.includes("reddit.com") ||
    lowerUrl.includes("redd.it")
  ) {
    return await scrapeRedditContent(targetUrl, videoRecord?.user_notes);
  }

  // Fallback for Facebook, LinkedIn, Pinterest, Other
  return await scrapeGenericSocialContent(targetUrl);
}

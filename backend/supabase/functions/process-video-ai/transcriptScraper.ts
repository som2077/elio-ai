// Deno-compatible Transcript Scraper for YouTube & Social Media
// Scrapes free public subtitles/timedtext without requiring expensive audio transcription.

export interface TranscriptSnippet {
  text: string;
  start: number; // in seconds
  duration: number; // in seconds
}

/**
 * Extracts YouTube video ID from standard or shorts URLs
 */
export function extractYouTubeId(url: string): string | null {
  const regExp =
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

/**
 * Fetches free YouTube captions/subtitles track using public timedtext
 */
export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<TranscriptSnippet[]> {
  try {
    // 1. Fetch YouTube video page HTML to locate playerCaptionsTracklistRenderer
    const videoPageResponse = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
    );

    if (!videoPageResponse.ok) {
      return [];
    }

    const html = await videoPageResponse.text();

    // 2. Parse playerCaptionsTracklistRenderer JSON from page
    const captionsMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionsMatch || !captionsMatch[1]) {
      return [];
    }

    const captionTracks = JSON.parse(captionsMatch[1]);
    if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
      return [];
    }

    // Prioritize English, then auto-generated or first track
    let targetTrack = captionTracks.find(
      (t: any) => t.languageCode === "en" && t.kind !== "asr",
    );
    if (!targetTrack) {
      targetTrack =
        captionTracks.find((t: any) => t.languageCode === "en") ||
        captionTracks[0];
    }

    if (!targetTrack || !targetTrack.baseUrl) {
      return [];
    }

    // 3. Fetch timedtext XML from YouTube
    const transcriptXmlResponse = await fetch(targetTrack.baseUrl);
    if (!transcriptXmlResponse.ok) {
      return [];
    }

    const xmlText = await transcriptXmlResponse.text();

    // 4. Parse simple XML timedtext nodes: <text start="0.5" dur="3.2">Hello world</text>
    const snippets: TranscriptSnippet[] = [];
    const textNodeRegex =
      /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
    let match: RegExpExecArray | null;

    while ((match = textNodeRegex.exec(xmlText)) !== null) {
      const start = parseFloat(match[1]) || 0;
      const duration = parseFloat(match[2]) || 2;
      // Decode XML entities (e.g. &amp;, &quot;, &#39;)
      let text = match[3]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, " ")
        .trim();

      if (text.length > 0) {
        snippets.push({ text, start, duration });
      }
    }

    return snippets;
  } catch (err) {
    console.warn(
      `[transcriptScraper] Failed to fetch YouTube captions for ${videoId}:`,
      err,
    );
    return [];
  }
}

/**
 * Splits transcript snippets into coherent ~60-second chunks for pgvector embeddings
 */
export function chunkTranscript(
  snippets: TranscriptSnippet[],
  targetChunkDurationSeconds = 60,
): {
  chunkIndex: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
}[] {
  if (snippets.length === 0) return [];

  const chunks: {
    chunkIndex: number;
    startSeconds: number;
    endSeconds: number;
    text: string;
  }[] = [];
  let currentTextParts: string[] = [];
  let chunkStart = snippets[0].start;
  let chunkEnd = snippets[0].start + snippets[0].duration;
  let chunkIndex = 0;

  for (const snippet of snippets) {
    currentTextParts.push(snippet.text);
    chunkEnd = snippet.start + snippet.duration;

    if (chunkEnd - chunkStart >= targetChunkDurationSeconds) {
      chunks.push({
        chunkIndex,
        startSeconds: Math.floor(chunkStart),
        endSeconds: Math.ceil(chunkEnd),
        text: currentTextParts.join(" "),
      });
      chunkIndex++;
      currentTextParts = [];
      chunkStart = snippet.start + snippet.duration;
    }
  }

  // Add trailing chunk if any
  if (currentTextParts.length > 0) {
    chunks.push({
      chunkIndex,
      startSeconds: Math.floor(chunkStart),
      endSeconds: Math.ceil(chunkEnd),
      text: currentTextParts.join(" "),
    });
  }

  return chunks;
}

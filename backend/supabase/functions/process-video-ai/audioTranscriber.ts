// Deno-compatible Audio Transcription Module for Elio AI
// Transcribes speech from video audio using OpenAI Whisper (`whisper-1`) or Groq (`whisper-large-v3-turbo`)
// Extracts exact timestamped segments so users understand what was spoken inside Reels, Shorts, and Clips.

import type { TranscriptSnippet } from "./transcriptScraper.ts";

export interface AudioTranscriptionResult {
  snippets: TranscriptSnippet[];
  fullTranscript: string;
  language: string;
  durationSeconds: number;
}

/**
 * Transcribes an audio Blob or Uint8Array using OpenAI Whisper or Groq Whisper API
 */
export async function transcribeAudioBuffer(
  audioData: Uint8Array | Blob,
  fileName: string = "audio.mp4",
  apiKey: string,
  provider: "openai" | "groq" = "openai",
): Promise<AudioTranscriptionResult | null> {
  if (!apiKey || !audioData) return null;

  try {
    const formData = new FormData();
    const blob =
      audioData instanceof Blob
        ? audioData
        : new Blob([audioData], { type: "audio/mp4" });

    formData.append("file", blob, fileName);
    formData.append(
      "model",
      provider === "groq" ? "whisper-large-v3-turbo" : "whisper-1",
    );
    formData.append("response_format", "verbose_json");
    formData.append("temperature", "0.2");

    const endpoint =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/audio/transcriptions"
        : "https://api.openai.com/v1/audio/transcriptions";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(30000), // 30 sec timeout
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(
        `[audioTranscriber] ${provider} Whisper API error:`,
        response.status,
        errText,
      );
      return null;
    }

    const data = await response.json();
    const segments = Array.isArray(data.segments) ? data.segments : [];
    const snippets: TranscriptSnippet[] = segments
      .map((seg: any) => ({
        text: (seg.text || "").trim(),
        start: parseFloat(seg.start) || 0,
        duration: Math.max(
          (parseFloat(seg.end) || 0) - (parseFloat(seg.start) || 0),
          1,
        ),
      }))
      .filter((s: TranscriptSnippet) => s.text.length > 0);

    const fullTranscript = (
      data.text || snippets.map((s) => s.text).join(" ")
    ).trim();

    return {
      snippets,
      fullTranscript,
      language: data.language || "en",
      durationSeconds: Math.ceil(
        data.duration || segments[segments.length - 1]?.end || 0,
      ),
    };
  } catch (err) {
    console.warn("[audioTranscriber] Transcription exception:", err);
    return null;
  }
}

/**
 * Attempts to extract and download public audio/video stream for social media clips
 * (Instagram Reels, TikTok clips, Twitter videos) under 25MB for speech transcription.
 */
export async function downloadClipMediaStream(
  mediaUrl: string,
): Promise<{ buffer: Uint8Array; fileName: string } | null> {
  if (!mediaUrl) return null;

  try {
    const res = await fetch(mediaUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;

    const contentLength = parseInt(
      res.headers.get("content-length") || "0",
      10,
    );
    // Limit to 25MB (Whisper API max upload limit)
    if (contentLength > 25 * 1024 * 1024) {
      console.warn(
        "[audioTranscriber] Clip exceeds 25MB Whisper limit:",
        contentLength,
      );
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: new Uint8Array(arrayBuffer),
      fileName: "clip_audio.mp4",
    };
  } catch (err) {
    console.warn("[audioTranscriber] Media download failed:", err);
    return null;
  }
}

# ✦ Elio AI - yt-dlp Companion Service

A high-performance, containerized Python FastAPI companion microservice providing media metadata extraction, zero-download timed subtitle parsing, and speech-optimized audio extraction (downmixed to 16 kHz mono 32 kbps MP3 for Whisper transcription).

---

## 1. Key Capabilities

1. **Universal Extraction**: Supports 1,000+ video and audio platforms out-of-the-box (YouTube, Instagram Reels, TikTok, Twitter/X, Reddit, Facebook, Vimeo, Twitch).
2. **Zero-Download Subtitle Parsing**: Fetches manual and automatic caption tracks directly from stream manifests without downloading video or audio chunks (< 2s latency).
3. **Whisper-Optimized Audio Pipeline**: Extracts and transcodes audio to 32 kbps mono 16 kHz MP3 via FFmpeg. 1 hour of audio is ~13.7 MB, safely under OpenAI Whisper's 25 MB payload limit.
4. **Strict SSRF Guard**: Prohibits private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`) and internal metadata services.
5. **Scratch Disk Safety**: Uses FastAPI background cleanup hooks to guarantee temporary audio files are unlinked immediately after streaming.

---

## 2. API Reference

### `GET /health`
Verifies microservice operational health, yt-dlp version, FFmpeg/FFprobe availability, active concurrency slots, and scratch disk space.

**Response (`200 OK`):**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "ytdlp_version": "2024.10.26",
  "ffmpeg_available": true,
  "ffprobe_available": true,
  "active_tasks": 0,
  "temp_dir_free_mb": 42100
}
```

---

### `POST /extract-metadata`
Extracts rich video metadata and available subtitle tracks without downloading video media.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "include_raw": false,
  "proxy": null
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "platform": "youtube",
  "video_id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
  "description": "The official video for “Never Gonna Give You Up” by Rick Astley...",
  "uploader": "Rick Astley",
  "uploader_id": "@RickAstleyYT",
  "channel_url": "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw",
  "duration": 213,
  "view_count": 1540200300,
  "like_count": 17400000,
  "upload_date": "20091024",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "webpage_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "available_subtitles": ["en", "es", "fr"],
  "auto_subtitles": ["en", "hi", "ur", "es"],
  "formats_summary": [
    {
      "format_id": "140",
      "ext": "m4a",
      "vcodec": "none",
      "acodec": "mp4a.40.2",
      "abr": 128
    }
  ],
  "error": null
}
```

---

### `POST /extract-subtitles`
Extracts and parses manual or automatic subtitles into structured timestamped cues (`TranscriptSnippet[]`) without downloading media bytes.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "preferred_languages": ["en", "hi", "ur", "es"],
  "include_auto": true,
  "format": "snippets"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "language": "en",
  "is_auto": false,
  "full_text": "We're no strangers to love You know the rules and so do I...",
  "snippets": [
    {
      "text": "We're no strangers to love",
      "start": 18.5,
      "duration": 4.2
    },
    {
      "text": "You know the rules and so do I",
      "start": 23.0,
      "duration": 4.1
    }
  ],
  "available_tracks": ["en", "es", "auto-en", "auto-hi"],
  "error": null
}
```

---

### `POST /extract-audio`
Transcodes and extracts speech-optimized audio. Supports direct binary streaming (`return_mode="stream"`) or asynchronous download metadata (`return_mode="json"`).

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "format": "mp3",
  "bitrate": "32k",
  "sample_rate": 16000,
  "channels": 1,
  "max_duration_seconds": 3600,
  "return_mode": "stream"
}
```

**Response (`return_mode="stream"`):**
- **Status:** `200 OK`
- **Headers:**
  - `Content-Type: audio/mpeg`
  - `Content-Disposition: attachment; filename="audio_dQw4w9WgXcQ.mp3"`
  - `X-Audio-Duration: 213`
  - `X-Audio-Bitrate: 32k`
  - `X-Audio-Channels: 1`
  - `X-Audio-Sample-Rate: 16000`
- **Body:** Binary MP3 audio payload.

---

## 3. Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | HTTP listening port |
| `HOST` | `0.0.0.0` | Bind host |
| `SERVICE_KEY` | `None` | Shared service token for Bearer / X-API-Key auth. If omitted, auth check is disabled (development mode). |
| `TEMP_BASE_DIR` | `/tmp/elio-ytdlp` | Scratch directory for subtitle parsing and audio transcoding |
| `MAX_CONCURRENT_EXTRACTIONS` | `10` | Concurrency limiter for FFmpeg and yt-dlp processes |
| `DEFAULT_MAX_DURATION_SECONDS` | `3600` | Default duration cap (1 hour) |

---

## 4. Local Development & Testing

### Direct Local Run (Python)
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start Uvicorn server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Run Automated Tests
```bash
python3 test_service.py
# or
pytest test_service.py -v
```

---

## 5. Docker Deployment

### Build Image
```bash
docker build -t elio-yt-dlp-service:latest backend/yt-dlp-service/
```

### Run Container
```bash
docker run -d \
  -p 8000:8000 \
  -e SERVICE_KEY="your-secret-key" \
  -e MAX_CONCURRENT_EXTRACTIONS=10 \
  --name elio-yt-dlp \
  elio-yt-dlp-service:latest
```

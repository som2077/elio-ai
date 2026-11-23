import glob
import os
import shutil
import tempfile
import uuid
from typing import Any, Dict, List, Optional
import yt_dlp

from utils.vtt_parser import parse_vtt_content


class YtDlpExtractor:
    def __init__(self, temp_base_dir: str = "/tmp/elio-ytdlp"):
        self.temp_base_dir = temp_base_dir
        os.makedirs(self.temp_base_dir, exist_ok=True)

    def extract_metadata(
        self,
        url: str,
        include_raw: bool = False,
        proxy: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extracts comprehensive video metadata, available subtitles, and formats
        without downloading media bytes.
        """
        ydl_opts: Dict[str, Any] = {
            'skip_download': True,
            'extract_flat': False,
            'quiet': True,
            'no_warnings': True,
            'ignoreerrors': False,
        }
        if proxy:
            ydl_opts['proxy'] = proxy

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("Could not extract video metadata from URL")

            subtitles = list(info.get('subtitles', {}).keys())
            auto_subs = list(info.get('automatic_captions', {}).keys())

            formats_summary: List[Dict[str, Any]] = []
            for f in (info.get('formats') or [])[:20]:
                formats_summary.append({
                    "format_id": f.get("format_id"),
                    "ext": f.get("ext"),
                    "vcodec": f.get("vcodec"),
                    "acodec": f.get("acodec"),
                    "abr": f.get("abr"),
                    "resolution": f.get("resolution"),
                })

            raw_data = info if include_raw else None

            duration_val = info.get("duration")
            duration_int = int(duration_val) if duration_val is not None else None

            return {
                "success": True,
                "platform": (info.get("extractor_key") or info.get("extractor") or "unknown").lower(),
                "video_id": info.get("id"),
                "title": info.get("title"),
                "description": (info.get("description") or "")[:1500],
                "uploader": info.get("uploader") or info.get("channel") or info.get("uploader_id"),
                "uploader_id": info.get("uploader_id"),
                "channel_url": info.get("channel_url") or info.get("uploader_url"),
                "duration": duration_int,
                "view_count": info.get("view_count"),
                "like_count": info.get("like_count"),
                "upload_date": info.get("upload_date"),
                "thumbnail": info.get("thumbnail"),
                "webpage_url": info.get("webpage_url") or url,
                "available_subtitles": subtitles,
                "auto_subtitles": auto_subs,
                "formats_summary": formats_summary,
                "raw": raw_data,
                "error": None,
            }

    def extract_subtitles(
        self,
        url: str,
        preferred_languages: Optional[List[str]] = None,
        include_auto: bool = True,
        proxy: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Pulls manual or auto-generated subtitle tracks and parses them into
        timed snippets without downloading any video or audio streams.
        """
        preferred = preferred_languages or ["en", "hi", "ur", "es"]

        # Step 1: Probe available subtitle tracks via metadata
        ydl_opts: Dict[str, Any] = {
            'skip_download': True,
            'extract_flat': False,
            'quiet': True,
            'no_warnings': True,
            'ignoreerrors': False,
        }
        if proxy:
            ydl_opts['proxy'] = proxy

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("Could not probe video for subtitles")

        subs = info.get('subtitles', {})
        auto_subs = info.get('automatic_captions', {}) if include_auto else {}

        target_lang = None
        is_auto = False

        # Match strategy:
        # 1. Check exact preferred match in manual subs
        for lang in preferred:
            if lang in subs and subs[lang]:
                target_lang = lang
                is_auto = False
                break

        # 2. Check prefix match in manual subs (e.g. "en" matches "en-US")
        if not target_lang:
            for pref in preferred:
                for s_key in subs.keys():
                    if s_key.startswith(pref) and subs[s_key]:
                        target_lang = s_key
                        is_auto = False
                        break
                if target_lang:
                    break

        # 3. Check exact preferred match in auto captions
        if not target_lang and include_auto:
            for lang in preferred:
                if lang in auto_subs and auto_subs[lang]:
                    target_lang = lang
                    is_auto = True
                    break

        # 4. Check prefix match in auto captions
        if not target_lang and include_auto:
            for pref in preferred:
                for a_key in auto_subs.keys():
                    if a_key.startswith(pref) and auto_subs[a_key]:
                        target_lang = a_key
                        is_auto = True
                        break
                if target_lang:
                    break

        # 5. Fallback to any available track
        if not target_lang:
            if subs:
                target_lang = next(iter(subs.keys()))
                is_auto = False
            elif auto_subs:
                target_lang = next(iter(auto_subs.keys()))
                is_auto = True

        available_tracks = list(subs.keys()) + [f"auto-{k}" for k in auto_subs.keys()]

        if not target_lang:
            return {
                "success": False,
                "language": None,
                "is_auto": False,
                "snippets": [],
                "full_text": "",
                "available_tracks": available_tracks,
                "error": "No subtitles found matching requested languages.",
            }

        # Step 2: Download the isolated subtitle track to a temp directory
        snippets: List[Dict[str, Any]] = []
        full_text = ""

        with tempfile.TemporaryDirectory(dir=self.temp_base_dir) as tmpdir:
            sub_opts: Dict[str, Any] = {
                'skip_download': True,
                'writesubtitles': not is_auto,
                'writeautomaticsub': is_auto,
                'subtitleslangs': [target_lang],
                'subtitlesformat': 'vtt/srt/best',
                'outtmpl': os.path.join(tmpdir, 'sub'),
                'quiet': True,
                'no_warnings': True,
            }
            if proxy:
                sub_opts['proxy'] = proxy

            with yt_dlp.YoutubeDL(sub_opts) as sub_ydl:
                try:
                    sub_ydl.download([url])
                except Exception as e:
                    # In case isolated subtitle download fails
                    return {
                        "success": False,
                        "language": target_lang,
                        "is_auto": is_auto,
                        "snippets": [],
                        "full_text": "",
                        "available_tracks": available_tracks,
                        "error": f"Failed downloading subtitle track: {str(e)}",
                    }

            # Locate downloaded subtitle file (.vtt or .srt)
            sub_files = glob.glob(os.path.join(tmpdir, "*.vtt")) + glob.glob(os.path.join(tmpdir, "*.srt"))
            for sf in sub_files:
                try:
                    with open(sf, "r", encoding="utf-8", errors="ignore") as f:
                        raw_content = f.read()
                    parsed = parse_vtt_content(raw_content)
                    if parsed:
                        snippets = parsed
                        full_text = " ".join(s["text"] for s in snippets)
                        break
                except Exception:
                    continue

        return {
            "success": len(snippets) > 0,
            "language": target_lang,
            "is_auto": is_auto,
            "snippets": snippets,
            "full_text": full_text,
            "available_tracks": available_tracks,
            "error": None if len(snippets) > 0 else "Subtitle tracks existed in metadata but could not be parsed into cues.",
        }

    def extract_audio(
        self,
        url: str,
        format: str = "mp3",
        bitrate: str = "32k",
        sample_rate: int = 16000,
        channels: int = 1,
        max_duration_seconds: int = 3600,
        proxy: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Downloads best audio stream and transcodes it via FFmpeg to a lightweight
        mono speech format (default: 32 kbps mono 16 kHz MP3).
        """
        # Step 1: Pre-check video duration to prevent resource exhaustion
        meta = self.extract_metadata(url, proxy=proxy)
        duration = meta.get("duration") or 0
        if duration > 0 and duration > max_duration_seconds:
            raise ValueError(
                f"Video duration ({duration}s) exceeds maximum allowed limit ({max_duration_seconds}s)."
            )

        file_id = str(uuid.uuid4())
        clean_ext = format.lower().strip().replace(".", "")
        out_tmpl = os.path.join(self.temp_base_dir, f"{file_id}.%(ext)s")
        target_path = os.path.join(self.temp_base_dir, f"{file_id}.{clean_ext}")

        ydl_opts: Dict[str, Any] = {
            'format': 'bestaudio/best',
            'outtmpl': out_tmpl,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': clean_ext,
                'preferredquality': bitrate.replace('k', ''),
            }],
            'postprocessor_args': [
                '-ac', str(channels),
                '-ar', str(sample_rate),
                '-b:a', bitrate if 'k' in bitrate else f"{bitrate}k",
            ],
            'quiet': True,
            'no_warnings': True,
            'max_filesize': 50 * 1024 * 1024,  # 50 MB safety cap
        }
        if proxy:
            ydl_opts['proxy'] = proxy

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Verify output file
        if not os.path.exists(target_path):
            # Check for alternative extension produced by FFmpeg
            candidates = glob.glob(os.path.join(self.temp_base_dir, f"{file_id}.*"))
            if candidates:
                target_path = candidates[0]
            else:
                raise RuntimeError("Audio extraction failed: output file not found.")

        file_size = os.path.getsize(target_path)

        return {
            "file_id": file_id,
            "file_path": target_path,
            "file_name": f"audio_{meta.get('video_id') or file_id}.{clean_ext}",
            "duration": duration,
            "size_bytes": file_size,
            "video_id": meta.get("video_id") or file_id,
            "title": meta.get("title") or "video_audio",
            "format": clean_ext,
            "bitrate": bitrate,
            "channels": channels,
            "sample_rate": sample_rate,
        }
